"use client";
/**
 * Station 3: das Netz — und zugleich die Schreibmaschine.
 *
 * Das Netz ist hier kein Schaubild zum Anschauen, sondern die Bedienung: in
 * der Mitte steht das zuletzt geschriebene Wort, ringsherum hängen die Wörter,
 * die darauf folgen können — je dicker der Faden, desto häufiger. Antippen
 * schreibt weiter, und das Netz ordnet sich neu.
 *
 * Zwei Dinge sollen dabei hängenbleiben:
 *   • Blass und gestrichelt hängen Wörter mit im Netz, die hier *nicht* stehen
 *     dürfen. Sie werden nicht weggelassen, sondern begründet — so sieht man
 *     die Grammatikregel, statt sie zu ahnen.
 *   • Der Regler »Auswahl« ist der ehrliche Kern: er entscheidet, wie viele
 *     Möglichkeiten überhaupt angeboten werden. Ganz links gibt es nur den
 *     wahrscheinlichsten Vorschlag — dann schreiben alle denselben Text.
 */
import { useMemo, useState } from "react";
import {
  fortsetzungen, lockvoegel, maschinenwahl, anzahlAuswahl,
  type Kandidat, type Netz, type Wort,
} from "@/lib/ki/wortnetz";

// Die Zeichenflaeche ist bewusst knapp gehalten: je kleiner sie ist, desto
// groesser erscheinen Woerter und Prozente auf dem Telefon — die Grafik
// skaliert mit der Breite mit.
const MITTE = { x: 200, y: 148 };
const RX = 134;
const RY = 102;

const BEWEGUNG = `
@keyframes ki-drift {
  0%, 100% { transform: translate(0px, 0px); }
  50%      { transform: translate(0px, -7px); }
}
@keyframes ki-auf {
  from { opacity: 0; transform: scale(0.82); }
  to   { opacity: 1; transform: scale(1); }
}
.ki-knoten { animation: ki-auf 260ms ease-out both; transform-box: fill-box; transform-origin: center; }
.ki-schweben { animation: ki-drift 7s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ki-knoten, .ki-schweben { animation: none; }
}
`;

function breite(text: string) {
  return Math.max(70, text.length * 9.5 + 22);
}

type Angebot =
  | { art: "kandidat"; wort: Wort; p: number }
  | { art: "lockvogel"; wort: Wort; grund: string };

function Knoten({ angebot, x, y, i, onWaehlen }: {
  angebot: Angebot; x: number; y: number; i: number; onWaehlen: () => void;
}) {
  const b = breite(angebot.wort.text);
  const h = angebot.art === "kandidat" ? 44 : 32;
  const echt = angebot.art === "kandidat";
  return (
    <g
      className="ki-schweben"
      style={{ animationDelay: `${(i % 5) * 0.6}s`, animationDuration: `${6 + (i % 3)}s` }}
    >
      <g
        className="ki-knoten"
        style={{ animationDelay: `${i * 40}ms`, cursor: "pointer" }}
        role="button"
        tabIndex={0}
        onClick={onWaehlen}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWaehlen(); } }}
      >
        <rect
          x={x - b / 2} y={y - h / 2} width={b} height={h} rx={h / 2}
          fill={echt ? "var(--surface)" : "transparent"}
          stroke={echt ? "var(--accent)" : "var(--text-muted)"}
          strokeWidth={echt ? 2 : 1}
          strokeDasharray={echt ? undefined : "4 3"}
          opacity={echt ? 1 : 0.55}
        />
        <text
          x={x} y={echt ? y - 2 : y + 4}
          textAnchor="middle"
          fontSize={echt ? 16 : 14}
          fontWeight={echt ? 800 : 500}
          fill={echt ? "var(--text)" : "var(--text-muted)"}
          opacity={echt ? 1 : 0.75}
        >
          {angebot.wort.text}
        </text>
        {echt && (
          <text x={x} y={y + 13} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
            {Math.round(angebot.p * 100)} %
          </text>
        )}
      </g>
    </g>
  );
}

export function WortnetzBuehne({ netz, verlauf, mut, onMut, onWaehlen, wuerfel }: {
  netz: Netz;
  /** Der ganze bisherige Text: ein Trigramm schaut zwei Wörter zurück. */
  verlauf: readonly Wort[];
  mut: number;
  onMut: (m: number) => void;
  onWaehlen: (k: Kandidat) => void;
  wuerfel: () => number;
}) {
  const [hinweis, setHinweis] = useState<string | null>(null);

  const letztes = verlauf.length ? verlauf[verlauf.length - 1] : null;
  const antwort = useMemo(() => fortsetzungen(netz, verlauf), [netz, verlauf]);
  const kands = useMemo(() => antwort.kandidaten.slice(0, anzahlAuswahl(mut)), [antwort, mut]);
  const locker = useMemo(() => lockvoegel(netz, letztes, kands.length >= 5 ? 1 : 2), [netz, letztes, kands.length]);
  // Musste das Netz kürzer zurückschauen, als es könnte? Dann sagt es das auch.
  const gekuerzt = antwort.rueckblick < netz.n && !!letztes && letztes.art !== "punkt";

  const angebote: Angebot[] = [
    ...kands.map(k => ({ art: "kandidat" as const, wort: k.wort, p: k.p })),
    ...locker.map(l => ({ art: "lockvogel" as const, wort: l.wort, grund: l.grund })),
  ];

  // Der Ring: gleichmäßig verteilt, oben angefangen. Bei nur einem Vorschlag
  // sitzt er rechts — sonst stünde er dem Mittelknoten auf dem Kopf.
  const punkte = angebote.map((_, i) => {
    const winkel = angebote.length === 1 ? 0 : (-Math.PI / 2) + (i * 2 * Math.PI) / angebote.length;
    return { x: MITTE.x + Math.cos(winkel) * RX, y: MITTE.y + Math.sin(winkel) * RY };
  });

  const mitteText = letztes && letztes.art !== "punkt" ? letztes.text : "Satzanfang";
  const mitteBreite = breite(mitteText);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden">
        {/* Bei voller Seitenbreite würde das Netz höher als der Bildschirm:
            die Breite ist deshalb an 60 % der Fensterhöhe gebunden. */}
        <svg viewBox="0 0 400 300" className="w-full h-auto block mx-auto" role="img"
          style={{ maxWidth: "calc(60vh * 400 / 300)" }}
          aria-label={`Wortnetz: Fortsetzungen von ${mitteText}`}>
          <style>{BEWEGUNG}</style>

          {/* Erst die Fäden, damit die Knoten darüber liegen. */}
          {angebote.map((a, i) => {
            const p = punkte[i];
            const echt = a.art === "kandidat";
            return (
              <path
                key={`f${a.wort.id}-${i}`}
                d={`M ${MITTE.x} ${MITTE.y} Q ${(MITTE.x + p.x) / 2 + (p.y - MITTE.y) * 0.12} ${(MITTE.y + p.y) / 2 - (p.x - MITTE.x) * 0.12} ${p.x} ${p.y}`}
                fill="none"
                stroke={echt ? "var(--accent)" : "var(--text-muted)"}
                strokeWidth={echt ? 1 + a.p * 7 : 1}
                strokeDasharray={echt ? undefined : "3 4"}
                opacity={echt ? 0.25 + a.p * 0.5 : 0.25}
              />
            );
          })}

          {/* Der Mittelknoten: das einzige Wort, das dieses Netz kennt. */}
          <rect
            x={MITTE.x - mitteBreite / 2} y={MITTE.y - 23} width={mitteBreite} height={46} rx={23}
            fill="var(--accent)" opacity={0.9}
          />
          <text x={MITTE.x} y={MITTE.y + 6} textAnchor="middle" fontSize={18} fontWeight={900}
            fill="var(--accent-text)">
            {mitteText}
          </text>

          {angebote.map((a, i) => (
            <Knoten
              key={`k${a.wort.id}-${i}`}
              angebot={a} x={punkte[i].x} y={punkte[i].y} i={i}
              onWaehlen={() => {
                if (a.art === "lockvogel") { setHinweis(a.grund); return; }
                setHinweis(null);
                onWaehlen({ wort: a.wort, p: a.p });
              }}
            />
          ))}
        </svg>
      </div>

      {hinweis && (
        <p className="text-sm rounded-xl px-3 py-2 border border-(--red) text-(--text)">
          🚫 {hinweis}
        </p>
      )}

      {gekuerzt && (
        <p className="text-xs text-(--text-muted) leading-relaxed">
          🔎 Diese Wortfolge stand so nie im Text — das Netz schaut deshalb gerade nur
          {" "}{antwort.rueckblick === 1 ? "auf die Worthäufigkeit" : "ein Wort"} zurück
          statt {netz.n - 1}. Fachleute nennen das Rückfall (»Backoff«).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-3 text-sm">
          <span className="font-bold whitespace-nowrap">🎚️ Auswahl</span>
          <input
            type="range" min={0} max={5} step={1} value={mut}
            onChange={e => onMut(Number(e.target.value))}
            aria-label="Wie viele Vorschläge"
            className="w-40 accent-(--accent)"
          />
          <span className="text-(--text-muted) whitespace-nowrap">
            {anzahlAuswahl(mut)} {anzahlAuswahl(mut) === 1 ? "Vorschlag" : "Vorschläge"}
          </span>
        </label>
        <button
          type="button"
          onClick={() => { setHinweis(null); onWaehlen(maschinenwahl(kands, wuerfel)); }}
          className="px-3 py-2 rounded-xl border border-(--border) bg-(--surface) text-sm font-bold"
        >
          🎲 Maschine wählt
        </button>
      </div>

      <p className="text-xs text-(--text-muted) leading-relaxed">
        Das Netz schaut nur auf <b>ein einziges Wort</b> zurück — auf »{mitteText}«. Alles davor hat
        es schon vergessen. Ein echtes Sprachmodell hat Tausende Wörter im Blick und kann deshalb
        den Faden halten; hier reicht es für einen Satz, der stimmt, aber nicht für eine Geschichte,
        die zusammenpasst.
      </p>
    </div>
  );
}
