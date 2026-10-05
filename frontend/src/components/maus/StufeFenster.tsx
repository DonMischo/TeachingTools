"use client";
/**
 * Stufe »Fenster bedienen«: ein echter Windows-11-Bildschirm (WindowsDesktop)
 * mit einem Editor-Fenster.
 *
 * Zehn Aufgaben nacheinander — maximieren, wiederherstellen, minimieren,
 * zurückholen, verschieben, Größe ändern, Alt+Tab, schließen, Speichern
 * unter, die Datei im Explorer wiederfinden. Jede Aufgabe baut auf der
 * vorherigen auf, zählt aber einzeln.
 */
import { useEffect, useRef, useState, type PointerEvent as ZeigerEreignis } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import {
  DESKTOP, START_FENSTER, TASKLEISTE_HOEHE,
  ZIEL_GROESSE, ZIEL_POSITION, altTabGeschafft, amZiel, groesseAendern, groesseErreicht,
  maximieren, minimieren, schliessen, verschieben, wiederherstellen, zielRahmen, zurueckholen,
  type FensterZustand,
} from "@/lib/maus/fenster";
import { type StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { baueDateisystem, neueDatei, type Dateisystem, type Knoten } from "@/lib/maus/dateisystem";
import type { AppId } from "@/lib/maus/windows";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { ExplorerInhalt } from "./windows/ExplorerInhalt";
import { SpeichernUnter } from "./windows/SpeichernUnter";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";

type AufgabeId =
  | "maximieren" | "wiederherstellen" | "minimieren" | "zurueckholen"
  | "verschieben" | "groesse" | "altTab" | "schliessen" | "speichern" | "wiederfinden";

const AUFGABEN: { id: AufgabeId; text: string }[] = [
  { id: "maximieren", text: "Fenster maximieren" },
  { id: "wiederherstellen", text: "Fenster wiederherstellen" },
  { id: "minimieren", text: "Fenster minimieren" },
  { id: "zurueckholen", text: "Aus der Taskleiste zurückholen" },
  { id: "verschieben", text: "Fenster verschieben" },
  { id: "groesse", text: "Größe ändern" },
  { id: "altTab", text: "Mit Alt + Tab wechseln" },
  { id: "schliessen", text: "Fenster schließen" },
  { id: "speichern", text: "Speichern unter" },
  { id: "wiederfinden", text: "Datei wiederfinden" },
];

type Hinweis = { text: string; gut: boolean } | null;

export default function StufeFenster({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, benutzer } = useWindows();
  const [nr, setNr] = useState(0);
  const [zustand, setZustand] = useState<FensterZustand>({ modus: "normal", pos: START_FENSTER });
  const [titel, setTitel] = useState("Notizen");
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [dialog, setDialog] = useState(false);
  const [speichernOffen, setSpeichernOffen] = useState(false);
  const [explorerOffen, setExplorerOffen] = useState(false);
  const [explorerOrdner, setExplorerOrdner] = useState("pc");
  const [aktivFenster, setAktivFenster] = useState<AppId | null>("editor");
  const [fs, setFs] = useState<Dateisystem>(() => baueDateisystem(benutzer));
  const [altTabHinweisText, setAltTabHinweisText] = useState<string | null>(null);
  const gespeicherteDatei = useRef<{ ordner: string; id: string; name: string } | null>(null);
  const start = useRef(performance.now());
  const geloesteAufgaben = useRef(0);
  const fehlerZahl = useRef(0);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const titelRef = useRef<HTMLDivElement>(null);
  const maxRef = useRef<HTMLButtonElement>(null);
  const minRef = useRef<HTMLButtonElement>(null);
  const schliessenRef = useRef<HTMLButtonElement>(null);
  const eckeRef = useRef<HTMLDivElement>(null);
  const speichernRef = useRef<HTMLButtonElement>(null);
  const weggegangenSeit = useRef<number | null>(null);
  const zug = useRef<{ art: "verschieben" | "groesse"; x: number; y: number } | null>(null);
  // Nach der Vorführung steht alles wieder so da wie vorher — sonst wäre das
  // Fenster z. B. schon maximiert, oder der Explorer bliebe offen.
  const vorDemo = useRef<{
    zustand: FensterZustand; dialog: boolean; speichernOffen: boolean;
    explorerOffen: boolean; explorerOrdner: string; aktivFenster: AppId | null;
  } | null>(null);
  const demo = useDemo(() => {
    if (vorDemo.current) {
      setZustand(vorDemo.current.zustand);
      setDialog(vorDemo.current.dialog);
      setSpeichernOffen(vorDemo.current.speichernOffen);
      setExplorerOffen(vorDemo.current.explorerOffen);
      setExplorerOrdner(vorDemo.current.explorerOrdner);
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

  function bildschirmOrt(el: Element | null) {
    return mitte(el);
  }

  // ── Kopfzeilen-Knöpfe ───────────────────────────────────────────────
  function klickMaximieren() {
    if (demo.aktiv || dialog) return;
    if (zustand.modus === "maximiert") {
      setZustand(wiederherstellen(zustand));
      geschafft("wiederherstellen", "Wiederhergestellt!");
    } else {
      setZustand(maximieren(zustand));
      geschafft("maximieren", "Maximiert!");
    }
  }

  function doppelklickTitel() {
    if (demo.aktiv || dialog || zustand.modus !== "maximiert") return;
    setZustand(wiederherstellen(zustand));
    geschafft("wiederherstellen", "Wiederhergestellt!");
  }

  function klickMinimieren() {
    if (demo.aktiv || dialog || zustand.modus === "minimiert") return;
    setZustand(minimieren(zustand));
    geschafft("minimieren", "Minimiert!");
  }

  function klickSchliessen() {
    if (demo.aktiv || zustand.modus === "minimiert") return;
    setDialog(true);
    setAktivFenster("editor");
  }

  function dialogAntwort(taste: "speichern" | "nicht" | "abbrechen") {
    if (taste === "abbrechen") {
      fehlerZahl.current += 1;
      setHinweis({ text: "»Abbrechen« lässt das Fenster offen — wähle »Speichern«, um weiterzumachen.", gut: false });
      return;
    }
    if (taste === "nicht") {
      setHinweis({ text: "Dann wären deine Notizen weg — wähle »Speichern«.", gut: false });
      return;
    }
    setDialog(false);
    setSpeichernOffen(true);
    // Sofort weiter (kein Verzögerungs-Häkchen) — sonst wäre der Speichern-Dialog
    // schon offen, während die Aufgabenliste noch bei »Fenster schließen« steht.
    if (aufgabe.id === "schliessen") {
      geloesteAufgaben.current += 1;
      setNr(nr + 1);
    }
  }

  function speichernAbgeschlossen(ordnerId: string, dateiname: string) {
    if (aufgabe.id !== "speichern") return;
    if (dateiname.toLowerCase() === "unbenannt.txt") {
      fehlerZahl.current += 1;
      setHinweis({ text: "Nimm lieber einen eigenen Namen, zum Beispiel »Meine Notizen« — nicht »Unbenannt«.", gut: false });
      return;
    }
    const { fs: neuFs, id } = neueDatei(fs, ordnerId, dateiname, "editor");
    setFs(neuFs);
    gespeicherteDatei.current = { ordner: ordnerId, id, name: dateiname };
    setSpeichernOffen(false);
    setZustand(schliessen(zustand));
    setAktivFenster(null);
    geschafft("speichern", "Gespeichert!");
  }

  function speichernFehlgeschlagen() {
    fehlerZahl.current += 1;
  }

  // ── Explorer ─────────────────────────────────────────────────────
  function explorerOeffnen() {
    if (demo.aktiv) return;
    setExplorerOffen(true);
    setExplorerOrdner("pc");
    setAktivFenster("explorer");
  }

  function explorerOrdnerWechsel(id: string) {
    if (fs[id]?.gesperrt) fehlerZahl.current += 1;
    setExplorerOrdner(id);
  }

  function explorerDateiOeffnen(k: Knoten) {
    if (aufgabe.id !== "wiederfinden") return;
    if (gespeicherteDatei.current && k.id === gespeicherteDatei.current.id) {
      setExplorerOffen(false);
      setZustand({ modus: "normal", pos: START_FENSTER });
      setTitel(k.name);
      setAktivFenster("editor");
      geschafft("wiederfinden", "Wiedergefunden!");
    } else {
      fehlerZahl.current += 1;
      setHinweis({ text: "Das ist nicht deine gespeicherte Datei — schau noch einmal genau hin.", gut: false });
    }
  }

  // ── Symbole & Taskleiste ──────────────────────────────────────────
  function symbolDoppelklick(id: AppId) {
    if (id === "dieserpc") explorerOeffnen();
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
    if (demo.aktiv || dialog || zustand.modus !== "normal" || e.button !== 0) return;
    // Die Knöpfe ─ ▢ ✕ sitzen in der Titelleiste. Holte sich die Leiste den
    // Zeiger schon beim Drücken auf einen Knopf, landete der Klick bei der
    // Leiste statt beim Knopf — Maximieren tat dann nichts.
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    zug.current = { art: "verschieben", x: e.clientX, y: e.clientY };
    setAktivFenster("editor");
  }

  function eckeGreifen(e: ZeigerEreignis) {
    if (demo.aktiv || dialog || zustand.modus !== "normal" || e.button !== 0) return;
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
    vorDemo.current = { zustand, dialog, speichernOffen, explorerOffen, explorerOrdner, aktivFenster };
    let schritte: DemoSchritt[] = [];
    if (aufgabe.id === "maximieren") {
      schritte = [
        { text: "Zeige auf den mittleren Knopf ▢ in der Titelleiste.", zu: () => bildschirmOrt(maxRef.current) },
        { text: "Klick — das Fenster füllt den Bildschirm.", taste: "links", aktion: () => setZustand(z => maximieren(z)) },
      ];
    } else if (aufgabe.id === "wiederherstellen") {
      schritte = [
        { text: "Zeige wieder auf ▢.", zu: () => bildschirmOrt(maxRef.current) },
        { text: "Klick — das Fenster hat wieder seine alte Größe.", taste: "links", aktion: () => setZustand(z => wiederherstellen(z)) },
      ];
    } else if (aufgabe.id === "minimieren") {
      schritte = [
        { text: "Zeige auf den linken Knopf ─.", zu: () => bildschirmOrt(minRef.current) },
        { text: "Klick — das Fenster verschwindet in die Taskleiste.", taste: "links", aktion: () => setZustand(z => minimieren(z)) },
      ];
    } else if (aufgabe.id === "zurueckholen") {
      schritte = [
        { text: "Zeige auf das Symbol in der Taskleiste.", zu: () => bildschirmOrt(document.querySelector('[data-taskleiste="editor"]')) },
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
        { text: "Zeige auf die Titelleiste.", zu: () => bildschirmOrt(titelRef.current) },
        { text: "Taste festhalten …", taste: "halten" },
        { text: "… und zum gestrichelten Feld ziehen.", taste: "halten", zu: zielOrt, ms: 1600 },
        { text: "Loslassen — das Fenster liegt im Ziel.", taste: null },
      ];
    } else if (aufgabe.id === "groesse") {
      schritte = [
        { text: "Zeige auf die untere rechte Ecke.", zu: () => bildschirmOrt(eckeRef.current) },
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
        { text: "Zeige auf das ✕ oben rechts.", zu: () => bildschirmOrt(schliessenRef.current) },
        { text: "Klick — es erscheint eine Frage.", taste: "links", aktion: () => setDialog(true) },
        { text: "»Speichern« macht weiter, deine Notizen bleiben erhalten.", zu: () => bildschirmOrt(speichernRef.current), aktion: () => setDialog(true) },
      ];
    } else if (aufgabe.id === "speichern") {
      schritte = [
        { text: "Zeige im Dialog auf »Dokumente«.", zu: () => bildschirmOrt(document.querySelector('[data-nav="dokumente"]')) },
        { text: "Klick — der Ordner ist ausgewählt.", taste: "links" },
        { text: "Zeige auf das Namensfeld und gib einen eigenen Namen ein, z. B. »Meine Notizen«.", zu: () => bildschirmOrt(document.querySelector('[data-testid="dateiname"]')) },
        { text: "Zeige auf »Speichern« und klick.", zu: () => bildschirmOrt(document.querySelector('[data-testid="speichern-knopf"]')), taste: "links" },
      ];
    } else if (aufgabe.id === "wiederfinden") {
      schritte = [
        { text: "Zeige auf »Dieser PC« auf dem Desktop.", zu: () => bildschirmOrt(document.querySelector('[data-desktop-symbol="dieserpc"]')), aktion: () => { setExplorerOffen(true); setExplorerOrdner("pc"); } },
        { text: "Doppelklick — der Explorer öffnet sich.", taste: "doppel" },
        { text: "Öffne »Dokumente« …", zu: () => bildschirmOrt(document.querySelector('[data-nav="dokumente"]')), aktion: () => setExplorerOrdner("dokumente") },
        { text: "… und doppelklicke deine gespeicherte Datei.", taste: "doppel" },
      ];
    }
    demo.abspielen(schritte);
  }

  const hilfeGroesse = hilfe ? HILFE_GROESSE : 1;
  const knopfGroesse = 22 * hilfeGroesse;

  const offenListe: AppId[] = [
    ...(zustand.modus !== "geschlossen" ? (["editor"] as AppId[]) : []),
    ...(explorerOffen ? (["explorer"] as AppId[]) : []),
  ];

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🪟 Teil 2 · Fenster"
        auftrag={fertig
          ? <>Alle Aufgaben rund ums Fenster geschafft!</>
          : <>{AUFGABEN[nr].id === "verschieben"
              ? <>Ziehe das Fenster an der <b>Titelleiste</b> in das gestrichelte Feld.</>
              : AUFGABEN[nr].id === "groesse"
                ? <>Das Fenster ist zurück in der Mitte — zieh jetzt die <b>untere rechte Ecke</b>, bis es den gestrichelten Rahmen ausfüllt.</>
                : AUFGABEN[nr].id === "altTab"
                  ? <>Halte <b>Alt</b> gedrückt und drücke <b>Tab</b>, um zu einem anderen Programm zu wechseln — und komm dann wieder hierher zurück.</>
                  : AUFGABEN[nr].id === "speichern"
                    ? <>Speichere in <b>Dokumente</b> (oder einem anderen eigenen Ordner) unter einem eigenen Namen, z. B. »Meine Notizen«.</>
                    : AUFGABEN[nr].id === "wiederfinden"
                      ? <>Öffne den <b>Explorer</b> — über »Dieser PC« auf dem Desktop oder das Symbol in der Taskleiste — und öffne deine Datei wieder.</>
                      : <>Aufgabe: <b>{AUFGABEN[nr].text}</b></>}</>}
        punkte={punkteStand()}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <span className="text-4xl">🪟</span>
      </Stufenkopf>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {AUFGABEN.map((a, i) => (
          <li key={a.id} className={i === nr ? "font-bold" : i < nr ? "text-muted" : ""}>
            {i < nr ? "✅" : i === nr ? "👉" : "⬜"} {a.text}
          </li>
        ))}
      </ul>

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text ?? altTabHinweisText}
      </div>

      <WindowsDesktop
        aussehen={aussehen}
        symbole={["dieserpc"]}
        taskleiste={["explorer"]}
        offen={offenListe}
        aktiv={aktivFenster}
        onSymbol={symbolDoppelklick}
        onTaskleiste={taskleisteKlick}
        rahmenRef={rahmenRef}
        className="mx-auto"
        style={{ maxWidth: 900 }}
        onPointerMove={zeigerBewegt}
        onPointerUp={zeigerLos}
        onPointerCancel={zeigerLos}
        overlay={<>
          {dialog && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-auto">
              <div className="card shadow-xl p-4 flex flex-col gap-3 max-w-[260px]">
                <p className="text-sm font-bold">Möchtest du die Änderungen speichern?</p>
                <div className="flex flex-col gap-2 text-sm">
                  <button ref={speichernRef} type="button" onClick={() => dialogAntwort("speichern")}
                    className="btn-primary px-3 py-1.5 border border-accent">
                    Speichern
                  </button>
                  <button type="button" onClick={() => dialogAntwort("nicht")}
                    className="rounded-lg px-3 py-1.5 border border-line hover:border-accent">
                    Nicht speichern
                  </button>
                  <button type="button" onClick={() => dialogAntwort("abbrechen")}
                    className="rounded-lg px-3 py-1.5 border border-line hover:border-accent">
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}
          {speichernOffen && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-auto">
              <div style={{ width: "min(90%, 30em)" }}>
                <SpeichernUnter
                  fs={fs}
                  startOrdner="dokumente"
                  vorschlag="Unbenannt"
                  endung=".txt"
                  dunkel={aussehen.dunkel}
                  hilfe={hilfe}
                  onSpeichern={speichernAbgeschlossen}
                  onAbbrechen={() => setSpeichernOffen(false)}
                  onFehler={speichernFehlgeschlagen}
                />
              </div>
            </div>
          )}
        </>}
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
              <span className="text-sm font-bold flex-1 truncate">{titel} – Editor</span>
              <button ref={minRef} type="button" onClick={klickMinimieren}
                className="rounded-sm hover:bg-surface flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Minimieren">─</button>
              <button ref={maxRef} type="button" onClick={klickMaximieren}
                className="rounded-sm hover:bg-surface flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Maximieren / Wiederherstellen">▢</button>
              <button ref={schliessenRef} type="button" onClick={klickSchliessen}
                className="rounded-sm hover:bg-red-500 hover:text-white flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Schließen">✕</button>
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
                  <path d="M9 1 L1 9 M9 5 L5 9" stroke="var(--text-muted)" strokeWidth="1.2" />
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
              <button type="button" onClick={() => setExplorerOffen(false)}
                className="rounded-sm hover:bg-red-500 hover:text-white flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Explorer schließen">✕</button>
            </div>
            <div className="flex-1 min-h-0">
              <ExplorerInhalt
                fs={fs}
                ordner={explorerOrdner}
                onOrdner={explorerOrdnerWechsel}
                onOeffnen={explorerDateiOeffnen}
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
