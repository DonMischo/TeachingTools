"use client";
/**
 * Botenrennen auf der persischen Königsstraße: Läufer allein, Reiter allein
 * (beide brauchen Schlaf) gegen eine Staffel mit Wechselstationen.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ROUTE, STRECKE_KM, dauer, einzelBote, staffel, stand, type Plan, type Tun } from "@/lib/medien/boten";
import { ton } from "./ton";

const B = 660, H = 300;
const xy = (lat: number, lon: number) => ({ x: (lon - 27) * 30, y: (41 - lat) * 30 });
const linie = (pkte: [number, number][]) => pkte.map(([lat, lon], i) => { const p = xy(lat, lon); return `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ");
const EUPHRAT = linie([[38.8, 38.8], [37.0, 38.0], [35.95, 39.0], [35.3, 40.1], [33.6, 42.8], [32.5, 44.4], [31.0, 47.4]]);
const TIGRIS = linie([[37.9, 40.2], [36.34, 43.13], [33.3, 44.4], [31.0, 47.4]]);
const MITTELMEER = (() => {
  const p = [[36.8, 27], [36.4, 29.5], [36.2, 32.5], [36.6, 34.5], [36.6, 36.1], [35.5, 35.8], [33.9, 35.5], [32.5, 34.9], [31, 34.5], [31, 27]] as [number, number][];
  return linie(p) + " Z";
})();

/** Punkte entlang der Route, Anteil 0–1 → SVG-Koordinate */
function aufRoute() {
  const p = ROUTE.map(o => xy(o.lat, o.lon));
  const teil: number[] = [0];
  for (let i = 1; i < p.length; i++) teil.push(teil[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y));
  const ges = teil[teil.length - 1];
  return (anteil: number) => {
    const d = Math.max(0, Math.min(1, anteil)) * ges;
    let i = 1;
    while (i < teil.length - 1 && teil[i] < d) i++;
    const f = (d - teil[i - 1]) / (teil[i] - teil[i - 1] || 1);
    return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * f, y: p[i - 1].y + (p[i].y - p[i - 1].y) * f };
  };
}

type Bote = { id: string; name: string; icon: string; farbe: string; plan: Plan; erklaerung: string };
const TUN_TEXT: Record<Tun, string> = { unterwegs: "unterwegs", pause: "💤 rastet", wechsel: "🤝 Wechsel", angekommen: "🏁 in Susa" };
const tage = (h: number) => (h / 24).toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function BotenDemo() {
  const [stationen, setStationen] = useState(111);
  const [mit, setMit] = useState({ laeufer: true, reiter: true, staffel: true });
  const [t, setT] = useState(0); // Stunden seit Aufbruch
  const [laeuft, setLaeuft] = useState(false);
  const bild = useRef<number | null>(null);
  const punkt = useMemo(aufRoute, []);

  const boten: Bote[] = useMemo(() => [
    { id: "laeufer", name: "Läufer allein", icon: "🏃", farbe: "#f59e0b", plan: einzelBote(6, 10), erklaerung: "6 km/h, 10 Stunden am Tag, dann Schlaf" },
    { id: "reiter", name: "Reiter allein (ein Pferd)", icon: "🐎", farbe: "#a855f7", plan: einzelBote(15, 6), erklaerung: "15 km/h, aber das Pferd schafft nur 6 Stunden am Tag" },
    { id: "staffel", name: `Staffel mit ${stationen} ${stationen === 1 ? "Abschnitt" : "Abschnitten"}`, icon: "🏇", farbe: "#dc2626", plan: staffel(stationen), erklaerung: "Frischer Reiter und frisches Pferd je Abschnitt, Tag und Nacht, 15 Minuten je Wechsel" },
  ].filter(b => mit[b.id as keyof typeof mit]), [stationen, mit]);
  const ende = Math.max(1, ...boten.map(b => dauer(b.plan)));

  useEffect(() => () => { if (bild.current) cancelAnimationFrame(bild.current); }, []);
  const start = () => {
    if (bild.current) cancelAnimationFrame(bild.current);
    // Der Langsamste soll in etwa 20 Sekunden ankommen
    const proSekunde = ende / 20;
    const angekommen = new Set<string>();
    const t0 = performance.now();
    setLaeuft(true);
    const schritt = (jetzt: number) => {
      const h = Math.min(ende, ((jetzt - t0) / 1000) * proSekunde);
      setT(h);
      for (const b of boten) if (!angekommen.has(b.id) && h >= dauer(b.plan)) { angekommen.add(b.id); ton(880, 0.15, 0, "triangle", 0.08); ton(1320, 0.2, 0.15, "triangle", 0.08); }
      if (h < ende) bild.current = requestAnimationFrame(schritt); else setLaeuft(false);
    };
    bild.current = requestAnimationFrame(schritt);
  };
  const uhr = (t + 6) % 24;
  const nacht = uhr < 6 || uhr >= 20;
  const stationsPunkte = useMemo(() => Array.from({ length: stationen + 1 }, (_, i) => punkt(i / stationen)), [stationen, punkt]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden self-center w-full" style={{ maxWidth: 900 }}>
        <svg viewBox={`0 0 ${B} ${H}`} className="w-full block" role="img" aria-label="Karte der Königsstraße von Sardes nach Susa">
          <rect width={B} height={H} fill="#e9dcb8" />
          <path d={MITTELMEER} fill="#93c5fd" />
          <path d={EUPHRAT} fill="none" stroke="#60a5fa" strokeWidth="2" />
          <path d={TIGRIS} fill="none" stroke="#60a5fa" strokeWidth="2" />
          <ellipse cx={xy(38.6, 42.9).x} cy={xy(38.6, 42.9).y} rx="16" ry="9" fill="#93c5fd" />
          <text x={xy(34.5, 30).x} y={xy(34.5, 30).y} fontSize="12" fill="#1e3a8a" fontStyle="italic">Mittelmeer</text>
          <text x={xy(34.6, 41.3).x} y={xy(34.6, 41.3).y} fontSize="10" fill="#1d4ed8" fontStyle="italic">Euphrat</text>
          <text x={xy(34.9, 43.6).x} y={xy(34.9, 43.6).y} fontSize="10" fill="#1d4ed8" fontStyle="italic">Tigris</text>
          <path d={linie(ROUTE.map(o => [o.lat, o.lon]))} fill="none" stroke="#7c2d12" strokeWidth="3" strokeDasharray="7 4" />
          {mit.staffel && stationen > 1 && stationsPunkte.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={stationen > 60 ? 1.8 : 3} fill="#7c2d12" />)}
          {ROUTE.map(o => { const p = xy(o.lat, o.lon); const gross = o.name === "Sardes" || o.name === "Susa"; return (
            <g key={o.name}>
              <circle cx={p.x} cy={p.y} r={gross ? 6 : 3.5} fill={gross ? "#7c2d12" : "#fff"} stroke="#7c2d12" strokeWidth="1.5" />
              <text x={p.x} y={p.y - 9} textAnchor="middle" fontSize={gross ? 13 : 10} fontWeight={gross ? "bold" : "normal"} fill="#431407">{o.name}</text>
            </g>
          ); })}
          {boten.map((b, i) => {
            const s = stand(b.plan, t);
            const p = punkt(s.km / STRECKE_KM);
            return (
              <g key={b.id} transform={`translate(${p.x} ${p.y + (i - 1) * 11})`}>
                <circle r="9" fill={b.farbe} opacity={s.tun === "wechsel" ? 1 : 0.85} stroke={s.tun === "wechsel" ? "#fde047" : "#fff"} strokeWidth={s.tun === "wechsel" ? 3 : 1.5} />
                <text textAnchor="middle" y="4.5" fontSize="12">{s.tun === "pause" ? "💤" : b.icon}</text>
              </g>
            );
          })}
          <rect width={B} height={H} fill="#0b1026" opacity={nacht ? 0.35 : 0} style={{ transition: "opacity .3s" }} pointerEvents="none" />
        </svg>
        <div className="absolute top-2 left-2 rounded-lg px-2 py-1 text-xs font-bold bg-black/60 text-white">
          {nacht ? "🌙" : "☀️"} Tag {Math.floor((t + 6) / 24) + 1}, {String(Math.floor(uhr)).padStart(2, "0")} Uhr
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["laeufer", "reiter", "staffel"] as const).map(id => (
          <label key={id} className={`chip cursor-pointer ${mit[id] ? "chip-on" : ""}`}>
            <input type="checkbox" className="sr-only" checked={mit[id]} disabled={laeuft} onChange={e => { setMit(m => ({ ...m, [id]: e.target.checked })); setT(0); }} />
            {id === "laeufer" ? "🏃 Läufer allein" : id === "reiter" ? "🐎 Reiter allein" : "🏇 Staffel"}
          </label>
        ))}
        <label className="flex items-center gap-2 ml-2">
          <span className="text-xs">Wechselstationen: <b>{stationen - 1}</b></span>
          <input type="range" min={1} max={120} value={stationen} disabled={laeuft || !mit.staffel} onChange={e => { setStationen(Number(e.target.value)); setT(0); }} aria-label="Zahl der Abschnitte der Staffel" />
        </label>
        <button className="btn-primary ml-auto" onClick={start} disabled={laeuft || !boten.length}>📜 Nachricht losschicken</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        {boten.map(b => {
          const s = stand(b.plan, t), d = dauer(b.plan);
          return (
            <div key={b.id} className="card p-2 text-sm flex flex-col gap-0.5" style={{ borderLeft: `4px solid ${b.farbe}` }}>
              <b>{b.icon} {b.name}</b>
              <span className="text-xs text-muted">{b.erklaerung}</span>
              <span>{Math.round(s.km)} km · {TUN_TEXT[s.tun]}</span>
              <span className="text-xs">Ankunft nach <b>{tage(d)} Tagen</b></span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Herodot zählte rund 111 Stationen, eine Tagesreise voneinander entfernt. Ein Reisender brauchte etwa drei Monate, die Staffel der königlichen Reiter rund eine Woche: Niemand musste die ganze Strecke schaffen, und die Nachricht stand nie still.
        Zieh den Regler: Mit wenigen Stationen müssen auch die Staffelreiter rasten — mit sehr vielen fressen die Wechsel die Zeit. Route vereinfacht, Werte geschätzt.
      </p>
    </div>
  );
}
