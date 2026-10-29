"use client";
/**
 * Ein echtes Textfeld — Doppelklick, Pos1, Strg + Umschalt + →, Strg + Z
 * verhalten sich genau wie in Word, weil der Browser sie selbst macht. Das
 * Feld beobachtet nur: welche Techniken benutzt wurden, wie viele Aktionen
 * (Klicks und Tastenkürzel), und ob Text und Auswahl die Aufgabe erfüllen.
 *
 * Je Aufgabe ein frisches Feld (`key` beim Aufrufer), damit Strg + Z nicht in
 * die vorige Aufgabe zurückspringt.
 */
import { useEffect, useRef, useState } from "react";
import { pruefe, type Aufgabe } from "@/lib/markieren/aufgaben";
import { TECHNIKEN, technikAusTaste, zaehltAlsAktion, type Technik } from "@/lib/markieren/technik";
import { mitTasten } from "@/components/maus/Taste";

export type Loesung = { ms: number; aktionen: number; techniken: Technik[] };

export function Textfeld({ aufgabe, verlangt = [], onGeloest }: {
  aufgabe: Aufgabe;
  /** Lektion: gilt erst, wenn diese Techniken benutzt wurden. */
  verlangt?: Technik[];
  onGeloest: (l: Loesung) => void;
}) {
  const feld = useRef<HTMLTextAreaElement>(null);
  const benutzt = useRef(new Set<Technik>());
  const aktionen = useRef(0);
  const start = useRef(0);
  const zwischen = useRef(false);
  const maus = useRef<{ x: number; y: number; detail: number; shift: boolean } | null>(null);
  const fertig = useRef(false);
  const [lauf, setLauf] = useState(0);
  const [geloest, setGeloest] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [gesehen, setGesehen] = useState<Technik[]>([]);
  const nurAnsehen = aufgabe.pruefung.art === "auswahl" || aufgabe.pruefung.art === "cursor";
  const zeilen = aufgabe.text.split("\n").length;
  const breite = Math.max(...aufgabe.text.split("\n").map(z => z.length), 30);

  useEffect(() => { start.current = performance.now(); }, []);

  // Neues Feld: Cursor setzen; in reinen Markier-Aufgaben nichts verändern lassen.
  useEffect(() => {
    const el = feld.current;
    if (!el) return;
    zwischen.current = false;
    if (aufgabe.start) {
      el.focus();
      el.setSelectionRange(aufgabe.start.von, aufgabe.start.bis);
    }
    const sperre = (e: InputEvent) => {
      if (e.inputType === "historyUndo") benutzt.current.add("rueckgaengig");
      if (e.inputType === "insertFromPaste") benutzt.current.add("einfuegen");
      if (e.inputType === "deleteByCut") benutzt.current.add("ausschneiden");
      if (!nurAnsehen) return;
      e.preventDefault();
      setHinweis("Hier wird nur markiert — der Text bleibt, wie er ist.");
    };
    el.addEventListener("beforeinput", sperre);
    // Losgelassen wird auch außerhalb des Felds.
    const los = () => { if (maus.current) mausLos(); };
    window.addEventListener("mouseup", los);
    return () => { el.removeEventListener("beforeinput", sperre); window.removeEventListener("mouseup", los); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lauf, aufgabe]);

  function merke(t: Technik | null) {
    if (!t || benutzt.current.has(t)) return;
    benutzt.current.add(t);
    setGesehen([...benutzt.current]);
  }

  function pruefen() {
    const el = feld.current;
    if (!el || fertig.current || maus.current) return;
    const r = pruefe(aufgabe, { text: el.value, von: el.selectionStart, bis: el.selectionEnd }, zwischen.current);
    if (r.zwischen && !zwischen.current) {
      zwischen.current = true;
      setHinweis("Gut! Und jetzt mit Strg + Z zurückholen.");
    }
    if (!r.geloest) return;
    const fehlt = verlangt.filter(t => !benutzt.current.has(t));
    if (fehlt.length) {
      setHinweis(`Richtig — aber übe hier: ${fehlt.map(t => TECHNIKEN[t].name).join(" und ")}. Versuch es noch einmal so.`);
      return;
    }
    fertig.current = true;
    setGeloest(true);
    setHinweis(null);
    const loesung = { ms: Math.round(performance.now() - start.current), aktionen: aktionen.current, techniken: [...benutzt.current] };
    setTimeout(() => onGeloest(loesung), 700);
  }

  function mausLos() {
    const m = maus.current;
    maus.current = null;
    const el = feld.current;
    if (m && el && m.detail === 1 && !m.shift && el.selectionEnd > el.selectionStart) merke("ziehen");
    pruefen();
  }

  function vonVorn() {
    fertig.current = false;
    setGeloest(false);
    setHinweis(null);
    setLauf(n => n + 1);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={"flex rounded-2xl border-2 bg-surface overflow-x-auto transition-colors " + (geloest ? "border-ok" : "border-line")}>
        <div aria-hidden className="select-none text-right text-muted text-sm py-3 pl-3 pr-2 border-r border-line font-mono">
          {Array.from({ length: zeilen }, (_, i) => <div key={i} className="h-8 leading-8">{i + 1}</div>)}
        </div>
        <textarea
          key={lauf}
          ref={feld}
          defaultValue={aufgabe.text}
          rows={zeilen}
          wrap="off"
          spellCheck={false}
          aria-label="Übungstext"
          className="flex-1 resize-none bg-transparent px-3 py-3 text-lg leading-8 outline-none overflow-hidden"
          style={{ minWidth: `${breite + 4}ch` }}
          onMouseDown={e => {
            if (e.button !== 0) { aktionen.current++; return; }
            if (e.detail <= 1) aktionen.current++;
            if (e.detail === 2) merke("doppelklick");
            if (e.detail >= 3) merke("dreifachklick");
            if (e.shiftKey) merke("umschaltklick");
            maus.current = { x: e.clientX, y: e.clientY, detail: e.detail, shift: e.shiftKey };
          }}
          onKeyDown={e => {
            if (zaehltAlsAktion(e)) aktionen.current++;
            merke(technikAusTaste(e));
          }}
          onKeyUp={pruefen}
          onInput={pruefen}
          onSelect={pruefen}
          onCopy={() => merke("kopieren")}
          onCut={() => merke("ausschneiden")}
          onPaste={() => merke("einfuegen")}
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap text-sm min-h-8">
        <button type="button" className="btn-secondary text-sm" onClick={vonVorn} title="Text zurück auf den Anfang">↺ Von vorn</button>
        <span className="text-muted">Benutzt:</span>
        {gesehen.length === 0 && <span className="text-muted">—</span>}
        {gesehen.map(t => <span key={t} className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-bold">{mitTasten(TECHNIKEN[t].tasten)}</span>)}
        <span aria-live="polite" className={"font-bold " + (geloest ? "text-ok" : "text-muted")}>
          {geloest ? "✓ Geschafft!" : hinweis}
        </span>
      </div>
    </div>
  );
}
