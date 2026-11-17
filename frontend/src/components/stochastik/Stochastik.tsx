"use client";
/**
 * Daten und Stochastik — Lerneinheit Kl. 5–10 nach dem Thüringer Lehrplan
 * Mathematik 2026, aufsteigend nach Klassenstufe:
 *   5/6   📋 Daten erfassen · 📊 Diagramme · 📏 Kenngrößen · 🗳️ Eigene Umfrage · 🎲 Zufallsexperimente
 *   7/8   📈 Zufallslabor · 🎯 Ereignisse & Laplace · 🌳 Baumdiagramm & Pfadregeln · ⭕ Verknüpfte Ereignisse
 *   9/10  ▦ Vierfeldertafel & bedingt · 🔢 Kombinatorik · 📶 Zufallsgrößen
 *   dazu  ✍️ Üben · 🎮 Spiele · 🏆 Erfolge
 * Oben wählt man Klassenstufe und Niveau (H/R/G); Lektionen anderer Stufen
 * bleiben erreichbar, sind aber als »früher« bzw. »später« markiert.
 */
import { useEffect, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { LEKTIONEN, NIVEAU_NAME, STUFEN, lage, type LektionId, type Niveau, type Stufe } from "@/lib/stochastik/lektionen";
import { ERFOLGE, lade, type Stand } from "@/lib/stochastik/erfolge";
import { Diagramme, Erfassen } from "./Daten";
import Kenngroessen from "./Kenngroessen";
import Umfrage from "./Umfrage";
import { Experimente, Labor } from "./Zufall";
import { BaumBlatt, Laplace, VennBlatt } from "./Wahrscheinlichkeit";
import { Kombinatorik, Vierfelder, Zufallsgroessen } from "./Oberstufe";
import Ueben from "./Ueben";
import Spiele from "./Spiele";
import { ErfolgsMelder, Navi, NiveauMarke, useMelden } from "./ui";

const EXTRA = [
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiel", icon: "🎮", label: "Spiele" },
  { id: "erfolge", icon: "🏆", label: "Erfolge" },
] as const;
type Blatt = LektionId | (typeof EXTRA)[number]["id"];
const ALLE: Blatt[] = [...LEKTIONEN.map(l => l.id), ...EXTRA.map(e => e.id)];

const INHALT: Record<LektionId, () => ReactNode> = {
  erfassen: () => <Erfassen />, diagramme: () => <Diagramme />, kenngroessen: () => <Kenngroessen />, umfrage: () => <Umfrage />,
  experimente: () => <Experimente />, labor: () => <Labor />, laplace: () => <Laplace />, baum: () => <BaumBlatt />, venn: () => <VennBlatt />,
  vierfelder: () => <Vierfelder />, kombinatorik: () => <Kombinatorik />, zufallsgroessen: () => <Zufallsgroessen />,
};

function ErfolgeBlatt() {
  const [s, setS] = useState<Stand | null>(null);
  useEffect(() => setS(lade()), []);
  if (!s) return null;
  const gruppen = [...new Set(ERFOLGE.map(e => e.gruppe))];
  return (
    <div className="flex flex-col gap-4">
      {gruppen.map(g => (
        <div key={g} className="card p-4 flex flex-col gap-3">
          <h3 className="font-black">{g}</h3>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {ERFOLGE.filter(e => e.gruppe === g).map(e => {
              const w = Math.min(e.wert(s), e.ziel), ok = w >= e.ziel;
              return (
                <div key={e.id} className={`rounded-xl border p-3 flex gap-3 items-center ${ok ? "border-line-active bg-surface-hover" : "border-line opacity-80"}`}>
                  <span className={`text-3xl ${ok ? "" : "grayscale opacity-50"}`}>{e.icon}</span>
                  <span className="flex-1 flex flex-col gap-1">
                    <b className="text-sm">{e.name}</b>
                    <span className="text-xs text-muted">{e.text}</span>
                    {e.ziel > 1 && <span className="h-1.5 rounded-full bg-page overflow-hidden"><span className="block h-full bg-accent" style={{ width: `${(w / e.ziel) * 100}%` }} /></span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted">Der Stand liegt in diesem Browser; alle Erfolge aller Werkzeuge stehen auch unter »Erfolge« in der Seitenleiste.</p>
    </div>
  );
}

/** Merkt sich geöffnete Lektionen für die Erfolge. */
function Besuch({ id }: { id: Blatt }) {
  const melden = useMelden();
  useEffect(() => {
    if (LEKTIONEN.some(l => l.id === id)) melden(s => (s.besucht.includes(id as LektionId) ? s : { ...s, besucht: [...s.besucht, id as LektionId] }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function Stochastik({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", ALLE);
  const [blatt, setBlatt] = useState<Blatt>(festerReiter ?? "erfassen");
  const [stufe, setStufe] = useState<Stufe | null>(null);
  const [niveau, setNiveau] = useState<Niveau | null>(null);
  const gehe = (id: LektionId) => { setBlatt(id); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const lekt = LEKTIONEN.find(l => l.id === blatt);
  const i = lekt ? LEKTIONEN.indexOf(lekt) : -1;

  return (
    <ErfolgsMelder>
      <Navi.Provider value={{ gehe, niveau }}>
        <Besuch id={blatt} />
        <div className="page">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-black tracking-tight">🎲 Daten und Stochastik</h1>
              <p className="text-muted text-sm mt-1 max-w-4xl">
                Von der Strichliste bis zum Erwartungswert, aufsteigend für Kl. 5–10 nach dem Thüringer Lehrplan 2026: Daten erfassen und darstellen, Kenngrößen und Boxplot,
                eigene Umfragen auswerten, Zufallsexperimente und das Gesetz der großen Zahlen, Baumdiagramme, Venn, Vierfeldertafel, Kombinatorik und Zufallsgrößen –
                mit Übungen, fünf Spielen und Erfolgen.
              </p>
            </div>
            <div className="flex items-center gap-2">{action}</div>
          </div>

          {!festerReiter && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Klasse</span>
                <button className={`chip ${stufe === null ? "chip-on" : ""}`} onClick={() => setStufe(null)}>alle</button>
                {STUFEN.map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => setStufe(s)}>{s}</button>)}
                <span className="w-4" />
                <span className="text-xs text-muted">Niveau</span>
                <button className={`chip ${niveau === null ? "chip-on" : ""}`} onClick={() => setNiveau(null)}>alle</button>
                {(["H", "R", "G"] as Niveau[]).map(n => (
                  <button key={n} className={`chip ${niveau === n ? "chip-on" : ""}`} onClick={() => setNiveau(n)} title={NIVEAU_NAME[n]}>{n} · {NIVEAU_NAME[n]}</button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                {STUFEN.map(st => (
                  <div key={st} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-14 text-xs font-black text-muted">Kl. {st}</span>
                    <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface">
                      {LEKTIONEN.filter(l => l.stufe === st).map(l => {
                        const lg = lage(l, stufe, niveau);
                        return (
                          <button key={l.id} onClick={() => setBlatt(l.id)} title={lg === "frueher" ? "Wiederholung aus früheren Klassen" : lg === "spaeter" ? "kommt später" : lg === "anderes" ? "nicht in diesem Niveau" : undefined}
                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === l.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"} ${lg === "spaeter" || lg === "anderes" ? "opacity-40" : ""}`}>
                            {l.icon} {l.label}{lg === "frueher" && blatt !== l.id && <span className="ml-1 text-[10px]">↩</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-14" />
                  <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface">
                    {EXTRA.map(e => (
                      <button key={e.id} onClick={() => setBlatt(e.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === e.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{e.icon} {e.label}</button>
                    ))}
                  </div>
                  {niveau && <span className="flex items-center gap-1 text-xs text-muted ml-2"><NiveauMarke n={niveau} /> gewählt</span>}
                </div>
              </div>
            </>
          )}

          {lekt ? INHALT[lekt.id]() : blatt === "ueben" ? <Ueben stufe={stufe} /> : blatt === "spiel" ? <Spiele /> : <ErfolgeBlatt />}

          {!festerReiter && i >= 0 && i < LEKTIONEN.length - 1 && (
            <div className="flex justify-end">
              <button className="btn" onClick={() => gehe(LEKTIONEN[i + 1].id)}>Weiter: {LEKTIONEN[i + 1].icon} {LEKTIONEN[i + 1].label} →</button>
            </div>
          )}
        </div>
      </Navi.Provider>
    </ErfolgsMelder>
  );
}
