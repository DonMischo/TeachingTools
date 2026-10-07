/**
 * Spielnetz für »Anwenden«: Router mit echten Routingtabellen und ein
 * DNS-Baum. Wer spielt, ist selbst Router bzw. Resolver.
 *
 * Routing: Unter allen Einträgen, deren Netz zur Zieladresse passt, gewinnt
 * der mit dem längsten Präfix (die meisten gleichen Bits vorn) — »longest
 * prefix match«. 0.0.0.0/0 passt immer (Standardroute).
 * Adressen aus den Dokumentationsbereichen (RFC 5737), alles ausgedacht.
 */

export interface Router {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Netz → Nachbar-ID, »lokal« = hier direkt angeschlossen */
  tabelle: { netz: string; nach: string }[];
}

// Schematische Weltkarte (1000 × 560). Ziele: 203.0.113.0/26 Tokio, .64/26 Seoul, .128/25 Hongkong;
// 198.51.100.0/25 New York, .128/25 Los Angeles; 192.0.2.0/25 Singapur, .128/26 Sydney, .192/26 São Paulo.
// Viele Tabellen haben einen gröberen »Köder«-Eintrag in die falsche Richtung — erst der längste Treffer stimmt.
export const ROUTER: Router[] = [
  { id: "heim", name: "Heimrouter Erfurt", x: 470, y: 320, tabelle: [{ netz: "192.168.178.0/24", nach: "lokal" }, { netz: "0.0.0.0/0", nach: "erf" }] },
  { id: "erf", name: "Anbieter Erfurt", x: 485, y: 215, tabelle: [{ netz: "0.0.0.0/0", nach: "fra" }, { netz: "198.51.100.0/24", nach: "ams" }] },
  { id: "fra", name: "Frankfurt", x: 430, y: 160, tabelle: [{ netz: "0.0.0.0/0", nach: "ams" }, { netz: "203.0.0.0/8", nach: "msk" }, { netz: "203.0.113.0/24", nach: "ist" }, { netz: "203.0.113.64/26", nach: "msk" }, { netz: "192.0.2.0/24", nach: "ist" }, { netz: "192.0.2.192/26", nach: "par" }] },
  { id: "ams", name: "Amsterdam", x: 420, y: 70, tabelle: [{ netz: "0.0.0.0/0", nach: "lon" }, { netz: "198.0.0.0/8", nach: "fra" }, { netz: "198.51.100.0/24", nach: "lon" }, { netz: "203.0.0.0/8", nach: "fra" }, { netz: "203.0.113.64/26", nach: "msk" }, { netz: "192.0.2.0/24", nach: "fra" }] },
  { id: "lon", name: "London", x: 320, y: 85, tabelle: [{ netz: "198.51.100.0/24", nach: "ny" }, { netz: "192.0.2.192/26", nach: "par" }, { netz: "0.0.0.0/0", nach: "ams" }] },
  { id: "par", name: "Paris", x: 335, y: 175, tabelle: [{ netz: "192.0.2.0/24", nach: "mrs" }, { netz: "192.0.2.192/26", nach: "sao" }, { netz: "198.51.100.0/24", nach: "lon" }, { netz: "0.0.0.0/0", nach: "fra" }] },
  { id: "mrs", name: "Marseille", x: 380, y: 270, tabelle: [{ netz: "0.0.0.0/0", nach: "fra" }, { netz: "192.0.2.0/24", nach: "cai" }, { netz: "203.0.113.0/24", nach: "cai" }, { netz: "192.0.2.192/26", nach: "par" }] },
  { id: "ny", name: "New York", x: 150, y: 140, tabelle: [{ netz: "198.51.100.0/25", nach: "lokal" }, { netz: "198.51.100.128/25", nach: "lax" }, { netz: "192.0.2.192/26", nach: "sao" }, { netz: "0.0.0.0/0", nach: "lon" }] },
  { id: "lax", name: "Los Angeles", x: 45, y: 235, tabelle: [{ netz: "198.51.100.128/25", nach: "lokal" }, { netz: "203.0.113.0/24", nach: "tyo" }, { netz: "192.0.2.128/26", nach: "syd" }, { netz: "0.0.0.0/0", nach: "ny" }] },
  { id: "sao", name: "São Paulo", x: 230, y: 470, tabelle: [{ netz: "192.0.2.192/26", nach: "lokal" }, { netz: "198.51.100.0/24", nach: "ny" }, { netz: "0.0.0.0/0", nach: "par" }] },
  { id: "msk", name: "Moskau", x: 590, y: 70, tabelle: [{ netz: "203.0.113.0/24", nach: "fra" }, { netz: "203.0.113.64/26", nach: "pek" }, { netz: "0.0.0.0/0", nach: "fra" }] },
  { id: "ist", name: "Istanbul", x: 560, y: 200, tabelle: [{ netz: "203.0.0.0/8", nach: "cai" }, { netz: "203.0.113.0/24", nach: "dxb" }, { netz: "192.0.2.0/24", nach: "dxb" }, { netz: "0.0.0.0/0", nach: "fra" }] },
  { id: "cai", name: "Kairo", x: 560, y: 300, tabelle: [{ netz: "203.0.0.0/8", nach: "dji" }, { netz: "203.0.113.0/24", nach: "ist" }, { netz: "192.0.2.0/24", nach: "dji" }, { netz: "0.0.0.0/0", nach: "mrs" }] },
  { id: "dji", name: "Dschibuti", x: 610, y: 390, tabelle: [{ netz: "192.0.2.0/24", nach: "mum" }, { netz: "203.0.113.0/24", nach: "mum" }, { netz: "192.0.2.192/26", nach: "jnb" }, { netz: "0.0.0.0/0", nach: "cai" }] },
  { id: "jnb", name: "Johannesburg", x: 560, y: 510, tabelle: [{ netz: "192.0.2.192/26", nach: "sao" }, { netz: "0.0.0.0/0", nach: "dji" }] },
  { id: "dxb", name: "Dubai", x: 680, y: 270, tabelle: [{ netz: "192.0.0.0/8", nach: "ist" }, { netz: "192.0.2.0/24", nach: "mum" }, { netz: "203.0.113.0/24", nach: "mum" }, { netz: "0.0.0.0/0", nach: "ist" }] },
  { id: "mum", name: "Mumbai", x: 720, y: 350, tabelle: [{ netz: "192.0.2.0/24", nach: "sin" }, { netz: "203.0.0.0/8", nach: "sin" }, { netz: "192.0.2.192/26", nach: "dji" }, { netz: "0.0.0.0/0", nach: "dxb" }] },
  { id: "sin", name: "Singapur", x: 820, y: 440, tabelle: [{ netz: "192.0.2.0/25", nach: "lokal" }, { netz: "192.0.2.128/26", nach: "syd" }, { netz: "203.0.113.0/24", nach: "hkg" }, { netz: "203.0.113.0/26", nach: "tyo" }, { netz: "0.0.0.0/0", nach: "mum" }] },
  { id: "hkg", name: "Hongkong", x: 860, y: 300, tabelle: [{ netz: "203.0.113.128/25", nach: "lokal" }, { netz: "203.0.113.0/26", nach: "tyo" }, { netz: "203.0.113.64/26", nach: "sel" }, { netz: "203.0.113.0/24", nach: "pek" }, { netz: "0.0.0.0/0", nach: "sin" }] },
  { id: "pek", name: "Peking", x: 830, y: 150, tabelle: [{ netz: "203.0.113.0/24", nach: "hkg" }, { netz: "203.0.113.64/26", nach: "sel" }, { netz: "203.0.113.0/26", nach: "tyo" }, { netz: "0.0.0.0/0", nach: "msk" }] },
  { id: "sel", name: "Seoul", x: 920, y: 135, tabelle: [{ netz: "203.0.113.64/26", nach: "lokal" }, { netz: "203.0.113.0/26", nach: "tyo" }, { netz: "203.0.113.128/25", nach: "hkg" }, { netz: "0.0.0.0/0", nach: "pek" }] },
  { id: "tyo", name: "Tokio", x: 965, y: 235, tabelle: [{ netz: "203.0.113.0/26", nach: "lokal" }, { netz: "203.0.113.64/26", nach: "sel" }, { netz: "198.51.100.0/24", nach: "lax" }, { netz: "0.0.0.0/0", nach: "sin" }] },
  { id: "syd", name: "Sydney", x: 950, y: 505, tabelle: [{ netz: "192.0.2.128/26", nach: "lokal" }, { netz: "198.51.100.0/24", nach: "lax" }, { netz: "0.0.0.0/0", nach: "sin" }] },
];

export const router = (id: string) => ROUTER.find(r => r.id === id)!;

/** Leitungen ergeben sich aus den Tabellen: jeder Nachbar, an den ein Router weiterreicht */
export const VERBINDUNGEN: [string, string][] = (() => {
  const s = new Set<string>();
  for (const r of ROUTER) for (const e of r.tabelle) if (e.nach !== "lokal") s.add([r.id, e.nach].sort().join("|"));
  return [...s].map(k => k.split("|") as [string, string]);
})();

export const nachbarn = (id: string) => VERBINDUNGEN.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : []));

export function ipZahl(ip: string): number {
  return ip.split(".").reduce((s, t) => ((s << 8) | (+t & 255)) >>> 0, 0);
}

export function ipBits(ip: string): string {
  return ip.split(".").map(t => (+t).toString(2).padStart(8, "0")).join(".");
}

export function zerlege(netz: string): { ip: string; laenge: number } {
  const [ip, l] = netz.split("/");
  return { ip, laenge: +l };
}

/** Passt die Adresse ins Netz? Vergleicht die ersten `laenge` Bits. */
export function passt(ip: string, netz: string): boolean {
  const { ip: n, laenge } = zerlege(netz);
  if (laenge === 0) return true;
  const maske = laenge === 32 ? 0xffffffff : (~0 << (32 - laenge)) >>> 0;
  return ((ipZahl(ip) & maske) >>> 0) === ((ipZahl(n) & maske) >>> 0);
}

/** Längster passender Eintrag — das ist die Regel jedes Routers. */
export function besterEintrag(r: Router, ip: string): { netz: string; nach: string } | null {
  let best: { netz: string; nach: string } | null = null;
  for (const e of r.tabelle) {
    if (passt(ip, e.netz) && (!best || zerlege(e.netz).laenge > zerlege(best.netz).laenge)) best = e;
  }
  return best;
}

/** Warum eine falsche Wahl falsch ist — in Worten für die Klasse */
export function begruendung(r: Router, ip: string, wahl: string): string {
  const richtig = besterEintrag(r, ip)!;
  const zuWahl = r.tabelle.filter(e => e.nach === wahl);
  const name = (id: string) => (id === "lokal" ? "direkt zustellen" : router(id).name);
  if (!zuWahl.length) {
    return `In der Tabelle von ${r.name} steht kein Eintrag, der nach ${name(wahl)} führt. Richtig ist ${richtig.netz} → ${name(richtig.nach)}.`;
  }
  const passende = zuWahl.filter(e => passt(ip, e.netz));
  if (!passende.length) {
    const e = zuWahl[0];
    return `${e.netz} → ${name(wahl)} passt nicht: ${ip} liegt nicht in diesem Netz (die ersten ${zerlege(e.netz).laenge} Bit sind anders).`;
  }
  const e = passende[0];
  return `${e.netz} → ${name(wahl)} passt zwar, aber ${richtig.netz} passt genauer (${zerlege(richtig.netz).laenge} statt ${zerlege(e.netz).laenge} gleiche Bit). Der längste Treffer gewinnt.`;
}

// ── Ziele und DNS ───────────────────────────────────────────────────────────

export interface Ziel {
  id: string;
  wer: string;
  ort: string;
  name: string;
  ip: string;
  router: string;
  domain: string;
}

export const ZIELE: Ziel[] = [
  { id: "tokio", wer: "Lenas Bruder", ort: "Tokio", name: "tokio.purrmsg.example", ip: "203.0.113.7", router: "tyo", domain: "purrmsg.example" },
  { id: "seoul", wer: "Lenas Cousine", ort: "Seoul", name: "seoul.purrmsg.example", ip: "203.0.113.80", router: "sel", domain: "purrmsg.example" },
  { id: "hongkong", wer: "Lenas Onkel", ort: "Hongkong", name: "hk.purrmsg.example", ip: "203.0.113.200", router: "hkg", domain: "purrmsg.example" },
  { id: "newyork", wer: "Lenas Tante", ort: "New York", name: "ny.hundepost.example", ip: "198.51.100.80", router: "ny", domain: "hundepost.example" },
  { id: "losangeles", wer: "Lenas Opa", ort: "Los Angeles", name: "la.hundepost.example", ip: "198.51.100.200", router: "lax", domain: "hundepost.example" },
  { id: "singapur", wer: "Lenas Freundin", ort: "Singapur", name: "sg.vogelpost.example", ip: "192.0.2.40", router: "sin", domain: "vogelpost.example" },
  { id: "sydney", wer: "Lenas Brieffreundin", ort: "Sydney", name: "syd.vogelpost.example", ip: "192.0.2.150", router: "syd", domain: "vogelpost.example" },
  { id: "saopaulo", wer: "Lenas Austauschpartner", ort: "São Paulo", name: "sp.vogelpost.example", ip: "192.0.2.200", router: "sao", domain: "vogelpost.example" },
];

export interface DnsServer {
  id: string;
  name: string;
  ip: string;
  art: "resolver" | "root" | "tld" | "zone";
  /** wofür zuständig: "." / "example" / "purrmsg.example" … */
  zone: string;
  x: number;
  y: number;
}

export const DNS: DnsServer[] = [
  { id: "res", name: "Resolver (Heimrouter)", ip: "192.168.178.1", art: "resolver", zone: "", x: 70, y: 200 },
  { id: "root-a", name: "a.root-servers.net", ip: "198.41.0.4", art: "root", zone: ".", x: 270, y: 70 },
  { id: "root-k", name: "k.root-servers.net", ip: "193.0.14.129", art: "root", zone: ".", x: 270, y: 200 },
  { id: "tld-de", name: "a.nic.de", ip: "194.0.0.53", art: "tld", zone: "de", x: 500, y: 40 },
  { id: "tld-jp", name: "a.dns.jp", ip: "203.119.1.1", art: "tld", zone: "jp", x: 500, y: 130 },
  { id: "tld-ex", name: "a.nic.example", ip: "192.0.2.10", art: "tld", zone: "example", x: 500, y: 230 },
  { id: "tld-com", name: "a.gtld-servers.net", ip: "192.5.6.30", art: "tld", zone: "com", x: 500, y: 330 },
  { id: "ns-purr", name: "ns1.purrmsg.example", ip: "192.0.2.53", art: "zone", zone: "purrmsg.example", x: 760, y: 90 },
  { id: "ns-hund", name: "ns1.hundepost.example", ip: "198.51.100.53", art: "zone", zone: "hundepost.example", x: 760, y: 210 },
  { id: "ns-vogel", name: "ns1.vogelpost.example", ip: "203.0.113.53", art: "zone", zone: "vogelpost.example", x: 760, y: 330 },
];

export type DnsAntwort =
  | { art: "verweis"; zone: string; server: DnsServer; text: string }
  | { art: "antwort"; ip: string; text: string }
  | { art: "falsch"; text: string };

/** Was ein DNS-Server auf »Welche Adresse hat `name`?« antwortet */
export function frageDns(s: DnsServer, z: Ziel): DnsAntwort {
  if (s.art === "root") {
    const tld = DNS.find(d => d.art === "tld" && d.zone === "example")!;
    return { art: "verweis", zone: ".example", server: tld, text: `»${z.name}? Kenne ich nicht. Aber für .example ist ${tld.name} zuständig — Adresse ${tld.ip}.«` };
  }
  if (s.art === "tld") {
    if (s.zone !== "example") return { art: "falsch", text: `»Ich bin nur für .${s.zone} zuständig. ${z.name} endet nicht auf .${s.zone}.«` };
    const ns = DNS.find(d => d.art === "zone" && d.zone === z.domain)!;
    return { art: "verweis", zone: z.domain, server: ns, text: `»Für ${z.domain} frag ${ns.name} — Adresse ${ns.ip}.«` };
  }
  if (s.art === "zone") {
    if (s.zone !== z.domain) return { art: "falsch", text: `»Ich verwalte nur ${s.zone}. Für ${z.name} bin ich nicht zuständig.«` };
    return { art: "antwort", ip: z.ip, text: `»${z.name} hat die Adresse ${z.ip}.« (Eintrag Typ A, gültig 3600 s)` };
  }
  return { art: "falsch", text: "Der Resolver bist du selbst — frag einen anderen Server." };
}

/** Der richtige nächste DNS-Server: erst Root, dann der genannte Verweis */
export function richtigerDns(z: Ziel, gefragt: DnsServer[]): DnsServer[] {
  const letzte = gefragt.length ? frageDns(gefragt[gefragt.length - 1], z) : null;
  if (!letzte) return DNS.filter(d => d.art === "root");
  return letzte.art === "verweis" ? [letzte.server] : [];
}
