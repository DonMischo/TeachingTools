"use client";
/**
 * Beitritts-Code + QR für ein zustandsloses Werkzeug (Abakus, Gleichungswaage).
 *
 * Die Session hat keinen Inhalt — sie ist nur der Einstieg: ein Code zum
 * Scannen und der Schalter, ob Gäste ohne Konto hereindürfen. Der Code bleibt
 * pro Lehrkraft und Werkzeug derselbe, ein ausgedruckter QR gilt also weiter.
 */
import { useState } from "react";
import { api, type ToolSessionOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";

export function ToolSessionBar({ tool, title }: { tool: string; title: string }) {
  const { auth } = useAuth();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ToolSessionOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Hook muss vor dem frühen Return laufen.
  const joinUrl = useLanUrl(session ? `/play/simulation/${session.code}` : "");

  const isTeacher = auth?.role === "teacher" || auth?.role === "admin";
  if (!isTeacher) return null;

  async function show() {
    setOpen(true);
    if (session) return;
    try {
      setSession(await api.toolSessions.create(tool));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Code ließ sich nicht anlegen.");
    }
  }

  async function copy() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* Zwischenablage gesperrt — der Link steht ja da */ }
  }

  return (
    <>
      <button
        onClick={show}
        title="Beitritts-Code und QR für die Schüler"
        className="text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 hover:border-[var(--accent)]"
      >
        📱 Zum Mitmachen
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Beitritt zu ${title}`}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md
              max-h-[85vh] overflow-y-auto shadow-2xl text-left"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border)]">
              <span className="font-black text-base flex-1">{title} — zum Mitmachen</span>
              <button onClick={() => setOpen(false)} aria-label="Schließen"
                className="text-[var(--text-muted)] hover:text-[var(--text)] text-xl leading-none px-1">×</button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {error && <p className="text-sm text-[var(--red)]">{error}</p>}

              {!session && !error && <p className="text-sm text-[var(--text-muted)]">Code wird geholt …</p>}

              {session && (
                <>
                  <div className="flex items-center gap-4">
                    <JoinQR url={joinUrl} size={120} />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-[var(--text-muted)]">Code</span>
                      <span className="text-3xl font-black tracking-[0.2em] text-[var(--accent)]">
                        {session.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 truncate">
                      {joinUrl || "…"}
                    </code>
                    <button onClick={copy}
                      className="text-xs border border-[var(--border)] rounded-lg px-2.5 py-1.5 hover:border-[var(--accent)]">
                      {copied ? "kopiert ✓" : "kopieren"}
                    </button>
                  </div>

                  <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-2">
                    <GuestAccessToggle tool="simulation" code={session.code} />
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Ohne diesen Schalter brauchen die Schüler ein eigenes Konto. Mit ihm kommt
                      jeder, der den Code scannt, für 60 Minuten hinein — ohne Anmeldung.
                      Der Code bleibt derselbe, ein ausgedruckter QR gilt also weiter.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
