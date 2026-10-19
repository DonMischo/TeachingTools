/**
 * Quiz zum Wachstum: »Zeig mir …« (Klick in die Karte), Wissensfragen mit
 * Begründung und »Welche Epoche ist das?«. Fragen entstehen aus der
 * gezeigten Stadt, damit nur gefragt wird, was zu sehen ist.
 */
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, zurLinie, type P } from "./geometrie";
import { zoneBei } from "./haeuser";
import { BAUTEN, STRASSEN, ZONEN, type BauTyp, type Epoche, type Stadt, type Stil, type ZonenTyp } from "./modell";

export type Frage =
  | { art: "zeige"; text: string; ziel: { bau: BauTyp } | { zone: ZonenTyp } | { name: string }; erklaerung: string }
  | { art: "wahl"; text: string; optionen: string[]; richtig: number; erklaerung: string }
  | { art: "epoche"; text: string; epoche: number; optionen: string[]; richtig: number; erklaerung: string };

interface Wissen { ab: number; text: string; richtig: string; falsch: string[]; erklaerung: string }

const WISSEN: Record<Stil, Wissen[]> = {
  roemisch: [
    { ab: 0, text: "Warum liegt die Stadt nicht direkt am Ufer?", richtig: "Die Aue wird bei Hochwasser überflutet.", falsch: ["Die Römer konnten keine Brücken bauen.", "Am Ufer war es zu laut."], erklaerung: "Trockener, leicht erhöhter Grund schützte vor Hochwasser — der Fluss war trotzdem nah genug für Wasser und Transport." },
    { ab: 0, text: "Wie heißen die beiden Hauptstraßen einer Römerstadt?", richtig: "Cardo und Decumanus", falsch: ["Via und Forum", "Insula und Castellum"], erklaerung: "Der Cardo läuft Nord–Süd, der Decumanus Ost–West. Am Kreuzungspunkt liegt das Forum." },
    { ab: 0, text: "Warum ist der Grundriss so regelmäßig?", richtig: "Die Stadt wurde auf einmal nach Plan angelegt.", falsch: ["Sie wuchs langsam über Jahrhunderte.", "Das Gelände war zufällig so."], erklaerung: "Römische Kolonien wurden von Vermessern (Agrimensoren) in einem Zug abgesteckt — oft nach dem Muster eines Legionslagers." },
    { ab: 0, text: "Was sind Insulae?", richtig: "Wohnblöcke zwischen den Straßen des Rasters", falsch: ["Inseln im Fluss", "Römische Tempel"], erklaerung: "Insula heißt »Insel«: ein Block, ringsum von Straßen umgeben." },
    { ab: 1, text: "Warum liegen die Gräber an den Straßen vor der Stadt?", richtig: "Bestattungen innerhalb der Stadt waren verboten.", falsch: ["Dort war der Boden weicher.", "Man wollte Platz für Felder sparen."], erklaerung: "Das Zwölftafelgesetz verbot Gräber in der Stadt. An den Ausfallstraßen erinnerten Grabmäler an die Toten." },
    { ab: 1, text: "Warum muss die Quelle des Aquädukts höher liegen als die Stadt?", richtig: "Das Wasser fließt nur mit Gefälle.", falsch: ["Damit das Wasser kühler bleibt.", "Weil dort keine Feinde waren."], erklaerung: "Aquädukte hatten keine Pumpen. Ein gleichmäßiges, leichtes Gefälle trug das Wasser über viele Kilometer." },
    { ab: 1, text: "Warum steht das Amphitheater meist vor der Mauer?", richtig: "Es zog Tausende Zuschauer an und brauchte viel Platz.", falsch: ["Gladiatoren durften die Stadt nicht betreten.", "Es diente als zweite Mauer."], erklaerung: "Große Menschenmengen, Tiere, Lärm — und in der Mauer war kein Platz." },
    { ab: 2, text: "Warum wurde die Mauer in der Spätantike kleiner?", richtig: "Weniger Einwohner, und ein kleiner Kern war leichter zu verteidigen.", falsch: ["Die Römer hatten zu wenig Steine.", "Der Fluss hatte die Stadt verschluckt."], erklaerung: "Krisen und Einfälle ließen die Städte schrumpfen; man befestigte nur noch den Kern." },
    { ab: 3, text: "Woran erkennt man im heutigen Stadtplan eine Römerstadt?", richtig: "Am rechtwinkligen Straßenraster der Altstadt", falsch: ["An besonders krummen Gassen", "An Hochhäusern im Zentrum"], erklaerung: "In Köln, Trier oder Regensburg folgen Altstadtstraßen bis heute Cardo, Decumanus und den Insulae." },
  ],
  europaeisch: [
    { ab: 0, text: "Warum entstand die Siedlung genau hier?", richtig: "An einer Furt, wo Fernstraßen den Fluss queren", falsch: ["Weil der Boden hier am billigsten war", "Weil der König es befahl"], erklaerung: "Flussübergänge zwangen alle Reisenden vorbei — gut für Handel, Zoll und Schutz durch die Burg." },
    { ab: 0, text: "Warum steht die Burg auf dem Hügel?", richtig: "Von oben lässt sie sich verteidigen und man sieht weit.", falsch: ["Weil im Tal kein Holz wuchs.", "Damit sie näher am Himmel ist."], erklaerung: "Höhenburgen sicherten Straßen und Flussübergänge." },
    { ab: 1, text: "Warum sind die Gassen in der Altstadt eng und krumm?", richtig: "Die Stadt wuchs Haus für Haus, ohne Gesamtplan.", falsch: ["Gegen den Wind aus dem Westen", "Weil Pferde keine geraden Wege mochten"], erklaerung: "Mittelalterliche Städte sind »gewachsen«: Gassen folgen alten Wegen, dem Gelände und laufen auf Markt und Tore zu." },
    { ab: 1, text: "Was brachte das Stadtrecht?", richtig: "Markt, eigenes Gericht und das Recht auf eine Mauer", falsch: ["Steuerfreiheit für alle Bauern", "Eine Eisenbahn"], erklaerung: "»Stadtluft macht frei«: Bürger hatten eigene Rechte, die Stadt durfte sich ummauern und Märkte abhalten." },
    { ab: 2, text: "Wer wohnte in den Vorstädten vor den Toren?", richtig: "Handwerker, Fuhrleute und ärmere Leute ohne Bürgerrecht", falsch: ["Der Adel", "Die Ratsherren"], erklaerung: "In der Mauer war es eng und teuer. Draußen wohnte, wer nicht dazugehörte — oder laute, stinkende Gewerbe betrieb." },
    { ab: 3, text: "Was entstand oft an der Stelle der Stadtmauer?", richtig: "Ein Ring mit Grünanlagen", falsch: ["Ein Kanal", "Eine Autobahn"], erklaerung: "Die abgerissene Mauer hinterließ einen breiten Streifen — ideal für Ringstraßen, Parks und Prachtbauten." },
    { ab: 3, text: "Warum liegt der Bahnhof außerhalb der Altstadt?", richtig: "In der dichten Altstadt war kein Platz für Gleise.", falsch: ["Züge durften nicht in Städte fahren.", "Damit Reisende länger laufen."], erklaerung: "Bahnhöfe entstanden am damaligen Stadtrand. Die Stadt wuchs ihnen dann entgegen." },
    { ab: 3, text: "Was kennzeichnet ein Gründerzeitviertel?", richtig: "Gerade Straßen, geschlossene Blöcke, Mietshäuser mit Hinterhöfen", falsch: ["Fachwerkhäuser und krumme Gassen", "Einfamilienhäuser mit Garten"], erklaerung: "Zwischen 1870 und 1914 wuchsen die Städte rasant — mit dichten, planmäßigen Blöcken für die Arbeiter." },
    { ab: 4, text: "Warum liegt das Einkaufszentrum an der Umgehungsstraße?", richtig: "Dort ist Platz für Parkplätze und es ist mit dem Auto gut erreichbar.", falsch: ["Weil dort die meisten Menschen wohnen", "Weil es in der Altstadt verboten ist"], erklaerung: "»Grüne Wiese«: billiger Boden, Autobahnanschluss — ein Problem für den Handel in der Innenstadt." },
  ],
  amerikanisch: [
    { ab: 0, text: "Warum wurde die Stadt hier gegründet?", richtig: "Wegen der Eisenbahnlinie", falsch: ["Wegen einer mittelalterlichen Burg", "Wegen eines römischen Lagers"], erklaerung: "Eisenbahngesellschaften gründeten im Westen Hunderte Städte entlang ihrer Strecken." },
    { ab: 0, text: "Warum ist das Raster nach Norden ausgerichtet?", richtig: "Das Land war nach Himmelsrichtungen in Quadrate vermessen.", falsch: ["Wegen des Windes", "Weil es dem Flusslauf folgt"], erklaerung: "Die Land Ordinance von 1785 legte ein Raster aus Quadratmeilen über das ganze Land." },
    { ab: 0, text: "Was bedeutet »the wrong side of the tracks«?", richtig: "Auf der anderen Seite der Gleise wohnten die Ärmeren.", falsch: ["Dort fuhren die Züge falsch herum.", "Dort war das Gericht."], erklaerung: "Die Bahn teilte die Stadt — oft auch sozial." },
    { ab: 1, text: "Warum stehen im CBD Hochhäuser?", richtig: "Der Boden ist dort am teuersten, also baut man in die Höhe.", falsch: ["Weil der Boden dort am weichsten ist", "Weil dort niemand wohnen will"], erklaerung: "Im Central Business District konkurrieren alle um die beste Lage — die Bodenpreise steigen, die Gebäude auch." },
    { ab: 1, text: "Was waren Streetcar Suburbs?", richtig: "Wohnviertel an den Endhaltestellen der Straßenbahn", falsch: ["Fabriken für Straßenbahnen", "Parkhäuser"], erklaerung: "Mit der Straßenbahn konnte man weiter draußen wohnen und trotzdem im Zentrum arbeiten." },
    { ab: 2, text: "Warum haben die Vororte geschwungene Straßen und Sackgassen?", richtig: "Damit kein Durchgangsverkehr durch die Wohngebiete fährt", falsch: ["Weil das Gelände dort bergig war", "Um Straßenbahnschienen zu sparen"], erklaerung: "Suburbs wurden fürs Auto geplant — ruhig, mit großen Grundstücken, aber ohne Busse oder Läden um die Ecke." },
    { ab: 2, text: "Was passierte oft beim Bau der Interstates durch die Städte?", richtig: "Ganze Viertel, meist ärmere, wurden abgerissen.", falsch: ["Die Städte bekamen neue Mauern.", "Die Straßenbahnen wurden ausgebaut."], erklaerung: "Stadtautobahnen zerschnitten Viertel — vor allem von Schwarzen und Einwanderern." },
    { ab: 3, text: "Was ist eine Edge City?", richtig: "Ein neues Zentrum mit Büros und Malls am Autobahnring", falsch: ["Die Altstadt am Fluss", "Ein Dorf am Kartenrand"], erklaerung: "Edge Cities entstehen an den Ausfahrten weit draußen — Arbeitsplätze ziehen dem Wohnen hinterher." },
    { ab: 3, text: "In welcher Reihenfolge liegen die Zonen von innen nach außen (Burgess)?", richtig: "CBD – Übergangszone – Arbeiter – Wohnen – Pendler", falsch: ["Pendler – CBD – Arbeiter – Wohnen – Übergang", "Wohnen – CBD – Pendler – Übergang – Arbeiter"], erklaerung: "Das Ringmodell von Burgess (Chicago, 1925): Die Stadt wächst wie Jahresringe von innen nach außen." },
  ],
};

function mischen<T>(a: T[], z: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Fragen zu Epoche idx (und davor) */
export function quizFragen(stil: Stil, epochen: Epoche[], idx: number, seed: number): Frage[] {
  const z = zufallsquelle(seed);
  const s = epochen[idx].stadt;
  const fragen: Frage[] = [];
  const typen = mischen([...new Set(s.bauten.map(b => b.typ))].filter(t => t !== "tor"), z).slice(0, 4);
  for (const t of typen) fragen.push({ art: "zeige", text: `Klicke auf: ${BAUTEN[t].icon} ${BAUTEN[t].label}`, ziel: { bau: t }, erklaerung: BAUTEN[t].text });
  const zonen = mischen([...new Set(s.zonen.map(x => x.typ))].filter(t => t !== "park" && t !== "parkplatz"), z).slice(0, 2);
  for (const t of zonen) fragen.push({ art: "zeige", text: `Klicke in das Viertel: ${ZONEN[t].label}`, ziel: { zone: t }, erklaerung: ZONEN_TEXT[t] ?? "" });
  const namen = mischen([...new Set(s.strassen.map(st => st.name).filter((n): n is string => !!n && n !== "Via" && n !== "Fernstraße"))], z).slice(0, 1);
  for (const n of namen) fragen.push({ art: "zeige", text: `Klicke auf: ${n}`, ziel: { name: n }, erklaerung: STRASSEN_TEXT[n] ?? "" });
  for (const w of mischen(WISSEN[stil].filter(w => w.ab <= idx), z).slice(0, 4)) {
    const optionen = mischen([w.richtig, ...w.falsch], z);
    fragen.push({ art: "wahl", text: w.text, optionen, richtig: optionen.indexOf(w.richtig), erklaerung: w.erklaerung });
  }
  if (epochen.length > 2) {
    const e = Math.floor(z() * epochen.length);
    const optionen = epochen.map(x => `${x.jahr}: ${x.titel}`);
    fragen.push({ art: "epoche", text: "Aus welcher Zeit stammt diese Karte?", epoche: e, optionen, richtig: e, erklaerung: epochen[e].neu.join(" · ") });
  }
  return mischen(fragen, z);
}

export const ZONEN_TEXT: Partial<Record<ZonenTyp, string>> = {
  insulae: "Wohnblöcke im Raster, ringsum von Straßen begrenzt.",
  suburbium: "Vorstadt vor den Toren, entlang der Fernstraßen.",
  verlassen: "In der Spätantike aufgegeben: Ruinen und Gärten.",
  dorf: "Die erste Siedlung bei Burg und Furt.",
  altstadt: "Innerhalb der alten Mauer: dicht, eng, gewachsen.",
  vorstadt: "Vor den Toren entlang der Ausfallstraßen.",
  gruenderzeit: "1870–1914: gerade Straßen, geschlossene Blöcke, Mietskasernen.",
  industrie: "Fabriken an Bahn und Fluss.",
  grosssiedlung: "Hochhaussiedlung am Stadtrand, 1960er/70er.",
  einfamilienhaus: "Häuser mit Garten, geschwungene Straßen, Sackgassen.",
  gewerbe: "Einkauf und Gewerbe an der Autobahnausfahrt.",
  kleinstadt: "Die ersten Blöcke rund um Main Street und Bahnhof.",
  cbd: "Central Business District: Büros, Banken, Hochhäuser.",
  uebergang: "Um den CBD: alte Häuser, Lager, Leerstand — im Wandel.",
  arbeiter: "Kleine Häuser nahe den Fabriken an der Bahn.",
  vorort: "Wohnviertel im Raster, an den Straßenbahnlinien.",
  pendler: "Suburbs fürs Auto: groß, grün, weit draußen.",
};

const STRASSEN_TEXT: Record<string, string> = {
  "Cardo maximus": "Die Nord–Süd-Achse der Römerstadt.",
  "Decumanus maximus": "Die Ost–West-Achse der Römerstadt.",
  "Main Street": "Die Hauptstraße vom Bahnhof in die Stadt.",
  "Streetcar": "Straßenbahn-Avenue hinaus in die Wohnviertel.",
  Ring: "Boulevard auf der Linie der abgerissenen Stadtmauer.",
  Bahnhofstraße: "Vom Bahnhof in die Altstadt — Hotels, Kaufhäuser.",
  Eisenbahn: "Die Bahn kam im 19. Jahrhundert und brachte die Industrie.",
  Railroad: "Die Eisenbahn ist der Grund für die Stadt.",
  Interstate: "Autobahn mitten durch die Stadt, ab 1956.",
  Beltway: "Autobahnring um die ganze Stadt.",
  Umgehung: "Umgehungsstraße für den Durchgangsverkehr.",
  "Aquädukt": "Wasserleitung mit gleichmäßigem Gefälle.",
};

/** Hat der Klick bei p das Ziel getroffen? */
export function trifft(f: Extract<Frage, { art: "zeige" }>, s: Stadt, p: P): boolean {
  const ziel = f.ziel;
  if ("bau" in ziel) return s.bauten.some(b => b.typ === ziel.bau && abstand(b, p) < Math.max(BAUTEN[b.typ].b, BAUTEN[b.typ].h) / 2 + 35);
  if ("zone" in ziel) return zoneBei(s, p) === ziel.zone;
  return s.strassen.some(st => st.name === ziel.name && zurLinie(p, st.punkte).d < STRASSEN[st.art].breite / 2 + 30);
}

/** wo das Ziel liegt (zum Zeigen nach einer falschen Antwort) */
export function zielOrt(f: Extract<Frage, { art: "zeige" }>, s: Stadt): P | null {
  const ziel = f.ziel;
  if ("bau" in ziel) return s.bauten.find(b => b.typ === ziel.bau) ?? null;
  if ("zone" in ziel) {
    const z = [...s.zonen].reverse().find(x => x.typ === ziel.zone);
    if (!z) return null;
    // ein Punkt der Zone, der wirklich dazu zählt
    for (const p of z.poly) for (const t of [0.5, 0.3, 0.7]) {
      const c = z.poly.reduce((a, q) => ({ x: a.x + q.x / z.poly.length, y: a.y + q.y / z.poly.length }), { x: 0, y: 0 });
      const q = { x: c.x + (p.x - c.x) * t, y: c.y + (p.y - c.y) * t };
      if (zoneBei(s, q) === ziel.zone) return q;
    }
    return null;
  }
  const st = s.strassen.find(x => x.name === ziel.name);
  return st ? st.punkte[Math.floor(st.punkte.length / 2)] : null;
}

