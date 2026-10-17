"use client";
/**
 * Beitritts-Code + QR für ein zustandsloses Werkzeug (Abakus, Zeitstrahl, …).
 *
 * Die Session ist nur der Einstieg: ein Code zum Scannen und der Schalter, ob
 * Gäste ohne Konto hereindürfen. Der Code bleibt pro Lehrkraft, Werkzeug und
 * geteiltem Inhalt derselbe, ein ausgedruckter QR gilt also weiter.
 */
import { useState } from "react";
import { api, type ToolSessionOut } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { JoinQR } from "@/components/JoinQR";
import { GuestAccessToggle } from "@/components/GuestAccessToggle";
import { useLanUrl } from "@/hooks/useLanUrl";
import { ToolSessionList } from "@/components/ToolSessionList";
import { SelbstSpielenKnopf } from "@/components/LehrkraftSpielt";

export function ToolSessionBar({ tool, title, refId }: {
  tool: string;
  title: string;
  /** Werkzeuge mit Inhalt (Zeitstrahl) teilen eine bestimmte Sache, nicht sich selbst. */
  refId?: number;
}) {
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
      setSession(await api.toolSessions.create(tool, refId));
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
        className="text-sm border border-line rounded-lg px-3 py-1.5 hover:border-accent"
      >
        📱 Zum Mitmachen
      </button>

      {open && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={`Beitritt zu ${title}`}
            className="bg-surface border border-line rounded-2xl w-full max-w-md
              max-h-[85vh] overflow-y-auto shadow-2xl text-left"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-line">
              <span className="font-black text-base flex-1">{title} — zum Mitmachen</span>
              <button onClick={() => setOpen(false)} aria-label="Schließen"
                className="text-muted hover:text-fg text-xl leading-none px-1">×</button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {error && <p className="text-sm text-bad">{error}</p>}

              {!session && !error && <p className="text-sm text-muted">Code wird geholt …</p>}

              {session && (
                <>
                  <div className="flex items-center gap-4">
                    <JoinQR url={joinUrl} size={120} />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-widest text-muted">Code</span>
                      <span className="text-3xl font-black tracking-[0.2em] text-accent">
                        {session.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-page border border-line rounded-lg px-2 py-1.5 truncate">
                      {joinUrl || "…"}
                    </code>
                    <button onClick={copy}
                      className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent">
                      {copied ? "kopiert ✓" : "kopieren"}
                    </button>
                    {/* Aktivitäten mit Inhalt (Challenge, Kartenquiz, Zeitstrahl): die
                        Lehrkraft spielt dieselbe Runde; Simulationen benutzt sie ohnehin selbst. */}
                    {refId != null && (
                      <SelbstSpielenKnopf href={`/play/simulation/${session.code}`}
                        className="text-xs border border-line rounded-lg px-2.5 py-1.5 hover:border-accent" />
                    )}
                  </div>

                  <div className="border-t border-line pt-3 flex flex-col gap-2">
                    <GuestAccessToggle tool="simulation" code={session.code} />
                    <p className="text-xs text-muted leading-relaxed">
                      Ohne diesen Schalter brauchen die Schüler ein eigenes Konto. Mit ihm kommt
                      jeder, der den Code scannt, ohne Anmeldung hinein — für die am Schalter
                      genannte Zeit. Der Code bleibt derselbe, ein ausgedruckter QR gilt also weiter.
                    </p>
                  </div>

                  {/* Alle Sitzungen dieses Werkzeugs — ansehen und schliessen,
                      ohne sie einzeln suchen zu muessen. */}
                  <ToolSessionList slug={tool} />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
