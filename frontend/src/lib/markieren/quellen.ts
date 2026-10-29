/**
 * Referat & Quellen: aus einem Buch oder einer Webseite ein wörtliches Zitat
 * und die Angaben fürs Literaturverzeichnis herauskopieren.
 *
 * Alle Quellen sind erfunden (Namen, Verlage, Adressen) — es geht ums Finden
 * und Kopieren, nicht um den Inhalt. Die Zitierweise ist die in Schulen
 * verbreitete Kurzform (Autor-Jahr im Text, Vollbeleg im Verzeichnis); manche
 * Lehrkräfte wollen es anders, der Hilfetext sagt das.
 *
 * Ein Fall besteht aus der Quelle (Buchseiten oder Webseite), den Feldern mit
 * ihren richtigen Werten und typischen Fehlgriffen (»Das ist der Name der
 * Website, nicht die Überschrift«) und zwei Vorlagen: dem Satz mit Zitat und
 * Kurzbeleg und dem Eintrag im Literaturverzeichnis.
 */

export type Feld = {
  id: string;
  label: string;
  /** Richtige Werte (der erste wird in der Lösung angezeigt). */
  ziel: string[];
  /** Fehlgriff → Hinweis (verglichen ohne Groß/klein und Leerraum). */
  falsch?: Record<string, string>;
  /** Hinweis, wenn der Wert sonst falsch ist. */
  hinweis: string;
  /** Wörtlich, Groß/klein zählt (das Zitat). */
  genau?: boolean;
  breit?: boolean;
};

/** Eine Vorlage: Text mit Lücken (Feld-Ids). */
export type Teil = string | { feld: string };

export type BuchSeite = { titel: string; art: "titel" | "impressum" | "inhalt"; zeilen: string[]; nr?: number; kopf?: string };

export type Buch = {
  art: "buch";
  seiten: BuchSeite[];
};

export type Webseite = {
  art: "web";
  site: string;
  url: string;
  tabTitel: string;
  navigation: string[];
  rubrik: string;
  titel: string;
  unterzeile: string;
  /** Zeile unter der Überschrift (Autor, Datum). */
  meta: string[];
  absaetze: string[];
  seitenleiste: { titel: string; artikel: string[] };
  werbung: string;
  teilen: string;
  fuss: string[];
};

export type Fall = {
  id: string;
  icon: string;
  titel: string;
  auftrag: string;
  quelle: Buch | Webseite;
  felder: Feld[];
  zitatSatz: Teil[];
  verzeichnis: Teil[];
};

// ---------------------------------------------------------------- Prüfen

const flach = (s: string) => s.replace(/[ \s]+/g, " ").trim();
const lose = (s: string) => flach(s).toLowerCase().replace(/^[„“"»«']+|[„“"»«']+$/g, "").replace(/\/+$/, "");

export type Pruefung = { ok: boolean; hinweis?: string };

export function pruefeFeld(f: Feld, wert: string): Pruefung {
  if (!flach(wert)) return { ok: false, hinweis: "Hier fehlt noch etwas." };
  if (f.genau) {
    const ohne = (s: string) => flach(s).replace(/^[„“"»«]+|[„“"»«]+$/g, "").replace(/[.!?]$/, "");
    if (f.ziel.some(z => ohne(z) === ohne(wert))) return { ok: true };
    const w = ohne(wert), z = ohne(f.ziel[0]);
    if (z.includes(w)) return { ok: false, hinweis: "Da fehlt noch ein Stück vom Satz." };
    if (w.includes(z)) return { ok: false, hinweis: "Das ist zu viel — nur der eine Satz gehört ins Zitat." };
    if (w.toLowerCase() === z.toLowerCase()) return { ok: false, hinweis: "Ein Zitat bleibt genau, wie es dasteht — auch Groß- und Kleinschreibung." };
    return { ok: false, hinweis: f.hinweis };
  }
  if (f.ziel.some(z => lose(z) === lose(wert))) return { ok: true };
  const fehl = Object.entries(f.falsch ?? {}).find(([k]) => lose(k) === lose(wert));
  return { ok: false, hinweis: fehl?.[1] ?? f.hinweis };
}

/** Datum wie auf Schulblättern: 29.10.2026 (auch 29.10.26 und ohne führende Null). */
export function abrufVarianten(heute: Date): string[] {
  const t = heute.getDate(), m = heute.getMonth() + 1, j = heute.getFullYear();
  const zwei = (n: number) => String(n).padStart(2, "0");
  const out = new Set<string>();
  for (const tt of [String(t), zwei(t)]) for (const mm of [String(m), zwei(m)]) for (const jj of [String(j), String(j).slice(2)]) out.add(`${tt}.${mm}.${jj}`);
  return [`${zwei(t)}.${zwei(m)}.${j}`, ...[...out].filter(v => v !== `${zwei(t)}.${zwei(m)}.${j}`)];
}

/** Die Vorlage mit den richtigen Werten — als fertiger Beleg. */
export function fertig(teile: Teil[], felder: Feld[]): string {
  return teile.map(t => (typeof t === "string" ? t : felder.find(f => f.id === t.feld)!.ziel[0])).join("");
}

// ---------------------------------------------------------------- Fälle bauen

/**
 * Felder, die im Kurzbeleg *und* im Verzeichnis stehen (Nachname, Jahr),
 * bekommen im Beleg ein eigenes Feld — sonst füllte eine Eingabe beide.
 */
function eigenerBeleg(f: Fall): Fall {
  const imVerzeichnis = new Set(f.verzeichnis.flatMap(t => (typeof t === "string" ? [] : [t.feld])));
  const neu: Feld[] = [];
  const zitatSatz = f.zitatSatz.map(t => {
    if (typeof t === "string" || !imVerzeichnis.has(t.feld)) return t;
    const orig = f.felder.find(x => x.id === t.feld)!;
    neu.push({ ...orig, id: `${orig.id}Beleg`, label: `${orig.label} (Beleg)` });
    return { feld: `${orig.id}Beleg` };
  });
  return { ...f, zitatSatz, felder: [...f.felder.slice(0, 1), ...neu, ...f.felder.slice(1)] };
}

type BuchDaten = {
  id: string; icon: string; nachname: string; vorname: string; titel: string; untertitel: string;
  ort: string; verlag: string; verlagLang: string; jahr: string; seite: number; kapitel: string; kapitelNr: number;
  absaetze: string[]; zitat: string; frage: string;
  lektorat: string; bilder: string; isbn: string;
};

function buch(d: BuchDaten): Fall {
  return eigenerBeleg(buchRoh(d));
}

function buchRoh(d: BuchDaten): Fall {
  const name = `${d.vorname} ${d.nachname}`;
  const falschName = {
    [d.lektorat]: "Das ist die Person aus dem Lektorat — sie hat das Buch geprüft, nicht geschrieben.",
    [d.bilder]: "Diese Person hat die Bilder gemacht. Gesucht ist, wer den Text geschrieben hat.",
    [name]: "Fast! Hier kommt nur ein Teil des Namens hin.",
  };
  const nachnamen = (wer: string) => wer.split(" ").slice(-1)[0];
  return {
    id: d.id, icon: d.icon, titel: d.titel, auftrag: d.frage,
    quelle: {
      art: "buch",
      seiten: [
        { titel: "Titelseite", art: "titel", zeilen: [name, d.titel, d.untertitel, d.verlag] },
        {
          titel: "Impressum", art: "impressum", zeilen: [
            "Bibliografische Information der Deutschen Nationalbibliothek: Die Deutsche Nationalbibliothek verzeichnet diese Publikation in der Deutschen Nationalbibliografie.",
            `1. Auflage ${d.jahr}`,
            `© ${d.jahr} ${d.verlagLang}, ${d.ort}`,
            "Alle Rechte vorbehalten.",
            `Lektorat: ${d.lektorat}`,
            `Illustrationen und Fotos: ${d.bilder}`,
            `ISBN ${d.isbn}`,
            "Gedruckt auf Papier aus nachhaltiger Forstwirtschaft.",
          ],
        },
        { titel: `Seite ${d.seite}`, art: "inhalt", nr: d.seite, kopf: `${d.kapitelNr} · ${d.kapitel}`, zeilen: d.absaetze },
      ],
    },
    felder: [
      { id: "zitat", label: "Zitat", ziel: [d.zitat], genau: true, breit: true, hinweis: "Das ist nicht der gesuchte Satz. Lies die Aufgabe noch einmal." },
      { id: "nachname", label: "Nachname", ziel: [d.nachname], hinweis: "Gesucht ist der Nachname der Person, die das Buch geschrieben hat (Titelseite).",
        falsch: { ...falschName, [d.vorname]: "Das ist der Vorname — vorn steht der Nachname.", [nachnamen(d.lektorat)]: falschName[d.lektorat], [nachnamen(d.bilder)]: falschName[d.bilder] } },
      { id: "vorname", label: "Vorname", ziel: [d.vorname], hinweis: "Der Vorname der Autorin bzw. des Autors (Titelseite).",
        falsch: { [d.nachname]: "Das ist der Nachname.", ...falschName } },
      { id: "jahr", label: "Jahr", ziel: [d.jahr], hinweis: "Das Erscheinungsjahr steht im Impressum (hinter »Auflage« oder dem ©).",
        falsch: { [String(d.seite)]: "Das ist die Seitenzahl. Das Jahr steht im Impressum." } },
      { id: "seite", label: "Seite", ziel: [String(d.seite)], hinweis: "Die Seitenzahl steht unten auf der Seite mit dem Zitat.",
        falsch: { [String(d.kapitelNr)]: "Das ist die Nummer des Kapitels, nicht der Seite.", [d.jahr]: "Das ist das Jahr. Die Seite steht unten auf der Buchseite." } },
      { id: "titel", label: "Titel", ziel: [d.titel], breit: true, hinweis: "Der Haupttitel steht groß auf der Titelseite.",
        falsch: { [d.untertitel]: "Das ist der Untertitel — er kommt danach.", [d.kapitel]: "Das ist nur das Kapitel. Gesucht ist der Titel des ganzen Buchs.", [`${d.titel}. ${d.untertitel}`]: "Titel und Untertitel bekommen je ein eigenes Feld." } },
      { id: "untertitel", label: "Untertitel", ziel: [d.untertitel], breit: true, hinweis: "Der Untertitel steht klein unter dem Titel.",
        falsch: { [d.titel]: "Das ist der Haupttitel." } },
      { id: "ort", label: "Ort", ziel: [d.ort], hinweis: "Der Verlagsort steht im Impressum hinter dem Verlag." },
      { id: "verlag", label: "Verlag", ziel: [d.verlag, d.verlagLang], breit: true, hinweis: "Der Verlag steht unten auf der Titelseite und im Impressum." },
    ],
    zitatSatz: ["Im Buch heißt es: „", { feld: "zitat" }, "“ (", { feld: "nachname" }, " ", { feld: "jahr" }, ", S. ", { feld: "seite" }, ")."],
    verzeichnis: [{ feld: "nachname" }, ", ", { feld: "vorname" }, " (", { feld: "jahr" }, "): ", { feld: "titel" }, ". ", { feld: "untertitel" }, ". ", { feld: "ort" }, ": ", { feld: "verlag" }, "."],
  };
}

type WebDaten = {
  id: string; icon: string; site: string; heim: string; pfad: string; kurzlink: string;
  titel: string; unterzeile: string; rubrik: string;
  /** Mit Person: Vor- und Nachname. Ohne: der Herausgeber aus dem Impressum. */
  autor: { vorname: string; nachname: string } | { herausgeber: string; redaktion: string };
  veroeffentlicht: string; aktualisiert?: string;
  absaetze: string[]; zitat: string; frage: string;
  navigation: string[]; seitenleiste: string[]; werbung: string;
};

const jahrAus = (datum: string) => datum.slice(-4);

function web(d: WebDaten, heute: Date): Fall {
  return eigenerBeleg(webRoh(d, heute));
}

function webRoh(d: WebDaten, heute: Date): Fall {
  const url = `https://${d.heim}${d.pfad}`;
  const person = "vorname" in d.autor ? d.autor : null;
  const hg = "herausgeber" in d.autor ? d.autor : null;
  const jahre = [jahrAus(d.aktualisiert ?? d.veroeffentlicht), jahrAus(d.veroeffentlicht)];
  const metaAutor = person ? `Von ${person.vorname} ${person.nachname}` : `Von ${hg!.redaktion}`;
  const felder: Feld[] = [
    { id: "zitat", label: "Zitat", ziel: [d.zitat], genau: true, breit: true, hinweis: "Das ist nicht der gesuchte Satz. Lies die Aufgabe noch einmal." },
    ...(person ? [
      { id: "nachname", label: "Nachname", ziel: [person.nachname], hinweis: "Der Name steht unter der Überschrift (»Von …«).",
        falsch: { [person.vorname]: "Das ist der Vorname.", [`${person.vorname} ${person.nachname}`]: "Hier nur der Nachname.", [d.site]: "Das ist der Name der Website. Gesucht ist die Person, die den Artikel geschrieben hat." } },
      { id: "vorname", label: "Vorname", ziel: [person.vorname], hinweis: "Der Vorname steht unter der Überschrift (»Von …«).",
        falsch: { [person.nachname]: "Das ist der Nachname." } },
    ] : [
      { id: "autor", label: "Herausgeber", ziel: [hg!.herausgeber], breit: true,
        hinweis: "Steht keine Person da, nimm den Herausgeber — er steht ganz unten im Impressum.",
        falsch: { [hg!.redaktion]: "»Redaktion« ist keine Person. Ganz unten im Impressum steht, wer die Seite herausgibt.", [d.site]: "Das ist der Name der Website. Der Herausgeber steht im Impressum ganz unten." } },
    ]),
    { id: "jahr", label: "Jahr", ziel: jahre, hinweis: "Das Jahr steht beim Datum unter der Überschrift.",
      falsch: { [String(heute.getFullYear())]: d.veroeffentlicht.endsWith(String(heute.getFullYear())) ? "" : "Das ist das heutige Jahr. Gesucht ist, wann der Artikel erschienen ist." } },
    { id: "titel", label: "Titel", ziel: [d.titel], breit: true, hinweis: "Der Titel ist die große Überschrift des Artikels.",
      falsch: { [d.site]: "Das ist der Name der ganzen Website. Gesucht ist die Überschrift des Artikels.", [d.unterzeile]: "Das ist der Vorspann unter der Überschrift.", [d.rubrik]: "Das ist nur die Rubrik." } },
    { id: "url", label: "Adresse (URL)", ziel: [url, url.replace("https://", "")], breit: true,
      hinweis: "Die genaue Adresse steht oben in der Adresszeile des Browsers — reinklicken markiert sie ganz.",
      falsch: { [`https://${d.heim}`]: "Das ist nur die Startseite. Die Quelle braucht die genaue Adresse dieser Seite.", [d.heim]: "Das ist nur die Startseite. Die Quelle braucht die genaue Adresse dieser Seite.", [d.kurzlink]: "Das ist ein Kurzlink zum Teilen. Ins Verzeichnis gehört die echte Adresse aus der Adresszeile." } },
    { id: "abruf", label: "Abrufdatum", ziel: abrufVarianten(heute), hinweis: "Das Abrufdatum ist der Tag, an dem du die Seite gelesen hast — also heute (TT.MM.JJJJ).",
      falsch: { [d.veroeffentlicht]: "Das ist das Datum des Artikels. Abgerufen hast du ihn heute.", ...(d.aktualisiert ? { [d.aktualisiert]: "Das ist das Datum der Aktualisierung. Abgerufen hast du die Seite heute." } : {}) } },
  ];
  for (const f of felder) if (f.falsch) for (const k of Object.keys(f.falsch)) if (!f.falsch[k]) delete f.falsch[k];
  const wer: Teil[] = person ? [{ feld: "nachname" }, ", ", { feld: "vorname" }] : [{ feld: "autor" }];
  return {
    id: d.id, icon: d.icon, titel: d.titel, auftrag: d.frage,
    quelle: {
      art: "web", site: d.site, url, tabTitel: `${d.titel} | ${d.site}`, navigation: d.navigation, rubrik: d.rubrik,
      titel: d.titel, unterzeile: d.unterzeile,
      meta: [metaAutor, `Veröffentlicht am ${d.veroeffentlicht}`, ...(d.aktualisiert ? [`Aktualisiert am ${d.aktualisiert}`] : [])],
      absaetze: d.absaetze,
      seitenleiste: { titel: "Das könnte dich auch interessieren", artikel: d.seitenleiste },
      werbung: d.werbung, teilen: d.kurzlink,
      fuss: [
        `© ${jahrAus(d.aktualisiert ?? d.veroeffentlicht)} ${d.site}`,
        hg ? `Impressum · Herausgeber: ${hg.herausgeber}` : `Impressum · Herausgeber: ${d.site} – Redaktion`,
        "Datenschutz · Kontakt · Newsletter",
      ],
    },
    felder,
    zitatSatz: ["Auf der Website heißt es: „", { feld: "zitat" }, "“ (", person ? { feld: "nachname" } : { feld: "autor" }, " ", { feld: "jahr" }, ")."],
    verzeichnis: [...wer, " (", { feld: "jahr" }, "): ", { feld: "titel" }, ". Online unter: ", { feld: "url" }, " (Abruf: ", { feld: "abruf" }, ")."],
  };
}

export function faelle(heute: Date = new Date()): Fall[] {
  return [
    buch({
      id: "bienen", icon: "🐝", nachname: "Brandt", vorname: "Johanna",
      titel: "Das große Bienenbuch", untertitel: "Leben, Arbeit und Sprache der Honigbiene",
      ort: "Leipzig", verlag: "Wiesengrund Verlag", verlagLang: "Wiesengrund Verlag GmbH", jahr: "2021",
      seite: 45, kapitel: "Die Sprache der Bienen", kapitelNr: 3,
      lektorat: "Tobias Fink", bilder: "Mara Ost", isbn: "978-3-00-000145-2",
      absaetze: [
        "Kehrt eine Sammlerin mit Nektar in den Stock zurück, gibt sie nicht nur ihre Beute ab. Sie erzählt auch, wo sie die Blüten gefunden hat.",
        "Mit dem Schwänzeltanz zeigt eine Sammlerin den anderen Bienen, in welcher Richtung und wie weit entfernt eine Futterquelle liegt. Je länger sie dabei mit dem Hinterleib wackelt, desto weiter ist der Weg.",
        "Liegen die Blüten ganz in der Nähe, tanzt die Biene dagegen einfach im Kreis. Diesen Rundtanz verstehen die anderen als: »Sucht hier in der Gegend!«",
      ],
      zitat: "Mit dem Schwänzeltanz zeigt eine Sammlerin den anderen Bienen, in welcher Richtung und wie weit entfernt eine Futterquelle liegt.",
      frage: "Übernimm den Satz, der erklärt, was der Schwänzeltanz zeigt — und belege ihn.",
    }),
    web({
      id: "mond", icon: "🌙", site: "Sternenfenster", heim: "www.sternenfenster-wissen.de", pfad: "/mond/warum-der-mond-seine-form-aendert",
      kurzlink: "https://sfw.link/m7Q2",
      titel: "Warum der Mond seine Form ändert", unterzeile: "Vollmond, Halbmond, Neumond: Was hinter den Mondphasen steckt.", rubrik: "Mond & Planeten",
      autor: { vorname: "Lena", nachname: "Sommer" }, veroeffentlicht: "14.03.2025", aktualisiert: "02.09.2026",
      absaetze: [
        "Mal ist er kugelrund, mal nur eine schmale Sichel: Der Mond scheint jeden Abend anders auszusehen. Dabei ändert er seine Form gar nicht.",
        "Der Mond leuchtet nicht selbst, sondern wird von der Sonne angestrahlt. Wir sehen also immer nur den Teil, auf den gerade Sonnenlicht fällt.",
        "Weil der Mond in etwa einem Monat einmal um die Erde wandert, sehen wir die beleuchtete Seite jeden Tag aus einem anderen Winkel. So entstehen die Mondphasen.",
      ],
      zitat: "Der Mond leuchtet nicht selbst, sondern wird von der Sonne angestrahlt.",
      frage: "Übernimm den Satz, der erklärt, warum der Mond leuchtet — und belege die Website.",
      navigation: ["Start", "Sonne", "Mond & Planeten", "Sterne", "Mitmachen"],
      seitenleiste: ["Wie weit ist der Mond entfernt?", "Sternbilder im Herbst", "Was ist eine Sonnenfinsternis?"],
      werbung: "Teleskop-Woche: Alle Ferngläser 20 % günstiger!",
    }, heute),
    buch({
      id: "vulkane", icon: "🌋", nachname: "Hartmann", vorname: "Felix",
      titel: "Feuerberge", untertitel: "Wie Vulkane entstehen und ausbrechen",
      ort: "Hamburg", verlag: "Lavastein Verlag", verlagLang: "Lavastein Verlag KG", jahr: "2019",
      seite: 112, kapitel: "Wenn der Berg Feuer spuckt", kapitelNr: 7,
      lektorat: "Petra Kühn", bilder: "Ole Brandes", isbn: "978-3-00-000112-4",
      absaetze: [
        "Tief unter unseren Füßen ist es so heiß, dass Gestein schmilzt. Dieses flüssige Gestein heißt Magma.",
        "Weil Magma leichter ist als das feste Gestein um es herum, steigt es langsam nach oben. Oft sammelt es sich in einer Magmakammer unter dem Vulkan.",
        "Steigt das Magma bis an die Erdoberfläche, nennt man es Lava. Sie kann über tausend Grad heiß sein und erstarrt beim Abkühlen wieder zu Stein.",
      ],
      zitat: "Steigt das Magma bis an die Erdoberfläche, nennt man es Lava.",
      frage: "Übernimm den Satz, der erklärt, was Lava ist — und belege ihn.",
    }),
    web({
      id: "wasser", icon: "💧", site: "Wasserwelt", heim: "www.wasserwelt-online.de", pfad: "/wissen/kreislauf-des-wassers",
      kurzlink: "https://ww-o.de/k3",
      titel: "Der Kreislauf des Wassers einfach erklärt", unterzeile: "Vom Meer in die Wolken und wieder zurück.", rubrik: "Wissen",
      autor: { herausgeber: "Wasserwelt e. V.", redaktion: "Redaktion Wasserwelt" }, veroeffentlicht: "05.05.2024",
      absaetze: [
        "Wasser ist ständig unterwegs. Die Sonne erwärmt Meere, Seen und Flüsse, und ein Teil des Wassers verdunstet.",
        "Etwa 97 Prozent des Wassers auf der Erde sind salziges Meerwasser. Nur ein kleiner Rest ist Süßwasser, und davon ist das meiste in Gletschern gefroren.",
        "In der Luft kühlt der Wasserdampf ab, bildet Wolken und fällt als Regen oder Schnee zurück auf die Erde. Dann beginnt der Kreislauf von vorn.",
      ],
      zitat: "Etwa 97 Prozent des Wassers auf der Erde sind salziges Meerwasser.",
      frage: "Übernimm den Satz darüber, wie viel Wasser Meerwasser ist. Achtung: Hier steht keine Person als Autor.",
      navigation: ["Start", "Wissen", "Experimente", "Spenden", "Über uns"],
      seitenleiste: ["Warum ist das Meer salzig?", "Wasser sparen im Alltag", "Experiment: Wolke im Glas"],
      werbung: "Trinkflasche aus Edelstahl – jetzt im Shop!",
    }, heute),
    buch({
      id: "rom", icon: "🏛️", nachname: "Yilmaz", vorname: "Deniz",
      titel: "Alltag im alten Rom", untertitel: "Essen, Wohnen und Schule vor 2000 Jahren",
      ort: "Köln", verlag: "Säulenhalle Verlag", verlagLang: "Säulenhalle Verlag GmbH", jahr: "2022",
      seite: 78, kapitel: "Wohnen in der großen Stadt", kapitelNr: 4,
      lektorat: "Anne Vogt", bilder: "Luis Martens", isbn: "978-3-00-000078-3",
      absaetze: [
        "Nur reiche Familien konnten sich ein eigenes Haus mit Innenhof leisten. Für alle anderen war der Platz in Rom knapp.",
        "Viele Römerinnen und Römer wohnten in mehrstöckigen Mietshäusern, den sogenannten Insulae. Unten lagen Läden und Werkstätten, oben enge Wohnungen.",
        "Wasser gab es in diesen Häusern selten. Man holte es an öffentlichen Brunnen, und gekocht wurde oft gar nicht, sondern in Garküchen gegessen.",
      ],
      zitat: "Viele Römerinnen und Römer wohnten in mehrstöckigen Mietshäusern, den sogenannten Insulae.",
      frage: "Übernimm den Satz, der erklärt, wo viele Menschen in Rom wohnten — und belege ihn.",
    }),
    web({
      id: "hitze", icon: "🌡️", site: "Klimablick Magazin", heim: "www.klimablick-magazin.de", pfad: "/2026/06/hitzetage-in-der-stadt",
      kurzlink: "https://kbm.link/x7Q2",
      titel: "Hitzetage: Warum es in der Stadt heißer ist", unterzeile: "Beton, Asphalt und wenig Grün machen Städte zu Wärmeinseln.", rubrik: "Klima & Alltag",
      autor: { vorname: "Jonas", nachname: "Albrecht" }, veroeffentlicht: "21.06.2026",
      absaetze: [
        "An heißen Sommertagen ist es in der Innenstadt oft mehrere Grad wärmer als im Umland. Fachleute sprechen von einer städtischen Wärmeinsel.",
        "Asphalt und Beton speichern die Wärme des Tages und geben sie nachts wieder ab. Deshalb kühlt die Stadt auch nach Sonnenuntergang kaum ab.",
        "Bäume, Parks und begrünte Dächer helfen: Sie spenden Schatten und kühlen die Luft, weil Wasser aus ihren Blättern verdunstet.",
      ],
      zitat: "Asphalt und Beton speichern die Wärme des Tages und geben sie nachts wieder ab.",
      frage: "Übernimm den Satz, der erklärt, warum die Stadt nachts warm bleibt — und belege den Artikel.",
      navigation: ["Start", "Klima & Alltag", "Energie", "Mobilität", "Podcast"],
      seitenleiste: ["Fünf Tipps gegen Hitze im Klassenzimmer", "Warum Bäume die Stadt kühlen", "Interview: Leben auf dem Gründach"],
      werbung: "Ventilator-Sale: Nur heute 30 % Rabatt!",
    }, heute),
  ];
}
