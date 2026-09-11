"use client";
/**
 * Der Übungstext für Markieren (Stufe 5) und Kopieren (Stufe 6) — und die
 * Werkzeuge, um zu lesen, was darin markiert ist, und für die Vorführung
 * selbst etwas zu markieren.
 */
import { forwardRef, useEffect, useRef, type RefObject } from "react";
import { ABSAETZE, TEXT_TITEL, type Aufgabe } from "@/lib/maus/text";
import type { Ort } from "./Demo";

export const Lesetext = forwardRef<HTMLDivElement>(function Lesetext(_props, ref) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      {/* Die Überschrift gehört nicht zur Auswahl: sonst passte »alles markieren« nie. */}
      <h3 className="font-black mb-3 select-none">🌌 {TEXT_TITEL}</h3>
      <div ref={ref} data-lesetext className="flex flex-col gap-3 leading-relaxed text-[15px] cursor-text">
        {ABSAETZE.map((a, i) => <p key={i} data-absatz={i}>{a}</p>)}
      </div>
    </div>
  );
});

/** Der Teil der aktuellen Auswahl, der im Textfeld liegt. */
export function auswahlImFeld(feld: HTMLElement | null): string {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!feld || !sel || sel.rangeCount === 0 || sel.isCollapsed) return "";
  const r = sel.getRangeAt(0).cloneRange();
  if (!r.intersectsNode(feld)) return "";
  if (!feld.contains(r.startContainer)) r.setStart(feld, 0);
  if (!feld.contains(r.endContainer)) r.setEnd(feld, feld.childNodes.length);
  return r.toString();
}

/** Der Bereich, den eine Aufgabe verlangt — für die Vorführung. */
export function bereichFuer(feld: HTMLElement | null, aufgabe: Aufgabe): Range | null {
  if (!feld) return null;
  const r = document.createRange();
  if (aufgabe.art === "alles") { r.selectNodeContents(feld); return r; }
  const p = feld.querySelector(`[data-absatz="${aufgabe.absatz}"]`);
  if (!p) return null;
  if (aufgabe.art === "absatz") { r.selectNodeContents(p); return r; }
  const knoten = p.firstChild;
  const i = knoten?.textContent?.indexOf(aufgabe.ziel) ?? -1;
  if (!knoten || i < 0) return null;
  r.setStart(knoten, i);
  r.setEnd(knoten, i + aufgabe.ziel.length);
  return r;
}

export function markiere(r: Range | null) {
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  if (r) sel.addRange(r);
}

/** Bildschirmort am Anfang, in der Mitte oder am Ende eines Bereichs. */
export function ortIn(r: Range | null, wo: "anfang" | "mitte" | "ende"): Ort | null {
  if (!r || typeof r.getClientRects !== "function") return null;
  const rects = Array.from(r.getClientRects()).filter(x => x.width > 0);
  if (rects.length === 0) return null;
  if (wo === "anfang") return { x: rects[0].left + 3, y: rects[0].top + rects[0].height / 2 };
  if (wo === "ende") {
    const l = rects[rects.length - 1];
    return { x: l.right - 3, y: l.top + l.height / 2 };
  }
  const b = r.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

/**
 * Meldet die Auswahl im Feld. `endgueltig` heißt: die Maustaste ist oben bzw.
 * eine Taste wurde losgelassen — erst dann lohnt ein »noch nicht ganz«.
 * Während des Ziehens wird nur still verglichen.
 */
export function useAuswahl(
  feld: RefObject<HTMLElement | null>,
  onAuswahl: (text: string, endgueltig: boolean) => void,
  aus: boolean,
) {
  const rueckruf = useRef(onAuswahl);
  rueckruf.current = onAuswahl;
  const ausRef = useRef(aus);
  ausRef.current = aus;

  useEffect(() => {
    let gedrueckt = false;
    let uhr: ReturnType<typeof setTimeout> | null = null;
    const pruefe = (endgueltig: boolean) => {
      if (ausRef.current) return;
      rueckruf.current(auswahlImFeld(feld.current), endgueltig);
    };
    const runter = () => { gedrueckt = true; };
    const hoch = () => { gedrueckt = false; setTimeout(() => pruefe(true), 0); };
    const aenderung = () => {
      if (uhr) clearTimeout(uhr);
      uhr = setTimeout(() => pruefe(!gedrueckt), 250);
    };
    document.addEventListener("mousedown", runter);
    document.addEventListener("mouseup", hoch);
    document.addEventListener("keyup", hoch);
    document.addEventListener("selectionchange", aenderung);
    return () => {
      if (uhr) clearTimeout(uhr);
      document.removeEventListener("mousedown", runter);
      document.removeEventListener("mouseup", hoch);
      document.removeEventListener("keyup", hoch);
      document.removeEventListener("selectionchange", aenderung);
    };
  }, [feld]);
}

/**
 * Strg + A markiert sonst die ganze Seite. Hier nur das Textfeld — außer, der
 * Cursor steht gerade in einem Eingabefeld, dort bleibt es beim Gewohnten.
 */
export function useStrgA(feld: RefObject<HTMLElement | null>, onStrgA?: () => void) {
  const rueckruf = useRef(onStrgA);
  rueckruf.current = onStrgA;
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "a") return;
      const aktiv = document.activeElement;
      if (aktiv instanceof HTMLTextAreaElement || aktiv instanceof HTMLInputElement) return;
      if (!feld.current) return;
      e.preventDefault();
      const r = document.createRange();
      r.selectNodeContents(feld.current);
      markiere(r);
      rueckruf.current?.();
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [feld]);
}

export const KURZ = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n).trim()} …` : s);
