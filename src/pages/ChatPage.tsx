import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useCreateSession, useSessionMessages, sendMessageStream } from "@/hooks/useChat";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Msg = { role: string; text: string };

export function ChatPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const createSession = useCreateSession();

  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { refetch: refetchMessages } = useSessionMessages(sessionId);

  async function startSession() {
    if (!selectedAccountId) return;
    setError(null);
    try {
      const session = await createSession.mutateAsync(selectedAccountId);
      setSessionId(session.id);
      setMessages([]);
      setLatency(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function loadHistory() {
    if (!sessionId) return;
    setError(null);
    try {
      const result = await refetchMessages();
      setMessages(
        (result.data ?? []).map((m) => ({ role: m.sender_type, text: m.message_text })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function send() {
    if (!sessionId || !input.trim()) return;
    setError(null);
    setStreaming(true);
    setLatency(null);
    const userText = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "USER", text: userText }, { role: "AI", text: "" }]);

    let assistant = "";
    try {
      await sendMessageStream(sessionId, userText, 10, (ev) => {
        if (ev.type === "token" && ev.text) {
          assistant += ev.text;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "AI", text: assistant };
            return copy;
          });
        }
        if (ev.type === "done" && ev.latency_ms !== undefined) setLatency(ev.latency_ms);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={MessageSquare} title="Chat" description="AI assistant chat with SSE streaming" />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px]">
          <Label>Account</Label>
          <Select value={selectedAccountId ?? ""} onChange={(e) => { setAccountId(Number(e.target.value)); setSessionId(null); setMessages([]); }} className="mt-1">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Button onClick={startSession} disabled={!selectedAccountId || createSession.isPending}>
          New Session
        </Button>
        <Button variant="outline" onClick={loadHistory} disabled={!sessionId}>
          Load History
        </Button>
        {sessionId && <span className="text-sm text-muted-foreground">Session #{sessionId}</span>}
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="max-w-3xl space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl border px-4 py-3 ${
              m.role === "AI" ? "border-l-4 border-l-[#004080] bg-white" : "border-l-4 border-l-emerald-500 bg-white"
            }`}
          >
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">{m.role}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{m.text || (streaming && i === messages.length - 1 ? "..." : "")}</p>
          </div>
        ))}
      </div>

      {latency !== null && <p className="text-sm text-muted-foreground">Latency: {latency} ms</p>}

      <div className="flex max-w-3xl gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!sessionId || streaming}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          className="flex-1"
        />
        <Button onClick={send} disabled={!sessionId || streaming}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
