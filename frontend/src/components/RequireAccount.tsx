"use client";
/**
 * Schließt eine Werkzeugseite für Fremde.
 *
 * Die Simulationen sind kein öffentliches Angebot: wer kein Konto hat, kommt
 * nur über eine laufende Sitzung herein — also über den QR bzw. den
 * Beitritts-Code der Lehrkraft, der auf /play/simulation/<code> zeigt und dort
 * das Gast-Opt-in der Sitzung prüft. Hier gibt es deshalb keinen Zugang,
 * sondern nur den Weg dorthin.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function RequireAccount({
  icon = "🔬", title = "Simulationen", children,
}: {
  icon?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const { auth, ready } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");

  // Solange /me läuft, ist noch nichts entschieden — sonst blitzt die Sperre auf.
  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-sm text-[var(--text-muted)]">
        Einen Moment …
      </div>
    );
  }

  if (auth) return <>{children}</>;

  const go = () => {
    const c = code.trim().toUpperCase();
    if (c) router.push(`/play/simulation/${encodeURIComponent(c)}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 max-w-md w-full text-center">
        <div className="text-4xl mb-2">{icon}</div>
        <h1 className="text-xl font-black">{title} — nur mit Beitritts-Code</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2 leading-relaxed">
          Ohne Anmeldung geht es nur über eine laufende Sitzung. Deine Lehrkraft zeigt
          dafür einen QR-Code — oder gib den Code hier ein.
        </p>

        <div className="flex gap-2 mt-5">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") go(); }}
            placeholder="CODE"
            aria-label="Beitritts-Code"
            maxLength={8}
            className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2
              text-lg font-black text-center tracking-[0.2em]"
          />
          <button
            onClick={go}
            disabled={!code.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-[var(--accent)] text-[var(--accent-text,#111)] disabled:opacity-40"
          >
            Los
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-4">
          Du hast einen eigenen Zugang? Dann melde dich links unten an.
        </p>
      </div>
    </div>
  );
}
