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
import { Diagramme, EigeneDaten, Erfassen } from "./Daten";
import Kenngroessen from "./Kenngroessen";
import Umfrage from "./Umfrage";
import { Experimente, Labor } from "./Zufall";
import { BaumBlatt, Laplace, VennBlatt } from "./Wahrscheinlichkeit";
import { Kombinatorik, Vierfelder, Zufallsgroessen } from "./Oberstufe";
import Ueben from "./Ueben";
import Spiele from "./Spiele";
import { ErfolgsMelder, Navi, useMelden } from "./ui";
import { SimKopf } from "@/components/SimKopf";

const EXTRA = [
  { id: "ueben", icon: "✍️", label: "Üben" },
  { id: "spiel", icon: "🎮", label: "Spiele" },
  { id: "erfolge", icon: "🏆", label: "Erfolge" },
] as const;
type Blatt = LektionId | (typeof EXTRA)[number]["id"];
const STUFEN_TITEL: Record<Stufe, string> = { "5/6": "Daten und erster Zufall", "7/8": "Wahrscheinlichkeit", "9/10": "Verknüpfen und Verteilen" };
const NIV_PUNKT: Record<Niveau, string> = { H: "#0ea5e9", R: "#22c55e", G: "#a855f7" };
const ZU_SCHLUESSEL = "hp_stochastik_lektionen_zu";
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
  // Lektionsübersicht ein- und ausklappen; gemerkt je Browser (nur Bequemlichkeit).
  const [zu, setZu] = useState(false);
  useEffect(() => { try { setZu(localStorage.getItem(ZU_SCHLUESSEL) === "1"); } catch { /* privat */ } }, []);
  const klappe = (x: boolean) => { setZu(x); try { localStorage.setItem(ZU_SCHLUESSEL, x ? "1" : "0"); } catch { /* privat */ } };
  const gehe = (id: LektionId) => { setBlatt(id); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  const lekt = LEKTIONEN.find(l => l.id === blatt);
  const i = lekt ? LEKTIONEN.indexOf(lekt) : -1;

  return (
    <ErfolgsMelder>
      <EigeneDaten>
      <Navi.Provider value={{ gehe, niveau }}>
        <Besuch id={blatt} />
        <div className="page">
          <SimKopf titel="🎲 Daten und Stochastik" action={action}>
            Von der Strichliste bis zum Erwartungswert, aufsteigend für Kl. 5–10 nach dem Thüringer Lehrplan 2026: Daten erfassen und darstellen, Kenngrößen und Boxplot,
            eigene Umfragen auswerten, Zufallsexperimente und das Gesetz der großen Zahlen, Baumdiagramme, Venn, Vierfeldertafel, Kombinatorik und Zufallsgrößen –
            mit Übungen, fünf Spielen und Erfolgen.
          </SimKopf>

          {!festerReiter && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Klasse</span>
                <button className={`chip ${stufe === null ? "chip-on" : ""}`} onClick={() => setStufe(null)}>alle</button>
                {STUFEN.map(s => <button key={s} className={`chip ${stufe === s ? "chip-on" : ""}`} onClick={() => setStufe(s)}>{s}</button>)}
                <span className="w-3" />
                <span className="text-xs text-muted">Niveau</span>
                <button className={`chip ${niveau === null ? "chip-on" : ""}`} onClick={() => setNiveau(null)}>alle</button>
                {(["H", "R", "G"] as Niveau[]).map(n => (
                  <button key={n} className={`chip ${niveau === n ? "chip-on" : ""}`} onClick={() => setNiveau(n)} title={NIVEAU_NAME[n]}>{n} · {NIVEAU_NAME[n]}</button>
                ))}
                <span className="flex-1" />
                <div className="inline-flex rounded-xl border border-line p-1 bg-surface">
                  {EXTRA.map(e => (
                    <button key={e.id} onClick={() => setBlatt(e.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${blatt === e.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{e.icon} {e.label}</button>
                  ))}
                </div>
              </div>
              {zu ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-1.5">
                  <button className="btn px-3 text-xl leading-none" aria-label="Vorige Lektion" disabled={i <= 0} onClick={() => gehe(LEKTIONEN[i - 1].id)}>◂</button>
                  <span className="font-bold text-sm flex-1 min-w-0 truncate">
                    {lekt ? <>
                      <span className="text-muted mr-2">Kl. {lekt.stufe}</span>
                      <span className="text-muted tabular-nums mr-1">{i + 1}</span> {lekt.icon} {lekt.label}
                    </> : <>{EXTRA.find(e => e.id === blatt)?.icon} {EXTRA.find(e => e.id === blatt)?.label}</>}
                  </span>
                  <button className="btn px-3 text-xl leading-none" aria-label="Nächste Lektion" disabled={i < 0 || i >= LEKTIONEN.length - 1} onClick={() => gehe(LEKTIONEN[i + 1].id)}>▸</button>
                  <button className="btn" aria-expanded={false} onClick={() => klappe(false)}>▾ Alle Lektionen</button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-end">
                    <button className="text-xs text-muted hover:text-fg" aria-expanded onClick={() => klappe(true)}>▴ Lektionen einklappen</button>
                  </div>
                <nav className="grid gap-3 md:grid-cols-3" aria-label="Lektionen">
                  {STUFEN.map(st => {
                    const lekts = LEKTIONEN.filter(l => l.stufe === st);
                    const aktiv = stufe === st;
                    return (
                      <div key={st} className={`rounded-2xl border bg-surface p-2 flex flex-col gap-0.5 ${aktiv ? "border-line-active ring-2 ring-accent/40" : "border-line"} ${stufe && !aktiv ? "opacity-80" : ""}`}>
                        <button onClick={() => setStufe(aktiv ? null : st)} title="Als Klassenstufe wählen"
                          className="flex items-baseline justify-between px-2 pt-1 pb-1.5 text-left">
                          <span className="font-black">Kl. {st}</span>
                          <span className="text-xs text-muted">{STUFEN_TITEL[st]}</span>
                        </button>
                        {lekts.map(l => {
                          const lg = lage(l, stufe, niveau);
                          const nr = LEKTIONEN.indexOf(l) + 1;
                          const an = blatt === l.id;
                          return (
                            <button key={l.id} onClick={() => setBlatt(l.id)}
                              title={lg === "frueher" ? "Wiederholung aus früheren Klassen" : lg === "spaeter" ? "kommt später" : lg === "anderes" ? "nicht in diesem Niveau" : undefined}
                              className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-bold text-left transition-colors ${an ? "bg-accent text-accent-fg" : "hover:bg-surface-hover"} ${lg === "spaeter" || lg === "anderes" ? "opacity-40" : ""}`}>
                              <span className={`w-5 text-center text-xs tabular-nums ${an ? "" : "text-muted"}`}>{nr}</span>
                              <span className="text-base leading-none">{l.icon}</span>
                              <span className="flex-1">{l.label}{lg === "frueher" && !an && <span className="ml-1 text-[10px] text-muted">↩</span>}</span>
                              <span className="flex gap-0.5" aria-hidden>
                                {(["H", "R", "G"] as Niveau[]).map(n => (
                                  <span key={n} className={`w-1.5 h-1.5 rounded-full ${l.niveaus.includes(n) ? "" : "opacity-20"}`} style={{ background: NIV_PUNKT[n] }} />
                                ))}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </nav>
                </div>
              )}
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
      </EigeneDaten>
    </ErfolgsMelder>
  );
}
