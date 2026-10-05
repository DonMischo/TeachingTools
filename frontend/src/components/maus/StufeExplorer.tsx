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
  type Datei, type ExplorerStand,
} from "@/lib/maus/explorer";
import { Stufenkopf } from "./Stufenkopf";
import { Kontextmenue, SYMBOLE } from "./Kontextmenue";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";

const ANZAHL_SCHRITTE = 6;
/** Schritt-Index der Aufgabe »Verschiebe die drei Dateien in den Ordner Schule«. */
const VERSCHIEBE_SCHRITT = 3;

const ICON: Record<Datei["art"], string> = {
  ordner: "📁", docx: "📄", jpg: "🖼️", mp3: "🎵", txt: "📄",
};

const NAV = [
  { id: "desktop", label: "Desktop", icon: "🖥️" },
  { id: "dokumente", label: "Dokumente", icon: "📁" },
  { id: "bilder", label: "Bilder", icon: "🖼️" },
  { id: "musik", label: "Musik", icon: "🎵" },
];

const AUFGABEN = [
  "Lege einen neuen Ordner an.",
  "Benenne ihn in »Schule« um.",
  "Markiere mit Strg + Klick: Mathe, Deutsch und Englisch.",
  "Verschiebe die drei Dateien in den Ordner »Schule«.",
  "Markiere mit Umschalt + Klick von »Klassenfoto« bis »Einkaufsliste«.",
  "Öffne den Ordner »Schule« mit Doppelklick.",
];

type Menue = { x: number; y: number; ziel: string | "leer" };
/** `aktiv` erst ab ein paar Pixeln Weg — ein einfacher Klick ist kein Ziehen. */
type Zug = { ids: string[]; x: number; y: number; dx: number; dy: number; startX: number; startY: number; aktiv: boolean };

export default function StufeExplorer({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
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
  function handleEinfuegen() {
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
      const ziel = new Set(["mathe", "deutsch", "englisch"]);
      if (neu.auswahl.length === 3 && neu.auswahl.every(id => ziel.has(id))) s = 3;
    }
    if (s === 3 && schulordner.current) {
      const drin = ["mathe", "deutsch", "englisch"].every(
        id => neu.dateien.find(d => d.id === id)?.parent === schulordner.current,
      );
      if (drin) s = 4;
    }
    if (s === 4 && umschaltBenutzt.current) {
      const ziel = new Set(["klassenfoto", "schullied", "einkaufsliste"]);
      if (neu.auswahl.length === 3 && neu.auswahl.every(id => ziel.has(id))) s = 5;
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

  function klickAuf(e: MausEreignis, id: string) {
    if (demo.aktiv || fertig) return;
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) { strgBenutzt.current = true; aendern(s => strgKlick(s, id)); return; }
    if (e.shiftKey) { umschaltBenutzt.current = true; aendern(s => umschaltKlick(s, id)); return; }
    aendern(s => klick(s, id));
  }

  function doppelklickAuf(e: MausEreignis, datei: Datei) {
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
    setNameEntwurf(stand.dateien.find(d => d.id === id)?.name ?? "");
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
      else if (e.key === "Delete" && stand.auswahl.length > 0) { handleLoeschen(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && stand.auswahl.length > 0) { aendern(ausschneiden); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && stand.auswahl.length > 0) { aendern(kopieren); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && stand.zwischenablage) { handleEinfuegen(); }
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
    setUeberOrdner(ordnerEl && !zug.ids.includes(ordnerEl.dataset.ordner!) ? ordnerEl.dataset.ordner! : null);
  }

  function loslassen() {
    if (!zug) return;
    if (zug.aktiv && ueberOrdner) {
      if (schritt === VERSCHIEBE_SCHRITT && istFalscherZielordner(ueberOrdner, schulordner.current)) {
        fehlerHinzu();
      }
      aendern(s => verschieben(s, zug.ids, ueberOrdner));
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
      schritte.push(
        { text: "Drücke F2 …", tasten: ["F2"] },
        { text: "… und tippe »Schule«.", aktion: () => { const id = standRef.current.auswahl[0]; if (id) aendern(s => umbenennen(s, id, "Schule").stand); } },
      );
    } else if (schritt === 2) {
      const zeigen = ["mathe", "deutsch", "englisch"];
      schritte.push({ text: "Klicke auf »Mathe«.", zu: () => mitte(dateiRef.current["mathe"]), taste: "links", aktion: () => aendern(s => klick(s, "mathe")) });
      for (const id of zeigen.slice(1)) {
        schritte.push({ text: `Strg halten und auf »${stand.dateien.find(d => d.id === id)?.name}« klicken.`, zu: () => mitte(dateiRef.current[id]), taste: "links", tasten: ["ControlLeft"], aktion: () => aendern(s => strgKlick(s, id)) });
      }
    } else if (schritt === 3) {
      const ordnerOrt = () => mitte(Object.values(dateiRef.current).find(el => el?.dataset.ordner === schulordner.current) ?? null);
      schritte.push(
        { text: "Strg + X drücken.", tasten: ["ControlLeft", "KeyX"], aktion: () => aendern(ausschneiden) },
        { text: "In den Ordner »Schule« doppelklicken.", zu: ordnerOrt, taste: "doppel", aktion: () => { if (schulordner.current) aendern(s => oeffnen(s, schulordner.current!)); } },
        { text: "Strg + V drücken.", tasten: ["ControlLeft", "KeyV"], aktion: () => aendern(einfuegen) },
      );
    } else if (schritt === 4) {
      schritte.push(
        { text: "Klicke auf »Klassenfoto«.", zu: () => mitte(dateiRef.current["klassenfoto"]), taste: "links", aktion: () => aendern(s => klick(s, "klassenfoto")) },
        { text: "Umschalt halten und auf »Einkaufsliste« klicken.", zu: () => mitte(dateiRef.current["einkaufsliste"]), taste: "links", tasten: ["ShiftLeft"], aktion: () => aendern(s => umschaltKlick(s, "einkaufsliste")) },
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
          ? <>Toll gemacht! Du kennst dich jetzt im Explorer aus.</>
          : <>{AUFGABEN[schritt]}<div data-zusatz className="text-xs text-(--text-muted) mt-1">💡 Rechtsklick, F2, Strg+X/C/V oder Ziehen — was du kannst!</div></>}
        punkte={punkteLaufend}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div
          className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden select-none"
          onContextMenu={rechtsklickFlaeche}
        >
          {/* Titelleiste */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-(--border) text-sm font-bold">
            📁 {stand.aktuellerOrdner ? "Schule" : "Dokumente"}
          </div>

          {/* Werkzeugleiste */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-(--border) flex-wrap">
            <button ref={neuRef} type="button" title="Neuer Ordner" onClick={() => aendern(neuerOrdner)}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) font-bold">
              ＋ Neu
            </button>
            <span className="w-px h-5 bg-(--border) mx-1" />
            <button ref={ausschneidenRef} type="button" title="Ausschneiden" disabled={stand.auswahl.length === 0}
              onClick={() => aendern(ausschneiden)}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) disabled:opacity-30">
              ✂️ Ausschneiden
            </button>
            <button type="button" title="Kopieren" disabled={stand.auswahl.length === 0}
              onClick={() => aendern(kopieren)}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) disabled:opacity-30">
              📋 Kopieren
            </button>
            <button ref={einfuegenRef} type="button" title="Einfügen" disabled={!stand.zwischenablage}
              onClick={handleEinfuegen}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) disabled:opacity-30">
              📌 Einfügen
            </button>
            <button type="button" title="Umbenennen" disabled={stand.auswahl.length !== 1}
              onClick={() => anF2(stand.auswahl[0])}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) disabled:opacity-30">
              ✏️ Umbenennen
            </button>
            <button type="button" title="Löschen" disabled={stand.auswahl.length === 0}
              onClick={handleLoeschen}
              className="text-xs rounded-lg px-2 py-1 border border-(--border) hover:border-(--accent) disabled:opacity-30">
              🗑️ Löschen
            </button>
            <span className="flex-1" />
            <span className="text-xs text-(--text-muted)" title="Papierkorb">🗑️ {stand.papierkorb}</span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-(--border) text-xs text-(--text-muted)">
            {stand.aktuellerOrdner && (
              <button type="button" onClick={() => aendern(zurueck)} className="rounded-sm px-1.5 py-0.5 border border-(--border) hover:border-(--accent)">
                ← Zurück
              </button>
            )}
            <span>Dokumente{stand.aktuellerOrdner && " › Schule"}</span>
          </div>

          {/* Navigation + Inhalt */}
          <div className="flex">
            <div className="w-28 shrink-0 border-r border-(--border) p-2 flex flex-col gap-1 text-xs">
              {NAV.map(n => (
                <div key={n.id}
                  className={"rounded-lg px-2 py-1.5 flex items-center gap-1.5 " + (n.id === "dokumente" ? "bg-(--surface-hover) font-bold" : "text-(--text-muted)")}>
                  <span>{n.icon}</span>{n.label}
                </div>
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
                        autoFocus
                        value={nameEntwurf}
                        onChange={e => setNameEntwurf(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === "Enter") nameSpeichern();
                          else if (e.key === "Escape") setUmbenennenId(null);
                        }}
                        onBlur={nameSpeichern}
                        className="w-full text-xs text-center rounded-sm border border-(--accent) bg-(--bg) px-1"
                      />
                    ) : (
                      <span className="text-xs break-all leading-tight">{d.name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-(--border) bg-(--surface) p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          <ul className="flex flex-col gap-1.5">
            {AUFGABEN.map((a, i) => (
              <li key={i} className={"text-sm flex gap-2 " + (i === schritt ? "font-bold" : i < schritt ? "text-(--text-muted)" : "")}>
                <span>{i < schritt ? "✅" : i === schritt ? "👉" : "⬜"}</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
          <div className="min-h-10 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
        </aside>
      </div>

      {menue && (
        <Kontextmenue
          x={menue.x}
          y={menue.y}
          onZu={() => setMenue(null)}
          eintraege={menue.ziel === "leer" ? [
            { text: "Neuer Ordner", symbol: <span aria-hidden>📁</span>, onWahl: () => aendern(neuerOrdner) },
            "trenner",
            { text: "Ansicht", aus: true },
            { text: "Sortieren nach", aus: true },
          ] : [
            { text: "Ausschneiden", symbol: SYMBOLE.ausschneiden, kuerzel: "Strg+X", onWahl: () => aendern(ausschneiden) },
            { text: "Kopieren", symbol: SYMBOLE.kopieren, kuerzel: "Strg+C", onWahl: () => aendern(kopieren) },
            { text: "Umbenennen", symbol: SYMBOLE.umbenennen, kuerzel: "F2", onWahl: () => anF2(menue.ziel) },
            { text: "Löschen", symbol: SYMBOLE.loeschen, kuerzel: "Entf", onWahl: handleLoeschen },
          ]}
        />
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
