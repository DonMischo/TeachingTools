"use client";
import { useEffect, useRef, useState } from "react";
import { useErprobt } from "@/lib/medien/erprobt";
import { rauschen } from "./ton";
import nachweise from "@/lib/medien/kino-radio.json";

type Sender = { id: "tschai" | "edison" | "apollo" | "sullivan" | "zeit"; mhz: number; name: string; was: string };
const SENDER: Sender[] = [
  { id: "tschai", mhz: 89.0, name: "Radio Walzer", was: "Aufnahme von 1890: Der Komponist Tschaikowski und Freunde sprechen auf eine Wachswalze." },
  { id: "edison", mhz: 94.5, name: "Funkhaus Menlo Park", was: "Thomas Edison spricht »Mary had a little lamb« – eine der ersten Tonaufnahmen überhaupt." },
  { id: "apollo", mhz: 98.0, name: "Mondfunk", was: "Apollo 11, 1969: Neil Armstrong – der erste Schritt auf dem Mond." },
  { id: "sullivan", mhz: 101.5, name: "Wachswalzen-Welle", was: "Der Komponist Arthur Sullivan auf einer Wachswalze, 1888." },
  { id: "zeit", mhz: 105.5, name: "Zeitzeichen", was: "Zeitzeichen des amerikanischen Senders WWV – die genaue Uhrzeit per Funk." },
];
const STADT = [{ mhz: 88.5, n: "Berlin" }, { mhz: 92, n: "Hilversum" }, { mhz: 96, n: "Luxemburg" }, { mhz: 103, n: "Prag" }, { mhz: 107, n: "Wien" }];
const MIN = 87.5, MAX = 108;
const FANG = 0.6; // MHz um den Sender herum, in denen man ihn hört

export function RadioDemo() {
  const erprobt = useErprobt();
  const [an, setAn] = useState(false);
  const [warm, setWarm] = useState(false);
  const [mhz, setMhz] = useState(90.2);
  const [laut, setLaut] = useState(0.7);
  const [gehoert, setGehoert] = useState<string[]>([]);
  const player = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    if (!an) { setWarm(false); return; }
    const t = setTimeout(() => setWarm(true), 1800);
    return () => clearTimeout(t);
  }, [an]);

  const nah = SENDER.reduce((m, s) => (Math.abs(s.mhz - mhz) < Math.abs(m.mhz - mhz) ? s : m));
  const dist = Math.abs(nah.mhz - mhz);
  const stark = warm ? Math.max(0, 1 - dist / FANG) : 0;
  const getroffen = warm && dist <= 0.15 ? nah : null;

  // Audio je Sender: Lautstärke nach Abstand
  useEffect(() => {
    for (const s of SENDER) {
      let a = player.current[s.id];
      const soll = warm && s.id === nah.id && stark > 0 ? stark * stark * laut : 0;
      if (soll > 0 && !a) {
        try { a = new Audio(nachweise[s.id].datei); a.loop = true; player.current[s.id] = a; } catch { /* kein Audio */ }
      }
      if (!a) continue;
      a.volume = Math.min(1, soll);
      try {
        if (soll > 0 && a.paused) void a.play()?.catch(() => {});
        else if (soll === 0 && !a.paused) a.pause();
      } catch { /* jsdom */ }
    }
  }, [warm, nah.id, stark, laut]);
  useEffect(() => () => { Object.values(player.current).forEach(a => { try { a.pause(); } catch { /* */ } }); }, []);

  // Rauschen: je weiter vom Sender, desto lauter
  useEffect(() => {
    if (!warm) return;
    const id = setInterval(() => rauschen(0.4, 0, (0.015 + (1 - stark) * 0.1) * laut, { freq: 2500, q: 0.5 }), 350);
    return () => clearInterval(id);
  }, [warm, stark, laut]);

  useEffect(() => {
    if (getroffen && !gehoert.includes(getroffen.id)) setGehoert(g => [...g, getroffen.id]);
  }, [getroffen, gehoert]);
  useEffect(() => { if (gehoert.length >= 3) erprobt("radio"); }, [gehoert, erprobt]);

  const pos = (f: number) => ((f - MIN) / (MAX - MIN)) * 100;
  return (
    <div className="card space-y-3 p-4">
      <h3 className="font-semibold">Das Röhrenradio</h3>
      <div className="mx-auto max-w-xl rounded-2xl p-4 shadow-lg" style={{ background: "linear-gradient(#8b5a2b,#5e3a1a)", border: "4px solid #3b2410" }}>
        <div className="relative h-24 overflow-hidden rounded-lg" style={{ background: warm ? "#f5d78a" : "#b9a77a", transition: "background 1s" }} aria-label="Skala">
          {STADT.map(s => (
            <span key={s.n} className="absolute top-1 -translate-x-1/2 text-[10px] text-black/70" style={{ left: `${pos(s.mhz)}%` }}>{s.n}</span>
          ))}
          {[90, 95, 100, 105].map(f => (
            <span key={f} className="absolute bottom-1 -translate-x-1/2 text-[10px] text-black/80" style={{ left: `${pos(f)}%` }}>{f}</span>
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-red-700" style={{ left: `${pos(mhz)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[#f5d78a]">
          <button className={an ? "chip chip-on" : "chip"} onClick={() => setAn(a => !a)}>{an ? "Ausschalten" : "Einschalten"}</button>
          <div className="flex items-center gap-2" aria-label="Abstimmanzeige">
            <span className="text-xs">Magisches Auge</span>
            <span className="relative inline-block h-8 w-8 rounded-full" style={{ background: "#052", boxShadow: warm ? `0 0 ${4 + stark * 14}px #4f4` : "none", opacity: warm ? 0.4 + stark * 0.6 : 0.3 }}>
              <span className="absolute inset-0 m-auto h-4 w-4 rounded-full bg-[#9f9]" style={{ transform: `scale(${0.3 + stark * 0.7})` }} />
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-around gap-3 text-[#f5d78a]">
          {/* Wie am echten Gerät: Abstimmen braucht mehrere Umdrehungen (5 MHz je Umdrehung), Lautstärke ein Dreiviertel-Dreh */}
          <Drehknopf label="Abstimmen" wert={mhz} min={MIN} max={MAX} proUmdrehung={5} schritt={0.1} onChange={setMhz} anzeige={`${mhz.toFixed(1)} MHz`} />
          <Drehknopf label="Lautstärke" wert={laut} min={0} max={1} schritt={0.05} onChange={setLaut} anzeige={`${Math.round(laut * 100)} %`} />
        </div>
      </div>
      <div className="min-h-12 text-sm" aria-live="polite">
        {!an ? "Schalte das Radio ein – die Röhren brauchen einen Moment zum Aufwärmen."
          : !warm ? "Die Röhren wärmen sich auf …"
          : getroffen ? <><b>{getroffen.name}</b> ({getroffen.mhz.toFixed(1)} MHz): {getroffen.was}</>
          : stark > 0 ? "Da ist etwas im Rauschen … drehe feiner."
          : "Nur Rauschen. Suche einen Sender."}
      </div>
      {getroffen && (
        <p className="text-xs text-muted">
          Aufnahme: {nachweise[getroffen.id].titel}, {nachweise[getroffen.id].urheber}, {nachweise[getroffen.id].lizenz} – <a className="underline" href={nachweise[getroffen.id].quelle} target="_blank" rel="noreferrer">Wikimedia Commons</a>
        </p>
      )}
      <p className="text-xs text-muted">Gefunden: {gehoert.length} von {SENDER.length} Sendern (ab 3 geschafft)</p>
    </div>
  );
}

/**
 * Drehknopf aus Bakelit: im Kreis ziehen (Maus, Finger), Mausrad oder Pfeiltasten.
 * Mit `proUmdrehung` dreht er sich mehrmals (Abstimmknopf), sonst über 270° (Lautstärke).
 */
function Drehknopf({ label, wert, min, max, schritt, onChange, proUmdrehung, anzeige }: {
  label: string; wert: number; min: number; max: number; schritt: number; onChange: (v: number) => void; proUmdrehung?: number; anzeige: string;
}) {
  const knopf = useRef<SVGSVGElement>(null);
  const zug = useRef<{ winkel: number; wert: number } | null>(null);
  const begrenzt = (v: number) => Math.min(max, Math.max(min, Math.round(v / schritt) * schritt));
  const grad = proUmdrehung ? ((wert - min) / proUmdrehung) * 360 : -135 + 270 * ((wert - min) / (max - min));
  const proGrad = proUmdrehung ? proUmdrehung / 360 : (max - min) / 270;
  const winkelVon = (e: React.PointerEvent) => {
    const r = knopf.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg ref={knopf} viewBox="-50 -50 100 100" className="w-20 h-20 touch-none cursor-grab" role="slider" tabIndex={0}
        aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={Number(wert.toFixed(2))} aria-valuetext={anzeige}
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); zug.current = { winkel: winkelVon(e), wert }; }}
        onPointerMove={e => {
          const z = zug.current;
          if (!z) return;
          const w = winkelVon(e);
          let d = w - z.winkel;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          z.winkel = w;
          z.wert = Math.min(max, Math.max(min, z.wert + d * proGrad));
          onChange(begrenzt(z.wert));
        }}
        onPointerUp={() => { zug.current = null; }} onPointerCancel={() => { zug.current = null; }}
        onWheel={e => { e.preventDefault(); onChange(begrenzt(wert + (e.deltaY < 0 ? schritt : -schritt))); }}
        onKeyDown={e => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); onChange(begrenzt(wert + schritt)); }
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); onChange(begrenzt(wert - schritt)); }
        }}>
        <defs>
          <radialGradient id={`knopf-${label}`} cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#6b4a2b" /><stop offset="1" stopColor="#2a1708" /></radialGradient>
        </defs>
        {!proUmdrehung && Array.from({ length: 11 }, (_, i) => {
          const a = ((-135 + i * 27 - 90) * Math.PI) / 180;
          return <line key={i} x1={Math.cos(a) * 44} y1={Math.sin(a) * 44} x2={Math.cos(a) * 48} y2={Math.sin(a) * 48} stroke="#f5d78a" strokeWidth="2" />;
        })}
        <circle r="40" fill="#1a0d04" />
        <g style={{ transform: `rotate(${grad}deg)` }}>
          <circle r="36" fill={`url(#knopf-${label})`} stroke="#140a03" strokeWidth="2" />
          {/* Griffrillen */}
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * 15 * Math.PI) / 180;
            return <line key={i} x1={Math.cos(a) * 31} y1={Math.sin(a) * 31} x2={Math.cos(a) * 36} y2={Math.sin(a) * 36} stroke="#140a03" strokeWidth="1.5" />;
          })}
          <circle r="22" fill="#3b2410" />
          <line x1="0" y1="-8" x2="0" y2="-30" stroke="#f5d78a" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
      <span className="text-xs">{label}</span>
      <b className="text-xs">{anzeige}</b>
    </div>
  );
}
