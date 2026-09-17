/**
 * Der Aufbau auf der Werkbank — reine Datenhaltung.
 *
 * Hier rechnet nichts und hier zeichnet nichts: die Szene sagt nur, welche
 * Geräte wo stehen, was womit verbunden ist und wie genau gerechnet werden
 * soll. Dadurch lässt sie sich als JSON speichern, über einen Beitritts-Code
 * teilen und in Tests prüfen, ohne dass ein Solver oder ein Canvas dranhängt.
 *
 * Alle Funktionen geben eine neue Szene zurück und lassen die alte in Ruhe.
 */
import { beweglicherPortOrt, bodenHoehe, EIGENER_HAKEN } from "./geometrie";
import { geraetTyp, portVon, standardWerte } from "./katalog";
import type { Blick, Geraet, Modelltreue, Punkt, PortZeiger, Szene } from "./typen";

export const LEERE_SZENE: Szene = {
  version: 1, titel: "Neuer Aufbau", treue: "ideal", geraete: [], verbindungen: [],
};

export const neueSzene = (): Szene => ({ ...LEERE_SZENE, geraete: [], verbindungen: [] });

/** Fortlaufende Ids — damit gespeicherte Aufbauten lesbar und Tests bestimmt bleiben. */
function naechsteId(vorhandene: string[], praefix: string): string {
  const hoechste = vorhandene.reduce((max, id) => {
    const rest = id.startsWith(praefix) ? Number(id.slice(praefix.length)) : NaN;
    return Number.isInteger(rest) && rest > max ? rest : max;
  }, 0);
  return `${praefix}${hoechste + 1}`;
}

/** Stellt ein Gerät des angegebenen Typs auf die Werkbank. */
export function stelle(szene: Szene, typ: string, pos: Punkt): Szene {
  if (!geraetTyp(typ)) throw new Error(`Unbekannter Gerätetyp: ${typ}`);
  const geraet: Geraet = {
    id: naechsteId(szene.geraete.map(g => g.id), "g"),
    typ, pos, winkel: 0, werte: standardWerte(typ),
  };
  return { ...szene, geraete: [...szene.geraete, geraet] };
}

/** Nimmt ein Gerät weg — samt allem, was daran hing. */
export function entferne(szene: Szene, id: string): Szene {
  return {
    ...szene,
    geraete: szene.geraete.filter(g => g.id !== id),
    verbindungen: szene.verbindungen.filter(v => v.von.geraet !== id && v.nach.geraet !== id),
  };
}

export function bewege(szene: Szene, id: string, pos: Punkt): Szene {
  return { ...szene, geraete: szene.geraete.map(g => (g.id === id ? { ...g, pos } : g)) };
}

/** Ändert Parameterwerte eines Geräts (in SI). */
export function stelleEin(szene: Szene, id: string, werte: Record<string, number>): Szene {
  return { ...szene, geraete: szene.geraete.map(g => (g.id === id ? { ...g, werte: { ...g.werte, ...werte } } : g)) };
}

const gleich = (a: PortZeiger, b: PortZeiger) => a.geraet === b.geraet && a.port === b.port;

/**
 * Verbindet zwei Ports. Zusammen passen nur Ports derselben Art — eine Öse
 * gehört an einen Haken, ein Kabel an eine Buchse, und beides nicht ans andere.
 */
export function verbinde(szene: Szene, a: PortZeiger, b: PortZeiger): Szene {
  for (const z of [a, b]) {
    const g = szene.geraete.find(x => x.id === z.geraet);
    if (!g) throw new Error(`Kein Gerät mit der Id ${z.geraet}`);
    if (!portVon(g.typ, z.port)) throw new Error(`${g.typ} hat keinen Port ${z.port}`);
  }
  if (gleich(a, b)) throw new Error("Ein Port lässt sich nicht mit sich selbst verbinden.");

  const artA = portVon(szene.geraete.find(g => g.id === a.geraet)!.typ, a.port)!.art;
  const artB = portVon(szene.geraete.find(g => g.id === b.geraet)!.typ, b.port)!.art;
  if (artA !== artB) throw new Error(`${artA} passt nicht an ${artB}.`);

  const schonDa = szene.verbindungen.some(v =>
    (gleich(v.von, a) && gleich(v.nach, b)) || (gleich(v.von, b) && gleich(v.nach, a)));
  if (schonDa) throw new Error("Diese beiden Ports sind schon verbunden.");

  const id = naechsteId(szene.verbindungen.map(v => v.id), "v");
  return { ...szene, verbindungen: [...szene.verbindungen, { id, von: a, nach: b }] };
}

export function trenne(szene: Szene, id: string): Szene {
  return { ...szene, verbindungen: szene.verbindungen.filter(v => v.id !== id) };
}

/** Was für dieses Gerät gilt: seine eigene Einstellung schlägt die der Szene. */
export const treueVon = (szene: Szene, geraet: Geraet): Modelltreue => geraet.treue ?? szene.treue;

export const alsJSON = (szene: Szene): string => JSON.stringify(szene);

const zahl = (x: unknown, ersatz = 0) => (typeof x === "number" && Number.isFinite(x) ? x : ersatz);
const punkt = (p: unknown): Punkt => {
  const o = (p ?? {}) as Record<string, unknown>;
  return { x: zahl(o.x), y: zahl(o.y) };
};

/**
 * Liest einen gespeicherten oder geteilten Aufbau.
 *
 * Nachsichtig mit Absicht: die Daten können aus einem alten localStorage oder
 * von einer fremden Sitzung kommen. Was nicht zu retten ist, fällt weg —
 * geworfen wird nie, sonst steht die Klasse vor einer leeren Seite.
 */
export function ausJSON(roh: string): Szene {
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    return neueSzene();
  }
  if (!daten || typeof daten !== "object") return neueSzene();
  const d = daten as Record<string, unknown>;
  if (d.version !== 1) return neueSzene();

  const geraete: Geraet[] = (Array.isArray(d.geraete) ? d.geraete : [])
    .map(g => (g ?? {}) as Record<string, unknown>)
    .filter(g => typeof g.id === "string" && typeof g.typ === "string" && geraetTyp(g.typ as string))
    .map(g => {
      const werte = { ...standardWerte(g.typ as string) };
      if (g.werte && typeof g.werte === "object") {
        for (const [k, v] of Object.entries(g.werte as Record<string, unknown>)) {
          if (k in werte) werte[k] = zahl(v, werte[k]);
        }
      }
      const geraet: Geraet = {
        id: g.id as string, typ: g.typ as string,
        pos: punkt(g.pos), winkel: zahl(g.winkel), werte,
      };
      if (g.treue === "ideal" || g.treue === "real") geraet.treue = g.treue;
      return geraet;
    });

  const nachId = new Map(geraete.map(g => [g.id, g]));
  const zeigerOk = (z: unknown): z is PortZeiger => {
    const o = (z ?? {}) as Record<string, unknown>;
    const g = typeof o.geraet === "string" ? nachId.get(o.geraet) : undefined;
    return !!g && typeof o.port === "string" && !!portVon(g.typ, o.port);
  };

  const verbindungen = (Array.isArray(d.verbindungen) ? d.verbindungen : [])
    .map(v => (v ?? {}) as Record<string, unknown>)
    .filter(v => typeof v.id === "string" && zeigerOk(v.von) && zeigerOk(v.nach))
    .map(v => ({ id: v.id as string, von: v.von as PortZeiger, nach: v.nach as PortZeiger }));

  return {
    version: 1,
    titel: typeof d.titel === "string" ? d.titel : LEERE_SZENE.titel,
    treue: d.treue === "real" ? "real" : "ideal",
    geraete, verbindungen,
  };
}

// ── Meter und Pixel ───────────────────────────────────────────────────────────
// Die einzigen zwei Funktionen im Labor, die beides gleichzeitig kennen. Kein
// Solver sieht je einen Pixel, keine Zeichenroutine je einen blanken Meter.

/** Weltpunkt (Meter, y nach oben) → Leinwandpunkt (Pixel, y nach unten). */
export function zumBild(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.breite / 2 + (p.x - blick.mitte.x) * blick.skala,
    y: blick.hoehe / 2 - (p.y - blick.mitte.y) * blick.skala,
  };
}

/** Leinwandpunkt → Weltpunkt. */
export function zurWelt(p: Punkt, blick: Blick): Punkt {
  return {
    x: blick.mitte.x + (p.x - blick.breite / 2) / blick.skala,
    y: blick.mitte.y - (p.y - blick.hoehe / 2) / blick.skala,
  };
}

/**
 * Wo ein Port in der Welt sitzt — der Sitz am Gerät, mitgedreht.
 *
 * Zeichnen und Anfassen brauchen das, und ab Phase 2 auch die Rechenwerke:
 * welcher Draht an welcher Buchse steckt, entscheidet sich an diesem Punkt.
 */
export function portOrt(geraet: Geraet, portId: string, zustand?: { q: number }): Punkt | undefined {
  const port = portVon(geraet.typ, portId);
  if (!port) return undefined;
  // Anschluesse am schwingenden Koerper wandern mit ihm.
  const beweglich = beweglicherPortOrt(geraet, portId, zustand);
  if (beweglich) return beweglich;
  const c = Math.cos(geraet.winkel), s = Math.sin(geraet.winkel);
  return {
    x: geraet.pos.x + port.pos.x * c - port.pos.y * s,
    y: geraet.pos.y + port.pos.x * s + port.pos.y * c,
  };
}

/**
 * Ein freier Platz auf dem Tisch.
 *
 * Neue Geräte sollen nicht aufeinanderfallen: gesucht wird reihenweise von
 * der Mitte aus der erste Rasterplatz, an dem noch nichts steht.
 */
export function freierPlatz(szene: Szene, start: Punkt = { x: 0, y: 0.5 }): Punkt {
  const SCHRITT = 0.3, PRO_REIHE = 5, ABSTAND = 0.2;
  for (let i = 0; i < PRO_REIHE * 8; i++) {
    const platz = {
      x: start.x + ((i % PRO_REIHE) - (PRO_REIHE - 1) / 2) * SCHRITT,
      y: start.y - Math.floor(i / PRO_REIHE) * SCHRITT,
    };
    const besetzt = szene.geraete.some(g => Math.hypot(g.pos.x - platz.x, g.pos.y - platz.y) < ABSTAND);
    if (!besetzt) return platz;
  }
  return start;
}

/**
 * Die Szene mit aufgelösten Positionen.
 *
 * Wer an etwas hängt, steht nicht mehr dort, wo er hingelegt wurde, sondern
 * dort, wo er eingehängt ist — das Massestück am Haken des Pendels, das Pendel
 * am Arm des Stativs, das Stativ auf dem Boden. Ohne diesen Schritt bleibt der
 * Aufbau ein Schaltplan mit Linien dazwischen; mit ihm wird er ein Aufbau.
 *
 * Aufgelöst wird beim Zeichnen und beim Anfassen, nicht in der gespeicherten
 * Szene: `pos` bleibt der Platz, an den das Gerät zurückfällt, wenn man die
 * Verbindung kappt.
 */
export function aufgeloest(
  szene: Szene,
  mechanik: Record<string, { q: number }> = {},
  welt: Record<string, { x: number; y: number }> = {},
): Szene {
  const plan = new Map<string, Punkt>();
  const laeuft = new Set<string>();
  const nachId = new Map(szene.geraete.map(g => [g.id, g]));
  // Wer auf etwas steht, trägt selbst nach oben weiter — sonst kippte der
  // Stapel auf einer Waagschale ab dem zweiten Gewicht ins Hängen zurück.
  const stehend = new Set<string>();

  const ortVon = (g: Geraet): Punkt => {
    const fertig = plan.get(g.id);
    if (fertig) return fertig;
    // Ein Ring darf nicht endlos kreisen: dort bleibt das Gerät, wo es liegt.
    if (laeuft.has(g.id)) return g.pos;
    laeuft.add(g.id);

    // Was einen Körper in der Welt hat, steht dort, wo der Löser ihn hat —
    // ein gefallenes Gewicht liegt am Boden und nicht mehr in der Luft.
    const koerper = welt[g.id];
    const boden = bodenHoehe(g);
    let ort = koerper
      ? { x: koerper.x, y: koerper.y }
      : boden === null ? g.pos : { x: g.pos.x, y: boden };

    const eigener = EIGENER_HAKEN[g.typ];
    if (eigener) {
      const v = szene.verbindungen.find(x =>
        (x.von.geraet === g.id && x.von.port === eigener) ||
        (x.nach.geraet === g.id && x.nach.port === eigener));
      const dort = v ? (v.von.geraet === g.id ? v.nach : v.von) : null;
      const wirt = dort ? nachId.get(dort.geraet) : undefined;
      if (dort && wirt) {
        const anschluss = portOrt({ ...wirt, pos: ortVon(wirt) }, dort.port, mechanik[wirt.id]);
        // Der eigene Haken sitzt nicht im Mittelpunkt — um seinen Versatz muss
        // das Gerät zurückgeschoben werden, sonst hängt es schief. Auf einer
        // tragenden Stelle (Waagschale) zählt dabei die *Unterseite*: dort
        // steht das Gewicht darauf, statt darunter zu hängen.
        const wirtPort = portVon(wirt.typ, dort.port);
        const daraufStehend = !!wirtPort?.traegt
          || (dort.port === "oese" && stehend.has(wirt.id));
        const stuetzPunkt = daraufStehend && portVon(g.typ, "unten") ? "unten" : eigener;
        if (daraufStehend) stehend.add(g.id);
        const versatz = portOrt({ ...g, pos: { x: 0, y: 0 } }, stuetzPunkt, mechanik[g.id]);
        if (anschluss && versatz) ort = { x: anschluss.x - versatz.x, y: anschluss.y - versatz.y };
      }
    }

    laeuft.delete(g.id);
    plan.set(g.id, ort);
    return ort;
  };

  return {
    ...szene,
    geraete: szene.geraete.map(g => {
      const ort = ortVon(g);
      return ort.x === g.pos.x && ort.y === g.pos.y ? g : { ...g, pos: ort };
    }),
  };
}

/** Kappt alles, was an diesem Anschluss hängt — der Riss in der Probe. */
export function trenneAn(szene: Szene, zeiger: PortZeiger): Szene {
  return {
    ...szene,
    verbindungen: szene.verbindungen.filter(v => !(gleich(v.von, zeiger) || gleich(v.nach, zeiger))),
  };
}

/** Ob dieses Gerät gerade irgendwo eingehängt ist. */
export function haengtIrgendwo(szene: Szene, g: Geraet): boolean {
  const eigener = EIGENER_HAKEN[g.typ];
  if (!eigener) return false;
  return szene.verbindungen.some(v =>
    (v.von.geraet === g.id && v.von.port === eigener) ||
    (v.nach.geraet === g.id && v.nach.port === eigener));
}

/** Kappt die Verbindung, mit der dieses Gerät eingehängt ist. */
export function aushaengen(szene: Szene, id: string): Szene {
  const g = szene.geraete.find(x => x.id === id);
  const eigener = g ? EIGENER_HAKEN[g.typ] : undefined;
  if (!eigener) return szene;
  return {
    ...szene,
    verbindungen: szene.verbindungen.filter(v =>
      !((v.von.geraet === id && v.von.port === eigener) ||
        (v.nach.geraet === id && v.nach.port === eigener))),
  };
}

/**
 * Die Kette der Geräte, an denen dieses hängt — das nächste zuerst.
 *
 * Wer ein Massestück anfasst, das am Pendel hängt, meint das Pendel: man zieht
 * nicht das Gewicht vom Haken, man lenkt die ganze Schwingung aus. Dafür muss
 * man wissen, woran es letztlich hängt.
 */
export function wirtKette(szene: Szene, id: string): Geraet[] {
  const kette: Geraet[] = [];
  const gesehen = new Set<string>([id]);
  let aktuell = szene.geraete.find(g => g.id === id);

  while (aktuell) {
    const eigener = EIGENER_HAKEN[aktuell.typ];
    if (!eigener) break;
    const jetzt = aktuell;
    const v = szene.verbindungen.find(x =>
      (x.von.geraet === jetzt.id && x.von.port === eigener) ||
      (x.nach.geraet === jetzt.id && x.nach.port === eigener));
    if (!v) break;
    const dort = v.von.geraet === jetzt.id ? v.nach : v.von;
    if (gesehen.has(dort.geraet)) break;
    gesehen.add(dort.geraet);
    aktuell = szene.geraete.find(g => g.id === dort.geraet);
    if (aktuell) kette.push(aktuell);
  }

  return kette;
}

/**
 * Der unterste freie Haken unter einem Anschluss.
 *
 * Hängt am Pendelhaken schon ein Gewicht, soll das nächste *darunter* landen
 * und nicht abgewiesen werden — so wächst ein Stapel Schlitzgewichte, wie man
 * ihn im Vorbereitungsraum auch aufsteckt. Gesucht wird deshalb von der
 * angetippten Stelle aus nach unten weiter, bis ein Haken frei ist.
 */
export function freierHaken(
  szene: Szene,
  zeiger: PortZeiger,
  tiefe = 0,
  /** Wird weitergereicht: ein Stapel auf einer Schale wächst durchgehend nach
   *  oben, nicht nur im ersten Schritt. */
  nachOben?: boolean,
): PortZeiger {
  if (tiefe > 20) return zeiger;
  const belegt = szene.verbindungen.find(v => gleich(v.von, zeiger) || gleich(v.nach, zeiger));
  if (!belegt) return zeiger;

  const hier = szene.geraete.find(x => x.id === zeiger.geraet);
  // Auf einer Schale wächst der Stapel nach oben, am Haken nach unten.
  const traegt = nachOben ?? (hier ? !!portVon(hier.typ, zeiger.port)?.traegt : false);
  const weiter = traegt ? "oese" : "unten";

  const dort = gleich(belegt.von, zeiger) ? belegt.nach : belegt.von;
  const dranhaengend = szene.geraete.find(x => x.id === dort.geraet);
  if (dranhaengend?.typ === "massestueck" && portVon(dranhaengend.typ, weiter)) {
    return freierHaken(szene, { geraet: dranhaengend.id, port: weiter }, tiefe + 1, traegt);
  }
  return zeiger;
}

/**
 * Der Anschluss, an dem ein gezogenes Gerät andocken würde — oder null.
 *
 * Damit wird aus »Anschluss antippen, anderen Anschluss antippen« die Geste,
 * die man erwartet: das Gewicht auf den Haken ziehen und loslassen.
 */
export function andockStelle(
  szene: Szene,
  gezogen: string,
  welt: Punkt,
  mechanik: Record<string, { q: number }> = {},
  reichweite = 0.18,
): PortZeiger | null {
  const g = szene.geraete.find(x => x.id === gezogen);
  const eigener = g ? EIGENER_HAKEN[g.typ] : undefined;
  if (!g || !eigener) return null;

  const sicht = aufgeloest(szene, mechanik);
  let bestes: PortZeiger | null = null;
  let beste = reichweite;

  for (const wirt of sicht.geraete) {
    if (wirt.id === gezogen) continue;
    for (const port of geraetTyp(wirt.typ)?.ports ?? []) {
      if (port.art !== "mechanik") continue;
      const ort = portOrt(wirt, port.id, mechanik[wirt.id]);
      if (!ort) continue;
      const abstand = Math.hypot(ort.x - welt.x, ort.y - welt.y);
      if (abstand < beste) { beste = abstand; bestes = { geraet: wirt.id, port: port.id }; }
    }
  }
  if (!bestes) return null;

  const frei = freierHaken(szene, bestes);
  // Am eigenen Haken kann nichts hängen, und schon Verbundenes nicht doppelt.
  if (frei.geraet === gezogen) return null;
  return frei;
}
