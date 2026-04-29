import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export type AgentName =
  | "supervisor"
  | "pm_agent"
  | "crm_agent"
  | "market_agent"
  | "portfolio_agent";

export type PendingConfirmation = {
  action: string;
  description: string;
  params: Record<string, unknown>;
  agent: AgentName;
} | null;

/**
 * Shared LangGraph state for the PropIQ multi-agent system.
 * All agents read and write to this shared state.
 */
export const PropIQState = Annotation.Root({
  // Message history — uses built-in reducer that merges arrays
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Which agent is currently active (set by supervisor)
  active_agent: Annotation<AgentName>({
    reducer: (_, next) => next,
    default: () => "supervisor",
  }),

  // Auth context — injected once at the start
  user_id: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  organization_id: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // User's preferred language — affects AI response language
  locale: Annotation<string>({
    reducer: (_, next) => next,
    default: () => "en",
  }),

  // Human-in-the-loop: set by agent before executing high-impact actions.
  // The API layer pauses and sends a confirmation card to the UI.
  // When user confirms, this is cleared and execution resumes.
  pending_confirmation: Annotation<PendingConfirmation>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type PropIQStateType = typeof PropIQState.State;
