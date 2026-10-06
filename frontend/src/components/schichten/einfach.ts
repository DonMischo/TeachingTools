/**
 * Einsteiger-Texte (ab Klasse 6) für die 15 Schritte der Reise. Bild dahinter:
 * die Post — Brief, Umschlag, Briefträger, Puzzleteile.
 */
import type { SchichtNr } from "@/lib/schichten/kapselung";

export interface Einfach {
  titel: string;
  text: string;
  merke: string;
}

const LENA: Record<SchichtNr, Einfach> = {
  7: {
    titel: "Lena tippt auf »Senden«",
    text: "Lenas Nachrichten-App PurrMsg weiß nur den Namen des Servers: tokio.purrmsg.example. Für die Reise braucht sie aber eine Adresse aus Zahlen — wie eine Postleitzahl. Die schlägt sie im »Telefonbuch des Internets« nach, dem DNS: 203.0.113.7.",
    merke: "Schicht 7 ist das Programm, mit dem du arbeitest — hier PurrMsg.",
  },
  6: {
    titel: "Aus dem Foto werden Zahlen — und ein Geheimcode",
    text: "Für den Computer ist ein Foto nur eine riesige Liste von Zahlen: Jedes Pünktchen (Pixel) hat eine Farbe aus Rot, Grün und Blau. Damit es schneller reist, wird das Foto kleiner gepackt. Dann wird es verschlüsselt — wie ein Geheimcode, den nur Lena und der Server kennen.",
    merke: "Schicht 6 sorgt dafür, dass beide Seiten die Daten gleich verstehen — und dass Fremde sie nicht lesen können.",
  },
  5: {
    titel: "Hallo, Server!",
    text: "Bevor es losgeht, sagen Handy und Server »Hallo« und verabreden sich — wie bei einem Telefonat: »Wer bist du? Welchen Geheimcode nehmen wir?« Erst dann geht es los.",
    merke: "Schicht 5 kümmert sich um das Gespräch: anfangen, weiterführen, beenden.",
  },
  4: {
    titel: "Zerschneiden in Puzzleteile",
    text: "Das Foto ist zu groß für ein einziges Paket. Es wird in viele kleine Stücke geschnitten. Jedes Stück bekommt eine Nummer — wie nummerierte Puzzleteile. So kann der Server sie wieder richtig zusammenlegen und merkt, wenn eins fehlt.",
    merke: "Schicht 4 zerlegt, nummeriert und sorgt dafür, dass nichts verloren geht.",
  },
  3: {
    titel: "Ab in den Umschlag mit Adresse",
    text: "Jedes Puzzleteil kommt in einen Umschlag. Darauf steht die Adresse des Servers in Tokio und Lenas Absender. Diese Adresse lesen alle Stationen auf dem Weg — wie die Anschrift auf einem Brief.",
    merke: "Schicht 3 kennt die Adressen im ganzen Internet und findet den Weg.",
  },
  2: {
    titel: "Noch ein Umschlag — nur bis zum Router",
    text: "Für das erste kurze Stück, nur bis zum WLAN-Router in der Wohnung, kommt ein zweiter Umschlag drum: »An den Router, von Lenas Handy«. Dazu eine Prüfzahl. Ist unterwegs etwas kaputtgegangen, passt die Zahl nicht mehr.",
    merke: "Schicht 2 bringt das Paket zum nächsten Gerät — und merkt, wenn etwas kaputt ist.",
  },
  1: {
    titel: "Nur noch Einsen und Nullen",
    text: "Jetzt hört das Foto auf, ein Foto zu sein. Alles wird zu Einsen und Nullen — und die werden zu Funkwellen. Durch die Luft flitzen sie zum Router.",
    merke: "Schicht 1 ist das Kabel, die Funkwelle, das Licht — da, wo die Bits wirklich unterwegs sind.",
  },
};

const TOKIO: Record<SchichtNr, Einfach> = {
  1: { titel: "Lichtblitze in Tokio", text: "In Tokio kommen Lichtblitze aus dem Glasfaserkabel an. Daraus werden wieder Einsen und Nullen.", merke: "Unten kommt an, was oben weggeschickt wurde — nur rückwärts." },
  2: { titel: "Prüfzahl stimmt? Umschlag weg!", text: "Der Server rechnet die Prüfzahl nach. Sie stimmt — also ist nichts kaputt. Den äußeren Umschlag braucht er nicht mehr.", merke: "Jede Schicht nimmt genau ihren eigenen Umschlag ab." },
  3: { titel: "Ist das für mich?", text: "Auf dem Umschlag steht die Adresse des Servers. Richtig! Umschlag auf.", merke: "Router unterwegs haben nur die Adresse gelesen, nie hineingeschaut." },
  4: { titel: "Puzzle zusammensetzen", text: "Alle Puzzleteile sind da. Der Server legt sie nach ihren Nummern in die richtige Reihenfolge. Hätte eins gefehlt, hätte er Lena gebeten, es noch einmal zu schicken.", merke: "Auch wenn Stücke in falscher Reihenfolge ankommen — die Nummern retten alles." },
  5: { titel: "Ach, Lena!", text: "Der Server erkennt das verabredete Gespräch mit Lena wieder.", merke: "Das Gespräch bleibt offen — das nächste Foto geht schneller." },
  6: { titel: "Geheimcode knacken — erlaubt", text: "Mit dem verabredeten Schlüssel macht der Server die Daten wieder lesbar. Aus den Zahlen wird wieder ein Foto.", merke: "Hätte jemand unterwegs etwas verändert, würde der Server es jetzt merken." },
  7: { titel: "🐈 Angekommen!", text: "PurrMsg speichert das Foto. Lenas Bruder öffnet PurrMsg auf seinem Handy — und sieht die Katze.", merke: "Das alles hat ungefähr eine Sekunde gedauert." },
};

export const UNTERWEGS: Einfach = {
  titel: "Einmal um die halbe Welt",
  text: "Das Paket reist über viele Stationen: Erfurt, Frankfurt, Marseille, dann durch ein Kabel am Meeresboden — so dick wie ein Gartenschlauch — bis nach Tokio. An jeder Station schaut ein Router auf die Adresse und reicht das Paket weiter, wie Briefträger von Postamt zu Postamt. Etwa 20 000 Kilometer in einem Zehntel einer Sekunde!",
  merke: "Die Adresse bleibt immer gleich. Nur der äußere Umschlag wird an jeder Station neu gemacht.",
};

export function einfach(seite: "lena" | "unterwegs" | "tokio", nr: SchichtNr | null): Einfach {
  if (seite === "unterwegs" || !nr) return UNTERWEGS;
  return seite === "lena" ? LENA[nr] : TOKIO[nr];
}
