"use client";
/** Mitmach-Demos der frühen Medien: Keilschrift, Hieroglyphen, Quipu, Leuchtfeuer */
import { useEffect, useRef, useState } from "react";
import { inHieroglyphen, quipuWert } from "@/lib/medien/codes";
import { rauschen } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";
import { Zeichenflaeche, papyrus, type ZeichenGriff } from "./Zeichnen";

// ── Keilschrift: Griffel in Ton drücken ──
const KEILE = [
  { id: "rechts", label: "▶ waagerecht", drehung: 0 },
  { id: "unten", label: "▼ senkrecht", drehung: 90 },
  { id: "schraeg", label: "◢ schräg", drehung: 45 },
  { id: "winkel", label: "◀ Winkelhaken", drehung: 180 },
] as const;

/** Mitte der Schreibzeilen auf der Tafel */
const ZEILEN = [40, 90, 140];

export function KeilschriftDemo() {
  const [art, setArt] = useState<(typeof KEILE)[number]["id"]>("rechts");
  const [keile, setKeile] = useState<{ x: number; y: number; d: number }[]>([]);
  const [gebrannt, setGebrannt] = useState(false);
  const erprobt = useErprobt();
  const druecke = (e: React.MouseEvent<SVGSVGElement>) => {
    if (gebrannt) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 320, y = ((e.clientY - r.top) / r.height) * 200;
    // Schreiber ritzten erst Linien in den Ton und schrieben darauf — der Keil rastet auf der nächsten Zeile ein
    const zeile = ZEILEN.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
    setKeile(k => [...k, { x, y: zeile, d: KEILE.find(w => w.id === art)!.drehung }]);
  };
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <svg viewBox="0 0 320 200" className="w-full max-w-md rounded-2xl cursor-crosshair shadow-inner" onClick={druecke} role="img" aria-label="Tontafel">
        <defs>
          <radialGradient id="ton" cx="45%" cy="40%" r="75%"><stop offset="0" stopColor={gebrannt ? "#c2703d" : "#c9a27a"} /><stop offset="1" stopColor={gebrannt ? "#8a4a22" : "#9c7650"} /></radialGradient>
        </defs>
        <rect x="4" y="4" width="312" height="192" rx="26" fill="url(#ton)" />
        {/* Zeilenbänder: oben und unten eine geritzte Linie, die Keile stehen dazwischen */}
        {ZEILEN.flatMap(z => [z - 14, z + 26]).map((y, i) => <line key={i} x1="22" x2="298" y1={y} y2={y} stroke="#5b3d22" strokeWidth="0.8" opacity="0.35" />)}
        {keile.map((k, i) => (
          <g key={i} transform={`translate(${k.x} ${k.y}) rotate(${k.d})`}>
            <path d="M -9 -7 L 3 0 L -9 7 Z" fill="#5b3d22" opacity="0.85" />
            <line x1="3" y1="0" x2="22" y2="0" stroke="#5b3d22" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
          </g>
        ))}
        {!keile.length && <text x="160" y="118" textAnchor="middle" fontSize="13" fill="#5b3d22">Klick in den Ton: Griffel eindrücken</text>}
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <span className="label">Griffel halten:</span>
        {KEILE.map(k => <button key={k.id} className={`chip ${art === k.id ? "chip-on" : ""}`} onClick={() => setArt(k.id)}>{k.label}</button>)}
        <button className="btn-secondary" disabled={gebrannt} onClick={() => setKeile([])}>🤚 Glattstreichen</button>
        <button className="btn-secondary" disabled={!keile.length || gebrannt} onClick={() => { setGebrannt(true); if (keile.length >= 8) erprobt("keilschrift"); }}>🔥 Im Ofen brennen</button>
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
      {zeichen.length > 0 && <SelbstSchreiben key={name} zeichen={zeichen} />}
    </div>
  );
}

/**
 * Wie ein Schreiber üben: jedes Zeichen des eigenen Namens mit dem Pinsel
 * nachmalen. Bewertet wird, wie viel der Vorlage bedeckt ist und wie viel
 * daneben geht. Am Ende steht der Name aus den eigenen Zeichen in der Kartusche.
 */
/**
 * Genauigkeitspunkte (0–100): wie viel vom Umriss der Vorlage nachgefahren ist,
 * mal wie viel der eigenen Striche beim Zeichen liegt. Etwas Spielraum für die Maus:
 * 90 % Umriss zählen voll, die ersten 5 % daneben kosten nichts.
 * Alles vollkritzeln bringt trotzdem nichts.
 */
export function genauigkeit(abgedeckt: number, daneben: number): number {
  const getroffen = Math.min(1, Math.max(0, abgedeckt) / 0.9);
  const abzug = Math.min(1, Math.max(0, daneben - 0.05) / 0.95);
  return Math.round(100 * getroffen * (1 - abzug));
}
function Balken({ name, wert, farbe }: { name: string; wert: number; farbe: string }) {
  const prozent = Math.round(wert * 100);
  return (
    <div className="text-xs">
      <div className="flex justify-between"><span>{name}</span><b>{prozent} %</b></div>
      <div className="h-2 rounded-full bg-surface-hover overflow-hidden"><div className="h-full rounded-full" style={{ width: `${prozent}%`, background: farbe }} /></div>
    </div>
  );
}
const sterne = (p: number) => (p >= 80 ? "⭐⭐⭐" : p >= 50 ? "⭐⭐" : "⭐");

function SelbstSchreiben({ zeichen }: { zeichen: ReturnType<typeof inHieroglyphen> }) {
  const [nr, setNr] = useState(0);
  const [bilder, setBilder] = useState<(string | null)[]>(() => zeichen.map(() => null));
  /** Bestwert je Zeichen */
  const [punkte, setPunkte] = useState<(number | null)[]>(() => zeichen.map(() => null));
  const [urteil, setUrteil] = useState<{ abgedeckt: number; daneben: number; punkte: number } | null>(null);
  const [leer, setLeer] = useState(false);
  const flaeche = useRef<ZeichenGriff>(null);
  const erprobt = useErprobt();
  const g = zeichen[nr];
  const fertig = () => {
    const f = flaeche.current;
    if (!f || f.leer()) { setLeer(true); return; }
    const t = f.treffer() ?? { abgedeckt: 0, daneben: 1 };
    const p = genauigkeit(t.abgedeckt, t.daneben);
    setLeer(false);
    setUrteil({ ...t, punkte: p });
    setPunkte(alt => alt.map((x, i) => (i === nr ? Math.max(x ?? 0, p) : x)));
    if (p >= 80) erprobt("hieroglyphen");
    if (punkte.every((x, i) => i === nr || x !== null)) erprobt("kartusche");
    // Die Kartusche zeigt den besten Versuch
    if (p >= (punkte[nr] ?? -1)) setBilder(b => b.map((x, i) => (i === nr ? f.bild() : x)));
  };
  const weiter = (i: number) => { setNr(i); setUrteil(null); setLeer(false); flaeche.current?.leeren(); };
  const gemacht = punkte.filter((x): x is number => x !== null);
  const summe = gemacht.reduce((a, b) => a + b, 0);
  return (
    <div className="card p-3 flex flex-col gap-3">
      <div className="font-black">✍️ Selbst schreiben wie ein Schreiber</div>
      <div className="flex flex-wrap gap-1.5">
        {zeichen.map((z, i) => (
          <button key={i} onClick={() => weiter(i)} className={`chip ${i === nr ? "chip-on" : ""}`} title={z.name}>
            <span style={{ fontFamily: "'Segoe UI Historic', 'Noto Sans Egyptian Hieroglyphs', serif" }}>{z.zeichen}</span> {z.laut}{punkte[i] !== null ? ` · ${punkte[i]}` : ""}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="w-full max-w-xs">
          <Zeichenflaeche ref={flaeche} breite={260} hoehe={260} untergrund={papyrus} vorlage={g.zeichen} label={`Hieroglyphe ${g.name} nachmalen`}
            farben={[{ name: "Ruß-Tinte", wert: "#1c1917" }, { name: "Rote Tinte (Ocker)", wert: "#b91c1c" }]} />
        </div>
        <div className="flex flex-col gap-2 text-sm flex-1">
          <p>Mal das Zeichen <b>{g.laut}</b> ({g.name}) mit dem Binsenpinsel nach. Schwarz war Ruß, Rot zeigte Überschriften und Anfänge.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={fertig}>Fertig</button>
            <button className="btn-secondary" onClick={() => { flaeche.current?.leeren(); setUrteil(null); setLeer(false); }}>Abwaschen</button>
            {nr < zeichen.length - 1 && <button className="btn-secondary" onClick={() => weiter(nr + 1)}>Nächstes Zeichen ›</button>}
          </div>
          {leer && <p className="text-bad text-xs">Erst malen — der Pinsel liegt bereit.</p>}
          {urteil && (
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <Balken name="Umriss getroffen" wert={urteil.abgedeckt} farbe="var(--color-ok)" />
              <Balken name="Daneben gemalt" wert={urteil.daneben} farbe="var(--color-bad)" />
              <p className="font-black text-lg">{sterne(urteil.punkte)} {urteil.punkte} Genauigkeitspunkte</p>
              <p className="text-xs text-muted">
                {urteil.punkte >= 80 ? "Der Pharao wäre zufrieden!" : urteil.punkte >= 50 ? "Ein ordentlicher Schreiberlehrling."
                  : urteil.abgedeckt < 0.4 ? "Zu wenig von der Vorlage erwischt — mal die Linien ganz nach." : "Zu viel daneben — langsamer und genauer malen."}
                {" "}Es reicht, den Umriss nachzufahren. 90 % getroffen zählen voll, ein kleines bisschen daneben ist erlaubt. ⭐⭐⭐ ab 80. Bestwert zählt.
              </p>
            </div>
          )}
        </div>
      </div>
      {bilder.some(Boolean) && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Deine Kartusche — mit deinen eigenen Zeichen · <b>{summe} von {zeichen.length * 100} Genauigkeitspunkten</b>{gemacht.length === zeichen.length ? ` (${sterne(Math.round(summe / zeichen.length))} im Schnitt ${Math.round(summe / zeichen.length)})` : ` · noch ${zeichen.length - gemacht.length} Zeichen`}</span>
          <div className="self-start flex items-center gap-1 rounded-full border-4 px-4 py-2" style={{ borderColor: "#7c5a1e", background: "#f3e3b5" }}>
            {bilder.map((b, i) => b
              ? <img key={i} src={b} alt={zeichen[i].laut} className="w-12 h-12 rounded" />
              : <span key={i} className="w-12 h-12 grid place-items-center text-3xl opacity-30" style={{ fontFamily: "'Segoe UI Historic', 'Noto Sans Egyptian Hieroglyphs', serif" }}>{zeichen[i].zeichen}</span>)}
            <span className="w-1.5 h-12 rounded" style={{ background: "#7c5a1e" }} />
          </div>
        </div>
      )}
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
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (geschafft) erprobt("quipu"); }, [geschafft]);
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
const STRECKE = 600; // km Troja → Argos
const MIN_JE_FEUER = 10; // bis der nächste Wächter das Feuer sieht und anzündet
const KMH = 10; // ein guter Läufer auf Dauer
const ENDE_MIN = (HUEGEL - 1) * MIN_JE_FEUER + 10;
const SEK_ECHT = 6; // so lange dauert die Vorführung

export function LeuchtfeuerDemo() {
  const [minuten, setMinuten] = useState(-1);
  const erprobt = useErprobt();
  const bild = useRef<number | null>(null);
  useEffect(() => () => { if (bild.current) cancelAnimationFrame(bild.current); }, []);
  const start = () => {
    if (bild.current) cancelAnimationFrame(bild.current);
    // Jedes Feuer knistert kurz auf, wenn es angezündet wird
    for (let i = 0; i < HUEGEL; i++) rauschen(0.5, (i * MIN_JE_FEUER / ENDE_MIN) * SEK_ECHT, 0.05, { freq: 2500, q: 0.6 });
    const t0 = performance.now();
    const schritt = (t: number) => {
      const min = Math.min(ENDE_MIN, ((t - t0) / 1000 / SEK_ECHT) * ENDE_MIN);
      setMinuten(min);
      if (min >= ENDE_MIN) erprobt("leuchtfeuer");
      if (min < ENDE_MIN) bild.current = requestAnimationFrame(schritt);
    };
    bild.current = requestAnimationFrame(schritt);
  };
  const laeuft = minuten >= 0 && minuten < ENDE_MIN;
  const brennt = minuten < 0 ? 0 : Math.min(HUEGEL, Math.floor(minuten / MIN_JE_FEUER) + 1);
  const angekommen = brennt >= HUEGEL;
  const km = Math.max(0, minuten) / 60 * KMH;
  const x = 24 + (km / STRECKE) * 640;
  return (
    <div className="flex flex-col gap-3">
      <svg viewBox="0 0 700 170" className="w-full rounded-2xl" style={{ background: "linear-gradient(#0b1026, #27315c)" }} role="img" aria-label="Feuerkette über sieben Berge">
        {Array.from({ length: HUEGEL }, (_, i) => {
          const hx = 50 + i * 100;
          return (
            <g key={i}>
              <path d={`M ${hx - 60} 170 Q ${hx} ${70 + (i % 2) * 15} ${hx + 60} 170 Z`} fill="#141b33" />
              {i < brennt && (
                <g transform={`translate(${hx} ${76 + (i % 2) * 15})`}>
                  <circle r="26" fill="#f97316" opacity="0.25" />
                  <path d="M 0 -18 C 9 -6 10 2 0 8 C -10 2 -9 -6 0 -18 Z" fill="#fbbf24" />
                  <path d="M 0 -9 C 4 -3 4 2 0 5 C -4 2 -4 -3 0 -9 Z" fill="#fff7ed" />
                </g>
              )}
            </g>
          );
        })}
        <text x="18" y="22" fill="#cbd5e1" fontSize="13">Troja</text>
        <text x="682" y="22" fill="#cbd5e1" fontSize="13" textAnchor="end">Argos (~{STRECKE} km)</text>
        {/* Das Emoji schaut nach links — gespiegelt läuft es Richtung Argos */}
        <text x={-x} y="160" fontSize="20" transform="scale(-1 1)" textAnchor="end">🏃</text>
      </svg>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className="btn-primary" onClick={start} disabled={laeuft}>🔥 Troja ist gefallen — Feuer!</button>
        <span>⏱️ <b>{Math.round(Math.max(0, minuten))} Minuten</b></span>
        <span>🔥 Feuer: <b>{angekommen ? `nach ${(HUEGEL - 1) * MIN_JE_FEUER} Minuten in Argos` : minuten < 0 ? "wartet" : `Berg ${brennt} von ${HUEGEL}`}</b></span>
        <span>🏃 Läufer: <b>{minuten < 0 ? "wartet" : `${km.toLocaleString("de-DE", { maximumFractionDigits: 1 })} km${angekommen ? ` — für ${STRECKE} km braucht er mit Pausen gut eine Woche` : ""}`}</b></span>
      </div>
      <p className="text-xs text-muted">Die Feuer gewinnen haushoch. Aber sie können nur sagen, was vorher abgemacht war — der Läufer bringt den ganzen Bericht.</p>
    </div>
  );
}
