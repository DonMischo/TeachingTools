"use client";
/** Die Frage zu einem Verkehrszeichen — öffnet sich, wenn man am Schild E drückt. */
import { useState } from "react";
import { SCHILDER, type SchildArt } from "@/lib/verkehr/schilder";

export function SchildBild({ art, groesse = 96 }: { art: SchildArt; groesse?: number }) {
  const blau = "#1f5fbf";
  return (
    <svg viewBox="-50 -50 100 100" width={groesse} height={groesse} aria-hidden>
      {art === "stopp" && (
        <>
          <polygon points="-19,-46 19,-46 46,-19 46,19 19,46 -19,46 -46,19 -46,-19" fill="#c8102e" stroke="#fff" strokeWidth="4" />
          <text x="0" y="10" textAnchor="middle" fontSize="28" fontWeight="bold" fill="#fff">STOP</text>
        </>
      )}
      {art === "vorfahrtAchten" && <polygon points="-46,-40 46,-40 0,44" fill="#fff" stroke="#c8102e" strokeWidth="9" strokeLinejoin="round" />}
      {art === "vorfahrtstrasse" && (
        <>
          <polygon points="0,-48 48,0 0,48 -48,0" fill="#fff" stroke="#555" strokeWidth="1.5" />
          <polygon points="0,-33 33,0 0,33 -33,0" fill="#f4c430" />
        </>
      )}
      {art === "zebra" && (
        <>
          <rect x="-46" y="-46" width="92" height="92" rx="6" fill={blau} stroke="#fff" strokeWidth="3" />
          <polygon points="-36,32 36,32 0,-36" fill="#fff" />
          <text x="0" y="24" textAnchor="middle" fontSize="36">🚶</text>
        </>
      )}
      {art === "haltestelle" && (
        <>
          <circle r="46" fill="#f4c430" stroke="#1f7a3a" strokeWidth="6" />
          <text x="0" y="18" textAnchor="middle" fontSize="52" fontWeight="bold" fill="#1f7a3a">H</text>
        </>
      )}
      {art === "radweg" && (
        <>
          <circle r="46" fill={blau} stroke="#fff" strokeWidth="3" />
          <text x="0" y="16" textAnchor="middle" fontSize="46">🚲</text>
        </>
      )}
      {art === "gehRad" && (
        <>
          <circle r="46" fill={blau} stroke="#fff" strokeWidth="3" />
          <line x1="-38" y1="0" x2="38" y2="0" stroke="#fff" strokeWidth="3" />
          <text x="0" y="-8" textAnchor="middle" fontSize="30">🚶</text>
          <text x="0" y="34" textAnchor="middle" fontSize="30">🚲</text>
        </>
      )}
      {art === "gehRadGetrennt" && (
        <>
          <circle r="46" fill={blau} stroke="#fff" strokeWidth="3" />
          <line x1="0" y1="-38" x2="0" y2="38" stroke="#fff" strokeWidth="3" />
          <text x="-20" y="11" textAnchor="middle" fontSize="28">🚶</text>
          <text x="21" y="11" textAnchor="middle" fontSize="28">🚲</text>
        </>
      )}
      {art === "radfrei" && (
        <>
          <circle cy="-12" r="36" fill={blau} stroke="#fff" strokeWidth="3" />
          <text x="0" y="0" textAnchor="middle" fontSize="36">🚶</text>
          <rect x="-34" y="27" width="68" height="21" fill="#fff" stroke="#222" strokeWidth="2" />
          <text x="0" y="43" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#000">🚲 frei</text>
        </>
      )}
      {art === "spielstrasse" && (
        <>
          <rect x="-48" y="-34" width="96" height="68" rx="6" fill={blau} stroke="#fff" strokeWidth="3" />
          <text x="0" y="12" textAnchor="middle" fontSize="32">🏠⚽🚶</text>
        </>
      )}
    </svg>
  );
}

export function SchildQuiz({ art, onAntwort, onZu }: {
  art: SchildArt;
  onAntwort: (richtig: boolean) => void;
  onZu: () => void;
}) {
  const f = SCHILDER[art];
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Zeichen ${f.nummer}`}>
      <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-2xl">
        <div className="flex items-center gap-4">
          <SchildBild art={art} />
          <div>
            <div className="text-xs text-(--text-muted)">Zeichen {f.nummer}</div>
            <div className="font-black">{gewaehlt === null ? "Welches Schild ist das?" : f.name}</div>
          </div>
        </div>
        <p className="mt-4 font-semibold">{f.frage}</p>
        <div className="mt-3 flex flex-col gap-2">
          {f.antworten.map((a, i) => {
            const zeigen = gewaehlt !== null;
            const farbe = !zeigen ? "border-(--border) hover:border-(--accent)"
              : i === f.richtig ? "border-green-600 bg-green-600/15" : i === gewaehlt ? "border-red-600 bg-red-600/15" : "border-(--border) opacity-60";
            return (
              <button key={a} type="button" disabled={zeigen}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${farbe}`}
                onClick={() => { setGewaehlt(i); onAntwort(i === f.richtig); }}>
                {a}
              </button>
            );
          })}
        </div>
        {gewaehlt !== null && <p className="mt-3 text-sm leading-relaxed">{f.erklaerung}</p>}
        <div className="mt-4 flex justify-end">
          <button type="button" autoFocus={gewaehlt !== null} className="rounded-lg bg-(--accent) px-4 py-1.5 text-sm font-bold text-white" onClick={onZu}>
            {gewaehlt === null ? "Später" : "Weiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
