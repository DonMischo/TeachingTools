/**
 * Kleidung, Friseur und Handy — was regelmäßig Geld kostet, auch wenn man es
 * nicht jeden Monat merkt.
 *
 * Richtwerte: Alleinlebende geben laut Einkommens- und Verbrauchsstichprobe
 * (Destatis) grob 40–70 € im Monat für Kleidung und Schuhe aus. Friseur in
 * Erfurt 2026: Kurzhaarschnitt ca. 20–40 €, Waschen/Schneiden/Föhnen ca.
 * 35–70 €. Das Spiel lässt Kleidung verschleißen; wer billig kauft, kauft öfter.
 */
import { alter, begrenzen, brief, buchen, kannZahlen, klon, log, r2, uid, zufall } from "./kern";
import type { Ergebnis } from "./motor";
import type { KleidungsTeil, Spielstand } from "./typen";
import { werte } from "./werte";
import { jahrVon, monatVon } from "./zeit";

export const TEILE: Record<KleidungsTeil, { name: string; icon: string; inhalt: string; preis: number; tageBisLeer: number; nurWinter?: boolean }> = {
  alltag: { name: "Alltagskleidung", icon: "👕", inhalt: "3 Shirts, 1 Hose, 1 Pulli", preis: 95, tageBisLeer: 250 },
  unterwaesche: { name: "Unterwäsche & Socken", icon: "🧦", inhalt: "5 Unterhosen, 7 Paar Socken", preis: 35, tageBisLeer: 180 },
  schuhe: { name: "Schuhe", icon: "👟", inhalt: "1 Paar Alltagsschuhe", preis: 70, tageBisLeer: 285 },
  jacke: { name: "Winterjacke", icon: "🧥", inhalt: "warme, wasserfeste Jacke", preis: 110, tageBisLeer: 200, nurWinter: true },
  schick: { name: "Bewerbungsoutfit", icon: "👔", inhalt: "Hemd/Bluse, Stoffhose, ordentliche Schuhe", preis: 110, tageBisLeer: 2500 },
  sport: { name: "Sportsachen", icon: "🩳", inhalt: "Sportschuhe, Shirt, Hose", preis: 45, tageBisLeer: 120 },
};

export type ModeLaden = { id: string; name: string; icon: string; faktor: number; guete: number; spass: number; text: string; ohne?: KleidungsTeil[] };

export const MODELAEDEN: ModeLaden[] = [
  { id: "billig", name: "Billig-Modekette", icon: "🏷️", faktor: 0.55, guete: 0.65, spass: 6, text: "Sehr günstig, hält aber deutlich kürzer." },
  { id: "kette", name: "Modekette im Einkaufszentrum", icon: "🛍️", faktor: 1, guete: 1, spass: 8, text: "Mittlere Preise, mittlere Qualität." },
  { id: "marke", name: "Markenstore / Sneaker-Laden", icon: "✨", faktor: 2.2, guete: 1.35, spass: 18, text: "Teuer — hält länger, macht mehr her." },
  { id: "second", name: "Second-Hand-Laden", icon: "♻️", faktor: 0.4, guete: 0.85, spass: 8, text: "Günstig und nachhaltig. Unterwäsche gibt's hier nicht.", ohne: ["unterwaesche"] },
];

export const FRISUREN = [
  { id: "kurz", name: "Kurzhaarschnitt / Maschine", preis: 22, wert: 100, text: "schnell, günstig" },
  { id: "wsf", name: "Waschen, Schneiden, Föhnen", preis: 48, wert: 100, text: "für längere Haare" },
  { id: "farbe", name: "Schneiden + Färben", preis: 105, wert: 100, text: "Farbe hält etwa zwei Monate", spass: 15 },
  { id: "selbst", name: "Selbst schneiden (Haarschneider 30 € einmalig)", preis: 0, wert: 65, text: "spart Geld, sieht man aber" },
] as const;

export const HANDYS = [
  { id: "einsteiger", name: "Einsteiger-Smartphone", preis: 179, spass: 8, text: "reicht für alles Wichtige" },
  { id: "mittel", name: "Mittelklasse-Smartphone", preis: 379, spass: 14, text: "gute Kamera, hält länger durch" },
  { id: "refurb", name: "Mittelklasse, generalüberholt (refurbished)", preis: 219, spass: 12, text: "mit 12 Monaten Gewährleistung" },
  { id: "top", name: "Top-Smartphone", preis: 1099, spass: 25, text: "Statussymbol — telefonieren kann es auch nicht besser" },
] as const;

export function startKleidung(): Spielstand["kleidung"] {
  return {
    alltag: { zustand: 70, guete: 1 }, unterwaesche: { zustand: 65, guete: 1 }, schuhe: { zustand: 60, guete: 1 },
    jacke: { zustand: 55, guete: 1 }, schick: { zustand: 0, guete: 1 }, sport: { zustand: 50, guete: 1 },
  };
}

export function winter(tag: number): boolean {
  return [11, 12, 1, 2, 3].includes(monatVon(tag));
}

/** Täglicher Verschleiß von Kleidung, Frisur und Handy — und was daraus folgt. */
export function verschleiss(s: Spielstand, koerperlich: number): void {
  const k = s.kleidung;
  for (const teil of Object.keys(TEILE) as KleidungsTeil[]) {
    const def = TEILE[teil];
    if (teil === "sport" || teil === "schick") continue; // verschleißen bei Benutzung
    if (def.nurWinter && !winter(s.tag)) continue;
    let rate = 100 / def.tageBisLeer / Math.max(0.3, k[teil].guete);
    if ((teil === "alltag" || teil === "schuhe") && koerperlich >= 2) rate *= 1.4;
    k[teil].zustand = begrenzen(k[teil].zustand - rate);
  }
  s.frisur = begrenzen(s.frisur - 100 / 60);
  s.handy.zustand = begrenzen(s.handy.zustand - 100 / (4 * 365));
  const b = s.beduerfnisse;
  if (k.alltag.zustand < 25) b.sozial = begrenzen(b.sozial - 1.5);
  if (k.unterwaesche.zustand < 20) b.hygiene = begrenzen(b.hygiene - 8);
  if (k.schuhe.zustand < 20) b.gesundheit = begrenzen(b.gesundheit - 0.3);
  if (winter(s.tag) && k.jacke.zustand < 20) b.gesundheit = begrenzen(b.gesundheit - 0.4);
  if (s.frisur < 20) b.sozial = begrenzen(b.sozial - 0.7);
  if (s.handy.zustand < 10) { b.sozial = begrenzen(b.sozial - 1.5); b.spass = begrenzen(b.spass - 1); }
  // Einmal melden, wenn etwas durch ist
  for (const teil of ["alltag", "unterwaesche", "schuhe", "jacke"] as KleidungsTeil[]) {
    const merk = `kaputt_${teil}`;
    if (k[teil].zustand < 15 && !s.flags[merk] && (!TEILE[teil].nurWinter || winter(s.tag))) {
      s.flags[merk] = true;
      brief(s, "Dein Kleiderschrank", `${TEILE[teil].icon} ${TEILE[teil].name}: kaum noch tragbar`,
        ({ alltag: "Löcher, ausgewaschene Farben, die Hose hält nur noch mit Gürtel. Auf der Arbeit fällt das auf.",
          unterwaesche: "Die Socken haben mehr Loch als Socke. Unterwäsche ist Hygiene — Zeit für Nachschub.",
          schuhe: "Die Sohle löst sich, bei Regen gibt es nasse Füße.",
          jacke: "Die Winterjacke ist durch. Ohne warme Jacke wirst du im Winter schneller krank." } as Record<string, string>)[teil]);
    }
    if (k[teil].zustand > 50) delete s.flags[merk];
  }
}

/** Wie gepflegt wirkt man (0..1) — für Vorstellungsgespräche. */
export function auftreten(s: Spielstand): number {
  const schick = s.kleidung.schick.zustand;
  return Math.max(0, Math.min(1, (schick > 30 ? 0.45 : s.kleidung.alltag.zustand > 60 ? 0.25 : 0.1) + (s.frisur > 40 ? 0.3 : 0.1) + (s.beduerfnisse.hygiene > 50 ? 0.25 : 0)));
}

export function kleidungKaufen(alt: Spielstand, ladenId: string, teile: KleidungsTeil[]): Ergebnis {
  const s = klon(alt);
  const l = MODELAEDEN.find((x) => x.id === ladenId);
  if (!l) return { stand: alt, fehler: "Unbekannter Laden." };
  const pi = werte(jahrVon(s.tag)).preisindex;
  const liste = teile.filter((t) => !l.ohne?.includes(t));
  if (!liste.length) return { stand: alt, fehler: "Nichts ausgewählt." };
  const summe = r2(liste.reduce((a, t) => a + TEILE[t].preis * l.faktor * pi, 0));
  if (!kannZahlen(s, summe)) return { stand: alt, fehler: "Karte abgelehnt — nicht genug Geld." };
  buchen(s, -summe, "kleidung", `${l.name}: ${liste.map((t) => TEILE[t].name).join(", ")}`);
  for (const t of liste) s.kleidung[t] = { zustand: 100, guete: l.guete };
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + l.spass);
  s.flags.kleidungGesamt = r2(Number(s.flags.kleidungGesamt ?? 0) + summe);
  log(s, "kauf", `Kleidung (${l.name}): ${liste.map((t) => TEILE[t].name).join(", ")}`, -summe);
  return { stand: s, meldung: `Gekauft für ${summe.toFixed(2).replace(".", ",")} €.` };
}

export function friseur(alt: Spielstand, art: typeof FRISUREN[number]["id"]): Ergebnis {
  const s = klon(alt);
  const f = FRISUREN.find((x) => x.id === art)!;
  let preis = r2(f.preis * werte(jahrVon(s.tag)).preisindex);
  let text = "";
  if (art === "selbst") {
    if (!s.flags.haarschneider) {
      if (!kannZahlen(s, 30)) return { stand: alt, fehler: "Nicht genug Geld für den Haarschneider." };
      buchen(s, -30, "drogerie", "Haarschneidemaschine");
      s.flags.haarschneider = true;
    }
    s.frisur = Math.max(s.frisur, f.wert);
    return { stand: s, meldung: "Selbst geschnitten. Na ja — hinten sieht man's nicht so." };
  }
  if (s.job?.beruf === "friseur" && s.tag >= s.job.start) { preis = 0; text = " Im eigenen Salon schneiden dir die Kolleg:innen die Haare umsonst."; }
  if (!kannZahlen(s, preis)) return { stand: alt, fehler: "Nicht genug Geld." };
  if (preis > 0) buchen(s, -preis, "drogerie", `Friseur: ${f.name}`);
  s.frisur = 100;
  if ("spass" in f) s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + (f as { spass: number }).spass);
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + 6);
  log(s, "kauf", `Friseur: ${f.name}`, -preis);
  return { stand: s, meldung: `Frisch vom Friseur (${preis.toFixed(2).replace(".", ",")} €).${text}` };
}

export function handyKaufen(alt: Spielstand, id: typeof HANDYS[number]["id"], raten: boolean): Ergebnis {
  const s = klon(alt);
  const h = HANDYS.find((x) => x.id === id)!;
  if (raten) {
    if (alter(s) < 18) return { stand: alt, fehler: "Ratenkauf erst ab 18." };
    s.kredite.push({ uid: uid(s), art: "ratenkauf", text: h.name, rest: h.preis, rate: r2(h.preis / 24), zins: 0, faellig: s.tag + 30, mahnstufe: 0 });
    s.flags.schufaKredit = true;
  } else {
    if (!kannZahlen(s, h.preis)) return { stand: alt, fehler: "Nicht genug Geld." };
    buchen(s, -h.preis, "sonstiges", `Smartphone: ${h.name}`);
  }
  s.handy = { modell: h.name, zustand: 100, gekauft: s.tag };
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + h.spass);
  log(s, "kauf", `Neues Handy: ${h.name}${raten ? " (0 % über 24 Raten)" : ""}`, raten ? 0 : -h.preis);
  return { stand: s, meldung: raten ? `${h.name} auf 24 Raten. Der Ratenkredit steht in der SCHUFA.` : `${h.name} gekauft.` };
}

/** Zufall: bei altem Handy häufen sich Akku- und Displayprobleme. */
export function handyAltersschwaeche(s: Spielstand): void {
  if (s.handy.zustand < 25 && !s.flags.handyAkku && zufall(s) < 0.02) {
    s.flags.handyAkku = true;
    brief(s, "Dein Handy", "🔋 Akku hält kaum noch einen halben Tag",
      "Dein Handy ist in die Jahre gekommen. Akkutausch in der Werkstatt ca. 80 € — oder ein neues (Raus → Möbel & Elektro → Handy).");
  }
}
