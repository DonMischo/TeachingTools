"use client";
/** Holzregal mit Trankfläschchen (statische Verläufe, damit viele Tränke keine WebGL-Kontexte brauchen). */
export type Trank = { n: number; farbe: string; selten: boolean; trueb: boolean };

export function Flaeschchen({ t }: { t: Trank }) {
  const f = t.trueb ? "#8a8a6a" : t.farbe;
  return (
    <span className={`relative inline-block ${t.selten ? "alch-regen" : ""}`} style={{ filter: t.selten ? "drop-shadow(0 0 6px #ffffff)" : "drop-shadow(0 3px 2px rgba(0,0,0,.35))" }}>
      <svg viewBox="0 0 30 44" width={30} height={44} aria-hidden>
        <rect x="11" y="1" width="8" height="7" rx="2" fill="#a0713a" />
        <path d="M11 8 H19 V14 Q27 18 27 28 Q27 41 15 41 Q3 41 3 28 Q3 18 11 14 Z" fill="#dfeef7" fillOpacity="0.35" stroke="#dfeef7" strokeOpacity="0.8" strokeWidth="1.2" />
        <path d="M5 27 Q5 39 15 39 Q25 39 25 27 Z" fill={f} />
        <path d="M5 27 Q15 23 25 27" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
        <path d="M8 22 Q6 30 9 35" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {t.selten && <span className="alch-funkel absolute -top-1 -right-1 text-sm" aria-hidden>✨</span>}
    </span>
  );
}

export default function Regal({ traenke }: { traenke: Trank[] }) {
  return (
    <div className="rounded-lg p-3" aria-label="Trankregal" style={{ background: "linear-gradient(#5a3a1f,#3f2813)", boxShadow: "inset 0 2px 6px rgba(0,0,0,.5)", color: "#f3e3c8" }}>
      <div className="text-sm opacity-80">🧪 Trankregal ({traenke.length})</div>
      <div className="flex flex-wrap items-end gap-2 min-h-12 pb-1" style={{ borderBottom: "6px solid #7a5230" }}>
        {traenke.map((t) => <Flaeschchen key={t.n} t={t} />)}
      </div>
    </div>
  );
}
