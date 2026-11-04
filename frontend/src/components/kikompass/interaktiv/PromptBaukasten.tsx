"use client";
/**
 * Prompt-Baukasten: Bausteine an- und abwählen, der Prompt baut sich zusammen,
 * und eine vorbereitete Beispielantwort zeigt, was jeder Baustein bewirkt.
 */
import { useState } from "react";
import { BAUSTEINE, PROMPT_AUFGABE, promptAntwort, promptGuete, promptText } from "@/lib/kikompass/interaktiv";

const ART_FARBE = { rolle: "#9b2a8a", kontext: "#1f6fb5", format: "#2e9e44", stoer: "#888888" } as const;

export function PromptBaukasten({ onFertig }: { onFertig?: () => void }) {
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [hinweis, setHinweis] = useState<string | null>(null);
  const guete = promptGuete(gewaehlt);

  function umschalten(id: string) {
    const b = BAUSTEINE.find(x => x.id === id)!;
    setHinweis(b.hinweis);
    setGewaehlt(alt => {
      const n = new Set(alt);
      if (n.has(id)) n.delete(id); else n.add(id);
      if (promptGuete(n) === 3) onFertig?.();
      return n;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">Prompt-Baukasten</p>
      <p className="text-sm text-muted">
        Die Aufgabe steht schon da: »{PROMPT_AUFGABE}« Füge Bausteine hinzu und beobachte, wie sich die Antwort verändert.
        Nicht jeder Baustein hilft.
      </p>
      <div className="flex flex-wrap gap-2">
        {BAUSTEINE.map(b => (
          <button key={b.id} onClick={() => umschalten(b.id)} aria-pressed={gewaehlt.has(b.id)}
            className={gewaehlt.has(b.id) ? "chip chip-on" : "chip"}
            style={{ borderColor: ART_FARBE[b.art] }}>
            {gewaehlt.has(b.id) ? "✓ " : "+ "}{b.text}
          </button>
        ))}
      </div>
      {hinweis && <p className="text-xs text-muted">💡 {hinweis}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-xs text-muted">Dein Prompt</p>
          <p className="text-sm">{promptText(gewaehlt)}</p>
          <div className="mt-2" aria-label={`Prompt-Güte ${guete} von 3`}>
            <div className="h-2 rounded bg-surface-hover overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${(guete / 3) * 100}%`, background: guete === 3 ? "#2e9e44" : "#d4a017" }} />
            </div>
            <p className="text-xs text-muted mt-1">
              {guete === 0 && "Sehr ungenau: Die KI weiß nicht, für wen und wie."}
              {guete === 1 && "Schon besser. Was fehlt noch: Rolle, Hintergrund oder Form?"}
              {guete === 2 && "Fast! Ein Baustein fehlt noch."}
              {guete === 3 && "Rolle, Aufgabe, Hintergrund und Form: ein starker Prompt!"}
            </p>
          </div>
        </div>
        <div className="card p-3 flex flex-col gap-1">
          <p className="text-xs text-muted">Beispielantwort (vorbereitet, keine echte KI)</p>
          <p className="text-sm whitespace-pre-wrap">{promptAntwort(gewaehlt)}</p>
        </div>
      </div>
    </div>
  );
}
