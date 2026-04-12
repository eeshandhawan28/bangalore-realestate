"use client";

import { CheckCircle2, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

const TOOL_LABELS: Record<string, string> = {
  get_portfolio: "Fetching your properties...",
  get_portfolio_summary: "Calculating portfolio stats...",
  get_valuation: "Running AI valuation...",
  get_market_stats: "Querying market data...",
  find_best_localities: "Searching localities...",
  create_listing: "Creating marketplace listing...",
  check_rera: "Checking RERA registry...",
  get_portfolio_health: "Scoring portfolio health...",
  get_sell_recommendation: "Analysing sell signals...",
  get_locality_deep_dive: "Loading locality profile...",
  compare_localities: "Comparing localities...",
  evaluate_deal: "Evaluating deal...",
};

export interface ChartData {
  type: "bar" | "line" | "grouped_bar";
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
  unit?: string;
}

export interface ToolCall {
  tool: string;
  done: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  chartData?: ChartData;
  streaming?: boolean;
}

const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

function MiniChart({ chart }: { chart: ChartData }) {
  const colors = chart.colors ?? CHART_COLORS;

  if (chart.type === "line") {
    return (
      <div className="mt-3 bg-muted/40 rounded-xl p-3 border border-border">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chart.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={chart.xKey} tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(v: unknown) => [`${v}${chart.unit ? " " + chart.unit : ""}`, ""]}
            />
            {chart.yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[i] ?? CHART_COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chart.type === "grouped_bar") {
    return (
      <div className="mt-3 bg-muted/40 rounded-xl p-3 border border-border">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">{chart.title}</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chart.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey={chart.xKey} tick={{ fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(v: unknown) => [`${v}${chart.unit ? " " + chart.unit : ""}`, ""]}
            />
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            {chart.yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i] ?? CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default: single bar chart
  return (
    <div className="mt-3 bg-muted/40 rounded-xl p-3 border border-border">
      <p className="text-[11px] font-medium text-muted-foreground mb-2">{chart.title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chart.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey={chart.xKey} tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
            formatter={(v: unknown) => [`${v}${chart.unit ? " " + chart.unit : ""}`, ""]}
          />
          {chart.yKeys.map((key) => (
            <Bar key={key} dataKey={key} radius={[3, 3, 0, 0]} maxBarSize={40}>
              {chart.data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length] ?? CHART_COLORS[0]} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      )}

      <div className={cn("flex flex-col gap-1.5 max-w-[88%]", isUser && "items-end")}>
        {/* Tool call pills */}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.toolCalls.map((tc, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors",
                  tc.done
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                    : "bg-primary/5 border-primary/20 text-primary"
                )}
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
              "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
              isUser
                ? "bg-primary text-white rounded-br-sm"
                : "bg-surface border border-border text-foreground rounded-bl-sm"
            )}
          >
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-1.5 prose-strong:text-foreground prose-pre:bg-muted prose-pre:text-xs prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:rounded">
                <ReactMarkdown>{message.content}</ReactMarkdown>
                {message.streaming && (
                  <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            )}

            {/* Inline chart */}
            {!isUser && message.chartData && !message.streaming && (
              <MiniChart chart={message.chartData} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
