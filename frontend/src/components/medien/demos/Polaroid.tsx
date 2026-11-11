"use client";
/**
 * Sofortbild (Polaroid, 1948): Motiv wählen, auslösen, das Foto fährt aus der
 * Kamera und entwickelt sich in ca. 20 Sekunden. Schütteln hilft nicht.
 */
import { useEffect, useRef, useState } from "react";
import bilder from "@/lib/medien/demo-bilder.json";
import { fsk, rauschen, ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

const NACHWEISE = bilder as Record<string, { datei: string; titel: string; urheber: string; lizenz: string; quelle: string }>;
const MOTIVE = [
  { id: "polaroid_leuchtturm", name: "Leuchtturm" },
  { id: "polaroid_katze", name: "Katze" },
  { id: "polaroid_hund", name: "Hund" },
];
const DAUER = 20000;
const SCHRIFT = "'Segoe Script','Bradley Hand','Comic Sans MS',cursive";

/** Entwicklung p (0…1): erst graugrün und fast leer, dann kommen Farben und Kontrast */
const entwickelt = (p: number) =>
  `brightness(${(0.55 + 0.45 * p).toFixed(2)}) contrast(${(0.3 + 0.7 * p).toFixed(2)}) saturate(${(p * p).toFixed(2)}) sepia(${(1 - p).toFixed(2)}) hue-rotate(${Math.round(-50 * (1 - p))}deg)`;

type Foto = { nr: number; motiv: number; text: string; p: number };

export function PolaroidDemo() {
  const [motiv, setMotiv] = useState(0);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [blitz, setBlitz] = useState(false);
  const [wackelt, setWackelt] = useState(false);
  const [hinweis, setHinweis] = useState(false);
  const [text, setText] = useState("");
  const [album, setAlbum] = useState<Foto[]>([]);
  const zaehler = useRef(0);
  const erprobt = useErprobt();

  const auf = foto !== null && foto.p < 1;
  useEffect(() => {
    if (!auf) return;
    const id = setInterval(() => setFoto(f => (f ? { ...f, p: Math.min(1, f.p + 250 / DAUER) } : f)), 250);
    return () => clearInterval(id);
  }, [auf]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (foto && foto.p >= 1) erprobt("polaroid"); }, [foto?.p]);

  const ausloesen = () => {
    if (auf) return;
    setBlitz(true); setTimeout(() => setBlitz(false), 180);
    ton(1800, 0.05, 0, "square", 0.05);
    rauschen(0.12, 0.05, 0.1, { freq: 3000 });
    fsk([180, 220, 260], 1.4, 0.3, 40, 0.05, "sawtooth");
    rauschen(1.4, 0.3, 0.05, { freq: 600, q: 2 });
    zaehler.current += 1;
    setHinweis(false); setText("");
    setFoto({ nr: zaehler.current, motiv, text: "", p: 0 });
  };
  const schuetteln = () => {
    setWackelt(true); setHinweis(true);
    setTimeout(() => setWackelt(false), 600);
  };
  const insAlbum = () => {
    if (!foto || foto.p < 1) return;
    setAlbum(a => [...a, { ...foto, text }].slice(-6));
    setFoto(null); setText("");
  };
  const bild = (m: number) => NACHWEISE[MOTIVE[m].id].datei;
  const fertig = foto !== null && foto.p >= 1;

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        @keyframes pol-raus { from { transform: translateY(-70%); } to { transform: translateY(0); } }
        @keyframes pol-wackel { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-9deg); } 40% { transform: rotate(8deg); } 60% { transform: rotate(-7deg); } 80% { transform: rotate(6deg); } }
      `}</style>
      <div className="grid sm:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-64">
            <svg viewBox="0 0 260 190" className="w-full block" role="img" aria-label="Sofortbildkamera">
              <rect x="10" y="20" width="240" height="150" rx="22" fill="#e7e5e4" stroke="#78716c" strokeWidth="3" />
              <rect x="10" y="20" width="240" height="40" rx="20" fill="#d6d3d1" />
              {["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6"].map((c, i) => <rect key={c} x="10" y={104 + i * 6} width="240" height="6" fill={c} />)}
              <rect x="190" y="30" width="44" height="22" rx="4" fill="#fafaf9" stroke="#78716c" strokeWidth="2" />
              <circle cx="95" cy="95" r="44" fill="#1c1917" stroke="#57534e" strokeWidth="5" />
              <circle cx="95" cy="95" r="30" fill="#1e3a8a" />
              <circle cx="85" cy="85" r="8" fill="#93c5fd" opacity=".6" />
              <circle cx="212" cy="95" r="14" fill="#dc2626" stroke="#7f1d1d" strokeWidth="3" />
              <rect x="40" y="165" width="180" height="10" rx="4" fill="#44403c" />
            </svg>
            {blitz && <div className="absolute inset-0 rounded-3xl bg-white opacity-90" aria-hidden />}
          </div>
          <div className="relative w-64 aspect-[3/2] rounded border-2 border-line overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bild(motiv)} alt={`Sucher: ${MOTIVE[motiv].name}`} className="w-full h-full object-cover" draggable={false} />
            <span className="absolute inset-4 border border-white/70 pointer-events-none" aria-hidden />
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" aria-label="Motiv zurück" onClick={() => setMotiv(m => (m + MOTIVE.length - 1) % MOTIVE.length)}>◀</button>
            <span className="text-sm w-24 text-center">{MOTIVE[motiv].name}</span>
            <button className="btn-secondary" aria-label="Motiv weiter" onClick={() => setMotiv(m => (m + 1) % MOTIVE.length)}>▶</button>
          </div>
          <button className="btn-primary" onClick={ausloesen} disabled={auf}>📸 Auslösen</button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted">Das Sofortbild</span>
          <div className="h-72 w-full grid place-items-center overflow-hidden">
            {foto ? (
              <div key={foto.nr} style={{ animation: "pol-raus 1.4s ease-out" }}>
                <div className="bg-stone-50 p-3 pb-10 shadow-lg w-48 relative" style={wackelt ? { animation: "pol-wackel .6s" } : undefined}>
                  <div className="aspect-square overflow-hidden bg-stone-400">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bild(foto.motiv)} alt={MOTIVE[foto.motiv].name} className="w-full h-full object-cover" style={{ filter: entwickelt(foto.p) }} draggable={false} />
                  </div>
                  <span className="absolute left-3 right-3 bottom-2 text-center text-stone-700 truncate" style={{ fontFamily: SCHRIFT }}>{text}</span>
                </div>
              </div>
            ) : <span className="text-sm text-muted">Noch kein Foto — drück auf den Auslöser.</span>}
          </div>
          {foto && (
            <>
              <div className="w-48 h-2 rounded bg-surface border border-line overflow-hidden" role="progressbar" aria-valuenow={Math.round(foto.p * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-ok" style={{ width: `${foto.p * 100}%` }} />
              </div>
              <span className="text-xs text-muted">{fertig ? "Fertig entwickelt!" : `Entwickelt sich … ${Math.round(foto.p * 100)} %`}</span>
              <input className="border border-line rounded px-2 py-1 bg-surface w-48 text-sm" placeholder="Beschriften …" value={text} maxLength={20} onChange={e => setText(e.target.value)} aria-label="Beschriftung" />
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={schuetteln}>🤝 Schütteln</button>
                <button className="btn-primary" onClick={insAlbum} disabled={!fertig}>📒 Ins Album</button>
              </div>
              {hinweis && <p className="text-xs text-muted max-w-xs text-center">Schütteln hilft nicht! Polaroid sagt selbst: Das Foto entwickelt sich durch die Chemie im Film, nicht durch Wedeln — einfach warten.</p>}
            </>
          )}
        </div>
      </div>
      <div>
        <span className="text-xs text-muted">Fotoalbum ({album.length}/6)</span>
        <div className="flex flex-wrap gap-2 mt-1 min-h-8">
          {album.map(f => (
            <div key={f.nr} className="bg-stone-50 p-1 pb-4 shadow w-16 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bild(f.motiv)} alt={MOTIVE[f.motiv].name} className="w-full aspect-square object-cover" />
              <span className="absolute left-0 right-0 bottom-0 text-[9px] text-center text-stone-700 truncate px-1">{f.text}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted">Fotos (Wikimedia Commons): {MOTIVE.map(m => `${NACHWEISE[m.id].titel.replace(/[.]jpe?g$/i, "")} — ${NACHWEISE[m.id].urheber}, ${NACHWEISE[m.id].lizenz}`).join(" · ")}</p>
      <p className="text-xs text-muted">Edwin Land stellte 1948 die erste Sofortbildkamera vor: Im Film steckt die komplette Entwicklung — Chemikalien verteilen sich beim Herausfahren zwischen den Schichten, das Bild taucht langsam auf.</p>
    </div>
  );
}
