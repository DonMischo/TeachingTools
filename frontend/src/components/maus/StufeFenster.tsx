"use client";
/**
 * Stufe »Fenster bedienen«: ein echter Windows-11-Bildschirm (WindowsDesktop)
 * mit einem Editor-Fenster.
 *
 * Acht Aufgaben nacheinander — maximieren, wiederherstellen, minimieren,
 * zurückholen, verschieben, Größe ändern, Alt+Tab, schließen. Jede Aufgabe
 * baut auf der vorherigen auf, zählt aber einzeln. Geschlossen wird ohne
 * Rückfrage: im Fenster wurde nichts verändert. Schreiben, Speichern und
 * Wiederfinden übt die nächste Stufe (StufeDatei).
 */
import { useEffect, useRef, useState, type PointerEvent as ZeigerEreignis, type ReactNode } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import {
  DESKTOP, START_FENSTER, TASKLEISTE_HOEHE,
  ZIEL_GROESSE, ZIEL_POSITION, altTabGeschafft, amZiel, groesseAendern, groesseErreicht,
  maximieren, minimieren, schliessen, verschieben, wiederherstellen, zielRahmen, zurueckholen,
  type FensterZustand,
} from "@/lib/maus/fenster";
import { type StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { baueDateisystem } from "@/lib/maus/dateisystem";
import type { AppId } from "@/lib/maus/windows";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { ExplorerInhalt } from "./windows/ExplorerInhalt";
import { FensterSymbol, KnopfImText } from "./windows/FensterSymbol";
import { Stufenkopf } from "./Stufenkopf";
import { Taste } from "./Taste";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { Hinweiszeile } from "./aufgabenStufe";

type AufgabeId =
  | "maximieren" | "wiederherstellen" | "minimieren" | "zurueckholen"
  | "verschieben" | "groesse" | "altTab" | "schliessen";

/** Kleines Bild der Ecke unten rechts — wie im Fenster. */
function EckeImText() {
  return (
    <span className="inline-flex items-center justify-center align-middle rounded-sm border-2 border-accent mx-0.5 w-6 h-6">
      <svg viewBox="0 0 10 10" width="14" height="14" aria-hidden>
        <path d="M9 1 L1 9 M9 5 L5 9" style={{ stroke: "currentColor" }} strokeWidth="1.4" />
      </svg>
    </span>
  );
}

function TitelleisteImText() {
  return (
    <span className="inline-flex items-center align-middle rounded-sm border-2 border-accent bg-surface-hover mx-0.5 px-1.5 h-6 text-xs font-bold">
      ✏️ Notizen – Editor
    </span>
  );
}

const AUFGABEN: { id: AufgabeId; text: string; symbol: ReactNode; auftrag: ReactNode }[] = [
  {
    id: "maximieren", text: "Fenster maximieren", symbol: <KnopfImText art="maximieren" />,
    auftrag: <>Klick oben rechts im Fenster auf <KnopfImText art="maximieren" /> (<b>Maximieren</b>) — das Fenster füllt dann den ganzen Bildschirm.</>,
  },
  {
    id: "wiederherstellen", text: "Fenster wiederherstellen", symbol: <KnopfImText art="wiederherstellen" />,
    auftrag: <>Der Knopf sieht jetzt anders aus: zwei Rechtecke <KnopfImText art="wiederherstellen" />. Klick darauf (<b>Wiederherstellen</b>) — das Fenster bekommt seine alte Größe zurück.</>,
  },
  {
    id: "minimieren", text: "Fenster minimieren", symbol: <KnopfImText art="minimieren" />,
    auftrag: <>Klick auf <KnopfImText art="minimieren" /> (<b>Minimieren</b>) — das Fenster verschwindet in die Taskleiste.</>,
  },
  {
    id: "zurueckholen", text: "Aus der Taskleiste zurückholen",
    symbol: <span className="inline-flex align-middle mx-0.5"><AppSymbol id="editor" groesse={22} titel={false} /></span>,
    auftrag: <>Hol das Fenster zurück: Klick unten in der <b>Taskleiste</b> auf das Editor-Symbol <span className="inline-flex align-middle mx-0.5"><AppSymbol id="editor" groesse={22} titel={false} /></span>.</>,
  },
  {
    id: "verschieben", text: "Fenster verschieben", symbol: <TitelleisteImText />,
    auftrag: <>Greif das Fenster an der <b>Titelleiste</b> <TitelleisteImText /> (Maustaste gedrückt halten) und zieh es in das gestrichelte Feld.</>,
  },
  {
    id: "groesse", text: "Größe ändern", symbol: <EckeImText />,
    auftrag: <>Das Fenster ist zurück in der Mitte — greif die <b>Ecke unten rechts</b> <EckeImText /> und zieh, bis es den gestrichelten Rahmen ausfüllt.</>,
  },
  {
    id: "altTab", text: "Mit Alt + Tab wechseln", symbol: <><Taste>Alt</Taste>+<Taste>Tab</Taste></>,
    auftrag: <>Halte <Taste>Alt</Taste> gedrückt und drücke <Taste>Tab</Taste>, um zu einem anderen Programm zu wechseln — und komm dann wieder hierher zurück.</>,
  },
  {
    id: "schliessen", text: "Fenster schließen", symbol: <KnopfImText art="schliessen" />,
    auftrag: <>Schließ das Fenster mit <KnopfImText art="schliessen" /> (<b>Schließen</b>). Du hast nichts hineingeschrieben — deshalb geht es ohne Rückfrage zu.</>,
  },
];

type Hinweis = { text: string; gut: boolean } | null;

export default function StufeFenster({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, benutzer } = useWindows();
  const [nr, setNr] = useState(0);
  const [zustand, setZustand] = useState<FensterZustand>({ modus: "normal", pos: START_FENSTER });
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [explorerOffen, setExplorerOffen] = useState(false);
  const [explorerOrdner, setExplorerOrdner] = useState("pc");
  const [aktivFenster, setAktivFenster] = useState<AppId | null>("editor");
  const [fs] = useState(() => baueDateisystem(benutzer));
  const [altTabHinweisText, setAltTabHinweisText] = useState<string | null>(null);
  const start = useRef(performance.now());
  const geloesteAufgaben = useRef(0);
  const fehlerZahl = useRef(0);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const titelRef = useRef<HTMLDivElement>(null);
  const maxRef = useRef<HTMLButtonElement>(null);
  const minRef = useRef<HTMLButtonElement>(null);
  const schliessenRef = useRef<HTMLButtonElement>(null);
  const eckeRef = useRef<HTMLDivElement>(null);
  const weggegangenSeit = useRef<number | null>(null);
  const zug = useRef<{ art: "verschieben" | "groesse"; x: number; y: number } | null>(null);
  // Nach der Vorführung steht alles wieder so da wie vorher — sonst wäre das
  // Fenster z. B. schon maximiert, oder der Explorer bliebe offen.
  const vorDemo = useRef<{ zustand: FensterZustand; explorerOffen: boolean; aktivFenster: AppId | null } | null>(null);
  const demo = useDemo(() => {
    if (vorDemo.current) {
      setZustand(vorDemo.current.zustand);
      setExplorerOffen(vorDemo.current.explorerOffen);
      setAktivFenster(vorDemo.current.aktivFenster);
    }
    vorDemo.current = null;
  });

  const fertig = nr >= AUFGABEN.length;
  const aufgabe = AUFGABEN[Math.min(nr, AUFGABEN.length - 1)];

  // Bevor »Größe ändern« beginnt, steht das Fenster wieder in der Mitte —
  // nach der vorherigen Aufgabe (Verschieben) läge der Zielrahmen sonst am
  // Bildschirmrand oder sogar darüber hinaus.
  useEffect(() => {
    if (aufgabe.id === "groesse") {
      setZustand({ modus: "normal", pos: START_FENSTER });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aufgabe.id]);

  function punkteStand(geloest = geloesteAufgaben.current) {
    return wertung({
      stufe: "fenster", geloest, anzahl: AUFGABEN.length,
      dauerMs: performance.now() - start.current, fehler: fehlerZahl.current,
    }).punkte;
  }

  function melden(neu: number) {
    const dauerMs = Math.round(performance.now() - start.current);
    const w = wertung({ stufe: "fenster", geloest: neu, anzahl: AUFGABEN.length, dauerMs, fehler: fehlerZahl.current });
    onFertig({ punkte: w.punkte, dauerMs, details: w.details });
  }

  function geschafft(id: AufgabeId, text: string) {
    if (aufgabe.id !== id) return;
    geloesteAufgaben.current += 1;
    setHinweis({ text, gut: true });
    const naechste = nr + 1;
    setTimeout(() => {
      setHinweis(null);
      setNr(naechste);
      if (naechste === AUFGABEN.length) melden(geloesteAufgaben.current);
    }, 900);
  }

  function skalierung(): number {
    const el = rahmenRef.current;
    if (!el) return 1;
    return el.getBoundingClientRect().width / DESKTOP.w;
  }

  // ── Kopfzeilen-Knöpfe ───────────────────────────────────────────────
  function klickMaximieren() {
    if (demo.aktiv) return;
    if (zustand.modus === "maximiert") {
      setZustand(wiederherstellen(zustand));
      geschafft("wiederherstellen", "Wiederhergestellt!");
    } else {
      setZustand(maximieren(zustand));
      geschafft("maximieren", "Maximiert!");
    }
  }

  function doppelklickTitel() {
    if (demo.aktiv || zustand.modus !== "maximiert") return;
    setZustand(wiederherstellen(zustand));
    geschafft("wiederherstellen", "Wiederhergestellt!");
  }

  function klickMinimieren() {
    if (demo.aktiv || zustand.modus === "minimiert") return;
    setZustand(minimieren(zustand));
    geschafft("minimieren", "Minimiert!");
  }

  function klickSchliessen() {
    if (demo.aktiv || zustand.modus === "minimiert") return;
    if (aufgabe.id !== "schliessen") {
      setHinweis({ text: "Noch nicht schließen — erst die anderen Aufgaben.", gut: false });
      return;
    }
    setZustand(schliessen(zustand));
    setAktivFenster(null);
    geschafft("schliessen", "Geschlossen! Nichts verändert — also auch keine Frage nach dem Speichern.");
  }

  // ── Explorer (zum Ausprobieren, keine Aufgabe) ─────────────────────
  function explorerOeffnen() {
    if (demo.aktiv) return;
    setExplorerOffen(true);
    setExplorerOrdner("pc");
    setAktivFenster("explorer");
  }

  function taskleisteKlick(id: AppId) {
    if (demo.aktiv) return;
    if (id === "explorer") {
      explorerOeffnen();
    } else if (id === "editor") {
      if (zustand.modus === "minimiert") {
        setZustand(zurueckholen(zustand));
        geschafft("zurueckholen", "Zurückgeholt!");
      }
      setAktivFenster("editor");
    }
  }

  // ── Verschieben & Größe ändern ────────────────────────────────────
  function titelGreifen(e: ZeigerEreignis) {
    if (demo.aktiv || zustand.modus !== "normal" || e.button !== 0) return;
    // Die Knöpfe sitzen in der Titelleiste. Holte sich die Leiste den Zeiger
    // schon beim Drücken auf einen Knopf, landete der Klick bei der Leiste
    // statt beim Knopf — Maximieren tat dann nichts.
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    zug.current = { art: "verschieben", x: e.clientX, y: e.clientY };
    setAktivFenster("editor");
  }

  function eckeGreifen(e: ZeigerEreignis) {
    if (demo.aktiv || zustand.modus !== "normal" || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    zug.current = { art: "groesse", x: e.clientX, y: e.clientY };
  }

  function zeigerBewegt(e: ZeigerEreignis) {
    const z = zug.current;
    if (!z) return;
    const s = skalierung();
    const dx = (e.clientX - z.x) / s;
    const dy = (e.clientY - z.y) / s;
    zug.current = { ...z, x: e.clientX, y: e.clientY };
    setZustand(alt => ({
      ...alt,
      pos: z.art === "verschieben" ? verschieben(alt.pos, dx, dy, hilfe) : groesseAendern(alt.pos, dx, dy, hilfe),
    }));
  }

  function zeigerLos() {
    if (!zug.current) return;
    const art = zug.current.art;
    zug.current = null;
    if (art === "verschieben" && amZiel(zustand.pos, ZIEL_POSITION, hilfe)) {
      geschafft("verschieben", "Genau richtig hingeschoben!");
    } else if (art === "groesse" && groesseErreicht(zustand.pos, ZIEL_GROESSE)) {
      geschafft("groesse", "Groß genug!");
    }
  }

  // ── Alt+Tab-Erkennung ─────────────────────────────────────────────
  useEffect(() => {
    if (aufgabe.id !== "altTab" || fertig) return;
    function weg() {
      if (demo.aktiv) return;
      weggegangenSeit.current = performance.now();
    }
    function zurueck() {
      if (demo.aktiv || weggegangenSeit.current === null) return;
      const dauer = performance.now() - weggegangenSeit.current;
      weggegangenSeit.current = null;
      if (altTabGeschafft(dauer)) {
        geschafft("altTab", "Zurück — Alt + Tab hat geklappt!");
      } else {
        fehlerZahl.current += 1;
        setAltTabHinweisText("Fast! Bleib etwas länger beim anderen Programm, bevor du zurückkommst.");
        setTimeout(() => setAltTabHinweisText(null), 2500);
      }
    }
    // Benannt, damit das Aufräumen ihn auch wieder entfernt — sonst stapelte
    // sich bei jedem neuen Render ein weiterer Lauscher.
    function sichtbarkeit() {
      if (document.hidden) weg();
      else zurueck();
    }
    window.addEventListener("blur", weg);
    window.addEventListener("focus", zurueck);
    document.addEventListener("visibilitychange", sichtbarkeit);
    return () => {
      window.removeEventListener("blur", weg);
      window.removeEventListener("focus", zurueck);
      document.removeEventListener("visibilitychange", sichtbarkeit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aufgabe.id, fertig, demo.aktiv]);

  // ── Vorführung je Aufgabe ────────────────────────────────────────
  function vorfuehren() {
    vorDemo.current = { zustand, explorerOffen, aktivFenster };
    let schritte: DemoSchritt[] = [];
    if (aufgabe.id === "maximieren") {
      schritte = [
        { text: "Zeige oben rechts auf den mittleren Knopf: ein Rechteck.", zu: () => mitte(maxRef.current) },
        { text: "Klick — das Fenster füllt den Bildschirm.", taste: "links", aktion: () => setZustand(z => maximieren(z)) },
      ];
    } else if (aufgabe.id === "wiederherstellen") {
      schritte = [
        { text: "Der Knopf zeigt jetzt zwei Rechtecke: »Wiederherstellen«.", zu: () => mitte(maxRef.current) },
        { text: "Klick — das Fenster hat wieder seine alte Größe.", taste: "links", aktion: () => setZustand(z => wiederherstellen(z)) },
      ];
    } else if (aufgabe.id === "minimieren") {
      schritte = [
        { text: "Zeige auf den linken Knopf: der Strich.", zu: () => mitte(minRef.current) },
        { text: "Klick — das Fenster verschwindet in die Taskleiste.", taste: "links", aktion: () => setZustand(z => minimieren(z)) },
      ];
    } else if (aufgabe.id === "zurueckholen") {
      schritte = [
        { text: "Zeige unten in der Taskleiste auf das Editor-Symbol.", zu: () => mitte(document.querySelector('[data-taskleiste="editor"]')) },
        { text: "Klick — das Fenster ist wieder da.", taste: "links", aktion: () => setZustand(z => zurueckholen(z)) },
      ];
    } else if (aufgabe.id === "verschieben") {
      const zielOrt = () => {
        const el = rahmenRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const s = skalierung();
        return { x: r.left + (ZIEL_POSITION.x + zustand.pos.w / 2) * s, y: r.top + (ZIEL_POSITION.y + 20) * s };
      };
      schritte = [
        { text: "Zeige auf die Titelleiste.", zu: () => mitte(titelRef.current) },
        { text: "Taste festhalten …", taste: "halten" },
        { text: "… und zum gestrichelten Feld ziehen.", taste: "halten", zu: zielOrt, ms: 1600 },
        { text: "Loslassen — das Fenster liegt im Ziel.", taste: null },
      ];
    } else if (aufgabe.id === "groesse") {
      schritte = [
        { text: "Zeige auf die untere rechte Ecke.", zu: () => mitte(eckeRef.current) },
        { text: "Taste festhalten und nach außen ziehen …", taste: "halten" },
        { text: "… bis das Fenster den gestrichelten Rahmen ausfüllt.", taste: "halten", ms: 1600 },
        { text: "Loslassen. Groß genug!", taste: null },
      ];
    } else if (aufgabe.id === "altTab") {
      schritte = [
        { text: "Halte Alt fest …", tasten: ["AltLeft"] },
        { text: "… und drücke Tab. So wechselst du das Programm.", tasten: ["AltLeft", "Tab"] },
        { text: "Komm dann wieder zurück hierher — z. B. per Klick in der echten Taskleiste.", taste: null },
      ];
    } else if (aufgabe.id === "schliessen") {
      schritte = [
        { text: "Zeige oben rechts auf das ✕.", zu: () => mitte(schliessenRef.current) },
        { text: "Klick — das Fenster ist zu. Nichts verändert, also keine Frage.", taste: "links", aktion: () => setZustand(z => schliessen(z)) },
      ];
    }
    demo.abspielen(schritte);
  }

  const hilfeGroesse = hilfe ? HILFE_GROESSE : 1;
  const knopfGroesse = 22 * hilfeGroesse;
  const knopfSymbol = Math.round(11 * hilfeGroesse);

  const offenListe: AppId[] = [
    ...(zustand.modus !== "geschlossen" ? (["editor"] as AppId[]) : []),
    ...(explorerOffen ? (["explorer"] as AppId[]) : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🪟 Teil 2 · Fenster"
        auftrag={fertig ? <>Alle Aufgaben rund ums Fenster geschafft!</> : aufgabe.auftrag}
        punkte={punkteStand()}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <span className="text-4xl">🪟</span>
      </Stufenkopf>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm items-center">
        {AUFGABEN.map((a, i) => (
          <li key={a.id} className={"flex items-center gap-1 " + (i === nr ? "font-bold" : i < nr ? "text-muted" : "")}>
            {i < nr ? "✅" : i === nr ? "👉" : "⬜"} {a.symbol} {a.text}
          </li>
        ))}
      </ul>

      <Hinweiszeile hinweis={hinweis} ersatz={altTabHinweisText} />

      <WindowsDesktop
        aussehen={aussehen}
        symbole={["dieserpc"]}
        taskleiste={["explorer"]}
        offen={offenListe}
        aktiv={aktivFenster}
        onSymbol={id => { if (id === "dieserpc") explorerOeffnen(); }}
        onTaskleiste={taskleisteKlick}
        rahmenRef={rahmenRef}
        className="mx-auto"
        style={{ maxWidth: 900 }}
        onPointerMove={zeigerBewegt}
        onPointerUp={zeigerLos}
        onPointerCancel={zeigerLos}
      >
        {zustand.modus !== "geschlossen" && zustand.modus !== "minimiert" && (
          <div
            className="absolute rounded-xl shadow-xl border border-line bg-surface flex flex-col overflow-hidden pointer-events-auto"
            style={zustand.modus === "maximiert"
              ? { left: 0, top: 0, width: "100%", height: `calc(100% - ${(TASKLEISTE_HOEHE / DESKTOP.h) * 100}%)` }
              : {
                left: `${(zustand.pos.x / DESKTOP.w) * 100}%`,
                top: `${(zustand.pos.y / DESKTOP.h) * 100}%`,
                width: `${(zustand.pos.w / DESKTOP.w) * 100}%`,
                height: `${(zustand.pos.h / DESKTOP.h) * 100}%`,
              }}
          >
            <div
              ref={titelRef}
              onPointerDown={titelGreifen}
              onDoubleClick={doppelklickTitel}
              className="flex items-center gap-2 px-2 shrink-0 bg-surface-hover border-b border-line cursor-grab"
              style={{ height: 32 * hilfeGroesse }}
            >
              <span>✏️</span>
              <span className="text-sm font-bold flex-1 truncate">Notizen – Editor</span>
              <button ref={minRef} type="button" onClick={klickMinimieren}
                className="rounded-sm hover:bg-surface flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Minimieren">
                <FensterSymbol art="minimieren" groesse={knopfSymbol} />
              </button>
              <button ref={maxRef} type="button" onClick={klickMaximieren}
                className="rounded-sm hover:bg-surface flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }}
                aria-label={zustand.modus === "maximiert" ? "Wiederherstellen" : "Maximieren"}
                title={zustand.modus === "maximiert" ? "Wiederherstellen" : "Maximieren"}>
                <FensterSymbol art={zustand.modus === "maximiert" ? "wiederherstellen" : "maximieren"} groesse={knopfSymbol} />
              </button>
              <button ref={schliessenRef} type="button" onClick={klickSchliessen}
                className="rounded-sm hover:bg-red-500 hover:text-white flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Schließen">
                <FensterSymbol art="schliessen" groesse={knopfSymbol} />
              </button>
            </div>
            <div className="flex-1 p-3 text-sm leading-relaxed overflow-hidden flex items-center justify-center gap-3">
              <span className="text-3xl">{AVATARS.find(a => a.id === avatar)?.emoji ?? "📝"}</span>
              <p className="text-muted">Das ist dein Notizen-Fenster.</p>
            </div>
            {zustand.modus === "normal" && (
              <div
                ref={eckeRef}
                onPointerDown={eckeGreifen}
                className="absolute right-0 bottom-0 cursor-nwse-resize"
                style={{ width: 18 * hilfeGroesse, height: 18 * hilfeGroesse }}
                aria-label="Größe ändern"
              >
                <svg viewBox="0 0 10 10" className="w-full h-full opacity-60">
                  <path d="M9 1 L1 9 M9 5 L5 9" style={{ stroke: "var(--text-muted)" }} strokeWidth="1.2" />
                </svg>
              </div>
            )}
          </div>
        )}

        {aufgabe.id === "verschieben" && !fertig && (
          <div
            className="absolute rounded-xl border-2 border-dashed pointer-events-none"
            style={{
              left: `${(ZIEL_POSITION.x / DESKTOP.w) * 100}%`,
              top: `${(ZIEL_POSITION.y / DESKTOP.h) * 100}%`,
              width: `${(zustand.pos.w / DESKTOP.w) * 100}%`,
              height: `${(zustand.pos.h / DESKTOP.h) * 100}%`,
              borderColor: "var(--accent)",
            }}
          />
        )}
        {aufgabe.id === "groesse" && !fertig && (() => {
          const rahmen = zielRahmen(zustand.pos, ZIEL_GROESSE);
          return (
            <div
              className="absolute rounded-xl border-2 border-dashed pointer-events-none"
              style={{
                left: `${(rahmen.x / DESKTOP.w) * 100}%`,
                top: `${(rahmen.y / DESKTOP.h) * 100}%`,
                width: `${(rahmen.w / DESKTOP.w) * 100}%`,
                height: `${(rahmen.h / DESKTOP.h) * 100}%`,
                borderColor: "var(--accent)",
              }}
            />
          );
        })()}

        {explorerOffen && (
          <div
            className="absolute rounded-xl shadow-xl border border-line bg-surface flex flex-col overflow-hidden pointer-events-auto"
            style={{ left: "8%", top: "12%", width: "72%", height: "68%" }}
          >
            <div className="flex items-center gap-2 px-2 shrink-0 bg-surface-hover border-b border-line" style={{ height: 32 * hilfeGroesse }}>
              <AppSymbol id="explorer" groesse={18} titel={false} />
              <span className="text-sm font-bold flex-1 truncate">Explorer</span>
              <button type="button" onClick={() => { setExplorerOffen(false); setAktivFenster("editor"); }}
                className="rounded-sm hover:bg-red-500 hover:text-white flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Explorer schließen">
                <FensterSymbol art="schliessen" groesse={knopfSymbol} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ExplorerInhalt
                fs={fs}
                ordner={explorerOrdner}
                onOrdner={setExplorerOrdner}
                dunkel={aussehen.dunkel}
                hilfe={hilfe}
              />
            </div>
          </div>
        )}
      </WindowsDesktop>

      <DemoBuehne demo={demo} />
    </div>
  );
}
