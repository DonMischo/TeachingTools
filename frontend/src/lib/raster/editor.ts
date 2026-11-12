/**
 * Raster-Editor für Netze aus Bauteilen und Leitungen — ohne Bildschirm, darum
 * testbar. Benutzt von »Stromkreise« und vom Baukasten in »Druck & Strömung«;
 * was je Bauteilart anders ist (Anschlüsse, Sonderformen), steht in `Regeln`.
 *
 * Jede Operation gibt ein neues Netz zurück (für Rückgängig) und räumt danach
 * auf: Eine Leitung, durch deren Mitte ein Anschluss läuft, wird dort geteilt.
 * Wer ein Bauteil verschiebt oder dreht, nimmt die angeschlossenen Leitungen mit.
 */

export interface Punkt { x: number; y: number }
export interface Draht { id: string; a: Punkt; b: Punkt }
export interface RasterTeil<A extends string> { id: string; art: A; a: Punkt; b: Punkt; werte: Record<string, number> }
export interface RasterNetz<A extends string> { version: 1; bauteile: RasterTeil<A>[]; draehte: Draht[] }

export type Auswahl = { art: "bauteil" | "draht"; id: string; ende?: "a" | "b" };

export interface Regeln<A extends string> {
  /** Anschlusspunkte eines Bauteils. */
  anschluesse(t: RasterTeil<A>): Punkt[];
  /** Ist die Strecke a–b selbst ein Leiter (dann wird eine Leitung darunter entfernt)? */
  leitetZwischen(art: A): boolean;
  /** Muss das Bauteil waagerecht oder senkrecht liegen, und gibt es keine greifbaren Enden? */
  starr(art: A): boolean;
  /** Abstand des Zeigers zu Teilen des Körpers außerhalb der Strecke a–b (Trafo, Umschalter). */
  koerperAbstand?(t: RasterTeil<A>, p: { x: number; y: number }, strecke: (p: { x: number; y: number }, a: Punkt, b: Punkt) => number): number;
}

export const gleich = (p: Punkt, q: Punkt) => p.x === q.x && p.y === q.y;
const plus = (p: Punkt, dx: number, dy: number): Punkt => ({ x: p.x + dx, y: p.y + dy });

/** Liegt p echt zwischen a und b auf der Strecke (Rasterpunkte, also exakt)? */
function liegtInnen(p: Punkt, a: Punkt, b: Punkt): boolean {
  const bx = b.x - a.x, by = b.y - a.y, px = p.x - a.x, py = p.y - a.y;
  if (bx * py - by * px !== 0) return false;
  const skalar = bx * px + by * py;
  return skalar > 0 && skalar < bx * bx + by * by;
}
const liegtAuf = (p: Punkt, a: Punkt, b: Punkt) => gleich(p, a) || gleich(p, b) || liegtInnen(p, a, b);

function abstandZurStrecke(p: { x: number; y: number }, a: Punkt, b: Punkt): number {
  const bx = b.x - a.x, by = b.y - a.y;
  const l2 = bx * bx + by * by;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * bx), p.y - (a.y + t * by));
}

export function rasterEditor<A extends string>(r: Regeln<A>) {
  type Netz = RasterNetz<A>;
  type Teil = RasterTeil<A>;

  function neueId(s: Netz, praefix: string): string {
    const belegt = new Set([...s.bauteile.map(t => t.id), ...s.draehte.map(d => d.id)]);
    let n = 1;
    while (belegt.has(`${praefix}${n}`)) n++;
    return `${praefix}${n}`;
  }

  /**
   * Teilt Leitungen an fremden Endpunkten, wirft Leitungen der Länge null und
   * Doppelte weg — und Stücke, die genau unter einem leitenden Bauteil liegen:
   * Wer ein Bauteil auf eine Leitung legt, will es in die Leitung setzen.
   */
  function normalisiere<N extends Netz>(s: N): N {
    let draehte = s.draehte.filter(d => !gleich(d.a, d.b));
    for (let runde = 0; runde < 1000; runde++) {
      const punkte = [...s.bauteile.flatMap(t => r.anschluesse(t)), ...draehte.flatMap(d => [d.a, d.b])];
      let geteilt = false;
      for (let i = 0; i < draehte.length && !geteilt; i++) {
        const d = draehte[i];
        const p = punkte.find(q => liegtInnen(q, d.a, d.b));
        if (!p) continue;
        const id = neueId({ ...s, draehte }, "d");
        draehte = [...draehte.slice(0, i), { ...d, b: p }, { id, a: p, b: d.b }, ...draehte.slice(i + 1)];
        geteilt = true;
      }
      if (!geteilt) break;
    }
    const leiter = s.bauteile.filter(t => r.leitetZwischen(t.art));
    draehte = draehte.filter(d => !leiter.some(t => liegtAuf(d.a, t.a, t.b) && liegtAuf(d.b, t.a, t.b)));
    const gesehen = new Set<string>();
    draehte = draehte.filter(d => {
      const k1 = `${d.a.x},${d.a.y}|${d.b.x},${d.b.y}`, k2 = `${d.b.x},${d.b.y}|${d.a.x},${d.a.y}`;
      if (gesehen.has(k1) || gesehen.has(k2)) return false;
      gesehen.add(k1);
      return true;
    });
    return { ...s, draehte };
  }

  /** Standardlage eines neuen Bauteils: waagerecht, vier Raster lang. */
  function fuegeBauteilHinzu<N extends Netz>(s: N, art: A, a: Punkt, b?: Punkt): { schaltung: N; id: string } {
    const ende = b && !gleich(a, b) ? b : plus(a, 4, 0);
    const id = neueId(s, "b");
    const t: Teil = { id, art, a, b: ende, werte: {} };
    return { schaltung: normalisiere({ ...s, bauteile: [...s.bauteile, t] }), id };
  }

  /** Eine Leitung; schräg gezogen wird sie zum Winkel (erst waagerecht, dann senkrecht). */
  function fuegeDrahtHinzu<N extends Netz>(s: N, a: Punkt, b: Punkt): N {
    if (gleich(a, b)) return s;
    const stuecke: [Punkt, Punkt][] = a.x !== b.x && a.y !== b.y ? [[a, { x: b.x, y: a.y }], [{ x: b.x, y: a.y }, b]] : [[a, b]];
    let neu = s;
    for (const [p, q] of stuecke) neu = { ...neu, draehte: [...neu.draehte, { id: neueId(neu, "d"), a: p, b: q }] };
    return normalisiere(neu);
  }

  /** Zieht Leitungsenden mit — nur wo kein anderes Bauteil am alten Punkt hängt. */
  function mitDraehten(s: Netz, id: string, alt: Punkt[], neu: Punkt[]): Draht[] {
    const fremde = s.bauteile.filter(t => t.id !== id).flatMap(t => r.anschluesse(t));
    const ziel = (p: Punkt) => {
      const k = alt.findIndex(q => gleich(q, p));
      return k >= 0 && !fremde.some(q => gleich(q, p)) ? neu[k] : p;
    };
    return s.draehte.map(d => ({ ...d, a: ziel(d.a), b: ziel(d.b) }));
  }

  function ersetzeBauteil<N extends Netz>(s: N, alt: Teil, neu: Teil): N {
    const draehte = mitDraehten(s, alt.id, r.anschluesse(alt), r.anschluesse(neu));
    return normalisiere({ ...s, bauteile: s.bauteile.map(t => (t.id === alt.id ? neu : t)), draehte });
  }

  function verschiebe<N extends Netz>(s: N, w: Auswahl, dx: number, dy: number): N {
    if (!dx && !dy) return s;
    if (w.art === "draht") {
      return normalisiere({ ...s, draehte: s.draehte.map(d => (d.id === w.id ? { ...d, a: plus(d.a, dx, dy), b: plus(d.b, dx, dy) } : d)) });
    }
    const t = s.bauteile.find(x => x.id === w.id);
    return t ? ersetzeBauteil(s, t, { ...t, a: plus(t.a, dx, dy), b: plus(t.b, dx, dy) }) : s;
  }

  /** Zieht ein Ende auf `p`. Starre Bauteile bleiben gerade (nur waagerecht/senkrecht). */
  function verschiebeEnde<N extends Netz>(s: N, w: Auswahl, ende: "a" | "b", p: Punkt): N {
    if (w.art === "draht") {
      const d = s.draehte.find(x => x.id === w.id);
      if (!d || gleich(p, ende === "a" ? d.b : d.a)) return s;
      return normalisiere({ ...s, draehte: s.draehte.map(x => (x.id === w.id ? { ...x, [ende]: p } : x)) });
    }
    const t = s.bauteile.find(x => x.id === w.id);
    if (!t) return s;
    const anderes = ende === "a" ? t.b : t.a;
    if (gleich(p, anderes)) return s;
    if (r.starr(t.art) && p.x !== anderes.x && p.y !== anderes.y) return s;
    return ersetzeBauteil(s, t, { ...t, [ende]: p });
  }

  /** Dreht um 90° im Uhrzeigersinn um `a`. */
  function drehe<N extends Netz>(s: N, w: Auswahl): N {
    const dreh = (a: Punkt, b: Punkt): Punkt => ({ x: a.x - (b.y - a.y), y: a.y + (b.x - a.x) });
    if (w.art === "draht") return normalisiere({ ...s, draehte: s.draehte.map(d => (d.id === w.id ? { ...d, b: dreh(d.a, d.b) } : d)) });
    const t = s.bauteile.find(x => x.id === w.id);
    return t ? ersetzeBauteil(s, t, { ...t, b: dreh(t.a, t.b) }) : s;
  }

  function loesche<N extends Netz>(s: N, w: Auswahl): N {
    return w.art === "draht"
      ? { ...s, draehte: s.draehte.filter(d => d.id !== w.id) }
      : normalisiere({ ...s, bauteile: s.bauteile.filter(t => t.id !== w.id) });
  }

  function setzeWert<N extends Netz>(s: N, id: string, name: string, wert: number): N {
    return { ...s, bauteile: s.bauteile.map(t => (t.id === id ? { ...t, werte: { ...t.werte, [name]: wert } } : t)) };
  }

  /** Was liegt unter dem Zeiger (Rasterkoordinaten)? Bauteile vor Leitungen; nahe an einem Ende mit Ende. */
  function treffer(s: Netz, p: { x: number; y: number }, toleranz = 0.45): Auswahl | null {
    const ende = (a: Punkt, b: Punkt): "a" | "b" | undefined =>
      Math.hypot(p.x - a.x, p.y - a.y) < toleranz ? "a" : Math.hypot(p.x - b.x, p.y - b.y) < toleranz ? "b" : undefined;
    let bester: { w: Auswahl; d: number } | null = null;
    for (const t of s.bauteile) {
      let d = abstandZurStrecke(p, t.a, t.b);
      if (r.koerperAbstand) d = Math.min(d, r.koerperAbstand(t, p, abstandZurStrecke));
      // Der Körper eines Bauteils ist breiter als eine Leitung.
      if (d < toleranz + 0.3 && (!bester || d < bester.d)) {
        const e = r.starr(t.art) ? undefined : ende(t.a, t.b);
        bester = { w: { art: "bauteil", id: t.id, ...(e ? { ende: e } : {}) }, d };
      }
    }
    if (bester) return bester.w;
    for (const dr of s.draehte) {
      const d = abstandZurStrecke(p, dr.a, dr.b);
      if (d < toleranz && (!bester || d < bester.d)) {
        const e = ende(dr.a, dr.b);
        bester = { w: { art: "draht", id: dr.id, ...(e ? { ende: e } : {}) }, d };
      }
    }
    return bester?.w ?? null;
  }

  return { neueId, normalisiere, fuegeBauteilHinzu, fuegeDrahtHinzu, verschiebe, verschiebeEnde, drehe, loesche, setzeWert, treffer };
}
