/**
 * Bearbeiten eines Programms über Listen-Adressen — für den Kachel-Editor.
 *
 * Eine Adresse benennt eine Befehlsliste: "haupt", "fn" oder tiefer
 * "haupt.2.k" (Inhalt des dritten Befehls) bzw. "haupt.2.sonst".
 */
import { mitIds, type Bedingung, type BedingungArt, type Befehl, type BefehlTyp, type Programm, type Richtung } from "./spiel";

export function holeListe(p: Programm, adresse: string): Befehl[] {
  const [wurzel, ...rest] = adresse.split(".");
  let liste: Befehl[] = wurzel === "fn" ? p.fn : p.haupt;
  for (let i = 0; i < rest.length; i += 2) {
    const b = liste[+rest[i]] as Befehl & { k?: Befehl[]; sonst?: Befehl[] };
    liste = (rest[i + 1] === "sonst" ? b?.sonst : b?.k) ?? [];
  }
  return liste;
}

function ersetze(liste: Befehl[], rest: string[], neu: Befehl[]): Befehl[] {
  if (!rest.length) return neu;
  const i = +rest[0], feld = rest[1] as "k" | "sonst";
  return liste.map((b, j) => {
    if (j !== i) return b;
    const alt = (b as Befehl & { k?: Befehl[]; sonst?: Befehl[] })[feld] ?? [];
    return { ...b, [feld]: ersetze(alt, rest.slice(2), neu) } as Befehl;
  });
}

export function setzeListe(p: Programm, adresse: string, neu: Befehl[]): Programm {
  const [wurzel, ...rest] = adresse.split(".");
  if (wurzel === "fn") return { ...p, fn: ersetze(p.fn, rest, neu) };
  return { ...p, haupt: ersetze(p.haupt, rest, neu) };
}

export function einfuegen(p: Programm, adresse: string, index: number, b: Befehl): Programm {
  const l = [...holeListe(p, adresse)];
  l.splice(index, 0, mitIds([b])[0]);
  return setzeListe(p, adresse, l);
}

export function entfernen(p: Programm, adresse: string, index: number): Programm {
  return setzeListe(p, adresse, holeListe(p, adresse).filter((_, i) => i !== index));
}

export function verschiebe(p: Programm, adresse: string, index: number, um: -1 | 1): Programm {
  const l = [...holeListe(p, adresse)];
  const j = index + um;
  if (j < 0 || j >= l.length) return p;
  [l[index], l[j]] = [l[j], l[index]];
  return setzeListe(p, adresse, l);
}

export function aendere(p: Programm, adresse: string, index: number, patch: Partial<Befehl>): Programm {
  return setzeListe(p, adresse, holeListe(p, adresse).map((b, i) => (i === index ? ({ ...b, ...patch } as Befehl) : b)));
}

/** Ein frischer Befehl für die Palette. */
export function neuerBefehl(t: BefehlTyp, bedingungen: BedingungArt[], r: Richtung = 1): Befehl {
  const b: Bedingung = { art: bedingungen[0] ?? "frei" };
  switch (t) {
    case "geh": return { t, r };
    case "wiederhole": return { t, n: 3, k: [] };
    case "bis": return { t, b, k: [] };
    case "wenn": return { t, b, k: [] };
    default: return { t } as Befehl;
  }
}

/** Wörter für Bedingungen: [stimmt, stimmt nicht]. */
export const BEDINGUNG_TEXT: Record<BedingungArt, [string, string]> = {
  frei: ["vorne frei", "vorne nicht frei"],
  frei_links: ["links frei", "links nicht frei"],
  frei_rechts: ["rechts frei", "rechts nicht frei"],
  ding: ["hier liegt etwas", "hier liegt nichts"],
  ziel: ["geschafft", "nicht geschafft"],
  gegner: ["Gegner vorne", "kein Gegner vorne"],
};
export const bedingungText = (b: Bedingung) => BEDINGUNG_TEXT[b.art][b.nicht ? 1 : 0];
