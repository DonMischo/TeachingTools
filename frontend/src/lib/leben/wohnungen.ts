/**
 * Wohnungsmarkt Erfurt 2026.
 *
 * Mieten: Ø 9,25–10 €/m² kalt (ImmoScout24 Q2/2026, miet-check.de),
 * günstige Lagen ab ~8,80 €, Plattenbau-Viertel der kommunalen und
 * genossenschaftlichen Vermieter spürbar darunter, Altstadt bis ~12,80 €.
 * Betriebskosten ~2,20 €/m², Heizung ~1,30 €/m² (Richtwerte Betriebskosten-
 * spiegel). Kaution höchstens drei Kaltmieten (§ 551 BGB), in Raten zahlbar.
 *
 * Straßennamen sind echt, Hausnummern und Anzeigen erfunden.
 */
import type { Wohnung } from "./typen";

export type Stadtteil = {
  name: string;
  /** Lage in km vom Anger (Osten +x, Norden +y). */
  x: number;
  y: number;
  kaltMin: number;
  kaltMax: number;
  strassen: string[];
  platte: boolean;
  text: string;
};

export const STADTTEILE: Stadtteil[] = [
  { name: "Altstadt", x: 0, y: 0, kaltMin: 10.2, kaltMax: 12.8, platte: false,
    strassen: ["Marktstraße", "Futterstraße", "Michaelisstraße", "Johannesstraße", "Allerheiligenstraße"],
    text: "Mitten drin: Krämerbrücke, Kneipen, kurze Wege — teuer und oft laut." },
  { name: "Krämpfervorstadt", x: 1.2, y: 0.2, kaltMin: 9.2, kaltMax: 11.2, platte: false,
    strassen: ["Stauffenbergallee", "Magdeburger Allee", "Krämpferstraße", "Greifswalder Straße"],
    text: "Gründerzeit-Altbau, beliebt bei jungen Leuten." },
  { name: "Löbervorstadt", x: -0.2, y: -1.3, kaltMin: 9.4, kaltMax: 11.5, platte: false,
    strassen: ["Löberstraße", "Gustav-Freytag-Straße", "Arndtstraße", "Hochheimer Straße"],
    text: "Ruhig, grün, nahe am Steigerwald." },
  { name: "Brühlervorstadt", x: -1.2, y: -0.4, kaltMin: 9.0, kaltMax: 11.0, platte: false,
    strassen: ["Brühler Straße", "Cyriakstraße", "Pförtchenstraße", "Heinrichstraße"],
    text: "Altbau, Nähe egapark und Petersberg." },
  { name: "Andreasvorstadt", x: -0.8, y: 0.9, kaltMin: 8.6, kaltMax: 10.2, platte: false,
    strassen: ["Nordhäuser Straße", "Andreasstraße", "Blumenstraße", "Leipziger Straße"],
    text: "Nahe Uni und Nordstrand, viele WGs." },
  { name: "Ilversgehofen", x: 0.3, y: 2.3, kaltMin: 8.2, kaltMax: 9.6, platte: false,
    strassen: ["Magdeburger Allee", "Bebelstraße", "Salinenstraße", "Mittelhäuser Straße"],
    text: "Arbeiterviertel im Wandel, günstiger Altbau." },
  { name: "Daberstedt", x: 1.4, y: -1.2, kaltMin: 7.8, kaltMax: 9.2, platte: true,
    strassen: ["Häßlerstraße", "Hans-Grundig-Straße", "Kranichfelder Straße", "Arnstädter Straße"],
    text: "Mischung aus Platte und Neubau, gute Straßenbahn." },
  { name: "Herrenberg", x: 2.3, y: -3.2, kaltMin: 6.6, kaltMax: 7.8, platte: true,
    strassen: ["Hans-Sailer-Straße", "Marcel-Breuer-Ring", "Eislebener Straße"],
    text: "Plattenbau am Stadtrand, günstig, Tram 3 und 4." },
  { name: "Wiesenhügel", x: 1.5, y: -3.8, kaltMin: 6.5, kaltMax: 7.6, platte: true,
    strassen: ["Stuttgarter Straße", "Mainzer Straße", "Kölner Straße"],
    text: "Günstige Platte im Süden, viel Grün." },
  { name: "Melchendorf", x: 2.6, y: -2.2, kaltMin: 6.8, kaltMax: 8.0, platte: true,
    strassen: ["Allendestraße", "Paul-Schäfer-Straße", "Wiesenhügeler Weg"],
    text: "Ruhig, günstig, Tram 3." },
  { name: "Rieth", x: 0.6, y: 3.3, kaltMin: 6.4, kaltMax: 7.4, platte: true,
    strassen: ["Riethstraße", "Mainzerhofstraße", "Vilniuser Straße"],
    text: "Plattenbau im Norden — sehr günstig, Nähe Nordstrand." },
  { name: "Roter Berg", x: -0.3, y: 4.2, kaltMin: 6.3, kaltMax: 7.3, platte: true,
    strassen: ["Warschauer Straße", "Karl-Reimann-Ring", "Budapester Straße"],
    text: "Große Wohnanlagen, günstig, Tram 1." },
  { name: "Moskauer Platz", x: -1.2, y: 3.9, kaltMin: 6.4, kaltMax: 7.4, platte: true,
    strassen: ["Moskauer Straße", "Tungerstraße", "Hanoier Straße"],
    text: "Plattenbau im Nordwesten, Tram 3 und 6." },
  { name: "Berliner Platz", x: -1.6, y: 3.2, kaltMin: 6.5, kaltMax: 7.5, platte: true,
    strassen: ["Berliner Straße", "Sofioter Straße", "Bukarester Straße"],
    text: "Günstig, einfache Ausstattung." },
  { name: "Johannesplatz", x: 1.5, y: 1.6, kaltMin: 7.0, kaltMax: 8.3, platte: true,
    strassen: ["Iderhoffstraße", "Julius-Leber-Ring", "Wilhelm-Wolff-Straße"],
    text: "Nahe Zentrum, sanierte Platte." },
  { name: "Hochheim", x: -2.3, y: -1.6, kaltMin: 8.8, kaltMax: 10.5, platte: false,
    strassen: ["Hochheimer Straße", "Am Kalkrain", "Egstedter Weg"],
    text: "Fast dörflich, Einfamilienhäuser und wenige Mietwohnungen." },
];

export const STADTTEIL = new Map(STADTTEILE.map((s) => [s.name, s]));

/** Wo die Eltern wohnen. */
export const ELTERN_ORTE = {
  erfurt: { name: "Herrenberg (bei den Eltern)", stadtteil: "Herrenberg", x: 2.3, y: -3.2, extraMin: 0 },
  land: { name: "Kölleda (bei den Eltern, 30 km)", stadtteil: "Kölleda", x: 8, y: 26, extraMin: 35 },
} as const;

type Rng = () => number;

function wahl<T>(r: Rng, liste: T[]): T {
  return liste[Math.floor(r() * liste.length)];
}

export function entfernung(ax: number, ay: number, bx: number, by: number): number {
  return Math.round(Math.hypot(ax - bx, ay - by) * 1.3 * 10) / 10;
}

/** ÖPNV-Fahrzeit in Minuten (Takt, Umstieg, Fußweg eingerechnet). */
export function fahrzeit(km: number, extraMin = 0): number {
  return Math.round(8 + km * 3.2 + extraMin);
}

/** Anzeigen der Woche. `betrieb` = Lage des Arbeitsplatzes (km vom Anger). */
export function anzeigen(r: Rng, woche: number, betrieb: { x: number; y: number }, preisindex: number): Wohnung[] {
  const liste: Wohnung[] = [];
  const anzahl = 7 + Math.floor(r() * 4);
  for (let i = 0; i < anzahl; i++) {
    const art = r();
    const st = wahl(r, STADTTEILE);
    const km = entfernung(st.x, st.y, betrieb.x, betrieb.y);
    const strasse = `${wahl(r, st.strassen)} ${1 + Math.floor(r() * 80)}`;
    const id = `w${woche}-${i}`;
    if (art < 0.35) {
      // WG-Zimmer
      const qm = 12 + Math.floor(r() * 10);
      const warm = Math.round((290 + qm * 6 + r() * 60) * preisindex);
      const nk = Math.round(warm * 0.22);
      liste.push({
        id, form: "wg", titel: `WG-Zimmer, ${qm} m², ${2 + Math.floor(r() * 2)}er-WG`, adresse: strasse, stadtteil: st.name,
        qm, zimmer: 1, kalt: warm - nk - 45, nebenkosten: nk, heizung: 45, kaution: Math.round(warm * (1 + Math.floor(r() * 2))),
        genossenschaftsanteile: 0, ebk: true, etage: Math.floor(r() * 5), fahrzeitArbeit: fahrzeit(km), entfernungKm: km,
        einzug: 0, kwh: 0, moebliert: r() < 0.3,
      });
    } else {
      const zimmer = r() < 0.55 ? 1 : 2;
      const qm = zimmer === 1 ? 24 + Math.floor(r() * 14) : 38 + Math.floor(r() * 18);
      const proQm = st.kaltMin + r() * (st.kaltMax - st.kaltMin);
      const kalt = Math.round(qm * proQm * preisindex);
      const genossenschaft = st.platte && r() < 0.5;
      const ebk = r() < (st.platte ? 0.35 : 0.55);
      liste.push({
        id, form: "wohnung",
        titel: `${zimmer}-Raum-Wohnung, ${qm} m²${ebk ? ", mit EBK" : ""}${genossenschaft ? " (Genossenschaft)" : ""}`,
        adresse: strasse, stadtteil: st.name, qm, zimmer, kalt,
        nebenkosten: Math.round(qm * 2.2), heizung: Math.round(qm * 1.3),
        kaution: genossenschaft ? kalt : kalt * 3,
        genossenschaftsanteile: genossenschaft ? 300 * (2 + Math.floor(r() * 3)) : 0,
        ebk, ablöse: !ebk && r() < 0.3 ? 300 + Math.round(r() * 700) : undefined,
        etage: Math.floor(r() * (st.platte ? 11 : 5)), fahrzeitArbeit: fahrzeit(km), entfernungKm: km, einzug: 0, kwh: 0,
      });
    }
  }
  if (r() < 0.5) {
    liste.push({
      id: `w${woche}-heim`, form: "azubiwohnheim", titel: "Zimmer im Azubi-Wohnheim, 16 m², möbliert (fiktiv)",
      adresse: "Am Wohnheim 3 (fiktiv)", stadtteil: "Daberstedt", qm: 16, zimmer: 1,
      kalt: Math.round(230 * preisindex), nebenkosten: 60, heizung: 0, kaution: 300, genossenschaftsanteile: 0,
      ebk: true, moebliert: true, etage: 2, fahrzeitArbeit: fahrzeit(entfernung(1.4, -1.2, betrieb.x, betrieb.y)),
      entfernungKm: entfernung(1.4, -1.2, betrieb.x, betrieb.y), einzug: 0, kwh: 0,
    });
  }
  return liste;
}

export function warmmiete(w: Wohnung): number {
  return w.kalt + w.nebenkosten + w.heizung;
}

/**
 * Chance, dass der Vermieter zusagt. Faustregel der Vermieter: Warmmiete
 * höchstens ein Drittel des Nettoeinkommens; Bürgschaft der Eltern und
 * Genossenschaften/Wohnheime helfen, negative Schufa schadet.
 */
export function zusageChance(w: Wohnung, netto: number, opt: { buergschaft: boolean; schufaNegativ: boolean; minderjaehrig: boolean }): number {
  if (w.form === "azubiwohnheim") return 0.9;
  const quote = warmmiete(w) / Math.max(1, netto);
  let p = quote <= 0.33 ? 0.7 : quote <= 0.45 ? 0.45 : quote <= 0.6 ? 0.2 : 0.05;
  if (w.form === "wg") p += 0.15; // WGs casten nach Sympathie
  if (w.genossenschaftsanteile > 0) p += 0.1;
  if (opt.buergschaft) p += 0.2;
  if (opt.schufaNegativ) p *= 0.2;
  if (opt.minderjaehrig && !opt.buergschaft) p *= 0.3;
  return Math.max(0.02, Math.min(0.95, p));
}
