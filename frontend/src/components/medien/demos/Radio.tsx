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
        <div className="mt-3 flex flex-col gap-2 text-[#f5d78a]">
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24">Abstimmen</span>
            <input type="range" min={MIN} max={MAX} step={0.1} value={mhz} onChange={e => setMhz(Number(e.target.value))} className="flex-1" aria-label="Frequenz" />
            <b className="w-20 text-right">{mhz.toFixed(1)} MHz</b>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-24">Lautstärke</span>
            <input type="range" min={0} max={1} step={0.05} value={laut} onChange={e => setLaut(Number(e.target.value))} className="flex-1" aria-label="Lautstärke" />
          </label>
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
