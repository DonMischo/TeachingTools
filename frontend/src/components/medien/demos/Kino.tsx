"use client";
import { useEffect, useState } from "react";
import { useErprobt } from "@/lib/medien/erprobt";
import { rauschen } from "./ton";
import nachweise from "@/lib/medien/kino-radio.json";

const FILM = nachweise.film;

/** Zwölf Einzelbilder: ein Ball springt von links nach rechts und drückt sich beim Aufprall platt */
const BILDER = Array.from({ length: 12 }, (_, i) => {
  const t = i / 11;
  const x = 30 + t * 240;
  const h = Math.abs(Math.sin(t * Math.PI * 2)); // zwei Hüpfer
  const platt = h < 0.12 ? 1 - h * 3 : 1;
  const ry = 16 * platt;
  const rx = 16 / Math.sqrt(platt);
  const y = 138 - ry - h * 90;
  return { x, y, rx, ry };
});

export function KinoDemo() {
  const erprobt = useErprobt();
  const [fps, setFps] = useState(2);
  const [lauf, setLauf] = useState(true);
  const [nr, setNr] = useState(0);
  const [langsam, setLangsam] = useState(false);
  const [fluessig, setFluessig] = useState(false);
  const [knattern, setKnattern] = useState(false);

  useEffect(() => {
    if (!lauf) return;
    const id = setInterval(() => {
      setNr(n => (n + 1) % BILDER.length);
      if (knattern) rauschen(0.03, 0, 0.04, { freq: 1800, q: 2 });
    }, 1000 / fps);
    return () => clearInterval(id);
  }, [lauf, fps, knattern]);

  useEffect(() => {
    if (fps <= 4) setLangsam(true);
    if (fps >= 16) setFluessig(true);
  }, [fps]);
  useEffect(() => { if (langsam && fluessig) erprobt("kino"); }, [langsam, fluessig, erprobt]);

  const b = BILDER[nr];
  const hinweis = fps <= 4 ? "Du siehst einzelne Bilder, die nacheinander aufblitzen."
    : fps < 12 ? "Es ruckelt noch stark – das Auge erkennt die Einzelbilder."
    : fps < 16 ? "Fast: Die Bewegung wirkt, ruckelt aber noch leicht."
    : "Flüssig! Das Auge verschmilzt die Einzelbilder zu einer Bewegung.";

  return (
    <div className="space-y-5">
      <div className="card space-y-2 p-4">
        <h3 className="font-semibold">Das erste Kino (1895)</h3>
        <div className="mx-auto max-w-xl rounded-lg bg-black p-2 shadow-inner" style={{ borderInline: "14px solid #7f1d1d" }}>
          <video src={FILM.datei} controls playsInline preload="none" className="aspect-[4/3] w-full bg-black" aria-label="Ankunft eines Zuges in La Ciotat" />
        </div>
        <p className="text-xs text-muted">
          »L'Arrivée d'un train en gare de La Ciotat« der Brüder Lumière, 1895/96 – ein Film ohne Ton.
          Quelle: <a className="underline" href={FILM.quelle} target="_blank" rel="noreferrer">Wikimedia Commons</a>, {FILM.urheber}, {FILM.lizenz}.
        </p>
      </div>

      <div className="card space-y-3 p-4">
        <h3 className="font-semibold">Daumenkino: Wie aus Bildern Bewegung wird</h3>
        <svg viewBox="0 0 300 150" className="mx-auto w-full max-w-md rounded-lg border border-line bg-surface" role="img" aria-label={`Bild ${nr + 1} von 12`}>
          <line x1="0" y1="138" x2="300" y2="138" stroke="currentColor" strokeOpacity="0.4" />
          <ellipse cx={b.x} cy={b.y} rx={b.rx} ry={b.ry} fill="currentColor" className="text-muted" />
          <text x="8" y="16" fontSize="11" fill="currentColor">Bild {nr + 1} / 12</text>
        </svg>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm">
            <span className="whitespace-nowrap">Bilder pro Sekunde: <b>{fps}</b></span>
            <input type="range" min={1} max={30} value={fps} onChange={e => setFps(Number(e.target.value))} className="flex-1" aria-label="Bilder pro Sekunde" />
          </label>
          <button className="btn-secondary" onClick={() => setLauf(l => !l)}>{lauf ? "Anhalten" : "Weiter"}</button>
          <button className={knattern ? "chip chip-on" : "chip"} onClick={() => setKnattern(k => !k)}>Projektor-Rattern</button>
        </div>
        <p className="text-sm">{hinweis}</p>
        <p className="text-xs text-muted">
          Das Auge verschmilzt schnelle Einzelbilder. Stumme Filme liefen mit etwa 16–18 Bildern pro Sekunde, der Tonfilm mit 24.
        </p>
        <p className="text-xs text-muted">Ausprobiert: langsam (≤ 4) {langsam ? "✓" : "–"} · flüssig (≥ 16) {fluessig ? "✓" : "–"}</p>
      </div>
    </div>
  );
}
