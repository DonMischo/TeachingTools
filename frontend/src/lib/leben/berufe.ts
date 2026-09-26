/**
 * Berufe für den Start nach der 10. Klasse.
 *
 * Vergütungen: »Verzeichnis über Ausbildungsvergütungen in Thüringen«
 * (TMASGFF, Stand 03/2026) — jeweils die Stufe, die zum Ausbildungsstart im
 * August/September 2026 gilt. Liegt ein (veralteter) Tarif unter der
 * gesetzlichen Mindestausbildungsvergütung, zahlt der Betrieb die Mindest-
 * vergütung; `verguetung()` rechnet das aus und das Spiel erklärt es.
 * Öffentlicher Dienst: TVAöD-BT BBiG/Pflege ab 1.5.2026.
 *
 * Anforderungen: grob nach der Vorbildung der Azubis in diesen Berufen
 * (BIBB-Datenblätter) — `schnitt` ist der Notendurchschnitt, mit dem man gute
 * Chancen hat, `konkurrenz` 1 (Betriebe suchen händeringend) bis 5 (sehr
 * viele Bewerbungen je Stelle).
 *
 * Gehalt nach der Ausbildung: ungefähres Einstiegsgehalt einer Fachkraft in
 * Thüringen (brutto/Monat, Vollzeit) — Richtwert, orientiert am
 * Entgeltatlas der Bundesagentur, kein Tarifwert.
 */
import { mindestAzubi } from "./werte";

export type Fach =
  | "Deutsch" | "Mathematik" | "Englisch" | "Biologie" | "Chemie" | "Physik" | "Geschichte"
  | "Geografie" | "Sozialkunde" | "WRT" | "Informatik" | "Kunst" | "Musik" | "Sport" | "Ethik/Religion";

export const FAECHER: Fach[] = ["Deutsch", "Mathematik", "Englisch", "Biologie", "Chemie", "Physik",
  "Geschichte", "Geografie", "Sozialkunde", "WRT", "Informatik", "Kunst", "Musik", "Sport", "Ethik/Religion"];

export type Abschluss = "HSA" | "QHSA" | "RSA";
export const ABSCHLUESSE: Record<Abschluss, string> = {
  HSA: "Hauptschulabschluss",
  QHSA: "Qualifizierender Hauptschulabschluss",
  RSA: "Realschulabschluss",
};

export type Bereich =
  | "Handel" | "Logistik & Verkehr" | "Handwerk & Bau" | "Metall & Elektro" | "Lebensmittel & Gastro"
  | "Gesundheit & Soziales" | "Büro & Verwaltung" | "IT & Medien" | "Natur & Tiere" | "Service & Sicherheit";

export type Beruf = {
  id: string;
  name: string;
  bereich: Bereich;
  art: "ausbildung" | "schulisch" | "helfer" | "freiwillig";
  /** Dauer in Monaten (Helferjobs: 0 = unbefristet). */
  dauer: number;
  tarif: string;
  /** Tarifliche Vergütung je Ausbildungsjahr (Stand Ausbildungsstart 2026). */
  tarifVerguetung?: number[];
  /** Helfer/FSJ: Stundenlohn bzw. Monatsbetrag. */
  stundenlohn?: number;
  taschengeld?: number;
  gehaltNach: number;
  stundenWoche: number;
  /** Arbeitsbeginn (Stunde) an normalen Tagen. */
  beginn: number;
  schicht: boolean;
  wochenende: boolean;
  koerperlich: 0 | 1 | 2;
  abschluss: Abschluss;
  schnitt: number;
  faecher: Fach[];
  konkurrenz: 1 | 2 | 3 | 4 | 5;
  einstellungstest: boolean;
  /** Mindestalter bei Beginn (Jugendarbeitsschutz, Zeitarbeit, Nachtarbeit). */
  abAlter: number;
  uebernahme: number; // 0..1
  /** Tage mit Berufsschule je Woche (Blockunterricht vereinfacht). */
  berufsschule: number;
  betriebe: string[];
  text: string;
  /** Kosten, die der Beruf mit sich bringt (Arbeitsschuhe, Werkzeug …) zum Start. */
  startkosten?: { text: string; betrag: number }[];
  hinweis?: string;
};

const MUE = (s: string) => s; // lesbare Betriebsnamen, alle erfunden

export const BERUFE: Beruf[] = [
  // ─────────────────────────────────────────── Handel
  { id: "einzelhandel", name: "Kaufmann/-frau im Einzelhandel", bereich: "Handel", art: "ausbildung", dauer: 36,
    tarif: "Einzel- und Versandhandel TH (ab 09/2025)", tarifVerguetung: [1050, 1160, 1290], gehaltNach: 2550,
    stundenWoche: 38, beginn: 8, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Deutsch", "Mathematik"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.75,
    berufsschule: 1.5, betriebe: [MUE("Modehaus Anger 7"), MUE("Elektro-Markt Thüringen-Park"), MUE("Drogerie Löbertor")],
    text: "Kundschaft beraten, Kasse, Ware annehmen, Regale planen. Samstage sind Arbeitstage." },
  { id: "verkaeufer", name: "Verkäufer/in", bereich: "Handel", art: "ausbildung", dauer: 24,
    tarif: "Einzel- und Versandhandel TH (ab 09/2025)", tarifVerguetung: [1050, 1160], gehaltNach: 2350,
    stundenWoche: 38, beginn: 8, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.6,
    faecher: ["Deutsch", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Supermarkt am Johannesplatz"), MUE("Discounter Rieth"), MUE("Baumarkt Nord")],
    text: "Zwei Jahre, danach kann man ein drittes Jahr zum Einzelhandelskaufmann anhängen." },
  { id: "grosshandel", name: "Kaufmann/-frau im Groß- und Außenhandelsmanagement", bereich: "Handel", art: "ausbildung", dauer: 36,
    tarif: "Groß- und Außenhandel TH (ab 09/2025)", tarifVerguetung: [1222, 1277, 1369], gehaltNach: 3000,
    stundenWoche: 38, beginn: 7.5, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.5,
    faecher: ["Deutsch", "Mathematik", "Englisch"], konkurrenz: 4, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Thüringer Agrarhandel GmbH"), MUE("Bürobedarf Mitteldeutschland")],
    text: "Einkauf, Lager, Angebote schreiben, mit Lieferanten telefonieren — auch auf Englisch." },

  // ─────────────────────────────────────────── Logistik & Verkehr
  { id: "lagerlogistik", name: "Fachkraft für Lagerlogistik", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 36,
    tarif: "Logistik TH/SN (ab 01/2026, Erhöhung 10/2026)", tarifVerguetung: [1058, 1201, 1344], gehaltNach: 2650,
    stundenWoche: 39, beginn: 6, schicht: true, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.4,
    faecher: ["Mathematik", "Deutsch"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Logistikzentrum Erfurter Kreuz"), MUE("Güterverkehrszentrum Erfurt")],
    text: "Ware annehmen, einlagern, kommissionieren, Staplerschein inklusive. Erfurt ist Logistik-Drehkreuz.",
    startkosten: [{ text: "Sicherheitsschuhe S3 (Zuschuss vom Betrieb möglich)", betrag: 60 }] },
  { id: "fachlagerist", name: "Fachlagerist/in", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 24,
    tarif: "Logistik TH/SN (ab 01/2026)", tarifVerguetung: [1058, 1201], gehaltNach: 2450,
    stundenWoche: 39, beginn: 6, schicht: true, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Paketzentrum Stotternheim"), MUE("Getränke-Großhandel Nord")],
    text: "Die kürzere Lager-Ausbildung, gut auch mit Hauptschulabschluss." ,
    startkosten: [{ text: "Sicherheitsschuhe S3", betrag: 60 }] },
  { id: "berufskraftfahrer", name: "Berufskraftfahrer/in", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 36,
    tarif: "Logistik TH/SN (ab 01/2026)", tarifVerguetung: [1058, 1201, 1344], gehaltNach: 2900,
    stundenWoche: 40, beginn: 5, schicht: true, wochenende: false, koerperlich: 1, abschluss: "HSA", schnitt: 3.5,
    faecher: ["Mathematik", "Geografie"], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0.9,
    berufsschule: 1.5, betriebe: [MUE("Spedition Gera-Erfurt"), MUE("Thüringer Transport KG")],
    text: "Den Lkw-Führerschein (C/CE, rund 10.000 €) bezahlt der Betrieb. Fahren darf man ab 18 mit Begleitung.",
    hinweis: "Führerschein Klasse B machst du nebenbei — den zahlt meist nicht der Betrieb." },
  { id: "spedition", name: "Kaufmann/-frau für Spedition und Logistikdienstleistung", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 36,
    tarif: "Logistik TH/SN (ab 01/2026)", tarifVerguetung: [1058, 1201, 1344], gehaltNach: 2950,
    stundenWoche: 39, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.7,
    faecher: ["Deutsch", "Mathematik", "Englisch", "Geografie"], konkurrenz: 3, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Spedition Gera-Erfurt"), MUE("Cargo-Service Flughafen Erfurt")],
    text: "Transporte planen, Zoll, Frachtpapiere — Büro statt Lenkrad." },
  { id: "fahrbetrieb", name: "Fachkraft im Fahrbetrieb (Bus & Bahn)", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 36,
    tarif: "Omnibusgewerbe TH (ab 07/2026)", tarifVerguetung: [1250, 1300, 1350], gehaltNach: 2950,
    stundenWoche: 39, beginn: 5, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Deutsch", "Mathematik", "Geografie"], konkurrenz: 2, einstellungstest: true, abAlter: 16, uebernahme: 0.9,
    berufsschule: 1.5, betriebe: [MUE("Stadtverkehr Erfurt (fiktiv)"), MUE("Regionalbus Mittelthüringen")],
    text: "Bus fahren, Fahrgäste beraten, Werkstatt und Leitstelle kennenlernen. Den Busführerschein zahlt der Betrieb." },
  { id: "eisenbahner", name: "Eisenbahner/in im Betriebsdienst", bereich: "Logistik & Verkehr", art: "ausbildung", dauer: 36,
    tarif: "Bahn-Tarif (Richtwert, Annahme)", tarifVerguetung: [1236, 1307, 1378], gehaltNach: 3300,
    stundenWoche: 39, beginn: 5, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 2.8,
    faecher: ["Mathematik", "Physik", "Deutsch"], konkurrenz: 3, einstellungstest: true, abAlter: 16, uebernahme: 0.95,
    berufsschule: 1.5, betriebe: [MUE("Bahn-Ausbildungszentrum Erfurt Hbf")],
    text: "Lokführer/in oder Fahrdienstleiter/in. Schichtdienst rund um die Uhr, aber sehr sicherer Job." },

  // ─────────────────────────────────────────── Handwerk & Bau
  { id: "kfz", name: "Kfz-Mechatroniker/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 42,
    tarif: "Kfz-Handwerk TH (ab 08/2026)", tarifVerguetung: [1088, 1126, 1178, 1224], gehaltNach: 2750,
    stundenWoche: 38, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "RSA", schnitt: 2.8,
    faecher: ["Mathematik", "Physik"], konkurrenz: 4, einstellungstest: true, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Autohaus Erfurt-Ost"), MUE("Kfz-Meisterbetrieb Hochheim"), MUE("Reifen & Service Gispersleben")],
    text: "Einer der beliebtesten Handwerksberufe — Elektronik, Diagnose, E-Autos.",
    startkosten: [{ text: "Arbeitsschuhe", betrag: 60 }] },
  { id: "elektro-geb", name: "Elektroniker/in für Energie- und Gebäudetechnik", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 42,
    tarif: "Elektrohandwerk SN/TH (Stand 08/2019 — unter Mindestvergütung!)", tarifVerguetung: [800, 850, 900, 950], gehaltNach: 2800,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 1, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Mathematik", "Physik"], konkurrenz: 2, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Elektro Brühl & Söhne"), MUE("Gebäudetechnik Daberstedt")],
    text: "Leitungen, Photovoltaik, Smart Home. Fachkräfte werden überall gesucht.",
    hinweis: "Der Tarif ist seit 2019 nicht erhöht — ab dem 2. Jahr gilt deshalb die gesetzliche Mindestvergütung." },
  { id: "shk", name: "Anlagenmechaniker/in für Sanitär-, Heizungs- und Klimatechnik", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 42,
    tarif: "SHK-Handwerk TH (ab 08/2026)", tarifVerguetung: [950, 1000, 1050, 1100], gehaltNach: 2900,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.4,
    faecher: ["Mathematik", "Physik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Heizung & Bad Melchendorf"), MUE("Wärmepumpen-Service Thüringen")],
    text: "Bäder, Heizungen, Wärmepumpen. Betriebe suchen dringend — Chancen auch mit mittleren Noten.",
    startkosten: [{ text: "Arbeitsschuhe", betrag: 60 }] },
  { id: "tischler", name: "Tischler/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Tischlerhandwerk NBL (Stand 01/2024 — teils unter Mindestvergütung)", tarifVerguetung: [659.5, 817.78, 1002.44], gehaltNach: 2500,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Mathematik", "Kunst", "Physik"], konkurrenz: 3, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Holzwerkstatt Krämpfervorstadt"), MUE("Möbelbau Egstedt")],
    text: "Möbel und Innenausbau, viel Handarbeit und CNC." },
  { id: "maler", name: "Maler/in und Lackierer/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Maler- und Lackiererhandwerk (ab 08/2026)", tarifVerguetung: [900, 985, 1150], gehaltNach: 2500,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Kunst", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Malerbetrieb Farbenfroh"), MUE("Fassaden-Team Ilversgehofen")],
    text: "Wände, Fassaden, Lacke. Draußen und drinnen, viel Bewegung." },
  { id: "dachdecker", name: "Dachdecker/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Dachdeckerhandwerk (ab 10/2025, Erhöhung 10/2026)", tarifVerguetung: [1050, 1200, 1460], gehaltNach: 2900,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Mathematik", "Physik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Dachbau Steigerwald")],
    text: "Schwindelfreiheit Pflicht. Im Winter gibt es Saison-Kurzarbeitergeld." },
  { id: "maurer", name: "Maurer/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Baugewerbe gewerblich NBL (ab 04/2026)", tarifVerguetung: [1122, 1351, 1610], gehaltNach: 3000,
    stundenWoche: 40, beginn: 6.5, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Bauunternehmung Mittelthüringen"), MUE("Hochbau Bischleben")],
    text: "Bau zahlt schon in der Ausbildung gut. Körperlich hart, früher Feierabend.",
    startkosten: [{ text: "Arbeitsschuhe und Handschuhe", betrag: 70 }] },
  { id: "strassenbauer", name: "Straßenbauer/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Baugewerbe gewerblich NBL (ab 04/2026)", tarifVerguetung: [1122, 1351, 1610], gehaltNach: 3000,
    stundenWoche: 40, beginn: 6.5, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.9,
    faecher: ["Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Tiefbau Erfurt-Süd")],
    text: "Straßen, Gehwege, Plätze — bei jedem Wetter draußen." },
  { id: "galabau", name: "Gärtner/in Garten- und Landschaftsbau", bereich: "Natur & Tiere", art: "ausbildung", dauer: 36,
    tarif: "GaLaBau (ab 07/2026)", tarifVerguetung: [1140, 1270, 1390], gehaltNach: 2600,
    stundenWoche: 40, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.5,
    faecher: ["Biologie", "Mathematik"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Grünbau egapark-Nähe"), MUE("Landschaftsbau Gera-Aue")],
    text: "Gärten anlegen, Pflaster, Pflanzen. Erfurt ist Blumenstadt." },
  { id: "friseur", name: "Friseur/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Friseurhandwerk SN/TH (Stand 08/2019 — weit unter Mindestvergütung!)", tarifVerguetung: [325, 415, 465], gehaltNach: 2150,
    stundenWoche: 38, beginn: 9, schicht: false, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.5,
    faecher: ["Deutsch", "Kunst"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Salon Schnittpunkt"), MUE("Haarwerk am Domplatz")],
    text: "Kreativ, viel Kundenkontakt, samstags voll. Später oft nahe am Mindestlohn — Trinkgeld hilft.",
    hinweis: "Der Tarif ist uralt — der Salon muss mindestens die gesetzliche Mindestvergütung zahlen.",
    startkosten: [{ text: "Scheren- und Kamm-Set", betrag: 120 }] },
  { id: "bruecken-schornstein", name: "Schornsteinfeger/in", bereich: "Handwerk & Bau", art: "ausbildung", dauer: 36,
    tarif: "Schornsteinfegerhandwerk (ab 01/2024)", tarifVerguetung: [900, 1000, 1100], gehaltNach: 2800,
    stundenWoche: 40, beginn: 7, schicht: false, wochenende: false, koerperlich: 2, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Mathematik", "Physik", "Chemie"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Bezirksschornsteinfeger Erfurt-Nord")],
    text: "Heizungen messen, Energieberatung, Dächer. Glücksbringer inklusive." },

  // ─────────────────────────────────────────── Metall & Elektro (Industrie)
  { id: "industriemechaniker", name: "Industriemechaniker/in", bereich: "Metall & Elektro", art: "ausbildung", dauer: 42,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337, 1401, 1466], gehaltNach: 3400,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "RSA", schnitt: 2.6,
    faecher: ["Mathematik", "Physik"], konkurrenz: 4, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Maschinenbau Erfurt-Nord AG"), MUE("Präzisionsteile Arnstadt")],
    text: "Maschinen bauen, warten, reparieren. Industrie-Tarif = eine der besten Ausbildungsvergütungen." },
  { id: "mechatroniker", name: "Mechatroniker/in", bereich: "Metall & Elektro", art: "ausbildung", dauer: 42,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337, 1401, 1466], gehaltNach: 3500,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "RSA", schnitt: 2.3,
    faecher: ["Mathematik", "Physik", "Informatik"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Solartechnik Erfurt-Südost"), MUE("Maschinenbau Erfurt-Nord AG")],
    text: "Mechanik + Elektronik + Programmierung. Sehr gefragt, viele Bewerbungen." },
  { id: "elektro-betrieb", name: "Elektroniker/in für Betriebstechnik", bereich: "Metall & Elektro", art: "ausbildung", dauer: 42,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337, 1401, 1466], gehaltNach: 3450,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "RSA", schnitt: 2.5,
    faecher: ["Mathematik", "Physik"], konkurrenz: 4, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Mikroelektronik Erfurt-Südost")],
    text: "Anlagen in der Fabrik elektrisch am Laufen halten." },
  { id: "zerspanung", name: "Zerspanungsmechaniker/in", bereich: "Metall & Elektro", art: "ausbildung", dauer: 42,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337, 1401, 1466], gehaltNach: 3200,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "HSA", schnitt: 3.0,
    faecher: ["Mathematik", "Physik"], konkurrenz: 3, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Präzisionsteile Arnstadt"), MUE("CNC-Technik Kerspleben")],
    text: "CNC-Maschinen programmieren und fräsen — auf den Hundertstel genau." },
  { id: "maschinenfuehrer", name: "Maschinen- und Anlagenführer/in", bereich: "Metall & Elektro", art: "ausbildung", dauer: 24,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337], gehaltNach: 2900,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "HSA", schnitt: 3.4,
    faecher: ["Mathematik"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Verpackungswerk Erfurt"), MUE("Maschinenbau Erfurt-Nord AG")],
    text: "Zwei Jahre, Schichtbetrieb, Tarif der Metallindustrie." },
  { id: "chemikant", name: "Chemikant/in", bereich: "Metall & Elektro", art: "ausbildung", dauer: 42,
    tarif: "Chemische Industrie NBL (ab 04/2025)", tarifVerguetung: [1192, 1264, 1279, 1344], gehaltNach: 3500,
    stundenWoche: 39, beginn: 6, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 2.5,
    faecher: ["Chemie", "Mathematik", "Physik"], konkurrenz: 3, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Chemiepark Mittelthüringen")],
    text: "Produktionsanlagen steuern. Schicht, auch nachts und am Wochenende (ab 18)." },

  // ─────────────────────────────────────────── Lebensmittel & Gastro
  { id: "baecker", name: "Bäcker/in", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Bäckerhandwerk (ab 01/2025)", tarifVerguetung: [930, 1015, 1155], gehaltNach: 2400,
    stundenWoche: 40, beginn: 3, schicht: false, wochenende: true, koerperlich: 2, abschluss: "HSA", schnitt: 3.9,
    faecher: ["Mathematik", "Biologie"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Backstube Kaufmannskirche"), MUE("Landbäckerei Mittelhausen")],
    text: "Arbeitsbeginn mitten in der Nacht (unter 18: frühestens 5 Uhr). Nachmittags frei.",
    hinweis: "Jugendarbeitsschutz: unter 18 darf man in Bäckereien erst ab 5 Uhr (ab 17: 4 Uhr) arbeiten." },
  { id: "fachverkauf-baecker", name: "Fachverkäufer/in im Lebensmittelhandwerk (Bäckerei)", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Bäckerhandwerk (ab 01/2025)", tarifVerguetung: [930, 1015, 1155], gehaltNach: 2200,
    stundenWoche: 39, beginn: 5.5, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Deutsch", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Backstube Kaufmannskirche"), MUE("Café Krämerbrücke")],
    text: "Verkauf, Beratung, Snacks und Kaffee. Früh anfangen, oft auch sonntags." },
  { id: "fleischer", name: "Fleischer/in", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Tarifempfehlung Fleischerhandwerk TH 2018 — unter Mindestvergütung", tarifVerguetung: [500, 550, 600], gehaltNach: 2500,
    stundenWoche: 40, beginn: 6, schicht: false, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.9,
    faecher: ["Biologie", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.9,
    berufsschule: 1.5, betriebe: [MUE("Fleischerei Rostbratwurst & Co.")],
    text: "Thüringer Rostbratwurst aus eigener Herstellung. Betriebe suchen verzweifelt." },
  { id: "koch", name: "Koch/Köchin", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Hotel- und Gaststättengewerbe TH (ab 08/2026)", tarifVerguetung: [1055, 1155, 1255], gehaltNach: 2500,
    stundenWoche: 39, beginn: 10, schicht: true, wochenende: true, koerperlich: 2, abschluss: "HSA", schnitt: 3.7,
    faecher: ["Biologie", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Restaurant Zum Domblick"), MUE("Hotel am Petersberg"), MUE("Kantine Messe Erfurt")],
    text: "Stress am Pass, Abende und Wochenenden. Kochen lernt man fürs Leben.",
    startkosten: [{ text: "Messer-Set und Kochjacken", betrag: 150 }] },
  { id: "hotelfach", name: "Hotelfachmann/-frau", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Hotel- und Gaststättengewerbe TH (ab 08/2026)", tarifVerguetung: [1055, 1155, 1255], gehaltNach: 2400,
    stundenWoche: 39, beginn: 7, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Deutsch", "Englisch"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Hotel am Petersberg"), MUE("Kongresshotel Messe")],
    text: "Rezeption, Service, Housekeeping. Englisch hilft." },
  { id: "gastro", name: "Fachkraft für Gastronomie", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 24,
    tarif: "Hotel- und Gaststättengewerbe TH (ab 08/2026)", tarifVerguetung: [1055, 1155], gehaltNach: 2300,
    stundenWoche: 39, beginn: 11, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.8,
    faecher: ["Deutsch", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Brauhaus am Fischmarkt"), MUE("Biergarten Petersberg")],
    text: "Zwei Jahre Service und Gastgeber sein. Trinkgeld gibt es obendrauf." },
  { id: "systemgastro", name: "Fachmann/-frau für Systemgastronomie", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Systemgastronomie BdS (ab 01/2026, Erhöhung 10/2026)", tarifVerguetung: [1061, 1185, 1323], gehaltNach: 2650,
    stundenWoche: 39, beginn: 10, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.6,
    faecher: ["Mathematik", "Deutsch"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.75,
    berufsschule: 1.5, betriebe: [MUE("Burger-Kette Thüringen-Park"), MUE("Pizza-Kette Anger")],
    text: "Schichtführung in Ketten-Restaurants — schnell Verantwortung." },
  { id: "konditor", name: "Konditor/in", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Tarifempfehlung Konditoren SN/TH 2016 — unter Mindestvergütung", tarifVerguetung: [350, 400, 450], gehaltNach: 2200,
    stundenWoche: 40, beginn: 6, schicht: false, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.3,
    faecher: ["Kunst", "Mathematik", "Biologie"], konkurrenz: 3, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Café Krämerbrücke"), MUE("Confiserie Domstufen")],
    text: "Torten, Pralinen, Kunstwerke aus Zucker." },
  { id: "brauer", name: "Brauer/in und Mälzer/in", bereich: "Lebensmittel & Gastro", art: "ausbildung", dauer: 36,
    tarif: "Brauwirtschaft TH/SN (ab 08/2025, Erhöhung 12/2026)", tarifVerguetung: [1118, 1253, 1384], gehaltNach: 2950,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "RSA", schnitt: 2.8,
    faecher: ["Chemie", "Biologie", "Mathematik"], konkurrenz: 3, einstellungstest: false, abAlter: 16, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Brauerei am Steigerwald")],
    text: "Bier und Malz herstellen, Technik und Labor. Probieren erst ab 16 — und in Maßen." },

  // ─────────────────────────────────────────── Gesundheit & Soziales
  { id: "pflege", name: "Pflegefachmann/-frau", bereich: "Gesundheit & Soziales", art: "ausbildung", dauer: 36,
    tarif: "TVAöD-BT Pflege (ab 05/2026)", tarifVerguetung: [1490.69, 1552.07, 1653.38], gehaltNach: 3700,
    stundenWoche: 39, beginn: 6, schicht: true, wochenende: true, koerperlich: 2, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Biologie", "Deutsch", "Chemie"], konkurrenz: 2, einstellungstest: false, abAlter: 16, uebernahme: 0.95,
    berufsschule: 2, betriebe: [MUE("Klinikum Erfurt (fiktiv)"), MUE("Pflegeheim am Nordpark")],
    text: "Menschen versorgen, Verantwortung, Schichtdienst. Beste Vergütung im Sozialbereich, sicherer Job." },
  { id: "mfa", name: "Medizinische/r Fachangestellte/r", bereich: "Gesundheit & Soziales", art: "ausbildung", dauer: 36,
    tarif: "Arzthelfer/innen (ab 01/2026)", tarifVerguetung: [1050, 1150, 1250], gehaltNach: 2500,
    stundenWoche: 38, beginn: 7.5, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.7,
    faecher: ["Biologie", "Deutsch"], konkurrenz: 3, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Hausarztpraxis Dr. Linde"), MUE("Kinderarztpraxis Rieth")],
    text: "Empfang, Blut abnehmen, Abrechnung mit den Kassen." },
  { id: "zfa", name: "Zahnmedizinische/r Fachangestellte/r", bereich: "Gesundheit & Soziales", art: "ausbildung", dauer: 36,
    tarif: "Tarifempfehlung ZFA (Richtwert, Annahme)", tarifVerguetung: [1000, 1100, 1200], gehaltNach: 2400,
    stundenWoche: 38, beginn: 7.5, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.9,
    faecher: ["Biologie", "Chemie"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Zahnarztpraxis Anger"), MUE("Kieferorthopädie Löbervorstadt")],
    text: "Assistenz am Behandlungsstuhl, Hygiene, Röntgen." },
  { id: "pka", name: "Pharmazeutisch-kaufmännische/r Angestellte/r", bereich: "Gesundheit & Soziales", art: "ausbildung", dauer: 36,
    tarif: "Apotheken (Stand 01/2023 — teils unter Mindestvergütung)", tarifVerguetung: [793, 850, 906], gehaltNach: 2400,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: true, koerperlich: 0, abschluss: "RSA", schnitt: 3.0,
    faecher: ["Chemie", "Biologie", "Mathematik"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Apotheke am Fischmarkt")],
    text: "Waren, Bestellungen, Kosmetik-Beratung in der Apotheke." },
  { id: "sozialassistenz", name: "Sozialassistent/in (schulisch)", bereich: "Gesundheit & Soziales", art: "schulisch", dauer: 24,
    tarif: "Schulische Ausbildung — keine Vergütung, ggf. Schüler-BAföG", tarifVerguetung: [0, 0], gehaltNach: 0,
    stundenWoche: 32, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 3.2,
    faecher: ["Deutsch", "Sozialkunde", "Ethik/Religion"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0,
    berufsschule: 5, betriebe: [MUE("Berufsfachschule Sozialwesen Erfurt")],
    text: "Zwei Jahre Schule mit Praktika in Kita und Pflege — der Weg zur Erzieher-Ausbildung. Kein Lohn!",
    hinweis: "Kein Gehalt: Schüler-BAföG gibt es nur, wenn man nicht bei den Eltern wohnen kann. Kindergeld läuft weiter." },

  // ─────────────────────────────────────────── Büro & Verwaltung
  { id: "buero", name: "Kaufmann/-frau für Büromanagement", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 36,
    tarif: "nicht tarifgebundener Mittelstand (Richtwert)", tarifVerguetung: [900, 1000, 1100], gehaltNach: 2700,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.5,
    faecher: ["Deutsch", "Mathematik", "Englisch"], konkurrenz: 5, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Immobilienverwaltung Erfurt-Mitte"), MUE("Ingenieurbüro Brühl")],
    text: "Einer der beliebtesten Berufe überhaupt — viele Bewerbungen, gute Noten in Deutsch zählen." },
  { id: "verwaltung", name: "Verwaltungsfachangestellte/r (Stadtverwaltung)", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 36,
    tarif: "TVAöD-BT BBiG (ab 05/2026)", tarifVerguetung: [1368.26, 1418.2, 1464.02], gehaltNach: 3300,
    stundenWoche: 39, beginn: 7.5, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.3,
    faecher: ["Deutsch", "Mathematik", "Sozialkunde"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.9,
    berufsschule: 1.5, betriebe: [MUE("Stadtverwaltung Erfurt (fiktive Stelle)"), MUE("Landratsamt Sömmerda (fiktive Stelle)")],
    text: "Bürgeramt, Wohngeldstelle, Standesamt — du lernst die andere Seite der Anträge kennen." },
  { id: "bank", name: "Bankkaufmann/-frau", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 30,
    tarif: "Privates Bankgewerbe (ab 07/2026)", tarifVerguetung: [1400, 1470, 1550], gehaltNach: 3400,
    stundenWoche: 39, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.0,
    faecher: ["Mathematik", "Deutsch", "Englisch", "WRT"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Mitteldeutsche Bank Filiale Anger"), MUE("Genossenschaftsbank Erfurt")],
    text: "Viele Bewerbungen kommen vom Gymnasium. Mit sehr gutem Realschulabschluss trotzdem machbar." },
  { id: "industriekaufmann", name: "Industriekaufmann/-frau", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 36,
    tarif: "Metall- und Elektroindustrie Thüringen (ab 04/2026)", tarifVerguetung: [1272, 1337, 1401], gehaltNach: 3300,
    stundenWoche: 38, beginn: 7.5, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.2,
    faecher: ["Mathematik", "Deutsch", "Englisch", "WRT"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Maschinenbau Erfurt-Nord AG"), MUE("Solartechnik Erfurt-Südost")],
    text: "Einkauf, Personal, Buchhaltung, Vertrieb — alle Abteilungen einmal durch." },
  { id: "steuerfach", name: "Steuerfachangestellte/r", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 36,
    tarif: "Empfehlung Steuerberaterkammer (Richtwert)", tarifVerguetung: [1000, 1100, 1200], gehaltNach: 2900,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.4,
    faecher: ["Mathematik", "Deutsch", "WRT"], konkurrenz: 3, einstellungstest: false, abAlter: 15, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Steuerkanzlei Wenigemarkt")],
    text: "Lohnabrechnungen, Steuererklärungen, Buchhaltung — genau das, was du in diesem Spiel lernst." },
  { id: "versicherung", name: "Kaufmann/-frau für Versicherungen und Finanzanlagen", bereich: "Büro & Verwaltung", art: "ausbildung", dauer: 36,
    tarif: "Privates Versicherungsgewerbe (ab 06/2021)", tarifVerguetung: [1070, 1145, 1230], gehaltNach: 3300,
    stundenWoche: 38, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.5,
    faecher: ["Mathematik", "Deutsch", "WRT"], konkurrenz: 3, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("Versicherungsagentur Löbertor")],
    text: "Beraten, verkaufen, Schäden regulieren. Oft mit Provision nach der Ausbildung." },

  // ─────────────────────────────────────────── IT & Medien
  { id: "fisi", name: "Fachinformatiker/in für Systemintegration", bereich: "IT & Medien", art: "ausbildung", dauer: 36,
    tarif: "nicht tarifgebundenes IT-Systemhaus (Richtwert)", tarifVerguetung: [1000, 1100, 1200], gehaltNach: 3200,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.0,
    faecher: ["Mathematik", "Informatik", "Englisch"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("IT-Systemhaus Erfurt-Süd"), MUE("Rechenzentrum Thüringen (fiktiv)")],
    text: "Netzwerke, Server, Support. Sehr beliebt — viele Bewerbungen mit Abitur." },
  { id: "fiae", name: "Fachinformatiker/in für Anwendungsentwicklung", bereich: "IT & Medien", art: "ausbildung", dauer: 36,
    tarif: "nicht tarifgebundene Softwarefirma (Richtwert)", tarifVerguetung: [1000, 1100, 1200], gehaltNach: 3400,
    stundenWoche: 40, beginn: 9, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 1.8,
    faecher: ["Mathematik", "Informatik", "Englisch"], konkurrenz: 5, einstellungstest: true, abAlter: 15, uebernahme: 0.8,
    berufsschule: 1.5, betriebe: [MUE("App-Agentur Krämpfertor")],
    text: "Programmieren. Ohne Programmier-Hobby und gute Mathe-Note schwer zu bekommen." },
  { id: "mediengestalter", name: "Mediengestalter/in Digital und Print", bereich: "IT & Medien", art: "ausbildung", dauer: 36,
    tarif: "nicht tarifgebundene Agentur (Richtwert)", tarifVerguetung: [900, 1000, 1100], gehaltNach: 2600,
    stundenWoche: 40, beginn: 9, schicht: false, wochenende: false, koerperlich: 0, abschluss: "RSA", schnitt: 2.3,
    faecher: ["Kunst", "Deutsch", "Informatik"], konkurrenz: 5, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Werbeagentur Domplatz"), MUE("Druckerei Nordhäuser Straße")],
    text: "Layouts, Social Media, Webseiten. Mappe mit eigenen Arbeiten ist Pflicht." },

  // ─────────────────────────────────────────── Natur & Tiere
  { id: "landwirt", name: "Landwirt/in", bereich: "Natur & Tiere", art: "ausbildung", dauer: 36,
    tarif: "Land- und Forstwirtschaft TH (ab 01/2025)", tarifVerguetung: [906, 998, 1078], gehaltNach: 2500,
    stundenWoche: 40, beginn: 6, schicht: false, wochenende: true, koerperlich: 2, abschluss: "HSA", schnitt: 3.5,
    faecher: ["Biologie", "Mathematik", "Physik"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.7,
    berufsschule: 1.5, betriebe: [MUE("Agrargenossenschaft Walschleben"), MUE("Milchhof Kerspleben")],
    text: "Tiere, Traktoren, Felder. Pendeln aufs Land nötig." },
  { id: "tfa", name: "Tiermedizinische/r Fachangestellte/r", bereich: "Natur & Tiere", art: "ausbildung", dauer: 36,
    tarif: "Tierarzthelfer/innen (ab 10/2022 — teils unter Mindestvergütung)", tarifVerguetung: [790, 870, 950], gehaltNach: 2200,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 2.6,
    faecher: ["Biologie", "Chemie"], konkurrenz: 4, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Tierarztpraxis am Zoopark")],
    text: "Traumberuf vieler — deshalb viele Bewerbungen und später eher wenig Gehalt." },
  { id: "florist", name: "Florist/in", bereich: "Natur & Tiere", art: "ausbildung", dauer: 36,
    tarif: "Floristgewerbe NBL (Stand 01/2020 — unter Mindestvergütung)", tarifVerguetung: [425, 465, 525], gehaltNach: 2150,
    stundenWoche: 40, beginn: 8, schicht: false, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 3.3,
    faecher: ["Kunst", "Biologie"], konkurrenz: 2, einstellungstest: false, abAlter: 15, uebernahme: 0.6,
    berufsschule: 1.5, betriebe: [MUE("Blumen am Anger")],
    text: "Sträuße, Gestecke, Hochzeiten. Valentinstag und Muttertag = Ausnahmezustand." },

  // ─────────────────────────────────────────── Service & Sicherheit
  { id: "sicherheit", name: "Fachkraft für Schutz und Sicherheit", bereich: "Service & Sicherheit", art: "ausbildung", dauer: 36,
    tarif: "Wach- und Sicherheitsgewerbe TH (ab 01/2026)", tarifVerguetung: [1150, 1195, 1295], gehaltNach: 2700,
    stundenWoche: 40, beginn: 6, schicht: true, wochenende: true, koerperlich: 1, abschluss: "RSA", schnitt: 3.2,
    faecher: ["Deutsch", "Sport", "Sozialkunde"], konkurrenz: 2, einstellungstest: false, abAlter: 16, uebernahme: 0.85,
    berufsschule: 1.5, betriebe: [MUE("Sicherheitsdienst Mitteldeutschland")],
    text: "Objektschutz, Veranstaltungen, Leitstelle. Nachtschichten erst ab 18." },
  { id: "gebaeudereiniger", name: "Gebäudereiniger/in", bereich: "Service & Sicherheit", art: "ausbildung", dauer: 36,
    tarif: "Gebäudereinigerhandwerk (ab 01/2025)", tarifVerguetung: [1000, 1150, 1300], gehaltNach: 2500,
    stundenWoche: 39, beginn: 6, schicht: true, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 3.9,
    faecher: ["Chemie", "Mathematik"], konkurrenz: 1, einstellungstest: false, abAlter: 15, uebernahme: 0.9,
    berufsschule: 1.5, betriebe: [MUE("Glas- und Gebäudereinigung Erfurt")],
    text: "Glasfassaden, Reinraum, Desinfektion — mehr Technik als man denkt." },

  // ─────────────────────────────────────────── Direkt arbeiten (ungelernt)
  { id: "helfer-logistik", name: "Kommissionierer/in im Logistikzentrum (Zeitarbeit)", bereich: "Logistik & Verkehr", art: "helfer", dauer: 0,
    tarif: "Zeitarbeit, Entgeltgruppe 1 (Richtwert 2026)", stundenlohn: 14.96, gehaltNach: 0,
    stundenWoche: 40, beginn: 6, schicht: true, wochenende: true, koerperlich: 2, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 18, uebernahme: 0.3,
    berufsschule: 0, betriebe: [MUE("Personaldienst Erfurt-Nord")],
    text: "Sofort Geld, Schicht und Scanner. Ohne Abschluss bleibt der Lohn aber lange unten.",
    hinweis: "Zeitarbeit und Schicht meist erst ab 18. Befristet — nach der Hochsaison kann Schluss sein." },
  { id: "helfer-produktion", name: "Produktionshelfer/in", bereich: "Metall & Elektro", art: "helfer", dauer: 0,
    tarif: "Mindestlohn + Schichtzulage (Richtwert)", stundenlohn: 14.3, gehaltNach: 0,
    stundenWoche: 40, beginn: 6, schicht: true, wochenende: false, koerperlich: 1, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0.3,
    berufsschule: 0, betriebe: [MUE("Verpackungswerk Erfurt")],
    text: "Am Band, einfache Tätigkeiten. Monoton, aber planbar." },
  { id: "helfer-handel", name: "Verkaufshilfe / Regalauffüller/in", bereich: "Handel", art: "helfer", dauer: 0,
    tarif: "Mindestlohn", stundenlohn: 13.9, gehaltNach: 0,
    stundenWoche: 38, beginn: 6, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0.3,
    berufsschule: 0, betriebe: [MUE("Discounter Rieth")],
    text: "Ware einräumen, Kasse aushelfen. Der Mindestlohn steigt jedes Jahr ein Stück." },
  { id: "helfer-gastro", name: "Servicekraft / Küchenhilfe", bereich: "Lebensmittel & Gastro", art: "helfer", dauer: 0,
    tarif: "Mindestlohn + Trinkgeld", stundenlohn: 13.9, gehaltNach: 0,
    stundenWoche: 38, beginn: 11, schicht: true, wochenende: true, koerperlich: 1, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0.3,
    berufsschule: 0, betriebe: [MUE("Brauhaus am Fischmarkt"), MUE("Burger-Kette Thüringen-Park")],
    text: "Tellertragen und Trinkgeld. Abende und Wochenenden weg." },
  { id: "helfer-reinigung", name: "Reinigungskraft", bereich: "Service & Sicherheit", art: "helfer", dauer: 0,
    tarif: "Branchenmindestlohn Gebäudereinigung (Richtwert)", stundenlohn: 14.25, gehaltNach: 0,
    stundenWoche: 35, beginn: 5, schicht: true, wochenende: false, koerperlich: 2, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0.3,
    berufsschule: 0, betriebe: [MUE("Glas- und Gebäudereinigung Erfurt")],
    text: "Büros vor Arbeitsbeginn putzen — sehr früh, dafür früh frei." },
  { id: "helfer-lieferdienst", name: "Fahrradkurier/in beim Lieferdienst", bereich: "Logistik & Verkehr", art: "helfer", dauer: 0,
    tarif: "Mindestlohn + Trinkgeld", stundenlohn: 13.9, gehaltNach: 0,
    stundenWoche: 30, beginn: 11, schicht: true, wochenende: true, koerperlich: 2, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 18, uebernahme: 0.2,
    berufsschule: 0, betriebe: [MUE("Essen-Lieferdienst (fiktiv)")],
    text: "Eigenes Fahrrad und Handy nötig. Regen, Kälte, Trinkgeld." },
  { id: "fsj", name: "Freiwilliges Soziales Jahr (FSJ)", bereich: "Gesundheit & Soziales", art: "freiwillig", dauer: 12,
    tarif: "Taschengeld + Verpflegungszuschuss (Richtwert)", taschengeld: 450, gehaltNach: 0,
    stundenWoche: 39, beginn: 7, schicht: false, wochenende: false, koerperlich: 1, abschluss: "HSA", schnitt: 5,
    faecher: [], konkurrenz: 1, einstellungstest: false, abAlter: 16, uebernahme: 0,
    berufsschule: 0, betriebe: [MUE("Kita Sonnenschein"), MUE("Klinikum Erfurt (fiktiv)"), MUE("Sportverein Erfurt-Nord")],
    text: "Ein Jahr in Kita, Klinik oder Verein ausprobieren. Kindergeld läuft weiter, Sozialversicherung zahlt die Einsatzstelle.",
    hinweis: "Danach musst du dich wieder bewerben — ein FSJ macht jede Bewerbung besser." },
];

export const BERUF = new Map(BERUFE.map((b) => [b.id, b]));

/**
 * Vergütung im Ausbildungsjahr (1-basiert) in einem Kalenderjahr.
 * Nie unter der Mindestausbildungsvergütung (außer schulisch/freiwillig).
 * Nach dem ersten Jahr: Tarife wachsen um eine angenommene Tarifsteigerung.
 */
export function verguetung(b: Beruf, ausbildungsjahr: number, kalenderjahr: number): { betrag: number; mindest: boolean } {
  if (b.art === "schulisch") return { betrag: 0, mindest: false };
  if (b.art === "freiwillig") return { betrag: b.taschengeld ?? 0, mindest: false };
  const liste = b.tarifVerguetung ?? [];
  const idx = Math.min(liste.length - 1, Math.max(0, ausbildungsjahr - 1));
  // Annahme: Tarife steigen ab 2027 um 3 % im Jahr.
  const tarif = Math.round((liste[idx] ?? 0) * Math.pow(1.03, Math.max(0, kalenderjahr - 2026)) * 100) / 100;
  const min = mindestAzubi(kalenderjahr, ausbildungsjahr);
  return tarif >= min ? { betrag: tarif, mindest: false } : { betrag: min, mindest: true };
}

/** Monatsbrutto eines Helferjobs (Stundenlohn × Wochenstunden × 4,33), wächst mit dem Mindestlohn. */
export function helferBrutto(b: Beruf, mindestlohn: number): number {
  const lohn = Math.max(b.stundenlohn ?? 0, mindestlohn + ((b.stundenlohn ?? 0) - 13.9));
  return Math.round(lohn * b.stundenWoche * 4.33 * 100) / 100;
}
