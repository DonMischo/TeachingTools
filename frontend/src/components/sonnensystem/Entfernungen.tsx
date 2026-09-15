"use client";
/**
 * Entfernungen, maßstabsgetreu: ein langes Band von der Sonne bis Pluto, auf
 * dem die Planeten fast unsichtbar klein sind — genau das ist die Lektion.
 *
 * Darauf läuft ein Lichtstrahl, in echter Lichtgeschwindigkeit oder im
 * Zeitraffer, mit Stoppuhr. Solange er läuft, wächst der Maßstab mit: das
 * Band zeigt immer die Sonne bis knapp hinter den nächsten Planeten. Erreicht
 * das Licht einen Planeten, zoomt es heraus bis zum folgenden — so bleiben
 * alle schon erreichten auf dem Weg sichtbar.
 *
 * Darunter die Reisezeiten mit Auto, Flugzeug und der schnellsten Sonde, die
 * das Sonnensystem verlässt.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ERDE, HAUPTKOERPER, KM_JE_AE, LICHT_KM_S, type Koerper } from "@/lib/sonnensystem/daten";
import { abstand, heliozentrisch, julianischerTag } from "@/lib/sonnensystem/bahnen";
import { dauer, km, zahl } from "@/lib/sonnensystem/format";
import { Knopfgruppe } from "./Bedienung";

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
const ABSTAND = Object.fromEntries(PLANETEN_UND_ZWERGE.map(k => [k.id, k.bahn!.a * KM_JE_AE]));
const AEUSSERSTER = ABSTAND[PLANETEN_UND_ZWERGE.at(-1)!.id];
const RAND = 60;
/** Wie weit das Band über den nächsten Planeten hinausreicht. */
const UEBERSTAND = 1.05;
/** Namen, die näher als das beieinander stehen, werden ausgeblendet. */
const NAMENSABSTAND = 56;

/** Reisezeit in Sekunden für eine Strecke in km bei v km/h. */
const reise = (strecke: number, kmh: number) => (strecke / kmh) * 3600;

/** Was das Band beim Lichtlauf zeigen soll: von der Sonne bis kurz hinter das nächste Ziel. */
export function sichtweiteFuerLicht(lichtKm: number): number {
  const naechster = PLANETEN_UND_ZWERGE.find(k => ABSTAND[k.id] > lichtKm);
  return (naechster ? ABSTAND[naechster.id] : AEUSSERSTER) * UEBERSTAND;
}

export function Entfernungen({ onWaehle }: { onWaehle: (id: string) => void }) {
  const [massstab, setMassstab] = useState(250_000);
  const [raffer, setRaffer] = useState(100);
  const [licht, setLicht] = useState<{ start: number; sekunden: number } | null>(null);
  const [erreicht, setErreicht] = useState<{ name: string; zeit: number } | null>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const innenRef = useRef<HTMLDivElement>(null);
  const strahlRef = useRef<HTMLDivElement>(null);
  const sonneRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rafferRef = useRef(raffer);
  rafferRef.current = raffer;

  const breite = AEUSSERSTER / massstab + RAND * 2 + 200;
  const x = (kmVonSonne: number) => RAND + kmVonSonne / massstab;

  // Der Strahl und der mitwachsende Maßstab laufen außerhalb von React;
  // die Stoppuhr wird zehnmal je Sekunde gezeichnet.
  useEffect(() => {
    if (!licht) return;
    let bild = 0;
    let letzte = performance.now();
    let sim = licht.sekunden;
    let zuletztGezeigt = 0;
    let sicht = sichtweiteFuerLicht(sim * LICHT_KM_S);
    const naechsteZiele = PLANETEN_UND_ZWERGE.map(k => ({ k, zeit: ABSTAND[k.id] / LICHT_KM_S }))
      .filter(z => z.zeit > sim);

    const lege = () => {
      const band = bandRef.current;
      if (!band) return;
      const nutzbar = Math.max(band.clientWidth - RAND * 2, 100);
      const kmJePx = sicht / nutzbar;
      const pos = (k: number) => RAND + k / kmJePx;
      if (innenRef.current) innenRef.current.style.width = `${band.clientWidth}px`;
      if (sonneRef.current) {
        const r = Math.max(696_340 / kmJePx, 4);
        Object.assign(sonneRef.current.style, { left: `${RAND - r}px`, width: `${r * 2}px`, height: `${r * 2}px`, marginTop: `${-r}px` });
      }
      const lichtKm = sim * LICHT_KM_S;
      const ziel = PLANETEN_UND_ZWERGE.find(k => ABSTAND[k.id] > lichtKm)?.id;
      let letzterName = -Infinity;
      // Von außen nach innen: der nächste Planet behält seinen Namen, gedrängte innere geben ihn ab.
      for (const k of [...PLANETEN_UND_ZWERGE].reverse()) {
        const el = markerRef.current.get(k.id);
        if (!el) continue;
        const px = pos(ABSTAND[k.id]);
        el.style.left = `${px}px`;
        const punkt = el.querySelector<HTMLElement>("[data-punkt]")!;
        const d = Math.max((k.radiusKm * 2) / kmJePx, 3);
        Object.assign(punkt.style, { width: `${d}px`, height: `${d}px`, margin: `${-d / 2}px 0 0 ${-d / 2}px` });
        el.style.display = px > band.clientWidth + 40 ? "none" : "";
        const name = el.querySelector<HTMLElement>("[data-name]")!;
        const frei = Math.abs(letzterName - px) >= NAMENSABSTAND || k.id === ziel;
        name.style.opacity = frei ? "1" : "0";
        if (frei && px <= band.clientWidth) letzterName = px;
      }
      if (strahlRef.current) strahlRef.current.style.transform = `translateX(${pos(lichtKm)}px)`;
    };

    const schritt = (jetzt: number) => {
      bild = requestAnimationFrame(schritt);
      const dt = Math.min((jetzt - letzte) / 1000, 0.1);
      letzte = jetzt;
      if (sim * LICHT_KM_S < AEUSSERSTER * UEBERSTAND) sim += dt * rafferRef.current;
      // Neuer Planet erreicht: sanft herauszoomen statt springen.
      const soll = sichtweiteFuerLicht(sim * LICHT_KM_S);
      sicht += (soll - sicht) * (1 - Math.exp(-dt * 3));
      lege();
      while (naechsteZiele.length && naechsteZiele[0].zeit <= sim) {
        const z = naechsteZiele.shift()!;
        setErreicht({ name: z.k.name, zeit: z.zeit });
      }
      if (jetzt - zuletztGezeigt > 100) {
        zuletztGezeigt = jetzt;
        setLicht(l => (l ? { ...l, sekunden: sim } : l));
      }
      if (!naechsteZiele.length && Math.abs(soll - sicht) < soll * 0.001) cancelAnimationFrame(bild);
    };
    lege();
    bild = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(bild);
    // Nur beim Start neu aufsetzen, nicht bei jedem Stoppuhr-Tick.
  }, [licht?.start]);

  const heute = useMemo(() => {
    const jd = julianischerTag(new Date());
    const erde = heliozentrisch(ERDE.bahn!, jd);
    return Object.fromEntries(PLANETEN_UND_ZWERGE.map(k => [k.id, abstand(erde, heliozentrisch(k.bahn!, jd)) * KM_JE_AE]));
  }, []);

  const starte = () => {
    setErreicht(null);
    setLicht({ start: performance.now(), sekunden: 0 });
    if (bandRef.current) bandRef.current.scrollLeft = 0;
  };

  return (
    <div className="h-full flex flex-col text-slate-100">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        {licht ? (
          <>
            <button onClick={starte} className="rounded-lg bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 hover:bg-amber-200">☀️ Noch einmal</button>
            <Knopfgruppe werte={RAFFER} aktiv={raffer} onWahl={setRaffer} />
            <span className="text-sm font-bold tabular-nums text-amber-200">⏱ {dauer(licht.sekunden)}</span>
            <button onClick={() => { setLicht(null); setErreicht(null); }} className="text-xs text-slate-400 hover:text-slate-200 underline">
              zurück zum festen Maßstab
            </button>
          </>
        ) : (
          <>
            <Knopfgruppe werte={MASSSTAEBE} aktiv={massstab} onWahl={setMassstab} />
            <button onClick={starte} className="rounded-lg bg-amber-300 text-slate-950 font-black text-xs px-3 py-1.5 hover:bg-amber-200">
              ☀️ Licht losschicken
            </button>
          </>
        )}
      </div>
      {erreicht && (
        <div className="px-4 pt-2 text-sm text-amber-100">
          Das Licht hat {erreicht.name} erreicht — nach {dauer(erreicht.zeit)}.
        </div>
      )}

      <div ref={bandRef} className={`shrink-0 ${licht ? "overflow-hidden" : "overflow-x-auto overflow-y-hidden"} mt-3 border-y border-white/10 bg-black/30`}>
        {/* Neuer Schlüssel je Modus: die Schleife setzt Positionen direkt, React soll danach frisch zeichnen. */}
        <div key={licht ? `licht-${licht.start}` : `fest-${massstab}`} ref={innenRef} className="relative h-40" style={{ width: licht ? "100%" : breite }}>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />
          <Sonne ref={sonneRef} x={x(0)} radiusPx={696_340 / massstab} />
          {PLANETEN_UND_ZWERGE.map((k, i) => (
            // Innen liegen die Planeten dicht: Namen abwechselnd oben und unten.
            <Markierung
              key={k.id}
              ref={el => { if (el) markerRef.current.set(k.id, el); else markerRef.current.delete(k.id); }}
              koerper={k} x={x(ABSTAND[k.id])} massstab={massstab} unten={i % 2 === 1} onWaehle={onWaehle}
            />
          ))}
          <div ref={strahlRef} className="absolute top-1/2 left-0 -mt-1.5 -ml-1.5 w-3 h-3 rounded-full bg-amber-200 pointer-events-none"
            style={{ display: licht ? "" : "none", boxShadow: "0 0 12px 4px rgba(253,230,138,0.8)" }} />
        </div>
      </div>
      <p className="px-4 pt-1 text-[11px] text-slate-400">
        {licht
          ? "Der Maßstab wächst mit dem Licht: das Band reicht immer bis knapp hinter den nächsten Planeten. Planeten und Abstände bleiben im selben Maßstab."
          : "Planeten und Abstände im selben Maßstab — deshalb sind die meisten Planeten nur ein Punkt. Waagerecht scrollen."}
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
              const s = ABSTAND[k.id];
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

function Sonne({ x, radiusPx, ref }: { x: number; radiusPx: number; ref: React.Ref<HTMLDivElement> }) {
  const r = Math.max(radiusPx, 3);
  return (
    <div ref={ref} className="absolute top-1/2 rounded-full pointer-events-none" style={{
      left: x - r, width: r * 2, height: r * 2, marginTop: -r,
      background: "radial-gradient(circle, #fff7d0, #ffb638 70%)", boxShadow: "0 0 24px 6px rgba(255,190,60,0.5)",
    }} />
  );
}

function Markierung({ koerper, x, massstab, unten, onWaehle, ref }: {
  koerper: Koerper; x: number; massstab: number; unten: boolean; onWaehle: (id: string) => void;
  ref: React.Ref<HTMLButtonElement>;
}) {
  const echt = (koerper.radiusKm * 2) / massstab;
  const punkt = Math.max(echt, 3);
  return (
    <button
      ref={ref}
      onClick={() => onWaehle(koerper.id)}
      title={`${koerper.name}: ${km(ABSTAND[koerper.id])} von der Sonne`}
      className="absolute top-0 bottom-0 -translate-x-1/2 w-20"
      style={{ left: x }}
    >
      <span data-name className={`absolute left-0 right-0 flex flex-col items-center transition-opacity ${unten ? "bottom-3" : "top-3"}`}>
        <span className="text-xs font-bold whitespace-nowrap" style={{ color: koerper.farbe }}>{koerper.name}</span>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{km(ABSTAND[koerper.id])}</span>
      </span>
      <span data-punkt className="absolute top-1/2 left-1/2 rounded-full" style={{
        width: punkt, height: punkt, margin: `${-punkt / 2}px 0 0 ${-punkt / 2}px`, background: koerper.farbe,
        boxShadow: `0 0 6px ${koerper.farbe}`,
      }} />
    </button>
  );
}
