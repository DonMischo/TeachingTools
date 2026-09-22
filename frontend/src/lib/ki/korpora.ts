/**
 * Die mitgelieferten Korpora — Lesestoff für die Station »Trainieren«.
 *
 * Drei Texte mit deutlich verschiedener Stimme, damit man an *einem* Prompt
 * hört, dass nicht das Programm den Ton macht, sondern der Text: dasselbe
 * Zählverfahren wird aus dem Märchen ein Märchenerzähler und aus dem
 * Spielbericht ein Reporter.
 *
 * Alle drei sind eigens geschrieben (keine Vorlage, keine Rechte Dritter) und
 * absichtlich kurz: 150 bis 250 Wörter reichen für ein Netz, das erkennbar
 * spricht — und sind wenig genug, dass man ihm beim Auswendiglernen zusehen
 * kann. Genau das ist die Lehre.
 *
 * Wer einen Text austauscht: einfache Hauptsätze, wiederkehrende Wörter, jeder
 * Satz mit Punkt. Je regelmäßiger der Text, desto sprechfähiger das Netz.
 */
import type { Korpus } from "./trainieren";

const MAERCHEN = `
Es war einmal ein armer Müller. Der Müller hatte eine schöne Tochter.
Die Tochter saß im Turm und weinte. Da kam ein kleines Männchen herein.
Das Männchen sprach zu der Tochter. Was gibst du mir, wenn ich dir helfe?
Die Tochter gab ihm ihre Kette. Das Männchen setzte sich an das Rad.
Es spann die ganze Nacht. Am Morgen war das Stroh zu Gold geworden.
Der König kam in den Turm und staunte. Der König war gierig und wollte mehr.
Er führte die Tochter in eine größere Kammer. Da saß sie wieder und weinte.
Wieder kam das kleine Männchen herein. Wieder spann es die ganze Nacht.
Am Morgen war alles Stroh zu Gold geworden. Der König nahm die Tochter zur Frau.
Nach einem Jahr kam das Männchen zurück. Es wollte das Kind der Königin.
Die Königin weinte und bat um Gnade. Das Männchen lachte und sprach.
Wenn du meinen Namen weißt, darfst du das Kind behalten.
Die Königin schickte einen Boten in das Land. Der Bote lief über die Berge.
Am Abend sah er ein Feuer im Wald. Um das Feuer sprang das kleine Männchen.
Es sang laut seinen Namen. Der Bote lief zurück zu der Königin.
Am Morgen kam das Männchen wieder. Die Königin nannte seinen Namen.
Da schrie das Männchen und lief davon. Die Königin behielt ihr Kind.
`;

const SPIELBERICHT = `
Die Gäste kamen gut in das Spiel. Schon in der dritten Minute prüfte Berger den Torwart.
Der Torwart hielt den Ball sicher fest. Die Gastgeber standen tief und warteten ab.
In der zwölften Minute fiel das erste Tor. Berger flankte von rechts in den Strafraum.
Dort stand Kilic völlig frei. Kilic köpfte den Ball flach in die Ecke.
Die Zuschauer auf der Tribüne jubelten laut. Die Gastgeber wirkten geschockt.
Nach einer halben Stunde kam die Antwort. Ein langer Pass fand den schnellen Weber.
Weber lief allein auf das Tor zu. Er schoss den Ball an den Pfosten.
Kurz vor der Pause wurde es hitzig. Der Schiedsrichter zeigte die gelbe Karte.
In der zweiten Halbzeit drückten die Gastgeber. Weber traf nach einer Ecke zum Ausgleich.
Jetzt lief das Spiel nur noch in eine Richtung. Der Trainer der Gäste wechselte zweimal.
Die frischen Spieler brachten wieder Ordnung. In der achtzigsten Minute fiel die Entscheidung.
Kilic lief über den linken Flügel. Er passte in die Mitte auf Berger.
Berger schoss den Ball unter die Latte. Die Gäste gewannen am Ende verdient.
Der Trainer lobte nach dem Spiel seine Mannschaft.
`;

const REZEPT = `
Für den Teig brauchst du Mehl und Milch. Nimm eine große Schüssel.
Gib das Mehl in die Schüssel. Gib eine Prise Salz dazu.
Schlage zwei Eier in eine Tasse. Rühre die Eier mit einer Gabel.
Gib die Eier zu dem Mehl. Gieße die Milch langsam dazu.
Rühre den Teig kräftig durch. Der Teig soll glatt und weich sein.
Lass den Teig zehn Minuten ruhen. Stelle eine Pfanne auf den Herd.
Erhitze etwas Butter in der Pfanne. Die Butter soll leicht schäumen.
Gib eine Kelle Teig in die Pfanne. Verteile den Teig mit einer Bewegung.
Backe den Pfannkuchen zwei Minuten. Der Rand wird dabei goldbraun.
Wende den Pfannkuchen mit einem Wender. Backe ihn noch eine Minute.
Nimm den Pfannkuchen aus der Pfanne. Lege ihn auf einen warmen Teller.
Backe den nächsten Pfannkuchen genauso. Bestreiche die Pfannkuchen mit Marmelade.
Rolle die Pfannkuchen vorsichtig zusammen. Bestreue sie mit etwas Zucker.
Stelle die Teller auf den Tisch. Guten Appetit.
`;

export const KORPORA: Korpus[] = [
  { slug: "maerchen", titel: "Märchen", icon: "🏰", text: MAERCHEN.trim() },
  { slug: "spielbericht", titel: "Spielbericht", icon: "⚽", text: SPIELBERICHT.trim() },
  { slug: "rezept", titel: "Rezept", icon: "🥞", text: REZEPT.trim() },
];
