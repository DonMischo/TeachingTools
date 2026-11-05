"use client";
/** Gemeinsame Bausteine der Spielarten. Alles per Klick/Tastatur (Buttons), Ziehen ist nur Zugabe. */
import type { ReactNode } from "react";
import type { ChallengeAntwort, ChallengeFakt } from "@/lib/api";
import { Tex } from "@/components/Tex";
import { Sprite } from "@/components/challenge/pixel/Sprite";

type Inh = { text: string; image: string | null; formula: string | null };

export function Inhalt({ x }: { x: Inh }) {
  return (
    <>
      <span>{x.text}</span>
      {x.image && <img src={x.image} alt="" className="max-h-24 mx-auto mt-1 rounded-lg object-contain" />}
      {x.formula && <Tex tex={x.formula} className="block mt-1" />}
    </>
  );
}

/** Wie viele Fakten die Antwort braucht, als Kartensymbole (ab 5 als Zahl). */
export function Noetig({ n }: { n: number }) {
  const text = n === 1 ? "1 Fakt nötig" : `${n} Fakten nötig`;
  return (
    <span data-noetig title={text} aria-label={text}
      className="shrink-0 ml-auto whitespace-nowrap rounded-full border border-line bg-surface px-2 py-0.5 text-sm font-semibold">
      {n <= 4 ? "🃏".repeat(n) : `🃏×${n}`}
    </span>
  );
}

/** Die Frage bzw. Aufgabe einer Challenge: hebt sich in allen Spielarten deutlich von den Fakten ab. */
export function Frage({ x, icon = "❓" }: { x: Inh & { noetig?: number }; icon?: string }) {
  return (
    <div data-frage className="flex gap-2 items-start rounded-lg border-l-4 border-accent bg-accent/15 px-3 py-2 text-base font-bold text-left">
      <span aria-hidden>{icon}</span>
      <div className="min-w-0"><Inhalt x={x} /></div>
      {x.noetig != null && <Noetig n={x.noetig} />}
    </div>
  );
}

export function FaktKarte({ fakt, onClick, disabled }: { fakt: ChallengeFakt; onClick?: () => void; disabled?: boolean }) {
  return (
    <button draggable={!disabled} disabled={disabled}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", fakt.id)}
      onClick={onClick} className="card p-2 text-left disabled:opacity-85">
      <Inhalt x={fakt} />
    </button>
  );
}

export function Ablage({ karten, onLege, onNimm, leer = "Lege Fakten hierher." }: {
  karten: ChallengeFakt[]; onLege(id: string): void; onNimm(id: string): void; leer?: ReactNode;
}) {
  return (
    <div onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onLege(e.dataTransfer.getData("text/plain")); }}
      className="min-h-16 rounded-lg border-2 border-dashed border-line p-2 flex flex-wrap gap-2" aria-label="Ablage">
      {karten.length === 0 && <span className="text-muted">{leer}</span>}
      {karten.map((f) => (
        <button key={f.id} onClick={() => onNimm(f.id)} title="Zurücknehmen" className="card px-2 py-1"><Inhalt x={f} /></button>
      ))}
    </div>
  );
}

const HERZ = { x: 64, y: 0, w: 16, h: 16 }; // objects.png: volles Herz

export function Herzen({ leben, max = 3 }: { leben: number; max?: number }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${leben} von ${max} Leben`}>
      {Array.from({ length: max }, (_, i) => (
        <Sprite key={i} src="/challenge/pixel/gfx/objects.png" frame={HERZ} scale={2} className={i < leben ? "" : "grayscale opacity-40"} />
      ))}
    </span>
  );
}

/** `heil`: so viel hat der Gegner mit seinem Heiltrank zurückgeholt (siehe lib/challenge/heiltrank). */
export function Treffermeldung({ antwort, heil = 0 }: { antwort: ChallengeAntwort | null; heil?: number }) {
  if (!antwort) return null;
  const text = (antwort.komplett
    ? `Treffer!${antwort.kombo ? " Kombo!" : ""} Schaden: ${antwort.schaden}${antwort.feedback ? ` – ${antwort.feedback}` : ""}`
    : antwort.treffer ? "Teiltreffer – da fehlt noch etwas oder es lag Falsches dabei" : "Daneben")
    + (heil > 0 ? ` · 🧪 Der Gegner trinkt einen Heiltrank: +${heil}` : "");
  return <p className={`card p-3 font-bold ${antwort.komplett ? "text-good" : "text-bad"}`} role="status">{text}</p>;
}
