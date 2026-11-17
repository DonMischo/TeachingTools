/**
 * Passendes Gelände je Stadttyp: Städte wurden dort gegründet, wo die
 * Landschaft liefert, was sie brauchen. Jeder Typ nennt ein echtes Vorbild
 * und plant die nötigen Merkmale ins Gelände (Quellsee für das Aquädukt,
 * Erzberg, geschützte Bucht, Kohlefeld).
 */
import type { GelaendeWahl, Landschaft, Merkmal } from "@/lib/gelaende/gelaende";
import type { Stil } from "./modell";

export interface Vorlage {
  art: Landschaft;
  relief: number;
  merkmale: Merkmal[];
  vorbild: string;
  warum: string;
}

export const VORLAGEN: Record<Stil, Vorlage> = {
  roemisch: { art: "flusstal", relief: 0.9, merkmale: ["quellsee"], vorbild: "Trier an der Mosel, Nîmes (Pont du Gard)", warum: "Ebener, trockener Grund am schiffbaren Fluss; eine höher gelegene Quelle speist das Aquädukt." },
  europaeisch: { art: "flusstal", relief: 1.1, merkmale: [], vorbild: "Erfurt (Furt durch die Gera, Petersberg)", warum: "Eine Furt bündelt die Handelswege, der Hügel daneben trägt die Burg." },
  amerikanisch: { art: "ebene", relief: 0.5, merkmale: [], vorbild: "Omaha, Kansas City (Prärie am Fluss)", warum: "Flaches Land, über das die Eisenbahn schnurgerade läuft." },
  residenz: { art: "ebene", relief: 0.3, merkmale: [], vorbild: "Karlsruhe, Mannheim (Oberrheinebene)", warum: "Nur auf ganz ebenem Land lassen sich Fächer und Achsen bis zum Horizont ziehen." },
  festung: { art: "ebene", relief: 0.4, merkmale: [], vorbild: "Saarlouis an der Saar, Neuf-Brisach", warum: "Flaches Vorfeld ohne Deckung für Angreifer, der Fluss füllt den Graben." },
  sozialistisch: { art: "flusstal", relief: 0.5, merkmale: ["kohle"], vorbild: "Eisenhüttenstadt an der Oder, Hoyerswerda", warum: "Das Werk braucht Wasser und Rohstoffe, die Wohnstadt flaches Land daneben." },
  lateinamerika: { art: "huegel", relief: 0.5, merkmale: [], vorbild: "Bogotá, Quito (Hochtäler)", warum: "Die Spanier gründeten auf ebenen Hochflächen mit gesundem Klima." },
  orientalisch: { art: "ebene", relief: 0.7, merkmale: [], vorbild: "Damaskus (Oase am Barada), Marrakesch", warum: "Wasser ist knapp — die Stadt sammelt sich um Fluss und Brunnen." },
  bergmann: { art: "gebirge", relief: 0.7, merkmale: ["erzberg"], vorbild: "Freiberg, Annaberg (Erzgebirge), Ilmenau", warum: "Die Stadt entsteht dort, wo Erz gefunden wird — auch am Hang im engen Tal." },
  industrie: { art: "flusstal", relief: 0.4, merkmale: ["kohle"], vorbild: "Duisburg, Essen (Ruhrgebiet), Wolfsburg", warum: "Kohle unter dem Boden, ein großer Fluss für Kühlwasser und Schiffe." },
  hafen: { art: "kueste", relief: 0.8, merkmale: ["bucht"], vorbild: "Hamburg, Kiel, Lübeck", warum: "Eine geschützte Bucht oder Flussmündung, in der Schiffe sicher anlegen." },
  tech: { art: "kueste", relief: 0.6, merkmale: ["bucht"], vorbild: "San José im Silicon Valley, Dresden (»Silicon Saxony«), Jena", warum: "Eine Universität als Keimzelle, viel flaches Land für Campus-Gewerbeparks und gute Anbindung." },
};

/** Geländewahl, die zum Stadttyp passt (gleicher Seed, damit Neuformen weiter geht) */
export function passendeWahl(stil: Stil, seed: number): GelaendeWahl {
  const v = VORLAGEN[stil];
  return { art: v.art, seed, fluss: true, relief: v.relief, merkmale: v.merkmale };
}
