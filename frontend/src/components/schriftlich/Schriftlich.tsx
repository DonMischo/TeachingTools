"use client";
/**
 * Schriftliche Rechenverfahren in drei Blättern:
 *   🎬 Vorführen      Addieren, Subtrahieren (Entbündeln), Multiplizieren, Dividieren
 *                     Schritt für Schritt mit Walzen und fliegenden Überträgen
 *   ✍️ Üben           Ergebnis an den Walzen einstellen (wie im Zählwerk), prüfen, Rechenweg ansehen
 *   🕵️ Fehlerdetektiv Spiel: den Fehler in fertig gerechneten Aufgaben finden
 */
import { useMemo, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { Chips } from "@/components/prozent/ui";
import { aufgabe, mitFehler, rechne, stellenName, type Methode, type Op } from "@/lib/schriftlich";
import { Abspieler } from "./Rechenblatt";
import { Rechenpapier } from "./Rechenpapier";

const METHODEN: { id: Methode; label: string }[] = [
  { id: "ergaenzen", label: "Ergänzen mit Übertrag" }, { id: "entbuendeln", label: "Abziehen mit Entbündeln" },
];

const OPS: { id: Op; label: string }[] = [
  { id: "+", label: "➕ Addieren" }, { id: "−", label: "➖ Subtrahieren" }, { id: "·", label: "✖️ Multiplizieren" }, { id: ":", label: "➗ Dividieren" },
];
const GRENZE: Record<Op, [number, number]> = { "+": [9999999, 9999999], "−": [9999999, 9999999], "·": [99999, 999], ":": [9999999, 99] };

function Vorfuehren() {
  const [op, setOp] = useState<Op>("+");
  const [methode, setMethode] = useState<Methode>("ergaenzen");
  const [ta, setTa] = useState("478"), [tb, setTb] = useState("365");
  const a = Number(ta), b = Number(tb);
  const fehler = !Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 ? "Bitte natürliche Zahlen eingeben."
    : a > GRENZE[op][0] || b > GRENZE[op][1] ? `Zu groß — höchstens ${GRENZE[op][0]} ${op} ${GRENZE[op][1]}.`
    : op === "−" && b > a ? "Die zweite Zahl darf nicht größer sein als die erste."
    : op === ":" && b === 0 ? "Durch 0 teilt man nicht." : "";
  const ablauf = useMemo(() => (fehler ? null : rechne(op, a, b, methode)), [op, a, b, fehler, methode]);
  const wuerfle = (o = op) => { const x = aufgabe(o, 2); setTa(String(x.a)); setTb(String(x.b)); };
  return (
    <div className="card p-4 flex flex-col gap-3">
      <Chips wahl={op} setze={o => { setOp(o); wuerfle(o); }} optionen={OPS} />
      <div className="flex flex-wrap items-center gap-2">
        <input className="input w-32 text-lg font-mono" value={ta} onChange={e => setTa(e.target.value.replace(/\D/g, ""))} aria-label="Erste Zahl" />
        <span className="text-2xl font-black">{op}</span>
        <input className="input w-32 text-lg font-mono" value={tb} onChange={e => setTb(e.target.value.replace(/\D/g, ""))} aria-label="Zweite Zahl" />
        <button className="btn-secondary" onClick={() => wuerfle()}>🎲 Neue Aufgabe</button>
      </div>
      {op === "−" && <Chips wahl={methode} setze={setMethode} optionen={METHODEN} />}
      {fehler ? <p className="text-sm text-bad">{fehler}</p> : ablauf && <Abspieler ablauf={ablauf} />}
      <p className="text-xs text-muted">
        {op === "−" && (methode === "ergaenzen" ? "Ergänzen mit Übertrag: unten plus wie viel ergibt oben? Reicht oben nicht (2 − 8), wird ein Zehner geborgt — aus 2 wird 12, 12 − 8 = 4 — und man merkt sich eins für die nächste Stelle. Die Walze zählt die Ergänzung und bleibt auf der Ziffer stehen, die geschrieben wird." : "Abziehen mit Entbündeln: oben minus unten; reicht es nicht, wird von links ein Bündel geholt (wie in der Stellenwerttafel).")}
        {op === "+" && "Die Walze einer Spalte dreht um jede Ziffer weiter. Läuft sie über die 9 hinaus, fliegt ein Übertrag in die nächste Spalte — wie beim Kilometerzähler."}
        {op === "·" && "Jede Ziffer des zweiten Faktors gibt ein Teilprodukt; die Teilprodukte werden stellengerecht addiert."}
        {op === ":" && "Die Walze zählt, wie oft der Teiler hineinpasst. Dann malnehmen, abziehen, nächste Ziffer herunterholen."}
      </p>
    </div>
  );
}

function Ueben() {
  const [op, setOp] = useState<Op>("+");
  const [methode, setMethode] = useState<Methode>("ergaenzen");
  const [stufe, setStufe] = useState<1 | 2 | 3>(1);
  const [auf, setAuf] = useState(() => aufgabe("+", 1));
  const [weg, setWeg] = useState(false);
  const [stand, setStand] = useState({ r: 0, g: 0, zuletzt: null as null | boolean });
  const [nr, setNr] = useState(0); // frisches Papier je Aufgabe
  const ablauf = useMemo(() => rechne(op, auf.a, auf.b, methode), [op, auf, methode]);
  const neu = (o = op, s = stufe) => { setAuf(aufgabe(o, s)); setWeg(false); setNr(n => n + 1); setStand(x => ({ ...x, zuletzt: null })); };
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Chips wahl={op} setze={o => { setOp(o); neu(o); }} optionen={OPS} />
        <span className="text-sm ml-2">Stufe</span>
        {([1, 2, 3] as const).map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => { setStufe(s); neu(op, s); }}>{s}</button>)}
        {stand.g > 0 && <span className="text-sm font-bold ml-3">{stand.r} / {stand.g} richtig</span>}
      </div>
      {op === "−" && <Chips wahl={methode} setze={m => { setMethode(m); setNr(n => n + 1); }} optionen={METHODEN} />}
      <p className="text-sm text-muted">Rechne auf dem Karopapier: jede Ziffer in ihr Kästchen, von rechts nach links. Überträge kannst du dir in den Kreisen merken.{op === ":" ? " Unter der Aufgabe ist Platz für deine Zwischenschritte (malnehmen, abziehen, herunterholen)." : op === "·" ? " Erst die Teilprodukte, dann addieren." : ""}</p>
      <Rechenpapier key={`${nr}-${op}-${methode}`} ablauf={ablauf} onErgebnis={ok => setStand(x => ({ r: x.r + (ok && x.zuletzt === null ? 1 : 0), g: x.g + (x.zuletzt === null ? 1 : 0), zuletzt: ok }))} />
      {stand.zuletzt !== null && <p className={`font-bold ${stand.zuletzt ? "text-ok" : "text-bad"}`}>{stand.zuletzt ? "✔ Das Ergebnis stimmt!" : "✘ Im Ergebnis stimmt noch etwas nicht — die roten Kästchen zeigen, wo."}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => setWeg(w => !w)}>{weg ? "Rechenweg zu" : "Rechenweg Schritt für Schritt"}</button>
        <button className="btn-secondary" onClick={() => neu()}>Neue Aufgabe</button>
      </div>
      {weg && <Abspieler ablauf={ablauf} />}
    </div>
  );
}

const BEST = "hp_schriftlich_detektiv_best";
type Fall = { op: "+" | "−"; a: number; b: number; falsch: number; exp: number; grund: string };
export function neuerFall(): Fall {
  for (;;) {
    const op = Math.random() < 0.5 ? "+" : "−";
    const { a, b } = aufgabe(op, 2);
    const f = mitFehler(op, a, b);
    // nur Fehler, bei denen das falsche Ergebnis gleich viele Stellen hat — jede Ziffer muss antippbar sein
    if (f && f.falsch > 0 && String(f.falsch).length === String(op === "+" ? a + b : a - b).length) return { op, a, b, ...f };
  }
}

function Fehlerdetektiv() {
  const [laeuft, setLaeuft] = useState(false);
  const [fall, setFall] = useState<Fall>(neuerFall);
  const [punkte, setPunkte] = useState(0);
  const [runde, setRunde] = useState(0);
  const [rueck, setRueck] = useState<null | { ok: boolean; text: string }>(null);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem(BEST)) || 0; } catch { return 0; } });
  const RUNDEN = 8;
  const tippe = (exp: number) => {
    if (rueck) return;
    const ok = exp === fall.exp;
    setPunkte(p => p + (ok ? 10 : 0));
    setRueck({ ok, text: (ok ? "Gefunden! " : `Nein — der Fehler steckt bei den ${stellenName(fall.exp)}n. `) + fall.grund + ` Richtig wäre ${fall.op === "+" ? fall.a + fall.b : fall.a - fall.b}.` });
  };
  const weiter = () => {
    if (runde + 1 >= RUNDEN) {
      setLaeuft(false);
      if (punkte > best) { setBest(punkte); try { localStorage.setItem(BEST, String(punkte)); } catch { /* egal */ } }
      return;
    }
    setRunde(r => r + 1); setFall(neuerFall()); setRueck(null);
  };
  if (!laeuft) return (
    <div className="card p-4 flex flex-col gap-3 items-start">
      <h3 className="font-black text-lg">🕵️ Fehlerdetektiv</h3>
      <p className="text-sm text-muted max-w-xl">Jemand hat schriftlich gerechnet — und einen typischen Fehler gemacht: Übertrag vergessen oder nicht entbündelt. Tippe auf die Ziffer im Ergebnis, die falsch ist. {RUNDEN} Aufgaben, 10 Punkte je Treffer.</p>
      {runde > 0 && <p className="font-bold">{punkte} von {RUNDEN * 10} Punkten{punkte >= best && punkte > 0 ? " — neuer Rekord!" : ""}</p>}
      {best > 0 && <p className="text-xs text-muted">Rekord: {best}</p>}
      <button className="btn-primary" onClick={() => { setLaeuft(true); setPunkte(0); setRunde(0); setFall(neuerFall()); setRueck(null); }}>▶ Los</button>
    </div>
  );
  // so viele Spalten wie die längste Zahl (auch das richtige Ergebnis, z. B. Zehntausender) plus Rechenzeichen
  const w = String(Math.max(fall.a, fall.b, fall.falsch, fall.op === "+" ? fall.a + fall.b : fall.a - fall.b)).length + 1;
  const zeile = (n: number | string, zeichen = "") => (
    <div className="flex font-mono text-3xl font-black">
      <span className="w-10 text-center">{zeichen}</span>
      {String(n).padStart(w - 1, " ").split("").map((c, i) => <span key={i} className="w-10 text-center">{c === " " ? "" : c}</span>)}
    </div>
  );
  const s = String(fall.falsch).padStart(w - 1, " ");
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex gap-4 text-sm font-bold"><span>Aufgabe {runde + 1} / {RUNDEN}</span><span>{punkte} Punkte</span></div>
      <div className="self-start rounded-xl border-2 border-line p-3 bg-page">
        {zeile(fall.a)}
        {zeile(fall.b, fall.op)}
        <div className="border-t-4 border-fg my-1" />
        <div className="flex font-mono text-3xl font-black">
          <span className="w-10" />
          {s.split("").map((c, i) => {
            const exp = s.length - 1 - i;
            return c === " " ? <span key={i} className="w-10" /> : (
              <button key={i} type="button" onClick={() => tippe(exp)} aria-label={`Ziffer ${c} bei den ${stellenName(exp)}n`}
                className={`w-10 rounded-lg hover:bg-accent/20 ${rueck && exp === fall.exp ? "bg-bad/25 text-bad" : ""}`}>{c}</button>
            );
          })}
        </div>
      </div>
      {rueck ? <>
        <p className={`font-bold ${rueck.ok ? "text-ok" : "text-bad"}`}>{rueck.ok ? "✔ " : "✘ "}{rueck.text}</p>
        <button className="btn-primary self-start" onClick={weiter}>{runde + 1 >= RUNDEN ? "Auswertung" : "Nächster Fall →"}</button>
      </> : <p className="text-sm">Welche Ziffer im Ergebnis ist falsch? Antippen!</p>}
    </div>
  );
}

const BLAETTER = [
  { id: "vorfuehren", icon: "🎬", label: "Vorführen" },
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiel", icon: "🕵️", label: "Fehlerdetektiv" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];
const INHALT: Record<Blatt, () => ReactNode> = { vorfuehren: () => <Vorfuehren />, ueben: () => <Ueben />, spiel: () => <Fehlerdetektiv /> };

export default function Schriftlich({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = wahl(vorgabe, "reiter", BLAETTER.map(b => b.id));
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "vorfuehren");
  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">✏️ Schriftliche Rechenverfahren</h1>
          <p className="text-muted text-sm mt-1">Addieren, Subtrahieren, Multiplizieren und Dividieren schriftlich — jeder Schritt sichtbar, mit den Walzen der Stellenwerttafel und fliegenden Überträgen. Dazu Üben auf Karopapier mit Übertragskreisen und das Spiel Fehlerdetektiv.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>}
      {INHALT[blatt]()}
    </div>
  );
}
