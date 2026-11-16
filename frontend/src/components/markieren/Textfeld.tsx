"use client";
/**
 * Ein echtes Textfeld — Doppelklick, Pos1, Strg + Umschalt + →, Strg + Z
 * verhalten sich genau wie in Word, weil der Browser sie selbst macht. Das
 * Feld beobachtet nur: welche Techniken benutzt wurden, wie viele Aktionen
 * (Klicks und Tastenkürzel), und ob Text und Auswahl die Aufgabe erfüllen.
 *
 * Je Aufgabe ein frisches Feld (`key` beim Aufrufer), damit Strg + Z nicht in
 * die vorige Aufgabe zurückspringt.
 *
 * Die Zeilennummern folgen dem Text: Enter gibt eine Nummer dazu, Löschen
 * nimmt eine weg, und die Zeile mit dem Cursor ist hervorgehoben.
 *
 * »Vorführen« spielt den Profi-Weg mit der Vorführ-Bühne des
 * Maus-Führerscheins vor (Zeiger, Maus, Tastatur) und setzt das Feld danach
 * zurück — üben muss man selbst.
 */
import { useEffect, useRef, useState } from "react";
import { pruefe, type Aufgabe } from "@/lib/markieren/aufgaben";
import { TECHNIKEN, technikAusTaste, zaehltAlsAktion, type Technik } from "@/lib/markieren/technik";
import { vorfuehrung } from "@/lib/markieren/vorfuehren";
import { mitTasten } from "@/components/maus/Taste";
import { DemoBuehne, useDemo, type Ort } from "@/components/maus/Demo";

export type Loesung = { ms: number; aktionen: number; techniken: Technik[] };

/** Bildschirmort eines Zeichens im Textfeld (über ein unsichtbares Spiegel-Element). */
function ortVon(el: HTMLTextAreaElement, i: number): Ort {
  const cs = getComputedStyle(el);
  const spiegel = document.createElement("div");
  for (const p of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "paddingTop", "paddingLeft", "tabSize"] as const) {
    spiegel.style[p] = cs[p];
  }
  Object.assign(spiegel.style, { position: "absolute", visibility: "hidden", whiteSpace: "pre", top: "0", left: "0" });
  spiegel.textContent = el.value.slice(0, i);
  const marke = document.createElement("span");
  marke.textContent = el.value.slice(i, i + 1).replace("\n", "") || " ";
  spiegel.appendChild(marke);
  document.body.appendChild(spiegel);
  const r = el.getBoundingClientRect();
  const ort = {
    x: r.left + marke.offsetLeft - el.scrollLeft + 2,
    y: r.top + marke.offsetTop - el.scrollTop + marke.offsetHeight * 0.55,
  };
  spiegel.remove();
  return ort;
}

const zeileVon = (text: string, pos: number) => text.slice(0, pos).split("\n").length - 1;

export function Textfeld({ aufgabe, verlangt = [], onGeloest, pauseMs = 700, fokus = false, vorfuehren = false }: {
  aufgabe: Aufgabe;
  /** Lektion: gilt erst, wenn diese Techniken benutzt wurden. */
  verlangt?: Technik[];
  onGeloest: (l: Loesung) => void;
  /** So lange steht »Geschafft« grün, bevor es weitergeht. */
  pauseMs?: number;
  /** Das Feld bekommt sofort den Fokus (Challenge: Tastenkürzel wirken gleich im Text). */
  fokus?: boolean;
  /** Knopf »Vorführen« zeigen. */
  vorfuehren?: boolean;
}) {
  const feld = useRef<HTMLTextAreaElement>(null);
  const benutzt = useRef(new Set<Technik>());
  const aktionen = useRef(0);
  const start = useRef(0);
  const zwischen = useRef(false);
  const maus = useRef<{ x: number; y: number; detail: number; shift: boolean } | null>(null);
  const fertig = useRef(false);
  const weiter = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigt = useRef(false);
  const [lauf, setLauf] = useState(0);
  const [geloest, setGeloest] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [gesehen, setGesehen] = useState<Technik[]>([]);
  const [zeilen, setZeilen] = useState(() => aufgabe.text.split("\n").length);
  const [aktZeile, setAktZeile] = useState<number | null>(null);
  const nurAnsehen = aufgabe.pruefung.art === "auswahl" || aufgabe.pruefung.art === "cursor";
  const breite = Math.max(...aufgabe.text.split("\n").map(z => z.length), 30);

  const demo = useDemo(() => { zeigt.current = false; vonVorn(); });

  useEffect(() => { start.current = performance.now(); }, []);
  // Ein ausstehendes »weiter« darf nicht nach dem Abbau feuern (sonst zählt die Aufgabe doppelt).
  useEffect(() => () => { if (weiter.current) clearTimeout(weiter.current); }, []);

  // Neues Feld: Cursor setzen; in reinen Markier-Aufgaben nichts verändern lassen.
  useEffect(() => {
    const el = feld.current;
    if (!el) return;
    zwischen.current = false;
    if (aufgabe.start) {
      el.focus();
      el.setSelectionRange(aufgabe.start.von, aufgabe.start.bis);
    } else if (fokus) {
      el.focus();
      el.setSelectionRange(0, 0);
    }
    const sperre = (e: InputEvent) => {
      if (zeigt.current) return;
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

  /** Zeilenzahl und Cursorzeile aus dem Feld nachziehen. */
  function zeilenNachziehen() {
    const el = feld.current;
    if (!el) return;
    setZeilen(el.value.split("\n").length);
    setAktZeile(document.activeElement === el ? zeileVon(el.value, el.selectionEnd) : null);
  }

  function pruefen() {
    zeilenNachziehen();
    const el = feld.current;
    if (!el || fertig.current || maus.current || zeigt.current) return;
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
    weiter.current = setTimeout(() => { weiter.current = null; onGeloest(loesung); }, pauseMs);
  }

  function mausLos() {
    const m = maus.current;
    maus.current = null;
    const el = feld.current;
    if (m && el && m.detail === 1 && !m.shift && el.selectionEnd > el.selectionStart) merke("ziehen");
    pruefen();
  }

  function vonVorn() {
    if (weiter.current) { clearTimeout(weiter.current); weiter.current = null; }
    fertig.current = false;
    setGeloest(false);
    setHinweis(null);
    setZeilen(aufgabe.text.split("\n").length);
    setAktZeile(null);
    setLauf(n => n + 1);
  }

  function vormachen() {
    const el = feld.current;
    if (!el) return;
    if (weiter.current) { clearTimeout(weiter.current); weiter.current = null; }
    fertig.current = false;
    setGeloest(false);
    setHinweis(null);
    zeigt.current = true;
    // Vom Ausgangstext aus vorführen.
    el.value = aufgabe.text;
    if (aufgabe.start) el.setSelectionRange(aufgabe.start.von, aufgabe.start.bis);
    zeilenNachziehen();
    demo.abspielen(vorfuehrung(aufgabe).map(s => ({
      text: s.text,
      ms: s.ms,
      taste: s.taste ?? undefined,
      tasten: s.tasten,
      zu: s.zeiger !== undefined ? () => (feld.current ? ortVon(feld.current, s.zeiger!) : null) : undefined,
      aktion: () => {
        const f = feld.current;
        if (!f) return;
        if (s.wert !== undefined) f.value = s.wert;
        f.focus();
        if (s.auswahl) {
          const rueckwaerts = s.auswahl.bis < s.auswahl.von;
          f.setSelectionRange(Math.min(s.auswahl.von, s.auswahl.bis), Math.max(s.auswahl.von, s.auswahl.bis), rueckwaerts ? "backward" : "forward");
        }
        zeilenNachziehen();
      },
    })));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={"flex rounded-2xl border-2 bg-surface overflow-x-auto transition-colors " + (geloest ? "border-ok" : "border-line")}>
        <div aria-hidden data-testid="zeilennummern" className="select-none text-right text-muted text-sm py-3 pl-3 pr-2 border-r border-line font-mono">
          {Array.from({ length: zeilen }, (_, i) => (
            <div key={i} className={"h-8 leading-8 " + (i === aktZeile ? "text-accent font-bold" : "")}>{i + 1}</div>
          ))}
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
          onFocus={zeilenNachziehen}
          onBlur={() => setAktZeile(null)}
          onCopy={() => merke("kopieren")}
          onCut={() => merke("ausschneiden")}
          onPaste={() => merke("einfuegen")}
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap text-sm min-h-8">
        <button type="button" className="btn-secondary text-sm" onClick={vonVorn} title="Text zurück auf den Anfang">↺ Von vorn</button>
        {vorfuehren && (
          <button type="button" className="btn-secondary text-sm" onClick={vormachen} disabled={demo.aktiv}
            title="Zeigt den schnellen Weg mit Maus und Tastatur — danach bist du dran">▶ Vorführen</button>
        )}
        <span className="text-muted">Benutzt:</span>
        {gesehen.length === 0 && <span className="text-muted">—</span>}
        {gesehen.map(t => <span key={t} className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-bold">{mitTasten(TECHNIKEN[t].tasten)}</span>)}
        <span aria-live="polite" className={"font-bold " + (geloest ? "text-ok" : "text-muted")}>
          {geloest ? "✓ Geschafft!" : hinweis}
        </span>
      </div>
      <DemoBuehne demo={demo} />
    </div>
  );
}
