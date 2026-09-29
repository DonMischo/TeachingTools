"use client";
/**
 * Regel-Labor — aus wenigen Ersetzungsregeln wachsen Labyrinthe und Grundrisse.
 *
 * Reiter:
 *   Lehrgang — fünf Stationen von einer Regel bis zum Grundriss
 *   Rätsel   — Ziel vorgegeben, Regelzahl begrenzt, wird automatisch geprüft
 *   Labor    — freies Bauen
 *   Labyrinthe — Erzeuger und Löser Schritt für Schritt (Stapel, Schlange, A*)
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FARBEN, type Start } from "@/lib/regeln/maschine";
import { RAETSEL, STATIONEN } from "@/lib/regeln/lehrgang";
import Werkbank from "./Werkbank";
import Labyrinthe from "./Labyrinthe";

type Reiter = "lehrgang" | "raetsel" | "labor" | "labyrinthe";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "lehrgang", icon: "🎓", label: "Lehrgang" },
  { id: "raetsel", icon: "🧩", label: "Rätsel" },
  { id: "labor", icon: "🧪", label: "Freies Labor" },
  { id: "labyrinthe", icon: "🌀", label: "Labyrinthe" },
];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`;

const wahl = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold border ${an ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"}`;

export default function RegelLabor({ action }: { action?: ReactNode }) {
  const [reiter, setReiter] = useState<Reiter>("lehrgang");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧬 Regel-Labor</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Ein paar Ersetzungsregeln auf einem Raster — und daraus wachsen Labyrinthe, Muster und Grundrisse.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="inline-flex flex-wrap self-start rounded-xl border border-[var(--border)] p-1 bg-[var(--surface)]">
        {REITER.map(r => (
          <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>
        ))}
      </div>
      {reiter === "lehrgang" && <Lehrgang />}
      {reiter === "raetsel" && <Raetsel />}
      {reiter === "labor" && <Labor />}
      {reiter === "labyrinthe" && <Labyrinthe />}
    </div>
  );
}

function Lehrgang() {
  const [nr, setNr] = useState(0);
  const [reset, setReset] = useState(0);
  const s = STATIONEN[nr];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {STATIONEN.map((st, i) => (
          <button key={st.id} onClick={() => setNr(i)} className={wahl(i === nr)}>{st.titel}</button>
        ))}
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed flex flex-col gap-2">
        <h2 className="font-black text-lg">{s.titel}</h2>
        {s.text.map((t, i) => <p key={i}>{t}</p>)}
        <p className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-2">🤔 {s.frage}</p>
        <div className="flex gap-2">
          <button onClick={() => setReset(r => r + 1)} className="text-xs underline text-[var(--text-muted)]">Programm dieser Station wiederherstellen</button>
          {nr < STATIONEN.length - 1 && (
            <button onClick={() => setNr(nr + 1)} className="ml-auto text-xs font-bold underline">weiter zu {STATIONEN[nr + 1].titel} →</button>
          )}
        </div>
      </section>
      <Werkbank key={`${s.id}-${reset}`} vorlage={s.programm} start={s.start} />
    </div>
  );
}

const SPEICHER = "hp_regeln_geloest";

function Raetsel() {
  const [nr, setNr] = useState(0);
  const [geloest, setGeloest] = useState<string[]>([]);
  useEffect(() => {
    try { setGeloest(JSON.parse(localStorage.getItem(SPEICHER) ?? "[]")); } catch { /* ohne Speicher geht es auch */ }
  }, []);
  const r = RAETSEL[nr];
  const merke = useCallback(() => {
    setGeloest(alt => {
      const neu = alt.includes(r.id) ? alt : [...alt, r.id];
      try { localStorage.setItem(SPEICHER, JSON.stringify(neu)); } catch { /* egal */ }
      return neu;
    });
  }, [r.id]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {RAETSEL.map((rt, i) => (
          <button key={rt.id} onClick={() => setNr(i)} className={wahl(i === nr)}>
            {geloest.includes(rt.id) ? "✅" : "🧩"} {rt.titel}
          </button>
        ))}
      </div>
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-relaxed">
        <h2 className="font-black text-lg">{r.titel}</h2>
        <p>{r.aufgabe}</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Start: {r.start.b}×{r.start.h} Felder {FARBEN[r.start.grund].name.toLowerCase()}
          {r.start.mitte && `, in der Mitte ${FARBEN[r.start.mitte].name.toLowerCase()}`}. Das Programm im Editor ist nur ein Anfang — ändere es.
        </p>
      </section>
      <Werkbank key={r.id} vorlage={r.vorlage} start={r.start} maxRegeln={r.maxRegeln} pruefe={r.pruefe} onGeloest={merke} />
    </div>
  );
}

const GROESSEN = [11, 21, 31, 41, 61];

function Labor() {
  const [groesse, setGroesse] = useState(31);
  const [grund, setGrund] = useState("B");
  const [mitte, setMitte] = useState("R");
  const [vorlage, setVorlage] = useState(STATIONEN[2].programm);
  const [laden, setLaden] = useState(0);
  const start = useMemo<Start>(() => ({ b: groesse, h: groesse, grund, ...(mitte ? { mitte } : {}) }), [groesse, grund, mitte]);
  const auswahl = "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1";
  const farbwahl = (wert: string, setzen: (f: string) => void, leer?: string) => (
    <select value={wert} onChange={e => setzen(e.target.value)} className={auswahl}>
      {leer && <option value="">{leer}</option>}
      {Object.entries(FARBEN).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
    </select>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="flex items-center gap-1">Feld
          <select value={groesse} onChange={e => setGroesse(+e.target.value)} className={auswahl}>
            {GROESSEN.map(g => <option key={g} value={g}>{g}×{g}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Grund {farbwahl(grund, setGrund)}</label>
        <label className="flex items-center gap-1">Mitte {farbwahl(mitte, setMitte, "wie der Grund")}</label>
        <label className="flex items-center gap-1">Vorlage laden
          <select value="" onChange={e => { if (e.target.value) { setVorlage(e.target.value); setLaden(l => l + 1); } }} className={auswahl}>
            <option value="">—</option>
            {STATIONEN.map(s => <option key={s.id} value={s.programm}>{s.titel}</option>)}
          </select>
        </label>
      </div>
      <Werkbank key={laden} vorlage={vorlage} start={start} />
      <p className="text-xs text-[var(--text-muted)]">
        Idee nach <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a> von Maxim Gumin (MIT-Lizenz) — hier stark vereinfacht nachgebaut.
      </p>
    </div>
  );
}
