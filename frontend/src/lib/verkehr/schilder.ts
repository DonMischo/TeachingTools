/**
 * Verkehrszeichen in der Stadt: wo sie stehen (aus der Karte abgeleitet) und
 * was man darüber wissen soll. Jedes Schild ist ein kleines Quiz.
 */
import type { P } from "./geometrie";
import { winkelVon, type Stadt } from "./stadt";
import type { Kreuzung } from "./vorfahrt";

export type SchildArt = "stopp" | "vorfahrtAchten" | "vorfahrtstrasse" | "zebra" | "haltestelle" | "radweg" | "gehRad" | "gehRadGetrennt" | "radfrei" | "spielstrasse";

export type Schild = { art: SchildArt; p: P };

export type Frage = { nummer: string; name: string; frage: string; antworten: string[]; richtig: number; erklaerung: string };

export const SCHILDER: Record<SchildArt, Frage> = {
  stopp: {
    nummer: "206", name: "Halt! Vorfahrt gewähren",
    frage: "Was muss ein Auto an diesem Schild tun?",
    antworten: ["Langsam weiterfahren", "Ganz anhalten und dann die Vorfahrt lassen", "Hupen und fahren"],
    richtig: 1,
    erklaerung: "Am Stoppschild muss jedes Fahrzeug ganz anhalten — auch wenn frei ist. Für dich heißt das: Autos können hier gleich wieder anfahren. Schau, ob der Fahrer dich gesehen hat.",
  },
  vorfahrtAchten: {
    nummer: "205", name: "Vorfahrt gewähren",
    frage: "Wer hat hier Vorfahrt?",
    antworten: ["Wer an diesem Schild steht", "Der Verkehr auf der anderen Straße", "Immer der Schnellere"],
    richtig: 1,
    erklaerung: "Das Dreieck mit der Spitze nach unten sagt: Die anderen haben Vorfahrt. Autos, die hier warten, schauen oft nur nach Autos — nicht nach Fußgängern. Blickkontakt suchen!",
  },
  vorfahrtstrasse: {
    nummer: "306", name: "Vorfahrtstraße",
    frage: "Du fährst mit dem Rad auf dieser Straße. Was gilt an der nächsten Kreuzung?",
    antworten: ["Rechts vor links", "Du hast Vorfahrt vor den Seitenstraßen", "Du musst anhalten"],
    richtig: 1,
    erklaerung: "Die gelbe Raute sagt: Diese Straße hat Vorfahrt — die Seitenstraßen haben »Vorfahrt gewähren« oder »Stopp«. Trotzdem aufpassen: Nicht jeder hält sich daran, und Abbieger übersehen Radfahrer gern.",
  },
  zebra: {
    nummer: "350", name: "Fußgängerüberweg",
    frage: "Was gilt am Zebrastreifen?",
    antworten: ["Fußgänger haben Vorrang — Autos müssen halten", "Autos haben Vorrang", "Nur Radfahrer dürfen queren"],
    richtig: 0,
    erklaerung: "Am Zebrastreifen müssen Autos Fußgänger über die Straße lassen. Trotzdem: am Rand stehen bleiben, schauen, und erst gehen, wenn die Autos wirklich halten.",
  },
  haltestelle: {
    nummer: "224", name: "Haltestelle",
    frage: "Wo wartest du auf den Bus?",
    antworten: ["Direkt an der Bordsteinkante", "Auf der Fahrbahn, damit der Fahrer dich sieht", "Mit etwas Abstand zur Kante, und seitlich neben der Tür"],
    richtig: 2,
    erklaerung: "Der Bus schwenkt beim Anfahren an die Haltestelle über den Bordstein. Mit Abstand warten, und an der Tür erst die anderen aussteigen lassen.",
  },
  radweg: {
    nummer: "237", name: "Radweg",
    frage: "Wer darf auf diesem Weg fahren oder gehen?",
    antworten: ["Nur Radfahrer", "Nur Fußgänger", "Alle"],
    richtig: 0,
    erklaerung: "Das blaue runde Schild mit Fahrrad heißt: Hier nur Räder. Zu Fuß bleibst du auf dem Gehweg — Räder sind leise und schnell.",
  },
  gehRad: {
    nummer: "240", name: "Gemeinsamer Geh- und Radweg",
    frage: "Was bedeutet der Strich zwischen Fußgänger und Fahrrad hier NICHT?",
    antworten: ["Fuß und Rad teilen sich den Weg", "Radfahrer müssen auf Fußgänger Rücksicht nehmen", "Fußgänger dürfen hier nicht gehen"],
    richtig: 2,
    erklaerung: "Ein waagerechter Strich: Geh- und Radweg gemeinsam. Beide dürfen hier sein, Räder müssen Rücksicht nehmen. (Ein senkrechter Strich hieße: getrennte Seiten.)",
  },
  gehRadGetrennt: {
    nummer: "241", name: "Getrennter Geh- und Radweg",
    frage: "Auf welcher Seite fährst du mit dem Rad?",
    antworten: ["Wo gerade Platz ist", "Auf der Seite mit dem Fahrrad-Symbol", "Auf der Fahrbahn"],
    richtig: 1,
    erklaerung: "Der senkrechte Strich teilt den Weg: Fußgänger auf ihrer Seite, Räder auf der anderen (meist roter Belag). Das Schild ist blau — also muss man den Radweg benutzen.",
  },
  radfrei: {
    nummer: "239 + 1022-10", name: "Gehweg, Radfahrer frei",
    frage: "Wie schnell darfst du hier mit dem Rad fahren?",
    antworten: ["So schnell ich will", "Schrittgeschwindigkeit — Fußgänger haben Vorrang", "Radfahren ist hier verboten"],
    richtig: 1,
    erklaerung: "Das blaue Schild mit Fußgängern heißt Gehweg. Das Zusatzzeichen »Radfahrer frei« erlaubt Räder — aber nur im Schritttempo und mit Rücksicht. Du musst hier nicht fahren, die Fahrbahn geht auch.",
  },
  spielstrasse: {
    nummer: "325.1", name: "Verkehrsberuhigter Bereich",
    frage: "Wie schnell dürfen Autos hier fahren?",
    antworten: ["30 km/h", "Schrittgeschwindigkeit", "50 km/h"],
    richtig: 1,
    erklaerung: "Die »Spielstraße«: Kinder dürfen überall spielen, Autos nur Schritttempo fahren. Trotzdem können hier Autos kommen — Augen offen halten.",
  },
};

/** Wo in der Stadt welches Schild steht (mit `kreuzungen` auch die abgeleiteten Vorfahrtschilder). */
export function baueSchilder(stadt: Stadt, kreuzungen: Kreuzung[] = []): Schild[] {
  const schilder: Schild[] = [];
  const amRand = (p: P, abstand: number): P => {
    const n = stadt.naechsteStrasse(p[0], p[1], 15);
    if (!n) return p;
    const w = winkelVon(n.st), seite = -(p[0] - n.st.a[0]) * Math.sin(w) + (p[1] - n.st.a[1]) * Math.cos(w) >= 0 ? 1 : -1;
    const [ax, ay] = n.st.a, [bx, by] = n.st.b;
    const qx = ax + (bx - ax) * n.t, qy = ay + (by - ay) * n.t;
    const d = n.s.breite / 2 + abstand;
    return [qx - Math.sin(w) * d * seite, qy + Math.cos(w) * d * seite];
  };
  for (const p of stadt.karte.punkte) {
    if (p.art === "stopp") schilder.push({ art: "stopp", p: amRand(p.p, 0.8) });
    else if (p.art === "vorfahrtAchten") schilder.push({ art: "vorfahrtAchten", p: amRand(p.p, 0.8) });
    else if (p.art === "zebra") schilder.push({ art: "zebra", p: amRand([p.p[0] + 2.5, p.p[1]], 0.8) });
  }
  for (const h of stadt.halte) schilder.push({ art: "haltestelle", p: [h.p[0] + 0.8, h.p[1]] });
  for (const w of stadt.karte.wege) {
    if (w.art === "rad") schilder.push({ art: "radweg", p: w.linie[0] });
    else if (w.art === "geh_rad") schilder.push({ art: "gehRad", p: w.linie[0] });
    else if (w.art === "geh_rad_getrennt") schilder.push({ art: "gehRadGetrennt", p: w.linie[0] });
    else if (w.art === "geh_radfrei") schilder.push({ art: "radfrei", p: w.linie[0] });
  }
  // Vorfahrt an Kreuzungen: rechts neben dem Arm, ein paar Meter vor der Kreuzung
  for (const k of kreuzungen) for (const a of k.arme) {
    if (a.schild !== "abgeleitet") continue;
    const art: SchildArt | null = a.regel === "warten" ? "vorfahrtAchten" : a.regel === "vorfahrt" ? "vorfahrtstrasse" : null;
    if (!art) continue;
    const d = k.kern + 3, seite = a.strasse.breite / 2 + 0.8;
    // Wer auf die Kreuzung zufährt, blickt entgegen dem Arm; rechts davon steht das Schild
    const zu = a.winkel + Math.PI;
    schilder.push({ art, p: [k.p[0] + Math.cos(a.winkel) * d + Math.cos(zu + Math.PI / 2) * seite, k.p[1] + Math.sin(a.winkel) * d + Math.sin(zu + Math.PI / 2) * seite] });
  }
  for (const s of stadt.strassen) if (s.art === "living_street") schilder.push({ art: "spielstrasse", p: amRand(s.linie[0], 0.8) });
  // Doppelte (gleiche Art, dicht beieinander) weglassen.
  const behalten: Schild[] = [];
  for (const a of schilder) if (!behalten.some((b) => b.art === a.art && Math.hypot(b.p[0] - a.p[0], b.p[1] - a.p[1]) < 8)) behalten.push(a);
  return behalten;
}
