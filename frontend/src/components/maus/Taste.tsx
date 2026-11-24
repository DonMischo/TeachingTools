"use client";
/**
 * Eine Taste als Tastenkappe im Text — fährt die Maus darüber (oder steht der
 * Fokus darauf), zeigt eine kleine Tastatur, wo die Taste liegt.
 *
 * In Aufgabentexten werden Tasten als `[[Entf]]` geschrieben; `mitTasten`
 * macht daraus Kappen. So muss kein Kind »Entf« im Fließtext suchen, und wer
 * nicht weiß, wo Pos1 sitzt, sieht es beim Draufzeigen.
 */
import { useState, type ReactNode } from "react";
import { Tastatur } from "@/components/tippen/Tastatur";
import { REIHEN } from "@/lib/tippen/layout";

/** Beschriftung → KeyboardEvent.code. Nicht jede Kappe braucht eine Lage (z. B. »Druck« fehlt nicht, »⊞« schon). */
const CODES: Record<string, string> = {
  "Entf": "Delete", "Pos1": "Home", "Ende": "End", "Einfg": "Insert",
  "←": "ArrowLeft", "→": "ArrowRight", "↑": "ArrowUp", "↓": "ArrowDown",
  "Rücktaste ⟵": "Backspace", "⟵": "Backspace", "Rücktaste": "Backspace",
  "Umschalt ⇧": "ShiftLeft", "Umschalt": "ShiftLeft", "⇧": "ShiftLeft",
  "Strg": "ControlLeft", "Alt": "AltLeft", "Tab": "Tab", "Esc": "Escape",
  "Enter": "Enter", "Leertaste": "Space", "Druck": "PrintScreen",
  "⊞": "MetaLeft", "⊞ Windows": "MetaLeft", "Windows": "MetaLeft",
  // Ubuntu und macOS: Super und ⌘ liegen dort, wo am PC die Windows-Taste sitzt; ⌥ ist Alt, ⌃ ist Strg.
  "Super": "MetaLeft", "⌘": "MetaLeft", "⌥": "AltLeft", "⌃": "ControlLeft", "⇧ Umschalt": "ShiftLeft",
  "⌫": "Backspace",
  "AltGr": "AltRight", "Alt Gr": "AltRight", "Feststelltaste": "CapsLock",
  "ß": "Minus", "+": "BracketRight", "<": "IntlBackslash", "^": "Backquote",
  "F2": "F2", "F3": "F3", "F4": "F4", "F5": "F5",
};

/** Codes, die auf der kleinen Tastatur (ohne Blöcke) Platz haben. */
const HAUPTBLOCK = new Set(
  REIHEN.flat().filter((t): t is Exclude<typeof t, number> => typeof t !== "number").map(t => t.code),
);

export function codeFuer(label: string): string | null {
  if (CODES[label]) return CODES[label];
  if (/^[A-ZÄÖÜ]$/.test(label)) return `Key${label}`;
  if (/^[0-9]$/.test(label)) return `Digit${label}`;
  return null;
}

/** Braucht diese Taste Funktionsreihe, Navigations- oder Ziffernblock? */
export function brauchtBloecke(codes: readonly string[]): boolean {
  return codes.some(c => !HAUPTBLOCK.has(c));
}

export function Taste({ children, gross = false }: { children: string; gross?: boolean }) {
  const [offen, setOffen] = useState(false);
  const code = codeFuer(children);
  return (
    <span
      className="relative inline-block align-baseline"
      onMouseEnter={() => setOffen(true)}
      onMouseLeave={() => setOffen(false)}
    >
      <kbd
        tabIndex={code ? 0 : undefined}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        className={
          "inline-flex items-center justify-center rounded-md border-2 border-accent bg-surface text-fg font-black whitespace-nowrap shadow-[0_3px_0_var(--accent)] mx-0.5 " +
          (gross ? "min-w-10.4 px-3 py-1.5 text-base" : "min-w-7.2 px-1.5 py-0.5 text-sm") +
          (code ? " cursor-help" : "")
        }
      >
        {children}
      </kbd>
      {offen && code && (
        <span
          role="tooltip"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 block rounded-xl border border-line bg-surface shadow-xl p-2 pointer-events-none"
          style={{ width: brauchtBloecke([code]) ? "min(34rem, 90vw)" : "min(24rem, 90vw)" }}
        >
          <span className="block text-xs font-bold text-muted mb-1 text-left">So findest du »{children}«:</span>
          <Tastatur gedrueckt={new Set([code])} zeigeFinger={false} bloecke={brauchtBloecke([code])} />
        </span>
      )}
    </span>
  );
}

/** »Lösche mit [[Entf]]« → Text mit Tastenkappe. */
export function mitTasten(text: string): ReactNode {
  const teile = text.split(/\[\[(.+?)\]\]/);
  if (teile.length === 1) return text;
  return teile.map((t, i) => (i % 2 === 1 ? <Taste key={i}>{t}</Taste> : t));
}
