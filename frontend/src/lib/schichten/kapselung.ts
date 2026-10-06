/**
 * Kapselung echt gerechnet: Aus dem Foto (oder einem Text) wird
 *   7  eine HTTP-Anfrage (davor die DNS-Frage nach der Adresse),
 *   6  TLS-1.3-Datensätze, verschlüsselt mit ChaCha20-Poly1305,
 *   5  eine Sitzung (TLS-Handschlag; im Internet ohne eigenen Kopf),
 *   4  TCP-Segmente mit Folgenummer und Prüfsumme,
 *   3  IPv4-Pakete mit Ziel, Absender, TTL und Kopfprüfsumme,
 *   2  Ethernet-Rahmen mit MAC-Adressen und CRC-32,
 *   1  Bits auf der Leitung.
 * Rahmen und Pakete werden je Leitung neu gebaut: Jeder Router zieht die TTL
 * ab, rechnet die IP-Prüfsumme neu und verpackt in einen neuen Rahmen; der
 * Heimrouter tauscht außerdem Absenderadresse und -port (NAT).
 * Auf der anderen Seite wird alles geprüft und wieder ausgepackt.
 */
import {
  crc32, internetSumme, ipBytes, ipText, lies16, lies32, macBytes, macText, schreibe16, schreibe32, text, verbinde,
} from "./bytes";
import { oeffnen, versiegeln } from "./chacha";
import { ADRESSEN, KNOTEN, LEITUNGEN, NAT_NACH_KNOTEN, ttlAuf } from "./route";

export type SchichtNr = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const SCHICHTEN: { nr: SchichtNr; name: string; en: string; tcpip: string; farbe: string; einheit: string }[] = [
  { nr: 7, name: "Anwendung", en: "Application", tcpip: "Anwendung", farbe: "#f59e0b", einheit: "Nachricht" },
  { nr: 6, name: "Darstellung", en: "Presentation", tcpip: "Anwendung", farbe: "#f97316", einheit: "Nachricht" },
  { nr: 5, name: "Sitzung", en: "Session", tcpip: "Anwendung", farbe: "#ec4899", einheit: "Nachricht" },
  { nr: 4, name: "Transport", en: "Transport", tcpip: "Transport", farbe: "#a855f7", einheit: "Segment" },
  { nr: 3, name: "Vermittlung", en: "Network", tcpip: "Internet", farbe: "#6366f1", einheit: "Paket" },
  { nr: 2, name: "Sicherung", en: "Data Link", tcpip: "Netzzugang", farbe: "#3b82f6", einheit: "Rahmen" },
  { nr: 1, name: "Bitübertragung", en: "Physical", tcpip: "Netzzugang", farbe: "#06b6d4", einheit: "Bits" },
];
export const schicht = (nr: SchichtNr) => SCHICHTEN.find(s => s.nr === nr)!;

/** Ein Feld in einem Kopf, mit Lage im Byte-Feld */
export interface Feld {
  name: string;
  wert: string;
  von: number;
  laenge: number;
  erkl: string;
}

/** Ein eingefärbter Abschnitt im Hex-Bild */
export interface Bereich {
  schicht: SchichtNr;
  name: string;
  von: number;
  laenge: number;
}

export const TLS_MAX = 16384;
export const MSS = 1460;
const ISN_LENA = 0x3a1f0c00;
const ISN_SERVER = 0x9b2e4100;
const IP_ID = 0x1c46;

export interface Datensatz {
  /** Lage im TLS-Strom */
  von: number;
  kopf: Uint8Array;
  versiegelt: Uint8Array;
  klarLaenge: number;
}

export interface Segment {
  nr: number;
  seq: number;
  /** Lage im TLS-Strom */
  von: number;
  nutzlast: Uint8Array;
}

export interface Reise {
  inhalt: Uint8Array;
  art: "jpeg" | "text";
  /** Größe vor der Darstellungsschicht (Rohpixel bzw. Zeichen) */
  rohGroesse: number;
  httpKopf: string;
  http: Uint8Array;
  dns: Uint8Array;
  schluessel: Uint8Array;
  iv: Uint8Array;
  datensaetze: Datensatz[];
  strom: Uint8Array;
  segmente: Segment[];
}

/** reproduzierbare Pseudozufallsbytes (für Schlüssel, damit Tests stabil sind) */
function zufallsbytes(n: number, seed: number): Uint8Array {
  let a = seed >>> 0;
  return Uint8Array.from({ length: n }, () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) & 0xff;
  });
}

/** DNS-Anfrage (RFC 1035): »Welche IP-Adresse hat dieser Name?« */
export function dnsAnfrage(name: string, id = 0x1a2b): Uint8Array {
  const labels = name.split(".").flatMap(l => [l.length, ...text(l)]);
  const b = new Uint8Array(12 + labels.length + 1 + 4);
  schreibe16(b, 0, id);
  schreibe16(b, 2, 0x0100); // Rekursion erwünscht
  schreibe16(b, 4, 1);
  b.set(labels, 12);
  const o = 12 + labels.length + 1;
  schreibe16(b, o, 1); // Typ A (IPv4)
  schreibe16(b, o + 2, 1); // Klasse IN
  return b;
}

function tlsNonce(iv: Uint8Array, folge: number): Uint8Array {
  const n = iv.slice();
  for (let i = 0; i < 4; i++) n[11 - i] ^= (folge >>> (8 * i)) & 0xff;
  return n;
}

/** Baut die ganze Reise von Schicht 7 bis 4. */
export function packe(inhalt: Uint8Array, art: "jpeg" | "text", rohGroesse: number, seed = 7): Reise {
  const httpKopf =
    `POST /v1/fotos HTTP/1.1\r\nHost: ${ADRESSEN.name}\r\n` +
    `Content-Type: ${art === "jpeg" ? "image/jpeg" : "text/plain; charset=utf-8"}\r\nContent-Length: ${inhalt.length}\r\n\r\n`;
  const http = verbinde(text(httpKopf), inhalt);

  const schluessel = zufallsbytes(32, seed);
  const iv = zufallsbytes(12, seed + 1);
  const datensaetze: Datensatz[] = [];
  const teile: Uint8Array[] = [];
  let von = 0;
  for (let o = 0, folge = 0; o < http.length; o += TLS_MAX, folge++) {
    // TLS 1.3: hinter die Daten kommt der echte Inhaltstyp (0x17), dann wird versiegelt
    const innen = verbinde(http.subarray(o, o + TLS_MAX), Uint8Array.of(0x17));
    const kopf = Uint8Array.of(0x17, 0x03, 0x03, 0, 0);
    schreibe16(kopf, 3, innen.length + 16);
    const versiegelt = versiegeln(schluessel, tlsNonce(iv, folge), innen, kopf);
    datensaetze.push({ von, kopf, versiegelt, klarLaenge: innen.length - 1 });
    teile.push(kopf, versiegelt);
    von += 5 + versiegelt.length;
  }
  const strom = verbinde(...teile);

  const segmente: Segment[] = [];
  for (let o = 0; o < strom.length; o += MSS) {
    segmente.push({ nr: segmente.length + 1, seq: (ISN_LENA + 1 + o) >>> 0, von: o, nutzlast: strom.subarray(o, o + MSS) });
  }
  return { inhalt, art, rohGroesse, httpKopf, http, dns: dnsAnfrage(ADRESSEN.name), schluessel, iv, datensaetze, strom, segmente };
}

// ── Schicht 4 bis 2, je Leitung ─────────────────────────────────────────────

export interface Rahmen {
  /** vollständiger Ethernet-Rahmen samt FCS */
  bytes: Uint8Array;
  bereiche: Bereich[];
  eth: Feld[];
  ip: Feld[];
  tcp: Feld[];
  fcs: number;
}

function tcpKopf(seg: Segment, letzter: boolean, quellPort: number, quelle: Uint8Array, ziel: Uint8Array): Uint8Array {
  const k = new Uint8Array(20);
  schreibe16(k, 0, quellPort);
  schreibe16(k, 2, ADRESSEN.serverPort);
  schreibe32(k, 4, seg.seq);
  schreibe32(k, 8, (ISN_SERVER + 1) >>> 0);
  k[12] = 5 << 4; // Kopflänge 5 × 4 Byte
  k[13] = letzter ? 0x18 : 0x10; // ACK (+ PSH beim letzten)
  schreibe16(k, 14, 0xffff);
  const pseudo = new Uint8Array(12);
  pseudo.set(quelle, 0);
  pseudo.set(ziel, 4);
  pseudo[9] = 6;
  schreibe16(pseudo, 10, 20 + seg.nutzlast.length);
  schreibe16(k, 16, internetSumme(pseudo, k, seg.nutzlast));
  return k;
}

function ipKopf(laenge: number, id: number, ttl: number, quelle: Uint8Array, ziel: Uint8Array): Uint8Array {
  const k = new Uint8Array(20);
  k[0] = 0x45;
  schreibe16(k, 2, laenge);
  schreibe16(k, 4, id);
  schreibe16(k, 6, 0x4000); // nicht zerlegen (DF)
  k[8] = ttl;
  k[9] = 6; // TCP
  k.set(quelle, 12);
  k.set(ziel, 16);
  schreibe16(k, 10, internetSumme(k));
  return k;
}

/** Segment `nr` (ab 1) als Rahmen auf Leitung `leitung` (0 = WLAN in Lenas Wohnung). */
export function rahmen(r: Reise, nr: number, leitung: number): Rahmen {
  const seg = r.segmente[nr - 1];
  const nachNat = leitung >= NAT_NACH_KNOTEN;
  const quelle = ipBytes(nachNat ? ADRESSEN.oeffentlich : ADRESSEN.handy);
  const ziel = ipBytes(ADRESSEN.server);
  const port = nachNat ? ADRESSEN.natPort : ADRESSEN.handyPort;
  const tcp = tcpKopf(seg, nr === r.segmente.length, port, quelle, ziel);
  const ttl = ttlAuf(leitung);
  const ip = ipKopf(40 + seg.nutzlast.length, (IP_ID + nr) & 0xffff, ttl, quelle, ziel);
  const von = KNOTEN[leitung], nach = KNOTEN[leitung + 1];
  const eth = verbinde(macBytes(nach.mac), macBytes(von.mac), Uint8Array.of(0x08, 0x00));
  const ohneFcs = verbinde(eth, ip, tcp, seg.nutzlast);
  const fcs = crc32(ohneFcs);
  // Auf der Leitung kommt die CRC mit dem niedrigsten Byte zuerst
  const bytes = verbinde(ohneFcs, Uint8Array.of(fcs & 0xff, (fcs >>> 8) & 0xff, (fcs >>> 16) & 0xff, fcs >>> 24));

  const bereiche: Bereich[] = [
    { schicht: 2, name: "Ethernet-Kopf", von: 0, laenge: 14 },
    { schicht: 3, name: "IPv4-Kopf", von: 14, laenge: 20 },
    { schicht: 4, name: "TCP-Kopf", von: 34, laenge: 20 },
  ];
  // Die Nutzlast ist ein Stück TLS-Strom: Datensatz-Köpfe und Siegel gehören zu Schicht 6
  const a = seg.von, e = seg.von + seg.nutzlast.length;
  let pos = a;
  const nutz = (bis: number) => { if (bis > pos) bereiche.push({ schicht: 7, name: "Daten (verschlüsselt)", von: 54 + pos - a, laenge: bis - pos }); };
  for (const d of r.datensaetze) {
    const stuecke: [number, number, string][] = [
      [d.von, d.von + 5, "TLS-Datensatzkopf"],
      [d.von + 5 + d.versiegelt.length - 16, d.von + 5 + d.versiegelt.length, "TLS-Siegel (Poly1305)"],
    ];
    for (const [x, y, name] of stuecke) {
      const s = Math.max(x, a), t = Math.min(y, e);
      if (s >= t) continue;
      nutz(s);
      bereiche.push({ schicht: 6, name, von: 54 + s - a, laenge: t - s });
      pos = t;
    }
  }
  nutz(e);
  bereiche.push({ schicht: 2, name: "Prüfsumme (FCS)", von: bytes.length - 4, laenge: 4 });

  return {
    bytes,
    bereiche,
    fcs,
    eth: [
      { name: "Ziel-MAC", wert: macText(macBytes(nach.mac)), von: 0, laenge: 6, erkl: `${nach.name} (${nach.ort}) — nur das nächste Gerät, nicht Tokio` },
      { name: "Absender-MAC", wert: macText(macBytes(von.mac)), von: 6, laenge: 6, erkl: `${von.name} (${von.ort})` },
      { name: "Typ", wert: "0x0800", von: 12, laenge: 2, erkl: "Drinnen steckt ein IPv4-Paket" },
    ],
    ip: [
      { name: "Version / Kopflänge", wert: "4 / 20 Byte", von: 14, laenge: 1, erkl: "IPv4, Kopf aus 5 × 4 Byte" },
      { name: "Gesamtlänge", wert: `${lies16(ip, 2)} Byte`, von: 16, laenge: 2, erkl: "IP-Kopf + TCP-Kopf + Daten" },
      { name: "Kennung", wert: `0x${lies16(ip, 4).toString(16)}`, von: 18, laenge: 2, erkl: "Nummer des Pakets" },
      { name: "Flags", wert: "DF", von: 20, laenge: 2, erkl: "»Nicht zerlegen« — lieber Fehler melden als zerstückeln" },
      { name: "TTL", wert: `${ttl}`, von: 22, laenge: 1, erkl: "Lebensdauer: jeder Router zieht 1 ab, bei 0 wird das Paket weggeworfen — so kreist nichts ewig" },
      { name: "Protokoll", wert: "6 (TCP)", von: 23, laenge: 1, erkl: "Drinnen steckt ein TCP-Segment" },
      { name: "Kopfprüfsumme", wert: `0x${lies16(ip, 10).toString(16).padStart(4, "0")}`, von: 24, laenge: 2, erkl: "Ändert sich bei jedem Router, weil die TTL sich ändert" },
      { name: "Absender", wert: ipText(quelle), von: 26, laenge: 4, erkl: nachNat ? "Öffentliche Adresse des Heimrouters — er hat die private Adresse ausgetauscht (NAT)" : "Private Adresse im Heimnetz — draußen unbekannt" },
      { name: "Ziel", wert: ipText(ziel), von: 30, laenge: 4, erkl: `Der Server in Tokio (${ADRESSEN.name}) — bleibt auf dem ganzen Weg gleich` },
    ],
    tcp: [
      { name: "Absender-Port", wert: `${port}`, von: 34, laenge: 2, erkl: nachNat ? "Vom Heimrouter neu vergeben — so findet er die Antwort wieder" : "Zufällig gewählte Nummer für dieses Gespräch" },
      { name: "Ziel-Port", wert: "443", von: 36, laenge: 2, erkl: "443 = HTTPS: Die Daten gehen an den verschlüsselten Webdienst" },
      { name: "Folgenummer", wert: `${seg.seq}`, von: 38, laenge: 4, erkl: `Stelle im Datenstrom — Byte ${seg.von} bis ${seg.von + seg.nutzlast.length - 1}. Damit setzt Tokio die Stücke in der richtigen Reihenfolge zusammen` },
      { name: "Bestätigung", wert: `${lies32(tcp, 8)}`, von: 42, laenge: 4, erkl: "»Bis hierhin habe ich von dir alles« — Antwort auf den Server" },
      { name: "Flags", wert: nr === r.segmente.length ? "ACK, PSH" : "ACK", von: 46, laenge: 2, erkl: "PSH beim letzten Stück: »Gib es jetzt an die App weiter«" },
      { name: "Fenster", wert: "65535", von: 48, laenge: 2, erkl: "So viele Byte darf die Gegenseite schicken, ohne auf Bestätigung zu warten" },
      { name: "Prüfsumme", wert: `0x${lies16(tcp, 16).toString(16).padStart(4, "0")}`, von: 50, laenge: 2, erkl: "Über Kopf, Daten und die IP-Adressen — deshalb muss der Heimrouter sie bei NAT neu rechnen" },
    ],
  };
}

// ── Empfang in Tokio ────────────────────────────────────────────────────────

export interface Pruefung {
  fcs: boolean;
  ip: boolean;
  tcp: boolean;
}

/** Prüft einen angekommenen Rahmen auf allen drei Prüfsummen. */
export function pruefe(b: Uint8Array): Pruefung {
  const ohne = b.subarray(0, b.length - 4);
  const f = b.length - 4;
  const fcs = (b[f] | (b[f + 1] << 8) | (b[f + 2] << 16) | (b[f + 3] << 24)) >>> 0;
  const ip = b.subarray(14, 34);
  const tcpUndDaten = b.subarray(34, f);
  const pseudo = new Uint8Array(12);
  pseudo.set(ip.subarray(12, 20), 0);
  pseudo[9] = 6;
  schreibe16(pseudo, 10, tcpUndDaten.length);
  return { fcs: crc32(ohne) === fcs, ip: internetSumme(ip) === 0, tcp: internetSumme(pseudo, tcpUndDaten) === 0 };
}

export interface Auspacken {
  /** Rahmen in Folgenummer-Reihenfolge wieder zusammengesetzt */
  strom: Uint8Array;
  datensaetze: number;
  /** null, wenn ein Siegel nicht stimmt */
  http: Uint8Array | null;
  kopf: string;
  inhalt: Uint8Array | null;
}

/** Setzt aus angekommenen Rahmen (beliebige Reihenfolge) den Inhalt wieder zusammen. */
export function auspacken(r: Reise, rahmenListe: Uint8Array[]): Auspacken {
  const stuecke = rahmenListe
    .map(b => ({ seq: lies32(b, 38), daten: b.subarray(54, b.length - 4) }))
    .sort((a, b) => a.seq - b.seq);
  const strom = verbinde(...stuecke.map(s => s.daten));
  const teile: Uint8Array[] = [];
  let o = 0, folge = 0, ok = true;
  while (o + 5 <= strom.length) {
    const kopf = strom.subarray(o, o + 5);
    const laenge = lies16(kopf, 3);
    const innen = oeffnen(r.schluessel, tlsNonce(r.iv, folge), strom.subarray(o + 5, o + 5 + laenge), kopf);
    if (!innen) { ok = false; break; }
    teile.push(innen.subarray(0, innen.length - 1));
    o += 5 + laenge;
    folge++;
  }
  if (!ok) return { strom, datensaetze: folge, http: null, kopf: "", inhalt: null };
  const http = verbinde(...teile);
  let trenn = -1;
  for (let i = 0; i + 3 < http.length; i++) {
    if (http[i] === 13 && http[i + 1] === 10 && http[i + 2] === 13 && http[i + 3] === 10) { trenn = i; break; }
  }
  return {
    strom, datensaetze: folge, http,
    kopf: new TextDecoder().decode(http.subarray(0, trenn)),
    inhalt: trenn >= 0 ? http.subarray(trenn + 4) : null,
  };
}

/** Alle Rahmen auf der letzten Leitung — so, wie sie in Tokio ankommen. */
export function alleRahmenInTokio(r: Reise): Uint8Array[] {
  return r.segmente.map(s => rahmen(r, s.nr, LEITUNGEN.length - 1).bytes);
}

// ── Für das Spiel: ein Rahmen aus selbst gewählten Werten ───────────────────

export interface Bauteile {
  nutzlast: Uint8Array;
  seq: number;
  quellIp: string;
  zielIp: string;
  quellPort: number;
  zielPort: number;
  ttl: number;
  vonMac: string;
  nachMac: string;
}

/** Ethernet + IPv4 + TCP um eine unverschlüsselte Nutzlast, mit echten Prüfsummen. */
export function baueRahmen(t: Bauteile): { bytes: Uint8Array; bereiche: Bereich[] } {
  const quelle = ipBytes(t.quellIp), ziel = ipBytes(t.zielIp);
  const seg: Segment = { nr: 1, seq: t.seq >>> 0, von: 0, nutzlast: t.nutzlast };
  const tcp = tcpKopf(seg, true, t.quellPort, quelle, ziel);
  schreibe16(tcp, 2, t.zielPort);
  // Zielport geändert → Prüfsumme neu
  tcp[16] = tcp[17] = 0;
  const pseudo = new Uint8Array(12);
  pseudo.set(quelle, 0);
  pseudo.set(ziel, 4);
  pseudo[9] = 6;
  schreibe16(pseudo, 10, 20 + t.nutzlast.length);
  schreibe16(tcp, 16, internetSumme(pseudo, tcp, t.nutzlast));
  const ip = ipKopf(40 + t.nutzlast.length, IP_ID, t.ttl, quelle, ziel);
  const ohneFcs = verbinde(macBytes(t.nachMac), macBytes(t.vonMac), Uint8Array.of(0x08, 0x00), ip, tcp, t.nutzlast);
  const fcs = crc32(ohneFcs);
  const bytes = verbinde(ohneFcs, Uint8Array.of(fcs & 0xff, (fcs >>> 8) & 0xff, (fcs >>> 16) & 0xff, fcs >>> 24));
  return {
    bytes,
    bereiche: [
      { schicht: 2, name: "Ethernet-Kopf", von: 0, laenge: 14 },
      { schicht: 3, name: "IPv4-Kopf", von: 14, laenge: 20 },
      { schicht: 4, name: "TCP-Kopf", von: 34, laenge: 20 },
      { schicht: 7, name: "Deine Daten", von: 54, laenge: t.nutzlast.length },
      { schicht: 2, name: "Prüfsumme (FCS)", von: 54 + t.nutzlast.length, laenge: 4 },
    ],
  };
}
