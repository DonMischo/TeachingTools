"use client";
/**
 * Die Stellenwerttafel zum Anfassen: Plättchen (oder Ziffern) legen und
 * wegnehmen. »Automatisch bündeln« macht den Übertrag selbst; ohne liegen
 * auch einmal 13 Plättchen in einer Spalte, und man bündelt von Hand.
 * Wechselt man das System, bleibt die Zahl dieselbe.
 *
 * »➕ Neue Zeile« schreibt die Zahl fest in eine Zeile darüber und fängt
 * unten eine neue an — so stehen mehrere Zahlen untereinander, nur die
 * letzte lässt sich verändern. Führende Nullen bleiben dort leer wie im Heft.
 */
import { useEffect, useRef, useState } from "react";
import { BASEN, INDEX, dez, lies, nachkommaVon, schreibe, spalte, ziffernVon, type Basis } from "@/lib/stellenwert";
import { Chips } from "@/components/prozent/ui";
import { DreiSysteme, TafelAnsicht, type FruehereZeile } from "./teile";

const GROESSEN: Record<Basis, readonly { id: string; label: string; maxExp: number }[]> = {
  10: [{ id: "3", label: "bis Tausender", maxExp: 3 }, { id: "6", label: "bis Millionen", maxExp: 6 }, { id: "9", label: "bis Milliarden", maxExp: 9 }],
  2: [{ id: "3", label: "4 Bit", maxExp: 3 }, { id: "7", label: "8 Bit (1 Byte)", maxExp: 7 }, { id: "11", label: "12 Bit", maxExp: 11 }],
  16: [{ id: "1", label: "2 Stellen", maxExp: 1 }, { id: "2", label: "3 Stellen", maxExp: 2 }, { id: "3", label: "4 Stellen", maxExp: 3 }],
};

const TIPPS: Record<Basis, string> = {
  10: "Im Zehnersystem gibt es die Ziffern 0 bis 9. Liegen in einer Spalte 10 Plättchen, werden sie zu 1 Plättchen in der Spalte links gebündelt — jede Spalte ist 10-mal so viel wert wie die rechts daneben.",
  2: "Im Zweiersystem gibt es nur 0 und 1 (aus/an). Schon 2 Plättchen werden gebündelt — jede Spalte ist doppelt so viel wert wie die rechts daneben: 1, 2, 4, 8, 16 …",
  16: "Im Sechzehnersystem reichen 0–9 nicht: dazu kommen A=10, B=11, C=12, D=13, E=14, F=15. Erst 16 Plättchen werden gebündelt — jede Spalte ist 16-mal so viel wert: 1, 16, 256, 4 096 …",
};

type Werte = Record<number, number>;

/** Zahl (in Einheiten des kleinsten Stellenwerts) in Spalten verteilen. */
function verteile(einheiten: number, basis: Basis, minExp: number): Werte {
  const z = ziffernVon(einheiten, basis);
  const w: Werte = {};
  z.forEach((d, i) => { if (d) w[z.length - 1 - i + minExp] = d; });
  return w;
}

type Zeile = { id: number; wert: number };

export default function Tafel() {
  const [basis, setBasis] = useState<Basis>(10);
  const [groesse, setGroesse] = useState<Record<Basis, string>>({ 10: "3", 2: "7", 16: "1" });
  const [komma, setKomma] = useState(false);
  const [werte, setWerte] = useState<Werte>({ 2: 1, 1: 3, 0: 5 });
  const [art, setArt] = useState<"plaettchen" | "ziffern">("plaettchen");
  const [auto, setAuto] = useState(true);
  const [blitz, setBlitz] = useState<number[]>([]);
  const [meldung, setMeldung] = useState("");
  const [eingabe, setEingabe] = useState("");
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [auswahl, setAuswahl] = useState<Set<number>>(new Set());
  const naechsteId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Kommazahlen in früheren Zeilen brauchen die Kommaspalten, große Zahlen mehr Spalten links
  const kommaAn = basis === 10 && (komma || zeilen.some(z => z.wert !== Math.floor(z.wert)));
  const maxExp = Math.max(
    GROESSEN[basis].find(g => g.id === groesse[basis])!.maxExp,
    ...zeilen.map(z => ziffernVon(Math.floor(z.wert), basis).length - 1),
  );
  const minExp = kommaAn ? -3 : 0;
  const einheiten = Object.entries(werte).reduce((s, [e, n]) => s + n * basis ** (Number(e) - minExp), 0);
  const wert = einheiten / basis ** -minExp;
  const gebuendelt = Object.values(werte).every(n => n < basis);
  const nk = minExp < 0 ? Math.max(0, ...Object.entries(werte).filter(([, n]) => n).map(([e]) => -Number(e))) : 0;

  const leuchte = (exps: number[]) => {
    setBlitz(exps);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setBlitz([]), 700);
  };

  const plus = (exp: number) => {
    setMeldung("");
    const w = { ...werte };
    const geaendert: number[] = [];
    let e = exp;
    for (;;) {
      w[e] = (w[e] ?? 0) + 1;
      geaendert.push(e);
      if (!auto || w[e] < basis) break;
      if (e >= maxExp) { setMeldung("Die Tafel ist voll — links ist keine Spalte mehr frei. Mach sie größer!"); return; }
      w[e] = 0; e++;
    }
    setWerte(w);
    if (geaendert.length > 1) leuchte(geaendert);
  };

  const minus = (exp: number) => {
    setMeldung("");
    if (werte[exp]) { setWerte({ ...werte, [exp]: werte[exp] - 1 }); return; }
    if (!auto) { setMeldung("Hier liegt nichts. Hol dir eins, indem du links daneben ein Plättchen entbündelst."); return; }
    // ausleihen: von der nächsten belegten Spalte links eins entbündeln, dazwischen wird alles zur größten Ziffer
    let j = exp + 1;
    while (j <= maxExp && !werte[j]) j++;
    if (j > maxExp) { setMeldung("Weniger als 0 geht nicht."); return; }
    const w = { ...werte, [j]: werte[j] - 1 };
    const geaendert = [j];
    for (let e = j - 1; e >= exp; e--) { w[e] = basis - 1; geaendert.push(e); }
    setWerte(w);
    leuchte(geaendert);
  };

  const buendeln = (exp: number) => {
    if ((werte[exp] ?? 0) < basis || exp >= maxExp) return;
    setWerte({ ...werte, [exp]: werte[exp] - basis, [exp + 1]: (werte[exp + 1] ?? 0) + 1 });
    leuchte([exp, exp + 1]);
  };

  const entbuendeln = (exp: number) => {
    if (!werte[exp] || exp <= minExp) return;
    setWerte({ ...werte, [exp]: werte[exp] - 1, [exp - 1]: (werte[exp - 1] ?? 0) + basis });
    leuchte([exp, exp - 1]);
  };

  /** Ganze Zahl in ein anderes System mitnehmen; die Tafel wächst, wenn nötig. */
  const wechsle = (b: Basis) => {
    const n = Math.floor(wert);
    const passend = GROESSEN[b].find(g => n < b ** (g.maxExp + 1));
    setBasis(b); setMeldung(n !== wert ? "Kommazahlen gibt es hier nur im Zehnersystem — die Nachkommastellen sind weg." : "");
    if (!passend) { setWerte({}); setMeldung("Die Zahl passt in dieses System nicht auf die Tafel — sie ist leer."); return; }
    if (ziffernVon(n, b).length - 1 > GROESSEN[b].find(g => g.id === groesse[b])!.maxExp) setGroesse({ ...groesse, [b]: passend.id });
    setWerte(verteile(n, b, 0));
  };

  const setzeZahl = () => {
    const x = lies(eingabe, basis);
    if (x === null) { setMeldung(`Das ist keine Zahl im ${BASEN.find(s => s.basis === basis)!.name}.`); return; }
    if (x !== Math.floor(x) && minExp === 0) { setMeldung("Für Kommazahlen erst »Mit Komma« einschalten."); return; }
    const e = Math.round(x * basis ** -minExp);
    if (e >= basis ** (maxExp - minExp + 1)) { setMeldung("Zu groß für diese Tafel — mach sie größer."); return; }
    setWerte(verteile(e, basis, minExp)); setMeldung("");
  };

  /** Die Zahl auf der Tafel festschreiben und darunter eine neue Zeile anfangen (leer oder mit der getippten Zahl). */
  const neueZeile = () => {
    let start: Werte = {};
    if (eingabe.trim()) {
      const y = lies(eingabe, basis);
      if (y === null) { setMeldung(`Das ist keine Zahl im ${BASEN.find(s => s.basis === basis)!.name}.`); return; }
      if (y !== Math.floor(y) && minExp === 0) { setMeldung("Für Kommazahlen erst »Mit Komma« einschalten."); return; }
      const e = Math.round(y * basis ** -minExp);
      if (e >= basis ** (maxExp - minExp + 1)) { setMeldung("Zu groß für diese Tafel — mach sie größer."); return; }
      start = verteile(e, basis, minExp);
    }
    setZeilen(z => [...z, { id: naechsteId.current++, wert }]);
    setWerte(start); setEingabe(""); setMeldung("");
  };

  const fruehere: FruehereZeile[] = zeilen.map(z => {
    const w = basis === 10 ? z.wert : Math.floor(z.wert);
    const zf = verteile(Math.round(w * basis ** -minExp), basis, minExp);
    const exps = Object.keys(zf).map(Number);
    return {
      id: z.id, ziffern: zf,
      hoechste: Math.max(0, ...exps), niedrigste: Math.min(0, ...exps),
      name: basis === 10 ? dez(w, nachkommaVon(w)) : schreibe(w, basis),
    };
  });

  const wuerfle = () => {
    const stellen = maxExp - minExp + 1;
    const e = Math.floor(Math.random() * basis ** Math.min(stellen, 12));
    setWerte(verteile(e, basis, minExp)); setMeldung("");
  };

  const terme = Object.entries(werte).map(([e, n]) => ({ exp: Number(e), n })).filter(t => t.n).sort((a, b) => b.exp - a.exp);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Chips wahl={String(basis) as "10" | "2" | "16"} setze={b => wechsle(Number(b) as Basis)}
            optionen={BASEN.map(s => ({ id: String(s.basis) as "10" | "2" | "16", label: `${s.icon} ${s.name}` }))} />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Chips wahl={groesse[basis]} setze={g => setGroesse({ ...groesse, [basis]: g })} optionen={GROESSEN[basis]} />
          {basis === 10 && (
            <Chips wahl={kommaAn ? "k" : "g"} setze={k => { setKomma(k === "k"); if (k === "g") setWerte(w => Object.fromEntries(Object.entries(w).filter(([e]) => Number(e) >= 0))); }}
              optionen={[{ id: "g", label: "Ganze Zahlen" }, { id: "k", label: "Mit Komma" }]} />
          )}
          <Chips wahl={art} setze={setArt} optionen={[{ id: "plaettchen", label: "🔵 Plättchen" }, { id: "ziffern", label: "🔢 Ziffern" }]} />
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> automatisch bündeln
          </label>
        </div>

        {zeilen.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">{zeilen.length + 1} Zahlen untereinander — nur die letzte (▶) lässt sich verändern.</span>
            <button className="btn text-sm" disabled={!auswahl.size}
              onClick={() => { setZeilen(z => z.filter(x => !auswahl.has(x.id))); setAuswahl(new Set()); }}>
              🗑 Ausgewählte löschen{auswahl.size ? ` (${auswahl.size})` : ""}
            </button>
          </div>
        )}
        <TafelAnsicht basis={basis} maxExp={maxExp} minExp={minExp} werte={werte} art={art} blitz={blitz} auto={auto}
          knoepfe={{ plus, minus, buendeln, entbuendeln }} fruehere={fruehere} auswahl={{ gewaehlt: auswahl, setze: setAuswahl }} />

        {meldung && <p className="text-sm font-bold text-bad" role="status">{meldung}</p>}
        {!gebuendelt && (
          <p className="text-sm font-bold" role="status">
            ⚠️ Noch nicht fertig gebündelt: eine Spalte hat {basis} oder mehr Plättchen. So kann man die Zahl nicht mit Ziffern schreiben — drück »⬅ bündeln«!
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <form className="flex gap-2 items-center" onSubmit={e => { e.preventDefault(); setzeZahl(); }}>
            <input className="input w-40 font-mono" value={eingabe} onChange={e => setEingabe(e.target.value)}
              placeholder={basis === 2 ? "z. B. 1011" : basis === 16 ? "z. B. 2AF" : kommaAn ? "z. B. 3,05" : "z. B. 4072"}
              aria-label="Zahl eintragen" />
            <span className="text-muted">{INDEX[basis]}</span>
            <button className="btn" type="submit">In die Tafel</button>
            <button className="btn" type="button" onClick={neueZeile} title="Die Zahl auf der Tafel festschreiben und darunter eine neue Zeile anfangen — mit der getippten Zahl oder leer">➕ Neue Zeile</button>
          </form>
          <button className="btn" onClick={wuerfle}>🎲 Zufallszahl</button>
          <button className="btn" onClick={() => { setWerte({}); setMeldung(""); }}>↺ Leeren</button>
        </div>
        <p className="text-sm text-muted max-w-3xl">{TIPPS[basis]}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4 sm:p-5 flex flex-col gap-2">
          <h2 className="font-black">🧮 So viel ist es wert</h2>
          <p className="font-mono text-sm leading-relaxed break-words">
            {terme.length ? terme.map((t, i) => {
              const s = spalte(basis, t.exp);
              return (
                <span key={t.exp}>
                  {i > 0 && " + "}
                  <span className="font-black" style={{ color: s.farbe }}>{t.n}</span> · {s.wert}
                </span>
              );
            }) : "0"}
          </p>
          <p className="text-2xl font-black">
            = {basis === 10 ? dez(wert, nk) : schreibe(Math.round(wert), 10)}<span className="text-sm text-muted">₁₀</span>
          </p>
          {basis !== 10 && gebuendelt && (
            <p className="text-sm text-muted">In der Tafel steht: <b className="font-mono text-fg">{schreibe(einheiten, basis)}</b>{INDEX[basis]}</p>
          )}
        </div>
        <div className="card p-4 sm:p-5 flex flex-col gap-2">
          <h2 className="font-black">🌈 Dieselbe Zahl in drei Systemen</h2>
          <DreiSysteme n={Math.floor(wert)} />
          <p className="text-xs text-muted">
            Gleiche Farbe = gehört zusammen: vier Bits ergeben genau eine Hex-Ziffer.
            {wert !== Math.floor(wert) && " (Nur der ganze Teil — Kommazahlen zeigt diese Seite nur im Zehnersystem.)"}
          </p>
        </div>
      </div>
    </div>
  );
}
