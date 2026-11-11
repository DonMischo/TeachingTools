"use client";
/**
 * Bandschnitt: Rundfunk-Redakteure schnitten Tonband wirklich mit der Schere
 * und klebten es mit Klebeband. Wörter ausschneiden, umsortieren, verkleben.
 */
import { useEffect, useRef, useState } from "react";
import { rauschen } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

export type Segment = { id: number; wort: string; gekl: boolean };

/** Sauber = die Wörter ergeben genau den Zielsatz und jede Klebestelle hält */
export function istSauber(segmente: { wort: string; gekl: boolean }[], ziel: string[]): boolean {
  return segmente.length === ziel.length && segmente.every((s, i) => s.wort === ziel[i] && s.gekl);
}

const STUFEN: { titel: string; band: string; ziel: string }[] = [
  { titel: "Nachrichten", band: "Das ähm Radio bringt äh die Nachrichten *hust* in jedes jedes Wohnzimmer.", ziel: "Das Radio bringt die Nachrichten in jedes Wohnzimmer." },
  { titel: "Kabelsalat", band: "Der schneidet Techniker das Band äh mit der Schere.", ziel: "Der Techniker schneidet das Band mit der Schere." },
  { titel: "Hörspiel", band: "Heute Abend senden wir ähm ein ein *hust* Hörspiel über äh Piraten.", ziel: "Heute Abend senden wir ein Hörspiel über Piraten." },
];

const woerter = (text: string) => text.split(" ");
const bauen = (text: string): Segment[] => woerter(text).map((wort, id) => ({ id, wort, gekl: true }));
const FUELL = (w: string) => /^(ähm|äh)$/i.test(w) || w.startsWith("*");
const SCHRITT_MS = 700;

function welle(wort: string): number[] {
  let h = 7;
  for (const c of wort) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return Array.from({ length: 8 }, (_, i) => 4 + ((h * (i + 3) * 17) % 19));
}

function Spule({ x, laeuft }: { x: number; laeuft: boolean }) {
  return (
    <g transform={`translate(${x} 40)`}>
      <g className={laeuft ? "animate-spin" : ""} style={{ transformBox: "fill-box", transformOrigin: "center", animationDuration: "1.2s" }}>
        <circle r="30" fill="#4b3b2a" stroke="#222" strokeWidth="2" />
        <circle r="10" fill="#ddd" stroke="#222" />
        {[0, 120, 240].map(a => <line key={a} x1="0" y1="0" x2="0" y2="-26" stroke="#ddd" strokeWidth="5" transform={`rotate(${a})`} />)}
      </g>
    </g>
  );
}

export function TonbandDemo() {
  const erprobt = useErprobt();
  const [stufe, setStufe] = useState(0);
  const [band, setBand] = useState<Segment[]>(() => bauen(STUFEN[0].band));
  const [schnipsel, setSchnipsel] = useState<string[]>([]);
  const [werkzeug, setWerkzeug] = useState<"schere" | "bewegen">("schere");
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const [kopf, setKopf] = useState<number | null>(null);
  const [meldung, setMeldung] = useState("");
  const [geloest, setGeloest] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spielt = kopf !== null;
  const ziel = woerter(STUFEN[stufe].ziel);

  const stopp = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ohne Sprachausgabe */ }
    setKopf(null);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    try { window.speechSynthesis?.cancel(); } catch { /* egal */ }
  }, []);

  const neu = (s: number) => {
    stopp();
    setStufe(s); setBand(bauen(STUFEN[s].band)); setSchnipsel([]); setGewaehlt(null); setGeloest(false);
    setMeldung("");
  };

  const pruefe = (b: Segment[]) => {
    if (istSauber(b, ziel)) {
      setGeloest(true);
      erprobt("tonband");
      setMeldung("Sauber geschnitten! Spiel es zur Belohnung ab.");
    }
  };

  const schneide = (i: number) => {
    const w = band[i].wort;
    const neuBand = band.filter((_, k) => k !== i).map((s, k) => (k === i ? { ...s, gekl: false } : s));
    setBand(neuBand);
    setSchnipsel(sn => [...sn, w]);
    setMeldung(`✂️ »${w}« fällt in die Schnipsel-Kiste. Jetzt die Lücke verkleben!`);
    pruefe(neuBand);
  };

  const klick = (i: number) => {
    if (geloest || spielt) return;
    if (werkzeug === "schere") schneide(i);
    else setGewaehlt(g => (g === i ? null : i));
  };

  const kleben = (i: number) => {
    const b = band.map((s, k) => (k === i ? { ...s, gekl: true } : s));
    setBand(b);
    setMeldung("🩹 Klebt.");
    pruefe(b);
  };

  /** `luecke` = Einfügeposition vor dem Segment mit diesem Index (0..länge) */
  const verschiebe = (luecke: number) => {
    if (gewaehlt === null) return;
    const s = band[gewaehlt];
    const rest = band.filter((_, k) => k !== gewaehlt).map((x, k) => (k === gewaehlt ? { ...x, gekl: false } : x));
    const pos = luecke > gewaehlt ? luecke - 1 : luecke;
    const neuBand = [...rest.slice(0, pos), { ...s, gekl: false }, ...rest.slice(pos)].map((x, k) => (k === pos + 1 ? { ...x, gekl: false } : x));
    setBand(neuBand);
    setGewaehlt(null);
    setMeldung("Das Stück sitzt an neuer Stelle, aber nichts hält. Kleben nicht vergessen!");
    pruefe(neuBand);
  };

  const abspielen = () => {
    if (spielt) { stopp(); return; }
    setMeldung("");
    const gehe = (i: number) => {
      if (i >= band.length) {
        stopp();
        if (istSauber(band, ziel)) setMeldung("🎙️ Sendefertig: " + STUFEN[stufe].ziel);
        return;
      }
      setKopf(i);
      if (!band[i].gekl) {
        rauschen(1.2, 0, 0.12);
        setMeldung("🍝 Bandsalat! An dieser Stelle ist das Band nicht geklebt.");
        timer.current = setTimeout(stopp, 1300);
        return;
      }
      rauschen(0.15, 0, 0.04);
      try {
        const synth = window.speechSynthesis;
        if (synth && typeof SpeechSynthesisUtterance !== "undefined") {
          const u = new SpeechSynthesisUtterance(band[i].wort.startsWith("*") ? "hust" : band[i].wort);
          u.lang = "de-DE"; u.pitch = 0.8; u.rate = 0.95;
          const v = synth.getVoices?.().find(x => x.lang?.startsWith("de"));
          if (v) u.voice = v;
          synth.speak(u);
        }
      } catch { /* nur optisch */ }
      timer.current = setTimeout(() => gehe(i + 1), SCHRITT_MS);
    };
    gehe(0);
  };

  const verschieben = werkzeug === "bewegen" && gewaehlt !== null;
  const luecke = (i: number, s?: Segment) => {
    if (verschieben && gewaehlt !== i && gewaehlt + 1 !== i)
      return <button className="chip mx-0.5 self-center" onClick={() => verschiebe(i)} aria-label="Hierher">⇥</button>;
    if (s && !s.gekl)
      return <button className="chip mx-0.5 self-center border-dashed" onClick={() => kleben(i)} aria-label="Kleben">🩹 kleben</button>;
    return <span className="w-1" />;
  };

  return (
    <div className="card space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">✂️ Bandschnitt · Stufe {stufe + 1}/3: {STUFEN[stufe].titel}</p>
        <div className="flex gap-1">{STUFEN.map((s, i) => <button key={s.titel} className={i === stufe ? "chip chip-on" : "chip"} onClick={() => neu(i)}>{i + 1}</button>)}</div>
      </div>
      <p className="text-sm text-muted">Schneid Ähm, Äh, Husten und Wiederholungen heraus, bring die Wörter in die richtige Reihenfolge und klebe jede Lücke zu.</p>

      <svg viewBox="0 0 300 90" className="w-full max-w-md" role="img" aria-label="Tonbandgerät">
        <rect x="5" y="5" width="290" height="80" rx="8" fill="#6b6b6b" stroke="#222" strokeWidth="2" />
        <Spule x={80} laeuft={spielt} />
        <Spule x={220} laeuft={spielt} />
        <path d="M80 70 L120 82 L180 82 L220 70" fill="none" stroke="#3b2a1a" strokeWidth="3" />
        <circle cx="150" cy="82" r="3" fill="#c33" />
      </svg>

      <div className="flex flex-wrap gap-2">
        <button className={werkzeug === "schere" ? "chip chip-on" : "chip"} onClick={() => { setWerkzeug("schere"); setGewaehlt(null); }}>✂️ Schere</button>
        <button className={werkzeug === "bewegen" ? "chip chip-on" : "chip"} onClick={() => setWerkzeug("bewegen")}>🔀 Verschieben</button>
        <button className="btn-primary" onClick={abspielen}>{spielt ? "⏹ Stopp" : "▶ Abspielen"}</button>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch">
          {band.map((s, i) => (
            <div key={s.id} className="flex items-stretch">
              {luecke(i, s)}
              <button
                onClick={() => klick(i)}
                className={`flex min-w-16 flex-col items-center rounded border px-2 py-1 text-sm ${gewaehlt === i ? "border-ok bg-surface-hover" : "border-line bg-surface"} ${kopf === i ? "outline outline-2 outline-ok" : ""}`}
              >
                <svg viewBox="0 0 40 30" className="h-6 w-14" aria-hidden>
                  {welle(s.wort).map((h, k) => <rect key={k} x={2 + k * 4.6} y={15 - h / 2} width="3" height={h} fill={FUELL(s.wort) ? "#c33" : "#6b4a2a"} />)}
                </svg>
                <span>{s.wort}</span>
              </button>
            </div>
          ))}
          {verschieben && gewaehlt !== band.length - 1 && luecke(band.length)}
        </div>
      </div>

      <p className="text-xs text-muted">🗑️ Schnipsel: {schnipsel.length ? schnipsel.join(" · ") : "noch leer"}</p>
      {meldung && <p className="text-sm" aria-live="polite">{meldung}</p>}
      {geloest && (
        <div className="space-y-2 rounded border border-ok p-3">
          <p className="font-semibold text-ok">»{STUFEN[stufe].ziel}«</p>
          <p className="text-sm text-muted">Vor dem Tonband konnte man Aufnahmen gar nicht bearbeiten: Eine Schallplatte wurde in einem Rutsch eingeritzt, und ein Versprecher blieb für immer drauf.</p>
          {stufe < STUFEN.length - 1 && <button className="btn-secondary" onClick={() => neu(stufe + 1)}>Nächste Stufe</button>}
        </div>
      )}
    </div>
  );
}
