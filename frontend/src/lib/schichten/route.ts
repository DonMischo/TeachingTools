/**
 * Der Weg von Lenas Handy in Erfurt zum Server in Tokio.
 *
 * Vereinfacht auf die wichtigen Stationen: Echte Wege haben 15–25 Router,
 * hier sind es acht. Die Seekabel folgen grob dem Verlauf von Kabeln wie
 * SEA-ME-WE oder AAE-1 (Mittelmeer, Suezkanal, Rotes Meer, Indischer Ozean).
 * Alle IP-Adressen außer 192.168.178.x stammen aus den Dokumentations-
 * bereichen (RFC 5737), MAC-Adressen sind ausgedacht.
 */

export type Medium = "funk" | "kupfer" | "glas" | "see";

export interface Knoten {
  name: string;
  ort: string;
  geraet: string;
  lon: number;
  lat: number;
  mac: string;
  /** Router, der das Paket weiterreicht (zählt die TTL herunter) */
  router: boolean;
}

export interface Leitung {
  medium: Medium;
  /** Bandbreite in Bit/s */
  bandbreite: number;
  /** Zwischenpunkte [lon, lat] für die Karte */
  ueber: [number, number][];
  text: string;
}

export const MEDIEN: Record<Medium, { name: string; icon: string; tempo: number; signal: string }> = {
  funk: { name: "WLAN (Funk)", icon: "📶", tempo: 299_792, signal: "Funkwellen bei 5 GHz — die Bits stecken in Phase und Stärke der Welle" },
  kupfer: { name: "VDSL (Kupfer)", icon: "🔌", tempo: 200_000, signal: "Spannungspulse im Telefonkabel bis zum grauen Verteilerkasten" },
  glas: { name: "Glasfaser", icon: "💡", tempo: 204_000, signal: "Lichtpulse im Glasfaserkabel — Licht an = 1, Licht aus = 0" },
  see: { name: "Seekabel (Glasfaser)", icon: "🌊", tempo: 204_000, signal: "Lichtpulse in einem gartenschlauchdicken Kabel am Meeresboden, alle 50–80 km frisch verstärkt" },
};

export const KNOTEN: Knoten[] = [
  { name: "Lenas Handy", ort: "Erfurt", geraet: "Smartphone", lon: 11.03, lat: 50.98, mac: "5a:3c:91:2e:47:b8", router: false },
  { name: "WLAN-Router", ort: "Erfurt, zu Hause", geraet: "Heimrouter mit NAT", lon: 11.06, lat: 50.96, mac: "dc:39:6f:a1:08:42", router: true },
  { name: "Provider-Knoten", ort: "Erfurt", geraet: "Router des Internetanbieters", lon: 11.12, lat: 50.99, mac: "00:1f:ca:7d:30:01", router: true },
  { name: "DE-CIX", ort: "Frankfurt am Main", geraet: "Internetknoten, einer der größten der Welt", lon: 8.68, lat: 50.11, mac: "00:1f:ca:7d:31:0f", router: true },
  { name: "Kabelstation", ort: "Marseille", geraet: "Landestation der Seekabel", lon: 5.37, lat: 43.3, mac: "84:b8:02:5e:11:c4", router: true },
  { name: "Kabelstation", ort: "Dschibuti", geraet: "Knoten am Horn von Afrika", lon: 43.15, lat: 11.6, mac: "84:b8:02:61:7a:20", router: true },
  { name: "Kabelstation", ort: "Mumbai", geraet: "Landestation Indien", lon: 72.82, lat: 18.96, mac: "f4:cc:55:09:e2:31", router: true },
  { name: "Internetknoten", ort: "Singapur", geraet: "Drehkreuz Südostasien", lon: 103.85, lat: 1.29, mac: "f4:cc:55:0a:13:77", router: true },
  { name: "Internetknoten", ort: "Hongkong", geraet: "Drehkreuz Ostasien", lon: 114.17, lat: 22.3, mac: "2c:6b:f5:44:90:5d", router: true },
  { name: "Server", ort: "Tokio", geraet: "Rechenzentrum von PurrMsg", lon: 139.69, lat: 35.68, mac: "0c:c4:7a:8e:21:f3", router: false },
];

export const LEITUNGEN: Leitung[] = [
  { medium: "funk", bandbreite: 300e6, ueber: [], text: "Funkstrecke durch die Wohnung" },
  { medium: "kupfer", bandbreite: 40e6, ueber: [], text: "Telefonleitung zum Verteilerkasten, dann Glasfaser zum Anbieter — der Upload ist der Engpass" },
  { medium: "glas", bandbreite: 100e9, ueber: [[10.0, 50.6]], text: "Glasfaser entlang von Autobahn und Bahn" },
  { medium: "glas", bandbreite: 100e9, ueber: [[7.75, 48.58], [4.85, 45.76]], text: "Glasfaser über Straßburg und Lyon ans Mittelmeer" },
  {
    medium: "see", bandbreite: 100e9, text: "Seekabel durchs Mittelmeer, den Suezkanal und das Rote Meer",
    ueber: [[7.5, 40.5], [11.5, 37.6], [19.5, 34.8], [28, 33.2], [32.3, 31.3], [32.55, 29.95], [33.8, 27.6], [37.2, 22.5], [40.5, 17.0], [43.3, 12.7]],
  },
  { medium: "see", bandbreite: 100e9, ueber: [[46, 12.2], [51.5, 13], [58, 15.5], [66, 18]], text: "Seekabel durch den Golf von Aden und das Arabische Meer" },
  {
    medium: "see", bandbreite: 100e9, text: "Seekabel um Indien und Sri Lanka, dann durch die Straße von Malakka",
    ueber: [[72.5, 14], [74.5, 8.0], [77.5, 5.2], [81, 5.3], [88, 5.6], [95, 6.2], [98.2, 4.8], [100.3, 3.0], [101.8, 2.2]],
  },
  { medium: "see", bandbreite: 100e9, ueber: [[105.5, 2.5], [109, 7], [112, 12], [114.2, 18]], text: "Seekabel durchs Südchinesische Meer" },
  {
    medium: "see", bandbreite: 100e9, text: "Seekabel an Taiwan vorbei nach Japan, dann an Land nach Tokio",
    ueber: [[117, 22.5], [120.8, 21.2], [123, 24], [128, 28.5], [133, 31.5], [137.5, 33.8], [139.9, 34.9]],
  },
];

/** Der Heimrouter tauscht die private Absenderadresse gegen die öffentliche (NAT). */
export const NAT_NACH_KNOTEN = 1;

export const ADRESSEN = {
  handy: "192.168.178.23",
  oeffentlich: "198.51.100.23",
  server: "203.0.113.7",
  handyPort: 52814,
  natPort: 40122,
  serverPort: 443,
  name: "tokio.purrmsg.example",
};

const ERDRADIUS = 6371;
export function km(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dl = (b[1] - a[1]) * r, dn = (b[0] - a[0]) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dn / 2) ** 2;
  return 2 * ERDRADIUS * Math.asin(Math.sqrt(h));
}

/** Alle Punkte einer Leitung, von Knoten i zu Knoten i+1 */
export function linienzug(i: number): [number, number][] {
  const a = KNOTEN[i], b = KNOTEN[i + 1];
  return [[a.lon, a.lat], ...LEITUNGEN[i].ueber, [b.lon, b.lat]];
}

export function leitungsLaenge(i: number): number {
  const p = linienzug(i);
  let s = 0;
  for (let k = 1; k < p.length; k++) s += km(p[k - 1], p[k]);
  // In der Wohnung sind es Meter, nicht Kilometer
  return i === 0 ? 0.01 : s;
}

/** Laufzeit eines Rahmens über eine Leitung in ms: Ausbreitung + Senden aller Bits + Bearbeitung im Router */
export function verzoegerung(i: number, rahmenBytes: number): { ausbreitung: number; senden: number; router: number } {
  const l = LEITUNGEN[i];
  return {
    ausbreitung: (leitungsLaenge(i) / MEDIEN[l.medium].tempo) * 1000,
    senden: ((rahmenBytes + 8 + 12) * 8 / l.bandbreite) * 1000,
    router: KNOTEN[i + 1].router ? 0.05 : 0,
  };
}

/** TTL, mit der das Paket auf Leitung i unterwegs ist (jeder Router davor zieht eins ab) */
export function ttlAuf(i: number, start = 64): number {
  let ttl = start;
  for (let k = 1; k <= i; k++) if (KNOTEN[k].router) ttl--;
  return ttl;
}

export interface Zeitbedarf {
  rttMs: number;
  einwegMs: number;
  runden: number;
  engpassMs: number;
  gesamtMs: number;
}

/**
 * Wie lange das ganze Foto braucht: TCP-Handschlag (1 Hin und Zurück),
 * TLS-Handschlag (1), dann Slow Start — TCP schickt erst 10 Segmente, nach
 * jeder Bestätigung doppelt so viele —, dazu die Sendezeit am Engpass.
 */
export function zeitbedarf(segmente: number, bytes: number): Zeitbedarf {
  let einweg = 0;
  for (let i = 0; i < LEITUNGEN.length; i++) {
    const v = verzoegerung(i, 1514);
    einweg += v.ausbreitung + v.router;
  }
  const rtt = 2 * einweg;
  let runden = 0, fenster = 10, geschickt = 0;
  while (geschickt < segmente) { geschickt += fenster; fenster *= 2; runden++; }
  const engpass = Math.min(...LEITUNGEN.map(l => l.bandbreite));
  const engpassMs = (bytes * 8 / engpass) * 1000;
  return { rttMs: rtt, einwegMs: einweg, runden, engpassMs, gesamtMs: 2 * rtt + (runden - 1) * rtt + einweg + engpassMs };
}
