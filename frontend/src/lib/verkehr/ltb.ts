/**
 * LTB — Linus Torwa Biblebrox, ein Pinguin, der die Kinder durch die Stadt
 * begleitet und Sicherheitstipps gibt. Hier nur, WAS er WANN sagt: jeder
 * Anlass hat ein paar Sätze, wird höchstens ein paar Mal gesagt und nicht
 * öfter als alle `PAUSE` Sekunden. Meldungen mit Punkten zeigt die Hülle
 * ohnehin — LTB erklärt dazu das Warum, freundlich und kurz.
 */
import type { RegelId } from "./regeln";
import { SCHILDER, type SchildArt } from "./schilder";

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
  "untergrund:spielstrasse": [
    "Das ist eine Spielstraße: Hier dürfen Kinder laufen und spielen, Autos nur im Schritttempo. Trotzdem: Autos können kommen — Augen auf!",
    "Morgens zwischen halb acht und Viertel nach acht bringen viele Eltern ihre Kinder mit dem Auto. Dann ist hier mehr los.",
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

/**
 * Wo man steht, wenn man LTB fragt (Taste L oder auf ihn klicken). Die Bühne
 * sucht das Wichtigste in der Nähe aus — Bus vor Schild vor Ampel vor Boden.
 */
export type LtbOrt =
  | { wo: "bus"; haltGewuenscht: boolean }
  | { wo: "bahn" }
  | { wo: "tuer" }
  | { wo: "haltestelle"; name: string; naechste?: { linie: string; ziel: string; inMinuten: number } }
  | { wo: "schild"; art: SchildArt }
  | { wo: "ampel" }
  | { wo: "zebra" }
  | { wo: "untergrund"; art: string }
  | { wo: "eimer"; getragen: number }
  | { wo: "muell" }
  | { wo: "schule" }
  | { wo: "sonst"; dunkel: boolean; weste: boolean };

const ORT_SAETZE: Record<string, string[]> = {
  bus: [
    "Im Bus: festhalten oder hinsetzen! Wenn der Bus bremst, fliegt sonst alles — auch Pinguine.",
    "Den Ranzen nimmst du im Bus ab und stellst ihn zwischen die Füße. Dann ist der Gang frei.",
    "Nach dem Aussteigen nicht vor oder hinter dem Bus über die Straße — warte, bis er weg ist.",
  ],
  bahn: ["In der Bahn: festhalten und nicht an den Türen lehnen. Aussteigen erst, wenn sie ganz steht."],
  tuer: [
    "Die Tür ist offen: Erst steigen die Leute aus. Stell dich seitlich daneben, dann E drücken und einsteigen.",
    "Nie in die Tür springen, wenn es piept — der nächste Bus kommt bestimmt.",
  ],
  haltestelle: [
    "Warte mit Abstand zur Bordsteinkante. Der Bus schwenkt beim Einfahren aus — sein Heck kommt bis auf den Gehweg.",
    "Nicht an der Haltestelle rennen oder schubsen. Wer drängelt, fällt schnell auf die Fahrbahn.",
    "Die Tafel zeigt, wann der nächste Bus kommt. Lieber einen Bus später als über die Straße hetzen.",
  ],
  ampel: [
    "Nur bei Grün gehen! Und auch bei Grün kurz schauen: Abbieger müssen dich lassen, sehen dich aber manchmal nicht.",
    "Hat die Ampel einen Taster? Mit E drücken und warten, bis das grüne Männchen kommt.",
    "Wird es Rot, während du auf der Straße bist? Zügig weitergehen, nicht umdrehen.",
  ],
  zebra: [
    "Am Zebrastreifen: am Rand stehen bleiben und zeigen, dass du rüber willst — Hand raus mit 2.",
    "Erst gehen, wenn die Autos wirklich stehen. Blickkontakt mit dem Fahrer hilft.",
    "Hinterher danke winken (3) — dann halten die Autofahrer beim nächsten Mal noch lieber.",
  ],
  "untergrund:fahrbahn": [
    "Du stehst auf der Fahrbahn! Schnell, aber ohne zu rennen, auf den Gehweg.",
    "Auf der Straße niemals stehen bleiben und niemals etwas aufheben.",
  ],
  "untergrund:spielstrasse": [
    "Spielstraße: Hier dürfen Kinder spielen, Autos fahren nur Schritttempo. Trotzdem Platz machen, wenn eins kommt.",
    "Morgens von halb acht bis Viertel nach acht fahren hier viele Elterntaxis. Dann besonders aufpassen!",
  ],
  "untergrund:radweg": ["Das ist ein Radweg — Fahrräder sind schnell und leise. Geh lieber auf den Gehweg daneben."],
  "untergrund:gleis": ["Runter von den Gleisen! Eine Bahn kann nicht ausweichen. Nur am Übergang drüber."],
  "untergrund:bahnsteig": ["Am Bahnsteig hinter der weißen Linie bleiben. Fährt die Bahn ein, zieht der Wind ganz schön."],
  "untergrund:gehweg": [
    "Auf dem Gehweg bist du richtig. Geh lieber auf der Seite weg von der Straße.",
    "Einfahrten auf dem Gehweg: Hier können Autos rückwärts rauskommen. Kurz schauen!",
  ],
  eimer: ["Da ist ein Mülleimer. Drück E, dann kommt dein Müll hinein — das bringt Punkte und Karma."],
  muell: ["Da liegt Müll. Heb ihn mit E auf, aber nie auf der Fahrbahn!", "Bis zu drei Stück Müll kannst du tragen, dann ab zum Mülleimer."],
  schule: [
    "Hier ist deine Schule. Auf dem Schulhof fahren keine Autos — aber am Tor schon. Da gut schauen.",
    "Vor der Schule halten morgens viele Elterntaxis. Steig nur auf der Gehwegseite aus!",
    "Dein Schulweg ist am sichersten, wenn du ihn immer gleich gehst — mit Ampel oder Zebrastreifen.",
  ],
  sonst: [
    "Frag mich an einer Haltestelle, an einem Schild oder an einer Ampel — da weiß ich besonders viel!",
    "Geh am Straßenrand lieber mit Blick auf den Verkehr. Dann siehst du die Autos kommen.",
    "Zwischen parkenden Autos sieht dich kein Fahrer. Quer lieber da, wo man dich gut sieht.",
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
  private gefragt = new Map<string, number>();

  /** Gefragt: immer eine Antwort — passend zum Ort, und bei jedem Fragen die nächste. */
  frag(ort: LtbOrt, t: number): string {
    this.zuletzt = t;
    const key = ort.wo === "untergrund" ? `untergrund:${ort.art}` : ort.wo === "schild" ? `schild:${ort.art}` : ort.wo;
    const n = this.gefragt.get(key) ?? 0;
    this.gefragt.set(key, n + 1);
    const reihum = (saetze: string[]) => saetze[n % saetze.length];
    switch (ort.wo) {
      case "bus":
        return n % 2 === 0
          ? ort.haltGewuenscht ? "Halt ist gewünscht! 🔔 Bleib sitzen, bis der Bus steht und die Tür aufgeht." : "Wenn du raus willst: X drücken oder auf den Bus tippen. Dann hält er an der nächsten Haltestelle."
          : reihum(ORT_SAETZE.bus);
      case "haltestelle": {
        const b = ort.naechste;
        if (n % 2 === 0 && b) return b.inMinuten === 0
          ? `Hier ist ${ort.name}. Die ${b.linie} nach ${b.ziel} kommt jetzt! Abstand zur Kante — und erst aussteigen lassen.`
          : `Hier ist ${ort.name}. Die nächste ${b.linie} nach ${b.ziel} kommt in ${b.inMinuten} Minute${b.inMinuten === 1 ? "" : "n"}. Genug Zeit — kein Grund zu rennen.`;
        return reihum(ORT_SAETZE.haltestelle);
      }
      case "schild": {
        const s = SCHILDER[ort.art];
        // Erst ein Hinweis (das Quiz verrät er nicht gleich), beim nächsten Mal die Erklärung.
        return n % 2 === 0 ? `Das ist Zeichen ${s.nummer}: »${s.name}«. Drück E — dann stell ich dir eine Frage dazu.` : s.erklaerung;
      }
      case "eimer":
        return ort.getragen > 0 ? `Du trägst ${ort.getragen} Stück Müll — ab damit in den Eimer: E drücken!` : reihum(ORT_SAETZE.eimer);
      case "untergrund":
        return reihum(ORT_SAETZE[key] ?? ORT_SAETZE.sonst);
      case "sonst":
        if (ort.dunkel && !ort.weste && n % 2 === 0) return "Es ist dunkel — zieh die Warnweste an (V)! Ohne sehen dich Autos erst ganz spät.";
        return reihum(ORT_SAETZE.sonst);
      default:
        return reihum(ORT_SAETZE[ort.wo]);
    }
  }

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
