"use client";
/**
 * Körper — die Schulkörper der Klassen 5–10 in einem Werkzeug.
 *
 *   »Labor«          drehbar in 3D, Maße per Regler, Volumen, Oberfläche,
 *                    Mantel, Grund- und Deckfläche mit Formel und Rechenweg;
 *                    ein Klick auf eine Fläche hebt sie hervor.
 *   »Netz«           die Abwicklung zum Auf- und Zuklappen.
 *   »Linien«         Ecken, Kanten, Flächen (Euler), Höhe, Seitenhöhe,
 *                    Mantellinie, Radius und Diagonalen einzeln zuschalten.
 *   »Zusammengesetzt« Haus, Silo, Turm, Werkstück, Eistüte — auseinanderziehen
 *                    zeigt die verdeckten Flächen.
 *   »Übungen«, »Anwendungen« gewürfelt mit Schrägbild und Word-Export,
 *   »Wer fasst mehr?« das Spiel.
 *
 * Ohne WebGL steht statt der 3D-Ansicht das Schrägbild da.
 *
 * `vorgabe` (TaskCrawler-Station): { reiter?: Tab, koerper?: KoerperKey, masse?: { a: 4, h: 6 … },
 * zusammen?: ZKey } — öffnet dieses Blatt mit diesem Körper; Maße werden auf die Reglergrenzen geklemmt.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "@/lib/prozent";
import { wahl, zahlen, type Vorgabe } from "@/lib/vorgabe";
import { KOERPER, KOERPER_REIHE, euler, gl, masseIn, startMasse, type KoerperKey, type Masse } from "@/lib/koerper";
import { skizzeKoerper, skizzeNetz } from "@/lib/koerper-skizze";
import { ZUSAMMEN, Z_REIHE, skizzeZusammen, zStart, type ZKey } from "@/lib/koerper-zusammen";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung, gegeben, GENITIV } from "@/lib/koerper-aufgaben";
import Aufgabenblatt from "@/components/geometrie/Aufgabenblatt";
import { SkizzenBild } from "@/components/geometrie/Skizze";
import Raum3D from "./Raum3D";
import FassDuell from "./FassDuell";
import Renovieren from "./Renovieren";
import Fuellen from "./Fuellen";
import Risse from "./Risse";
import { FARBE, LINIENFARBE, type Ansicht, type ZAnsicht } from "./szene";

type Tab = "labor" | "netz" | "linien" | "risse" | "zusammen" | "uebungen" | "anwendungen" | "spiel" | "renovieren" | "fuellen";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "labor", label: "Körper-Labor", icon: "🧊" },
  { id: "netz", label: "Netz", icon: "📂" },
  { id: "linien", label: "Linien & Euler", icon: "📏" },
  { id: "risse", label: "Schrägbild & Risse", icon: "📐" },
  { id: "zusammen", label: "Zusammengesetzt", icon: "🏠" },
  { id: "uebungen", label: "Übungen", icon: "✍️" },
  { id: "anwendungen", label: "Anwendungen", icon: "🐠" },
  { id: "spiel", label: "Wer fasst mehr?", icon: "🚰" },
  { id: "renovieren", label: "Renovieren", icon: "🖌️" },
  { id: "fuellen", label: "Füllen", icon: "💧" },
];
const LABOR: Tab[] = ["labor", "netz", "linien"];

const zeilenVon = (s: string) => s.split("; ");
const TEIL_FARBE = (gruppe: "G" | "D" | "M") => (gruppe === "M" ? FARBE.M[0] : FARBE[gruppe]);

/** Bastelbogen als PDF: Netz mit Klebelaschen; jsPDF wird erst beim Klick geladen. */
function BastelKnopf({ k, m }: { k: KoerperKey; m: Masse }) {
  const [status, setStatus] = useState<string | null>(null);
  const los = async () => {
    setStatus("Bastelbogen wird gebaut …");
    try {
      const { bastelbogenPdf } = await import("./bastelbogenPdf");
      await bastelbogenPdf(k, m);
      setStatus(null);
    } catch (e) {
      setStatus("Export fehlgeschlagen: " + (e instanceof Error ? e.message : String(e)));
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <button className="btn btn-primary self-start" onClick={los} disabled={status !== null && !status.startsWith("Export")}>🖨️ Bastelbogen (PDF)</button>
      <span className="text-xs text-muted">Das Netz mit Klebelaschen zum Ausschneiden, Falten und Kleben, in Originalgröße auf A4 (zu große Netze werden verkleinert).</span>
      {status && <span className={`text-xs ${status.startsWith("Export") ? "text-bad" : "text-muted"}`}>{status}</span>}
    </div>
  );
}

function Regler({ felder, m, setze }: { felder: { key: string; label: string; min: number; max: number; unter?: string }[]; m: Masse; setze: (k: string, v: number) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {felder.map(f => {
        const max = f.unter ? Math.min(f.max, m[f.unter] - 0.5) : f.max;
        return (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{f.label} = <strong className="text-fg">{z(m[f.key])} cm</strong></span>
            <input type="range" min={f.min} max={max} step={0.5} value={m[f.key]} aria-label={f.label}
              onChange={e => setze(f.key, Number(e.target.value))} className="accent-accent" />
          </label>
        );
      })}
    </div>
  );
}

export default function Koerper({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  // Station mit festem Reiter: ohne Reiterleiste, wie es der TaskCrawler verspricht.
  const festerReiter = wahl(vorgabe, "reiter", TABS.map(t => t.id));
  const [tab, setTab] = useState<Tab>(festerReiter ?? "labor");
  const [key, setKey] = useState<KoerperKey>(wahl(vorgabe, "koerper", KOERPER_REIHE) ?? "quader");
  const [masseJe, setMasseJe] = useState<Partial<Record<KoerperKey, Masse>>>(() => {
    const k = wahl(vorgabe, "koerper", KOERPER_REIHE), m = zahlen(vorgabe, "masse");
    return k && m ? { [k]: m } : {};
  });
  const [auswahl, setAuswahl] = useState<string | null>(null);
  const [linien, setLinien] = useState<string[]>(["h"]);
  const [ecken, setEcken] = useState(false);
  const [kanten, setKanten] = useState(false);
  const [flaechen, setFlaechen] = useState(false);
  const [netzT, setNetzT] = useState(0.35);
  const [ziel, setZiel] = useState<number | null>(null);
  const [zkey, setZkey] = useState<ZKey>(wahl(vorgabe, "zusammen", Z_REIHE) ?? "haus");
  const [zMasse, setZMasse] = useState<Partial<Record<ZKey, Masse>>>({});
  const [auseinander, setAuseinander] = useState(0);

  const k = KOERPER[key];
  const m = useMemo(() => masseIn(k, masseJe[key] ?? startMasse(k)), [k, key, masseJe]);
  const d = useMemo(() => k.rechne(m), [k, m]);
  const zk = ZUSAMMEN[zkey];
  const zm = zMasse[zkey] ?? zStart(zk);
  const zd = zk.rechne(zm);

  // Netz auf- oder zuklappen: in rund 1,5 s zum Ziel.
  const stand = useRef(netzT);
  stand.current = netzT;
  useEffect(() => {
    if (ziel === null) return;
    let vorher = performance.now(), id = 0;
    const schritt = (jetzt: number) => {
      const t = stand.current, dt = (jetzt - vorher) / 1500;
      vorher = jetzt;
      const n = ziel > t ? Math.min(ziel, t + dt) : Math.max(ziel, t - dt);
      stand.current = n;
      setNetzT(n);
      if (n === ziel) setZiel(null);
      else id = requestAnimationFrame(schritt);
    };
    id = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(id);
  }, [ziel]);

  const ansicht: Ansicht = useMemo(() => ({
    key, m, auswahl,
    netz: tab === "netz" ? netzT : null,
    linien: tab === "linien" ? linien : [],
    ecken: tab === "linien" && ecken,
    kanten: tab === "linien" && kanten,
    flaechen: tab === "linien" && flaechen,
  }), [key, m, auswahl, tab, netzT, linien, ecken, kanten, flaechen]);
  const zAnsicht: ZAnsicht = useMemo(() => ({ zkey, m: zm, auseinander }), [zkey, zm, auseinander]);

  const waehle = (k2: KoerperKey) => { setKey(k2); setAuswahl(null); };
  const setze = (f: string, v: number) => setMasseJe(x => ({ ...x, [key]: { ...m, [f]: v } }));
  const klick = (t: string | null) => setAuswahl(a => (t && a !== t ? t : null));
  const teil = auswahl ? d.teile.find(t => t.id === auswahl) : null;
  const mantelTeile = d.teile.filter(t => t.gruppe === "M");

  // Ersatzbild ohne WebGL: Schrägbild mit den zugeschalteten Linien bzw. das flache Netz
  const texte: Record<string, string> = tab === "linien"
    ? Object.fromEntries(d.linien.filter(l => linien.includes(l.id)).map(l => [l.id, `${l.zeichen} ${gl(l.wert)} ${z(l.wert)} cm`]))
    : gegeben(key, m).texte;
  const netz2d = useMemo(() => skizzeNetz(key, m), [key, m]);
  const ersatz = tab === "netz"
    ? (netz2d ? <SkizzenBild s={netz2d} label={`Netz ${k.name}`} /> : <p className="text-muted">Die Kugel lässt sich nicht abwickeln.</p>)
    : <SkizzenBild s={skizzeKoerper(key, m, texte)} label={`Schrägbild ${k.name}`} />;

  const zTexte = Object.fromEntries(zk.felder.map(f => [f.key, `${z(zm[f.key])} cm`]));

  return (
    <div className="page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🧊 Körper</h1>
          <p className="text-muted text-sm mt-1">
            Würfel bis Kegelstumpf drehbar in 3D, mit Volumen, Oberfläche und Rechenweg, Netzen zum Aufklappen,
            besonderen Linien und zusammengesetzten Körpern — dazu Übungen und Sachaufgaben mit Word-Export und das Spiel »Wer fasst mehr?«.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {!festerReiter && <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === t.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>}

      {tab === "uebungen" && <Aufgabenblatt arten={UEBUNG_ARTEN} erzeuge={a => erzeugeUebung(a)} titel="Körper – Übungen" datei="Koerper-Uebungen.docx" />}
      {tab === "anwendungen" && <Aufgabenblatt arten={ANWENDUNG_ARTEN} erzeuge={a => erzeugeAnwendung(a)} titel="Körper – Anwendungsaufgaben" datei="Koerper-Anwendungen.docx" />}
      {tab === "risse" && <Risse />}
      {tab === "spiel" && <FassDuell />}
      {tab === "renovieren" && <Renovieren />}
      {tab === "fuellen" && <Fuellen />}

      {LABOR.includes(tab) && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Körper">
            {KOERPER_REIHE.map(x => (
              <button key={x} onClick={() => waehle(x)} title={`ab Klasse ${KOERPER[x].klasse}`}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${key === x ? "border-accent bg-accent/10 font-bold" : "border-line hover:border-accent"}`}>
                <span className="mr-1">{KOERPER[x].icon}</span>{KOERPER[x].name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
            <div className="flex flex-col gap-4">
              <Raum3D ansicht={ansicht} onKlick={klick} ersatz={ersatz} titel={k.name} />
              <Regler felder={k.felder} m={m} setze={setze} />
            </div>

            <div className="flex flex-col gap-3">
              {tab === "labor" && (
                <div className="card p-4 flex flex-col gap-3">
                  <h3 className="font-black">{k.icon} {k.name}</h3>
                  {[d.V, d.O, d.M, d.G, d.D].filter((x, i, a) => x && a.indexOf(x) === i).map(g => g && (
                    <div key={g.name} className="flex flex-col gap-0.5">
                      <div className="flex justify-between gap-2"><strong>{g.name}</strong><strong>{gl(g.wert)} {z(g.wert)} {g.einheit}</strong></div>
                      <code className="text-sm text-muted">{g.formel}</code>
                      {zeilenVon(g.rechnung).map((x, i) => <code key={i} className="text-xs rounded bg-surface-hover px-2 py-0.5">{x}</code>)}
                    </div>
                  ))}
                </div>
              )}

              {tab === "netz" && (
                <div className="card p-4 flex flex-col gap-3">
                  <h3 className="font-black">📂 Netz {GENITIV[key]}</h3>
                  {netz2d ? (
                    <>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="text-muted">Klappstand: {netzT < 0.01 ? "flach" : netzT > 0.99 ? "zugeklappt" : `${Math.round(netzT * 100)} % zu`}</span>
                        <input type="range" min={0} max={1} step={0.01} value={netzT} aria-label="Klappstand"
                          onChange={e => { setZiel(null); setNetzT(Number(e.target.value)); }} className="accent-accent" />
                      </label>
                      <div className="flex gap-2">
                        <button className="btn" onClick={() => setZiel(0)}>📂 Aufklappen</button>
                        <button className="btn" onClick={() => setZiel(1)}>📦 Zuklappen</button>
                      </div>
                      <BastelKnopf k={key} m={m} />
                      <p className="text-sm text-muted">
                        Das Netz besteht aus allen Flächen des Körpers. Seine Fläche ist genau die Oberfläche:
                        O {gl(d.O.wert)} {z(d.O.wert)} cm².
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">
                      Eine Kugelfläche ist in alle Richtungen gekrümmt. Sie lässt sich nicht ohne Dehnen flach legen — darum
                      ist jede Weltkarte verzerrt. Die Oberfläche rechnet man mit O = 4 · π · r².
                    </p>
                  )}
                </div>
              )}

              {tab === "linien" && (
                <div className="card p-4 flex flex-col gap-3">
                  <h3 className="font-black">📏 Notation</h3>
                  <div className="flex flex-wrap gap-2">
                    <button className={`chip ${ecken ? "chip-on" : ""}`} aria-pressed={ecken} onClick={() => setEcken(x => !x)}>● Ecken e = {d.zaehlung.e}</button>
                    <button className={`chip ${kanten ? "chip-on" : ""}`} aria-pressed={kanten} onClick={() => setKanten(x => !x)}>━ Kanten k = {d.zaehlung.k}</button>
                    <button className={`chip ${flaechen ? "chip-on" : ""}`} aria-pressed={flaechen} onClick={() => setFlaechen(x => !x)}>▰ Flächen f = {d.zaehlung.f}</button>
                  </div>
                  <div className="rounded-lg bg-surface-hover px-3 py-2 text-sm">
                    {d.zaehlung.polyeder
                      ? <><strong>Eulerscher Polyedersatz:</strong> <code>{euler(d.zaehlung)}</code> ✔<br /><span className="text-muted">Das gilt für jeden Körper mit ebenen Flächen ohne Löcher.</span></>
                      : <><strong>Kein Polyeder.</strong> {d.zaehlung.hinweis}</>}
                  </div>
                  <div className="flex flex-col gap-1.5" role="group" aria-label="Linien">
                    {d.linien.map(l => {
                      const an = linien.includes(l.id);
                      return (
                        <label key={l.id} className="flex items-start gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={an} onChange={() => setLinien(x => (an ? x.filter(y => y !== l.id) : [...x, l.id]))} className="mt-1" />
                          <span className="w-3 h-3 mt-1 rounded-full shrink-0" style={{ background: LINIENFARBE[l.id] ?? FARBE.verdeckt }} />
                          <span className="flex-1">
                            <strong>{l.zeichen}</strong> — {l.name} {gl(l.wert)} {z(l.wert)} cm
                            {l.formel && <code className="block text-xs text-muted">{l.formel}</code>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button className="btn self-start" onClick={() => setLinien(linien.length ? [] : d.linien.map(l => l.id))}>{linien.length ? "Alle aus" : "Alle an"}</button>
                </div>
              )}

              {tab !== "linien" && (
                <div className="card p-4 flex flex-col gap-2">
                  <h3 className="font-black">Teilflächen <span className="text-xs text-muted font-normal">— anklicken, auch im Bild</span></h3>
                  <div className="flex flex-wrap gap-1.5">
                    {d.teile.map(t => (
                      <button key={t.id} className={`chip ${auswahl === t.id ? "chip-on" : ""}`} aria-pressed={auswahl === t.id}
                        onClick={() => klick(t.id)}>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-1" style={{ background: TEIL_FARBE(t.gruppe) }} />{t.name}
                      </button>
                    ))}
                    {mantelTeile.length > 1 && (
                      <button className={`chip ${auswahl === "M" ? "chip-on" : ""}`} aria-pressed={auswahl === "M"} onClick={() => klick("M")}>ganzer Mantel</button>
                    )}
                  </div>
                  {auswahl === "M" && mantelTeile.length > 1 && (
                    <div className="rounded-lg border-2 px-3 py-2 text-sm flex flex-col gap-0.5" style={{ borderColor: FARBE.wahl }}>
                      <strong>Mantelfläche: {mantelTeile.length} Seitenflächen</strong>
                      <code>{d.M.formel}</code>
                      {zeilenVon(d.M.rechnung).map((x, i) => <code key={i} className="text-xs">{x}</code>)}
                    </div>
                  )}
                  {teil && (
                    <div className="rounded-lg border-2 px-3 py-2 text-sm flex flex-col gap-0.5" style={{ borderColor: FARBE.wahl }}>
                      <strong>{teil.name} · {teil.form}</strong>
                      <code>{teil.formel}</code>
                      {zeilenVon(teil.rechnung).map((x, i) => <code key={i} className="text-xs">{x}</code>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === "zusammen" && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Zusammengesetzte Körper">
            {Z_REIHE.map(x => (
              <button key={x} onClick={() => { setZkey(x); setAuseinander(0); }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${zkey === x ? "border-accent bg-accent/10 font-bold" : "border-line hover:border-accent"}`}>
                <span className="mr-1">{ZUSAMMEN[x].icon}</span>{ZUSAMMEN[x].name}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
            <div className="flex flex-col gap-4">
              <Raum3D ansicht={zAnsicht} ersatz={<SkizzenBild s={skizzeZusammen(zkey, zm, zTexte)} label={`Schrägbild ${zk.name}`} />} titel={zk.name} />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Auseinanderziehen — die roten Flächen sind im fertigen Körper verdeckt</span>
                <input type="range" min={0} max={1} step={0.01} value={auseinander} aria-label="Auseinanderziehen"
                  onChange={e => setAuseinander(Number(e.target.value))} className="accent-accent" />
              </label>
              <Regler felder={zk.felder} m={zm} setze={(f, v) => setZMasse(x => ({ ...x, [zkey]: { ...zm, [f]: v } }))} />
            </div>
            <div className="card p-4 flex flex-col gap-3 text-sm">
              <h3 className="font-black">{zk.icon} {zk.name} <span className="font-normal text-muted">= {zk.aus}</span></h3>
              {([["Volumen", zd.vZeilen, zd.V, "cm³"], ["Oberfläche", zd.oZeilen, zd.O, "cm²"]] as const).map(([name, zs, w, e]) => (
                <div key={name} className="flex flex-col gap-1">
                  <strong>{name}</strong>
                  {zs.map((x, i) => (
                    <div key={i} className={`rounded px-2 py-1 bg-surface-hover ${x.minus ? "border-l-4 border-bad" : ""}`}>
                      <span className="font-bold">{x.minus ? "−" : "+"} {x.text}</span>
                      {zeilenVon(x.rechnung).map((y, j) => <code key={j} className="block text-xs">{y}</code>)}
                    </div>
                  ))}
                  <div className="flex justify-between font-black border-t border-line pt-1"><span>{name === "Volumen" ? "V" : "O"}</span><span>{gl(w)} {z(w)} {e}</span></div>
                </div>
              ))}
              <p className="rounded-lg border-2 px-3 py-2" style={{ borderColor: FARBE.verdeckt }}>🔴 {zd.verdeckt}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
