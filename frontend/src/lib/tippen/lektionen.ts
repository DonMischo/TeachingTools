/**
 * Übungstexte, aufsteigend nach neuen Tasten.
 *
 * Das Format ist absichtlich das der KTouch-Kursdateien (`de1.xml`:
 * Titel / neue Zeichen / Text) — der geplante Import des vollständigen
 * deutschen Kurses ersetzt später diese Datei, ohne dass am Rest etwas
 * zu ändern wäre.
 *
 * Regel für alle Texte: keine Tottasten (^ ´ `) — die erzeugen erst zusammen
 * mit dem folgenden Zeichen etwas und würden die Fehlersperre auslösen,
 * bevor der Schüler überhaupt etwas falsch gemacht hat.
 */

export type Lektion = {
  id: string;
  titel: string;
  /** Die in dieser Lektion neu hinzukommenden Tasten. */
  neueZeichen: string;
  text: string;
};

export const LEKTIONEN: Lektion[] = [
  {
    id: "grundstellung-1",
    titel: "Grundstellung",
    neueZeichen: "asdfjklö",
    text:
      "fff jjj fff jjj ddd kkk ddd kkk sss lll sss lll aaa ööö aaa ööö " +
      "fj fj dk dk sl sl aö aö jf jf kd kd ls ls öa öa " +
      "asdf jklö asdf jklö fdsa ölkj fdsa ölkj",
  },
  {
    id: "grundstellung-2",
    titel: "Grundstellung mit g und h",
    neueZeichen: "gh",
    text:
      "ggg hhh ggg hhh fgf jhj fgf jhj gh gh hg hg " +
      "gas gas hal hal lag lag hag hag " +
      "dsa gfd hjk löh gala hall dach fach",
  },
  {
    id: "obere-reihe-1",
    titel: "e, i und r, u",
    neueZeichen: "eiru",
    text:
      "ded kik ded kik frf juj frf juj " +
      "die der die der uhr uhr eis eis " +
      "reise reise feuer feuer kleider kleider " +
      "die reise ist lang und der koffer ist schwer",
  },
  {
    id: "obere-reihe-2",
    titel: "t, z, o und w, q",
    neueZeichen: "tzowq",
    text:
      "ftf jzj ftf jzj lol lol swsw swsw " +
      "tor tor zeit zeit wort wort quer quer " +
      "die zeit ist um das tor ist zu " +
      "wir zeigen dir das wort und du tippst es sauber",
  },
  {
    id: "untere-reihe",
    titel: "n, m, v, b und c, x, y",
    neueZeichen: "nmvbcxy",
    text:
      "jnj jmj fvf fbf jnj jmj fvf fbf dcd sxs aya " +
      "von von mein mein bald bald noch noch " +
      "der mann macht mir mut und ich bin ruhig " +
      "nimm dir zeit und bleib bei einem sauberen anschlag",
  },
  {
    id: "satzzeichen",
    titel: "Punkt, Komma und Umschalt",
    neueZeichen: ".,ABC",
    text:
      "Der Ball rollt. Die Uhr steht. Das Fach ist leer. " +
      "Anna, Bernd und Clara warten am Tor. " +
      "Wer sauber tippt, wird von allein schnell. " +
      "Sieh nicht auf die Tasten, sondern auf den Text.",
  },
  {
    id: "grossbuchstaben",
    titel: "Große Buchstaben",
    neueZeichen: "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ",
    text:
      "Anna Bernd Clara David Emil Frieda Gustav Heike Ida Jonas " +
      "Karla Lena Marie Nele Olaf Paul Rosa Sven Tom Ulf Vera Wilma " +
      "Am Montag kommt Frau Müller in die Klasse. " +
      "Der Rhein fließt durch Köln, Bonn und Mainz. " +
      "Über Ostern fahren Anna und Özlem nach Wien.",
  },
  {
    id: "satzzeichen",
    titel: "Satzzeichen",
    neueZeichen: "?!:;-()",
    text:
      "Wie geht es dir? Mir geht es gut! Und dir? " +
      "Sie fragte: Kommst du mit? Er rief: Ja, gleich! " +
      "Wir brauchen drei Dinge: Stift, Heft und Ruhe; mehr nicht. " +
      "Das Buch (Seite 12) liegt auf dem Tisch. " +
      "Der Vor-Ort-Termin fällt aus - wir treffen uns online.",
  },
  {
    id: "zahlen",
    titel: "Zahlen und Rechenzeichen",
    neueZeichen: "1234567890+*/=%§$&",
    text:
      "1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 " +
      "12 + 8 = 20 und 45 - 5 = 40 " +
      "7 * 6 = 42, 81 / 9 = 9, 50 % von 80 sind 40 " +
      "Im Jahr 1989 fiel die Mauer, 1990 kam die Einheit. " +
      "Siehe § 3 Absatz 2: die Punkte 15 & 16 sind Pflicht.",
  },
];

/**
 * Alle Zeichen, die bis einschließlich dieser Lektion dran waren — der
 * Zeichenvorrat, aus dem die Spiele schöpfen dürfen. Die Leertaste ist
 * immer dabei, sie kommt schon in der ersten Zeile vor.
 */
export function zeichenBis(index: number): string {
  const zeichen = new Set<string>(" ");
  for (const lektion of LEKTIONEN.slice(0, index + 1)) {
    for (const c of lektion.neueZeichen) zeichen.add(c);
  }
  return [...zeichen].join("");
}
