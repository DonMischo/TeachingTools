/**
 * LTB — Linus Torwa Biblebrox, ein Pinguin, der die Kinder durch die Stadt
 * begleitet und Sicherheitstipps gibt. Hier nur, WAS er WANN sagt: jeder
 * Anlass hat ein paar Sätze, wird höchstens ein paar Mal gesagt und nicht
 * öfter als alle `PAUSE` Sekunden. Meldungen mit Punkten zeigt die Hülle
 * ohnehin — LTB erklärt dazu das Warum, freundlich und kurz.
 */
import type { RegelId } from "./regeln";

export type LtbAnlass =
  | { typ: "start" }
  | { typ: "meldung"; id: RegelId }
  | { typ: "untergrund"; art: string }
  | { typ: "naehe"; was: "zebra" | "ampel" | "muell" }
  | { typ: "haltestelle" }
  | { typ: "dunkel" }
  | { typ: "rush" }
  | { typ: "leerlauf" };

/** Die Begrüßung, Satz für Satz (weiter mit Klick oder nach ein paar Sekunden). */
export const BEGRUESSUNG = [
  "Hallo! Ich bin LTB — Linus Torwa Biblebrox. Ich bin ein Pinguin und kenne mich mit Verkehr aus. 🐧",
  "Wir stehen vor deiner Schule in der Eugen-Richter-Straße. Lauf mit den Pfeiltasten oder WASD.",
  "Bevor du auf die Straße gehst: stehen bleiben und schauen — links, rechts, links. Das ist die Leertaste.",
  "Rechts siehst du deine Aufträge. Ich watschle mit und sag dir, worauf du achten musst. Los geht's!",
];

const SAETZE: Record<string, string[]> = {
  // Untergrund
  "untergrund:fahrbahn": [
    "Auf der Fahrbahn fahren Autos. Schnell und gerade rüber — nicht bummeln!",
    "Pinguine watscheln langsam. Du bitte nicht: auf der Straße zügig gehen, aber nicht rennen.",
  ],
  "untergrund:radweg": ["Achtung, roter Belag: Das ist ein Radweg. Fahrräder sind leise — geh lieber auf den Gehweg."],
  "untergrund:gleis": ["Gleise! Eine Bahn kann nicht ausweichen und braucht einen sehr langen Bremsweg. Nur am Übergang drüber."],
  "untergrund:bahnsteig": ["Auf dem Bahnsteig: hinter der weißen Linie warten. Wenn die Bahn einfährt, zieht der Fahrtwind."],
  // Nähe
  "naehe:zebra": [
    "Da vorn ist ein Zebrastreifen. Autos müssen dich lassen — aber schau trotzdem, ob sie wirklich halten.",
    "Am Zebrastreifen hilft Blickkontakt: Hat der Fahrer dich gesehen? Dann los.",
  ],
  "naehe:ampel": [
    "Eine Ampel! Nur bei Grün gehen. Und wenn es beim Gehen rot wird: zügig weiter, nicht umdrehen.",
    "Manche Ampeln haben einen Taster. Drück E und warte auf das grüne Männchen.",
    "Hörst du das Ticken? Das ist für Menschen, die nicht sehen können: schnell heißt Grün.",
  ],
  "naehe:muell": [
    "Da liegt Müll! Heb ihn mit E auf und bring ihn zum nächsten grünen Mülleimer.",
    "Noch mehr Müll! Aber Achtung: Was auf der Fahrbahn liegt, bleibt liegen. Da bückt man sich nicht.",
  ],
  "meldung:muellWeg": ["Danke! Eine saubere Stadt ist auch sicherer — niemand rutscht auf Bananenschalen aus. 🍌"],
  "meldung:muellFahrbahn": ["Halt! Auf der Fahrbahn bückt man sich nicht. Beim Bücken siehst du kein Auto — und das Auto dich nicht."],
  "meldung:karmaGeheilt": ["Siehst du? Wer freundlich ist und hilft, mit dem sind auch die anderen wieder freundlich."],
  haltestelle: [
    "An der Haltestelle zeigt die Tafel, wann der Bus kommt. Mit Abstand zur Bordsteinkante warten!",
    "Wenn der Bus hält: erst aussteigen lassen, seitlich neben der Tür warten, dann einsteigen.",
  ],
  dunkel: ["Es wird dunkel! Autofahrer sehen dich jetzt erst spät. Zieh die Warnweste an — Taste V."],
  rush: ["Berufsverkehr! Jetzt sind viele Autos unterwegs. Nimm lieber die Ampel oder den Zebrastreifen."],
  // Meldungen: das Warum
  "meldung:rot": ["Oh oh, das war Rot. Auch wenn kein Auto kommt: Andere Kinder schauen dir zu und machen es nach."],
  "meldung:nichtGeschaut": ["Erst schauen, dann gehen! Links — rechts — links. Leertaste drücken und stehen bleiben."],
  "meldung:umweg": ["Der Überweg ist nur ein paar Schritte weiter. Die paar Schritte lohnen sich immer."],
  "meldung:angefahren": ["Aua! Zum Glück nur im Spiel. Autos brauchen einen Bremsweg — sie können nicht sofort stehen."],
  "meldung:tuerBlockiert": ["Nicht vor die Tür stellen! Wer aussteigt, braucht Platz. Stell dich seitlich daneben."],
  "meldung:verdeckt": ["Hinter dem Bus sieht dich kein Autofahrer. Warte, bis der Bus weggefahren ist."],
  "meldung:weisseLinie": ["Zurück hinter die weiße Linie! Die Bahn fährt ganz dicht an der Kante vorbei."],
  "meldung:beleidigung": ["Schimpfen macht keinen sicherer. Freundlich sein hilft: ein Lächeln oder ein Danke-Winken."],
  "meldung:gutEingestiegen": ["Super eingestiegen! Genau so machen es die Profis."],
  "meldung:zebraGequert": ["Prima über den Zebrastreifen! Tipp: Nach dem Queren kannst du dem Autofahrer danke winken (3)."],
  "meldung:gruenGequert": ["Bei Grün gegangen — so ist es richtig!"],
  "meldung:gruppeSchlange": ["Als Gruppe: nebeneinander wie eine Wand, alle zugleich. Dann seid ihr viel schneller drüben."],
  "meldung:gruppeWand": ["Eine Wand! Alle zugleich — genau richtig. Ich bin stolz auf euch. 🐧"],
  leerlauf: [
    "Wusstest du? Pinguine gehen im Watschelschritt, weil das Energie spart. Auf der Straße lieber zügig gehen.",
    "Helle Kleidung und Reflektoren am Ranzen helfen, dass dich Autos im Dunkeln früh sehen.",
    "Zwischen parkenden Autos sieht dich kein Fahrer. Geh lieber dort über die Straße, wo man dich gut sieht.",
    "Handy weg beim Gehen über die Straße — Augen und Ohren gehören dem Verkehr.",
    "Ein Ball rollt auf die Straße? Stehen bleiben! Erst schauen, dann holen.",
    "Radfahrer auf dem Gehweg? Kinder bis 8 Jahre müssen dort fahren — geh ruhig ein Stück zur Seite.",
  ],
};

/** Mindestabstand zwischen zwei Tipps in Sekunden. */
export const PAUSE = 9;
/** So oft sagt LTB höchstens dasselbe zum selben Anlass. */
const HOECHSTENS = 2;

export function schluesselVon(a: LtbAnlass): string {
  switch (a.typ) {
    case "meldung": return `meldung:${a.id}`;
    case "untergrund": return `untergrund:${a.art}`;
    case "naehe": return `naehe:${a.was}`;
    default: return a.typ;
  }
}

export class Ltb {
  private zuletzt = -Infinity;
  private gesagt = new Map<string, number>();

  /** Was sagt LTB jetzt? `null`, wenn nichts (zu früh, schon oft gesagt, kein Satz). */
  sag(a: LtbAnlass, t: number): string | null {
    const key = schluesselVon(a);
    const saetze = SAETZE[key];
    if (!saetze) return null;
    // Warnungen nach Verstößen dürfen die Pause durchbrechen, Plaudereien nicht.
    const dringend = a.typ === "meldung" || a.typ === "dunkel";
    if (!dringend && t - this.zuletzt < PAUSE) return null;
    const n = this.gesagt.get(key) ?? 0;
    if (n >= (a.typ === "leerlauf" ? saetze.length : HOECHSTENS)) return null;
    this.gesagt.set(key, n + 1);
    this.zuletzt = t;
    return saetze[n % saetze.length];
  }
}
