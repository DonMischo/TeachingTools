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
  TASTATUR_AUFGABEN, leeresGesehen, mitFeststelltasteGeloest, pruefeAufgabe, zuVieleAnschlaege,
  type Aufgabe, type Gesehen,
} from "@/lib/maus/tastatur";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, useDemo, type DemoSchritt } from "./Demo";
import { Tastatur } from "@/components/tippen/Tastatur";
import { useMausKontext } from "./MausKontext";

type Feld = HTMLInputElement | HTMLTextAreaElement;

function demoSchritte(aufgabe: Aufgabe, setWert: (w: string) => void): DemoSchritt[] {
  switch (aufgabe.id) {
    case "umschalt":
      return [
        { text: "Halte Umschalt ⇧ fest …", tasten: ["ShiftLeft"] },
        { text: "… und tippe H.", tasten: ["ShiftLeft", "KeyH"], aktion: () => setWert("H") },
        { text: "Umschalt loslassen, »und« tippen.", aktion: () => setWert("Hund") },
      ];
    case "ruecktaste":
      return [
        { text: "Der Cursor steht hinter dem zweiten e.", aktion: () => setWert("Katzee") },
        { text: "Rücktaste ⟵ drücken: das e verschwindet.", tasten: ["Backspace"], aktion: () => setWert("Katze") },
      ];
    case "entf":
      return [
        { text: "Der Cursor steht vor dem ersten M.", aktion: () => setWert("MMaus") },
        { text: "Entf drücken: das M verschwindet.", aktion: () => setWert("Maus") },
      ];
    case "pfeiltasten":
      return [
        { text: "Der Cursor steht ganz hinten.", aktion: () => setWert("Bll") },
        { text: "Mit ← einmal nach links …", aktion: () => setWert("Bll") },
        { text: "… und das fehlende a eintippen.", aktion: () => setWert("Ball") },
      ];
    case "pos1":
      return [
        { text: "Pos1 drücken: der Cursor springt an den Anfang.", aktion: () => setWert("pfel") },
        { text: "A eintippen.", aktion: () => setWert("Apfel") },
      ];
    case "ende":
      return [
        { text: "Ende drücken: der Cursor springt ans Ende.", aktion: () => setWert("Hallo") },
        { text: "! eintippen.", aktion: () => setWert("Hallo!") },
      ];
    case "strgz":
      return [
        { text: "Den Satz markieren …", aktion: () => setWert(aufgabe.start) },
        { text: "… und mit Entf löschen.", aktion: () => setWert("") },
        { text: "Strg + Z: der Satz ist wieder da!", tasten: ["ControlLeft", "KeyZ"], aktion: () => setWert(aufgabe.start) },
      ];
    case "ausschneiden":
      return [
        { text: "»Zoo« markieren …", aktion: () => setWert("Zoo Ich war im .") },
        { text: "Strg + X: ausschneiden.", tasten: ["ControlLeft", "KeyX"], aktion: () => setWert("Ich war im .") },
        { text: "Vor den Punkt klicken …", aktion: () => setWert("Ich war im .") },
        { text: "Strg + V: einfügen!", tasten: ["ControlLeft", "KeyV"], aktion: () => setWert("Ich war im Zoo.") },
      ];
  }
}

export default function StufeTastatur({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
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

  const fertig = nr >= TASTATUR_AUFGABEN.length;
  const aufgabe = TASTATUR_AUFGABEN[Math.min(nr, TASTATUR_AUFGABEN.length - 1)];

  // Neue Aufgabe: Gesehenes zurücksetzen und den Cursor an die richtige Stelle setzen.
  useEffect(() => {
    if (fertig) return;
    gesehen.current = leeresGesehen();
    anschlaege.current = 0;
    setErfolg(false);
    setHinweis(null);
    const el = feld.current;
    if (!el) return;
    el.focus();
    const pos = aufgabe.caret === "anfang" ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
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
      if (naechste === TASTATUR_AUFGABEN.length) {
        const { punkte, details } = wertung({
          stufe: "tastatur", geloest: naechste, anzahl: TASTATUR_AUFGABEN.length, dauerMs, fehler: fehlerRef.current,
        });
        onFertig({ punkte, dauerMs, details: [...details, "Strg + Z gerettet"] });
      }
    }, 900);
  }

  function tasteRunter(e: React.KeyboardEvent<Feld>) {
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
    const setWert = (w: string) => { if (feld.current) feld.current.value = w; };
    demo.abspielen(demoSchritte(aufgabe, setWert));
  }

  const schriftgroesse = hilfe ? "text-lg" : "text-base";
  const punkteLaufend = wertung({
    stufe: "tastatur", geloest: nr, anzahl: TASTATUR_AUFGABEN.length,
    dauerMs: Math.round(performance.now() - start.current), fehler,
  }).punkte;

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="⌨️ Teil 2 · Tastatur"
        auftrag={fertig
          ? <>Alle Tastatur-Aufgaben geschafft!</>
          : <>{aufgabe.auftrag}<div data-zusatz className="text-xs text-[var(--text-muted)] mt-1">💡 {aufgabe.tipp}</div></>}
        punkte={punkteLaufend}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-4">
          {!fertig && (
            <div className={erfolg ? "ring-4 ring-[var(--green,#16a34a)] rounded-2xl transition-shadow" : ""}>
              {aufgabe.art === "textarea" ? (
                <textarea
                  key={nr}
                  ref={feld as React.RefObject<HTMLTextAreaElement>}
                  defaultValue={aufgabe.start}
                  onKeyDown={tasteRunter}
                  onKeyUp={tasteHoch}
                  onInput={eingabe}
                  className={`w-full min-h-[6rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 leading-relaxed ${schriftgroesse}`}
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
                  className={`w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 ${schriftgroesse}`}
                />
              )}
            </div>
          )}

          <div className="min-h-[2.5rem] text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>

          {!fertig && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5" aria-hidden>
                <span className="text-xs text-[var(--text-muted)] self-center mr-1">Diese Taste(n) brauchst du:</span>
                {aufgabe.tastenHinweis.map((t, i) => (
                  <span key={i} className="text-xs font-bold rounded-md border border-[var(--accent)] px-2 py-1">{t}</span>
                ))}
              </div>
              <Tastatur gedrueckt={gedrueckt} zeigeFinger={false} />
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-1 h-fit">
          <h3 className="font-black mb-1">Aufgaben</h3>
          <ul className="flex flex-col gap-1">
            {TASTATUR_AUFGABEN.map((a, i) => (
              <li key={a.id} className={"text-sm flex gap-2 " + (i === nr ? "font-bold" : i < nr ? "text-[var(--text-muted)]" : "")}>
                <span>{i < nr ? "✅" : i === nr ? "👉" : "⬜"}</span>
                <span className="truncate">{a.kurz}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
