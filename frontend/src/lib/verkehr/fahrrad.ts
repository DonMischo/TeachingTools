/**
 * Das Fahrrad: Modelle, Teile, Werkzeug und die Prüfung, ob es verkehrssicher
 * ist — nach der StVZO: Klingel (§ 64a), zwei unabhängige Bremsen (§ 65),
 * Licht und Rückstrahler (§ 67): Scheinwerfer und Frontstrahler weiß,
 * Rücklicht rot, roter Rückstrahler Kategorie Z, gelbe Pedalrückstrahler,
 * Speichenreflektoren (je zwei gelbe je Rad) oder Reflexstreifen. Licht darf
 * mit Akku/Batterie sein (seit 2013), aber nicht blinken. Kein Pixi.
 */

export type Modell = "damenrad" | "herrenrad" | "mountainbike" | "bmx" | "klapprad";

export type TeilId =
  | "bremseVorn" | "bremseHinten" | "klingel" | "licht" | "ruecklicht"
  | "frontstrahler" | "rueckstrahler" | "pedalstrahler" | "speichenstrahler"
  | "reifenVorn" | "reifenHinten" | "kette";

/** Zustand eines Teils: fehlt, kaputt/verschlissen oder in Ordnung. */
export type Zustand = "fehlt" | "kaputt" | "ok";

export type Werkzeug = "luftpumpe" | "flickzeug" | "werkzeug" | "kettenoel" | "teilekiste";
export type Schloss = "keins" | "kabel" | "buegel";

export const MODELLE: Record<Modell, {
  name: string; icon: string; zoll: number; tempo: number; text: string;
  /** Was ab Werk dran ist (der Rest fehlt und muss nachgerüstet werden). */
  ab_werk: TeilId[];
  /** Zusammenklappbar: gefaltet zählt es in Bus und Bahn als Gepäck. */
  klappbar?: boolean;
}> = {
  damenrad: { name: "Damenrad", icon: "🚲", zoll: 28, tempo: 5.5, text: "Tiefer Einstieg, Gepäckträger, Nabendynamo — ab Werk alles dran.", ab_werk: ALLE() },
  herrenrad: { name: "Herrenrad", icon: "🚲", zoll: 28, tempo: 6, text: "Diamantrahmen mit Oberrohr, voll ausgestattet.", ab_werk: ALLE() },
  mountainbike: { name: "Mountainbike", icon: "🚵", zoll: 27.5, tempo: 6.5, text: "Federgabel, grobe Reifen — als Sportgerät verkauft: Licht, Klingel und Reflektoren fehlen oft.", ab_werk: ["bremseVorn", "bremseHinten", "reifenVorn", "reifenHinten", "kette"] },
  bmx: { name: "BMX", icon: "🛞", zoll: 20, tempo: 5, text: "Klein, wendig, oft nur eine Bremse und ohne Licht — so darf es nicht auf die Straße.", ab_werk: ["bremseHinten", "reifenVorn", "reifenHinten", "kette"] },
  klapprad: { name: "Klapprad", icon: "🚲", zoll: 20, tempo: 4.5, text: "Lässt sich falten — zusammengeklappt fährt es in Bus und Bahn als Gepäck mit.", ab_werk: ALLE(), klappbar: true },
};

function ALLE(): TeilId[] {
  return ["bremseVorn", "bremseHinten", "klingel", "licht", "ruecklicht", "frontstrahler", "rueckstrahler", "pedalstrahler", "speichenstrahler", "reifenVorn", "reifenHinten", "kette"];
}

/** Was die StVZO verlangt, mit Paragraf und Bußgeld (Erwachsene). */
export const PFLICHT: { teil: TeilId; name: string; regel: string; bussgeld: number; nurDunkel?: boolean }[] = [
  { teil: "klingel", name: "Klingel", regel: "§ 64a StVZO: eine helltönende Glocke", bussgeld: 15 },
  { teil: "bremseVorn", name: "Bremse vorn", regel: "§ 65 StVZO: zwei voneinander unabhängige Bremsen", bussgeld: 10 },
  { teil: "bremseHinten", name: "Bremse hinten", regel: "§ 65 StVZO: zwei voneinander unabhängige Bremsen", bussgeld: 10 },
  { teil: "licht", name: "Scheinwerfer (weiß)", regel: "§ 67 StVZO: weißer Scheinwerfer, darf nicht blinken", bussgeld: 20, nurDunkel: true },
  { teil: "ruecklicht", name: "Rücklicht (rot)", regel: "§ 67 StVZO: rote Schlussleuchte", bussgeld: 20, nurDunkel: true },
  { teil: "frontstrahler", name: "Frontstrahler (weiß)", regel: "§ 67 StVZO: weißer Rückstrahler vorn", bussgeld: 20 },
  { teil: "rueckstrahler", name: "Rückstrahler (rot, »Z«)", regel: "§ 67 StVZO: roter Großflächen-Rückstrahler der Kategorie Z", bussgeld: 20 },
  { teil: "pedalstrahler", name: "Pedalrückstrahler (gelb)", regel: "§ 67 StVZO: gelbe Rückstrahler an den Pedalen, nach vorn und hinten", bussgeld: 20 },
  { teil: "speichenstrahler", name: "Speichenreflektoren", regel: "§ 67 StVZO: je Rad zwei gelbe Speichenstrahler oder weiße Reflexstreifen", bussgeld: 20 },
];

/** Beim Fahren wichtig, aber nicht »Pflichtausstattung«: Luft und Kette. */
export const PFLEGE: { teil: TeilId; name: string }[] = [
  { teil: "reifenVorn", name: "Reifen vorn" },
  { teil: "reifenHinten", name: "Reifen hinten" },
  { teil: "kette", name: "Kette" },
];

export const WERKZEUGE: Record<Werkzeug, { name: string; icon: string; hilft: (t: TeilId, z: Zustand) => boolean; text: string }> = {
  luftpumpe: { name: "Luftpumpe", icon: "🎈", text: "Pumpt schlappe Reifen auf.", hilft: (t, z) => (t === "reifenVorn" || t === "reifenHinten") && z === "kaputt" },
  flickzeug: { name: "Flickzeug", icon: "🩹", text: "Flickt einen Platten — danach noch aufpumpen.", hilft: (t, z) => (t === "reifenVorn" || t === "reifenHinten") && z === "fehlt" },
  werkzeug: { name: "Werkzeug", icon: "🔧", text: "Stellt Bremsen nach, zieht Schrauben fest, tauscht Birnchen.", hilft: (t, z) => z === "kaputt" && !["reifenVorn", "reifenHinten", "kette"].includes(t) },
  kettenoel: { name: "Kettenöl", icon: "🛢️", text: "Eine trockene, quietschende Kette ölen.", hilft: (t, z) => t === "kette" && z === "kaputt" },
  teilekiste: { name: "Teilekiste", icon: "🧰", text: "Klingel, Licht, Reflektoren und Bremsen nachrüsten.", hilft: (t, z) => z === "fehlt" && !["reifenVorn", "reifenHinten", "kette"].includes(t) },
};

export const SCHLOESSER: Record<Schloss, { name: string; icon: string; klauRisiko: number; text: string }> = {
  keins: { name: "Kein Schloss", icon: "🔓", klauRisiko: 0.5, text: "Nicht abgeschlossen — ein leichtes Ziel." },
  kabel: { name: "Kabelschloss", icon: "➰", klauRisiko: 0.15, text: "Besser als nichts, aber schnell durchgeknipst." },
  buegel: { name: "Bügelschloss", icon: "🔒", klauRisiko: 0.03, text: "Schwer zu knacken — am besten an einem festen Ständer anschließen." },
};

export type Fahrrad = {
  modell: Modell;
  farbe: number;
  teile: Record<TeilId, Zustand>;
  schloss: Schloss;
  /** Zusammengeklappt (nur Klapprad). */
  geklappt?: boolean;
};

/** Ein neues Rad: was ab Werk dran ist, ist in Ordnung, der Rest fehlt. */
export function neuesRad(modell: Modell, farbe = 0x2563eb): Fahrrad {
  const ab = MODELLE[modell].ab_werk;
  const teile = Object.fromEntries(ALLE().map((t) => [t, ab.includes(t) ? "ok" : "fehlt"])) as Record<TeilId, Zustand>;
  return { modell, farbe, teile, schloss: "keins" };
}

/** Ein gebrauchtes Rad aus dem Keller: ein paar Macken, damit es in der Werkstatt etwas zu tun gibt. */
export function gebrauchtesRad(modell: Modell, rnd: () => number = Math.random, farbe?: number): Fahrrad {
  const r = neuesRad(modell, farbe);
  for (const t of ALLE()) {
    if (r.teile[t] !== "ok") continue;
    // Reifen schlapp, Kette trocken, Licht oder Bremse nicht ganz in Ordnung
    const p = t === "reifenVorn" || t === "reifenHinten" ? 0.5 : t === "kette" ? 0.5 : 0.2;
    if (rnd() < p) r.teile[t] = "kaputt";
  }
  return r;
}

export type Mangel = { teil: TeilId; name: string; zustand: Zustand; regel: string; bussgeld: number; nurDunkel?: boolean };

/** Verkehrssicher? Alle Mängel nach StVZO; Licht zählt nur im Dunkeln als Fahrverbot. */
export function pruefe(r: Fahrrad): { maengel: Mangel[]; verkehrssicher: boolean; fahrbar: boolean } {
  const maengel: Mangel[] = PFLICHT.filter((p) => r.teile[p.teil] !== "ok").map((p) => ({ ...p, zustand: r.teile[p.teil] }));
  // Platt = gar nicht fahrbar
  const fahrbar = r.teile.reifenVorn !== "fehlt" && r.teile.reifenHinten !== "fehlt";
  return { maengel, verkehrssicher: maengel.length === 0, fahrbar };
}

/** Wie schnell das Rad gerade fährt: schlappe Reifen und eine trockene Kette bremsen. */
export function tempoVon(r: Fahrrad): number {
  let v = MODELLE[r.modell].tempo;
  if (r.teile.reifenVorn === "kaputt") v *= 0.85;
  if (r.teile.reifenHinten === "kaputt") v *= 0.85;
  if (r.teile.kette === "kaputt") v *= 0.9;
  return v;
}

/** Werkzeug an einem Teil benutzen: gibt das neue Rad zurück, oder null, wenn es nicht hilft. */
export function repariere(r: Fahrrad, t: TeilId, w: Werkzeug): Fahrrad | null {
  const z = r.teile[t];
  if (!WERKZEUGE[w].hilft(t, z)) return null;
  // Flicken macht aus »platt« »schlapp« — aufpumpen muss man danach noch
  const neu: Zustand = w === "flickzeug" ? "kaputt" : "ok";
  return { ...r, teile: { ...r.teile, [t]: neu } };
}

/** Wie stark das Licht im Dunkeln zählt: vorn und hinten müssen gehen. */
export const lichtOk = (r: Fahrrad) => r.teile.licht === "ok" && r.teile.ruecklicht === "ok";

/** Wer darf wo fahren (StVO § 2 Abs. 5): bis 8 Gehweg Pflicht, bis 10 darf, danach Radweg oder Fahrbahn. */
export function gehwegErlaubt(alter: number): "pflicht" | "darf" | "nein" {
  return alter < 8 ? "pflicht" : alter <= 10 ? "darf" : "nein";
}

export function pruefeRad(roh: unknown, sonst: Fahrrad): Fahrrad {
  const o = (roh && typeof roh === "object" ? roh : {}) as Partial<Fahrrad>;
  const modell = o.modell && o.modell in MODELLE ? o.modell : sonst.modell;
  const teile = { ...sonst.teile };
  for (const t of ALLE()) {
    const z = (o.teile as Record<string, unknown> | undefined)?.[t];
    if (z === "ok" || z === "kaputt" || z === "fehlt") teile[t] = z;
  }
  return {
    modell, teile,
    farbe: typeof o.farbe === "number" ? o.farbe & 0xffffff : sonst.farbe,
    schloss: o.schloss && o.schloss in SCHLOESSER ? o.schloss : sonst.schloss,
  };
}
