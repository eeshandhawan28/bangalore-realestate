import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  get_portfolio: "Fetching your properties...",
  get_portfolio_summary: "Calculating portfolio stats...",
  get_valuation: "Running AI valuation...",
  get_market_stats: "Querying market data...",
  find_best_localities: "Searching localities...",
  create_listing: "Creating marketplace listing...",
  check_rera: "Checking RERA registry...",
};

export interface ToolCall {
  tool: string;
  done: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {/* Tool call pills (assistant only) */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {message.toolCalls.map((tc, i) => (
            <div
              key={i}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-highlight border border-primary/20 text-xs text-primary"
            >
              {tc.done ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {TOOL_LABELS[tc.tool] ?? tc.tool}
            </div>
          ))}
        </div>
      )}

      {/* Message bubble */}
      {(message.content || message.streaming) && (
        <div
          className={cn(
            "max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary text-white rounded-br-sm"
              : "bg-surface border border-border text-foreground rounded-bl-sm"
          )}
        >
          {message.content}
          {message.streaming && (
            <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
