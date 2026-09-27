/**
 * Abschlusszeugnis: Bestehensregel nach § 51 Abs. 1 und 2 ThürSchulO und
 * ein Zufallszeugnis (gut / mittel / schlecht — immer bestanden).
 *
 * Bestanden, wenn alle Noten mindestens 4 sind, oder (übrige Noten ≥ 4)
 *  - höchstens eine 5 (ohne Ausgleich),
 *  - höchstens zwei 5 mit Ausgleich für beide,
 *  - höchstens eine 6 mit Ausgleich.
 * Ausgleich: 5 durch 2× befriedigend oder 1× gut/sehr gut; 6 durch 2× gut
 * oder 1× sehr gut. Deutsch, Mathematik, Englisch gleichen nur untereinander aus.
 */
import { FAECHER, type Fach } from "./berufe";

export type ZeugnisStufe = "gut" | "mittel" | "schlecht";
export type Noten = Partial<Record<Fach, number>>;

const KERN: Fach[] = ["Deutsch", "Mathematik", "Englisch"];
const ZEUGNISFAECHER: Fach[] = FAECHER.filter((f) => f !== "Informatik");

/** Reichen die Noten im Pool, um die schlechten Noten auszugleichen? */
function ausgleichbar(schlecht: number[], pool: number[]): boolean {
  const p = [...pool].sort((a, b) => a - b);
  for (const n of [...schlecht].sort((a, b) => b - a)) {
    const einzeln = p.findIndex((x) => x <= (n === 6 ? 1 : 2));
    if (einzeln >= 0) { p.splice(einzeln, 1); continue; }
    const grenze = n === 6 ? 2 : 3;
    const paar = p.filter((x) => x <= grenze).slice(-2);
    if (paar.length < 2) return false;
    for (const x of paar) p.splice(p.indexOf(x), 1);
  }
  return true;
}

export function bestanden(noten: Noten): { ok: boolean; grund: string } {
  const liste = Object.entries(noten).filter((e): e is [Fach, number] => !!e[1]);
  const fuenf = liste.filter(([, n]) => n === 5), sechs = liste.filter(([, n]) => n === 6);
  if (sechs.length + fuenf.length === 0) return { ok: true, grund: "Alle Noten mindestens ausreichend." };
  if (sechs.length > 1 || (sechs.length && fuenf.length) || fuenf.length > 2)
    return { ok: false, grund: "Zu viele Fünfen/Sechsen — erlaubt sind höchstens zwei Fünfen oder eine Sechs." };
  if (fuenf.length === 1 && !sechs.length) return { ok: true, grund: "Eine Fünf ist ohne Ausgleich erlaubt." };
  const schlecht = [...fuenf, ...sechs];
  for (const kern of [true, false]) {
    const s = schlecht.filter(([f]) => KERN.includes(f) === kern).map(([, n]) => n);
    const pool = liste.filter(([f, n]) => n <= 4 && KERN.includes(f) === kern).map(([, n]) => n);
    if (s.length && !ausgleichbar(s, pool))
      return { ok: false, grund: kern ? "Die Fünf/Sechs in Deutsch, Mathe oder Englisch lässt sich nur mit diesen drei Fächern ausgleichen — das reicht nicht." : "Nicht genug gute Noten zum Ausgleich (für eine 5: zwei Dreien oder eine Zwei; für eine 6: zwei Zweien oder eine Eins)." };
  }
  return { ok: true, grund: "Bestanden mit Ausgleich." };
}

const MITTEL: Record<ZeugnisStufe, number> = { gut: 1.8, mittel: 2.8, schlecht: 3.9 };

/** Zufallszeugnis der gewünschten Stufe, das nach § 51 ThürSchulO bestanden ist. */
export function zeugnisErzeugen(stufe: ZeugnisStufe, zufall: () => number = Math.random): Noten {
  for (;;) {
    const noten: Noten = {};
    for (const f of ZEUGNISFAECHER) {
      const basis = MITTEL[stufe] + (zufall() + zufall() - 1) * 1.4 - (f === "Sport" || f === "Kunst" || f === "Musik" ? 0.4 : 0);
      noten[f] = Math.min(stufe === "schlecht" ? 6 : 4, Math.max(1, Math.round(basis)));
    }
    const werte = Object.values(noten) as number[];
    // »schlecht« heißt: knapp bestanden, also mindestens eine Fünf
    if (stufe === "schlecht" && !werte.some((n) => n >= 5)) continue;
    if (bestanden(noten).ok) return noten;
  }
}
