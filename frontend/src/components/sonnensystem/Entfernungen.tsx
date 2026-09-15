"use client";
/**
 * Entfernungen, maßstabsgetreu: ein langes Band von der Sonne bis Pluto, auf
 * dem die Planeten fast unsichtbar klein sind — genau das ist die Lektion.
 *
 * Darauf läuft ein Lichtstrahl, in echter Lichtgeschwindigkeit oder im
 * Zeitraffer, mit Stoppuhr. Darunter die Reisezeiten mit Auto, Flugzeug und
 * der schnellsten Sonde, die das Sonnensystem verlässt.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ERDE, HAUPTKOERPER, KM_JE_AE, LICHT_KM_S, type Koerper } from "@/lib/sonnensystem/daten";
import { abstand, heliozentrisch, julianischerTag } from "@/lib/sonnensystem/bahnen";
import { dauer, km, zahl } from "@/lib/sonnensystem/format";
import { Knopfgruppe, Schalter } from "./Bedienung";

const MASSSTAEBE = [
  { wert: 50_000, name: "1 px = 50 000 km" },
  { wert: 250_000, name: "1 px = 250 000 km" },
  { wert: 1_000_000, name: "1 px = 1 Mio. km" },
];
const RAFFER = [
  { wert: 1, name: "echt" },
  { wert: 10, name: "× 10" },
  { wert: 100, name: "× 100" },
  { wert: 1000, name: "× 1 000" },
];

const PLANETEN_UND_ZWERGE = HAUPTKOERPER.filter(k => k.bahn);
const RAND = 60;

/** Reisezeit in Sekunden für eine Strecke in km bei v km/h. */
const reise = (strecke: number, kmh: number) => (strecke / kmh) * 3600;

export function Entfernungen({ onWaehle }: { onWaehle: (id: string) => void }) {
  const [massstab, setMassstab] = useState(250_000);
  const [raffer, setRaffer] = useState(100);
  const [mitfahren, setMitfahren] = useState(true);
  const [licht, setLicht] = useState<{ start: number; sekunden: number } | null>(null);
  const [erreicht, setErreicht] = useState<{ name: string; zeit: number } | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const strahlRef = useRef<HTMLDivElement>(null);
  const rafferRef = useRef(raffer);
  rafferRef.current = raffer;
  const mitfahrenRef = useRef(mitfahren);
  mitfahrenRef.current = mitfahren;

  const breite = (PLANETEN_UND_ZWERGE.at(-1)!.bahn!.a * KM_JE_AE) / massstab + RAND * 2 + 200;
  const x = (kmVonSonne: number) => RAND + kmVonSonne / massstab;

  // Der Strahl läuft außerhalb von React; die Stoppuhr wird zehnmal je Sekunde gezeichnet.
  useEffect(() => {
    if (!licht) return;
    let bild = 0;
    let letzte = performance.now();
    let sim = licht.sekunden;
    let zuletztGezeigt = 0;
    const naechsteZiele = PLANETEN_UND_ZWERGE.map(k => ({ k, zeit: (k.bahn!.a * KM_JE_AE) / LICHT_KM_S }))
      .filter(z => z.zeit > sim);
    const schritt = (jetzt: number) => {
      bild = requestAnimationFrame(schritt);
      sim += ((jetzt - letzte) / 1000) * rafferRef.current;
      letzte = jetzt;
      const px = x(sim * LICHT_KM_S);
      if (strahlRef.current) strahlRef.current.style.transform = `translateX(${px}px)`;
      const band = bandRef.current;
      if (band && mitfahrenRef.current && (px > band.scrollLeft + band.clientWidth * 0.7 || px < band.scrollLeft)) {
        band.scrollLeft = px - band.clientWidth * 0.3;
      }
      while (naechsteZiele.length && naechsteZiele[0].zeit <= sim) {
        const z = naechsteZiele.shift()!;
        setErreicht({ name: z.k.name, zeit: z.zeit });
      }
      if (jetzt - zuletztGezeigt > 100) {
        zuletztGezeigt = jetzt;
        setLicht(l => (l ? { ...l, sekunden: sim } : l));
      }
      if (!naechsteZiele.length && sim * LICHT_KM_S > PLANETEN_UND_ZWERGE.at(-1)!.bahn!.a * KM_JE_AE * 1.02) cancelAnimationFrame(bild);
    };
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
    // Nur beim Start und bei neuem Maßstab neu aufsetzen, nicht bei jedem Stoppuhr-Tick.
  }, [licht?.start, massstab]);

  const heute = useMemo(() => {
    const jd = julianischerTag(new Date());
    const erde = heliozentrisch(ERDE.bahn!, jd);
    return Object.fromEntries(PLANETEN_UND_ZWERGE.map(k => [k.id, abstand(erde, heliozentrisch(k.bahn!, jd)) * KM_JE_AE]));
  }, []);

  return (
    <div className="h-full flex flex-col text-slate-100">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <Knopfgruppe werte={MASSSTAEBE} aktiv={massstab} onWahl={setMassstab} />
        <button
          onClick={() => { setErreicht(null); setLicht({ start: performance.now(), sekunden: 0 }); if (bandRef.current) bandRef.current.scrollLeft = 0; }}
          className="rounded-lg bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 hover:bg-amber-200"
        >☀️ Licht losschicken</button>
        {licht && (
          <>
            <Knopfgruppe werte={RAFFER} aktiv={raffer} onWahl={setRaffer} />
            <Schalter an={mitfahren} onClick={() => setMitfahren(m => !m)}>mitfahren</Schalter>
            <span className="text-sm font-bold tabular-nums text-amber-200">⏱ {dauer(licht.sekunden)}</span>
          </>
        )}
      </div>
      {erreicht && (
        <div className="px-4 pt-2 text-sm text-amber-100">
          Das Licht hat {erreicht.name} erreicht — nach {dauer(erreicht.zeit)}.
        </div>
      )}

      <div ref={bandRef} className="shrink-0 overflow-x-auto overflow-y-hidden mt-3 border-y border-white/10 bg-black/30">
        <div className="relative h-40" style={{ width: breite }}>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
          <Sonne x={x(0)} radiusPx={696_340 / massstab} />
          {PLANETEN_UND_ZWERGE.map((k, i) => (
            // Innen liegen die Planeten dicht: Namen abwechselnd oben und unten.
            <Markierung key={k.id} koerper={k} x={x(k.bahn!.a * KM_JE_AE)} massstab={massstab} unten={i % 2 === 1} onWaehle={onWaehle} />
          ))}
          <div ref={strahlRef} className="absolute top-1/2 left-0 -mt-1.5 w-3 h-3 rounded-full bg-amber-200 pointer-events-none"
            style={{ display: licht ? "" : "none", boxShadow: "0 0 12px 4px rgba(253,230,138,0.8)" }} />
        </div>
      </div>
      <p className="px-4 pt-1 text-[11px] text-slate-400">
        Planeten und Abstände im selben Maßstab — deshalb sind die meisten Planeten nur ein Punkt. Waagerecht scrollen.
      </p>

      <div className="flex-1 overflow-auto px-4 py-3">
        <table className="w-full text-sm min-w-[40rem]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="py-1 pr-3">Von der Sonne bis</th>
              <th className="py-1 pr-3">Abstand</th>
              <th className="py-1 pr-3">☀️ Licht</th>
              <th className="py-1 pr-3">🚗 Auto 100 km/h</th>
              <th className="py-1 pr-3">✈️ Flugzeug 900 km/h</th>
              <th className="py-1 pr-3">🛰️ Voyager 1</th>
              <th className="py-1">🌍 Heute von der Erde</th>
            </tr>
          </thead>
          <tbody>
            {PLANETEN_UND_ZWERGE.map(k => {
              const s = k.bahn!.a * KM_JE_AE;
              return (
                <tr key={k.id} className="border-t border-white/10">
                  <td className="py-1.5 pr-3">
                    <button onClick={() => onWaehle(k.id)} className="font-bold hover:text-sky-300" style={{ color: k.farbe }}>{k.name}</button>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{km(s)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{dauer(s / LICHT_KM_S)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{dauer(reise(s, 100))}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{dauer(reise(s, 900))}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{dauer(reise(s, 61_000))}</td>
                  <td className="py-1.5 tabular-nums">{k.id === "erde" ? "—" : km(heute[k.id])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-400 mt-2">
          Voyager 1 ist mit rund 61 000 km/h die schnellste Sonde, die das Sonnensystem verlässt. Die Abstände sind Mittelwerte — die Bahnen sind leicht oval.
          Der nächste Stern, Proxima Centauri, ist {zahl(4.24, 2)} Lichtjahre entfernt: Voyager bräuchte über 70 000 Jahre.
        </p>
      </div>
    </div>
  );
}

function Sonne({ x, radiusPx }: { x: number; radiusPx: number }) {
  const r = Math.max(radiusPx, 3);
  return (
    <div className="absolute top-1/2 rounded-full pointer-events-none" style={{
      left: x - r, width: r * 2, height: r * 2, marginTop: -r,
      background: "radial-gradient(circle, #fff7d0, #ffb638 70%)", boxShadow: "0 0 24px 6px rgba(255,190,60,0.5)",
    }} />
  );
}

function Markierung({ koerper, x, massstab, unten, onWaehle }: {
  koerper: Koerper; x: number; massstab: number; unten: boolean; onWaehle: (id: string) => void;
}) {
  const echt = (koerper.radiusKm * 2) / massstab;
  const punkt = Math.max(echt, 3);
  return (
    <button
      onClick={() => onWaehle(koerper.id)}
      title={`In diesem Maßstab ist ${koerper.name} ${zahl(echt, echt < 1 ? 3 : 1)} Pixel breit.`}
      className="absolute top-0 bottom-0 -translate-x-1/2 w-20"
      style={{ left: x }}
    >
      <span className={`absolute left-0 right-0 flex flex-col items-center ${unten ? "bottom-3" : "top-3"}`}>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: koerper.farbe }}>{koerper.name}</span>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{km(koerper.bahn!.a * KM_JE_AE)}</span>
      </span>
      <span className="absolute top-1/2 left-1/2 rounded-full" style={{
        width: punkt, height: punkt, margin: `${-punkt / 2}px 0 0 ${-punkt / 2}px`, background: koerper.farbe,
        boxShadow: echt < 3 ? `0 0 6px ${koerper.farbe}` : undefined,
      }} />
    </button>
  );
}
