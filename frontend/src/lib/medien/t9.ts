/**
 * T9 wie auf dem Handy um 2000: ein Druck pro Buchstabe, das Handy rät das
 * Wort aus einem Wörterbuch. Hier ein kleines Wörterbuch mit häufigen Wörtern
 * aus SMS-Deutsch — reicht, um das Prinzip (und die Verwechslungen) zu zeigen.
 */
import { TASTEN } from "./codes";

const WOERTER = `ich du er sie es wir ihr und oder aber nicht auch noch schon nur mal ja nein doch so wie was wer wo wann warum
hallo hi hey tschüss bis bald morgen heute gestern jetzt gleich später nachher abend nacht tag woche wochenende
bin bist ist sind war hab habe hast hat haben kann kannst will willst muss musst komme kommst kommt gehe gehst geht
mache machst macht sehe siehst sieht weiß weißt sag sage sagst ruf rufe an zurück schreib schreibe schreibst
gut super toll cool klar okay ok danke bitte sorry schade geil lustig doof blöd müde krank lieb liebe
dich mich mir dir uns euch ihn ihm mein meine dein deine sein seine unser euer
schule pause mathe deutsch englisch sport hausaufgaben test arbeit lehrer lehrerin klasse bus bahn zug auto rad
zuhause hause haus kino party treffen essen pizza pommes eis kaffee wasser geld handy akku sms anruf nachricht
mama papa oma opa bruder schwester freund freundin freunde leute alle jemand niemand
wo bist du hab dich lieb vermisse gute nacht guten morgen viel spaß glückwunsch geburtstag frohe
der die das den dem des ein eine einen einem einer kein keine mit von zu zum zur bei nach vor für um am im in an auf aus über unter
gehen kommen machen sehen hören spielen lernen warten wissen fragen sagen holen bringen
gallo hut hallt gamm ball kalt alt neu groß klein viel wenig mehr fertig los`.split(/\s+/).filter(Boolean);

/** Buchstabe → Taste; Umlaute und ß wie auf deutschen Handys */
const TASTE: Record<string, string> = {};
for (const [t, b] of Object.entries(TASTEN)) for (const c of b) if (/[a-z]/.test(c)) TASTE[c] = t;
Object.assign(TASTE, { "ä": "2", "ö": "6", "ü": "8", "ß": "7" });

export function t9Code(wort: string): string {
  return [...wort.toLowerCase()].map(c => TASTE[c] ?? "").join("");
}

const NACH_CODE = new Map<string, string[]>();
for (const w of [...new Set(WOERTER)]) {
  const c = t9Code(w);
  NACH_CODE.set(c, [...(NACH_CODE.get(c) ?? []), w]);
}

/** Alle Wörter mit genau dieser Tastenfolge — zuerst das häufigere (Reihenfolge der Liste) */
export function t9Vorschlaege(code: string): string[] {
  if (!code) return [];
  const genau = NACH_CODE.get(code);
  if (genau) return genau;
  // Kein Wort bekannt: Buchstaben einzeln raten, je Taste den ersten — wie das Handy es tat
  return [[...code].map(t => (TASTEN[t] ?? "")[0] ?? "").join("")];
}
