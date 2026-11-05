"use client";
/** Mitmach-Demos der frühen Medien: Keilschrift, Hieroglyphen, Quipu, Leuchtfeuer */
import { useEffect, useRef, useState } from "react";
import { inHieroglyphen, quipuWert } from "@/lib/medien/codes";

// ── Keilschrift: Griffel in Ton drücken ──
const KEILE = [
  { id: "rechts", label: "▶ waagerecht", drehung: 0 },
  { id: "unten", label: "▼ senkrecht", drehung: 90 },
  { id: "schraeg", label: "◢ schräg", drehung: 45 },
  { id: "winkel", label: "◀ Winkelhaken", drehung: 180 },
] as const;

export function KeilschriftDemo() {
  const [art, setArt] = useState<(typeof KEILE)[number]["id"]>("rechts");
  const [keile, setKeile] = useState<{ x: number; y: number; d: number }[]>([]);
  const [gebrannt, setGebrannt] = useState(false);
  const druecke = (e: React.MouseEvent<SVGSVGElement>) => {
    if (gebrannt) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 320, y = ((e.clientY - r.top) / r.height) * 200;
    setKeile(k => [...k, { x, y, d: KEILE.find(w => w.id === art)!.drehung }]);
  };
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <svg viewBox="0 0 320 200" className="w-full max-w-md rounded-2xl cursor-crosshair shadow-inner" onClick={druecke} role="img" aria-label="Tontafel">
        <defs>
          <radialGradient id="ton" cx="45%" cy="40%" r="75%"><stop offset="0" stopColor={gebrannt ? "#c2703d" : "#c9a27a"} /><stop offset="1" stopColor={gebrannt ? "#8a4a22" : "#9c7650"} /></radialGradient>
        </defs>
        <rect x="4" y="4" width="312" height="192" rx="26" fill="url(#ton)" />
        {keile.map((k, i) => (
          <g key={i} transform={`translate(${k.x} ${k.y}) rotate(${k.d})`}>
            <path d="M -9 -7 L 3 0 L -9 7 Z" fill="#5b3d22" opacity="0.85" />
            <line x1="3" y1="0" x2="22" y2="0" stroke="#5b3d22" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
          </g>
        ))}
        {!keile.length && <text x="160" y="105" textAnchor="middle" fontSize="13" fill="#5b3d22">Klick in den Ton: Griffel eindrücken</text>}
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <span className="label">Griffel halten:</span>
        {KEILE.map(k => <button key={k.id} className={`chip ${art === k.id ? "chip-on" : ""}`} onClick={() => setArt(k.id)}>{k.label}</button>)}
        <button className="btn-secondary" disabled={gebrannt} onClick={() => setKeile([])}>🤚 Glattstreichen</button>
        <button className="btn-secondary" disabled={!keile.length || gebrannt} onClick={() => setGebrannt(true)}>🔥 Im Ofen brennen</button>
        <p className="text-xs text-muted max-w-56">
          {gebrannt ? "Gebrannt! Jetzt hält die Tafel Jahrtausende — ändern geht aber nicht mehr. Speichern für immer." : `${keile.length} Keile. Das Keilschrift-Zeichen für »Bier« (KAŠ) hatte rund ein Dutzend.`}
        </p>
        {gebrannt && <button className="text-xs underline text-muted self-start" onClick={() => { setGebrannt(false); setKeile([]); }}>Neue Tafel</button>}
      </div>
    </div>
  );
}

// ── Hieroglyphen: der eigene Name ──
export function HieroglyphenDemo() {
  const [name, setName] = useState("Kleopatra");
  const zeichen = inHieroglyphen(name);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span className="label">Dein Name:</span>
        <input className="input w-56" value={name} maxLength={20} onChange={e => setName(e.target.value)} />
      </label>
      <div className="rounded-2xl p-4 min-h-28 flex flex-wrap gap-3 items-end" style={{ background: "linear-gradient(#f3e3b5, #e2c98a)", color: "#3b2a12" }}>
        {zeichen.map((g, i) => (
          <div key={i} className="flex flex-col items-center" title={g.name}>
            <span className="text-5xl leading-none" style={{ fontFamily: "'Segoe UI Historic', 'Noto Sans Egyptian Hieroglyphs', serif" }}>{g.zeichen}</span>
            <span className="text-[10px] font-bold mt-1 opacity-70">{g.laut}</span>
          </div>
        ))}
        {zeichen.length > 0 && <span className="text-xs ml-auto self-center opacity-70 max-w-48">Königsnamen standen in einem Ring, der »Kartusche« — als Schutz.</span>}
      </div>
      <p className="text-xs text-muted">Vereinfacht: Die Ägypter schrieben eigentlich keine Vokale — und hatten Hunderte weitere Zeichen für ganze Wörter. Fahr mit der Maus über ein Zeichen, um zu sehen, was es zeigt.</p>
    </div>
  );
}

// ── Quipu: Zahlen in Knoten ──
const STELLEN = ["Einer", "Zehner", "Hunderter"];
const zufallsZahl = () => 10 + Math.floor(Math.random() * 980);

export function QuipuDemo() {
  const [knoten, setKnoten] = useState([0, 0, 0]);
  const [ziel, setZiel] = useState(347);
  const wert = quipuWert(knoten);
  const setze = (stelle: number, d: number) => setKnoten(k => k.map((v, i) => (i === stelle ? Math.max(0, Math.min(9, v + d)) : v)));
  const geschafft = wert === ziel;
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start">
      <svg viewBox="0 0 220 270" className="w-56 shrink-0" role="img" aria-label={`Quipu mit dem Wert ${wert}`}>
        <line x1="10" y1="16" x2="210" y2="16" stroke="#7c4a1e" strokeWidth="7" strokeLinecap="round" />
        {/* Nachbarschnüre nur zur Zierde */}
        {[40, 180].map(x => <line key={x} x1={x} y1="16" x2={x} y2="230" stroke="#a8a29e" strokeWidth="3" opacity="0.6" />)}
        <line x1="110" y1="16" x2="110" y2="262" stroke="#d97706" strokeWidth="4" />
        {/* Hunderter oben, Zehner Mitte, Einer unten — auf derselben Schnur */}
        {[2, 1, 0].map((stelle, reihe) => (
          <g key={stelle}>
            <text x="128" y={58 + reihe * 70} fontSize="9" fill="currentColor">{STELLEN[stelle]}</text>
            {Array.from({ length: knoten[stelle] }, (_, k) => (
              <ellipse key={k} cx="110" cy={34 + reihe * 70 + k * 6.5} rx="6" ry="3.6" fill="#3f2a14" />
            ))}
          </g>
        ))}
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <p>Auftrag des Inka-Verwalters: <b>{ziel} Lamas</b> knüpfen.</p>
        {[2, 1, 0].map(s => (
          <div key={s} className="flex items-center gap-2">
            <span className="w-20">{STELLEN[s]}:</span>
            <button className="btn-secondary px-2 py-0.5" onClick={() => setze(s, -1)} aria-label={`${STELLEN[s]} lösen`}>−</button>
            <b className="w-4 text-center">{knoten[s]}</b>
            <button className="btn-secondary px-2 py-0.5" onClick={() => setze(s, 1)} aria-label={`${STELLEN[s]} knoten`}>+</button>
          </div>
        ))}
        <p className="text-lg font-black">Die Schnur sagt: {wert}</p>
        {geschafft ? <p className="text-ok font-bold">✅ Genau! Ein Läufer bringt die Schnur nach Cusco. <button className="underline" onClick={() => { setZiel(zufallsZahl()); setKnoten([0, 0, 0]); }}>Nächster Auftrag</button></p>
          : <p className="text-xs text-muted">Wie bei unseren Ziffern: Die Lage des Knotens zeigt die Stelle. Eine Lücke heißt 0.</p>}
      </div>
    </div>
  );
}

// ── Leuchtfeuer-Kette gegen einen Läufer ──
const HUEGEL = 7;
export function LeuchtfeuerDemo() {
  const [brennt, setBrennt] = useState(0);
  const [laeufer, setLaeufer] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const uhr = useRef<number | null>(null);
  useEffect(() => () => { if (uhr.current) clearInterval(uhr.current); }, []);
  const start = () => {
    setBrennt(1); setLaeufer(0); setLaeuft(true);
    let n = 1;
    if (uhr.current) clearInterval(uhr.current);
    uhr.current = window.setInterval(() => {
      n++;
      setBrennt(Math.min(n, HUEGEL));
      setLaeufer(Math.min(1, n * 0.012));
      if (n >= HUEGEL + 6) { clearInterval(uhr.current!); setLaeuft(false); }
    }, 450);
  };
  const minuten = Math.max(0, brennt - 1) * 10;
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 700 170" className="w-full rounded-2xl" style={{ background: "linear-gradient(#0b1026, #27315c)" }} role="img" aria-label="Feuerkette über sieben Berge">
        {Array.from({ length: HUEGEL }, (_, i) => {
          const x = 50 + i * 100;
          return (
            <g key={i}>
              <path d={`M ${x - 60} 170 Q ${x} ${70 + (i % 2) * 15} ${x + 60} 170 Z`} fill="#141b33" />
              {i < brennt && (
                <g transform={`translate(${x} ${76 + (i % 2) * 15})`}>
                  <circle r="26" fill="#f97316" opacity="0.25" />
                  <path d="M 0 -18 C 9 -6 10 2 0 8 C -10 2 -9 -6 0 -18 Z" fill="#fbbf24" />
                  <path d="M 0 -9 C 4 -3 4 2 0 5 C -4 2 -4 -3 0 -9 Z" fill="#fff7ed" />
                </g>
              )}
            </g>
          );
        })}
        <text x="18" y="22" fill="#cbd5e1" fontSize="13">Troja</text>
        <text x="682" y="22" fill="#cbd5e1" fontSize="13" textAnchor="end">Argos (~600 km)</text>
        <text x={20 + laeufer * 640} y="160" fontSize="20">🏃</text>
      </svg>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className="btn-primary" onClick={start} disabled={laeuft}>🔥 Troja ist gefallen — Feuer!</button>
        <span>🔥 Feuer: <b>{brennt >= HUEGEL ? `nach etwa ${minuten} Minuten in Argos` : `${minuten} Minuten`}</b></span>
        <span>🏃 Läufer: <b>{laeufer > 0 ? "erst ein paar Kilometer weit … er braucht gut zwei Wochen" : "wartet"}</b></span>
      </div>
      <p className="text-xs text-muted">Die Feuer gewinnen haushoch. Aber sie können nur sagen, was vorher abgemacht war — der Läufer bringt den ganzen Bericht.</p>
    </div>
  );
}
