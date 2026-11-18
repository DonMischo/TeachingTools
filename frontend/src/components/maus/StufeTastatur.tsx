"use client";
/**
 * Teil 2, Stufe »Tastatur«: Umschalt, Rücktaste, Entf, Pfeiltasten, Pos1/Ende
 * und die Rettungsanker Strg+Z / Strg+X / Strg+V.
 *
 * Jedes Feld ist *unkontrolliert* (defaultValue + Ref) — mit einem
 * React-`value` würde die native Rückgängig-Funktion (Strg + Z) des Browsers
 * kaputtgehen, die Stufe 7 aber genau prüfen soll. Welche Taste gedrückt
 * wurde, hält ein Ref fest (`Gesehen`), nicht der State — sonst rissen
 * schnelle Tastenfolgen ab.
 */
import { useEffect, useRef, useState } from "react";
import {
  aufgabenFuer, leeresGesehen, mitFeststelltasteGeloest, pruefeAufgabe, zuVieleAnschlaege,
  type Aufgabe, type Gesehen,
} from "@/lib/maus/tastatur";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, useDemo, type DemoSchritt, type Ort } from "./Demo";
import { Taste, codeFuer, mitTasten } from "./Taste";
import { Tastatur } from "@/components/tippen/Tastatur";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import type { Betriebssystem } from "@/lib/maus/system";

type Feld = HTMLInputElement | HTMLTextAreaElement;

/**
 * Bildschirmort eines Zeichens im Feld — damit der Vorführ-Zeiger wirklich
 * auf »Zoo« oder vor den Punkt zeigt. Gemessen über ein Canvas mit der
 * Schrift des Felds; das Feld zeigt nur eine Zeile, das reicht.
 */
function zeichenOrt(el: Feld | null, text: string, index: number): Ort | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
  const ganz = Math.floor(index);
  const breite = ctx.measureText(text.slice(0, ganz)).width
    + (index - ganz) * ctx.measureText(text.charAt(ganz)).width;
  const x = r.left + parseFloat(st.borderLeftWidth) + parseFloat(st.paddingLeft) + breite - el.scrollLeft;
  const zeile = parseFloat(st.lineHeight) || parseFloat(st.fontSize) * 1.4;
  const y = el instanceof HTMLTextAreaElement
    ? r.top + parseFloat(st.borderTopWidth) + parseFloat(st.paddingTop) + zeile / 2
    : r.top + r.height / 2;
  return { x, y };
}

type DemoFeld = {
  el: () => Feld | null;
  setWert: (w: string) => void;
  /** Sichtbar markieren (von, bis) — oder nur den Cursor setzen. */
  markiere: (von: number, bis?: number) => void;
};

function demoSchritte(aufgabe: Aufgabe, f: DemoFeld, system: Betriebssystem): DemoSchritt[] {
  const mac = system === "macos";
  const cmd = mac ? "MetaLeft" : "ControlLeft";
  const bei = (text: string, index: number) => () => zeichenOrt(f.el(), text, index);
  switch (aufgabe.id) {
    case "umschalt":
      return [
        { text: mac ? "Halte ⇧ fest …" : "Halte Umschalt ⇧ fest …", tasten: ["ShiftLeft"] },
        { text: "… und tippe H.", tasten: ["ShiftLeft", "KeyH"], aktion: () => f.setWert("H") },
        { text: "Umschalt loslassen, »und« tippen.", tasten: ["KeyU", "KeyN", "KeyD"], aktion: () => f.setWert("Hund") },
      ];
    case "ruecktaste":
      return [
        { text: "Der Cursor steht hinter dem zweiten e.", zu: bei("Katzee", 6), aktion: () => { f.setWert("Katzee"); f.markiere(6); } },
        { text: mac ? "⌫ drücken: das e links vom Cursor verschwindet." : "Rücktaste ⟵ drücken: das e links vom Cursor verschwindet.", tasten: ["Backspace"], aktion: () => { f.setWert("Katze"); f.markiere(5); } },
      ];
    case "entf":
      return [
        { text: "Der Cursor steht vor dem ersten M.", zu: bei("MMaus", 0), aktion: () => { f.setWert("MMaus"); f.markiere(0); } },
        { text: mac ? "fn und ⌫ zusammen drücken: das M rechts vom Cursor verschwindet." : "Entf drücken (rechts neben dem großen Tastenfeld): das M rechts vom Cursor verschwindet.", tasten: ["Delete"], aktion: () => { f.setWert("Maus"); f.markiere(0); } },
      ];
    case "pfeiltasten":
      return [
        { text: "Der Cursor steht ganz hinten.", zu: bei("Bll", 3), aktion: () => { f.setWert("Bll"); f.markiere(3); } },
        { text: "Mit ← einmal nach links …", tasten: ["ArrowLeft"], aktion: () => f.markiere(2) },
        { text: "… und das fehlende a eintippen.", tasten: ["KeyA"], aktion: () => { f.setWert("Ball"); f.markiere(3); } },
      ];
    case "pos1":
      return [
        { text: "Der Cursor steht ganz hinten.", zu: bei("pfel", 4), aktion: () => { f.setWert("pfel"); f.markiere(4); } },
        { text: mac ? "⌘ und ← drücken: der Cursor springt an den Anfang." : "Pos1 drücken: der Cursor springt an den Anfang.", tasten: mac ? ["MetaLeft", "ArrowLeft"] : ["Home"], aktion: () => f.markiere(0) },
        { text: "A eintippen (mit Umschalt).", tasten: ["ShiftLeft", "KeyA"], aktion: () => { f.setWert("Apfel"); f.markiere(1); } },
      ];
    case "ende":
      return [
        { text: "Der Cursor steht ganz vorn.", zu: bei("Hallo", 0), aktion: () => { f.setWert("Hallo"); f.markiere(0); } },
        { text: mac ? "⌘ und → drücken: der Cursor springt ans Ende." : "Ende drücken: der Cursor springt ans Ende.", tasten: mac ? ["MetaLeft", "ArrowRight"] : ["End"], aktion: () => f.markiere(5) },
        { text: "! eintippen (Umschalt + 1).", tasten: ["ShiftLeft", "Digit1"], aktion: () => { f.setWert("Hallo!"); f.markiere(6); } },
      ];
    case "strgz": {
      const satz = aufgabe.start;
      const wort = satz.indexOf("Maus");
      return [
        { text: "Zeige auf den Satz.", zu: bei(satz, wort + 2), aktion: () => { f.setWert(satz); f.markiere(satz.length); } },
        { text: "Ein Doppelklick markiert nur ein Wort …", taste: "doppel", aktion: () => f.markiere(wort, wort + 5) },
        { text: "… dreimal schnell klicken markiert den ganzen Satz.", taste: "doppel", aktion: () => f.markiere(0, satz.length) },
        { text: mac ? "⌫ drücken: der Satz ist weg." : "Entf drücken: der Satz ist weg.", tasten: [mac ? "Backspace" : "Delete"], aktion: () => f.setWert("") },
        { text: `${mac ? "⌘" : "Strg"} + Z: der Satz ist wieder da!`, tasten: [cmd, "KeyZ"], aktion: () => f.setWert(satz) },
      ];
    }
    case "ausschneiden": {
      const ohne = "Ich war im .";
      return [
        { text: "Zeige mit der Maus auf »Zoo«.", zu: bei(aufgabe.start, 1.5), aktion: () => { f.setWert(aufgabe.start); f.markiere(aufgabe.start.length); } },
        { text: "Doppelklick: das Wort ist markiert.", taste: "doppel", aktion: () => f.markiere(0, 4) },
        { text: `${mac ? "⌘" : "Strg"} + X: ausschneiden (oder Rechtsklick › Ausschneiden).`, tasten: [cmd, "KeyX"], aktion: () => { f.setWert(ohne); f.markiere(0); } },
        { text: "Mit der Maus genau vor den Punkt klicken.", zu: bei(ohne, ohne.length - 1), taste: "links", aktion: () => f.markiere(ohne.length - 1) },
        { text: `${mac ? "⌘ + V: einfügen (oder Rechtsklick › Einsetzen)!" : "Strg + V: einfügen (oder Rechtsklick › Einfügen)!"}`, tasten: [cmd, "KeyV"], aktion: () => { f.setWert("Ich war im Zoo."); f.markiere(14); } },
      ];
    }
  }
}

/**
 * Tasten, die sonst der Browser nimmt.
 *
 * Die Bildschirmtastatur zeigt sie, also müssen sie auch ankommen: ohne das
 * lädt F5 die Seite neu (Fortschritt weg), F3 öffnet die Suchleiste, F6
 * springt in die Adresszeile. `preventDefault` hält das auf, solange die
 * Stufe läuft.
 *
 * Zwei gehen trotzdem nicht, die nimmt der Browser über der Seite weg:
 * **F12** (Entwicklerwerkzeuge) und **Druck** (das Betriebssystem meldet den
 * Tastendruck gar nicht erst an die Seite). Auf beiden darf deshalb keine
 * Aufgabe aufbauen — sie stehen nur zum Anschauen auf der Tastatur.
 */
const ABGEFANGEN = /^(F[1-9]|F1[01]|Escape)$/;

export default function StufeTastatur({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { system } = useWindows();
  const AUFGABEN = aufgabenFuer(system);
  const [nr, setNr] = useState(0);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [erfolg, setErfolg] = useState(false);
  const [gedrueckt, setGedrueckt] = useState<Set<string>>(new Set());
  const [fehler, setFehler] = useState(0);
  const fehlerRef = useRef(0);
  const feld = useRef<Feld>(null);
  const gesehen = useRef<Gesehen>(leeresGesehen());
  const anschlaege = useRef(0);
  const start = useRef(performance.now());
  const vorDemo = useRef("");
  const demo = useDemo(() => { if (feld.current) feld.current.value = vorDemo.current; });

  const fertig = nr >= AUFGABEN.length;
  const aufgabe = AUFGABEN[Math.min(nr, AUFGABEN.length - 1)];

  /**
   * Die Aufgabe auf ihren Anfang zurückstellen: Starttext, Cursor und alles,
   * was die Prüfung über den Weg dorthin gemerkt hat.
   *
   * Dient zwei Zwecken — dem Wechsel zur nächsten Aufgabe und dem Knopf
   * »↺ Text zurücksetzen«. Den braucht es, weil verwirrte Kinder das Feld
   * leer räumen: ohne »Katzee« lässt sich das doppelte e nicht mehr löschen,
   * und die Aufgabe war unlösbar festgefahren. Zurücksetzen ist kein Fehler,
   * es zählt keinen — aber es ist wirklich von vorn, also zählen auch die
   * bisherigen Anschläge nicht mehr mit.
   */
  function aufAnfang() {
    gesehen.current = leeresGesehen();
    anschlaege.current = 0;
    setErfolg(false);
    setHinweis(null);
    const el = feld.current;
    if (!el) return;
    el.value = aufgabe.start;
    el.focus();
    const pos = aufgabe.caret === "anfang" ? 0 : aufgabe.start.length;
    el.setSelectionRange(pos, pos);
  }

  // Neue Aufgabe: Gesehenes zurücksetzen und den Cursor an die richtige Stelle setzen.
  useEffect(() => {
    if (fertig) return;
    aufAnfang();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nr]);

  function pruefen(wert: string) {
    if (demo.aktiv || fertig || erfolg) return;
    if (!pruefeAufgabe(aufgabe, wert, gesehen.current)) return;
    setErfolg(true);
    if (zuVieleAnschlaege(anschlaege.current, aufgabe.noetigeAnschlaege)) {
      fehlerRef.current += 1;
      setFehler(fehlerRef.current);
    }
    const zeile = mitFeststelltasteGeloest(aufgabe, wert, gesehen.current)
      ? "Klappt auch mit Feststelltaste — für ein Zeichen ist Umschalt aber schneller."
      : "Richtig! ⭐";
    setHinweis({ text: zeile, gut: true });
    const dauerMs = Math.round(performance.now() - start.current);
    setTimeout(() => {
      const naechste = nr + 1;
      setNr(naechste);
      if (naechste === AUFGABEN.length) {
        const { punkte, details } = wertung({
          stufe: "tastatur", geloest: naechste, anzahl: AUFGABEN.length, dauerMs, fehler: fehlerRef.current,
        });
        onFertig({ punkte, dauerMs, details: [...details, `${system === "macos" ? "⌘" : "Strg"} + Z gerettet`] });
      }
    }, 900);
  }

  function tasteRunter(e: React.KeyboardEvent<Feld>) {
    if (ABGEFANGEN.test(e.code)) e.preventDefault();
    if (!demo.aktiv && !fertig) anschlaege.current += 1;
    setGedrueckt(s => new Set(s).add(e.code));
    const g = gesehen.current;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") g.shift = true;
    if (e.code === "CapsLock") g.capsLock = true;
    if (e.code === "Backspace") g.backspace = true;
    if (e.code === "Delete") g.delete = true;
    if (e.code === "ArrowLeft") g.arrowLeft = true;
    if (e.code === "Home") g.home = true;
    if (e.code === "End") g.end = true;
    // Am Mac gibt es keine Pos1/Ende: ⌘ + ← / ⌘ + → tun dasselbe (die PC-Tasten gehen ebenfalls).
    if (system === "macos" && e.metaKey && e.code === "ArrowLeft") g.home = true;
    if (system === "macos" && e.metaKey && e.code === "ArrowRight") g.end = true;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") g.ctrlZ = true;
  }

  function tasteHoch(e: React.KeyboardEvent<Feld>) {
    setGedrueckt(s => { const n = new Set(s); n.delete(e.code); return n; });
  }

  function eingabe(e: React.FormEvent<Feld>) {
    const wert = e.currentTarget.value;
    if (aufgabe.id === "strgz" && wert.trim() === "") gesehen.current.leerZwischenzeitlich = true;
    pruefen(wert);
  }

  function ausgeschnitten() {
    gesehen.current.cut = true;
  }

  function eingefuegt() {
    gesehen.current.paste = true;
    // Der Wert nach dem Einfügen steht erst nach diesem Ereignis fest.
    setTimeout(() => { if (feld.current) pruefen(feld.current.value); }, 0);
  }

  function vorfuehren() {
    vorDemo.current = feld.current?.value ?? aufgabe.start;
    demo.abspielen(demoSchritte(aufgabe, {
      el: () => feld.current,
      setWert: w => { if (feld.current) feld.current.value = w; },
      markiere: (von, bis = von) => {
        const el = feld.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(von, bis);
      },
    }, system));
  }

  const schriftgroesse = hilfe ? "text-lg" : "text-base";
  const punkteLaufend = wertung({
    stufe: "tastatur", geloest: nr, anzahl: AUFGABEN.length,
    dauerMs: Math.round(performance.now() - start.current), fehler,
  }).punkte;

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="⌨️ Teil 2 · Tastatur"
        auftrag={fertig
          ? <>Alle Tastatur-Aufgaben geschafft!</>
          : <>{mitTasten(aufgabe.auftrag)}<div data-zusatz className="text-sm text-muted mt-1.5">💡 {mitTasten(aufgabe.tipp)}</div></>}
        punkte={punkteLaufend}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 max-w-3xl">
          {!fertig && (
            <div className={erfolg ? "ring-4 ring-ok rounded-2xl transition-shadow" : ""}>
              {aufgabe.art === "textarea" ? (
                <textarea
                  key={nr}
                  ref={feld as React.RefObject<HTMLTextAreaElement>}
                  defaultValue={aufgabe.start}
                  onKeyDown={tasteRunter}
                  onKeyUp={tasteHoch}
                  onInput={eingabe}
                  className={`w-full min-h-24 rounded-xl border border-line bg-surface p-3 leading-relaxed ${schriftgroesse}`}
                />
              ) : (
                <input
                  key={nr}
                  ref={feld as React.RefObject<HTMLInputElement>}
                  defaultValue={aufgabe.start}
                  onKeyDown={tasteRunter}
                  onKeyUp={tasteHoch}
                  onInput={eingabe}
                  onCut={ausgeschnitten}
                  onPaste={eingefuegt}
                  className={`w-full rounded-xl border border-line bg-surface px-4 py-3 ${schriftgroesse}`}
                />
              )}
            </div>
          )}

          {!fertig && (
            <div className="flex justify-end -mt-2">
              <button
                type="button"
                onClick={aufAnfang}
                disabled={demo.aktiv || erfolg}
                title="Stellt den Starttext dieser Aufgabe wieder her — falls du dich vertippt oder zu viel gelöscht hast."
                className="text-xs text-muted underline decoration-dotted underline-offset-2 hover:text-fg disabled:opacity-40"
              >
                ↺ Text zurücksetzen
              </button>
            </div>
          )}

          <div className="min-h-10 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>

        </div>

        {/* Tastatur und Aufgabenliste nebeneinander: die Tastatur bestimmt mit
            ihren quadratischen Tasten selbst, wie breit sie sein will, die
            Liste steht daneben und nicht mehr weit oben neben dem Eingabefeld. */}
        {!fertig && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem] items-start">
            <div className="rounded-2xl border border-line bg-surface p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold mr-1">Diese Taste(n) brauchst du:</span>
                {aufgabe.tastenHinweis.map((t, i) => <Taste key={i} gross>{t}</Taste>)}
                <span className="text-xs text-muted">— auf der Tastatur unten mit Ring markiert</span>
              </div>
              <Tastatur
                gedrueckt={gedrueckt}
                zeigeFinger={false}
                bloecke
                markiert={new Set(aufgabe.tastenHinweis.map(codeFuer).filter((c): c is string => !!c))}
              />
            </div>

            <aside className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-1 h-fit">
              <h3 className="font-black mb-1">Aufgaben</h3>
              <ul className="flex flex-col gap-1">
                {AUFGABEN.map((a, i) => (
                  <li key={a.id} className={"text-sm flex gap-2 " + (i === nr ? "font-bold" : i < nr ? "text-muted" : "")}>
                    <span>{i < nr ? "✅" : i === nr ? "👉" : "⬜"}</span>
                    <span className="truncate">{a.kurz}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        )}
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
