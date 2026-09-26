/**
 * Zufallsereignisse — das, was im echten Leben dazwischenkommt.
 *
 * `pMonat` ist die Wahrscheinlichkeit, dass das Ereignis in einem Monat
 * eintritt (grob geschätzt aus Alltagserfahrung und Statistiken: Erwachsene
 * haben 2–3 Erkältungen im Jahr, etwa jedes vierte Smartphone-Display geht
 * im Jahr kaputt, Fahrraddiebstahl ist in Städten häufig …). Täglich wird mit
 * pMonat/30 gewürfelt. `wann` begrenzt auf passende Situationen, `abstand`
 * verhindert Wiederholung zu kurz hintereinander.
 *
 * Jedes Ereignis hat Optionen; die Wahl bucht Geld, ändert Bedürfnisse und
 * schreibt eine Lehre ins Protokoll.
 */
import { BERUF } from "./berufe";
import { alter, begrenzen, brief, buchen, effekt, ganz, hatMoebel, log, r2, uid, zufall, zwischen, volljaehrig, de } from "./kern";
import { abmahnungPruefen, aktiv, kuendigen, monatsbrutto } from "./motor";
import type { Kategorie, Spielstand } from "./typen";
import { jahrVon, kurzDatum, monatVon, tagImMonat } from "./zeit";

export type Option = {
  text: string;
  /** Anzeige der Kosten (nur Info) */
  kosten?: (s: Spielstand, w: Werte) => number;
  /** Nicht wählbar, mit Grund */
  gesperrt?: (s: Spielstand, w: Werte) => string | null;
  wirkung: (s: Spielstand, w: Werte) => string;
};

type Werte = Record<string, number | string>;

export type Ereignis = {
  id: string;
  titel: string;
  icon: string;
  art: "gesundheit" | "technik" | "wohnung" | "arbeit" | "sozial" | "falle" | "geld" | "behoerde" | "termin";
  pMonat: number;
  wann?: (s: Spielstand) => boolean;
  /** Mindestabstand in Tagen zur letzten Auslösung. */
  abstand?: number;
  werte?: (s: Spielstand) => Werte;
  text: (s: Spielstand, w: Werte) => string;
  optionen: Option[];
  lehre?: string;
};

// ───────────────────────────────────────────────────────────── Helfer

function zahlen(s: Spielstand, betrag: number, kat: Kategorie, text: string): void {
  buchen(s, -r2(betrag), kat, text);
}

function krank(s: Spielstand, tage: number, art: string, au = false): void {
  s.zustand.krank = { bis: s.tag + tage - 1, au, art };
  s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 8 * Math.min(tage, 5));
  s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 20);
  log(s, "gesundheit", `Krank: ${art} (${tage} Tage)${au ? ", krankgeschrieben" : ""}`);
}

function zuzahlung(s: Spielstand, betrag: number, text: string): string {
  // Unter 18 keine Zuzahlungen
  if (alter(s) < 18) return "Unter 18 zahlst du in der Apotheke keine Zuzahlung.";
  zahlen(s, betrag, "gesundheit", text);
  return `Zuzahlung ${de(betrag, 2)} €.`;
}

function rechnung(s: Spielstand, von: string, betreff: string, betrag: number, kat: Kategorie, tage = 14, text = ""): void {
  brief(s, von, betreff, `${text}${text ? "\n\n" : ""}Betrag: ${de(betrag, 2)} €. Bitte überweisen bis ${kurzDatum(s.tag + tage)}.`,
    { art: "rechnung", betrag: r2(betrag), kategorie: kat, faellig: s.tag + tage });
}

export function haftpflicht(s: Spielstand): "eigene" | "eltern" | null {
  if (s.vertraege.some((v) => v.art === "haftpflicht" && aktiv(s, v))) return "eigene";
  // Familienhaftpflicht der Eltern: unverheiratete Kinder in der ersten Ausbildung
  const inErstausbildung = !s.flags.erstausbildungFertig && (!s.job || ["ausbildung", "schulisch", "freiwillig"].includes(s.job.art));
  if (alter(s) < 25 && (inErstausbildung || s.wohnung.form === "eltern")) return "eltern";
  return null;
}

function hausrat(s: Spielstand): boolean {
  return s.vertraege.some((v) => v.art === "hausrat" && aktiv(s, v));
}

function hatJob(s: Spielstand): boolean {
  return !!s.job && s.tag >= s.job.start;
}

function eigeneWohnung(s: Spielstand): boolean {
  return s.wohnung.form !== "eltern";
}

function winter(s: Spielstand): boolean {
  return [11, 12, 1, 2, 3].includes(monatVon(s.tag));
}

function sommer(s: Spielstand): boolean {
  return [6, 7, 8].includes(monatVon(s.tag));
}

const nichts = (text: string) => () => text;

function sozial(s: Spielstand, d: number): void {
  s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial + d);
}
function spass(s: Spielstand, d: number): void {
  s.beduerfnisse.spass = begrenzen(s.beduerfnisse.spass + d);
}

function kredit(s: Spielstand, art: "ratenkauf" | "bnpl" | "privat", text: string, summe: number, monate: number, zins: number, erstesFaellig: number): void {
  s.kredite.push({ uid: uid(s), art, text, rest: summe, rate: r2(summe / monate + (summe * zins) / 100 / 12), zins, faellig: erstesFaellig, mahnstufe: 0 });
  log(s, "schulden", `${art === "bnpl" ? "Später bezahlen" : "Ratenkauf"}: ${text} (${de(summe, 2)} €, ${monate} Raten)`, -summe);
}

// ───────────────────────────────────────────────────────────── Katalog

export const EREIGNISSE: Ereignis[] = [
  // ─────────────── Gesundheit
  {
    id: "erkaeltung", titel: "Erkältung", icon: "🤧", art: "gesundheit", pMonat: 0.16, abstand: 21,
    text: () => "Halsschmerzen, Schnupfen, Kopf dicht. Du fühlst dich richtig mies.",
    optionen: [
      { text: "Im Betrieb krankmelden, zum Hausarzt (Krankschreibung 3 Tage)",
        wirkung: (s) => { krank(s, 3, "Erkältung", true); s.flags[`krankGemeldet${s.tag}`] = true;
          s.dokumente.push({ uid: uid(s), art: "au", titel: "Arbeitsunfähigkeitsbescheinigung (eAU)", tag: s.tag });
          return "Die Praxis schickt die Krankmeldung elektronisch an die Krankenkasse — dein Betrieb ruft sie dort ab. Anrufen musstest du trotzdem. Lohn läuft weiter (bis 6 Wochen)."; } },
      { text: "Zähne zusammenbeißen und arbeiten gehen",
        wirkung: (s) => { s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 15);
          if (zufall(s) < 0.4) { krank(s, 5, "verschleppte Erkältung", false); return "Keine gute Idee — die Erkältung wird schlimmer, jetzt liegst du fünf Tage flach. Und du hast Kolleg:innen angesteckt."; }
          return "Du schleppst dich durch. Leistung mäßig, Kolleg:innen halten Abstand."; } },
      { text: "Einfach zu Hause bleiben (ohne Bescheid zu sagen)",
        wirkung: (s) => { krank(s, 3, "Erkältung", false); return "Ohne Krankmeldung gilt das als unentschuldigtes Fehlen — Ärger vorprogrammiert."; } },
    ],
    lehre: "Krank? Vor Arbeitsbeginn im Betrieb anrufen und zum Arzt. Viele Betriebe wollen die AU ab dem 1. Tag.",
  },
  {
    id: "grippe", titel: "Grippe", icon: "🤒", art: "gesundheit", pMonat: 0.06, abstand: 120, wann: winter,
    text: () => "39 °C Fieber, Gliederschmerzen. Das ist keine Erkältung mehr.",
    optionen: [
      { text: "Krankmelden, Arzt, Bett (7 Tage)", wirkung: (s) => { krank(s, 7, "Grippe", true); s.flags[`krankGemeldet${s.tag}`] = true;
        return zuzahlung(s, 5, "Zuzahlung Fiebersaft/Medikament") + " Nächsten Herbst: Grippeimpfung ist für Beschäftigte oft kostenlos."; } },
    ],
  },
  {
    id: "magen_darm", titel: "Magen-Darm", icon: "🤢", art: "gesundheit", pMonat: 0.04, abstand: 60,
    text: () => "Die Nacht auf dem Klo verbracht. An Arbeit ist nicht zu denken.",
    optionen: [
      { text: "Krankmelden, Arzt, Zwieback und Tee (2 Tage)", wirkung: (s) => { krank(s, 2, "Magen-Darm", true); s.flags[`krankGemeldet${s.tag}`] = true;
        s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger - 30); return "Viel trinken! In Lebensmittelberufen darfst du erst 48 h nach den letzten Symptomen wieder arbeiten."; } },
    ],
  },
  {
    id: "zahnschmerzen", titel: "Zahnschmerzen", icon: "🦷", art: "gesundheit", pMonat: 0.03, abstand: 120,
    werte: (s) => ({ reinigung: s.vertraege.some((v) => v.art === "zahnzusatz" && aktiv(s, v)) ? 0 : 95 }),
    text: () => "Ein Backenzahn pocht. Beim Zahnarzt: kleines Loch, Füllung nötig.",
    optionen: [
      { text: "Füllen lassen (Kassenleistung) + professionelle Zahnreinigung", kosten: (_s, w) => Number(w.reinigung),
        wirkung: (s, w) => { if (Number(w.reinigung) > 0) zahlen(s, Number(w.reinigung), "gesundheit", "Professionelle Zahnreinigung");
          return Number(w.reinigung) > 0 ? "Die Füllung zahlt die Kasse, die Reinigung nicht (95 €)." : "Die Zahnzusatzversicherung übernimmt die Reinigung."; } },
      { text: "Nur füllen lassen", wirkung: nichts("Die Kasse zahlt die zahnfarbene Standardfüllung. Tipp: Zahnpasta nie ausgehen lassen.") },
      { text: "Aushalten und Schmerztabletten", wirkung: (s) => { s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 15);
        s.flags.zahnVerschleppt = s.tag; return "Das Loch wird größer. Irgendwann wird's eine Wurzelbehandlung."; } },
    ],
  },
  {
    id: "wurzelbehandlung", titel: "Wurzelbehandlung", icon: "😬", art: "gesundheit", pMonat: 0.3, abstand: 400,
    wann: (s) => s.flags.zahnVerschleppt !== undefined && s.tag - Number(s.flags.zahnVerschleppt) > 40,
    text: () => "Der verschleppte Zahn ist entzündet. Wurzelbehandlung plus Krone.",
    optionen: [
      { text: "Behandeln lassen (Eigenanteil Krone)", kosten: () => 420,
        wirkung: (s) => { delete s.flags.zahnVerschleppt; krank(s, 1, "Zahn-OP", true);
          const zusatz = s.vertraege.some((v) => v.art === "zahnzusatz" && aktiv(s, v));
          zahlen(s, zusatz ? 120 : 420, "gesundheit", "Eigenanteil Zahnkrone");
          return zusatz ? "Die Zahnzusatzversicherung übernimmt 300 €." : "Die Kasse zahlt einen Festzuschuss, der Rest ist deiner: 420 €."; } },
    ],
  },
  {
    id: "rezept", titel: "Rezept vom Arzt", icon: "💊", art: "gesundheit", pMonat: 0.05, abstand: 45,
    text: () => "Wegen einer Entzündung verschreibt dir die Ärztin ein Antibiotikum.",
    optionen: [{ text: "In der Apotheke einlösen", wirkung: (s) => zuzahlung(s, 5, "Rezeptzuzahlung") + " Ab 18: 10 % Zuzahlung, mindestens 5, höchstens 10 € je Medikament." }],
  },
  {
    id: "brille", titel: "Alles verschwommen", icon: "👓", art: "gesundheit", pMonat: 0.012, abstand: 700,
    text: (s) => `Der Augenarzt sagt: Brille nötig. ${alter(s) < 18 ? "Unter 18 zahlt die Kasse die Gläser." : "Ab 18 zahlt die Kasse nichts dazu."}`,
    optionen: [
      { text: "Günstige Brille (Kette, 2 für 1)", kosten: (s) => alter(s) < 18 ? 40 : 120,
        wirkung: (s) => { zahlen(s, alter(s) < 18 ? 40 : 120, "gesundheit", "Brille"); return "Sieht gut aus — und du siehst gut."; } },
      { text: "Designerbrille", kosten: () => 380, wirkung: (s) => { zahlen(s, 380, "gesundheit", "Designerbrille"); spass(s, 10); return "Schick. Teuer."; } },
    ],
  },
  {
    id: "sportverletzung", titel: "Umgeknickt", icon: "🦶", art: "gesundheit", pMonat: 0.02, abstand: 120,
    text: () => "Beim Fußball mit Freunden umgeknickt — Bänderdehnung.",
    optionen: [{ text: "Arzt, Krankschreibung (7 Tage)", wirkung: (s) => { krank(s, 7, "Bänderdehnung", true); s.flags[`krankGemeldet${s.tag}`] = true;
      return zuzahlung(s, 10, "Zuzahlung Bandage") + " Freizeitunfälle zahlt die gesetzliche Unfallversicherung nicht — Arbeitsunfälle schon."; } }],
  },
  {
    id: "arbeitsunfall", titel: "Arbeitsunfall", icon: "🩹", art: "arbeit", pMonat: 0.012, abstand: 200,
    wann: (s) => hatJob(s) && (BERUF.get(s.job!.beruf)?.koerperlich ?? 0) >= 2,
    text: () => "Auf der Arbeit hast du dich am Werkzeug geschnitten. Genäht werden muss es.",
    optionen: [{ text: "Durchgangsarzt (D-Arzt), Meldung an die Berufsgenossenschaft", wirkung: (s) => { krank(s, 4, "Arbeitsunfall", true);
      s.flags[`krankGemeldet${s.tag}`] = true; return "Bei Arbeitsunfällen zahlt die Berufsgenossenschaft alles — keine Zuzahlung. Im Betrieb gehört der Unfall ins Verbandbuch."; } }],
  },
  {
    id: "erschoepfung", titel: "Völlig erschöpft", icon: "🥱", art: "gesundheit", pMonat: 0.5, abstand: 30,
    wann: (s) => s.beduerfnisse.energie < 15 && s.beduerfnisse.gesundheit < 50,
    text: () => "Du bist beim Frühstück fast eingeschlafen. Seit Tagen zu wenig Schlaf, zu wenig Essen.",
    optionen: [
      { text: "Einen Tag Urlaub nehmen und ausschlafen", gesperrt: (s) => s.job && s.job.urlaubstage - s.job.urlaubGenommen < 1 ? "Kein Urlaub mehr übrig." : null,
        wirkung: (s) => { if (s.job) { s.job.urlaubGenommen += 1; s.flags.urlaubVon = s.tag; s.flags.urlaubBis = s.tag; }
          s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie + 40); return "Gut, dass du auf deinen Körper hörst."; } },
      { text: "Energydrink und weiter", wirkung: (s) => { zahlen(s, 1.49, "lebensmittel", "Energydrink");
        s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie + 10); s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 5);
        return "Kurzer Schub, danach der Absturz."; } },
    ],
  },
  {
    id: "lebensmittelvergiftung", titel: "Da war was schlecht", icon: "🤮", art: "gesundheit", pMonat: 0.15, abstand: 90,
    wann: (s) => eigeneWohnung(s) && effekt(s, "kuehlen") === 0,
    text: () => "Ohne Kühlschrank ist die Wurst in der Wärme gekippt — und du hast sie trotzdem gegessen.",
    optionen: [{ text: "Leiden (2 Tage krank)", wirkung: (s) => { krank(s, 2, "Lebensmittelvergiftung", true);
      return "Ein Kühlschrank ist keine Luxusanschaffung."; } }],
  },

  {
    id: "kostgeld", titel: "Gespräch am Küchentisch", icon: "🍲", art: "sozial", pMonat: 30, abstand: 9999,
    wann: (s) => s.wohnung.form === "eltern" && !s.flags.kostgeldGefragt && s.konto.buchungen.some((b) => b.kategorie === "lohn"),
    text: () => "Deine Eltern: »Du verdienst jetzt dein eigenes Geld. Wir finden, du solltest etwas zu Miete, Essen und Strom beitragen.«",
    optionen: [
      { text: "100 € Kostgeld im Monat", wirkung: (s) => { s.flags.kostgeldGefragt = true; s.wohnung.kostgeld = 100; return "Einverstanden. Essen, Wäsche, Strom — alles drin. Günstiger wohnst du nirgends."; } },
      { text: "200 € (ein fairer Anteil)", wirkung: (s) => { s.flags.kostgeldGefragt = true; s.wohnung.kostgeld = 200; s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial + 10); return "Deine Eltern freuen sich. Übliche Faustregel: ein Drittel bis ein Viertel des Nettos."; } },
      { text: "Nichts — ich spare für die eigene Wohnung", wirkung: (s) => { s.flags.kostgeldGefragt = true; s.wohnung.kostgeld = 0; s.beduerfnisse.sozial = begrenzen(s.beduerfnisse.sozial - 10);
        return "Die Eltern sind einverstanden — solange du wirklich sparst. (Sparplan im Bank-Menü!)"; } },
    ],
  },

  // ─────────────── Technik & Sachen
  {
    id: "handy_display", titel: "Handy runtergefallen", icon: "📱", art: "technik", pMonat: 0.022, abstand: 120,
    text: () => "Klirr. Das Display hat einen Spinnennetz-Riss quer durch.",
    optionen: [
      { text: "Reparieren lassen (Display-Tausch)", kosten: () => 189,
        wirkung: (s) => { const vers = s.vertraege.some((v) => v.art === "handyversicherung" && aktiv(s, v));
          zahlen(s, vers ? 150 : 189, "sonstiges", vers ? "Selbstbeteiligung Handyversicherung" : "Display-Reparatur");
          return vers ? "Die Handyversicherung zahlt — abzüglich 150 € Selbstbeteiligung. Gespart hast du 39 €, gezahlt hast du Monatsbeiträge." : "189 €. Eine Hülle für 15 € hätte es vielleicht verhindert."; } },
      { text: "Mit Riss weiternutzen", wirkung: (s) => { spass(s, -10); return "Geht auch. Nervt aber."; } },
      { text: "Neues Handy auf Raten (0 % über 24 Monate)", gesperrt: (s) => (volljaehrig(s) ? null : "Ratenkauf erst ab 18."),
        wirkung: (s) => { kredit(s, "ratenkauf", "Neues Smartphone", 899, 24, 0, s.tag + 30); spass(s, 15);
          return "899 € Schulden für 2 Jahre — eine SCHUFA-Meldung hast du damit auch."; } },
    ],
  },
  {
    id: "handy_geklaut", titel: "Handy weg", icon: "🕵️", art: "technik", pMonat: 0.005, abstand: 365,
    text: () => "In der vollen Straßenbahn war dein Handy plötzlich weg.",
    optionen: [
      { text: "SIM sperren, Anzeige, gebrauchtes Handy kaufen", kosten: () => 220,
        wirkung: (s) => { zahlen(s, 220, "sonstiges", "Gebrauchtes Handy"); zahlen(s, 10, "handy", "Ersatz-SIM");
          return hausrat(s) ? "Einfacher Diebstahl ohne Einbruch zahlt die Hausratversicherung nicht." : "Die Anzeige bei der Polizei brauchst du für die Sperre und eventuelle Versicherungen."; } },
    ],
  },
  {
    id: "laptop_kaputt", titel: "Laptop startet nicht", icon: "💻", art: "technik", pMonat: 0.012, abstand: 365,
    wann: (s) => hatMoebel(s, "laptop") || hatMoebel(s, "gaming-pc"),
    text: () => "Nach dem letzten Update bleibt der Bildschirm schwarz.",
    optionen: [
      { text: "Reparatur im Laden", kosten: () => 120, wirkung: (s) => { zahlen(s, 120, "sonstiges", "Laptop-Reparatur"); return "Festplatte getauscht. Hattest du ein Backup?"; } },
      { text: "Freund, der sich auskennt, fragen", wirkung: (s) => { sozial(s, 10); return zufall(s) < 0.6 ? "Er hat's hinbekommen — für eine Pizza." : "Er hat's nicht hinbekommen. Der Laptop bleibt tot."; } },
    ],
  },
  {
    id: "geraet_defekt", titel: "Gerät kaputt", icon: "🔧", art: "technik", pMonat: 0.03, abstand: 90,
    wann: (s) => s.moebel.some((m) => ["waschmaschine", "kuehlschrank-kombi", "mini-kuehlschrank", "standherd-backofen", "spuelmaschine"].includes(m.id) && !m.defekt),
    werte: (s) => {
      const kandidaten = s.moebel.filter((m) => ["waschmaschine", "kuehlschrank-kombi", "mini-kuehlschrank", "standherd-backofen", "spuelmaschine"].includes(m.id) && !m.defekt);
      // Gebrauchte Geräte gehen dreimal so oft kaputt
      const gewichtet = kandidaten.flatMap((m) => (m.gebraucht ? [m, m, m] : [m]));
      const m = gewichtet[Math.floor(zufall(s) * gewichtet.length)];
      return { uid: m.uid, id: m.id, gebraucht: m.gebraucht ? 1 : 0 };
    },
    text: (_s, w) => `${{ waschmaschine: "Die Waschmaschine pumpt nicht mehr ab", "kuehlschrank-kombi": "Der Kühlschrank wird nicht mehr kalt", "mini-kuehlschrank": "Der Mini-Kühlschrank ist warm", "standherd-backofen": "Zwei Herdplatten gehen nicht mehr", spuelmaschine: "Die Spülmaschine zeigt Fehler E24" }[String(w.id)] ?? "Ein Gerät ist kaputt"}.${Number(w.gebraucht) ? " (Gebraucht gekauft — da ist das Risiko höher.)" : ""}`,
    optionen: [
      { text: "Reparatur-Service", kosten: () => 140, wirkung: (s) => { zahlen(s, 140, "sonstiges", "Reparatur Haushaltsgerät"); return "Techniker, Anfahrt, Ersatzteil: 140 €."; } },
      { text: "Selbst versuchen (Video-Anleitung)", wirkung: (s, w) => { if (zufall(s) < 0.45) return "Flusensieb gereinigt — läuft wieder! 🎉";
        const m = s.moebel.find((x) => x.uid === Number(w.uid)); if (m) m.defekt = true; return "Hat nicht geklappt. Das Gerät ist jetzt als defekt markiert."; } },
      { text: "Ist mir egal — kaputt lassen", wirkung: (s, w) => { const m = s.moebel.find((x) => x.uid === Number(w.uid)); if (m) m.defekt = true; return "Das Gerät ist defekt."; } },
    ],
  },
  {
    id: "fahrrad_geklaut", titel: "Fahrrad geklaut", icon: "🚲", art: "technik", pMonat: 0.018, abstand: 200,
    wann: (s) => hatMoebel(s, "fahrrad-schloss"),
    text: () => "Vorm Bahnhof war nur noch das durchgeknipste Schloss übrig.",
    optionen: [
      { text: "Anzeige bei der Polizei + Versicherung", wirkung: (s) => { s.moebel = s.moebel.filter((m) => m.id !== "fahrrad-schloss");
        if (hausrat(s)) { buchen(s, 150, "erstattung", "Hausrat (Fahrraddiebstahl, Zeitwert)"); return "Die Hausrat zahlt den Zeitwert — nur, weil das Rad abgeschlossen war."; }
        return "Ohne Hausratversicherung bleibt nur die Anzeige. Rahmennummer notiert? Gutes Schloss = ca. 10 % vom Radpreis."; } },
    ],
  },
  {
    id: "platten", titel: "Platten", icon: "🛞", art: "technik", pMonat: 0.04, abstand: 45,
    wann: (s) => hatMoebel(s, "fahrrad-schloss"),
    text: () => "Glasscherbe, Reifen platt.",
    optionen: [
      { text: "Fahrradladen (Schlauch + Montage)", kosten: () => 18, wirkung: (s) => { zahlen(s, 18, "mobilitaet", "Fahrradreparatur"); return "18 €, fertig bis morgen."; } },
      { text: "Selbst flicken (Flickzeug 4 €)", wirkung: (s) => { zahlen(s, 4, "mobilitaet", "Flickzeug"); spass(s, 5); return "Geschafft! Beim nächsten Mal geht's schneller."; } },
    ],
  },
  {
    id: "schluessel", titel: "Schlüssel weg", icon: "🔑", art: "wohnung", pMonat: 0.012, abstand: 200,
    wann: eigeneWohnung,
    text: () => "23 Uhr, du stehst vor der Wohnungstür. Der Schlüssel ist weg — irgendwo verloren.",
    optionen: [
      { text: "Schlüsselnotdienst rufen (Nacht-Zuschlag)", kosten: () => 240,
        wirkung: (s) => { zahlen(s, 240, "sonstiges", "Schlüsselnotdienst (Nacht)"); s.flags.schluesselVerloren = s.tag;
          return "240 €. Tipp: Ersatzschlüssel bei Eltern oder Nachbarn — und Vorsicht vor Abzocke-Diensten mit 600-€-Rechnungen."; } },
      { text: "Bei Freunden pennen, morgen Ersatzschlüssel von den Eltern", gesperrt: (s) => (s.flags.ersatzschluessel ? null : "Du hast keinem einen Ersatzschlüssel gegeben."),
        wirkung: (s) => { sozial(s, 5); s.flags.schluesselVerloren = s.tag; return "Glück gehabt — Ersatzschlüssel sind Gold wert."; } },
    ],
  },
  {
    id: "schliessanlage", titel: "Die Schließanlage", icon: "🏢", art: "wohnung", pMonat: 0.5, abstand: 9999,
    wann: (s) => s.flags.schluesselVerloren !== undefined && s.wohnung.form === "wohnung" && s.tag - Number(s.flags.schluesselVerloren) > 5 && s.tag - Number(s.flags.schluesselVerloren) < 60,
    text: () => "Die Hausverwaltung schreibt: Weil ein Schlüssel der zentralen Schließanlage verloren ging, muss sie aus Sicherheitsgründen getauscht werden. Kosten: 1.800 €.",
    optionen: [
      { text: "Haftpflicht einschalten", wirkung: (s) => { delete s.flags.schluesselVerloren; const h = haftpflicht(s);
        if (h) return `Die ${h === "eltern" ? "Familienhaftpflicht deiner Eltern" : "Haftpflicht"} übernimmt den Schaden (Schlüsselverlust ist eingeschlossen). Puh!`;
        rechnung(s, "Hausverwaltung", "Austausch Schließanlage", 1800, "sonstiges", 30); return "Ohne Haftpflicht zahlst du selbst: 1.800 €. Eine Haftpflicht hätte ~50 € im Jahr gekostet."; } },
    ],
  },
  {
    id: "wasserschaden", titel: "Wasserschaden beim Nachbarn", icon: "💧", art: "wohnung", pMonat: 0.006, abstand: 700,
    wann: (s) => s.wohnung.form === "wohnung" && hatMoebel(s, "waschmaschine"),
    text: () => "Der Zulaufschlauch der Waschmaschine ist geplatzt. Bei den Nachbarn unten tropft es von der Decke.",
    optionen: [{ text: "Schaden melden", wirkung: (s) => { const h = haftpflicht(s);
      if (h) return "Die Haftpflicht übernimmt den Schaden beim Nachbarn (3.400 €). Deine eigenen Sachen zahlt die Hausrat — falls vorhanden.";
      kredit(s, "privat", "Schaden Nachbarwohnung (Ratenzahlung)", 3400, 34, 0, s.tag + 30);
      return "Ohne Haftpflicht haftest du selbst: 3.400 €, abzustottern in 100-€-Raten. Fast drei Jahre."; } }],
  },
  {
    id: "fahrradunfall_auto", titel: "Kratzer im Lack", icon: "🚗", art: "sozial", pMonat: 0.008, abstand: 700,
    wann: (s) => hatMoebel(s, "fahrrad-schloss"),
    text: () => "Beim Vorbeifahren hast du mit dem Lenker einen parkenden Wagen zerkratzt. Der Besitzer hat's gesehen.",
    optionen: [
      { text: "Daten austauschen, Haftpflicht", wirkung: (s) => { const h = haftpflicht(s);
        if (h) return "Die Haftpflicht zahlt die Lackreparatur (780 €).";
        rechnung(s, "Autobesitzer (Anwalt)", "Schadenersatz Lackschaden", 780, "sonstiges", 30); return "780 € aus eigener Tasche."; } },
      { text: "Schnell wegfahren", wirkung: (s) => { if (zufall(s) < 0.6) { zahlen(s, 300, "strafen", "Geldstrafe Unfallflucht (Anteil)");
        rechnung(s, "Autobesitzer", "Schadenersatz Lackschaden", 780, "sonstiges", 30); return "Kennzeichen notiert: Anzeige wegen Unerlaubten Entfernens vom Unfallort — Schaden plus Strafe."; }
        return "Niemand hat's gesehen. Richtig war es trotzdem nicht."; } },
    ],
  },
  {
    id: "einbruch", titel: "Einbruch", icon: "🚪", art: "wohnung", pMonat: 0.003, abstand: 9999,
    wann: (s) => s.wohnung.form === "wohnung",
    text: () => "Tür aufgebrochen. Laptop, Konsole und das Bargeld aus der Schublade sind weg.",
    optionen: [{ text: "Polizei, Anzeige, Versicherung", wirkung: (s) => {
      s.moebel = s.moebel.filter((m) => !["laptop", "spielkonsole", "fernseher-43"].includes(m.id));
      s.bargeld = 0;
      if (hausrat(s)) { buchen(s, 900, "erstattung", "Hausratversicherung (Einbruch)"); return "Die Hausrat ersetzt den Neuwert: 900 €."; }
      return "Ohne Hausratversicherung ist alles weg. Die Tür zahlt der Vermieter."; } }],
  },

  // ─────────────── Wohnung
  {
    id: "schimmel", titel: "Schimmel", icon: "🦠", art: "wohnung", pMonat: 0.08, abstand: 180,
    wann: (s) => eigeneWohnung(s) && winter(s) && s.beduerfnisse.ordnung < 40,
    text: () => "Hinter dem Schrank an der Außenwand: schwarze Flecken. Wäsche trocknet in der Wohnung, gelüftet wird selten.",
    optionen: [
      { text: "Stoßlüften (3× täglich 5 min), Schimmelspray", kosten: () => 8,
        wirkung: (s) => { zahlen(s, 8, "drogerie", "Schimmelentferner"); s.flags.heizenSparsam = true; delete s.flags.lueftenFalsch;
          return "Richtig: Stoßlüften statt Kippfenster, Möbel 5 cm von der Außenwand. Große Flächen muss der Vermieter prüfen."; } },
      { text: "Schrank davorlassen", wirkung: (s) => { s.flags.lueftenFalsch = true; s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit - 10);
        return "Der Schimmel wächst weiter — schlecht für die Lunge und die Kaution."; } },
    ],
  },
  {
    id: "heizung_aus", titel: "Heizung kalt", icon: "🥶", art: "wohnung", pMonat: 0.04, abstand: 200,
    wann: (s) => s.wohnung.form === "wohnung" && winter(s),
    text: () => "Seit zwei Tagen ist die Heizung kalt. In der Wohnung sind es 14 Grad.",
    optionen: [
      { text: "Schriftlich Mangel anzeigen (Mietminderung möglich)", wirkung: (s) => { buchen(s, r2(s.wohnung.kalt * 0.2), "erstattung", "Mietminderung (Heizungsausfall)");
        return "Der Vermieter muss reparieren; für die Zeit darfst du die Miete mindern. Immer schriftlich!"; } },
      { text: "Heizlüfter kaufen", kosten: () => 25, wirkung: (s) => { zahlen(s, 25, "moebel", "Heizlüfter"); s.wohnung.kwh += 120;
        return "Warm — aber der Heizlüfter frisst Strom (2 kW!)."; } },
    ],
  },
  {
    id: "mieterhoehung", titel: "Mieterhöhung", icon: "📈", art: "wohnung", pMonat: 0.06, abstand: 450,
    wann: (s) => s.wohnung.form === "wohnung" && s.tag - s.wohnung.einzug > 450,
    werte: (s) => ({ plus: Math.round(s.wohnung.kalt * zwischen(s, 0.05, 0.12)) }),
    text: (_s, w) => `Der Vermieter verlangt ab übernächstem Monat ${w.plus} € mehr Kaltmiete (»Anpassung an die ortsübliche Vergleichsmiete«).`,
    optionen: [
      { text: "Mit dem Mietspiegel prüfen und zustimmen", wirkung: (s, w) => { s.wohnung.kalt += Number(w.plus);
        return "In 3 Jahren darf die Miete höchstens um 20 % steigen (Kappungsgrenze). Du hast zwei Monate Bedenkzeit."; } },
      { text: "Mieterverein fragen (Beitrag 5 €/Monat)", kosten: () => 60,
        wirkung: (s, w) => { zahlen(s, 60, "sonstiges", "Mieterverein Jahresbeitrag"); const halb = Math.round(Number(w.plus) / 2);
          s.wohnung.kalt += halb; return `Der Mieterverein findet einen Fehler — es werden nur ${halb} € mehr.`; } },
    ],
  },
  {
    id: "nachbar_laerm", titel: "Nachbar feiert", icon: "🔊", art: "wohnung", pMonat: 0.04, abstand: 60,
    wann: eigeneWohnung,
    text: () => "Mittwoch, 1 Uhr nachts, über dir wummert Techno. Um 5 klingelt dein Wecker.",
    optionen: [
      { text: "Freundlich klingeln", wirkung: (s) => { sozial(s, 3); return "Er entschuldigt sich und dreht leiser. Reden hilft meistens."; } },
      { text: "Polizei rufen (Ruhestörung)", wirkung: (s) => { s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 10); return "Nachtruhe 22–6 Uhr. Die Polizei kommt; das Verhältnis zum Nachbarn ist jetzt frostig."; } },
      { text: "Ohrstöpsel", wirkung: (s) => { zahlen(s, 3, "drogerie", "Ohrstöpsel"); s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 15); return "Geht so."; } },
    ],
  },
  {
    id: "wg_streit", titel: "Streit um den Abwasch", icon: "🍽️", art: "wohnung", pMonat: 0.08, abstand: 45,
    wann: (s) => s.wohnung.form === "wg",
    text: () => "Die Spüle quillt über. Deine Mitbewohnerin hat einen Zettel an den Kühlschrank geklebt: »Wer war's?!«",
    optionen: [
      { text: "Putzplan vorschlagen", wirkung: (s) => { sozial(s, 8); s.beduerfnisse.ordnung = begrenzen(s.beduerfnisse.ordnung + 20); return "Putzplan hängt. Läuft (meistens)."; } },
      { text: "Ignorieren", wirkung: (s) => { sozial(s, -15); return "Die Stimmung in der WG ist im Keller."; } },
    ],
  },
  {
    id: "wg_auszug", titel: "Mitbewohner zieht aus", icon: "📦", art: "wohnung", pMonat: 0.025, abstand: 300,
    wann: (s) => s.wohnung.form === "wg",
    text: () => "Einer zieht aus. Bis jemand Neues kommt, fehlt seine Miete — die Hauptmieterin will sie aufteilen.",
    optionen: [
      { text: "Einen Monat mehr zahlen (80 €) und WG-Casting machen", kosten: () => 80,
        wirkung: (s) => { zahlen(s, 80, "miete", "Anteil leeres WG-Zimmer"); sozial(s, 5); return "Nach drei Castings ist ein Neuer gefunden."; } },
    ],
  },
  {
    id: "ummelden_bussgeld", titel: "Post vom Bürgeramt", icon: "🏛️", art: "behoerde", pMonat: 0.35, abstand: 9999,
    wann: (s) => eigeneWohnung(s) && !s.flags.angemeldet && s.tag - s.wohnung.einzug > 30,
    text: () => "Du wohnst seit über einem Monat in der neuen Wohnung, bist aber noch nicht umgemeldet. Das Bürgeramt hat's gemerkt (der Vermieter hat die Wohnungsgeberbestätigung ausgestellt).",
    optionen: [{ text: "Verwarnungsgeld zahlen und sofort anmelden", kosten: () => 35,
      wirkung: (s) => { zahlen(s, 35, "strafen", "Verwarnungsgeld (Meldepflicht)"); return "Innerhalb von 2 Wochen nach dem Umzug muss man sich anmelden (Bundesmeldegesetz). Mach es jetzt im Amt-Menü."; } }],
  },
  {
    id: "rundfunk_klaerung", titel: "Beitragsservice", icon: "📺", art: "behoerde", pMonat: 0.5, abstand: 9999,
    wann: (s) => s.wohnung.form === "wohnung" && !!s.flags.angemeldet && !s.flags.rundfunkAngemeldet && !s.flags.rundfunkBefreit && s.tag - Number(s.flags.angemeldet) > 30,
    text: (s) => `Der ARD ZDF Deutschlandradio Beitragsservice schreibt: Für Ihre Wohnung ist noch kein Rundfunkbeitrag angemeldet. ${Math.round(18.36 * 100) / 100} € je Monat — pro Wohnung, egal ob du fernsiehst.`,
    optionen: [
      { text: "Anmelden und nachzahlen", wirkung: (s) => { s.flags.rundfunkAngemeldet = true; const monate = Math.max(1, Math.round((s.tag - s.wohnung.einzug) / 30.4));
        zahlen(s, r2(18.36 * monate), "rundfunk", `Rundfunkbeitrag Nachzahlung (${monate} Monate)`);
        return "Mit BAB (oder Bürgergeld) kannst du dich befreien lassen — aber nur ab Antrag, nicht rückwirkend für lange Zeit."; } },
      { text: "Ignorieren", wirkung: (s) => { s.flags.rundfunkAngemeldet = true; rechnung(s, "Beitragsservice", "Festsetzungsbescheid Rundfunkbeitrag", 18.36 * 6 + 8, "rundfunk", 14,
        "Da Sie auf unser Schreiben nicht reagiert haben, wurden Sie direkt angemeldet. Säumniszuschlag 8 €."); return "Ignorieren kostet extra — der Beitrag kommt trotzdem."; } },
    ],
  },

  // ─────────────── Arbeit
  {
    id: "berufsschulbuecher", titel: "Bücherliste der Berufsschule", icon: "📚", art: "arbeit", pMonat: 1, abstand: 300,
    wann: (s) => !!s.job && s.job.art === "ausbildung" && s.tag - s.job.start >= 0 && ((s.tag - s.job.start) % 365) < 20,
    werte: (s) => ({ betrag: ganz(s, 45, 120) }),
    text: (_s, w) => `Neues Schuljahr: Fachbücher, Tabellenbuch, Taschenrechner — ${w.betrag} €.`,
    optionen: [
      { text: "Neu kaufen", kosten: (_s, w) => Number(w.betrag), wirkung: (s, w) => { zahlen(s, Number(w.betrag), "arbeit", "Berufsschulbücher");
        s.flags.arbeitsmittel = r2(Number(s.flags.arbeitsmittel ?? 0) + Number(w.betrag)); return "Kassenbon aufheben: Arbeitsmittel zählen in der Steuererklärung (Werbungskosten)."; } },
      { text: "Gebraucht von Azubis aus dem 3. Jahr", kosten: (_s, w) => Math.round(Number(w.betrag) * 0.4),
        wirkung: (s, w) => { const b = Math.round(Number(w.betrag) * 0.4); zahlen(s, b, "arbeit", "Gebrauchte Berufsschulbücher");
          s.flags.arbeitsmittel = r2(Number(s.flags.arbeitsmittel ?? 0) + b); sozial(s, 5); return "Clever gespart."; } },
    ],
  },
  {
    id: "ueberstunden", titel: "Überstunden", icon: "⏰", art: "arbeit", pMonat: 0.06, abstand: 60,
    wann: (s) => hatJob(s) && s.job!.art !== "schulisch",
    text: (s) => `Kurz vor Feierabend: »Kannst du heute noch zwei Stunden bleiben?« ${alter(s) < 18 ? "(Unter 18: max. 8 Stunden am Tag erlaubt!)" : ""}`,
    optionen: [
      { text: "Ja, bleiben", gesperrt: (s) => (alter(s) < 18 ? "Jugendarbeitsschutzgesetz: nicht erlaubt." : null),
        wirkung: (s) => { s.flags.sonderzahlung = r2(Number(s.flags.sonderzahlung ?? 0) + monatsbrutto(s).brutto / 173 * 2 * 1.25);
          if (s.job) s.job.leistung = begrenzen(s.job.leistung + 4); s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 10);
          return "Azubis müssen Überstunden bezahlt oder mit Freizeit ausgeglichen bekommen (§ 17 BBiG)."; } },
      { text: "Nein, heute nicht", wirkung: (s) => { if (s.job) s.job.leistung = begrenzen(s.job.leistung - 1); return "Völlig in Ordnung — Überstunden sind freiwillig, wenn nichts im Vertrag steht."; } },
    ],
  },
  {
    id: "lob", titel: "Lob vom Chef", icon: "👏", art: "arbeit", pMonat: 0.08, abstand: 60,
    wann: (s) => hatJob(s) && s.job!.leistung > 75,
    text: () => "»Richtig gute Arbeit in letzter Zeit. Weiter so!«",
    optionen: [{ text: "Freuen", wirkung: (s) => { spass(s, 15); if (s.job) s.job.leistung = begrenzen(s.job.leistung + 3); return "Das zahlt auf die Übernahme ein."; } }],
  },
  {
    id: "stress_kollege", titel: "Ärger mit dem Kollegen", icon: "😤", art: "arbeit", pMonat: 0.03, abstand: 90,
    wann: hatJob,
    text: () => "Ein Kollege lässt dich immer die Drecksarbeit machen und lästert über dich.",
    optionen: [
      { text: "Mit Ausbilder:in / Chef:in reden", wirkung: (s) => { sozial(s, 5); return "Gut so. Azubis dürfen nur mit Aufgaben betraut werden, die dem Ausbildungszweck dienen. Hilfe gibt's auch bei der Kammer und der Jugend- und Auszubildendenvertretung."; } },
      { text: "Runterschlucken", wirkung: (s) => { spass(s, -15); return "Es wird nicht besser."; } },
      { text: "Anbrüllen", wirkung: (s) => { abmahnungPruefen(s, "Beleidigung eines Kollegen"); return "Das war zu viel."; } },
    ],
  },
  {
    id: "weihnachtsgeld", titel: "Weihnachtsgeld", icon: "🎄", art: "arbeit", pMonat: 1, abstand: 300,
    wann: (s) => hatJob(s) && monatVon(s.tag) === 11 && tagImMonat(s.tag) === 20 && /Metall|TVAöD|Bank|Chemische|Versicherung|Energie|Papier/.test(BERUF.get(s.job!.beruf)?.tarif ?? ""),
    werte: (s) => ({ betrag: r2(monatsbrutto(s).brutto * 0.55) }),
    text: (_s, w) => `Mit dem November-Lohn kommt die tarifliche Sonderzahlung: ${de(Number(w.betrag), 2)} € brutto.`,
    optionen: [{ text: "Klasse!", wirkung: (s, w) => { s.flags.sonderzahlung = r2(Number(s.flags.sonderzahlung ?? 0) + Number(w.betrag));
      return "Tarifverträge bringen oft Weihnachtsgeld, Urlaubsgeld und mehr Urlaub. Achtung: auf Sonderzahlungen gehen auch Steuern und SV ab."; } }],
  },
  {
    id: "vwl", titel: "Vermögenswirksame Leistungen", icon: "🏦", art: "geld", pMonat: 0.5, abstand: 9999,
    wann: (s) => hatJob(s) && s.tag - s.job!.start > 30 && /Metall|TVAöD|Bank|Chemische/.test(BERUF.get(s.job!.beruf)?.tarif ?? ""),
    text: () => "Die Personalabteilung: »Du hast Anspruch auf vermögenswirksame Leistungen — wir zahlen bis zu 26,59 € im Monat zusätzlich in einen Sparvertrag.«",
    optionen: [
      { text: "VL-Sparvertrag abschließen (Fondssparplan)", wirkung: (s) => { s.flags.vwl = 26.59; return "Geschenktes Geld vom Arbeitgeber — nicht liegen lassen! Es geht direkt in deinen Sparvertrag."; } },
      { text: "Kein Interesse", wirkung: nichts("Da verschenkst du 319 € im Jahr.") },
    ],
  },
  {
    id: "nebenjob", titel: "Nebenjob-Angebot", icon: "🧾", art: "geld", pMonat: 0.04, abstand: 180,
    wann: (s) => !s.flags.minijob,
    text: () => "Ein Bekannter sucht jemanden, der samstags im Getränkemarkt aushilft: 520 € im Monat, Minijob.",
    optionen: [
      { text: "Annehmen (samstags arbeiten)",
        wirkung: (s) => { s.flags.minijob = 520; return s.job?.art === "ausbildung" ? "Als Azubi musst du den Nebenjob dem Betrieb melden, er darf die Ausbildung nicht gefährden. Minijob: kein Abzug, aber Samstage weg." : "Minijob bis zur Grenze: brutto = netto."; } },
      { text: "Ablehnen", wirkung: nichts("Freizeit ist auch was wert.") },
    ],
  },
  {
    id: "insolvenz", titel: "Betrieb pleite", icon: "📉", art: "arbeit", pMonat: 0.0015, abstand: 9999,
    wann: (s) => hatJob(s) && s.tag > s.job!.probezeitBis,
    text: (s) => `${s.job!.betrieb} hat Insolvenz angemeldet. Die Löhne der letzten Monate zahlt die Agentur für Arbeit (Insolvenzgeld).`,
    optionen: [{ text: "Neuen Betrieb suchen", wirkung: (s) => { const azubi = s.job?.art === "ausbildung";
      kuendigen(s, "Betriebsschließung wegen Insolvenz");
      return azubi ? "Bei Insolvenz hilft die Kammer (IHK/HWK), einen Betrieb zu finden, der dich übernimmt. Bewirb dich — dein Ausbildungsjahr zählt weiter." : "Jetzt heißt es: arbeitslos melden, bewerben."; } }],
  },

  // ─────────────── Fallen
  {
    id: "phishing", titel: "SMS: Paket wartet", icon: "📩", art: "falle", pMonat: 0.07, abstand: 45,
    text: () => "»Ihr Paket konnte nicht zugestellt werden. Bestätigen Sie Ihre Adresse: dhI-paket-info.xyz« — du erwartest tatsächlich ein Paket.",
    optionen: [
      { text: "Link öffnen und Daten eingeben", wirkung: (s) => { const b = ganz(s, 150, 450); zahlen(s, b, "sonstiges", "Abbuchung durch Betrüger");
        return `Die Seite wollte auch deine Kartendaten — jetzt fehlen ${b} €. Karte sperren: 116 116, Anzeige bei der Polizei, Bank informieren.`; } },
      { text: "Löschen — echte Paketdienste schicken keine solchen Links", wirkung: nichts("Richtig! Achte auf die Adresse: »dhI« mit großem i statt kleinem L.") },
    ],
    lehre: "Phishing: Nie Daten über SMS-Links eingeben. Absender prüfen, im Zweifel direkt in der App/auf der Website nachsehen.",
  },
  {
    id: "abofalle", titel: "Gewinnspiel", icon: "🎰", art: "falle", pMonat: 0.03, abstand: 120,
    wann: (s) => !s.flags.drittanbietersperre,
    text: () => "Beim Surfen: »Du bist der 1.000.000. Besucher! Tippe hier für dein iPhone!«",
    optionen: [
      { text: "Antippen", wirkung: (s) => { s.flags.abofalle = s.tag; s.vertraege.push({ uid: uid(s), angebot: "abofalle", art: "streaming",
        name: "Abo-Falle (4,99 €/Woche über Handyrechnung)", monatlich: 21.6, start: s.tag, mindestBis: s.tag, zahltag: 15 });
        return "Ein Abo für 4,99 €/Woche über die Handyrechnung. Kündigen, Geld zurückfordern — und beim Mobilfunkanbieter die kostenlose Drittanbietersperre einrichten!"; } },
      { text: "Wegklicken", wirkung: nichts("Gut so.") },
      { text: "Wegklicken und Drittanbietersperre einrichten", wirkung: (s) => { s.flags.drittanbietersperre = true; return "Profi! Dann kann niemand mehr über deine Handyrechnung abbuchen."; } },
    ],
  },
  {
    id: "fakeshop", titel: "Sneaker 70 % billiger", icon: "👟", art: "falle", pMonat: 0.03, abstand: 120,
    text: () => "Instagram-Werbung: limitierte Sneaker für 59 € statt 199 €. Nur heute, nur Vorkasse.",
    optionen: [
      { text: "Per Vorkasse bestellen", wirkung: (s) => { zahlen(s, 59, "kleidung", "Online-Bestellung (Vorkasse)");
        return "Es kommt nie etwas an. Der Shop ist ein Fake — kein Impressum, Domain seit 2 Wochen. Vorkasse-Geld ist meist weg."; } },
      { text: "Erst den Fakeshop-Finder der Verbraucherzentrale fragen", wirkung: nichts("»Achtung, Fakeshop!« — Geld gespart.") },
    ],
  },
  {
    id: "kleinanzeigen_betrug", titel: "Kleinanzeigen: »Sicher bezahlen«", icon: "💬", art: "falle", pMonat: 0.03, abstand: 90,
    text: () => "Du verkaufst dein altes Handy für 120 €. Ein Käufer schreibt: »Ich zahle über ›Sicher bezahlen‹, klick nur auf den Link und gib deine Kartendaten für die Auszahlung ein.«",
    optionen: [
      { text: "Link öffnen, Kartendaten eingeben", wirkung: (s) => { zahlen(s, 380, "sonstiges", "Betrug über gefälschte Bezahlseite"); return "Der Link war gefälscht. Zum Empfangen von Geld braucht man nie Kartendaten!"; } },
      { text: "Nur Barzahlung bei Abholung anbieten", wirkung: (s) => { buchen(s, 120, "verkauf", "Handy verkauft (bar)"); s.bargeld = r2(s.bargeld); return "Käufer weg, echter Käufer kommt drei Tage später: 120 € bar."; } },
    ],
  },
  {
    id: "bnpl", titel: "Jetzt kaufen, später zahlen", icon: "🛍️", art: "falle", pMonat: 0.06, abstand: 45,
    text: () => "Die neue Jacke, 139 €. An der Online-Kasse: »In 30 Tagen bezahlen — ohne Zinsen!«",
    optionen: [
      { text: "Später bezahlen", wirkung: (s) => { rechnung(s, "Zahlungsdienst (fiktiv)", "Rechnung Jacke", 139, "kleidung", 30); spass(s, 12);
        return "Die Rechnung kommt in 30 Tagen. Wer dann nicht zahlt: Mahngebühren, Inkasso, SCHUFA."; } },
      { text: "Sofort bezahlen", kosten: () => 139, wirkung: (s) => { zahlen(s, 139, "kleidung", "Jacke"); spass(s, 12); return "Bezahlt ist bezahlt."; } },
      { text: "Nicht kaufen", wirkung: nichts("Die alte Jacke tut's noch.") },
    ],
  },
  {
    id: "ratenkauf_konsole", titel: "Konsole auf Raten", icon: "🎮", art: "falle", pMonat: 0.03, abstand: 180,
    wann: (s) => volljaehrig(s) && !hatMoebel(s, "spielkonsole"),
    text: () => "Elektromarkt: »Neue Konsole + 2 Spiele für nur 25 € im Monat!« (24 Monate, effektiver Jahreszins 9,9 %)",
    optionen: [
      { text: "Finanzieren", wirkung: (s) => { kredit(s, "ratenkauf", "Spielkonsole + Spiele", 560, 24, 9.9, s.tag + 30);
        s.moebel.push({ id: "spielkonsole", uid: uid(s), gebraucht: false, defekt: false, preis: 560, gekauft: s.tag }); spass(s, 25);
        return "24 × 25,77 € = 618 € für 560 € Ware. Und: Der Kredit steht in der SCHUFA — das sieht der nächste Vermieter."; } },
      { text: "Ansparen und später bar kaufen", wirkung: nichts("Gute Entscheidung — und bis dahin gibt's das Modell vielleicht günstiger.") },
    ],
  },
  {
    id: "versicherungsvertreter", titel: "Der nette Berater", icon: "🤵", art: "falle", pMonat: 0.03, abstand: 365,
    wann: hatJob,
    text: () => "Ein »Finanzberater« (Freund eines Freundes) will dir eine Rentenversicherung mit 100 € im Monat verkaufen: »Musst du jung anfangen!«",
    optionen: [
      { text: "Unterschreiben", wirkung: (s) => { s.vertraege.push({ uid: uid(s), angebot: "rentenvers", art: "zeitung", name: "Private Rentenversicherung (Provisionsvertrag)",
        monatlich: 100, start: s.tag, mindestBis: s.tag + 365 * 12, zahltag: 1 });
        return "Die ersten Jahre fließt fast alles in Provision und Kosten. Kündigen bringt viel weniger zurück als eingezahlt. Unabhängige Beratung: Verbraucherzentrale."; } },
      { text: "Erst mal Notgroschen und BU — nein danke", wirkung: nichts("Reihenfolge: Haftpflicht → Notgroschen (3 Nettogehälter) → BU → dann Altersvorsorge (z. B. ETF-Sparplan, VL).") },
    ],
  },
  {
    id: "krypto", titel: "Der heiße Tipp", icon: "🪙", art: "falle", pMonat: 0.025, abstand: 300,
    wann: volljaehrig,
    text: () => "Ein Kumpel: »Kauf den neuen Coin, der geht 100× hoch! Ich bin schon 300 % im Plus.«",
    optionen: [
      { text: "200 € reinstecken", kosten: () => 200, wirkung: (s) => { zahlen(s, 200, "sonstiges", "Kryptowährung gekauft");
        if (zufall(s) < 0.2) { buchen(s, 420, "sonstiges_ein", "Krypto verkauft (Gewinn)"); return "Glück gehabt — verkauft für 420 €. Gewinne unter einem Jahr Haltedauer sind steuerpflichtig (Freigrenze 1.000 €)."; }
        return "Der Coin ist um 95 % gefallen. Deine 200 € sind jetzt 10 € wert."; } },
      { text: "Nein danke", wirkung: nichts("Kein Geld investieren, dessen Verlust du dir nicht leisten kannst.") },
    ],
  },
  {
    id: "sportwetten", titel: "Wett-Werbung", icon: "⚽", art: "falle", pMonat: 0.025, abstand: 200,
    wann: volljaehrig,
    text: () => "»100 € Neukundenbonus!« Deine Freunde wetten alle aufs Wochenende.",
    optionen: [
      { text: "50 € einzahlen", kosten: () => 50, wirkung: (s) => { zahlen(s, 50, "freizeit", "Sportwetten");
        if (zufall(s) < 0.35) { buchen(s, 70, "sonstiges_ein", "Wettgewinn"); s.flags.wetten = Number(s.flags.wetten ?? 0) + 1; return "Gewonnen! … und genau so fängt es an. Langfristig gewinnt immer der Anbieter."; }
        return "Verloren. Der Bonus lässt sich erst nach 5-fachem Umsatz auszahlen."; } },
      { text: "Nicht mitmachen", wirkung: nichts("Glücksspiel-Hilfe: check-dein-spiel.de, BZgA-Hotline 0800 1 37 27 00.") },
    ],
  },
  {
    id: "fitness_vorsatz", titel: "Neujahrsvorsatz", icon: "🏋️", art: "falle", pMonat: 0.9, abstand: 300,
    wann: (s) => volljaehrig(s) && monatVon(s.tag) === 1 && !s.vertraege.some((v) => v.art === "fitness" && aktiv(s, v)),
    text: () => "Neues Jahr, neues Ich! Das Fitnessstudio um die Ecke: »24,99 €, 24 Monate, Startpaket nur 29 €.«",
    optionen: [
      { text: "Vertrag über 24 Monate", wirkung: (s) => { s.vertraege.push({ uid: uid(s), angebot: "fitness-24", art: "fitness", name: "Fitness 24 Monate",
        monatlich: 24.99, start: s.tag, mindestBis: s.tag + 730, zahltag: 15 }); zahlen(s, 29, "abos", "Fitness Startpaket");
        s.flags.fitnessMotivation = 1; return "624 € + 29 € — egal, wie oft du hingehst. Ab Februar kommt es oft nur noch selten vor…"; } },
      { text: "Erst mal joggen im Nordpark", wirkung: (s) => { s.beduerfnisse.gesundheit = begrenzen(s.beduerfnisse.gesundheit + 5); return "Kostenlos und an der frischen Luft."; } },
    ],
  },
  {
    id: "probeabo", titel: "30 Tage gratis", icon: "🎬", art: "falle", pMonat: 0.05, abstand: 120,
    text: () => "Neuer Streamingdienst: 30 Tage gratis testen — danach 9,99 € im Monat.",
    optionen: [
      { text: "Testen (und vergessen zu kündigen)", wirkung: (s) => { s.vertraege.push({ uid: uid(s), angebot: "streaming2", art: "streaming", name: "Serien-Abo (nach Probemonat)",
        monatlich: 9.99, start: s.tag + 30, mindestBis: s.tag + 30, zahltag: tagImMonat(s.tag) > 28 ? 1 : tagImMonat(s.tag) });
        spass(s, 10); return "Ab nächstem Monat 9,99 €. Tipp: Beim Abschluss sofort kündigen — die Probezeit läuft trotzdem."; } },
      { text: "Nicht nötig", wirkung: nichts("Ein Abo weniger.") },
    ],
  },
  {
    id: "handyvertrag_laden", titel: "Handyladen", icon: "📲", art: "falle", pMonat: 0.03, abstand: 365,
    wann: volljaehrig,
    text: () => "Im Einkaufszentrum: »Top-Smartphone für 1 €! Nur heute!« — mit Vertrag für 54,99 €/Monat.",
    optionen: [
      { text: "Unterschreiben", wirkung: (s) => { for (const v of s.vertraege) if (v.art === "handy" && aktiv(s, v)) v.gekuendigtZum = Math.max(v.mindestBis, s.tag + 30);
        s.vertraege.push({ uid: uid(s), angebot: "handy-top", art: "handy", name: "Top-Smartphone für 1 € + 50 GB", monatlich: 54.99, start: s.tag, mindestBis: s.tag + 730, zahltag: 15 });
        spass(s, 20); return "24 × 54,99 € = 1.319,76 €. SIM-only (15 €) + Handy bar (999 €) wären 1.359 € — aber nur, wenn man das teure Handy überhaupt braucht."; } },
      { text: "Rechnen und weitergehen", wirkung: nichts("Gesamtkosten = Monatsrate × Laufzeit + Einmalkosten. Immer!") },
    ],
  },

  // ─────────────── Sozial & Familie
  {
    id: "geburtstag_freund", titel: "Geburtstagseinladung", icon: "🎂", art: "sozial", pMonat: 0.14, abstand: 20,
    text: () => "Deine beste Freundin feiert Geburtstag und lädt dich ein.",
    optionen: [
      { text: "Hingehen mit Geschenk (25 €)", kosten: () => 25, wirkung: (s) => { zahlen(s, 25, "geschenke", "Geburtstagsgeschenk"); sozial(s, 25); spass(s, 15);
        s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 15); return "Schöner Abend!"; } },
      { text: "Hingehen mit selbstgebackenem Kuchen", wirkung: (s) => { sozial(s, 20); spass(s, 10); return "Kommt gut an — und kostet fast nichts."; } },
      { text: "Absagen", wirkung: (s) => { sozial(s, -10); return "Sie ist ein bisschen enttäuscht."; } },
    ],
  },
  {
    id: "familienfeier", titel: "Familienfeier", icon: "👨‍👩‍👧", art: "sozial", pMonat: 0.03, abstand: 120,
    text: () => "Cousine heiratet (bzw. hat Jugendweihe). Die ganze Familie kommt.",
    optionen: [
      { text: "Hingehen, Geschenk 50 €", kosten: () => 50, wirkung: (s) => { zahlen(s, 50, "geschenke", "Geschenk Familienfeier"); sozial(s, 20);
        s.beduerfnisse.hunger = 100; return "Gutes Essen, Oma steckt dir 20 € zu."; } },
    ],
  },
  {
    id: "weihnachten", titel: "Weihnachten", icon: "🎁", art: "sozial", pMonat: 1, abstand: 300,
    wann: (s) => monatVon(s.tag) === 12 && tagImMonat(s.tag) === 10,
    text: () => "In zwei Wochen ist Weihnachten. Geschenke für Familie und Freunde?",
    optionen: [
      { text: "Kleine Geschenke (60 €)", kosten: () => 60, wirkung: (s) => { zahlen(s, 60, "geschenke", "Weihnachtsgeschenke"); sozial(s, 15); buchen(s, 100, "eltern", "Weihnachtsgeld von Oma");
        return "Oma schenkt dir 100 €."; } },
      { text: "Richtig groß (250 €)", kosten: () => 250, wirkung: (s) => { zahlen(s, 250, "geschenke", "Weihnachtsgeschenke"); sozial(s, 25); buchen(s, 100, "eltern", "Weihnachtsgeld von Oma");
        return "Alle freuen sich. Dein Konto nicht."; } },
      { text: "Selbstgemachtes", wirkung: (s) => { zahlen(s, 15, "geschenke", "Bastelmaterial"); sozial(s, 12); buchen(s, 100, "eltern", "Weihnachtsgeld von Oma"); return "Persönlich und günstig."; } },
    ],
  },
  {
    id: "urlaub_freunde", titel: "Urlaub mit Freunden", icon: "🏖️", art: "sozial", pMonat: 0.08, abstand: 300,
    wann: (s) => [3, 4, 5, 6].includes(monatVon(s.tag)),
    text: () => "Die Clique plant eine Woche Urlaub im Sommer. Du musst dich jetzt entscheiden.",
    optionen: [
      { text: "Mallorca (Flug + Hotel, 1 Woche)", kosten: () => 690, gesperrt: (s) => (alter(s) < 18 ? "Unter 18 ohne Eltern: nur mit Einverständnis — und viele Hotels nehmen keine Minderjährigen allein." : null),
        wirkung: (s) => { zahlen(s, 690, "freizeit", "Urlaub Mallorca"); spass(s, 40); sozial(s, 30); if (s.job) s.job.urlaubGenommen += 5;
          return "Unvergesslich. Und 5 Urlaubstage weg."; } },
      { text: "Zelten an der Ostsee (Zug mit D-Ticket)", kosten: () => 220, wirkung: (s) => { zahlen(s, 220, "freizeit", "Urlaub Ostsee (Zelt)"); spass(s, 30); sozial(s, 25);
        if (s.job) s.job.urlaubGenommen += 5; return "Mit dem Deutschlandticket in den Norden — günstig und abenteuerlich."; } },
      { text: "Diesmal nicht", wirkung: (s) => { sozial(s, -10); return "Die anderen schicken Fotos."; } },
    ],
  },
  {
    id: "festival", titel: "Festival-Tickets", icon: "🎪", art: "sozial", pMonat: 0.05, abstand: 300,
    wann: (s) => [1, 2, 3, 4].includes(monatVon(s.tag)),
    text: () => "Vorverkauf fürs Sommer-Festival: 229 € + Camping.",
    optionen: [
      { text: "Kaufen", kosten: () => 259, wirkung: (s) => { zahlen(s, 259, "freizeit", "Festivalticket"); spass(s, 30); sozial(s, 20); return "Vorfreude!"; } },
      { text: "Nein", wirkung: nichts("Ein Konzert in Erfurt ist auch schön.") },
    ],
  },
  {
    id: "freund_leiht", titel: "Kannst du mir was leihen?", icon: "🤝", art: "sozial", pMonat: 0.03, abstand: 200,
    text: () => "Ein Kumpel ist knapp bei Kasse: »Leihst du mir 100 €? Nächsten Monat kriegst du's zurück.«",
    optionen: [
      { text: "Leihen", kosten: () => 100, wirkung: (s) => { zahlen(s, 100, "sonstiges", "Geld an Kumpel geliehen"); sozial(s, 10);
        if (zufall(s) < 0.5) s.flags.leihRueck = s.tag + 40; return "Mal sehen…"; } },
      { text: "Nein sagen", wirkung: (s) => { sozial(s, -5); return "Unangenehm, aber ehrlich."; } },
    ],
  },
  {
    id: "leih_zurueck", titel: "Geld zurück", icon: "💶", art: "sozial", pMonat: 30, abstand: 9999,
    wann: (s) => s.flags.leihRueck !== undefined && s.tag >= Number(s.flags.leihRueck),
    text: () => "Dein Kumpel gibt dir die 100 € zurück!",
    optionen: [{ text: "Danke!", wirkung: (s) => { delete s.flags.leihRueck; buchen(s, 100, "sonstiges_ein", "Geliehenes Geld zurück"); return "Nicht selbstverständlich."; } }],
  },
  {
    id: "oma", titel: "Besuch bei Oma", icon: "👵", art: "sozial", pMonat: 0.03, abstand: 90,
    text: () => "Oma ruft an: »Kommst du mal vorbei? Ich hab Kuchen gebacken.«",
    optionen: [
      { text: "Hinfahren", wirkung: (s) => { sozial(s, 20); s.beduerfnisse.hunger = begrenzen(s.beduerfnisse.hunger + 40); s.bargeld = r2(s.bargeld + 50);
        return "Kuchen, Gespräche, und sie steckt dir 50 € zu."; } },
      { text: "Keine Zeit", wirkung: (s) => { sozial(s, -5); return "Nächstes Mal."; } },
    ],
  },
  {
    id: "haustier", titel: "Katzenbabys", icon: "🐱", art: "sozial", pMonat: 0.015, abstand: 9999,
    wann: (s) => s.wohnung.form === "wohnung" && !s.flags.haustier,
    text: () => "Eine Kollegin verschenkt Katzenbabys. Soooo süß.",
    optionen: [
      { text: "Eine nehmen", wirkung: (s) => { s.flags.haustier = "katze"; zahlen(s, 180, "sonstiges", "Katzen-Erstausstattung + Impfung");
        s.vertraege.push({ uid: uid(s), angebot: "katze", art: "zeitung", name: "Katze (Futter, Streu)", monatlich: 40, start: s.tag, mindestBis: s.tag + 5475, zahltag: 1 });
        spass(s, 30); sozial(s, 20); return "Erstausstattung, Impfung, Kastration ~180 €, danach ~40 € im Monat — 15 Jahre lang. Erlaubt der Mietvertrag Katzen?"; } },
      { text: "Nein, zu viel Verantwortung", wirkung: nichts("Vernünftig.") },
    ],
  },
  {
    id: "fund", titel: "Portemonnaie gefunden", icon: "👛", art: "sozial", pMonat: 0.008, abstand: 9999,
    text: () => "Auf der Straße liegt ein Portemonnaie mit 80 € und Ausweis.",
    optionen: [
      { text: "Zum Fundbüro bringen", wirkung: (s) => { buchen(s, 4, "sonstiges_ein", "Finderlohn"); return "Die Besitzerin bedankt sich — Finderlohn: 5 % der ersten 500 €. Gutes Gefühl!"; } },
      { text: "Geld behalten", wirkung: (s) => { s.bargeld = r2(s.bargeld + 80); if (zufall(s) < 0.3) { zahlen(s, 300, "strafen", "Geldstrafe Fundunterschlagung"); return "Eine Kamera hat dich gefilmt: Fundunterschlagung, Geldstrafe."; } return "80 € mehr — und ein schlechtes Gewissen."; } },
    ],
  },
  {
    id: "blutspende", titel: "Blutspende", icon: "🩸", art: "sozial", pMonat: 0.03, abstand: 90,
    wann: volljaehrig,
    text: () => "Plakat: Blutspende am Samstag, Aufwandsentschädigung bzw. Imbiss.",
    optionen: [
      { text: "Hingehen", wirkung: (s) => { s.bargeld = r2(s.bargeld + 25); s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 10);
        return "Leben retten — und 25 € Aufwandsentschädigung beim Plasma-/Blutspendedienst."; } },
      { text: "Nicht heute", wirkung: nichts("Vielleicht nächstes Mal.") },
    ],
  },
  {
    id: "winterjacke", titel: "Die Jacke ist durch", icon: "🧥", art: "geld", pMonat: 0.3, abstand: 300,
    wann: (s) => monatVon(s.tag) === 10 || monatVon(s.tag) === 11,
    text: () => "Der Reißverschluss der Winterjacke ist kaputt und das Futter hängt raus.",
    optionen: [
      { text: "Neue Jacke im Laden (99 €)", kosten: () => 99, wirkung: (s) => { zahlen(s, 99, "kleidung", "Winterjacke"); return "Warm."; } },
      { text: "Second Hand / Kleinanzeigen (30 €)", kosten: () => 30, wirkung: (s) => { zahlen(s, 30, "kleidung", "Winterjacke gebraucht"); return "Warm und nachhaltig."; } },
      { text: "Reißverschluss nähen lassen (18 €)", kosten: () => 18, wirkung: (s) => { zahlen(s, 18, "kleidung", "Änderungsschneiderei"); return "Hält noch einen Winter."; } },
    ],
  },
  {
    id: "hitze", titel: "Hitzewelle", icon: "🥵", art: "wohnung", pMonat: 0.3, abstand: 300,
    wann: (s) => eigeneWohnung(s) && monatVon(s.tag) === 7,
    text: () => "35 °C, die Dachwohnung heizt sich auf 30 Grad auf. Schlafen unmöglich.",
    optionen: [
      { text: "Ventilator (25 €)", kosten: () => 25, wirkung: (s) => { zahlen(s, 25, "moebel", "Ventilator"); return "Nachts lüften, tagsüber Rollos zu — und der Ventilator hilft."; } },
      { text: "Mobile Klimaanlage (299 €)", kosten: () => 299, wirkung: (s) => { zahlen(s, 299, "moebel", "Mobile Klimaanlage"); s.wohnung.kwh += 150; return "Kühl, aber laut und Stromfresser."; } },
      { text: "Aushalten", wirkung: (s) => { s.beduerfnisse.energie = begrenzen(s.beduerfnisse.energie - 20); return "Viel trinken!"; } },
    ],
  },

  // ─────────────── Behörden & Geld
  {
    id: "steuer_tipp", titel: "»Hast du schon deine Steuer gemacht?«", icon: "🧮", art: "geld", pMonat: 0.4, abstand: 300,
    wann: (s) => [3, 4, 5].includes(monatVon(s.tag)) && !!s.steuerjahre[jahrVon(s.tag) - 1] && !s.steuererklaerungen[jahrVon(s.tag) - 1],
    text: () => "Eine Kollegin erzählt in der Pause, dass sie 380 € vom Finanzamt zurückbekommen hat. Einfach mit ELSTER.",
    optionen: [{ text: "Merken", wirkung: nichts("Die Steuererklärung findest du im Handy unter »Steuer«. Freiwillig abgeben darfst du bis zu vier Jahre rückwirkend.") }],
  },
  {
    id: "schwarzfahren", titel: "Fahrscheinkontrolle", icon: "🎫", art: "behoerde", pMonat: 0.05, abstand: 60,
    wann: (s) => !s.vertraege.some((v) => v.art === "ticket" && aktiv(s, v)) && !!s.flags.schwarzfahrer,
    text: () => "»Die Fahrausweise, bitte!« — Du hast diesmal keinen Einzelfahrschein gekauft.",
    optionen: [{ text: "Erhöhtes Beförderungsentgelt zahlen", kosten: () => 60, wirkung: (s) => { zahlen(s, 60, "strafen", "Erhöhtes Beförderungsentgelt");
      return "60 €. Das Deutschlandticket kostet kaum mehr — und Wiederholung kann eine Anzeige bedeuten."; } }],
  },
  {
    id: "fuehrerschein", titel: "Führerschein?", icon: "🚗", art: "geld", pMonat: 0.2, abstand: 365,
    wann: (s) => alter(s) >= 17 && !s.flags.fuehrerschein && !s.flags.fuehrerscheinSparen,
    text: () => "Alle machen gerade den Führerschein. In Erfurt kostet Klasse B inzwischen ~3.500–4.500 € (Theorie, 25–35 Fahrstunden, Prüfungen).",
    optionen: [
      { text: "Jetzt anmelden (4.000 € in Raten über die Fahrschule)", gesperrt: (s) => (s.konto.stand < 800 ? "Die Fahrschule will 800 € Anzahlung." : null),
        wirkung: (s) => { zahlen(s, 800, "mobilitaet", "Fahrschule Anzahlung"); kredit(s, "ratenkauf", "Führerschein Klasse B", 3200, 12, 0, s.tag + 30);
          s.flags.fuehrerschein = s.tag + 180; return "In einem halben Jahr kannst du fahren — ein Auto kostet dann aber nochmal ~250 €/Monat (Versicherung, Sprit, Steuer, TÜV)."; } },
      { text: "Sparziel anlegen", wirkung: (s) => { s.flags.fuehrerscheinSparen = true; return "Monatlich 150 € aufs Sparkonto — in etwa zwei Jahren ist das Geld zusammen. (Sparplan im Bank-Menü)"; } },
      { text: "Brauche ich in der Stadt nicht", wirkung: nichts("In Erfurt kommt man mit Tram, Rad und D-Ticket gut klar.") },
    ],
  },
];

export const EREIGNIS = new Map(EREIGNISSE.map((e) => [e.id, e]));

// ───────────────────────────────────────────────────────────── Termine (Prüfungen & Vertragsende)

function termine(s: Spielstand): void {
  const job = s.job;
  if (!job) return;
  const b = BERUF.get(job.beruf);
  if (!b) return;
  const tage = s.tag - job.start;
  const dauerTage = Math.round(b.dauer * 30.44);
  if (job.art === "ausbildung" && b.dauer >= 24) {
    if (job.zwischenpruefung === undefined && tage === Math.round(dauerTage * 0.45) && !s.offen.some((o) => o.id === "zwischenpruefung")) {
      s.offen.push({ id: "zwischenpruefung", tag: s.tag });
    }
    if (job.abschlusspruefung === undefined && tage >= dauerTage - 20 && !s.offen.some((o) => o.id === "abschlusspruefung")) {
      s.offen.push({ id: "abschlusspruefung", tag: s.tag });
    }
  }
  if (job.art === "schulisch" && tage >= dauerTage && !s.offen.some((o) => o.id === "abschlusspruefung")) {
    s.offen.push({ id: "abschlusspruefung", tag: s.tag });
  }
  if ((job.art === "helfer" || job.art === "freiwillig") && tage === 365 && !s.offen.some((o) => o.id === "vertragsende")) {
    s.offen.push({ id: "vertragsende", tag: s.tag });
  }
}

export const TERMINE: Ereignis[] = [
  {
    id: "zwischenpruefung", titel: "Zwischenprüfung", icon: "📝", art: "termin", pMonat: 0,
    text: (s) => `Die Zwischenprüfung bei der Kammer steht an. Deine Leistung im Betrieb: ${Math.round(s.job?.leistung ?? 0)}/100, gelernt: ${Math.round(Number(s.flags.lernstunden ?? 0))} Stunden.`,
    optionen: [{ text: "Prüfung schreiben", wirkung: (s) => {
      const job = s.job!;
      const punkte = Math.round(begrenzen(job.leistung * 0.55 + Math.min(40, Number(s.flags.lernstunden ?? 0)) + zwischen(s, -15, 15) + (5 - schnittHilfe(s)) * 3));
      job.zwischenpruefung = punkte;
      s.dokumente.push({ uid: uid(s), art: "bescheid", titel: `Ergebnis Zwischenprüfung: ${punkte} Punkte`, tag: s.tag });
      log(s, "arbeit", `Zwischenprüfung: ${punkte}/100 Punkte`);
      return `${punkte} von 100 Punkten. ${punkte < 50 ? "Die Zwischenprüfung zählt (meist) nicht zur Endnote, ist aber ein Warnsignal: mehr lernen!" : "Gut unterwegs."}`;
    } }],
  },
  {
    id: "abschlusspruefung", titel: "Abschlussprüfung", icon: "🎓", art: "termin", pMonat: 0,
    text: (s) => `Jetzt gilt's: die Abschlussprüfung. Leistung im Betrieb ${Math.round(s.job?.leistung ?? 0)}/100, Zwischenprüfung ${s.job?.zwischenpruefung ?? "–"} Punkte, gelernt ${Math.round(Number(s.flags.lernstunden ?? 0))} Stunden.`,
    optionen: [{ text: "Prüfung ablegen", wirkung: (s) => abschluss(s) }],
  },
  {
    id: "vertragsende", titel: "Vertrag läuft aus", icon: "📄", art: "arbeit", pMonat: 0,
    text: (s) => s.job?.art === "freiwillig" ? "Dein Freiwilliges Soziales Jahr ist vorbei. Zeit für die nächste Bewerbung!" : "Dein befristeter Vertrag läuft aus.",
    optionen: [{ text: "Weiter", wirkung: (s) => {
      if (s.job?.art === "freiwillig") { s.flags.fsjGemacht = true; kuendigen(s, "Ende des Freiwilligen Sozialen Jahres"); return "Mit FSJ im Lebenslauf klappen Bewerbungen besser. Kindergeld läuft weiter, solange du eine Ausbildung suchst."; }
      if (zufall(s) < 0.6) { if (s.job) s.job.start = s.tag - 1; return "Verlängert um ein Jahr."; }
      kuendigen(s, "Ende der Befristung"); return "Nicht verlängert. Arbeitslos melden (Agentur für Arbeit) und bewerben.";
    } }],
  },
];
for (const t of TERMINE) EREIGNIS.set(t.id, t);

function schnittHilfe(s: Spielstand): number {
  const n = Object.values(s.zeugnis.noten).filter(Boolean) as number[];
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 3;
}

function abschluss(s: Spielstand): string {
  const job = s.job!;
  const b = BERUF.get(job.beruf)!;
  const punkte = Math.round(begrenzen(job.leistung * 0.5 + Math.min(45, Number(s.flags.lernstunden ?? 0) * 0.6)
    + (job.zwischenpruefung ?? 50) * 0.15 + zwischen(s, -12, 12)));
  job.abschlusspruefung = punkte;
  s.flags.lernstunden = 0;
  log(s, "arbeit", `Abschlussprüfung ${b.name}: ${punkte}/100 Punkte`);
  if (punkte < 50) {
    job.abschlusspruefung = undefined;
    job.zwischenpruefung = job.zwischenpruefung ?? punkte;
    // Verlängerung um 6 Monate (§ 21 Abs. 3 BBiG)
    job.start += 183;
    return `${punkte} Punkte — leider nicht bestanden. Du darfst zweimal wiederholen; die Ausbildung verlängert sich auf Antrag bis zur nächsten Prüfung (etwa 6 Monate). Lernen!`;
  }
  s.flags.erstausbildungFertig = true;
  s.dokumente.push({ uid: uid(s), art: "zeugnis", titel: `Abschlusszeugnis ${b.name} (${punkte} Punkte)`, tag: s.tag });
  const uebernahme = zufall(s) < b.uebernahme * (job.leistung > 60 ? 1.1 : job.leistung < 40 ? 0.5 : 0.9);
  const altJob = { ...job, ende: s.tag };
  s.jobHistorie.push(altJob);
  if (b.art === "schulisch") {
    s.job = null;
    return `Bestanden mit ${punkte} Punkten! Jetzt kannst du dich für die Erzieher-Ausbildung oder einen Job bewerben.`;
  }
  if (uebernahme) {
    const brutto = r2(b.gehaltNach * Math.pow(1.03, Math.max(0, jahrVon(s.tag) - 2026)));
    s.job = { beruf: b.id, betrieb: job.betrieb, start: s.tag + 1, art: "fachkraft", brutto, urlaubstage: 28, urlaubGenommen: 0,
      probezeitBis: s.tag, leistung: job.leistung, abmahnungen: 0, krankTage: 0, fehlTage: 0 };
    s.dokumente.push({ uid: uid(s), art: "arbeitsvertrag", titel: `Arbeitsvertrag ${b.name} — ${de(brutto, 0)} € brutto`, tag: s.tag });
    s.kcalBedarf = 2000 + b.koerperlich * 350;
    return `Bestanden mit ${punkte} Punkten! 🎉 Dein Betrieb übernimmt dich als Fachkraft: ${de(brutto, 0)} € brutto im Monat. ` +
      `Ab jetzt: Kindergeld endet, Familienhaftpflicht der Eltern greift nicht mehr — eigene Haftpflicht abschließen!`;
  }
  s.job = null;
  s.flags.arbeitslosSeit = s.tag;
  return `Bestanden mit ${punkte} Punkten! 🎉 Leider kann dich dein Betrieb nicht übernehmen. ` +
    `Melde dich bei der Agentur für Arbeit — nach der Ausbildung hast du Anspruch auf Arbeitslosengeld I — und bewirb dich als Fachkraft.`;
}

// ───────────────────────────────────────────────────────────── Würfeln

export function taeglicheEreignisse(s: Spielstand): void {
  termine(s);
  // Höchstens ein Zufallsereignis pro Tag, und nicht, wenn schon drei warten
  if (s.offen.length >= 3) return;
  const kandidaten = EREIGNISSE.filter((e) => {
    if (s.offen.some((o) => o.id === e.id)) return false;
    const zuletzt = s.zuletztEreignis[e.id];
    if (zuletzt !== undefined && s.tag - zuletzt < (e.abstand ?? 30)) return false;
    try { return !e.wann || e.wann(s); } catch { return false; }
  });
  // Reihenfolge mischen, damit nicht immer die ersten dran sind
  for (const e of kandidaten.sort(() => zufall(s) - 0.5)) {
    let p = e.pMonat / 30;
    if (e.id === "erkaeltung" && winter(s)) p *= 1.8;
    if (e.id === "erkaeltung" && sommer(s)) p *= 0.5;
    if (e.art === "gesundheit" && s.beduerfnisse.gesundheit < 40) p *= 1.6;
    if (zufall(s) < p) {
      s.offen.push({ id: e.id, tag: s.tag, werte: e.werte ? e.werte(s) : undefined });
      s.zuletztEreignis[e.id] = s.tag;
      log(s, "ereignis", `Ereignis: ${e.titel}`);
      return;
    }
  }
  // Minijob: jeden Samstag arbeiten, am Monatsende Geld
  if (s.flags.minijob && tagImMonat(s.tag) === 28) {
    buchen(s, Number(s.flags.minijob), "lohn", "Minijob (Getränkemarkt)");
  }
  if (s.flags.vwl && tagImMonat(s.tag) === 28) s.sparkonto = r2(s.sparkonto + Number(s.flags.vwl));
  if (s.flags.fuehrerschein && typeof s.flags.fuehrerschein === "number" && s.tag === s.flags.fuehrerschein) {
    brief(s, "Fahrschule", "Bestanden! 🚗", "Glückwunsch zur bestandenen Fahrprüfung — Probezeit 2 Jahre, 0,0 Promille.");
    s.flags.fuehrerschein = true;
  }
}

/** Eine Option eines offenen Ereignisses wählen. */
export function ereignisWahl(s: Spielstand, index: number, option: number): string {
  const o = s.offen[index];
  if (!o) return "";
  const e = EREIGNIS.get(o.id);
  if (!e) { s.offen.splice(index, 1); return ""; }
  const opt = e.optionen[option];
  const w = o.werte ?? {};
  const gesperrt = opt.gesperrt?.(s, w);
  if (gesperrt) return gesperrt;
  s.offen.splice(index, 1);
  const text = opt.wirkung(s, w);
  log(s, "ereignis", `${e.titel}: ${opt.text} → ${text}`);
  return text;
}


/** Wie `ereignisWahl`, aber auf einer Kopie — für die Oberfläche. */
export function waehle(alt: Spielstand, index: number, option: number): { stand: Spielstand; meldung?: string; fehler?: string } {
  const s = structuredClone(alt);
  const vorher = s.offen.length;
  const text = ereignisWahl(s, index, option);
  if (s.offen.length === vorher) return { stand: alt, fehler: text };
  return { stand: s, meldung: text };
}
