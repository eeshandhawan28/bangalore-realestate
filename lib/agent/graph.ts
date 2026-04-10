import { Annotation, StateGraph, START, END, messagesStateReducer } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, SystemMessage, AIMessage } from "@langchain/core/messages";
import { SupabaseClient } from "@supabase/supabase-js";
import { createAgentTools } from "./tools";

const SYSTEM_PROMPT = `You are PropIQ Copilot, an AI assistant specialized in Bangalore real estate.

You have access to tools to:
- Fetch the user's property portfolio from the database
- Calculate AI-based property valuations
- Query Bangalore market statistics
- Find the best localities within a budget
- Create marketplace listings
- Check RERA project registrations

ALWAYS use the appropriate tool before answering questions that require data (portfolio, valuations, market stats).
Format all prices in Indian notation: ₹XL for lakhs (e.g., ₹85L), ₹X Cr for crores (e.g., ₹1.2 Cr).
Keep responses concise and actionable. Market data is from Q4 2024.`;

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

type AgentStateType = typeof AgentState.State;

export function createAgentGraph(supabase: SupabaseClient) {
  const tools = createAgentTools(supabase);

  const model = new ChatOpenAI({
    model: "mistralai/Mistral-7B-Instruct-v0.3",
    apiKey: process.env.HUGGINGFACE_API_KEY,
    configuration: {
      baseURL: "https://router.huggingface.co/hf-inference/v1",
    },
    temperature: 0,
    streaming: true,
    timeout: 30000, // 30s — fail fast instead of hanging
  }).bindTools(tools);

  const toolNode = new ToolNode(tools);

  async function callModel(state: AgentStateType) {
    const systemMessage = new SystemMessage(SYSTEM_PROMPT);
    const messages = [systemMessage, ...state.messages];
    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  function shouldContinue(state: AgentStateType) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }
    return END;
  }

  const graph = new StateGraph(AgentState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return graph.compile();
}
