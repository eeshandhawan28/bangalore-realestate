import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { SupabaseClient } from "@supabase/supabase-js";
import { PropIQState, PropIQStateType, AgentName } from "./state";
import { createMarketTools } from "./tools/market-tools";
import { createPortfolioTools } from "./tools/portfolio-tools";
import { createDealTools } from "./tools/deal-tools";
import { createCrmTools } from "./tools/crm-tools";
import { createPmTools } from "./tools/pm-tools";

// ── System prompts per agent ──────────────────────────────────
const SYSTEM_PROMPTS: Record<AgentName, string> = {
  supervisor: "", // supervisor uses intent detection, not a chat prompt

  market_agent: `You are PropIQ's Bangalore Market Intelligence specialist.
You have deep knowledge of 51 Bangalore localities and can provide:
- Price trends, investment scores, rental yields
- Locality comparisons and deep-dives
- Property valuation and deal evaluation

ALWAYS call the appropriate tool before answering — never use memory for data.
Format prices in Indian notation: ₹XL (lakhs), ₹X Cr (crores).`,

  portfolio_agent: `You are PropIQ's Portfolio Analyst.
You help users understand their property portfolio performance:
- Total value, returns, and gain/loss per property
- Portfolio health across diversification, yield, appreciation, liquidity
- Sell vs hold recommendations

ALWAYS call get_portfolio or get_portfolio_summary before answering portfolio questions.`,

  crm_agent: `You are PropIQ's CRM Assistant for real estate professionals.
You help manage contacts, deals, and sales pipelines:
- Track leads, clients, contractors, vendors, and investors
- Manage deal stages from prospecting to closed
- Log activities and forecast pipeline revenue

When creating contacts or deals, confirm the key details before inserting.
Log stage changes with a brief note summarizing the reason.`,

  pm_agent: `You are PropIQ's Project Manager AI for real estate development.
You help track and manage construction and development projects:
- Create and monitor projects through their lifecycle phases
- Manage tasks with priorities, due dates, and assignees
- Identify overdue tasks, blocked dependencies, and budget burn

When creating tasks from a template or description, create them one by one with clear titles.
Always check get_overdue_alerts at the start of project management conversations.`,
};

// ── Locale-specific instruction appended to all agents ───────
const LOCALE_INSTRUCTIONS: Record<string, string> = {
  en: "",
  hi: "\n\nIMPORTANT: Respond in Hindi (Devanagari script). Use common real estate terms in Hindi.",
  kn: "\n\nIMPORTANT: Respond in Kannada (Kannada script). Use Bangalore real estate terminology.",
  ta: "\n\nIMPORTANT: Respond in Tamil (Tamil script).",
  te: "\n\nIMPORTANT: Respond in Telugu (Telugu script).",
  mr: "\n\nIMPORTANT: Respond in Marathi (Devanagari script).",
};

// ── Intent detection: route user message to the right agent ──
function detectAgent(message: string): AgentName {
  const m = message.toLowerCase();

  // CRM signals
  if (/contact|lead|client|contractor|vendor|investor|deal|pipeline|stage|proposal|prospect|follow.?up|crm/.test(m))
    return "crm_agent";

  // PM signals
  if (/project|task|assign|due|deadline|overdue|blocked|construction|phase|timeline|budget|expense|spend|milestone/.test(m))
    return "pm_agent";

  // Portfolio signals
  if (/my propert|my holding|portfolio|sell|hold|gain|loss|return|health|recommend/.test(m))
    return "portfolio_agent";

  // Market/deal signals
  if (/locality|area|market|koramangala|whitefield|indiranagar|invest|score|trend|deep.?dive|compare|valuat|deal|price|afford/.test(m))
    return "market_agent";

  return "market_agent"; // sensible default for real estate context
}

// ── Build model (shared across agents) ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildModel(tools: any[]) {
  return new ChatGroq({
    model: "llama-3.3-70b-versatile",
    apiKey: process.env.GROQ_API_KEY,
    temperature: 0,
    streaming: true,
  }).bindTools(tools);
}

// ── Create the multi-agent supervisor graph ───────────────────
export function createSupervisorGraph(
  supabase: SupabaseClient,
  organizationId: string,
  locale: string = "en"
) {
  // Collect all tools
  const marketTools    = createMarketTools();
  const portfolioTools = createPortfolioTools(supabase);
  const dealTools      = createDealTools(supabase);
  const crmTools       = createCrmTools(supabase, organizationId);
  const pmTools        = createPmTools(supabase, organizationId);

  const allTools = [...marketTools, ...portfolioTools, ...dealTools, ...crmTools, ...pmTools];
  const toolNode = new ToolNode(allTools);

  const localeInstruction = LOCALE_INSTRUCTIONS[locale] ?? "";

  // ── Node: route incoming message to the right agent ─────────
  function supervisorNode(state: PropIQStateType) {
    const lastUser = [...state.messages].reverse().find((m) => m._getType() === "human");
    const content  = typeof lastUser?.content === "string" ? lastUser.content : "";
    const agent    = detectAgent(content);
    return { active_agent: agent };
  }

  // ── Node factory: builds a node for a specific agent ─────────
  function makeAgentNode(agentName: AgentName, tools: typeof allTools) {
    const model = buildModel(tools);
    return async function agentNode(state: PropIQStateType) {
      const systemPrompt = SYSTEM_PROMPTS[agentName] + localeInstruction;
      const sysMsg = new SystemMessage(systemPrompt);
      const messages = [sysMsg, ...state.messages];
      const response = await model.invoke(messages);
      return { messages: [response], active_agent: agentName };
    };
  }

  // ── Routing: after agent runs, continue to tools or end ──────
  function shouldContinue(state: PropIQStateType): "tools" | typeof END {
    const last = state.messages[state.messages.length - 1] as AIMessage;
    if (last?.tool_calls && last.tool_calls.length > 0) return "tools";
    return END;
  }

  // ── Routing: after supervisor, which agent to call ───────────
  function routeToAgent(state: PropIQStateType): AgentName {
    return state.active_agent;
  }

  // ── Build graph ───────────────────────────────────────────────
  const graph = new StateGraph(PropIQState)
    .addNode("supervisor",      supervisorNode)
    .addNode("tools",           toolNode)
    .addNode("market_agent",    makeAgentNode("market_agent",    [...marketTools, ...dealTools]))
    .addNode("portfolio_agent", makeAgentNode("portfolio_agent", portfolioTools))
    .addNode("crm_agent",       makeAgentNode("crm_agent",       crmTools))
    .addNode("pm_agent",        makeAgentNode("pm_agent",        pmTools))
    // Start: always go to supervisor
    .addEdge(START, "supervisor")
    // Supervisor routes to one of 4 specialist agents
    .addConditionalEdges("supervisor", routeToAgent, {
      market_agent:    "market_agent",
      portfolio_agent: "portfolio_agent",
      crm_agent:       "crm_agent",
      pm_agent:        "pm_agent",
    })
    // Each agent: continue to tools or end
    .addConditionalEdges("market_agent",    shouldContinue, { tools: "tools", [END]: END })
    .addConditionalEdges("portfolio_agent", shouldContinue, { tools: "tools", [END]: END })
    .addConditionalEdges("crm_agent",       shouldContinue, { tools: "tools", [END]: END })
    .addConditionalEdges("pm_agent",        shouldContinue, { tools: "tools", [END]: END })
    // After tools, route back to whichever agent called them
    .addConditionalEdges("tools", routeToAgent, {
      market_agent:    "market_agent",
      portfolio_agent: "portfolio_agent",
      crm_agent:       "crm_agent",
      pm_agent:        "pm_agent",
    });

  return graph.compile();
}

/**
 * Exported for use in the chat route: creates the compiled graph
 * and returns all tools for TOOL_SPECS generation.
 */
export function createAllTools(supabase: SupabaseClient, organizationId: string) {
  return [
    ...createMarketTools(),
    ...createPortfolioTools(supabase),
    ...createDealTools(supabase),
    ...createCrmTools(supabase, organizationId),
    ...createPmTools(supabase, organizationId),
  ];
}
