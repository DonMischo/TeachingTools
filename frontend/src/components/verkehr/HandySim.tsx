"use client";
/**
 * »Handy Sim«: das Smartphone der Figur mit einer Karten-App. Suchen
 * (Adresse, Straße, Laden, Haltestelle), Ziel wählen → kürzester Fußweg,
 * auf der Karte im Handy und in der Stadt markiert. Zweimal je Sitzung darf
 * man sich hinbeamen. Aussehen je nach Handy: Android oder Apple.
 */
import { useMemo, useState } from "react";
import { stadt } from "@/lib/verkehr/stadt";
import { BEAMEN_JE_SITZUNG, fussweg, gehMinuten, suche, suchIndex, Wegenetz, type Ziel } from "@/lib/verkehr/handy";
import type { P } from "@/lib/verkehr/geometrie";
import type { HandyArt } from "@/lib/verkehr/aussehen";

type Route = { ziel: Ziel; punkte: P[]; laenge: number };

// Einmal gebaut, für alle Handys
let _daten: { index: Ziel[]; netz: Wegenetz; strassen: string; wege: string; haeuser: string } | null = null;
function daten() {
  if (_daten) return _daten;
  const s = stadt();
  const pfad = (l: P[]) => `M${l.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L")}`;
  _daten = {
    index: suchIndex(s),
    netz: new Wegenetz(s),
    strassen: s.strassen.map((x) => pfad(x.linie)).join(""),
    wege: s.karte.wege.map((x) => pfad(x.linie)).join(""),
    haeuser: s.karte.gebaeude.filter((g) => g.umriss.length >= 3).map((g) => `${pfad(g.umriss)}Z`).join(""),
  };
  return _daten;
}

export function HandySim({ art, lage, uhr, route, onRoute, beamenUebrig, onBeamen, onZu }: {
  art: HandyArt;
  /** Wo die Figur steht (Meter) und wohin sie schaut. */
  lage: { x: number; y: number; w: number };
  uhr: string;
  route: Route | null;
  onRoute: (r: Route | null) => void;
  beamenUebrig: number;
  /** Hinbeamen; gibt einen Grund zurück, wenn es gerade nicht geht. */
  onBeamen: (p: P) => string | null;
  onZu: () => void;
}) {
  const d = daten();
  const [text, setText] = useState("");
  const [massstab, setMassstab] = useState(320); // Meter über die Breite
  const [meldung, setMeldung] = useState<string | null>(null);
  const treffer = useMemo(() => (text.trim().length >= 2 ? suche(d.index, text) : []), [d, text]);
  const apple = art === "apple";

  const waehle = (z: Ziel) => {
    const r = fussweg(stadt(), d.netz, [lage.x, lage.y], z.p);
    onRoute(r ? { ziel: z, ...r } : null);
    setMeldung(r ? null : "Kein Weg gefunden.");
    setText("");
    if (r) {
      // Karte so, dass Start und Ziel hineinpassen
      const breite = Math.max(...r.punkte.map((p) => p[0])) - Math.min(...r.punkte.map((p) => p[0]));
      const hoehe = Math.max(...r.punkte.map((p) => p[1])) - Math.min(...r.punkte.map((p) => p[1]));
      setMassstab(Math.min(1500, Math.max(200, Math.max(breite, hoehe * 0.55) * 1.3)));
    }
  };
  const beamen = () => {
    if (!route) return;
    const grund = onBeamen(route.ziel.p);
    setMeldung(grund ?? `Gebeamt nach ${route.ziel.name}!`);
    if (!grund) onRoute(null);
  };

  // Kartenausschnitt: um die Route (sonst um die Figur), Hochformat
  const mitte: P = route
    ? [(Math.min(...route.punkte.map((p) => p[0])) + Math.max(...route.punkte.map((p) => p[0]))) / 2,
      (Math.min(...route.punkte.map((p) => p[1])) + Math.max(...route.punkte.map((p) => p[1]))) / 2]
    : [lage.x, lage.y];
  const w = massstab, h = massstab * 1.25;
  const viewBox = `${mitte[0] - w / 2} ${mitte[1] - h / 2} ${w} ${h}`;
  const px = w / 230; // Meter je Bildpunkt (Karte ist gut 230 px breit)

  return (
    <div className="absolute bottom-3 right-3 z-30 select-none" role="dialog" aria-label="Handy">
      {/* Gehäuse */}
      <div className={`relative w-[260px] rounded-[2.2rem] p-2.5 shadow-2xl ring-1 ${apple ? "bg-gradient-to-b from-zinc-200 to-zinc-400 ring-zinc-500" : "bg-zinc-900 ring-black"}`}>
        <div className="relative overflow-hidden rounded-[1.7rem] bg-white text-slate-900">
          {/* Statuszeile mit Kamera: Apple = Insel, Android = Loch */}
          <div className="relative flex h-7 items-center justify-between px-4 text-[11px] font-bold">
            <span>{uhr}</span>
            {apple
              ? <span className="absolute left-1/2 top-1 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
              : <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-black" />}
            <span>📶 🔋</span>
          </div>
          {/* App: Karten */}
          <div className={`px-3 pb-1 text-sm font-black ${apple ? "text-slate-800" : "text-emerald-700"}`}>{apple ? " Karten" : "🗺️ Maps"}</div>
          <div className="relative px-3">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Adresse, Laden, Haltestelle …"
              className={`w-full rounded-full px-3 py-1.5 text-xs outline-none ring-1 ${apple ? "bg-zinc-100 ring-zinc-300" : "bg-emerald-50 ring-emerald-300"}`} />
            {treffer.length > 0 && (
              <ul className="absolute inset-x-3 top-9 z-10 max-h-56 overflow-auto rounded-xl bg-white text-xs shadow-xl ring-1 ring-slate-200">
                {treffer.map((z) => (
                  <li key={`${z.art}|${z.name}`}>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-100" onClick={() => waehle(z)}>
                      <span>{z.icon}</span><span className="truncate">{z.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Karte */}
          <div className="relative mx-3 mt-2 overflow-hidden rounded-xl bg-[#eef1e8] ring-1 ring-slate-200">
            <svg viewBox={viewBox} className="block h-[290px] w-full" aria-label="Karte">
              <path d={d.haeuser} fill="#d8d3cb" />
              <path d={d.strassen} fill="none" stroke="#ffffff" strokeWidth={Math.max(4, 5 * px)} strokeLinecap="round" strokeLinejoin="round" />
              <path d={d.wege} fill="none" stroke="#c7c2b8" strokeWidth={Math.max(1.2, 1.4 * px)} strokeDasharray={`${3 * px} ${2 * px}`} />
              {route && <polyline points={route.punkte.map((p) => p.join(",")).join(" ")} fill="none" stroke={apple ? "#0a84ff" : "#1a73e8"} strokeWidth={4 * px} strokeLinecap="round" strokeLinejoin="round" />}
              {route && <circle cx={route.ziel.p[0]} cy={route.ziel.p[1]} r={6 * px} fill="#ea4335" stroke="#fff" strokeWidth={1.5 * px} />}
              <g transform={`translate(${lage.x} ${lage.y}) rotate(${(lage.w * 180) / Math.PI})`}>
                <circle r={6 * px} fill="#1a73e8" stroke="#fff" strokeWidth={2 * px} />
                <path d={`M${7 * px} 0 L${2 * px} ${-3 * px} L${2 * px} ${3 * px}Z`} fill="#fff" />
              </g>
            </svg>
            <div className="absolute right-1.5 top-1.5 flex flex-col gap-1">
              <button type="button" className="h-6 w-6 rounded-full bg-white text-sm font-bold shadow" onClick={() => setMassstab((m) => Math.max(120, m / 1.5))} aria-label="Näher">+</button>
              <button type="button" className="h-6 w-6 rounded-full bg-white text-sm font-bold shadow" onClick={() => setMassstab((m) => Math.min(1800, m * 1.5))} aria-label="Weiter weg">−</button>
            </div>
          </div>
          {/* Route und Knöpfe */}
          <div className="px-3 py-2 text-xs">
            {route ? (
              <>
                <div className="truncate font-bold">{route.ziel.icon} {route.ziel.name}</div>
                <div className="opacity-70">🚶 {Math.round(route.laenge)} m · etwa {gehMinuten(route.laenge)} min zu Fuß — folge der blauen Linie</div>
                <div className="mt-1.5 flex gap-1.5">
                  <button type="button" onClick={beamen} disabled={beamenUebrig <= 0}
                    className="flex-1 rounded-full bg-violet-600 px-2 py-1 font-bold text-white disabled:opacity-40">✨ Beamen ({beamenUebrig}×)</button>
                  <button type="button" onClick={() => onRoute(null)} className="rounded-full bg-slate-200 px-2 py-1 font-bold">Route weg</button>
                </div>
              </>
            ) : (
              <div className="opacity-70">Suche ein Ziel — die Route erscheint auch in der Stadt. Beamen: {beamenUebrig} von {BEAMEN_JE_SITZUNG} übrig.</div>
            )}
            {meldung && <div className="mt-1 font-bold text-violet-700">{meldung}</div>}
          </div>
          <div className="flex justify-center pb-1.5">
            <button type="button" onClick={onZu} aria-label="Handy weglegen" className={apple ? "h-1 w-24 rounded-full bg-black" : "text-[10px] font-bold opacity-60"}>
              {apple ? "" : "◀  ●  ■"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type HandyRoute = Route;
