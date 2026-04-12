"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle, X, Send, Maximize2, Minimize2,
  Trash2, History, ArrowLeft, Pencil, Check, Plus,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ChatMessage, Message, ToolCall, ChartData } from "./ChatMessage";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type ApiMessage = { role: "user" | "assistant"; content: string };
type View = "chat" | "history";

// ─── Session types ────────────────────────────────────────────────────────────
interface ChatSessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  preview: string;       // first user message truncated
  messageCount: number;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const MAX_SESSIONS = 20;
const MAX_MSGS_PER_SESSION = 60;

const keySessions = (uid: string) => `propiq_sessions_${uid}`;
const keySession  = (uid: string, sid: string) => `propiq_session_${uid}_${sid}`;
const keyCurrent  = (uid: string) => `propiq_current_${uid}`;

function readJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}

function getSessions(uid: string): ChatSessionMeta[] {
  return readJSON<ChatSessionMeta[]>(keySessions(uid), [])
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getSessionMsgs(uid: string, sid: string): Message[] {
  return readJSON<Message[]>(keySession(uid, sid), [])
    .map((m) => ({ ...m, streaming: false }));
}

function saveMeta(uid: string, meta: ChatSessionMeta) {
  const list = getSessions(uid).filter((s) => s.id !== meta.id);
  list.unshift(meta);
  localStorage.setItem(keySessions(uid), JSON.stringify(list.slice(0, MAX_SESSIONS)));
}

function saveSessionMsgs(uid: string, sid: string, msgs: Message[]) {
  const toSave = msgs
    .filter((m) => !m.streaming)
    .slice(-MAX_MSGS_PER_SESSION)
    .map(({ id, role, content, chartData }) => ({ id, role, content, chartData }));
  localStorage.setItem(keySession(uid, sid), JSON.stringify(toSave));
}

function deleteSessionData(uid: string, sid: string) {
  const list = getSessions(uid).filter((s) => s.id !== sid);
  localStorage.setItem(keySessions(uid), JSON.stringify(list));
  localStorage.removeItem(keySession(uid, sid));
}

function newSessionId() { return crypto.randomUUID(); }

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Suggestions ──────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What's my portfolio worth?",
  "Portfolio health check",
  "Deep dive on Koramangala",
  "Compare Whitefield vs Devanahalli",
  "Is ₹90L fair for 2BHK in HSR Layout?",
  "Should I sell any properties?",
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatBubble() {
  const [open, setOpen]             = useState(false);
  const [expanded, setExpanded]     = useState(false);
  const [view, setView]             = useState<View>("chat");
  const [messages, setMessages]     = useState<Message[]>([]);
  const [sessions, setSessions]     = useState<ChatSessionMeta[]>([]);
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [userId, setUserId]         = useState<string | null>(null);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editName, setEditName]     = useState("");

  const scrollRef   = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Init: load user + current session ──────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const uid = session.user.id;
      setUserId(uid);

      const list = getSessions(uid);
      setSessions(list);

      // Load current session or start a new one
      const curId = localStorage.getItem(keyCurrent(uid)) ?? null;
      const existing = curId ? list.find((s) => s.id === curId) : null;
      if (existing) {
        setSessionId(curId);
        setMessages(getSessionMsgs(uid, curId!));
      } else {
        const sid = newSessionId();
        setSessionId(sid);
        localStorage.setItem(keyCurrent(uid), sid);
      }
    });
  }, []);

  // ── Persist messages on change ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !sessionId || messages.length === 0) return;
    if (messages.some((m) => m.streaming)) return;
    saveSessionMsgs(userId, sessionId, messages);

    // Update session metadata
    const firstUser = messages.find((m) => m.role === "user");
    const meta: ChatSessionMeta = {
      id: sessionId,
      name: firstUser
        ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? "…" : "")
        : "New chat",
      createdAt: sessions.find((s) => s.id === sessionId)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preview: firstUser?.content.slice(0, 60) ?? "",
      messageCount: messages.filter((m) => m.role === "user").length,
    };
    saveMeta(userId, meta);
    setSessions(getSessions(userId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, userId, sessionId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Session management ────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    if (!userId) return;
    const sid = newSessionId();
    setSessionId(sid);
    setMessages([]);
    localStorage.setItem(keyCurrent(userId), sid);
    setView("chat");
  }, [userId]);

  const loadSession = useCallback((sid: string) => {
    if (!userId) return;
    setSessionId(sid);
    setMessages(getSessionMsgs(userId, sid));
    localStorage.setItem(keyCurrent(userId), sid);
    setView("chat");
  }, [userId]);

  const deleteSession = useCallback((e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    if (!userId) return;
    deleteSessionData(userId, sid);
    const updated = getSessions(userId);
    setSessions(updated);
    if (sid === sessionId) startNewChat();
  }, [userId, sessionId, startNewChat]);

  const commitRename = useCallback((sid: string) => {
    if (!userId || !editName.trim()) { setEditingId(null); return; }
    const list = getSessions(userId);
    const meta = list.find((s) => s.id === sid);
    if (meta) {
      saveMeta(userId, { ...meta, name: editName.trim() });
      setSessions(getSessions(userId));
    }
    setEditingId(null);
  }, [userId, editName]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;

    setInput("");

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", toolCalls: [], streaming: true },
    ]);

    const history: ApiMessage[] = [...messages, userMsg]
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok || !response.body) throw new Error(`Server error: ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let remaining = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        remaining += decoder.decode(value, { stream: true });
        const lines = remaining.split("\n");
        remaining = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "token") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: m.content + event.content } : m)
              );
            } else if (event.type === "tool_start") {
              const t: ToolCall = { tool: event.tool, done: false };
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, toolCalls: [...(m.toolCalls ?? []), t] } : m)
              );
            } else if (event.type === "tool_end") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: (m.toolCalls ?? []).map((tc) => tc.tool === event.tool ? { ...tc, done: true } : tc) }
                    : m
                )
              );
            } else if (event.type === "chart") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, chartData: event.chart as ChartData } : m)
              );
            } else if (event.type === "error") {
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: `Error: ${event.message}`, streaming: false } : m)
              );
            } else if (event.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        streaming: false,
                        // Final cleanup: strip any remaining Qwen XML artifacts
                        content: m.content.replace(/<\/?tool_(?:call|response)[^>]*>/gi, "").trim(),
                      }
                    : m
                )
              );
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: `Something went wrong: ${msg}`, streaming: false } : m)
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const panelW = expanded ? "w-[calc(100vw-2rem)] max-w-[680px]" : "w-[calc(100vw-2rem)] max-w-[440px]";
  const panelH = expanded ? "h-[700px]" : "h-[580px]";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 w-12 h-12 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 z-50"
          aria-label="Open PropIQ Copilot"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {open && (
        <div className={cn("fixed bottom-20 right-4 lg:bottom-6 lg:right-6 bg-background border border-border rounded-2xl shadow-2xl flex flex-col z-50 transition-all duration-200", panelW, panelH)}>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              {view === "history" ? (
                <button onClick={() => setView("chat")} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
              )}
              <div>
                <span className="font-semibold text-sm text-foreground">
                  {view === "history" ? "Chat History" : "PropIQ Copilot"}
                </span>
                {view === "chat" && (
                  <span className="block text-[10px] text-muted-foreground leading-none">
                    {messages.length > 0
                      ? `${messages.filter((m) => m.role === "user").length} messages`
                      : "Bangalore real estate AI"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {view === "chat" && (
                <>
                  <button
                    onClick={startNewChat}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                    title="New chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setSessions(getSessions(userId ?? "")); setView("history"); }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                    title="Chat history"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted hidden lg:flex"
                  >
                    {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── History view ── */}
          {view === "history" && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-3 flex flex-col gap-1.5">
                <button
                  onClick={startNewChat}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full"
                >
                  <Plus className="w-4 h-4" />
                  New chat
                </button>

                {sessions.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">No saved chats yet</p>
                )}

                {sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={cn(
                      "group flex items-start gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-muted",
                      s.id === sessionId && "bg-primary/5 border border-primary/20"
                    )}
                  >
                    <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {editingId === s.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(s.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="text-xs flex-1 bg-background border border-primary rounded px-1.5 py-0.5 outline-none"
                          />
                          <button onClick={() => commitRename(s.id)} className="text-primary hover:text-primary/80">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{s.preview || "No messages yet"}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {s.messageCount} message{s.messageCount !== 1 ? "s" : ""} · {formatDate(s.updatedAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(s.id); setEditName(s.name); }}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background"
                        title="Rename"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => deleteSession(e, s.id)}
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-background"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Chat view ── */}
          {view === "chat" && (
            <>
              <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as React.Ref<HTMLDivElement>}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">PropIQ Copilot</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                        Ask me anything — portfolio analysis, locality insights, deal evaluations
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="text-xs text-left px-2.5 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted hover:border-primary/30 transition-colors leading-snug"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </ScrollArea>

              <div className="px-3 py-3 border-t border-border flex items-end gap-2 flex-shrink-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio or any locality..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary max-h-28 overflow-auto"
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                  disabled={loading}
                />
                <Button
                  size="icon"
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl w-10 h-10 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
