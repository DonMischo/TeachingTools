"use client";
/** Mitmach-Demos mit Strom: Morsetaste, Fax, Wählscheibe, Plattenspieler */
import { useEffect, useRef, useState } from "react";
import { MORSE, ausMorse, ausLauflaengen, lauflaengen, zeichenAusDauer, zuMorse } from "@/lib/medien/codes";
import TOENE from "@/lib/medien/toene.json";
import { useMedienLiveKontext } from "@/lib/medien/live";
import { useErprobt } from "@/lib/medien/erprobt";
import { SendenLeiste } from "./Live";
import { dauerton, klingeln, ton } from "./ton";

// ── Morsetaste ──
const PUNKT = 0.09;
function spieleMorse(code: string) {
  let t = 0;
  for (const z of code) {
    if (z === ".") { ton(650, PUNKT, t); t += PUNKT * 2; }
    else if (z === "-") { ton(650, PUNKT * 3, t); t += PUNKT * 4; }
    else t += PUNKT * 2;
  }
}

export function MorseDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const [zeichen, setZeichen] = useState("");
  const [text, setText] = useState("");
  const erprobt = useErprobt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (text.includes("SOS")) erprobt("morse"); }, [text]);
  const [gedrueckt, setGedrueckt] = useState(false);
  const [tabelle, setTabelle] = useState(false);
  const seit = useRef(0), stopp = useRef<() => void>(() => {}), pause = useRef<number | null>(null);
  const buchstabe = useRef("");

  const ende = () => {
    if (buchstabe.current) { const b = ausMorse(buchstabe.current); setText(t => t + b); }
    buchstabe.current = ""; setZeichen("");
  };
  const runter = (e: React.PointerEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (gedrueckt) return;
    if (pause.current) clearTimeout(pause.current);
    seit.current = performance.now(); setGedrueckt(true); stopp.current = dauerton();
  };
  const hoch = () => {
    if (!gedrueckt) return;
    setGedrueckt(false); stopp.current();
    buchstabe.current += zeichenAusDauer(performance.now() - seit.current);
    setZeichen(buchstabe.current);
    pause.current = window.setTimeout(ende, 700);
  };
  useEffect(() => () => { if (pause.current) clearTimeout(pause.current); stopp.current(); }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <button
          onPointerDown={runter} onPointerUp={hoch} onPointerLeave={hoch}
          onKeyDown={e => { if (e.key === " " || e.key === "Enter") runter(e); }} onKeyUp={e => { if (e.key === " " || e.key === "Enter") hoch(); }}
          className={`w-40 h-28 rounded-2xl shrink-0 font-black text-white shadow-lg transition-transform select-none touch-none ${gedrueckt ? "translate-y-1 shadow-sm" : ""}`}
          style={{ background: gedrueckt ? "#92400e" : "linear-gradient(#b45309, #78350f)" }} aria-label="Morsetaste (gedrückt halten)">
          {gedrueckt ? "piiiep" : "TASTE"}
          <div className="text-[11px] font-normal opacity-80">kurz = · &nbsp; lang = −</div>
        </button>
        <div className="flex-1 flex flex-col gap-1 w-full">
          <div className="font-mono text-2xl min-h-9 tracking-widest">{zeichen.replace(/\./g, "·").replace(/-/g, "−") || <span className="text-muted text-base">tippen …</span>}</div>
          <div className="rounded-lg p-2 font-mono text-xl min-h-11 bg-surface-hover" aria-live="polite">{text || <span className="text-muted text-sm">Hier erscheint der Text. Versuch mal SOS: · · · − − − · · ·</span>}</div>
          <div className="flex gap-2 text-xs">
            <button className="underline text-muted" onClick={() => setText("")}>löschen</button>
            <button className="underline text-muted" onClick={() => setTabelle(t => !t)}>{tabelle ? "Tabelle zu" : "Morse-Tabelle"}</button>
            <button className="underline text-muted" onClick={() => spieleMorse(zuMorse("SOS"))}>SOS anhören</button>
          </div>
        </div>
      </div>
      {text.includes("SOS") && <p className="text-ok font-bold">🚢 SOS empfangen! Seit 1906 der Notruf auf See — gewählt, weil er sich leicht erkennen lässt, nicht als Abkürzung.</p>}
      {tabelle && (
        <div className="grid grid-cols-4 sm:grid-cols-9 gap-1 text-xs font-mono">
          {Object.entries(MORSE).map(([k, v]) => <div key={k} className="rounded bg-surface-hover px-1.5 py-1"><b>{k}</b> {v.replace(/\./g, "·").replace(/-/g, "−")}</div>)}
        </div>
      )}
      <SendenLeiste art="morse" inhalt={() => ({ code: zuMorse(text) })} bereit={text.trim().length > 0} an={an} antwortAuf={antwortAuf} nachSenden={() => setText("")} />
      <p className="text-xs text-muted">Gedrückt halten: kurz unter ¼ Sekunde ist ein Punkt, länger ein Strich. Eine Pause beendet den Buchstaben. Auch mit der Leertaste. Verschickt wird nur der Code — entschlüsseln muss der Empfänger.</p>
    </div>
  );
}

// ── Fax: Zeile für Zeile ──
const N = 12;
const SMILEY = [
  "000011110000", "001100001100", "010000000010", "010011001010", "100011001001", "100000000001",
  "100000000001", "101000000101", "010110011010", "010001100010", "001100001100", "000011110000",
].map(z => [...z].map(Number) as (0 | 1)[]);

export function FaxDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const [bild, setBild] = useState(SMILEY);
  const erprobt = useErprobt();
  const [zeile, setZeile] = useState(-1);
  const uhr = useRef<number | null>(null);
  useEffect(() => () => { if (uhr.current) clearInterval(uhr.current); }, []);
  const kippe = (y: number, x: number) => { if (zeile < 0 || zeile >= N) setBild(b => b.map((r, i) => (i === y ? r.map((p, j) => (j === x ? ((1 - p) as 0 | 1) : p)) : r))); };
  const sende = () => {
    erprobt("fax");
    let z = 0; setZeile(0);
    if (uhr.current) clearInterval(uhr.current);
    uhr.current = window.setInterval(() => { z++; setZeile(z); ton(1400 + (z % 2) * 400, 0.12, 0, "square", 0.04); if (z >= N) clearInterval(uhr.current!); }, 380);
  };
  const codes = bild.map(lauflaengen);
  const zahlen = codes.reduce((s, c) => s + c.length, 0);
  const zelle = (p: 0 | 1, an: boolean) => `w-4 h-4 sm:w-5 sm:h-5 ${p ? "bg-fg" : "bg-surface"} ${an ? "ring-2 ring-accent" : ""}`;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <div className="text-xs text-muted mb-1">📄 Sender — klick Kästchen an</div>
          <div className="inline-grid border border-line" style={{ gridTemplateColumns: `repeat(${N}, auto)` }}>
            {bild.map((r, y) => r.map((p, x) => <button key={`${y}-${x}`} aria-label={`Zeile ${y + 1} Spalte ${x + 1}`} onClick={() => kippe(y, x)} className={zelle(p, y === zeile)} />))}
          </div>
        </div>
        <div className="text-xs font-mono flex flex-col gap-0.5 pt-5">
          <div className="text-muted font-sans">〰️ Leitung: Längen von weiß, schwarz, weiß …</div>
          {codes.map((c, y) => <div key={y} className={y < zeile ? "" : "opacity-25"}>{c.join(" ")}</div>)}
        </div>
        <div>
          <div className="text-xs text-muted mb-1">🖨️ Empfänger</div>
          <div className="inline-grid border border-line" style={{ gridTemplateColumns: `repeat(${N}, auto)` }}>
            {codes.map((c, y) => ausLauflaengen(c).map((p, x) => <div key={`${y}-${x}`} className={zelle(y < zeile ? p : 0, false)} />))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button className="btn-primary" onClick={sende} disabled={zeile >= 0 && zeile < N}>📠 Faxen</button>
        <button className="btn-secondary" onClick={() => { setBild(Array.from({ length: N }, () => Array(N).fill(0))); setZeile(-1); }}>Leeres Blatt</button>
        <span className="text-muted">{N * N} Kästchen, gesendet als {zahlen} Zahlen — gleiche Farben am Stück zu zählen spart Platz.</span>
      </div>
      <SendenLeiste art="fax" inhalt={() => ({ zeilen: codes })} bereit={bild.some(r => r.some(Boolean))} an={an} antwortAuf={antwortAuf} />
    </div>
  );
}

// ── Wählscheibe ──
const ZIFFERN = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
export function WaehlscheibeDemo({ an, antwortAuf }: { an?: string; antwortAuf?: string } = {}) {
  const live = useMedienLiveKontext();
  const [sagen, setSagen] = useState("");
  const erprobt = useErprobt();
  const [nummer, setNummer] = useState("");
  const [dreh, setDreh] = useState(0);
  const [rueck, setRueck] = useState(0.1);
  const [aktiv, setAktiv] = useState(false);
  const [zeit, setZeit] = useState(0);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const scheibe = useRef<SVGSVGElement>(null);
  /** Gerade gezogen: welches Loch, wie weit (Grad), letzter Mauswinkel */
  const zug = useRef<{ i: number; z: string; grad: number; winkel: number; seit: number } | null>(null);
  // Loch i liegt bei 30° − i·30° (im Uhrzeigersinn ab 3 Uhr), der Anschlag bei 60°: bis dahin sind es (i+1)·30°
  const bisAnschlag = (i: number) => (i + 1) * 30;
  const mausWinkel = (e: React.PointerEvent) => {
    const r = scheibe.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const greifen = (e: React.PointerEvent, z: string, i: number) => {
    if (aktiv || nummer.length >= 12) return;
    e.preventDefault();
    scheibe.current?.setPointerCapture(e.pointerId);
    zug.current = { i, z, grad: 0, winkel: mausWinkel(e), seit: performance.now() };
    setRueck(0); setHinweis(null);
  };
  const ziehen = (e: React.PointerEvent) => {
    const g = zug.current;
    if (!g) return;
    const w = mausWinkel(e);
    let d = w - g.winkel;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    g.winkel = w;
    // Nur im Uhrzeigersinn, und am Anschlag ist Schluss
    g.grad = Math.max(0, Math.min(bisAnschlag(g.i), g.grad + d));
    setDreh(g.grad);
  };
  const loslassen = () => {
    const g = zug.current;
    if (!g) return;
    zug.current = null;
    if (g.grad < bisAnschlag(g.i) - 4) {
      // Nicht bis zum Anschlag: die Scheibe läuft zurück, gewählt ist nichts
      setRueck(Math.max(0.15, g.grad / 300)); setDreh(0);
      setHinweis("Nicht bis zum Anschlag gedreht — nichts gewählt. Zieh das Loch bis zum Metallbügel.");
      return;
    }
    waehle(g.z, g.i, (performance.now() - g.seit) / 1000);
  };
  const waehle = (z: string, i: number, hinDauer: number) => {
    setAktiv(true);
    const zurueck = (i + 1) * 0.1; // ein Impuls je 0,1 s
    {
      setRueck(zurueck); setDreh(0);
      for (let k = 0; k <= i; k++) ton(420, 0.03, k * 0.1, "square", 0.05);
      window.setTimeout(() => {
        setNummer(n => {
          const neu = n + z;
          // In einer Sitzung: nach vier Ziffern klingelt es — oder die Ansage kommt
          if (live && !an && neu.length === 4) {
            if (live.spieler.some(s => s.nummer === neu)) klingeln(0.3);
            else { ton(950, 0.33, 0.3); ton(1400, 0.33, 0.63); ton(1800, 0.33, 0.96); }
          }
          return neu;
        });
        setZeit(t => t + hinDauer + zurueck); setAktiv(false);
        if (nummer.length + 1 >= 4) erprobt("waehlscheibe");
      }, zurueck * 1000);
    }
  };
  const lage = (grad: number, r: number) => ({ x: Math.cos((grad * Math.PI) / 180) * r, y: Math.sin((grad * Math.PI) / 180) * r });
  const stopp = lage(60, 72);
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <svg ref={scheibe} viewBox="-110 -110 220 220" className="w-56 shrink-0 select-none touch-none" role="img" aria-label="Wählscheibe"
        onPointerMove={ziehen} onPointerUp={loslassen} onPointerCancel={loslassen}>
        <circle r="104" fill="#111827" />
        <g style={{ transform: `rotate(${dreh}deg)`, transition: zug.current ? "none" : `transform ${rueck}s linear` }}>
          <circle r="98" fill="#1f2937" />
          {ZIFFERN.map((z, i) => {
            const { x, y } = lage(30 - i * 30, 72);
            return (
              <g key={z} onPointerDown={e => greifen(e, z, i)} className="cursor-grab" role="button" aria-label={`Ziffer ${z}`}
                tabIndex={0} onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && !aktiv && nummer.length < 12) { e.preventDefault(); setDreh(bisAnschlag(i)); window.setTimeout(() => waehle(z, i, 0.4), 350); } }}>
                <circle cx={x} cy={y} r="16" fill="#f9fafb" stroke="#9ca3af" />
                <text x={x} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="bold" fill="#111827">{z}</text>
              </g>
            );
          })}
        </g>
        <circle r="38" fill="#e5e7eb" />
        <text y="5" textAnchor="middle" fontSize="11" fill="#374151">{nummer.slice(-8) || "Amt"}</text>
        <path d={`M ${stopp.x * 1.35} ${stopp.y * 1.35} L ${stopp.x * 1.05} ${stopp.y * 1.05}`} stroke="#d1d5db" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className="flex flex-col gap-2 text-sm">
        <p>Finger ins Loch der Ziffer und im Uhrzeigersinn bis zum Metallbügel ziehen, dann loslassen. Beim Zurücklaufen klickt die Scheibe — einmal für die 1, zehnmal für die 0. Diese Klicks sind die Signale für die Vermittlung.</p>
        {hinweis && <p className="text-bad text-xs">{hinweis}</p>}
        <p className="text-2xl font-mono font-black">{nummer || "—"}</p>
        <p className="text-muted">Wählzeit: {zeit.toFixed(1)} s{nummer.endsWith("0") && nummer.length > 3 ? " — Nullen sind am langsamsten. Telefonnummern mit vielen Nullen waren unbeliebt!" : ""}</p>
        <button className="btn-secondary self-start" onClick={() => { setNummer(""); setZeit(0); setSagen(""); }}>Auflegen</button>
        {live && <Anruf live={live} nummer={nummer} an={an} antwortAuf={antwortAuf} sagen={sagen} setSagen={setSagen} />}
        <p className="text-xs text-muted">Wer sich verwählt hatte, musste auflegen und neu anfangen. Rückgängig gab es nicht.</p>
      </div>
    </div>
  );
}

/** Telefonieren in der Sitzung: Nummer wählen, dann sagen (tippen), was der andere hören soll */
function Anruf({ live, nummer, an, antwortAuf, sagen, setSagen }: {
  live: NonNullable<ReturnType<typeof useMedienLiveKontext>>; nummer: string; an?: string; antwortAuf?: string; sagen: string; setSagen: (s: string) => void;
}) {
  const ziel = an ? live.spieler.find(s => s.key === an) : live.spieler.find(s => s.nummer === nummer);
  return (
    <div className="rounded-xl border border-line p-2 flex flex-col gap-2 text-sm bg-surface">
      <div className="text-xs">Deine Nummer: <b className="font-mono">{live.nummer ?? "…"}</b> · Telefonbuch: {live.spieler.length ? live.spieler.map(s => `${s.name} ${s.nummer}`).join(", ") : "noch niemand da"}</div>
      {ziel ? (
        <>
          <p className="font-bold">{an ? `Rückruf an ${ziel.name}` : `Es klingelt bei ${ziel.name} …`} Was sagst du?</p>
          <input className="input" value={sagen} maxLength={200} onChange={e => setSagen(e.target.value)} placeholder="Hallo, hier ist …" aria-label="Was du sagst" />
          <SendenLeiste art="telefon" inhalt={() => ({ text: sagen })} bereit={sagen.trim().length > 0} an={ziel.key} antwortAuf={antwortAuf} nachSenden={() => setSagen("")} />
        </>
      ) : nummer.length >= 4 ? <p className="text-bad font-bold">»Kein Anschluss unter dieser Nummer.« Auflegen und neu wählen.</p>
        : <p className="text-xs text-muted">Wähl die Nummer von jemandem aus dem Telefonbuch.</p>}
    </div>
  );
}

// ── Plattenspieler ──
/** »Alle meine Entchen« (Volkslied) in Halbtönen über C */
const LIED: [number, number][] = [[0, 1], [2, 1], [4, 1], [5, 1], [7, 2], [7, 2], [9, 1], [9, 1], [9, 1], [9, 1], [7, 4], [9, 1], [9, 1], [9, 1], [9, 1], [7, 4], [5, 1], [5, 1], [5, 1], [5, 1], [4, 2], [4, 2], [2, 1], [2, 1], [2, 1], [2, 1], [0, 4]];
const DREHZAHLEN = [{ rpm: 33, text: "33⅓ — LP" }, { rpm: 45, text: "45 — Single" }, { rpm: 78, text: "78 — Schellack" }] as const;

export function PlatteDemo() {
  const [rpm, setRpm] = useState<number>(45);
  const [spielt, setSpielt] = useState(false);
  const [echt, setEcht] = useState(false);
  const erprobt = useErprobt();
  const platte = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => platte.current?.pause(), []);
  /** Echte Schellackplatte von 1904, aufgenommen mit 78 Umdrehungen — falsche Drehzahl = falsche Tonhöhe */
  const schellack = () => {
    if (echt) { platte.current?.pause(); setEcht(false); setSpielt(false); return; }
    const a = platte.current ?? new Audio(TOENE.schellack.datei);
    platte.current = a;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    a.playbackRate = (rpm === 33 ? 33.33 : rpm) / 78;
    a.currentTime = 0;
    a.onended = () => { setEcht(false); setSpielt(false); };
    void a.play().then(() => { setEcht(true); setSpielt(true); if (rpm === 78) erprobt("platte"); }).catch(() => {});
  };
  useEffect(() => { if (platte.current) platte.current.playbackRate = (rpm === 33 ? 33.33 : rpm) / 78; }, [rpm]);
  const spiele = () => {
    const faktor = rpm / 45;
    const schlag = 0.28 / faktor;
    let t = 0;
    for (const [halbton, laenge] of LIED) {
      ton(262 * 2 ** (halbton / 12) * faktor, schlag * laenge * 0.9, t, "triangle", 0.12);
      t += schlag * laenge;
    }
    setSpielt(true);
    window.setTimeout(() => setSpielt(false), t * 1000);
  };
  const dauer = 60 / (rpm === 33 ? 33.33 : rpm);
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <svg viewBox="-100 -100 200 200" className="w-52 shrink-0" role="img" aria-label="Schallplatte">
        <rect x="-100" y="-100" width="200" height="200" rx="14" fill="#78350f" />
        <g style={{ animation: spielt ? `medienDrehen ${dauer}s linear infinite` : "none" }}>
          <circle r="86" fill="#111" />
          {[80, 72, 64, 56, 48, 40].map(r => <circle key={r} r={r} fill="none" stroke="#2a2a2a" strokeWidth="1.2" />)}
          <circle r="28" fill="#dc2626" />
          <text y="-8" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">ALLE MEINE</text>
          <text y="4" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">ENTCHEN</text>
          <circle r="2.5" fill="#e5e7eb" />
        </g>
        <path d={`M 85 -85 L 70 ${spielt ? 10 : -40} L 50 ${spielt ? 22 : -30}`} fill="none" stroke="#d1d5db" strokeWidth="5" strokeLinecap="round" style={{ transition: "all .4s" }} />
      </svg>
      <style>{`@keyframes medienDrehen { to { transform: rotate(360deg) } }`}</style>
      <div className="flex flex-col gap-2 text-sm">
        <p>Aufgenommen wurde mit 45 Umdrehungen pro Minute. Was passiert, wenn du die falsche Geschwindigkeit wählst?</p>
        <div className="flex flex-wrap gap-2">
          {DREHZAHLEN.map(d => <button key={d.rpm} className={`chip ${rpm === d.rpm ? "chip-on" : ""}`} onClick={() => setRpm(d.rpm)}>{d.text}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={spiele} disabled={spielt}>▶ Nadel auflegen</button>
          <button className="btn-secondary" onClick={schellack} disabled={spielt && !echt}>{echt ? "⏹ Stopp" : "🎙️ Echte Platte von 1904 (78er)"}</button>
        </div>
        <p className="font-bold">{echt
          ? (rpm === 78 ? "Richtig: 78 Umdrehungen — so klang es 1904. Das Knistern ist echt." : "Falsche Drehzahl! Die Sänger klingen wie Brummbären — die Platte will 78.")
          : rpm === 45 ? "Genau richtig." : rpm > 45 ? "Mickymaus-Stimme! Zu schnell = zu hoch." : "Brummbär! Zu langsam = zu tief."}</p>
        <p className="text-xs text-muted">Die Information steckt in der Rille: Wie sie wackelt, so wackelt die Nadel, so schwingt die Luft. Das Tempo des Abspielens muss zum Tempo der Aufnahme passen.</p>
        <p className="text-[11px] text-muted">Aufnahme: <a className="underline" href={TOENE.schellack.quelle} target="_blank" rel="noreferrer">»Marching Through Georgia«</a>, gesungen von {TOENE.schellack.urheber} (1904), gemeinfrei.</p>
      </div>
    </div>
  );
}
