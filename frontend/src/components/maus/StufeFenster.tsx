"use client";
/**
 * Stufe »Fenster bedienen«: ein Mock-Fenster auf einem Mock-Bildschirm.
 *
 * Acht Aufgaben nacheinander — maximieren, wiederherstellen, minimieren,
 * zurückholen, verschieben, Größe ändern, Alt+Tab, schließen. Jede Aufgabe
 * baut auf der vorherigen auf (dasselbe Fenster), zählt aber einzeln.
 */
import { useEffect, useRef, useState, type PointerEvent as ZeigerEreignis } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import {
  DESKTOP, START_FENSTER, TASKLEISTE_HOEHE,
  ZIEL_GROESSE, ZIEL_POSITION, altTabGeschafft, amZiel, groesseAendern, groesseErreicht,
  maximieren, minimieren, schliessen, verschieben, wiederherstellen, zurueckholen,
  type FensterZustand,
} from "@/lib/maus/fenster";
import { PUNKTE_TEIL2, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";

type AufgabeId =
  | "maximieren" | "wiederherstellen" | "minimieren" | "zurueckholen"
  | "verschieben" | "groesse" | "altTab" | "schliessen";

const AUFGABEN: { id: AufgabeId; text: string }[] = [
  { id: "maximieren", text: "Fenster maximieren" },
  { id: "wiederherstellen", text: "Fenster wiederherstellen" },
  { id: "minimieren", text: "Fenster minimieren" },
  { id: "zurueckholen", text: "Aus der Taskleiste zurückholen" },
  { id: "verschieben", text: "Fenster verschieben" },
  { id: "groesse", text: "Größe ändern" },
  { id: "altTab", text: "Mit Alt + Tab wechseln" },
  { id: "schliessen", text: "Fenster schließen" },
];

type Hinweis = { text: string; gut: boolean } | null;

export default function StufeFenster({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const [nr, setNr] = useState(0);
  const [zustand, setZustand] = useState<FensterZustand>({ modus: "normal", pos: START_FENSTER });
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [dialog, setDialog] = useState(false);
  const [altTabHinweisText, setAltTabHinweisText] = useState<string | null>(null);
  const start = useRef(performance.now());
  const geloesteAufgaben = useRef(0);
  const desktopRef = useRef<HTMLDivElement>(null);
  const titelRef = useRef<HTMLDivElement>(null);
  const maxRef = useRef<HTMLButtonElement>(null);
  const minRef = useRef<HTMLButtonElement>(null);
  const schliessenRef = useRef<HTMLButtonElement>(null);
  const taskleisteRef = useRef<HTMLButtonElement>(null);
  const eckeRef = useRef<HTMLDivElement>(null);
  const speichernRef = useRef<HTMLButtonElement>(null);
  const weggegangenSeit = useRef<number | null>(null);
  const zug = useRef<{ art: "verschieben" | "groesse"; x: number; y: number } | null>(null);
  // Nach der Vorführung steht das Fenster wieder so da wie vorher — sonst
  // wäre es z. B. schon maximiert, und der nächste Klick täte das Gegenteil.
  const vorDemo = useRef<FensterZustand | null>(null);
  const demo = useDemo(() => {
    if (vorDemo.current) setZustand(vorDemo.current);
    vorDemo.current = null;
    setDialog(false);
  });

  const fertig = nr >= AUFGABEN.length;
  const aufgabe = AUFGABEN[Math.min(nr, AUFGABEN.length - 1)];

  function melden(neu: number) {
    onFertig({
      punkte: Math.round((PUNKTE_TEIL2 * neu) / AUFGABEN.length),
      dauerMs: Math.round(performance.now() - start.current),
      details: [`${neu} von ${AUFGABEN.length} Aufgaben`, "Alt + Tab geschafft"],
    });
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
    const el = desktopRef.current;
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

  function klickTaskleiste() {
    if (demo.aktiv) return;
    if (zustand.modus === "minimiert") {
      setZustand(zurueckholen(zustand));
      geschafft("zurueckholen", "Zurückgeholt!");
    }
  }

  function klickSchliessen() {
    if (demo.aktiv || zustand.modus === "minimiert") return;
    setDialog(true);
  }

  function dialogAntwort(taste: "speichern" | "nicht" | "abbrechen") {
    if (taste === "abbrechen") {
      setHinweis({ text: "»Abbrechen« lässt das Fenster offen — »Speichern« oder »Nicht speichern« schließt es.", gut: false });
      return;
    }
    setDialog(false);
    setZustand(schliessen(zustand));
    geschafft("schliessen", "Geschlossen!");
  }

  // ── Verschieben & Größe ändern ────────────────────────────────────
  function titelGreifen(e: ZeigerEreignis) {
    if (demo.aktiv || dialog || zustand.modus !== "normal" || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    zug.current = { art: "verschieben", x: e.clientX, y: e.clientY };
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
    vorDemo.current = zustand;
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
        { text: "Zeige auf das Symbol in der Taskleiste.", zu: () => bildschirmOrt(taskleisteRef.current) },
        { text: "Klick — das Fenster ist wieder da.", taste: "links", aktion: () => setZustand(z => zurueckholen(z)) },
      ];
    } else if (aufgabe.id === "verschieben") {
      const zielOrt = () => {
        const el = desktopRef.current;
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
        { text: "»Speichern« oder »Nicht speichern« schließt das Fenster.", zu: () => bildschirmOrt(speichernRef.current), aktion: () => setDialog(true) },
      ];
    }
    demo.abspielen(schritte);
  }

  const hilfeGroesse = hilfe ? HILFE_GROESSE : 1;
  const knopfGroesse = 22 * hilfeGroesse;

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🪟 Teil 2 · Fenster"
        auftrag={fertig
          ? <>Alle Aufgaben rund ums Fenster geschafft!</>
          : <>{AUFGABEN[nr].text === "Fenster verschieben"
              ? <>Ziehe das Fenster an der <b>Titelleiste</b> in das gestrichelte Feld.</>
              : AUFGABEN[nr].text === "Größe ändern"
                ? <>Ziehe die <b>untere rechte Ecke</b>, bis das Fenster den gestrichelten Rahmen ausfüllt.</>
                : AUFGABEN[nr].text === "Mit Alt + Tab wechseln"
                  ? <>Halte <b>Alt</b> gedrückt und drücke <b>Tab</b>, um zu einem anderen Programm zu wechseln — und komm dann wieder hierher zurück.</>
                  : <>Aufgabe: <b>{AUFGABEN[nr].text}</b></>}</>}
        punkte={Math.round((PUNKTE_TEIL2 * geloesteAufgaben.current) / AUFGABEN.length)}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <span className="text-4xl">🪟</span>
      </Stufenkopf>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {AUFGABEN.map((a, i) => (
          <li key={a.id} className={i === nr ? "font-bold" : i < nr ? "text-[var(--text-muted)]" : ""}>
            {i < nr ? "✅" : i === nr ? "👉" : "⬜"} {a.text}
          </li>
        ))}
      </ul>

      <div className="min-h-[1.5rem] text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text ?? altTabHinweisText}
      </div>

      <div
        ref={desktopRef}
        className="relative mx-auto w-full rounded-2xl border border-[var(--border)] overflow-hidden select-none"
        style={{
          maxWidth: 900,
          aspectRatio: `${DESKTOP.w} / ${DESKTOP.h}`,
          background: "linear-gradient(135deg, #6ea8e0, #8fd3c0)",
          touchAction: "none",
        }}
        onPointerMove={zeigerBewegt}
        onPointerUp={zeigerLos}
        onPointerCancel={zeigerLos}
      >
        {zustand.modus !== "geschlossen" && zustand.modus !== "minimiert" && (
          <div
            className="absolute rounded-xl shadow-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden"
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
              className="flex items-center gap-2 px-2 shrink-0 bg-[var(--surface-hover)] border-b border-[var(--border)] cursor-grab"
              style={{ height: 32 * hilfeGroesse }}
            >
              <span>✏️</span>
              <span className="text-sm font-bold flex-1 truncate">Notizen</span>
              <button ref={minRef} type="button" onClick={klickMinimieren}
                className="rounded hover:bg-[var(--surface)] flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Minimieren">─</button>
              <button ref={maxRef} type="button" onClick={klickMaximieren}
                className="rounded hover:bg-[var(--surface)] flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Maximieren / Wiederherstellen">▢</button>
              <button ref={schliessenRef} type="button" onClick={klickSchliessen}
                className="rounded hover:bg-red-500 hover:text-white flex items-center justify-center"
                style={{ width: knopfGroesse, height: knopfGroesse }} aria-label="Schließen">✕</button>
            </div>
            <div className="flex-1 p-3 text-sm leading-relaxed overflow-hidden flex items-center justify-center gap-3">
              <span className="text-3xl">{AVATARS.find(a => a.id === avatar)?.emoji ?? "📝"}</span>
              <p className="text-[var(--text-muted)]">Das ist dein Notizen-Fenster.</p>
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
        {aufgabe.id === "groesse" && !fertig && (
          <div
            className="absolute rounded-xl border-2 border-dashed pointer-events-none"
            style={{
              left: `${(zustand.pos.x / DESKTOP.w) * 100}%`,
              top: `${(zustand.pos.y / DESKTOP.h) * 100}%`,
              width: `${(ZIEL_GROESSE.w / DESKTOP.w) * 100}%`,
              height: `${(ZIEL_GROESSE.h / DESKTOP.h) * 100}%`,
              borderColor: "var(--accent)",
            }}
          />
        )}

        {/* Taskleiste */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-[var(--surface)]/95 border-t border-[var(--border)]"
          style={{ height: `${(TASKLEISTE_HOEHE / DESKTOP.h) * 100}%` }}
        >
          <span className="text-xs opacity-60">⊞</span>
          <button
            ref={taskleisteRef}
            type="button"
            onClick={klickTaskleiste}
            className="relative flex flex-col items-center text-sm px-1"
            aria-label="Notizen (in der Taskleiste)"
          >
            ✏️
            {zustand.modus !== "geschlossen" && (
              <span className="absolute -bottom-1 w-3 h-[2px] rounded-full bg-[var(--accent)]" />
            )}
          </button>
          <span className="text-xs opacity-60 tabular-nums ml-auto mr-2">12:34</span>
        </div>

        {dialog && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl p-4 flex flex-col gap-3 max-w-[260px]">
              <p className="text-sm font-bold">Möchtest du die Änderungen speichern?</p>
              <div className="flex flex-col gap-2 text-sm">
                <button ref={speichernRef} type="button" onClick={() => dialogAntwort("speichern")}
                  className="rounded-lg px-3 py-1.5 border border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] font-bold">
                  Speichern
                </button>
                <button type="button" onClick={() => dialogAntwort("nicht")}
                  className="rounded-lg px-3 py-1.5 border border-[var(--border)] hover:border-[var(--accent)]">
                  Nicht speichern
                </button>
                <button type="button" onClick={() => dialogAntwort("abbrechen")}
                  className="rounded-lg px-3 py-1.5 border border-[var(--border)] hover:border-[var(--accent)]">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
