"use client";
/**
 * Diagramm-Werkstatt: Ablaufdiagramme und Mindmaps mit D2.
 *
 * Zwei Wege zum selben Code: im Bausteine-Modus klicken Schüler·innen Knoten
 * an, verbinden sie und färben sie ein; im Code-Modus schreiben sie D2 selbst.
 * Beide arbeiten auf demselben Text (siehe lib/diagramm/d2modell.ts), das
 * Diagramm daneben wird bei jeder Änderung neu gesetzt.
 *
 * Die Blätter liegen im Browser (localStorage) und lassen sich als .d2-Datei
 * speichern und wieder öffnen; dazu SVG- und PNG-Export.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  alleKnoten, einstellen, findeKnoten, kanteHinzufuegen, kanteLoeschen, kanteSetzen,
  kanteZuVerbindung, klasseZuId, idZuKlasse, knotenHinzufuegen, knotenLoeschen, knotenSetzen,
  parse, serialize, type Modell, type Pfeil,
} from "@/lib/diagramm/d2modell";
import { zeichne, fehlerLesen, type D2Fehler, type Ergebnis } from "@/lib/diagramm/d2laufzeit";
import { DIAGRAMM_IMPORT, FARBEN, FORMEN, RICHTUNGEN, THEMEN, VORLAGEN } from "@/lib/diagramm/vorlagen";
import { CodeFeld } from "./CodeFeld";
import { Spickzettel } from "./Spickzettel";
import { KiPrompt } from "./KiPrompt";
import { useNeigung } from "@/lib/diagramm/neigung";

const SPEICHER = "hp_diagramme";

/**
 * 3D-Ansicht: Hintergrund (Farbschlieren), Schatten und Diagrammkarte liegen in
 * verschiedenen Tiefen; useNeigung kippt die Bühne per --nx/--ny, dadurch
 * verschieben sich die Ebenen gegeneinander. Knoten heben sich beim Überfahren.
 */
const TIEFE_CSS = `
.d2-buehne[data-tiefe]{perspective:1100px;padding:28px;
  background:
    radial-gradient(40% 55% at calc(28% - var(--nx,0)*5%) calc(30% - var(--ny,0)*5%), color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%),
    radial-gradient(45% 55% at calc(76% - var(--nx,0)*8%) calc(72% - var(--ny,0)*8%), color-mix(in srgb, #8b5cf6 16%, transparent), transparent 70%),
    var(--surface-hover);}
.d2-buehne[data-tiefe] .d2-ebenen{transform-style:preserve-3d;
  transform:rotateX(calc(var(--ny,0) * -5deg)) rotateY(calc(var(--nx,0) * 7deg));}
.d2-buehne[data-tiefe] .d2-schatten{position:absolute;inset:6% 4%;border-radius:18px;pointer-events:none;
  background:rgb(15 23 42 / .38);filter:blur(24px);
  transform:translate3d(calc(var(--nx,0) * -16px), calc(var(--ny,0) * -12px + 20px), -70px);}
.d2-buehne[data-tiefe] .d2-karte{position:relative;transform:translateZ(0);border-radius:14px;overflow:hidden;
  box-shadow:0 0 0 1px rgb(255 255 255 / .35) inset, 0 2px 8px rgb(0 0 0 / .10);}
.d2-buehne[data-tiefe] .d2-karte::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(115deg, transparent 38%, rgb(255 255 255 / .16) 50%, transparent 62%);
  background-size:260% 100%;background-position:calc(50% + var(--nx,0) * 40%) 0;}
.d2-buehne[data-tiefe] .d2-karte g[class]:has(> g.shape){transform-box:fill-box;transform-origin:center;
  transition:transform .5s cubic-bezier(.34,1.56,.64,1);}
.d2-buehne[data-tiefe] .d2-karte g[class]:has(> g.shape):hover{transform:translateY(-3px) scale(1.035);}
`;

interface Blatt { id: string; name: string; code: string; geaendert: number }
interface Ablage { aktiv: string; liste: Blatt[] }

const neueId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function neuesBlatt(name: string, code: string): Blatt {
  return { id: neueId(), name, code, geaendert: Date.now() };
}

function ladeAblage(): Ablage {
  const ablage = ladeGespeichert();
  // Übergabe aus einem anderen Werkzeug als neues, aktives Blatt. Der Schlüssel
  // bleibt bis nach dem Speichern liegen: StrictMode ruft diese Funktion doppelt auf.
  try {
    const imp = JSON.parse(localStorage.getItem(DIAGRAMM_IMPORT) ?? "null") as { name?: unknown; code?: unknown } | null;
    if (imp && typeof imp.code === "string") {
      const b = neuesBlatt(typeof imp.name === "string" ? imp.name : "Übernommenes Diagramm", imp.code);
      return { aktiv: b.id, liste: [b, ...ablage.liste] };
    }
  } catch { /* kaputt oder gesperrt */ }
  return ablage;
}

function ladeGespeichert(): Ablage {
  try {
    const a = JSON.parse(localStorage.getItem(SPEICHER) ?? "null") as Ablage | null;
    if (a?.liste?.length) return a.liste.some(b => b.id === a.aktiv) ? a : { ...a, aktiv: a.liste[0].id };
  } catch { /* leer oder gesperrt */ }
  const b = neuesBlatt("Mein erstes Diagramm", VORLAGEN.find(v => v.id === "mindmap")!.code);
  return { aktiv: b.id, liste: [b] };
}

type Auswahl = { art: "knoten"; id: string } | { art: "kante"; id: string } | null;

const chip = (an: boolean) => `chip text-sm ${an ? "chip-on" : ""}`;

function herunterladen(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateiname(name: string) {
  return (name.trim() || "diagramm").replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_");
}

function viewBoxBreite(svg: string): number {
  const m = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) [\d.]+"/.exec(svg);
  return m ? Number(m[1]) : 800;
}

export default function DiagrammWerkstatt({ action }: { action?: ReactNode }) {
  const [ablage, setAblage] = useState<Ablage>(ladeAblage);
  const blatt = ablage.liste.find(b => b.id === ablage.aktiv)!;
  const code = blatt.code;
  const [modus, setModus] = useState<"bausteine" | "code">("bausteine");
  const [auswahl, setAuswahl] = useState<Auswahl>(null);
  const [verbinden, setVerbinden] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  /** Der Code, zu dem `ergebnis` gehört (beim Tippen hinkt das Bild hinterher). */
  const [gezeichnet, setGezeichnet] = useState<string | null>(null);
  const [fehler, setFehler] = useState<D2Fehler[]>([]);
  const [laedt, setLaedt] = useState(true);
  /** Von Hand gewählter Zoom; null = passt sich jedem neuen Bild an. */
  const [handZoom, setZoom] = useState<number | null>(null);
  const [passend, setPassend] = useState(1);
  const [tiefe, setTiefe] = useState(true);
  const [verlauf, setVerlauf] = useState<{ zurueck: string[]; vor: string[] }>({ zurueck: [], vor: [] });
  const letzteAenderung = useRef(0);
  const labelFeld = useRef<HTMLInputElement>(null);
  const codeFeld = useRef<HTMLTextAreaElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(ablage));
      localStorage.removeItem(DIAGRAMM_IMPORT);
    } catch { /* voll oder gesperrt */ }
  }, [ablage]);

  const modell = useMemo(() => parse(code), [code]);

  /** Neuer Code fürs aktive Blatt; Tippen innerhalb einer Sekunde ist ein Rückgängig-Schritt. */
  const setzeCode = useCallback((neu: string, zusammenfassen = false) => {
    if (neu === code) return;
    const jetzt = Date.now();
    if (!zusammenfassen || jetzt - letzteAenderung.current > 1000) {
      setVerlauf(v => ({ zurueck: [...v.zurueck.slice(-99), code], vor: [] }));
    }
    letzteAenderung.current = jetzt;
    setAblage(a => ({ ...a, liste: a.liste.map(b => (b.id === a.aktiv ? { ...b, code: neu, geaendert: jetzt } : b)) }));
  }, [code]);

  const aendere = (m: Modell, zusammenfassen = false) => setzeCode(serialize(m), zusammenfassen);

  const rueckgaengig = () => {
    const vorher = verlauf.zurueck.at(-1);
    if (vorher === undefined) return;
    setVerlauf(v => ({ zurueck: v.zurueck.slice(0, -1), vor: [code, ...v.vor] }));
    setAblage(a => ({ ...a, liste: a.liste.map(b => (b.id === a.aktiv ? { ...b, code: vorher } : b)) }));
  };
  const wiederholen = () => {
    const nach = verlauf.vor[0];
    if (nach === undefined) return;
    setVerlauf(v => ({ zurueck: [...v.zurueck, code], vor: v.vor.slice(1) }));
    setAblage(a => ({ ...a, liste: a.liste.map(b => (b.id === a.aktiv ? { ...b, code: nach } : b)) }));
  };

  // Zeichnen: kurz warten, damit nicht jeder Tastendruck einen Durchlauf auslöst.
  const lauf = useRef(0);
  useEffect(() => {
    const nr = ++lauf.current;
    const t = setTimeout(() => {
      zeichne(code)
        .then(r => { if (nr === lauf.current) { setErgebnis(r); setGezeichnet(code); setFehler([]); } })
        .catch(e => { if (nr === lauf.current) setFehler(fehlerLesen(e)); })
        .finally(() => { if (nr === lauf.current) setLaedt(false); });
    }, ergebnis ? 250 : 0);
    return () => clearTimeout(t);
    // ergebnis nur für die erste Verzögerung — kein Neuzeichnen deswegen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const formIds = useMemo(() => new Set(ergebnis?.formen.map(f => f.id)), [ergebnis]);
  const verbIds = useMemo(() => new Set(ergebnis?.verbindungen.map(v => v.id)), [ergebnis]);

  // Auswahl verwerfen, wenn es das Gewählte im aktuellen Bild nicht mehr gibt
  useEffect(() => {
    if (!ergebnis || !auswahl || gezeichnet !== code) return;
    if (auswahl.art === "knoten" ? !formIds.has(auswahl.id) : !verbIds.has(auswahl.id)) setAuswahl(null);
  }, [ergebnis, gezeichnet, code, auswahl, formIds, verbIds]);

  const breite = ergebnis ? viewBoxBreite(ergebnis.svg) : 800;
  useEffect(() => {
    const w = flaeche.current?.clientWidth ?? 800;
    setPassend(Math.min(1, (w - (tiefe ? 72 : 16)) / breite));
  }, [breite, ergebnis, tiefe]);
  const zoom = handZoom ?? passend;
  useNeigung(flaeche, tiefe);

  /* ---------------------------------------------------------- Bearbeiten */

  const belegt = () => ergebnis?.formen.map(f => f.id) ?? [];

  const knotenNeu = (shape: string, label: string) => {
    const { modell: m, id } = knotenHinzufuegen(modell, label, belegt(), shape === "rectangle" ? undefined : shape);
    // Ist ein Knoten gewählt, hängt der neue gleich an ihm — so wächst eine Mindmap.
    const fertig = auswahl?.art === "knoten" ? kanteHinzufuegen(m, auswahl.id, id).modell : m;
    aendere(fertig);
    setAuswahl({ art: "knoten", id });
    setModus("bausteine");
    setTimeout(() => { labelFeld.current?.focus(); labelFeld.current?.select(); }, 50);
  };

  const loeschen = () => {
    if (!auswahl) return;
    if (auswahl.art === "knoten") aendere(knotenLoeschen(modell, auswahl.id));
    else {
      const k = ergebnis && kanteZuVerbindung(modell, ergebnis.verbindungen, auswahl.id);
      if (k) aendere(kanteLoeschen(modell, k.uid));
    }
    setAuswahl(null);
  };

  /** Knoten oder Verbindung unter dem Mauszeiger (innerster Treffer zuerst). */
  const treffer = (ziel: EventTarget, bis: EventTarget): Auswahl => {
    let el = ziel as Element | null;
    while (el && el !== bis) {
      const id = el.tagName.toLowerCase() === "g" ? klasseZuId(el.getAttribute("class") ?? "") : null;
      if (id && formIds.has(id)) return { art: "knoten", id };
      if (id && verbIds.has(id)) return { art: "kante", id };
      el = el.parentElement;
    }
    return null;
  };

  const klick = (e: React.MouseEvent) => {
    const t = treffer(e.target, e.currentTarget);
    if (t?.art === "knoten" && verbinden) aendere(kanteHinzufuegen(modell, verbinden, t.id).modell);
    setVerbinden(null);
    setAuswahl(t);
  };

  // Mülleimer über der Verbindung, auf der die Maus gerade steht
  const [schwebe, setSchwebe] = useState<{ id: string; x: number; y: number } | null>(null);
  const schwebeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const schwebeHalten = () => clearTimeout(schwebeTimer.current);
  const schwebeLoslassen = () => { schwebeTimer.current = setTimeout(() => setSchwebe(null), 400); };

  const ueber = (e: React.MouseEvent) => {
    const t = treffer(e.target, e.currentTarget);
    if (t?.art !== "kante" || !ergebnis || !kanteZuVerbindung(modell, ergebnis.verbindungen, t.id)) return;
    schwebeHalten();
    if (schwebe?.id === t.id) return;
    const g = (e.target as Element).closest("g[class]")!;
    const pfad = [...g.querySelectorAll("path")].find(p => p.getTotalLength() > 0);
    // In Diagramm-Koordinaten statt Bildschirm: getScreenCTM verrutscht, wenn die 3D-Ansicht kippt.
    const matrix = pfad?.getCTM();
    if (!pfad || !matrix) return;
    const mitte = pfad.getPointAtLength(pfad.getTotalLength() / 2);
    const p = new DOMPoint(mitte.x, mitte.y).matrixTransform(matrix);
    setSchwebe({ id: t.id, x: p.x * zoom, y: p.y * zoom });
  };

  const kanteWeg = (id: string) => {
    const k = ergebnis && kanteZuVerbindung(modell, ergebnis.verbindungen, id);
    if (k) aendere(kanteLoeschen(modell, k.uid));
    if (auswahl?.id === id) setAuswahl(null);
    setSchwebe(null);
  };

  // Verbindungen sind dünne Linien: jede bekommt eine breite, unsichtbare Trefferfläche.
  const svgBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = svgBox.current;
    if (!box || !ergebnis) return;
    setSchwebe(null);
    for (const g of box.querySelectorAll("g[class]")) {
      const id = klasseZuId(g.getAttribute("class") ?? "");
      const pfad = id && verbIds.has(id) ? g.querySelector("path") : null;
      if (!pfad || g.querySelector("[data-treffer]")) continue;
      const flaechePfad = document.createElementNS("http://www.w3.org/2000/svg", "path");
      flaechePfad.setAttribute("d", pfad.getAttribute("d") ?? "");
      flaechePfad.setAttribute("fill", "none");
      flaechePfad.setAttribute("stroke", "transparent");
      flaechePfad.setAttribute("stroke-width", "16");
      flaechePfad.setAttribute("pointer-events", "stroke");
      flaechePfad.setAttribute("data-treffer", "");
      g.appendChild(flaechePfad);
    }
  }, [ergebnis, verbIds]);

  const doppelklick = (e: React.MouseEvent) => {
    klick(e);
    setModus("bausteine");
    setTimeout(() => { labelFeld.current?.focus(); labelFeld.current?.select(); }, 50);
  };

  // Entf löscht die Auswahl, Esc bricht das Verbinden ab, Strg+Z/Y
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const imFeld = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT";
      if (e.key === "Escape") { setVerbinden(null); return; }
      if (imFeld) return;
      if (e.key === "Delete" || e.key === "Backspace") { if (auswahl) { e.preventDefault(); loeschen(); } }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) wiederholen(); else rueckgaengig(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); wiederholen(); }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  });

  /* ------------------------------------------------------------- Ablage */

  const blattWechseln = (id: string) => {
    setAblage(a => ({ ...a, aktiv: id }));
    setVerlauf({ zurueck: [], vor: [] });
    setAuswahl(null);
    setZoom(null);
  };

  const blattNeu = (vorlageId: string) => {
    const v = VORLAGEN.find(x => x.id === vorlageId);
    if (!v) return;
    const b = neuesBlatt(v.id === "leer" ? "Neues Diagramm" : v.name, v.code);
    setAblage(a => ({ aktiv: b.id, liste: [...a.liste, b] }));
    setVerlauf({ zurueck: [], vor: [] });
    setAuswahl(null);
    setZoom(null);
  };

  const blattLoeschen = () => {
    if (!window.confirm(`»${blatt.name}« wirklich löschen?`)) return;
    setAblage(a => {
      const rest = a.liste.filter(b => b.id !== a.aktiv);
      const liste = rest.length ? rest : [neuesBlatt("Neues Diagramm", "")];
      return { aktiv: liste[0].id, liste };
    });
    setVerlauf({ zurueck: [], vor: [] });
    setAuswahl(null);
  };

  const umbenennen = (name: string) =>
    setAblage(a => ({ ...a, liste: a.liste.map(b => (b.id === a.aktiv ? { ...b, name } : b)) }));

  const dateiOeffnen = async (f: File | undefined) => {
    if (!f) return;
    const text = await f.text();
    const b = neuesBlatt(f.name.replace(/\.d2$/i, ""), text);
    setAblage(a => ({ aktiv: b.id, liste: [...a.liste, b] }));
    setVerlauf({ zurueck: [], vor: [] });
    setAuswahl(null);
    setZoom(null);
  };

  const alsSvg = () => ergebnis && herunterladen(`${dateiname(blatt.name)}.svg`, new Blob([ergebnis.svg], { type: "image/svg+xml" }));
  const alsD2 = () => herunterladen(`${dateiname(blatt.name)}.d2`, new Blob([code], { type: "text/plain" }));
  const alsPng = () => {
    if (!ergebnis) return;
    const url = URL.createObjectURL(new Blob([ergebnis.svg], { type: "image/svg+xml" }));
    const bild = new Image();
    bild.onload = () => {
      const faktor = 2;
      const c = document.createElement("canvas");
      c.width = bild.naturalWidth * faktor || breite * faktor;
      c.height = bild.naturalHeight * faktor || 600 * faktor;
      const g = c.getContext("2d")!;
      g.drawImage(bild, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b && herunterladen(`${dateiname(blatt.name)}.png`, b), "image/png");
    };
    bild.src = url;
  };

  /* ----------------------------------------------------------- Ansicht */

  const s = modell.einstellungen;
  const knoten = auswahl?.art === "knoten" ? auswahl.id : null;
  const kante = auswahl?.art === "kante" && ergebnis ? kanteZuVerbindung(modell, ergebnis.verbindungen, auswahl.id) : undefined;
  const knotenDaten = knoten ? findeKnoten(modell, knoten) : undefined;
  const knotenLabel = knoten ? (knotenDaten?.label ?? ergebnis?.formen.find(f => f.id === knoten)?.label ?? knoten) : "";

  const hervorheben = [
    auswahl && `g[class="${idZuKlasse(auswahl.id)}"]{filter:drop-shadow(0 0 3px #f59e0b) drop-shadow(0 0 6px #f59e0b)}`,
    verbinden && `g[class="${idZuKlasse(verbinden)}"]{filter:drop-shadow(0 0 3px #22c55e) drop-shadow(0 0 6px #22c55e)}`,
  ].filter(Boolean).map(r => `[data-d2-flaeche] ${r}`).join("\n");

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔀 Diagramm-Werkstatt</h1>
          <p className="text-muted text-sm mt-1">
            Ablaufdiagramme und Mindmaps — mit Bausteinen zusammenklicken oder in D2 selbst schreiben.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {/* Ablage */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={ablage.aktiv} onChange={e => blattWechseln(e.target.value)} aria-label="Diagramm wählen">
          {ablage.liste.map(b => <option key={b.id} value={b.id}>{b.name || "(ohne Namen)"}</option>)}
        </select>
        <input className="input w-48" value={blatt.name} onChange={e => umbenennen(e.target.value)} aria-label="Name des Diagramms" />
        <select className="input w-auto" value="" onChange={e => blattNeu(e.target.value)} aria-label="Neues Diagramm">
          <option value="">＋ Neu …</option>
          {VORLAGEN.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <button className="btn-secondary text-sm" onClick={blattLoeschen} title="Dieses Diagramm löschen">🗑</button>
        <span className="w-px h-6 bg-line mx-1" />
        <button className="btn-secondary text-sm" onClick={rueckgaengig} disabled={!verlauf.zurueck.length} title="Rückgängig (Strg+Z)">↶</button>
        <button className="btn-secondary text-sm" onClick={wiederholen} disabled={!verlauf.vor.length} title="Wiederholen (Strg+Y)">↷</button>
        <span className="flex-1" />
        <button className="btn-secondary text-sm" onClick={alsPng} disabled={!ergebnis}>⬇ PNG</button>
        <button className="btn-secondary text-sm" onClick={alsSvg} disabled={!ergebnis}>⬇ SVG</button>
        <button className="btn-secondary text-sm" onClick={alsD2}>⬇ .d2</button>
        <button className="btn-secondary text-sm" onClick={() => dateiFeld.current?.click()}>📂 Öffnen</button>
        <input ref={dateiFeld} type="file" accept=".d2,text/plain" className="hidden"
          onChange={e => { void dateiOeffnen(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr] items-start">
        {/* Linke Spalte: Bausteine oder Code */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="inline-flex self-start rounded-xl border border-line p-1 bg-surface">
            <button className={chip(modus === "bausteine")} onClick={() => setModus("bausteine")}>🧩 Bausteine</button>
            <button className={chip(modus === "code")} onClick={() => setModus("code")}>⌨️ Code</button>
          </div>

          <details className="group card px-3 py-2">
            <summary className="cursor-pointer text-sm font-bold list-none flex items-center gap-2">
              <span className="transition-transform group-open:rotate-90">▶</span>
              🤖 Prompt für eine KI
            </summary>
            <KiPrompt code={code} />
          </details>

          {modus === "bausteine" ? (
            <>
              <div className="card p-3 flex flex-col gap-2">
                <div className="text-sm font-bold">Hinzufügen</div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary text-sm" onClick={() => knotenNeu("rectangle", "Schritt")}>▭ Schritt</button>
                  <button className="btn-secondary text-sm" onClick={() => knotenNeu("oval", "Start")}>⬭ Start/Ende</button>
                  <button className="btn-secondary text-sm" onClick={() => knotenNeu("diamond", "Frage?")}>◇ Entscheidung</button>
                  <button className="btn-secondary text-sm" onClick={() => knotenNeu("parallelogram", "Eingabe")}>▱ Ein-/Ausgabe</button>
                </div>
                <p className="text-xs text-muted">
                  {knoten ? "Der neue Knoten wird gleich mit dem gewählten verbunden — so wächst eine Mindmap Ast für Ast." : "Tipp: Erst einen Knoten anklicken, dann hängt der neue direkt daran."}
                </p>
              </div>

              {verbinden && (
                <div className="card p-3 text-sm border-ok">
                  🔗 Jetzt den <b>Zielknoten</b> im Diagramm anklicken. <button className="underline ml-1" onClick={() => setVerbinden(null)}>Abbrechen</button>
                </div>
              )}

              {knoten && (
                <div className="card p-3 flex flex-col gap-3">
                  <div className="text-sm font-bold">Knoten <code className="text-muted font-normal">{knoten}</code></div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="label">Text</span>
                    <input ref={labelFeld} className="input" value={knotenLabel}
                      onChange={e => aendere(knotenSetzen(modell, knoten, "label", e.target.value), true)} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="label">Form</span>
                    <select className="input" value={knotenDaten?.shape ?? "rectangle"}
                      onChange={e => aendere(knotenSetzen(modell, knoten, "shape", e.target.value === "rectangle" ? undefined : e.target.value))}>
                      {FORMEN.map(f => <option key={f.id} value={f.id}>{f.name}{f.hinweis ? ` — ${f.hinweis}` : ""}</option>)}
                    </select>
                  </label>
                  <Farbwahl titel="Füllfarbe" wert={knotenDaten?.stil.fill} setze={w => aendere(knotenSetzen(modell, knoten, "style.fill", w))} />
                  <Farbwahl titel="Rahmenfarbe" wert={knotenDaten?.stil.stroke} setze={w => aendere(knotenSetzen(modell, knoten, "style.stroke", w))} />
                  <Farbwahl titel="Schriftfarbe" wert={knotenDaten?.stil["font-color"]} setze={w => aendere(knotenSetzen(modell, knoten, "style.font-color", w))} />
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Haken titel="gestrichelt" an={!!knotenDaten?.stil["stroke-dash"]} setze={an => aendere(knotenSetzen(modell, knoten, "style.stroke-dash", an ? "3" : undefined))} />
                    <Haken titel="fett" an={knotenDaten?.stil.bold === "true"} setze={an => aendere(knotenSetzen(modell, knoten, "style.bold", an ? "true" : undefined))} />
                    <Haken titel="Schatten" an={knotenDaten?.stil.shadow === "true"} setze={an => aendere(knotenSetzen(modell, knoten, "style.shadow", an ? "true" : undefined))} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary text-sm" onClick={() => setVerbinden(knoten)}>🔗 Verbinden mit …</button>
                    <button className="btn-danger text-sm" onClick={loeschen}>🗑 Löschen</button>
                  </div>
                </div>
              )}

              {auswahl?.art === "kante" && (
                <div className="card p-3 flex flex-col gap-3">
                  <div className="text-sm font-bold">Verbindung</div>
                  {kante ? (
                    <>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="label">Beschriftung</span>
                        <input className="input" value={kante.label ?? ""} placeholder="z. B. ja / nein"
                          onChange={e => aendere(kanteSetzen(modell, kante.uid, "label", e.target.value), true)} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="label">Pfeil</span>
                        <select className="input" value={kante.pfeil}
                          onChange={e => aendere(kanteSetzen(modell, kante.uid, "pfeil", e.target.value as Pfeil))}>
                          <option value="->">A → B</option>
                          <option value="<-">A ← B</option>
                          <option value="<->">A ↔ B</option>
                          <option value="--">A — B (ohne Spitze)</option>
                        </select>
                      </label>
                      <Farbwahl titel="Linienfarbe" wert={kante.stil.stroke} setze={w => aendere(kanteSetzen(modell, kante.uid, "style.stroke", w))} />
                      <div className="flex flex-wrap gap-3 text-sm">
                        <Haken titel="gestrichelt" an={!!kante.stil["stroke-dash"]} setze={an => aendere(kanteSetzen(modell, kante.uid, "style.stroke-dash", an ? "3" : undefined))} />
                        <Haken titel="dick" an={kante.stil["stroke-width"] === "4"} setze={an => aendere(kanteSetzen(modell, kante.uid, "style.stroke-width", an ? "4" : undefined))} />
                        <Haken titel="animiert" an={kante.stil.animated === "true"} setze={an => aendere(kanteSetzen(modell, kante.uid, "style.animated", an ? "true" : undefined))} />
                      </div>
                      <button className="btn-danger text-sm self-start" onClick={loeschen}>🗑 Löschen</button>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Diese Verbindung steht in einer Schreibweise, die nur im Code bearbeitet werden kann.</p>
                  )}
                </div>
              )}

              {!auswahl && !verbinden && (
                <p className="text-sm text-muted px-1">
                  Klicke im Diagramm auf einen Knoten oder eine Verbindung, um sie zu bearbeiten. Doppelklick ändert den Text.
                  {alleKnoten(modell).length === 0 && !ergebnis?.formen.length && " Das Blatt ist noch leer — fang oben mit einem Knoten an."}
                </p>
              )}
            </>
          ) : (
            <div className="card p-3 flex flex-col gap-2">
              <CodeFeld ref={codeFeld} code={code} setze={c => setzeCode(c, true)}
                fehlerZeilen={new Set(fehler.flatMap(f => (f.zeile ? [f.zeile] : [])))} />
              <details className="group rounded-lg border border-line px-3 py-2">
                <summary className="cursor-pointer text-sm font-bold list-none flex items-center gap-2">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  📄 Spickzettel — so schreibst du D2
                </summary>
                <Spickzettel />
              </details>
            </div>
          )}

          {/* Aussehen — gilt fürs ganze Diagramm, steht im Code unter vars */}
          <div className="card p-3 flex flex-col gap-2">
            <div className="text-sm font-bold">Aussehen</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                <span className="label">Farbthema</span>
                <select className="input" value={s.theme ?? 0} onChange={e => aendere(einstellen(modell, "theme", Number(e.target.value) || undefined))}>
                  {THEMEN.map(t => <option key={t.id} value={t.id}>{t.name}{t.dunkel ? " (dunkel)" : ""}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Richtung</span>
                <select className="input" value={s.direction ?? "down"} onChange={e => aendere(einstellen(modell, "direction", e.target.value === "down" ? undefined : e.target.value))}>
                  {RICHTUNGEN.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Anordnung</span>
                <select className="input" value={s.layout ?? "dagre"} onChange={e => aendere(einstellen(modell, "layout", e.target.value === "dagre" ? undefined : e.target.value))}>
                  <option value="dagre">Standard</option>
                  <option value="elk">Kompakt (ELK)</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input type="checkbox" checked={!!s.sketch} onChange={e => aendere(einstellen(modell, "sketch", e.target.checked || undefined))} />
                <span>✏️ Handgezeichnet</span>
              </label>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: das Diagramm */}
        <div className="card p-2 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 px-1 text-sm">
            <button className="btn-secondary text-sm" onClick={() => setZoom(Math.max(0.2, zoom / 1.25))} aria-label="Verkleinern">−</button>
            <span className="tabular-nums w-12 text-center">{Math.round(zoom * 100)} %</span>
            <button className="btn-secondary text-sm" onClick={() => setZoom(Math.min(4, zoom * 1.25))} aria-label="Vergrößern">＋</button>
            <button className="btn-secondary text-sm" onClick={() => setZoom(null)}>Einpassen</button>
            <button className={chip(tiefe)} onClick={() => setTiefe(!tiefe)} title="Leicht räumliche Ansicht, folgt der Maus">🌊 3D</button>
            <span className="flex-1" />
            {laedt && <span className="text-muted">D2 wird geladen …</span>}
          </div>
          {fehler.length > 0 && (
            <div className="rounded-lg border border-bad p-2 text-sm text-bad">
              <div className="font-bold">Im Code stimmt etwas nicht{ergebnis ? " — das Bild zeigt die letzte funktionierende Fassung." : "."}</div>
              <ul className="mt-1 list-disc pl-5">
                {fehler.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    {f.zeile ? (
                      <button className="underline" onClick={() => {
                        setModus("code");
                        setTimeout(() => {
                          const t = codeFeld.current;
                          if (!t) return;
                          const start = code.split("\n").slice(0, f.zeile! - 1).join("\n").length + (f.zeile! > 1 ? 1 : 0);
                          t.focus();
                          t.setSelectionRange(start, start + (code.split("\n")[f.zeile! - 1]?.length ?? 0));
                        }, 50);
                      }}>Zeile {f.zeile}</button>
                    ) : null}
                    {f.zeile ? ": " : ""}{f.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <style>{TIEFE_CSS + hervorheben}</style>
          <div ref={flaeche} data-tiefe={tiefe || undefined}
            className="d2-buehne relative overflow-auto max-h-[75vh] min-h-[300px] rounded-lg">
            {ergebnis && (
              <div className="d2-ebenen relative" style={{ width: `${breite * zoom}px` }}>
                {tiefe && <div className="d2-schatten" aria-hidden />}
                <div ref={svgBox} data-d2-flaeche onClick={klick} onDoubleClick={doppelklick}
                  onMouseOver={ueber} onMouseOut={schwebeLoslassen}
                  className={`d2-karte [&_svg]:block [&_svg]:w-full [&_svg]:h-auto [&_g]:cursor-pointer ${verbinden ? "cursor-crosshair" : ""}`}
                  dangerouslySetInnerHTML={{ __html: ergebnis.svg }} />
                {schwebe && (
                  <button onClick={() => kanteWeg(schwebe.id)} onMouseEnter={schwebeHalten} onMouseLeave={schwebeLoslassen}
                    title="Verbindung löschen" aria-label="Verbindung löschen"
                    className="absolute z-10 h-8 w-8 rounded-full bg-surface border border-line shadow-md text-sm hover:border-bad hover:bg-bad hover:text-white"
                    style={{ left: schwebe.x, top: schwebe.y, transform: "translate3d(-50%, -50%, 12px)" }}>🗑</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Farbwahl({ titel, wert, setze }: { titel: string; wert?: string; setze: (w: string | undefined) => void }) {
  const hex = wert && /^#[0-9a-f]{6}$/i.test(wert) ? wert : "#ffffff";
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="label">{titel}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button onClick={() => setze(undefined)} title="Farbe vom Thema"
          className={`h-6 px-2 rounded border text-xs ${!wert ? "border-line-active ring-2 ring-accent" : "border-line"}`}>Thema</button>
        {FARBEN.map(f => (
          <button key={f.wert} onClick={() => setze(f.wert)} title={f.name} aria-label={`${titel}: ${f.name}`}
            className={`h-6 w-6 rounded border ${wert?.toLowerCase() === f.wert ? "border-line-active ring-2 ring-accent" : "border-line"}`}
            style={{ background: f.wert }} />
        ))}
        <input type="color" value={hex} onChange={e => setze(e.target.value)} title="Eigene Farbe" aria-label={`${titel}: eigene Farbe`}
          className="h-6 w-8 cursor-pointer bg-transparent" />
      </div>
    </div>
  );
}

function Haken({ titel, an, setze }: { titel: string; an: boolean; setze: (an: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={an} onChange={e => setze(e.target.checked)} />
      {titel}
    </label>
  );
}
