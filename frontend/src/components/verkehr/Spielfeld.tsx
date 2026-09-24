"use client";
/**
 * Die Pixi-Bühne der Verkehrs-Simulation. Liest die Tasten, bewegt die Figur,
 * lässt Ampeln und Autos laufen, prüft die Regeln und führt die Kamera nach.
 * Wird per React.lazy geladen — Pixi ist groß.
 */
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text } from "pixi.js";
import { BAHNSTEIG_AB, stadt, startpunkt, winkelVon, type Stadt, type Untergrund } from "@/lib/verkehr/stadt";
import { eingabeAusTasten, KEINE_EINGABE, schritt, type Figur } from "@/lib/verkehr/bewegung";
import {
  beschriftung, kopfWinkel, zeichneAutoampel, zeichneFahrzeug, zeichneFigur, zeichneFussampel, zeichnePolizist, zeichneStadt,
} from "@/lib/verkehr/zeichnen";
import { GESTEN, gestenDeckkraft, gesteZuTaste, type Geste } from "@/lib/verkehr/gesten";
import { autoLicht, baueAnlagen, fussGruen, FUSS_GRUEN, TASTER_WARTEN, type Anlage, type Licht } from "@/lib/verkehr/ampeln";
import { BUS, Strassenverkehr, type Fahrzeug, type Fussgaenger } from "@/lib/verkehr/autos";
import { entpacke, packe, winkelZu, type Netz } from "@/lib/verkehr/netz";
import { aussteigerLage, aussteigerZahl, TUER_BREITE, tuerPhase, tueren } from "@/lib/verkehr/tueren";
import { bahnStand, baueBahnen, wagenLagen } from "@/lib/verkehr/schiene";
import { Einstiegsregeln, Regelwaechter, UMSCHAUEN_DAUER, MELDUNGEN, type Meldung, type OffeneTuer, type Verdecker } from "@/lib/verkehr/regeln";

/** Pixel je Meter: etwa 80 m Stadt über die Breite eines Laptops. */
const ZOOM = 14;
/** Figuren zeichnen wir 1,8-mal so groß wie echt; gerechnet wird mit echter Größe. */
const FIGUR_GROESSER = 1.8;
/** Nach einem Unfall so lange stehen, bevor es am Gehweg weitergeht. */
const UNFALL_PAUSE = 2.5;
/** Ampelköpfe wie die Figuren größer als echt, sonst sieht man die Farbe nicht. */
const AMPEL_GROESSER = 1.8;
/** Zoom an einer offenen Tür. */
const TUER_ZOOM = 30;
const AUSSTEIGER_FARBEN = [0x8e44ad, 0x16a085, 0xd35400, 0x2c3e50, 0xc0392b];

/** Eine Tür samt Zeit seit dem Halt und Nummern für die Aussteigenden. */
type Tuerstand = OffeneTuer & { alter: number; nr: number; id: number };

/** Steht man auf dem Bahnsteig vor der weißen Linie (näher als 0,8 m an der Kante)? */
function vorDerLinie(s: Stadt, x: number, y: number) {
  if (s.untergrund(x, y).art !== "bahnsteig") return false;
  return s.halte.some((h) => {
    if (!h.fiktiv) return false;
    const quer = -(x - h.p[0]) * Math.sin(h.winkel) + (y - h.p[1]) * Math.cos(h.winkel);
    return Math.hypot(x - h.p[0], y - h.p[1]) < 40 && quer < BAHNSTEIG_AB + 0.8;
  });
}

/** Weiße Blase mit Emoji über einer Figur. */
function baueBlase(): Container & { emoji: Text } {
  const blase = new Container() as Container & { emoji: Text };
  const kreis = new Graphics().circle(0, 0, 1.1).fill(0xffffff).stroke({ width: 0.08, color: 0x333333 });
  const emoji = new Text({ text: "", style: { fontSize: 64 } });
  emoji.anchor.set(0.5);
  emoji.scale.set(1.3 / 64);
  blase.addChild(kreis, emoji);
  blase.visible = false;
  blase.emoji = emoji;
  return blase;
}

/**
 * Die Polizei zu `rest` Sekunden vor Ende der Strafe: die ersten 2 s kommt sie
 * von der Seite heran, die letzten 2 s geht sie wieder. `rest < 0` = weg.
 */
function stellePolizei(p: Container, rest: number, x: number, y: number) {
  p.visible = rest > 0;
  if (!p.visible) return;
  const gesamt = 8, seit = gesamt - rest;
  const weg = seit < 2 ? (2 - seit) * 4 : rest < 2 ? (2 - rest) * 4 : 0;
  p.position.set(x + 1.2 + weg, y - 0.3);
  p.rotation = seit < 2 ? Math.PI : rest < 2 ? 0 : Math.PI;
}

export type SpielfeldProps = {
  farbe?: number;
  onUntergrund?: (u: Untergrund["art"]) => void;
  onGeste?: (g: Geste) => void;
  onMeldung?: (m: Meldung) => void;
  onHinweis?: (text: string | null) => void;
  /** Der Live-Raum (oder ein Solo-Raum). Wird jedes Bild gelesen. */
  netz: Netz;
};

export default function Spielfeld({ farbe = 0x2f6fd6, netz, ...rueck }: SpielfeldProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const rueckruf = useRef(rueck);
  const netzRef = useRef(netz);
  useEffect(() => { rueckruf.current = rueck; netzRef.current = netz; });

  useEffect(() => {
    const el = huelle.current!;
    const app = new Application();
    let aus = false;
    let bereit = false;
    const gedrueckt = new Set<string>();
    let einmal: ((code: string) => void) | null = null;
    let zeitgeber: ReturnType<typeof setInterval> | undefined;

    const unten = (e: KeyboardEvent) => {
      // Nur wenn die Bühne den Fokus hat — sonst tippt niemand mehr in ein Textfeld.
      if (!el.contains(document.activeElement)) return;
      if (!e.repeat) einmal?.(e.code);
      gedrueckt.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    };
    const oben = (e: KeyboardEvent) => gedrueckt.delete(e.code);
    const weg = () => gedrueckt.clear();
    window.addEventListener("keydown", unten);
    window.addEventListener("keyup", oben);
    window.addEventListener("blur", weg);

    (async () => {
      await app.init({ resizeTo: el, background: 0x3c4a2c, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
      if (aus) { app.destroy(true); return; }
      bereit = true;
      el.appendChild(app.canvas);
      // Prüfhilfe: mit ?takt läuft die Schleife am Zeitgeber statt an
      // requestAnimationFrame — ein verdecktes Browserfenster liefert keine Bilder.
      if (new URLSearchParams(window.location.search).has("takt")) {
        app.ticker.stop();
        zeitgeber = setInterval(() => app.ticker.update(performance.now()), 16);
      }

      const s = stadt();
      const anlagen = baueAnlagen(s);
      const tasterVon = (a: Anlage) => netzRef.current.taster().get(a.id) ?? -Infinity;
      const verkehr = new Strassenverkehr(s, anlagen);
      const waechter = new Regelwaechter(s, anlagen, tasterVon);
      const uhr = () => netzRef.current.uhr();

      const welt = new Container();
      welt.scale.set(ZOOM);
      const { boden, oben: kronen } = zeichneStadt(s);
      const ampelEbene = new Container();
      const autoEbene = new Container();
      const figuren = new Container();
      welt.addChild(boden, figuren, autoEbene, ampelEbene, kronen);
      app.stage.addChild(welt);

      // Ampelköpfe: Autoampeln am rechten Fahrbahnrand, Fußgängerampeln an beiden Bordsteinen.
      const koepfe: { g: Graphics; zustand: (t: number) => string; male: (z: string) => void; letzt: string }[] = [];
      const tasterOrte: { a: Anlage; p: [number, number] }[] = [];
      for (const a of anlagen) for (const sig of a.signale) {
        const n = s.naechsteStrasse(sig.p[0], sig.p[1], 12);
        if (!n) continue;
        const w = winkelVon(n.st), qx = -Math.sin(w), qy = Math.cos(w);
        const rand = n.s.breite / 2 + 0.7;
        if (sig.art === "auto") {
          const g = new Graphics();
          g.position.set(sig.p[0] + qx * rand, sig.p[1] + qy * rand);
          g.rotation = w;
          g.scale.set(AMPEL_GROESSER);
          ampelEbene.addChild(g);
          koepfe.push({ g, letzt: "", zustand: (t) => autoLicht(a, sig.achse, t, tasterVon(a)), male: (z) => zeichneAutoampel(z as Licht, g) });
        }
        if (sig.art === "fuss" || a.achsen.length < 2) for (const seite of [-1, 1]) {
          const g = new Graphics();
          const p: [number, number] = [sig.p[0] + qx * seite * (rand + 0.4), sig.p[1] + qy * seite * (rand + 0.4)];
          g.position.set(p[0], p[1]);
          g.rotation = w + (seite > 0 ? 0 : Math.PI);
          g.scale.set(AMPEL_GROESSER);
          ampelEbene.addChild(g);
          if (a.achsen.length < 2) tasterOrte.push({ a, p });
          koepfe.push({
            g, letzt: "",
            zustand: (t) => `${fussGruen(a, sig.achse, t, tasterVon(a)) ? "g" : "r"}${t - tasterVon(a) < TASTER_WARTEN ? "k" : ""}`,
            male: (z) => zeichneFussampel(z[0] === "g", z[1] === "k", g),
          });
        }
      }

      const [sx, sy] = startpunkt(s);
      let ich: Figur = { x: sx, y: sy, winkel: 0, tempo: 0 };
      const figur = zeichneFigur(farbe);
      // Wie im ersten GTA größer als maßstäblich — sonst ist das Kind ein Punkt.
      figur.scale.set(FIGUR_GROESSER);
      figuren.addChild(figur);

      // Gestenblase: weißer Kreis mit Emoji, hängt über der Figur (dreht nicht mit).
      const meineBlase = baueBlase();
      figuren.addChild(meineBlase);
      let gesteSeit = -Infinity;
      const zeigeBlase = (zeichen: string) => { meineBlase.emoji.text = zeichen; gesteSeit = uhr(); };

      // Polizei nach einer Beleidigung: kommt, bleibt, geht.
      const polizei = zeichnePolizist();
      polizei.scale.set(FIGUR_GROESSER);
      polizei.visible = false;
      figuren.addChild(polizei);
      let strafeGemeldet = 0;

      // Die anderen Spieler
      const fremde = new Map<string, { figur: ReturnType<typeof zeichneFigur>; blase: ReturnType<typeof baueBlase>; schild: Text; polizei: Container; x: number; y: number }>();
      let zuletztVerkehr = 0;
      const gezeigt = new Map<number, Fahrzeug>();

      const mensch: Fussgaenger = { id: "ich", x: sx, y: sy, hand: -Infinity, karmaBis: -Infinity };
      let umschauenSeit = -Infinity;
      let blickGezaehlt = true;
      let unfallZiel: [number, number] | null = null;
      let unfallBis = -Infinity;
      let naherTaster: Anlage | null = null;
      let letzteLinie = -Infinity;
      let letzterHinweis: string | null = null;

      const melde = (m: Meldung) => { rueckruf.current.onMeldung?.(m); netzRef.current.sendeMeldung(m.id, m.punkte); };

      einmal = (code) => {
        const t = uhr();
        const geste = gesteZuTaste(code);
        if (geste) {
          if (geste.beleidigung && !netzRef.current.beleidigungen()) return;
          zeigeBlase(geste.emoji);
          if (geste.id === "hand") mensch.hand = t;
          netzRef.current.sendeGeste(geste.id);
          rueckruf.current.onGeste?.(geste);
        }
        if (code === "Space" && t - umschauenSeit > UMSCHAUEN_DAUER) { umschauenSeit = t; blickGezaehlt = false; }
        if (code === "KeyE" && naherTaster && t - tasterVon(naherTaster) > TASTER_WARTEN + FUSS_GRUEN + 6) netzRef.current.sendeTaster(naherTaster.id);
      };

      // Busse auf einer Linie durch die Haltestellen; Bahnen nach Fahrplan.
      const linie = verkehr.baueBuslinie(s.halte.filter((h) => h.art === "bushalt"));
      if (linie) verkehr.setzeBusse(linie, 3);
      const bahnen = baueBahnen(s);
      const einstieg = new Einstiegsregeln();
      let mitfahrt: { art: "bus"; id: number; abRi: number } | { art: "bahn"; i: number } | null = null;

      const fahrzeuge = new Map<string, Container>();
      const gesehen = new Set<string>();
      const zeigeFahrzeug = (key: string, bauen: () => Container, x: number, y: number, w: number) => {
        let c = fahrzeuge.get(key);
        if (!c) { c = bauen(); fahrzeuge.set(key, c); autoEbene.addChild(c); }
        c.position.set(x, y);
        c.rotation = w;
        gesehen.add(key);
      };
      // Türen und Aussteigende werden jedes Bild neu gemalt.
      const tuerEbene = new Graphics();
      figuren.addChild(tuerEbene);
      let zoom = ZOOM;
      let letzterUntergrund = "";

      app.ticker.add((tick) => {
        const dt = Math.min(tick.deltaMS / 1000, 0.1);
        const t = uhr();

        const n = netzRef.current;
        // Beim Umschauen, beim Mitfahren, bei der Polizei und nach einem Unfall bleibt die Figur stehen.
        const festgehalten = (n.strafe()?.bis ?? 0) > t;
        if (t >= unfallBis && !mitfahrt && !festgehalten) ich = schritt(ich, t - umschauenSeit < UMSCHAUEN_DAUER ? KEINE_EINGABE : eingabeAusTasten(gedrueckt), dt, s);
        if (!blickGezaehlt && t - umschauenSeit >= UMSCHAUEN_DAUER) { blickGezaehlt = true; waechter.geschaut(t); }
        if (unfallZiel && t >= unfallBis) { ich = { ...ich, x: unfallZiel[0], y: unfallZiel[1] }; unfallZiel = null; }

        // Strafe nach einer Beleidigung: stehen bleiben, bis die Polizei fertig ist.
        const strafe = n.strafe();
        const bestraft = !!strafe && t < strafe.bis;
        if (strafe && strafe.bis !== strafeGemeldet) {
          strafeGemeldet = strafe.bis;
          mensch.karmaBis = strafe.karmaBis;
          melde(MELDUNGEN.beleidigung);
        }
        stellePolizei(polizei, bestraft ? strafe!.bis - t : -1, ich.x, ich.y);

        // Verkehr auf der Straße: der Taktgeber rechnet, die anderen zeigen, was er schickt.
        const unterwegs = t >= unfallBis && !mitfahrt && !bestraft;
        const andere = n.andere();
        const menschen: Fussgaenger[] = unterwegs ? [mensch] : [];
        for (const a of andere) if (!a.mitfahrt) menschen.push({ id: a.key, x: a.x, y: a.y, hand: a.hand, karmaBis: a.karmaBis });
        let fahrzeugListe: Fahrzeug[];
        let unfaelle: { fussgaenger: string }[] = [];
        if (n.taktgeber()) {
          unfaelle = verkehr.schritt(dt, t, menschen, tasterVon).filter((u) => u.fussgaenger === "ich");
          fahrzeugListe = verkehr.fahrzeuge;
          if (t - zuletztVerkehr > 0.2) { zuletztVerkehr = t; n.sendeVerkehr(verkehr.fahrzeuge.map(packe)); }
        } else {
          // Geglättet: die Pakete kommen nur fünfmal je Sekunde.
          const neu = new Map<number, Fahrzeug>();
          for (const g of n.fahrzeuge() ?? []) {
            const ziel = entpacke(g, BUS);
            const alt = gezeigt.get(ziel.id);
            if (alt && Math.hypot(alt.x - ziel.x, alt.y - ziel.y) < 15) {
              const f = Math.min(1, dt * 8);
              ziel.x = alt.x + (ziel.x - alt.x) * f;
              ziel.y = alt.y + (ziel.y - alt.y) * f;
              ziel.winkel = winkelZu(alt.winkel, ziel.winkel, f);
            }
            neu.set(ziel.id, ziel);
          }
          gezeigt.clear();
          for (const [id, f] of neu) gezeigt.set(id, f);
          fahrzeugListe = [...gezeigt.values()];
          if (unterwegs) for (const f of fahrzeugListe) {
            if (f.tempo <= 1.5) continue;
            const c = Math.cos(f.winkel), sn = Math.sin(f.winkel), dx = ich.x - f.x, dy = ich.y - f.y;
            if (Math.abs(dx * c + dy * sn) < f.laenge / 2 + 0.3 && Math.abs(-dx * sn + dy * c) < f.breite / 2 + 0.3) unfaelle = [{ fussgaenger: "ich" }];
          }
        }
        gesehen.clear();
        for (const f of fahrzeugListe) zeigeFahrzeug(`s${f.id}`, () => zeichneFahrzeug(f.art, f.farbe, f.laenge, f.breite), f.x, f.y, f.winkel);

        // Die anderen Spieler zeichnen
        const daSind = new Set<string>();
        for (const a of andere) {
          daSind.add(a.key);
          let d = fremde.get(a.key);
          if (!d) {
            const fig = zeichneFigur(a.farbe);
            fig.scale.set(FIGUR_GROESSER);
            const schild = beschriftung(a.name, 0xffffff, 0.9);
            const bl = baueBlase();
            const pol = zeichnePolizist();
            pol.scale.set(FIGUR_GROESSER);
            figuren.addChild(fig, schild, bl, pol);
            d = { figur: fig, blase: bl, schild, polizei: pol, x: a.x, y: a.y };
            fremde.set(a.key, d);
          }
          const f = Math.min(1, dt * 10);
          if (Math.hypot(d.x - a.x, d.y - a.y) > 10) { d.x = a.x; d.y = a.y; }
          d.x += (a.x - d.x) * f; d.y += (a.y - d.y) * f;
          d.figur.position.set(d.x, d.y);
          d.figur.rotation = a.w;
          d.figur.visible = d.schild.visible = !a.mitfahrt;
          d.schild.position.set(d.x, d.y + 1.4);
          const g = n.gesten().get(a.key);
          const geste = g && GESTEN.find((x) => x.id === g.id);
          d.blase.alpha = g ? gestenDeckkraft(t - g.t) : 0;
          d.blase.visible = d.blase.alpha > 0 && !a.mitfahrt;
          if (geste) d.blase.emoji.text = geste.emoji;
          d.blase.position.set(d.x, d.y - 2);
          stellePolizei(d.polizei, a.strafeBis > t ? a.strafeBis - t : -1, d.x, d.y);
        }
        for (const [key, d] of fremde) if (!daSind.has(key)) {
          for (const c of [d.figur, d.blase, d.schild, d.polizei]) c.destroy();
          fremde.delete(key);
        }

        // Offene Türen sammeln: Busse an Haltestellen, Bahnen am Bahnsteig.
        const offene: Tuerstand[] = [];
        const haltende: Verdecker[] = [];
        for (const f of fahrzeugListe) {
          if (f.art !== "bus" || f.haltSeit == null) continue;
          haltende.push({ x: f.x, y: f.y, winkel: f.winkel, laenge: f.laenge });
          const seit = t - f.haltSeit;
          tueren(f.x, f.y, f.winkel, BUS.breite, [...BUS.tueren]).forEach((tuer, i) =>
            offene.push({ fahrzeug: `bus-${f.id}`, halt: String(f.haltRi), phase: tuerPhase(seit), tuer, alter: seit, nr: i, id: f.id }));
        }
        let bahnUnfall = false, bahnNah = false;
        bahnen.forEach((b, bi) => {
          const st = bahnStand(b, t);
          if (!st.sichtbar) return;
          wagenLagen(b, st).forEach((w, wi) => {
            zeigeFahrzeug(`b${bi}-${wi}`, () => zeichneFahrzeug(b.art, b.art === "tram" ? 0xe9e4d8 : 0xc8102e, w.laenge, b.breite), w.p[0], w.p[1], w.winkel);
            const dx = ich.x - w.p[0], dy = ich.y - w.p[1];
            if (st.tempo > 0.5 && unterwegs) {
              const c = Math.cos(w.winkel), sn = Math.sin(w.winkel);
              if (Math.abs(dx * c + dy * sn) < w.laenge / 2 + 0.3 && Math.abs(-dx * sn + dy * c) < b.breite / 2 + 0.3) bahnUnfall = true;
              if (Math.hypot(dx, dy) < 80) bahnNah = true;
            }
            if (st.haltAlter !== null) {
              const seit = st.haltAlter;
              tueren(w.p[0], w.p[1], w.winkel, b.breite, b.tuerLagen, b.seite).forEach((tuer, ti) =>
                offene.push({ fahrzeug: `bahn-${bi}`, halt: String(Math.floor((t + b.versatz) / b.takt)), phase: tuerPhase(seit), tuer, alter: seit, nr: wi * 10 + ti, id: bi + 1000 }));
            }
          });
        });
        for (const [key, c] of fahrzeuge) if (!gesehen.has(key)) { c.destroy(); fahrzeuge.delete(key); }

        if ((unfaelle.length || bahnUnfall) && unterwegs) {
          unfallBis = t + UNFALL_PAUSE;
          melde(MELDUNGEN.angefahren);
          waechter.zuruecksetzen();
          unfallZiel = startpunkt(s, [ich.x, ich.y]);
        }

        // Türen malen: zu = dunkel, offen = gelb; dazu die Aussteigenden.
        tuerEbene.clear();
        for (const o of offene) {
          if (Math.abs(o.tuer.p[0] - ich.x) > 60 || Math.abs(o.tuer.p[1] - ich.y) > 45) continue;
          const offen = o.phase === "aussteigen" || o.phase === "einsteigen";
          const [lx, ly] = o.tuer.laengs, h = TUER_BREITE / 2;
          tuerEbene.moveTo(o.tuer.p[0] - lx * h, o.tuer.p[1] - ly * h).lineTo(o.tuer.p[0] + lx * h, o.tuer.p[1] + ly * h)
            .stroke({ width: 0.3, color: offen ? 0xffe066 : 0x444444 });
          for (let k = 0; k < aussteigerZahl(o.id, Number(o.halt), o.nr); k++) {
            const p = aussteigerLage(o.tuer, k, o.alter);
            if (!p) continue;
            tuerEbene.circle(p[0], p[1], 0.32).fill(AUSSTEIGER_FARBEN[(k + o.nr) % AUSSTEIGER_FARBEN.length]);
            tuerEbene.circle(p[0], p[1], 0.17).fill(0x5a3a22);
          }
        }

        // Ein- und Aussteigen
        if (mitfahrt?.art === "bus") {
          const fahrt = mitfahrt;
          const bus = fahrzeugListe.find((f) => f.id === fahrt.id);
          if (!bus) mitfahrt = null;
          else {
            ich = { ...ich, x: bus.x, y: bus.y };
            if (bus.haltSeit != null && String(bus.haltRi) !== String(fahrt.abRi) && tuerPhase(t - bus.haltSeit) === "aussteigen") {
              const [, mitte] = tueren(bus.x, bus.y, bus.winkel, BUS.breite, [...BUS.tueren]);
              ich = { ...ich, x: mitte.p[0] + mitte.raus[0] * 1.6, y: mitte.p[1] + mitte.raus[1] * 1.6 };
              mitfahrt = null;
              waechter.zuruecksetzen();
              melde(MELDUNGEN.ausgestiegen);
            }
          }
        } else if (mitfahrt?.art === "bahn") {
          const b = bahnen[mitfahrt.i];
          const st = bahnStand(b, t);
          if (st.sichtbar) {
            const [vorn] = wagenLagen(b, st);
            ich = { ...ich, x: vorn.p[0], y: vorn.p[1] };
          } else {
            // Eine Station gefahren und zurück: wieder am Bahnsteig.
            const w = b.halt.winkel;
            ich = { ...ich, x: b.halt.p[0] - Math.sin(w) * (BAHNSTEIG_AB + 2), y: b.halt.p[1] + Math.cos(w) * (BAHNSTEIG_AB + 2) };
            mitfahrt = null;
            waechter.zuruecksetzen();
            melde(MELDUNGEN.ausgestiegen);
          }
        } else if (t >= unfallBis) {
          const { meldungen, einsteigen } = einstieg.pruefe(ich.x, ich.y, offene);
          for (const m of meldungen) melde(m);
          if (einsteigen) {
            const o = einsteigen as Tuerstand;
            mitfahrt = o.fahrzeug.startsWith("bus") ? { art: "bus", id: o.id, abRi: Number(o.halt) } : { art: "bahn", i: o.id - 1000 };
          }
        }
        figur.visible = !mitfahrt;
        mensch.x = ich.x; mensch.y = ich.y;
        figur.position.set(ich.x, ich.y);
        if (ich.tempo) figur.rotation = ich.winkel;
        figur.kopf.rotation = kopfWinkel(t - umschauenSeit, UMSCHAUEN_DAUER);
        figur.alpha = t < unfallBis ? 0.4 + 0.4 * Math.sin(t * 20) : 1;

        meineBlase.alpha = gestenDeckkraft(t - gesteSeit);
        meineBlase.visible = meineBlase.alpha > 0 && !mitfahrt;
        meineBlase.position.set(ich.x, ich.y - 2);
        n.sendeIch(ich.x, ich.y, figur.rotation, !!mitfahrt, farbe);

        // Ampeln
        for (const k of koepfe) {
          if (Math.abs(k.g.x - ich.x) > 90 || Math.abs(k.g.y - ich.y) > 70) continue;
          const z = k.zustand(t);
          if (z !== k.letzt) { k.letzt = z; k.male(z); }
        }

        // Regeln
        if (unterwegs) {
          for (const m of waechter.pruefe(ich.x, ich.y, t, haltende)) {
            melde(m);
            if (m.id === "rot" || m.id === "nichtGeschaut") zeigeBlase("⚠️");
          }
          if (bahnNah && vorDerLinie(s, ich.x, ich.y) && t - letzteLinie > 10) { letzteLinie = t; melde(MELDUNGEN.weisseLinie); }
        }

        // Hinweise: Taster in Reichweite, Mitfahrt
        naherTaster = null;
        for (const o of tasterOrte) if (Math.hypot(o.p[0] - ich.x, o.p[1] - ich.y) < 2.5) { naherTaster = o.a; break; }
        const hinweis = festgehalten ? "👮 Die Polizei redet mit dir …" : mitfahrt ? (mitfahrt.art === "bus" ? "Du fährst Bus — an der nächsten Haltestelle steigst du aus." : "Du fährst mit der Bahn …")
          : naherTaster ? (t - tasterVon(naherTaster) < TASTER_WARTEN ? "Signal kommt — warten …" : "E drücken: Ampel-Taster") : null;
        if (hinweis !== letzterHinweis) { letzterHinweis = hinweis; rueckruf.current.onHinweis?.(hinweis); }

        // Kamera: an einer offenen Tür heranzoomen, damit man sieht, wo man steht.
        let tuerNah: Tuerstand | null = null, dMin = 9;
        if (!mitfahrt) for (const o of offene) {
          const d = Math.hypot(o.tuer.p[0] - ich.x, o.tuer.p[1] - ich.y);
          if (d < dMin) { dMin = d; tuerNah = o; }
        }
        zoom += ((tuerNah ? TUER_ZOOM : ZOOM) - zoom) * Math.min(1, dt * 3);
        const blickX = tuerNah ? ich.x * 0.6 + tuerNah.tuer.p[0] * 0.4 : ich.x;
        const blickY = tuerNah ? ich.y * 0.6 + tuerNah.tuer.p[1] * 0.4 : ich.y;
        welt.scale.set(zoom);
        welt.position.set(app.screen.width / 2 - blickX * zoom, app.screen.height / 2 - blickY * zoom);

        const u = s.untergrund(ich.x, ich.y).art;
        if (u !== letzterUntergrund) { letzterUntergrund = u; rueckruf.current.onUntergrund?.(u); }
      });
    })();

    return () => {
      aus = true;
      einmal = null;
      clearInterval(zeitgeber);
      window.removeEventListener("keydown", unten);
      window.removeEventListener("keyup", oben);
      window.removeEventListener("blur", weg);
      if (bereit) app.destroy(true, { children: true });
    };
  }, [farbe]);

  return (
    <div
      ref={huelle}
      tabIndex={0}
      aria-label="Spielfeld — mit Pfeiltasten oder WASD laufen"
      className="absolute inset-0 outline-none"
      onPointerDown={() => huelle.current?.focus()}
    />
  );
}
