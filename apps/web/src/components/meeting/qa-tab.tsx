"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircleQuestion, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { formatTimestamp } from "@/lib/format";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Question } from "@/lib/types";

const SUGGESTED_QUESTIONS = [
  "Toplantıda hangi kararlar alındı?",
  "Kim hangi görevden sorumlu?",
  "Öne çıkan riskler nelerdi?",
  "Bir sonraki adımlar neler?",
];

function sessionKey(meetingId: string) {
  return `granola-qa-session-${meetingId}`;
}

export function QaTab({ meetingId, hasTranscript }: { meetingId: string; hasTranscript: boolean }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(sessionKey(meetingId));
    const id = stored || crypto.randomUUID();
    if (!stored) localStorage.setItem(sessionKey(meetingId), id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs session id from localStorage on mount/meeting change
    setSessionId(id);
  }, [meetingId]);

  useEffect(() => {
    if (!sessionId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks loading before the question history fetch starts
    setLoading(true);
    api
      .listQuestions(meetingId, sessionId)
      .then(setQuestions)
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false));
  }, [meetingId, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions]);

  async function ask(question: string) {
    if (!sessionId || !question.trim() || asking) return;
    setAsking(true);
    setInput("");
    try {
      const answer = await api.askQuestion(meetingId, {
        question: question.trim(),
        chat_session_id: sessionId,
      });
      setQuestions((prev) => [...prev, answer]);
    } catch (err) {
      toast.error("Soru yanıtlanamadı", { description: err instanceof ApiError ? err.message : undefined });
    } finally {
      setAsking(false);
    }
  }

  function newChat() {
    const id = crypto.randomUUID();
    localStorage.setItem(sessionKey(meetingId), id);
    setSessionId(id);
    setQuestions([]);
  }

  if (!hasTranscript) {
    return (
      <EmptyState
        icon={<MessageCircleQuestion className="h-8 w-8" />}
        title="Soru sormak için önce döküm gerekli"
        description="Bu toplantı için henüz bir konuşma metni oluşturulmadı."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sorularınız yalnızca bu toplantının dökümüne dayanarak yanıtlanır.
        </p>
        <Button variant="outline" size="sm" onClick={newChat}>
          <RotateCcw className="h-3.5 w-3.5" />
          Yeni Sohbet
        </Button>
      </div>

      <div className="flex min-h-72 flex-col gap-3 rounded-xl border p-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Toplantı hakkında bir soru sorun veya önerilen sorulardan birini deneyin.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {questions.map((q) => (
              <div key={q.id} className="flex flex-col gap-2">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                  {q.question}
                </div>
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2 text-sm leading-relaxed">
                  <p>{q.answer}</p>
                  {q.source_timestamps.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.source_timestamps.map((ts, idx) => (
                        <span
                          key={idx}
                          className="rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                        >
                          {formatTimestamp(ts)}
                        </span>
                      ))}
                    </div>
                  )}
                  {q.source === "fallback" && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Yerel arama sonucu (AI kullanılmadı)</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className={cn("flex gap-2")}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Toplantı hakkında bir soru sorun..."
          disabled={asking}
        />
        <Button type="submit" disabled={asking || !input.trim()}>
          {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
