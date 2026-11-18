"use client";
/**
 * Teil 2 · Explorer: ein nachgebautes Windows-11-Fenster ohne echte Dateien.
 *
 * Die Logik (markieren, verschieben, umbenennen, …) steckt komplett in
 * lib/maus/explorer.ts — hier wird nur bedient und angezeigt. Jede Aufgabe
 * lässt mehrere Wege zu (Ziehen oder Strg+X/Strg+V, F2 oder das Menü); welcher
 * Weg genommen wurde, spielt für die Punkte keine Rolle.
 */
import { useEffect, useRef, useState, type MouseEvent as MausEreignis, type PointerEvent as ZeigerEreignis } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import {
  anfangsStand, ausschneiden, einfuegen, istFalscherZielordner, klick, kopieren, leeren, loeschen,
  neuerOrdner, oeffnen, sichtbareDateien, strgKlick, umbenennen, umschaltKlick, verschieben, zurueck,
  WURZEL, type Datei, type ExplorerStand,
} from "@/lib/maus/explorer";
import { Stufenkopf } from "./Stufenkopf";
import { Kontextmenue, SYMBOLE } from "./Kontextmenue";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useWindows } from "./windows/WindowsKontext";
import type { Betriebssystem } from "@/lib/maus/system";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";
import { mitTasten } from "./Taste";

const ANZAHL_SCHRITTE = 6;
/** Schritt-Index der Aufgabe »Verschiebe die drei Dateien in den Ordner Schule«. */
const VERSCHIEBE_SCHRITT = 3;

const ICON: Record<Datei["art"], string> = {
  ordner: "📁", docx: "📄", jpg: "🖼️", mp3: "🎵", txt: "📄",
};

const NAV = [
  { id: "desktop", label: "Desktop", icon: "🖥️" }, // bei Ubuntu und macOS »Schreibtisch« (siehe navLabel)
  { id: "dokumente", label: "Dokumente", icon: "📁" },
  { id: "bilder", label: "Bilder", icon: "🖼️" },
  { id: "musik", label: "Musik", icon: "🎵" },
];

/**
 * Ablageziel »Dokumente« (Seitenleiste, Adressleiste). Die Wurzel hat die id
 * "" — als `data-ordner` und in `ueberOrdner` wäre das falsy, daher ein Platzhalter.
 */
const DOKUMENTE_ZIEL = "__dokumente__";
const zielOrdner = (ablage: string) => (ablage === DOKUMENTE_ZIEL ? WURZEL : ablage);
/** Wie Windows: ein zweiter, langsamer Klick auf den Namen der markierten Datei benennt um. */
const LANGSAMER_KLICK_MS = 550;

const FAECHER = ["deutsch", "englisch", "mathe", "technik"];
const BEREICH = ["ferien", "geburtstag", "klassenfoto"];

/**
 * Jede Aufgabe mit denselben Schritten, die auch die Vorführung zeigt — wer
 * nicht vorführen lässt, soll trotzdem wissen, wie es geht. `merke` hebt den
 * Unterschied zwischen Strg- und Umschalt-Klick hervor.
 */
const AUFGABEN: { titel: string; schritte: string[]; merke?: string }[] = [
  {
    titel: "Lege einen neuen Ordner an.",
    schritte: ["Rechtsklick auf eine freie Stelle im Fenster.", "»Neuer Ordner« anklicken — oder oben auf »＋ Neu«."],
  },
  {
    titel: "Benenne ihn in »Schule« um.",
    schritte: [
      "Den neuen Ordner einmal anklicken.",
      "[[F2]] drücken — oder Rechtsklick › Umbenennen — oder kurz warten und noch einmal langsam auf den Namen klicken.",
      "Der Name ist jetzt blau markiert: einfach »Schule« tippen und [[Enter]] drücken.",
    ],
  },
  {
    titel: "Markiere mit Strg + Klick alle vier Fächer: Deutsch, Englisch, Mathe und Technik.",
    schritte: ["»Deutsch« anklicken.", "[[Strg]] festhalten …", "… und nacheinander »Englisch«, »Mathe« und »Technik« anklicken.", "Erst dann [[Strg]] loslassen."],
    merke: "Strg + Klick nimmt nur die Dateien, die du anklickst. Was dazwischen liegt — »Einkaufsliste«, »Ferien« … — bleibt frei.",
  },
  {
    titel: "Verschiebe die vier Fächer in den Ordner »Schule«.",
    schritte: ["Eine der markierten Dateien mit gedrückter Maustaste auf den Ordner »Schule« ziehen.", "Oder: [[Strg]] + [[X]], »Schule« doppelklicken, [[Strg]] + [[V]]."],
  },
  {
    titel: "Markiere mit Umschalt + Klick von »Ferien« bis »Klassenfoto«.",
    schritte: ["»Ferien« anklicken.", "[[Umschalt]] festhalten …", "… und »Klassenfoto« anklicken."],
    merke: "Umschalt + Klick nimmt alles von der ersten bis zur zweiten Datei — auch »Geburtstag« dazwischen, ohne dass du es anklickst.",
  },
  {
    titel: "Öffne den Ordner »Schule« mit Doppelklick.",
    schritte: ["Zweimal schnell auf den Ordner »Schule« klicken."],
  },
];

/**
 * Die Aufgaben für ein System. Ubuntu wie Windows; am Mac heißt Strg ⌘,
 * umbenannt wird mit der Zeilenschalter-Taste (Enter) statt F2, und
 * verschoben wird mit ⌘ + C und ⌥ + ⌘ + V (Ausschneiden kennt der Finder nicht).
 */
function aufgabenFuer(system: Betriebssystem): typeof AUFGABEN {
  if (system !== "macos") return AUFGABEN;
  const mac = (t: string) => t
    .replace("[[F2]] drücken — oder Rechtsklick › Umbenennen", "[[Enter]] drücken — oder Rechtsklick › Umbenennen")
    .replace("Oder: [[Strg]] + [[X]], »Schule« doppelklicken, [[Strg]] + [[V]].", "Oder: [[⌘]] + [[C]], »Schule« doppelklicken, [[⌥]] + [[⌘]] + [[V]] (»Objekt hierher bewegen«).")
    .replaceAll("[[Strg]]", "[[⌘]]")
    .replaceAll("[[Umschalt]]", "[[⇧]]")
    .replaceAll("Strg", "⌘");
  return AUFGABEN.map(a => ({ titel: mac(a.titel), schritte: a.schritte.map(mac), merke: a.merke && mac(a.merke) }));
}

type Menue = { x: number; y: number; ziel: string | "leer" };
/** `aktiv` erst ab ein paar Pixeln Weg — ein einfacher Klick ist kein Ziehen. */
type Zug = { ids: string[]; x: number; y: number; dx: number; dy: number; startX: number; startY: number; aktiv: boolean };

export default function StufeExplorer({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { system, sys } = useWindows();
  const mac = system === "macos";
  const AUFGABEN = aufgabenFuer(system);
  const strg = mac ? "⌘" : "Strg";
  const strgCode = mac ? "MetaLeft" : "ControlLeft";
  const navLabel = (id: string, label: string) => (id === "desktop" ? sys.desktopOrdner : label);
  const [stand, setStand] = useState<ExplorerStand>(() => anfangsStand());
  const [schritt, setSchritt] = useState(0);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [menue, setMenue] = useState<Menue | null>(null);
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null);
  const [nameEntwurf, setNameEntwurf] = useState("");
  const [zug, setZug] = useState<Zug | null>(null);
  const [ueberOrdner, setUeberOrdner] = useState<string | null>(null);
  const [fehler, setFehler] = useState(0);
  const fehlerRef = useRef(0);
  const langsamUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useRef(performance.now());
  const schulordner = useRef<string | null>(null);
  const strgBenutzt = useRef(false);
  const umschaltBenutzt = useRef(false);
  const doppelBenutzt = useRef(false);
  const gemeldet = useRef(false);
  const dateiRef = useRef<Record<string, HTMLElement | null>>({});
  const gitterRef = useRef<HTMLDivElement>(null);
  const neuRef = useRef<HTMLButtonElement>(null);
  const ausschneidenRef = useRef<HTMLButtonElement>(null);
  const einfuegenRef = useRef<HTMLButtonElement>(null);
  // Der aktuelle Stand auch für Vorführschritte, deren Rückruf aus einem älteren Render stammt.
  const standRef = useRef(stand);
  standRef.current = stand;
  // Die Vorführung darf nichts lösen: sie arbeitet auf einer Kopie und stellt am Ende zurück.
  const demoLaeuft = useRef(false);
  const vorDemo = useRef<ExplorerStand | null>(null);
  const demo = useDemo(() => {
    demoLaeuft.current = false;
    if (vorDemo.current) {
      standRef.current = vorDemo.current;
      setStand(vorDemo.current);
      vorDemo.current = null;
    }
    setMenue(null);
  });

  const fertig = schritt >= ANZAHL_SCHRITTE;
  const sichtbar = sichtbareDateien(stand);

  function fehlerHinzu() {
    fehlerRef.current += 1;
    setFehler(fehlerRef.current);
  }

  /** Löscht in den Papierkorb — zählt als Fehlversuch, ist in keiner Aufgabe verlangt. */
  function handleLoeschen() {
    fehlerHinzu();
    aendern(loeschen);
  }

  /** Einfügen: außerhalb von »Schule« während der Verschiebe-Aufgabe zählt als Fehlversuch. */
  /** `bewegen`: ⌥ + ⌘ + V am Mac — die kopierten Dateien werden verschoben statt verdoppelt. */
  function handleEinfuegen(bewegen = false) {
    if (bewegen) aendern(s => (s.zwischenablage ? { ...s, zwischenablage: { ...s.zwischenablage, modus: "ausschneiden" } } : s));
    if (schritt === VERSCHIEBE_SCHRITT && istFalscherZielordner(stand.aktuellerOrdner, schulordner.current)) {
      fehlerHinzu();
    }
    aendern(einfuegen);
  }

  function pruefeSchritt(neu: ExplorerStand) {
    let s = schritt;
    if (s === 0 && neu.dateien.some(d => d.art === "ordner")) {
      s = 1;
    }
    if (s === 1) {
      const ordner = neu.dateien.find(d => d.art === "ordner" && d.name === "Schule");
      if (ordner) { schulordner.current = ordner.id; s = 2; }
    }
    if (s === 2 && strgBenutzt.current) {
      const ziel = new Set(FAECHER);
      if (neu.auswahl.length === FAECHER.length && neu.auswahl.every(id => ziel.has(id))) s = 3;
    }
    if (s === 3 && schulordner.current) {
      const drin = FAECHER.every(
        id => neu.dateien.find(d => d.id === id)?.parent === schulordner.current,
      );
      if (drin) s = 4;
    }
    if (s === 4 && umschaltBenutzt.current) {
      const ziel = new Set(BEREICH);
      if (neu.auswahl.length === BEREICH.length && neu.auswahl.every(id => ziel.has(id))) s = 5;
    }
    if (s === 5 && doppelBenutzt.current && neu.aktuellerOrdner === schulordner.current) {
      s = 6;
    }
    if (s !== schritt) setSchritt(s);
    if (s === 6 && !gemeldet.current) {
      gemeldet.current = true;
      const dauerMs = Math.round(performance.now() - start.current);
      const { punkte, details } = wertung({
        stufe: "explorer", geloest: ANZAHL_SCHRITTE, anzahl: ANZAHL_SCHRITTE, dauerMs, fehler: fehlerRef.current,
      });
      onFertig({ punkte, dauerMs, details: [...details, "Ordner angelegt, umbenannt, Dateien verschoben"] });
    }
  }

  function aendern(fn: (s: ExplorerStand) => ExplorerStand) {
    // Nicht im setState-Updater prüfen: der muss frei von Nebenwirkungen bleiben.
    const neu = fn(standRef.current);
    standRef.current = neu;
    setStand(neu);
    if (!demoLaeuft.current) pruefeSchritt(neu);
  }

  /** Seitenleiste oder Adressleiste: zurück auf Ebene `tiefe` (0 = »Dokumente«), egal wie tief man ist. */
  function zuEbene(tiefe: number) {
    if (demo.aktiv) return;
    aendern(s => { while (s.pfad.length > tiefe) s = zurueck(s); return s; });
  }

  function klickAuf(e: MausEreignis, id: string) {
    if (demo.aktiv || fertig) return;
    e.stopPropagation();
    langsamAbbrechen();
    if (e.ctrlKey || e.metaKey) { strgBenutzt.current = true; aendern(s => strgKlick(s, id)); return; }
    if (e.shiftKey) { umschaltBenutzt.current = true; aendern(s => umschaltKlick(s, id)); return; }
    const schonAllein = standRef.current.auswahl.length === 1 && standRef.current.auswahl[0] === id;
    aendern(s => klick(s, id));
    // Zweiter Klick auf den Namen der schon markierten Datei: erst umbenennen,
    // wenn kein Doppelklick daraus wird (der bricht die Uhr ab).
    if (schonAllein && e.detail === 1 && !umbenennenId && (e.target as HTMLElement).closest("[data-name]")) {
      langsamUhr.current = setTimeout(() => { langsamUhr.current = null; anF2(id); }, LANGSAMER_KLICK_MS);
    }
  }

  function doppelklickAuf(e: MausEreignis, datei: Datei) {
    langsamAbbrechen();
    if (demo.aktiv || fertig || datei.art !== "ordner") return;
    e.stopPropagation();
    doppelBenutzt.current = true;
    aendern(s => oeffnen(s, datei.id));
  }

  function rechtsklickAuf(e: MausEreignis, id: string) {
    e.preventDefault();
    if (demo.aktiv || fertig) return;
    aendern(s => (s.auswahl.includes(id) ? s : klick(s, id)));
    setMenue({ x: e.clientX, y: e.clientY, ziel: id });
  }

  function rechtsklickFlaeche(e: MausEreignis) {
    e.preventDefault();
    if (demo.aktiv || fertig) return;
    aendern(leeren);
    setMenue({ x: e.clientX, y: e.clientY, ziel: "leer" });
  }

  function anF2(id: string) {
    setUmbenennenId(id);
    setNameEntwurf(standRef.current.dateien.find(d => d.id === id)?.name ?? "");
  }

  function langsamAbbrechen() {
    if (langsamUhr.current) clearTimeout(langsamUhr.current);
    langsamUhr.current = null;
  }
  useEffect(() => langsamAbbrechen, []);

  /** Alles auf Anfang — Dateien, Aufgaben, Zeit und Fehlversuche. */
  function zuruecksetzen() {
    if (demo.aktiv) return;
    langsamAbbrechen();
    const neu = anfangsStand();
    standRef.current = neu;
    setStand(neu);
    setSchritt(0);
    setHinweis(null);
    setMenue(null);
    setUmbenennenId(null);
    setZug(null);
    setUeberOrdner(null);
    fehlerRef.current = 0;
    setFehler(0);
    start.current = performance.now();
    schulordner.current = null;
    strgBenutzt.current = false;
    umschaltBenutzt.current = false;
    doppelBenutzt.current = false;
    gemeldet.current = false;
  }

  function nameSpeichern() {
    if (!umbenennenId) return;
    const r = umbenennen(stand, umbenennenId, nameEntwurf);
    if (r.fehler) {
      setHinweis({
        text: r.fehler === "leer" ? "Bitte gib einen Namen ein." : "Diesen Namen gibt es schon.",
        gut: false,
      });
      fehlerHinzu();
      return;
    }
    setUmbenennenId(null);
    setHinweis(null);
    aendern(() => r.stand);
  }

  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (demo.aktiv || fertig || umbenennenId) return;
      if (e.key === "F2" && stand.auswahl.length === 1) { anF2(stand.auswahl[0]); }
      // Mac: Enter benennt um, ⌘ + ⌫ legt in den Papierkorb (Strg geht auch — oft sitzt das Kind an einer PC-Tastatur).
      else if (mac && e.key === "Enter" && stand.auswahl.length === 1) { anF2(stand.auswahl[0]); }
      else if (mac && e.key === "Backspace" && (e.metaKey || e.ctrlKey) && stand.auswahl.length > 0) { handleLoeschen(); }
      else if (e.key === "Delete" && stand.auswahl.length > 0) { handleLoeschen(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && stand.auswahl.length > 0) { aendern(ausschneiden); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && stand.auswahl.length > 0) { aendern(kopieren); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && stand.zwischenablage) { handleEinfuegen(mac && e.altKey); }
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand, demo.aktiv, fertig, umbenennenId]);

  // ── Ziehen ──────────────────────────────────────────────────────────

  function greifen(e: ZeigerEreignis<HTMLButtonElement>, datei: Datei) {
    if (demo.aktiv || fertig || e.button !== 0 || umbenennenId) return;
    // Die Auswahl ändert erst der Klick. Früher wählte schon das Drücken eine
    // einzelne Datei — Strg- und Umschalt-Klick machten sich damit selbst zunichte.
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    const ids = stand.auswahl.includes(datei.id) ? stand.auswahl : [datei.id];
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    setZug({
      ids, x: e.clientX, y: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top,
      startX: e.clientX, startY: e.clientY, aktiv: false,
    });
  }

  function ziehen(e: ZeigerEreignis<HTMLButtonElement>) {
    if (!zug) return;
    const aktiv = zug.aktiv || Math.hypot(e.clientX - zug.startX, e.clientY - zug.startY) > 5;
    setZug({ ...zug, x: e.clientX, y: e.clientY, aktiv });
    if (!aktiv) return;
    const unter = document.elementFromPoint(e.clientX, e.clientY);
    const ordnerEl = unter?.closest<HTMLElement>("[data-ordner]");
    const ablage = ordnerEl?.dataset.ordner;
    // Nicht auf sich selbst und nicht in den Ordner, in dem die Dateien schon liegen.
    setUeberOrdner(ablage && !zug.ids.includes(ablage) && zielOrdner(ablage) !== stand.aktuellerOrdner ? ablage : null);
  }

  function loslassen() {
    if (!zug) return;
    if (zug.aktiv && ueberOrdner) {
      const ziel = zielOrdner(ueberOrdner);
      if (schritt === VERSCHIEBE_SCHRITT && istFalscherZielordner(ziel, schulordner.current)) {
        fehlerHinzu();
      }
      aendern(s => verschieben(s, zug.ids, ziel));
    }
    setZug(null);
    setUeberOrdner(null);
  }

  // ── Vorführung ──────────────────────────────────────────────────────

  function vorfuehren() {
    vorDemo.current = standRef.current;
    demoLaeuft.current = true;
    const schritte: DemoSchritt[] = [];
    if (schritt === 0) {
      schritte.push(
        { text: "Rechtsklick auf die freie Fläche.", zu: () => mitte(gitterRef.current), taste: "rechts", aktion: () => setMenue({ x: 400, y: 250, ziel: "leer" }) },
        { text: "»Neuer Ordner« auswählen.", taste: "links", aktion: () => { setMenue(null); aendern(neuerOrdner); } },
      );
    } else if (schritt === 1) {
      const neu = () => standRef.current.dateien.find(d => d.art === "ordner" && d.parent === standRef.current.aktuellerOrdner)?.id;
      schritte.push(
        { text: "Den neuen Ordner einmal anklicken.", zu: () => { const id = neu(); return id ? mitte(dateiRef.current[id]) : null; }, taste: "links", aktion: () => { const id = neu(); if (id) aendern(s => klick(s, id)); } },
        mac ? { text: "Drücke Enter …", tasten: ["Enter"] } : { text: "Drücke F2 …", tasten: ["F2"] },
        { text: "… und tippe »Schule«.", tasten: ["ShiftLeft", "KeyS"], aktion: () => { const id = neu(); if (id) aendern(s => umbenennen(s, id, "Schule").stand); } },
        { text: "Mit Enter bestätigen.", tasten: ["Enter"] },
      );
    } else if (schritt === 2) {
      schritte.push({ text: "Klicke auf »Deutsch«.", zu: () => mitte(dateiRef.current["deutsch"]), taste: "links", aktion: () => aendern(s => klick(s, "deutsch")) });
      for (const id of FAECHER.slice(1)) {
        schritte.push({ text: `${strg} halten und auf »${stand.dateien.find(d => d.id === id)?.name}« klicken.`, zu: () => mitte(dateiRef.current[id]), taste: "links", tasten: [strgCode], aktion: () => aendern(s => strgKlick(s, id)) });
      }
      schritte.push({ text: "Nur die vier Fächer sind markiert — alles dazwischen bleibt frei.", taste: null });
    } else if (schritt === 3) {
      const ordnerOrt = () => mitte(Object.values(dateiRef.current).find(el => el?.dataset.ordner === schulordner.current) ?? null);
      schritte.push(
        mac
          ? { text: "⌘ + C drücken.", tasten: ["MetaLeft", "KeyC"], aktion: () => aendern(ausschneiden) }
          : { text: "Strg + X drücken.", tasten: ["ControlLeft", "KeyX"], aktion: () => aendern(ausschneiden) },
        { text: "In den Ordner »Schule« doppelklicken.", zu: ordnerOrt, taste: "doppel", aktion: () => { if (schulordner.current) aendern(s => oeffnen(s, schulordner.current!)); } },
        mac
          ? { text: "⌥ + ⌘ + V drücken: hierher bewegen.", tasten: ["AltLeft", "MetaLeft", "KeyV"], aktion: () => aendern(einfuegen) }
          : { text: "Strg + V drücken.", tasten: ["ControlLeft", "KeyV"], aktion: () => aendern(einfuegen) },
      );
    } else if (schritt === 4) {
      schritte.push(
        { text: "Klicke auf »Ferien«.", zu: () => mitte(dateiRef.current["ferien"]), taste: "links", aktion: () => aendern(s => klick(s, "ferien")) },
        { text: "Umschalt halten und auf »Klassenfoto« klicken.", zu: () => mitte(dateiRef.current["klassenfoto"]), taste: "links", tasten: ["ShiftLeft"], aktion: () => aendern(s => umschaltKlick(s, "klassenfoto")) },
        { text: "Alles von »Ferien« bis »Klassenfoto« ist markiert — auch »Geburtstag« dazwischen.", taste: null },
      );
    } else if (schritt === 5) {
      const ordnerOrt = () => mitte(Object.values(dateiRef.current).find(el => el?.dataset.ordner === schulordner.current) ?? null);
      schritte.push({ text: "Doppelklick auf den Ordner »Schule«.", zu: ordnerOrt, taste: "doppel", aktion: () => { if (schulordner.current) aendern(s => oeffnen(s, schulordner.current!)); } });
    }
    demo.abspielen(schritte);
  }

  const groesse = hilfe ? HILFE_GROESSE : 1;
  const punkteLaufend = wertung({
    stufe: "explorer", geloest: schritt, anzahl: ANZAHL_SCHRITTE,
    dauerMs: Math.round(performance.now() - start.current), fehler,
  }).punkte;

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="📁 Teil 2 · Dateien ordnen"
        auftrag={fertig
          ? <>Toll gemacht! Du kennst dich jetzt im {sys.dateimanager} aus.</>
          : <>
              {AUFGABEN[schritt].titel}
              <ol className="list-decimal list-inside text-sm font-normal mt-1.5 flex flex-col gap-0.5">
                {AUFGABEN[schritt].schritte.map((t, i) => <li key={i}>{mitTasten(t)}</li>)}
              </ol>
              {AUFGABEN[schritt].merke && (
                <div className="mt-2 rounded-lg border-l-4 border-accent bg-surface-hover px-3 py-1.5 text-sm font-bold">
                  💡 {AUFGABEN[schritt].merke}
                </div>
              )}
            </>}
        punkte={punkteLaufend}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div
          className="rounded-2xl border border-line bg-surface overflow-hidden select-none"
          onContextMenu={rechtsklickFlaeche}
        >
          {/* Titelleiste */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line text-sm font-bold">
            <span data-testid="explorer-titel">📁 {stand.aktuellerOrdner ? stand.dateien.find(d => d.id === stand.aktuellerOrdner)?.name ?? "Ordner" : "Dokumente"}</span>
          </div>

          {/* Werkzeugleiste */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line flex-wrap">
            <button ref={neuRef} type="button" title="Neuer Ordner" onClick={() => aendern(neuerOrdner)}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent font-bold">
              ＋ Neu
            </button>
            <span className="w-px h-5 bg-line mx-1" />
            <button ref={ausschneidenRef} type="button" title="Ausschneiden" disabled={stand.auswahl.length === 0}
              onClick={() => aendern(ausschneiden)}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent disabled:opacity-30">
              ✂️ Ausschneiden
            </button>
            <button type="button" title="Kopieren" disabled={stand.auswahl.length === 0}
              onClick={() => aendern(kopieren)}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent disabled:opacity-30">
              📋 Kopieren
            </button>
            <button ref={einfuegenRef} type="button" title="Einfügen" disabled={!stand.zwischenablage}
              onClick={() => handleEinfuegen()}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent disabled:opacity-30">
              📌 Einfügen
            </button>
            <button type="button" title="Umbenennen" disabled={stand.auswahl.length !== 1}
              onClick={() => anF2(stand.auswahl[0])}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent disabled:opacity-30">
              ✏️ Umbenennen
            </button>
            <button type="button" title="Löschen" disabled={stand.auswahl.length === 0}
              onClick={handleLoeschen}
              className="text-xs rounded-lg px-2 py-1 border border-line hover:border-accent disabled:opacity-30">
              🗑️ Löschen
            </button>
            <span className="flex-1" />
            <span className="text-xs text-muted" title="Papierkorb">🗑️ {stand.papierkorb}</span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-line text-xs text-muted">
            {stand.aktuellerOrdner && (
              <button type="button" onClick={() => aendern(zurueck)} className="rounded-sm px-1.5 py-0.5 border border-line hover:border-accent">
                ← Zurück
              </button>
            )}
            <div className="flex-1 min-w-0 flex items-center gap-0.5 rounded-sm border border-line bg-page px-1.5 py-0.5 text-fg" data-testid="adressleiste">
              <button type="button" onClick={() => zuEbene(0)} data-pfad="dokumente" data-ordner={DOKUMENTE_ZIEL}
                className={"rounded-sm px-1 " + (ueberOrdner === DOKUMENTE_ZIEL ? "bg-[#0078d738]" : "hover:bg-surface-hover")}>Dokumente</button>
              {stand.pfad.map((id, i) => (
                <span key={id} className="flex items-center gap-0.5">
                  <span className="text-muted">›</span>
                  <button type="button" onClick={() => zuEbene(i + 1)} data-pfad={id} data-ordner={id}
                    className={"rounded-sm px-1 " + (ueberOrdner === id ? "bg-[#0078d738]" : "hover:bg-surface-hover")}>
                    {stand.dateien.find(d => d.id === id)?.name ?? "Ordner"}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Navigation + Inhalt */}
          <div className="flex">
            <div className="w-28 shrink-0 border-r border-line p-2 flex flex-col gap-1 text-xs">
              {NAV.map(n => (
                n.id === "dokumente" ? (
                  <button key={n.id} type="button" onClick={() => zuEbene(0)} data-nav="dokumente" data-ordner={DOKUMENTE_ZIEL}
                    className={"rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-left font-bold border " + (
                      ueberOrdner === DOKUMENTE_ZIEL ? "bg-[#0078d738] border-[#0078d799]"
                        : stand.aktuellerOrdner ? "border-transparent hover:bg-surface-hover" : "border-transparent bg-surface-hover")}>
                    <span>{n.icon}</span>{navLabel(n.id, n.label)}
                  </button>
                ) : (
                  <div key={n.id} className="rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-muted">
                    <span>{n.icon}</span>{navLabel(n.id, n.label)}
                  </div>
                )
              ))}
            </div>

            <div
              ref={gitterRef}
              className="flex-1 min-h-64 p-4 flex flex-wrap content-start"
              style={{ gap: `${1.25 * groesse}rem` }}
              onClick={() => { if (!demo.aktiv && !fertig) aendern(leeren); }}
            >
              {sichtbar.map(d => {
                const gewaehlt = stand.auswahl.includes(d.id);
                const ziehtDas = !!zug?.aktiv && zug.ids.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    ref={el => { dateiRef.current[d.id] = el; }}
                    data-ordner={d.art === "ordner" ? d.id : undefined}
                    onClick={e => klickAuf(e, d.id)}
                    onDoubleClick={e => doppelklickAuf(e, d)}
                    onContextMenu={e => rechtsklickAuf(e, d.id)}
                    onPointerDown={e => greifen(e, d)}
                    onPointerMove={ziehen}
                    onPointerUp={loslassen}
                    onPointerCancel={() => { setZug(null); setUeberOrdner(null); }}
                    style={{ touchAction: "none", width: `${5.5 * groesse}rem` }}
                    className={
                      // Markierung im Windows-Blau (#0078D7), leicht durchscheinend —
                      // so wie im echten Explorer, und auch im dunklen Design lesbar.
                      "flex flex-col items-center gap-1 rounded-md border p-2 text-center " +
                      (gewaehlt || ueberOrdner === d.id
                        ? "bg-[#0078d738] border-[#0078d799] "
                        : "border-transparent hover:bg-[#0078d71a] ") +
                      (ziehtDas ? "opacity-40" : "")
                    }
                  >
                    <span style={{ fontSize: `${2.2 * groesse}rem` }}>{ICON[d.art]}</span>
                    {umbenennenId === d.id ? (
                      <input
                        // Wie Windows: der Name steht blau markiert da (bei Dateien ohne die
                        // Endung), Lostippen ersetzt ihn.
                        ref={el => {
                          if (!el || document.activeElement === el) return;
                          el.focus();
                          const punkt = d.art === "ordner" ? -1 : el.value.lastIndexOf(".");
                          el.setSelectionRange(0, punkt > 0 ? punkt : el.value.length);
                        }}
                        aria-label="Neuer Name"
                        value={nameEntwurf}
                        onChange={e => setNameEntwurf(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === "Enter") nameSpeichern();
                          else if (e.key === "Escape") setUmbenennenId(null);
                        }}
                        onBlur={nameSpeichern}
                        className="w-full text-xs text-center rounded-sm border border-[#0078d7] bg-page px-1 selection:bg-[#0078d7] selection:text-white"
                      />
                    ) : (
                      <span data-name className="text-xs break-all leading-tight">{d.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          <ul className="flex flex-col gap-1.5">
            {AUFGABEN.map((a, i) => (
              <li key={i} className={"text-sm flex gap-2 " + (i === schritt ? "font-bold" : i < schritt ? "text-muted" : "")}>
                <span>{i < schritt ? "✅" : i === schritt ? "👉" : "⬜"}</span>
                <span>{a.titel}</span>
              </li>
            ))}
          </ul>
          <div className="min-h-10 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
          <button type="button" onClick={zuruecksetzen} disabled={demo.aktiv}
            className="text-sm rounded-lg px-3 py-1.5 border border-line hover:border-accent disabled:opacity-30 self-start">
            ↺ Übung zurücksetzen
          </button>
        </aside>
      </div>

      {menue && (
        <Kontextmenue
          x={menue.x}
          y={menue.y}
          system={system}
          onZu={() => setMenue(null)}
          eintraege={menue.ziel === "leer" ? [
            { text: system === "ubuntu" ? "Neuer Ordner …" : "Neuer Ordner", symbol: <span aria-hidden>📁</span>, onWahl: () => aendern(neuerOrdner) },
            "trenner",
            { text: "Ansicht", aus: true },
            { text: "Sortieren nach", aus: true },
          ] : [
            ...(mac ? [] : [{ text: "Ausschneiden", symbol: SYMBOLE.ausschneiden, kuerzel: "Strg+X", onWahl: () => aendern(ausschneiden) }]),
            { text: "Kopieren", symbol: SYMBOLE.kopieren, kuerzel: mac ? "⌘C" : "Strg+C", onWahl: () => aendern(kopieren) },
            { text: system === "ubuntu" ? "Umbenennen …" : "Umbenennen", symbol: SYMBOLE.umbenennen, kuerzel: mac ? "↩" : "F2", onWahl: () => anF2(menue.ziel) },
            {
              text: mac ? "In den Papierkorb legen" : system === "ubuntu" ? "In den Papierkorb verschieben" : "Löschen",
              symbol: SYMBOLE.loeschen, kuerzel: mac ? "⌘⌫" : "Entf", onWahl: handleLoeschen,
            },
          ]}
        />
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
