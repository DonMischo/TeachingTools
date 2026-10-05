"use client";
/**
 * Regel-Labor — aus wenigen Ersetzungsregeln wachsen Labyrinthe und Grundrisse.
 *
 * Reiter:
 *   Lehrgang — fünf Stationen von einer Regel bis zum Grundriss
 *   Rätsel   — Ziel vorgegeben, Regelzahl begrenzt, wird automatisch geprüft
 *   Labor    — freies Bauen
 *   Labyrinthe — Erzeuger und Löser Schritt für Schritt (Stapel, Schlange, A*)
 *   Gebäude  — aus einer Wachstumsregel wird ein Haus mit Stockwerken (three.js)
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FARBEN, type Start } from "@/lib/regeln/maschine";
import { RAETSEL, STATIONEN } from "@/lib/regeln/lehrgang";
import { wahl as vorWahl, type Vorgabe } from "@/lib/vorgabe";
import Werkbank from "./Werkbank";
import Labyrinthe from "./Labyrinthe";
import GebaeudeDemo from "./GebaeudeDemo";
import Beispiele from "./Beispiele";

type Reiter = "lehrgang" | "raetsel" | "labor" | "beispiele" | "labyrinthe" | "gebaeude";

const REITER: { id: Reiter; icon: string; label: string }[] = [
  { id: "lehrgang", icon: "🎓", label: "Lehrgang" },
  { id: "raetsel", icon: "🧩", label: "Rätsel" },
  { id: "labor", icon: "🧪", label: "Freies Labor" },
  { id: "beispiele", icon: "🖼️", label: "Beispiele" },
  { id: "labyrinthe", icon: "🌀", label: "Labyrinthe" },
  { id: "gebaeude", icon: "🏢", label: "Gebäude" },
];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-(--accent) text-(--accent-text,#111)" : "text-(--text-muted) hover:text-(--text)"}`;

const wahl = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold border ${an ? "bg-(--accent) text-(--accent-text,#111) border-transparent" : "border-(--border) text-(--text-muted) hover:text-(--text)"}`;

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: "lehrgang" | "raetsel" | "labor" | "labyrinthe" | "gebaeude" }`
 * legt den Reiter fest und blendet die Reiterleiste aus. Dazu `station: <Stations-Id>` (bei
 * »lehrgang«) bzw. `raetsel: <Rätsel-Id>` (bei »raetsel«): startet dort und blendet die Auswahl aus.
 */
export default function RegelLabor({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const festerReiter = vorWahl(vorgabe, "reiter", REITER.map(r => r.id));
  const festeStation = vorWahl(vorgabe, "station", STATIONEN.map(s => s.id));
  const festesRaetsel = vorWahl(vorgabe, "raetsel", RAETSEL.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(festerReiter ?? "lehrgang");
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-(--seite-breite) mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧬 Regel-Labor</h1>
          <p className="text-(--text-muted) text-sm mt-1">
            Ein paar Ersetzungsregeln auf einem Raster — und daraus wachsen Labyrinthe, Muster und Grundrisse.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-(--border) p-1 bg-(--surface)">
        {REITER.map(r => (
          <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>
        ))}
      </div>}
      {reiter === "lehrgang" && <Lehrgang fest={festeStation} />}
      {reiter === "raetsel" && <Raetsel fest={festesRaetsel} />}
      {reiter === "labor" && <Labor />}
      {reiter === "beispiele" && <Beispiele />}
      {reiter === "labyrinthe" && <Labyrinthe />}
      {reiter === "gebaeude" && <GebaeudeDemo />}
    </div>
  );
}

function Lehrgang({ fest }: { fest?: string }) {
  const [nr, setNr] = useState(() => Math.max(0, STATIONEN.findIndex(s => s.id === fest)));
  const [reset, setReset] = useState(0);
  const s = STATIONEN[nr];
  return (
    <div className="flex flex-col gap-3">
      {!fest && <div className="flex flex-wrap gap-1">
        {STATIONEN.map((st, i) => (
          <button key={st.id} onClick={() => setNr(i)} className={wahl(i === nr)}>{st.titel}</button>
        ))}
      </div>}
      <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm leading-relaxed flex flex-col gap-2">
        <h2 className="font-black text-lg">{s.titel}</h2>
        {s.text.map((t, i) => <p key={i}>{t}</p>)}
        <p className="rounded-lg bg-(--bg) border border-(--border) p-2">🤔 {s.frage}</p>
        <div className="flex gap-2">
          <button onClick={() => setReset(r => r + 1)} className="text-xs underline text-(--text-muted)">Programm dieser Station wiederherstellen</button>
          {!fest && nr < STATIONEN.length - 1 && (
            <button onClick={() => setNr(nr + 1)} className="ml-auto text-xs font-bold underline">weiter zu {STATIONEN[nr + 1].titel} →</button>
          )}
        </div>
      </section>
      <Werkbank key={`${s.id}-${reset}`} vorlage={s.programm} start={s.start} />
    </div>
  );
}

const SPEICHER = "hp_regeln_geloest";

function Raetsel({ fest }: { fest?: string }) {
  const [nr, setNr] = useState(() => Math.max(0, RAETSEL.findIndex(r => r.id === fest)));
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
      {!fest && <div className="flex flex-wrap gap-1">
        {RAETSEL.map((rt, i) => (
          <button key={rt.id} onClick={() => setNr(i)} className={wahl(i === nr)}>
            {geloest.includes(rt.id) ? "✅" : "🧩"} {rt.titel}
          </button>
        ))}
      </div>}
      <section className="rounded-2xl border border-(--border) bg-(--surface) p-4 text-sm leading-relaxed">
        <h2 className="font-black text-lg">{r.titel}</h2>
        <p>{r.aufgabe}</p>
        <p className="text-xs text-(--text-muted) mt-1">
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
  const auswahl = "rounded-lg border border-(--border) bg-(--surface) px-2 py-1";
  const farbwahl = (wert: string, setzen: (f: string) => void, leer?: string) => (
    <select value={wert} onChange={e => setzen(e.target.value)} className={auswahl}>
      {leer && <option value="">{leer}</option>}
      {Object.entries(FARBEN).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
    </select>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm rounded-2xl border border-(--border) bg-(--surface) p-3">
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
      <p className="text-xs text-(--text-muted)">
        Idee nach <a className="underline" href="https://github.com/mxgmn/MarkovJunior" target="_blank" rel="noreferrer">MarkovJunior</a> von Maxim Gumin (MIT-Lizenz) — hier stark vereinfacht nachgebaut.
        Angestoßen von den Clips des Kanals <a className="underline" href="https://www.instagram.com/index.opensource/" target="_blank" rel="noreferrer">index.opensource</a>.
      </p>
    </div>
  );
}
