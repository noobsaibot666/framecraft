import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, Send, Cpu, Sparkles,
  AlertTriangle, Check, ChevronRight, X,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import {
  buildContextPack,
  generateSuggestions,
  askAssistant,
  createThread,
  getThreadsForProject,
  deleteThread,
  addMessage,
  getMessages,
} from "@/lib/assistant";
import { createPrompt } from "@/lib/db";
import { updateProject } from "@/lib/projects";
import { AI_MODELS, getApiKey } from "@/lib/aiConfig";
import { cn } from "@/lib/utils";
import type {
  AssistantThread, AssistantMessage, AssistantSuggestion,
  ProjectContextPack,
} from "@/types";

// ─── Model picker ─────────────────────────────────────────────

function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const available = AI_MODELS.filter((m) => !!getApiKey(m.provider));

  if (available.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-sm"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <AlertTriangle size={8} className="text-white/20" />
        <span className="font-mono text-[8px] text-dim/40">No API key — suggestions only</span>
      </div>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 px-2 font-mono text-[9px] text-soft-white bg-dark rounded-sm focus:outline-none appearance-none"
      style={{ border: "1px solid rgba(255,255,255,0.10)" }}
    >
      {available.map((m) => (
        <option key={m.id} value={m.id}>{m.label}</option>
      ))}
    </select>
  );
}

// ─── Suggestion card ──────────────────────────────────────────

const SUGGESTION_ICON: Record<string, string> = {
  next_action: "→",
  avoidance_improvement: "⚠",
  reference_gap: "◻",
  winner_interpretation: "★",
};

function SuggestionCard({
  s,
  onAction,
  onAsk,
}: {
  s: AssistantSuggestion;
  onAction: (s: AssistantSuggestion) => void;
  onAsk: (body: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-sm"
      style={{ border: "var(--border-default)", background: "var(--surface-card)" }}>
      <div className="flex items-start gap-2">
        <span className="font-mono text-[10px] text-dim/40 mt-0.5">{SUGGESTION_ICON[s.kind]}</span>
        <div className="flex flex-col gap-1 flex-1">
          <span className="system-label text-[8px]">{s.label}</span>
          <p className="font-sans text-[10px] text-soft-white/80 leading-snug">{s.body}</p>
        </div>
      </div>
      <div className="flex gap-2">
        {s.action && (
          <button type="button" onClick={() => onAction(s)}
            className="font-mono text-[8px] text-dim/50 hover:text-white transition-precise">
            {s.action.label} <ChevronRight size={7} className="inline" />
          </button>
        )}
        <button type="button" onClick={() => onAsk(`Tell me more about: ${s.label}. ${s.body}`)}
          className="font-mono text-[8px] text-dim/30 hover:text-white/60 transition-precise">
          Ask assistant
        </button>
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────

function MessageBubble({ msg }: { msg: AssistantMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex items-center justify-center w-5 h-5 rounded-full shrink-0 mt-0.5",
        isUser ? "bg-white/10" : "bg-white/5"
      )}>
        {isUser
          ? <span className="font-mono text-[7px] text-dim/60">U</span>
          : <Cpu size={8} className="text-dim/50" />
        }
      </div>
      <div className={cn(
        "flex flex-col gap-1.5 max-w-[85%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-3 py-2 rounded-sm",
          isUser
            ? "bg-white/8"
            : "bg-transparent",
        )}
          style={isUser ? {} : { border: "var(--border-dim)" }}>
          <p className="font-sans text-[11px] text-soft-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.citations.map((c, i) => (
              <span key={i} className="font-mono text-[7px] text-dim/40 px-1.5 py-0.5 rounded-sm"
                style={{ border: "var(--border-dim)" }}>{c}</span>
            ))}
          </div>
        )}
        <span className="font-mono text-[7px] text-dim/25">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="flex flex-col gap-4 p-6 rounded-card w-[360px]"
        style={{ border: "var(--border-default)", background: "var(--surface-panel)" }}>
        <div className="flex items-start justify-between gap-2">
          <span className="font-sans text-[13px] text-white font-medium">{title}</span>
          <button type="button" onClick={onCancel} className="text-dim/40 hover:text-white transition-precise">
            <X size={12} />
          </button>
        </div>
        <p className="font-sans text-[11px] text-soft-white/70 leading-snug">{body}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            <Check size={9} /> {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Thread sidebar ───────────────────────────────────────────

function ThreadList({
  threads,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  threads: AssistantThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="system-label">THREADS</span>
        <button type="button" onClick={onNew}
          className="text-dim/40 hover:text-white transition-precise">
          <Plus size={10} />
        </button>
      </div>
      {threads.length === 0 && (
        <p className="font-mono text-[9px] text-dim/30 px-1">No threads yet.</p>
      )}
      {threads.map((t) => (
        <div key={t.id}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-sm cursor-pointer group transition-precise",
            activeId === t.id ? "bg-white/6" : "hover:bg-white/3"
          )}
          onClick={() => onSelect(t.id)}
        >
          <span className="flex-1 font-sans text-[10px] truncate"
            style={{ color: activeId === t.id ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)" }}>
            {t.title}
          </span>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
            className="shrink-0 text-dim/20 opacity-0 group-hover:opacity-100 hover:text-red/50 transition-precise">
            <Trash2 size={8} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function ProjectAssistant() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [pack, setPack] = useState<ProjectContextPack | null>(null);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [threads, setThreads] = useState<AssistantThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [modelId, setModelId] = useState(() => {
    const first = AI_MODELS.find((m) => !!getApiKey(m.provider));
    return first?.id ?? AI_MODELS[0].id;
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm modal state
  const [confirm, setConfirm] = useState<{
    title: string; body: string; label: string; onConfirm: () => void;
  } | null>(null);

  // ── Load initial data ─────────────────────────────────────

  const reload = useCallback(async () => {
    if (!id) return;
    const [p, t] = await Promise.all([
      buildContextPack(id),
      getThreadsForProject(id),
    ]);
    setPack(p);
    setSuggestions(p ? generateSuggestions(p) : []);
    setThreads(t);
    setLoading(false);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  // Load messages when thread changes
  useEffect(() => {
    if (!activeThreadId) { setMessages([]); return; }
    getMessages(activeThreadId).then(setMessages);
  }, [activeThreadId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Thread management ────────────────────────────────────

  const handleNewThread = async () => {
    if (!id) return;
    const title = `Thread ${threads.length + 1}`;
    const tid = await createThread(id, title);
    const updated = await getThreadsForProject(id);
    setThreads(updated);
    setActiveThreadId(tid);
  };

  const handleDeleteThread = async (tid: string) => {
    await deleteThread(tid);
    const updated = await getThreadsForProject(id!);
    setThreads(updated);
    if (activeThreadId === tid) {
      setActiveThreadId(updated[0]?.id ?? null);
    }
  };

  const handleSelectThread = async (tid: string) => {
    setActiveThreadId(tid);
    const msgs = await getMessages(tid);
    setMessages(msgs);
  };

  // ── Send message ─────────────────────────────────────────

  const handleSend = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || !pack) return;

    setError(null);
    setInput("");
    setSending(true);

    // Ensure we have a thread
    let tid = activeThreadId;
    if (!tid) {
      tid = await createThread(id!, text.slice(0, 40) + (text.length > 40 ? "…" : ""));
      const updated = await getThreadsForProject(id!);
      setThreads(updated);
      setActiveThreadId(tid);
    }

    // Add user message
    const userMsgId = await addMessage(tid, "user", text);
    const userMsg: AssistantMessage = {
      id: userMsgId,
      thread_id: tid,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Check if AI is available
    const model = AI_MODELS.find((m) => m.id === modelId);
    const hasKey = model ? !!getApiKey(model.provider) : false;

    if (!hasKey) {
      const fallback = "No API key configured. Here are my deterministic suggestions based on your project data — check the suggestion cards on the left for grounded next actions.";
      const aId = await addMessage(tid, "assistant", fallback);
      setMessages((prev) => [...prev, { id: aId, thread_id: tid!, role: "assistant", content: fallback, created_at: new Date().toISOString() }]);
      setSending(false);
      return;
    }

    // Build conversation for API (last 20 messages for context window)
    const history = [...messages, userMsg]
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const reply = await askAssistant(pack, history, modelId);
      const aId = await addMessage(tid, "assistant", reply);
      setMessages((prev) => [...prev, { id: aId, thread_id: tid!, role: "assistant", content: reply, created_at: new Date().toISOString() }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  // ── Suggestion actions ───────────────────────────────────

  const handleSuggestionAction = async (s: AssistantSuggestion) => {
    if (!s.action) return;
    if (s.action.type === "navigate" && s.action.payload) {
      navigate(s.action.payload);
      return;
    }
    if (s.action.type === "craft_prompt") {
      setConfirm({
        title: "Create draft prompt",
        body: `Create a new draft prompt titled "${pack?.project.title ?? "Untitled"} — Draft" and navigate to the craft editor?`,
        label: "Create",
        onConfirm: async () => {
          setConfirm(null);
          if (!pack || !id) return;
          const promptId = await createPrompt({
            title: `${pack.project.title} — Draft`,
            provider: "midjourney",
            prompt_text: "[AI-suggested draft — fill in]",
          });
          navigate(`/craft/${promptId}`);
        },
      });
    }
    if (s.action.type === "save_note" && s.action.payload) {
      setConfirm({
        title: "Save note to project",
        body: `Save this note to the project? It will be appended to the project notes field.`,
        label: "Save",
        onConfirm: async () => {
          setConfirm(null);
          if (!id) return;
          await updateProject(id, { notes: s.action?.payload });
        },
      });
    }
  };

  // ── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <PageContainer title="ASSISTANT">
        <div className="flex items-center justify-center py-32">
          <span className="font-ndot text-[32px] text-dim/30 dot-blink">···</span>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="ASSISTANT"
      subtitle={pack?.project.title?.toUpperCase()}
      action={
        <div className="flex items-center gap-2">
          <ModelPicker value={modelId} onChange={setModelId} />
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft size={11} /> Project
          </Button>
        </div>
      }
    >
      <div className="flex gap-4 h-[calc(100vh-160px)] min-h-0">

        {/* Left: context + suggestions */}
        <div className="w-[260px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-1">

          {/* Context summary */}
          <div className="flex flex-col gap-2">
            <span className="system-label">CONTEXT</span>
            <div className="flex flex-col gap-1 p-3 rounded-sm"
              style={{ border: "var(--border-dim)", background: "var(--surface-card)" }}>
              {pack ? (
                <>
                  <Row label="Prompts" value={`${pack.prompts.total} (${pack.prompts.winners}★)`} />
                  <Row label="Results" value={`${pack.results.total} (${pack.results.winners}★)`} />
                  <Row label="References" value={pack.references.total} />
                  <Row label="Deliverables" value={`${pack.deliverables.total}`} />
                  {pack.prompts.avgRating > 0 && <Row label="Avg rating" value={`${pack.prompts.avgRating}/10`} />}
                  {pack.results.avgScore > 0 && <Row label="Avg score" value={`${pack.results.avgScore}/10`} />}
                </>
              ) : (
                <p className="font-mono text-[9px] text-dim/40">No project data.</p>
              )}
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="system-label">SUGGESTIONS</span>
                <Sparkles size={8} className="text-dim/30" />
              </div>
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  s={s}
                  onAction={handleSuggestionAction}
                  onAsk={(body) => { setInput(body); }}
                />
              ))}
            </div>
          )}

          {/* Thread list */}
          <ThreadList
            threads={threads}
            activeId={activeThreadId}
            onSelect={handleSelectThread}
            onNew={handleNewThread}
            onDelete={handleDeleteThread}
          />
        </div>

        {/* Right: chat */}
        <div className="flex-1 flex flex-col gap-0 min-w-0 rounded-card overflow-hidden"
          style={{ border: "var(--border-default)" }}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {!activeThreadId && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Cpu size={24} className="text-dim/20" />
                <p className="font-sans text-[11px] text-soft-white/40 max-w-[240px]">
                  Ask anything about this project. The assistant uses local data — prompts, results, references, and deliverables — to give grounded answers.
                </p>
                <button type="button"
                  onClick={handleNewThread}
                  className="font-mono text-[9px] text-dim/40 hover:text-white transition-precise flex items-center gap-1.5 mt-2">
                  <Plus size={9} /> Start a thread
                </button>
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
            {sending && (
              <div className="flex gap-3">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/5 shrink-0 mt-0.5">
                  <Cpu size={8} className="text-dim/50" />
                </div>
                <div className="px-3 py-2 rounded-sm" style={{ border: "var(--border-dim)" }}>
                  <span className="font-ndot text-[12px] text-dim/40 dot-blink">···</span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-sm"
                style={{ border: "1px solid rgba(215,25,33,0.2)", background: "rgba(215,25,33,0.04)" }}>
                <AlertTriangle size={10} className="text-red/50 mt-0.5 shrink-0" />
                <p className="font-mono text-[9px] text-red/60">{error}</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 flex gap-2 items-end" style={{ borderTop: "var(--border-default)" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about this project… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={sending}
              className="flex-1 px-3 py-2 font-sans text-[11px] text-white placeholder:text-dim/30 bg-transparent rounded-sm focus:outline-none resize-none"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <button type="button"
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-sm transition-precise",
                input.trim() && !sending
                  ? "bg-white/10 hover:bg-white/15 text-white"
                  : "bg-transparent text-dim/20 cursor-not-allowed"
              )}>
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.label}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </PageContainer>
  );
}

// ─── Helper ───────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="font-mono text-[8px] text-dim/40 uppercase tracking-widest">{label}</span>
      <span className="font-mono text-[9px] text-soft-white">{value}</span>
    </div>
  );
}
