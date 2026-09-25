"use client";
/**
 * Die Pixi-Bühne der Verkehrs-Simulation. Liest die Tasten, bewegt die Figur,
 * lässt Ampeln und Autos laufen, prüft die Regeln und führt die Kamera nach.
 * Wird per React.lazy geladen — Pixi ist groß.
 */
import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { BAHNSTEIG_AB, schulMitte, schulStart, stadt, startpunkt, winkelVon, type Halt, type Stadt, type Untergrund } from "@/lib/verkehr/stadt";
import { eingabeAusTasten, KEINE_EINGABE, schritt, type Figur } from "@/lib/verkehr/bewegung";
import {
  beschriftung, kopfWinkel, zeichneSchild, zeichneAutoampel, zeichneFahrzeug, zeichneFigur, zeichneFussampel, zeichnePolizist, zeichneStadt,
} from "@/lib/verkehr/zeichnen";
import { GESTEN, gestenDeckkraft, gesteZuTaste, type Geste } from "@/lib/verkehr/gesten";
import { autoLicht, baueAnlagen, fussGruen, FUSS_GRUEN, TASTER_WARTEN, type Anlage, type Licht } from "@/lib/verkehr/ampeln";
import { BUS, Strassenverkehr, type Fahrzeug, type Fussgaenger } from "@/lib/verkehr/autos";
import { entpacke, packe, winkelZu, type Netz } from "@/lib/verkehr/netz";
import { baueSchilder, type SchildArt } from "@/lib/verkehr/schilder";
import { Gruppenblick } from "@/lib/verkehr/gruppe";
import type { Ereignis } from "@/lib/verkehr/missionen";
import { aussteigerLage, aussteigerZahl, TUER_BREITE, tuerPhase, tueren } from "@/lib/verkehr/tueren";
import { bahnStand, bahnTakt, baueBahnen, umlauf, wagenLagen } from "@/lib/verkehr/schiene";
import { abfahrten, abschnitt, helligkeit, istRush, linienImViertel, spielzeit, takt, uhrText, verkehrsFaktor, ABSCHNITT_NAME, type Abfahrt } from "@/lib/verkehr/fahrplan";
import { Klang } from "@/lib/verkehr/klang";
import { laternen, Nacht } from "@/lib/verkehr/nacht";
import { haltTafeln, malTafel, Minikarte, strassenNamen } from "@/lib/verkehr/ueberblick";
import type { Steuerkanal } from "./Steuerkreuz";
import { baueEimer, EIMER_NAH, GREIFEN, Muell, TRAGEN } from "@/lib/verkehr/muell";
import { Einstiegsregeln, Regelwaechter, UMSCHAUEN_DAUER, MELDUNGEN, type Meldung, type OffeneTuer, type Verdecker } from "@/lib/verkehr/regeln";

/** Pixel je Meter: etwa 80 m Stadt über die Breite eines Laptops. */
const ZOOM = 14;
/** Figuren zeichnen wir 1,8-mal so groß wie echt; gerechnet wird mit echter Größe. */
const FIGUR_GROESSER = 1.8;
/** Nach einem Unfall so lange stehen, bevor es am Gehweg weitergeht. */
const UNFALL_PAUSE = 2.5;
/** Ampelköpfe wie die Figuren größer als echt, sonst sieht man die Farbe nicht. */
const AMPEL_GROESSER = 1.8;
/** Zoom im Überblick: mehr Stadt auf einmal. */
const UEBERBLICK_ZOOM = 6;
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

/** LTB von oben: schwarzer Rücken, weißer Bauch, gelbe Weste, roter Helm, oranger Schnabel (nach +x). */
function zeichnePinguin(): Container {
  const c = new Container();
  const g = new Graphics();
  g.ellipse(0.1, 0.1, 0.3, 0.26).fill({ color: 0x000000, alpha: 0.3 });
  g.ellipse(-0.12, -0.16, 0.08, 0.05).fill(0xf59e0b).ellipse(-0.12, 0.16, 0.08, 0.05).fill(0xf59e0b);
  g.ellipse(0, 0, 0.28, 0.24).fill(0x1f2937);
  g.ellipse(0.06, 0, 0.18, 0.17).fill(0xd7ff1f);
  g.circle(0.08, 0, 0.13).fill(0xef4444);
  g.poly([0.2, -0.04, 0.34, 0, 0.2, 0.04]).fill(0xf59e0b);
  g.ellipse(-0.02, -0.26, 0.12, 0.05).fill(0x111827).ellipse(-0.02, 0.26, 0.12, 0.05).fill(0x111827);
  c.addChild(g);
  return c;
}

/** Dunkler Rand ums Bild — lenkt den Blick zur Mitte. */
function vignettenTextur(): Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const v = g.createRadialGradient(128, 128, 70, 128, 128, 182);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  return Texture.from(c);
}

/** Warnweste: gelbe Fläche mit Reflexstreifen über den Schultern. */
function westeFuer(): Graphics {
  return new Graphics()
    .ellipse(0, 0, 0.21, 0.35).fill(0xd7ff1f)
    .rect(-0.03, -0.35, 0.06, 0.7).fill(0xeeeeee);
}

/** Zielanzeige auf dem Dach (Liniennummer). */
function mitAnzeige(c: Container, anzeige?: string): Container {
  if (!anzeige) return c;
  const nr = anzeige.split(" ")[0];
  const t = new Text({ text: nr, style: { fontFamily: "Arial", fontWeight: "bold", fontSize: 48, fill: 0xffb000, stroke: { color: 0x000000, width: 8 } } });
  t.anchor.set(0.5);
  t.scale.set(1.6 / 48);
  c.addChild(t);
  return c;
}

/** Straßenbahn: Linie 1 und 5 im Wechsel, Ziel aus OSM. */
function tramAnzeige(linien: ReturnType<typeof linienImViertel>, runde: number): string {
  const trams = linien.filter((l) => l.art === "tram");
  if (!trams.length) return "Tram";
  const l = trams[((runde % trams.length) + trams.length) % trams.length];
  return `${l.nr} ${l.richtungen[0]?.ziel ?? ""}`.trim();
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
  onMeldung?: (m: Meldung, t: number) => void;
  /** Ereignisse für die Aufträge (Orte, Taster, Handzeichen, Einsteigen, Gruppe). */
  onEreignis?: (e: Ereignis) => void;
  /** Am Schild E gedrückt — die Hülle zeigt die Frage. */
  onSchild?: (art: SchildArt) => void;
  onHinweis?: (text: string | null) => void;
  /** Der Live-Raum (oder ein Solo-Raum). Wird jedes Bild gelesen. */
  netz: Netz;
  /** Stick und Knöpfe am Handy. */
  steuerkanal?: React.MutableRefObject<Steuerkanal>;
  /** Überblick an (Straßennamen, Abfahrtstafeln, große Karte). */
  ueberblick?: boolean;
  onUeberblick?: () => void;
  tonAn?: boolean;
  /** Uhrzeit und Tagesabschnitt, einmal je Spielminute. */
  onZeit?: (z: { text: string; abschnitt: string; rush: boolean; dunkel: boolean }) => void;
  /** Abfahrtstafel der Haltestelle, an der man steht (null = keine). */
  onHaltestelle?: (h: { name: string; abfahrten: Abfahrt[] } | null) => void;
  onWeste?: (an: boolean) => void;
  /** Wie viel Müll man gerade trägt. */
  onTragen?: (n: number) => void;
  /** Nähe zu etwas, wozu LTB etwas sagen kann. */
  onNaehe?: (was: "zebra" | "ampel" | "muell") => void;
};

export default function Spielfeld({ farbe = 0x2f6fd6, netz, steuerkanal, ueberblick = false, tonAn = true, ...rueck }: SpielfeldProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const rueckruf = useRef(rueck);
  const netzRef = useRef(netz);
  const optionen = useRef({ ueberblick, tonAn, steuerkanal });
  useEffect(() => { rueckruf.current = rueck; netzRef.current = netz; optionen.current = { ueberblick, tonAn, steuerkanal }; });

  useEffect(() => {
    const el = huelle.current!;
    const app = new Application();
    let aus = false;
    let bereit = false;
    const gedrueckt = new Set<string>();
    let einmal: ((code: string) => void) | null = null;
    let zeitgeber: ReturnType<typeof setInterval> | undefined;

    const klang = new Klang();
    const unten = (e: KeyboardEvent) => {
      // Nur wenn die Bühne den Fokus hat — sonst tippt niemand mehr in ein Textfeld.
      if (!el.contains(document.activeElement)) return;
      klang.wecke();
      if (!e.repeat) einmal?.(e.code);
      gedrueckt.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    };
    const oben = (e: KeyboardEvent) => gedrueckt.delete(e.code);
    const weg = () => gedrueckt.clear();
    window.addEventListener("keydown", unten);
    window.addEventListener("keyup", oben);
    window.addEventListener("blur", weg);
    const weckeKlang = () => klang.wecke();
    el.addEventListener("pointerdown", weckeKlang);

    (async () => {
      await app.init({ resizeTo: el, background: 0x3c4a2c, antialias: true, autoDensity: true, resolution: window.devicePixelRatio || 1 });
      if (aus) { app.destroy(true); return; }
      bereit = true;
      el.appendChild(app.canvas);
      // Prüfhilfe: mit ?takt läuft die Schleife am Zeitgeber statt an
      // requestAnimationFrame — ein verdecktes Browserfenster liefert keine
      // Bilder — und die Lage der Figur steht in data-lage.
      const pruefhilfe = new URLSearchParams(window.location.search).has("takt");
      if (pruefhilfe) {
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
      const namen = strassenNamen(s);
      const { c: tafelEbene, tafeln } = haltTafeln(s.halte);
      const infoEbene = new Container();
      infoEbene.addChild(namen, tafelEbene);
      welt.addChild(boden, figuren, autoEbene, ampelEbene, kronen, infoEbene);
      const nacht = new Nacht(laternen(s));
      const schule = schulMitte(s);
      const minikarte = new Minikarte(s, schule);
      const vignette = new Sprite(vignettenTextur());
      app.stage.addChild(welt, nacht.dunkel, nacht.licht, vignette, minikarte.c);
      const schulSchild = beschriftung("🏫 Ev. Gemeinschaftsschule", 0xffe8a3, 2.2);
      schulSchild.position.set(schule[0], schule[1]);
      kronen.addChild(schulSchild);

      // Ampelköpfe: Autoampeln am rechten Fahrbahnrand, Fußgängerampeln an beiden Bordsteinen.
      const koepfe: { g: Graphics; zustand: (t: number) => string; male: (z: string) => void; letzt: string; fuss?: boolean }[] = [];
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
            fuss: true,
            zustand: (t) => `${fussGruen(a, sig.achse, t, tasterVon(a)) ? "g" : "r"}${t - tasterVon(a) < TASTER_WARTEN ? "k" : ""}`,
            male: (z) => zeichneFussampel(z[0] === "g", z[1] === "k", g),
          });
        }
      }

      // Verkehrszeichen am Straßenrand
      const schilder = baueSchilder(s);
      for (const sch of schilder) {
        const c = zeichneSchild(sch.art);
        c.position.set(sch.p[0], sch.p[1]);
        c.scale.set(AMPEL_GROESSER);
        ampelEbene.addChild(c);
      }
      let nahesSchild: SchildArt | null = null;
      const laeden = s.karte.punkte.filter((p) => p.shop === "supermarket" && p.name);
      const zuletztOrt = new Map<string, number>();
      const gruppe = new Gruppenblick();

      // Mülleimer und Müll
      const eimer = baueEimer(s);
      const eimerBild = new Graphics();
      for (const [x, y] of eimer) {
        eimerBild.circle(x + 0.15, y + 0.15, 0.45).fill({ color: 0x000000, alpha: 0.3 });
        eimerBild.circle(x, y, 0.45).fill(0x2e7d32).stroke({ width: 0.08, color: 0x1b5e20 });
        eimerBild.circle(x, y, 0.28).fill(0x1b5e20);
      }
      ampelEbene.addChild(eimerBild);
      const muell = new Muell(s, 42 + Math.floor(Date.now() / 86_400_000));
      const muellBilder = new Map<number, Text>();
      const muellEbene = new Container();
      boden.addChild(muellEbene);
      const zeigeMuell = () => {
        const da = new Set(muell.stuecke.map((m) => m.id));
        for (const [id, t] of muellBilder) if (!da.has(id)) { t.destroy(); muellBilder.delete(id); }
        for (const m of muell.stuecke) if (!muellBilder.has(m.id)) {
          const t = new Text({ text: m.art, style: { fontSize: 48 } });
          t.anchor.set(0.5);
          t.scale.set(0.85 / 48);
          t.position.set(m.p[0], m.p[1]);
          t.rotation = (m.id * 1.7) % (Math.PI * 2);
          muellEbene.addChild(t);
          muellBilder.set(m.id, t);
        }
      };
      zeigeMuell();
      let getragen = 0, muellSeitStrafe = 0, zuletztNachschub = 0;

      // LTB watschelt hinterher
      const pinguin = zeichnePinguin();
      pinguin.scale.set(FIGUR_GROESSER);
      const pinguinLage = { x: 0, y: 0 };
      const querungsOrte = s.karte.punkte.filter((p) => p.art === "zebra" || p.art === "ampelUebergang");
      const naeheGemeldet = new Map<string, number>();

      const [sx, sy] = schulStart(s);
      pinguinLage.x = sx - 1.5; pinguinLage.y = sy;
      let ich: Figur = { x: sx, y: sy, winkel: 0, tempo: 0 };
      const figur = zeichneFigur(farbe);
      // Wie im ersten GTA größer als maßstäblich — sonst ist das Kind ein Punkt.
      figur.scale.set(FIGUR_GROESSER);
      figuren.addChild(pinguin, figur);
      const weste = westeFuer();
      figur.addChildAt(weste, 1);
      weste.visible = false;
      let westeAn = false;

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

      const ereignis = (e: Ereignis) => rueckruf.current.onEreignis?.(e);
      const melde = (m: Meldung) => {
        rueckruf.current.onMeldung?.(m, uhr());
        netzRef.current.sendeMeldung(m.id, m.punkte);
        if (m.punkte > 0) klang.erfolg(); else if (m.punkte < 0 && m.id !== "angefahren" && m.id !== "beleidigung") klang.fehler();
        if (m.id === "gruenGequert" || m.id === "zebraGequert" || m.id === "sicherGequert")
          ereignis({ typ: "querung", nacht: hell < 0.35, weste: westeAn, rush: istRush(zeit) });
      };
      let letzterTick = -Infinity;
      const gehupt = new Set<number>();
      const tuerPhasen = new Map<string, string>();
      const bahnGehupt = new Set<string>();
      let dunkelGewarnt = false;

      if (optionen.current.steuerkanal) optionen.current.steuerkanal.current.taste = (code) => { klang.wecke(); einmal?.(code); };
      einmal = (code) => {
        const t = uhr();
        const geste = gesteZuTaste(code);
        if (geste) {
          if (geste.beleidigung && !netzRef.current.beleidigungen()) return;
          zeigeBlase(geste.emoji);
          if (geste.id === "hand") { mensch.hand = t; ereignis({ typ: "hand", t }); }
          netzRef.current.sendeGeste(geste.id);
          rueckruf.current.onGeste?.(geste);
        }
        if (geste?.id === "danke") ereignis({ typ: "danke", t });
        if (code === "Space" && t - umschauenSeit > UMSCHAUEN_DAUER) { umschauenSeit = t; blickGezaehlt = false; }
        if (code === "KeyV") { westeAn = !westeAn; weste.visible = westeAn; mensch.weste = westeAn; rueckruf.current.onWeste?.(westeAn); }
        if (code === "KeyM") rueckruf.current.onUeberblick?.();
        if (code === "KeyE") {
          if (naherTaster) {
            if (t - tasterVon(naherTaster) > TASTER_WARTEN + FUSS_GRUEN + 6) { netzRef.current.sendeTaster(naherTaster.id); ereignis({ typ: "taster", t }); }
          } else if (nahesSchild) rueckruf.current.onSchild?.(nahesSchild);
          else if (getragen > 0 && eimer.some((e) => Math.hypot(e[0] - ich.x, e[1] - ich.y) < EIMER_NAH)) {
            melde(getragen === 1 ? MELDUNGEN.muellWeg
              : { ...MELDUNGEN.muellWeg, punkte: MELDUNGEN.muellWeg.punkte * getragen, text: `${getragen} Stück Müll in den Eimer — danke! Die Stadt ist ein Stück sauberer.` });
            ereignis({ typ: "muell", stueck: getragen });
            if (mensch.karmaBis > t) {
              muellSeitStrafe += getragen;
              if (muellSeitStrafe >= 3) { mensch.karmaBis = 0; muellSeitStrafe = 0; melde(MELDUNGEN.karmaGeheilt); ereignis({ typ: "karmaGeheilt" }); klang.grosserErfolg(); }
            }
            getragen = 0;
            rueckruf.current.onTragen?.(0);
          } else {
            const m = muell.naechstes(ich.x, ich.y, GREIFEN);
            if (m && getragen < TRAGEN) {
              muell.nimm(m.id);
              zeigeMuell();
              getragen++;
              rueckruf.current.onTragen?.(getragen);
              if (s.untergrund(ich.x, ich.y).art === "fahrbahn") melde(MELDUNGEN.muellFahrbahn);
            }
          }
        }
      };

      // Busse: die echten Linien (aus OSM) über ihre Haltestellen im Viertel; Bahnen nach Fahrplan.
      const linien = linienImViertel();
      const buslinien = linien.filter((l) => l.art === "bus").flatMap((l) => {
        const namenDerLinie = new Set(l.richtungen.flatMap((r) => r.halte));
        const fahrt = verkehr.baueBuslinie(s.halte.filter((h) => h.art === "bushalt" && namenDerLinie.has(h.name)));
        if (!fahrt) return [];
        fahrt.anzeige = `${l.nr} ${l.richtungen[0]?.ziel ?? ""}`.trim();
        return [{ linie: l, fahrt }];
      });
      if (!buslinien.length) {
        const fahrt = verkehr.baueBuslinie(s.halte.filter((h) => h.art === "bushalt"));
        if (fahrt) verkehr.setzeBusse(fahrt, 2);
      }
      let zeit = spielzeit(uhr(), netzRef.current.zeitVersatz());
      let hell = helligkeit(zeit);
      let zuletztUhr = -Infinity, letzteUhr = "";
      let wegSeitMeldung = 0, schrittWeg = 0;
      let zuletztTafel = -Infinity;
      let naheHaltestelle: string | null = null;
      const tafelGelesen = new Map<string, number>();
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
        const vorher = { x: ich.x, y: ich.y };
        const eingabe = { ...eingabeAusTasten(gedrueckt), stick: optionen.current.steuerkanal?.current.stick };
        if (t >= unfallBis && !mitfahrt && !festgehalten) ich = schritt(ich, t - umschauenSeit < UMSCHAUEN_DAUER ? KEINE_EINGABE : eingabe, dt, s);
        // Weg und Schritte (Geräusch, Statistik)
        const gelaufen = Math.hypot(ich.x - vorher.x, ich.y - vorher.y);
        if (gelaufen > 0 && gelaufen < 2) {
          wegSeitMeldung += gelaufen;
          schrittWeg += gelaufen;
          if (schrittWeg > (ich.tempo > 2 ? 1.6 : 0.8)) { schrittWeg = 0; klang.schritt(ich.tempo > 2); }
          if (wegSeitMeldung > 10) { ereignis({ typ: "weg", meter: wegSeitMeldung }); wegSeitMeldung = 0; }
        }

        // Uhr: Tagesabschnitt, Verkehrsdichte, Takte, Helligkeit — einmal je Sekunde reicht.
        if (t - zuletztUhr >= 1) {
          zuletztUhr = t;
          zeit = spielzeit(t, n.zeitVersatz());
          hell = helligkeit(zeit);
          verkehr.ziel = Math.round(28 * verkehrsFaktor(zeit));
          verkehr.dunkel = hell < 0.35;
          if (n.taktgeber()) for (const b of buslinien) {
            const k = takt(b.linie, zeit);
            verkehr.busseAnpassen(b.fahrt, k === null ? 0 : k <= 10 ? 2 : 1);
          }
          const text = uhrText(zeit);
          if (text !== letzteUhr) {
            letzteUhr = text;
            rueckruf.current.onZeit?.({ text, abschnitt: ABSCHNITT_NAME[abschnitt(zeit)], rush: istRush(zeit), dunkel: hell < 0.35 });
          }
        }
        klang.setzeAn(optionen.current.tonAn);
        if (!blickGezaehlt && t - umschauenSeit >= UMSCHAUEN_DAUER) { blickGezaehlt = true; waechter.geschaut(t); ereignis({ typ: "blick" }); }
        if (unfallZiel && t >= unfallBis) { ich = { ...ich, x: unfallZiel[0], y: unfallZiel[1] }; unfallZiel = null; }

        // Strafe nach einer Beleidigung: stehen bleiben, bis die Polizei fertig ist.
        const strafe = n.strafe();
        const bestraft = !!strafe && t < strafe.bis;
        if (strafe && strafe.bis !== strafeGemeldet) {
          strafeGemeldet = strafe.bis;
          klang.pfeife();
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
        for (const f of fahrzeugListe) zeigeFahrzeug(`s${f.id}`, () => mitAnzeige(zeichneFahrzeug(f.art, f.farbe, f.laenge, f.breite), f.anzeige), f.x, f.y, f.winkel);

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
          const bt = bahnTakt(b, takt({ art: b.art === "tram" ? "tram" : "bus", nr: b.art === "tram" ? "1" : "Zug" }, zeit));
          const st = bahnStand(b, t, bt);
          if (!st.sichtbar || bt === null) return;
          const runde = umlauf(b, t, bt);
          const anzeige = b.art === "tram" ? tramAnzeige(linien, runde) : "RB Erfurt Hbf";
          if (st.haltAlter !== null && st.haltAlter < 0.1 && Math.hypot(b.halt.p[0] - ich.x, b.halt.p[1] - ich.y) < 80) (b.art === "tram" ? klang.tramKlingel() : klang.zugHorn());
          if (st.haltAlter === null && st.tempo > 5 && !bahnGehupt.has(`${bi}-${runde}`) && Math.hypot(b.halt.p[0] - ich.x, b.halt.p[1] - ich.y) < 120) {
            bahnGehupt.add(`${bi}-${runde}`);
            b.art === "tram" ? klang.tramKlingel() : klang.zugHorn();
          }
          wagenLagen(b, st).forEach((w, wi) => {
            zeigeFahrzeug(`b${bi}-${wi}-${wi === 0 ? anzeige : ""}`, () => mitAnzeige(zeichneFahrzeug(b.art, b.art === "tram" ? 0xe9e4d8 : 0xc8102e, w.laenge, b.breite), wi === 0 ? anzeige : undefined), w.p[0], w.p[1], w.winkel);
            const dx = ich.x - w.p[0], dy = ich.y - w.p[1];
            if (st.tempo > 0.5 && unterwegs) {
              const c = Math.cos(w.winkel), sn = Math.sin(w.winkel);
              if (Math.abs(dx * c + dy * sn) < w.laenge / 2 + 0.3 && Math.abs(-dx * sn + dy * c) < b.breite / 2 + 0.3) bahnUnfall = true;
              if (Math.hypot(dx, dy) < 80) bahnNah = true;
            }
            if (st.haltAlter !== null) {
              const seit = st.haltAlter;
              tueren(w.p[0], w.p[1], w.winkel, b.breite, b.tuerLagen, b.seite).forEach((tuer, ti) =>
                offene.push({ fahrzeug: `bahn-${bi}`, halt: String(runde), phase: tuerPhase(seit), tuer, alter: seit, nr: wi * 10 + ti, id: bi + 1000 }));
            }
          });
        });
        for (const [key, c] of fahrzeuge) if (!gesehen.has(key)) { c.destroy(); fahrzeuge.delete(key); }

        if ((unfaelle.length || bahnUnfall) && unterwegs) {
          unfallBis = t + UNFALL_PAUSE;
          klang.crash();
          melde(MELDUNGEN.angefahren);
          waechter.zuruecksetzen();
          unfallZiel = startpunkt(s, [ich.x, ich.y]);
        }

        // Türgeräusche in der Nähe: Öffnen, Warnton vor dem Schließen.
        for (const o of offene) {
          if (o.nr % 10 !== 0 || Math.hypot(o.tuer.p[0] - ich.x, o.tuer.p[1] - ich.y) > 25) continue;
          const key = `${o.fahrzeug}@${o.halt}`, vorPhase = tuerPhasen.get(key);
          if (vorPhase !== o.phase) {
            if (o.phase === "aussteigen") klang.tuerAuf();
            if (o.phase === "schliessen") klang.tuerZu();
            tuerPhasen.set(key, o.phase);
          }
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
              einstieg.ausgestiegen(`bus-${bus.id}`, String(bus.haltRi));
              mitfahrt = null;
              waechter.zuruecksetzen();
              melde(MELDUNGEN.ausgestiegen);
            }
          }
        } else if (mitfahrt?.art === "bahn") {
          const b = bahnen[mitfahrt.i];
          const st = bahnStand(b, t, bahnTakt(b, takt({ art: b.art === "tram" ? "tram" : "bus", nr: b.art === "tram" ? "1" : "Zug" }, zeit)));
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
            const art = mitfahrt.art === "bus" ? "bus" : bahnen[mitfahrt.i].art;
            const linieNr = mitfahrt.art === "bus" ? fahrzeugListe.find((f) => f.id === o.id)?.anzeige?.split(" ")[0] : undefined;
            ereignis({ typ: "eingestiegen", art, gut: meldungen.some((m) => m.id === "gutEingestiegen"), linie: linieNr });
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
        n.sendeIch(ich.x, ich.y, figur.rotation, !!mitfahrt, farbe, westeAn);

        // Hupen und Motorbrummen des nächsten Autos
        let naechstes = Infinity, naechstesTempo = 0;
        for (const f of fahrzeugListe) {
          const d = Math.hypot(f.x - ich.x, f.y - ich.y);
          if (d < naechstes) { naechstes = d; naechstesTempo = f.tempo; }
          if (f.hupe > t && !gehupt.has(f.id) && d < 40) { gehupt.add(f.id); klang.hupe(); }
          if (f.hupe <= t) gehupt.delete(f.id);
        }
        klang.motorbrummen(mitfahrt ? 0.6 : Math.max(0, 1 - naechstes / 35) * Math.min(1, naechstesTempo / 4 + 0.2), mitfahrt ? 8 : naechstesTempo);

        // Ampeln, dazu das Blindensignal der nächsten Fußgängerampel
        let tickAmpel: { d: number; gruen: boolean } | null = null;
        for (const k of koepfe) {
          if (Math.abs(k.g.x - ich.x) > 90 || Math.abs(k.g.y - ich.y) > 70) continue;
          const z = k.zustand(t);
          if (z !== k.letzt) { k.letzt = z; k.male(z); }
          if (k.fuss) {
            const d = Math.hypot(k.g.x - ich.x, k.g.y - ich.y);
            if (d < 12 && (!tickAmpel || d < tickAmpel.d)) tickAmpel = { d, gruen: z[0] === "g" };
          }
        }
        if (tickAmpel && !mitfahrt && t - letzterTick > (tickAmpel.gruen ? 0.25 : 1.1)) { letzterTick = t; klang.ampelTick(tickAmpel.gruen); }

        // Gruppe: wer ist mit mir zusammen auf die Fahrbahn gegangen?
        const meinUntergrund = s.untergrund(ich.x, ich.y).art;
        gruppe.melde("ich", unterwegs && meinUntergrund === "fahrbahn", t, [ich.x, ich.y]);
        for (const a of andere) gruppe.melde(a.key, !a.mitfahrt && s.untergrund(a.x, a.y).art === "fahrbahn", t, [a.x, a.y]);
        if (letzterUntergrund === "fahrbahn" && meinUntergrund !== "fahrbahn" && unterwegs) {
          const u = gruppe.urteil("ich", t);
          if (u) {
            melde(u.wand
              ? { id: "gruppeWand", punkte: 15, text: `Als Wand gequert: ${u.n} nebeneinander, alle zugleich — nach ${u.dauer.toFixed(1)} s war die ganze Gruppe drüben.` }
              : { id: "gruppeSchlange", punkte: 0, text: `Als Schlange gequert: ${u.dauer.toFixed(1)} s stand die Gruppe auf der Fahrbahn. Nebeneinander als Wand wären es nur ${u.einzeln.toFixed(1)} s.` });
            ereignis({ typ: "gruppe", wand: u.wand });
          }
        }

        // Orte der Aufträge (Supermärkte)
        for (const l of laeden) if (Math.hypot(l.p[0] - ich.x, l.p[1] - ich.y) < 15 && t - (zuletztOrt.get(l.name!) ?? -Infinity) > 60) {
          zuletztOrt.set(l.name!, t);
          ereignis({ typ: "ort", name: l.name! });
        }

        // Regeln
        if (unterwegs) {
          for (const m of waechter.pruefe(ich.x, ich.y, t, haltende)) {
            melde(m);
            if (m.id === "rot" || m.id === "nichtGeschaut") zeigeBlase("⚠️");
          }
          if (bahnNah && vorDerLinie(s, ich.x, ich.y) && t - letzteLinie > 10) { letzteLinie = t; melde(MELDUNGEN.weisseLinie); }
          if (hell < 0.35 && !westeAn && !dunkelGewarnt && meinUntergrund === "fahrbahn") { dunkelGewarnt = true; melde(MELDUNGEN.dunkelOhneWeste); }
        }

        // LTB folgt mit Abstand und watschelt dabei
        const zx = ich.x - Math.cos(figur.rotation) * 1.6, zy = ich.y - Math.sin(figur.rotation) * 1.6;
        const pd = Math.hypot(zx - pinguinLage.x, zy - pinguinLage.y);
        if (pd > 25 || mitfahrt) { pinguinLage.x = zx; pinguinLage.y = zy; }
        else if (pd > 0.3) { const f = Math.min(1, dt * 2.5); pinguinLage.x += (zx - pinguinLage.x) * f; pinguinLage.y += (zy - pinguinLage.y) * f; }
        pinguin.visible = !mitfahrt;
        pinguin.position.set(pinguinLage.x, pinguinLage.y);
        pinguin.rotation = Math.atan2(ich.y - pinguinLage.y, ich.x - pinguinLage.x) + (pd > 0.4 ? Math.sin(t * 12) * 0.25 : 0);

        // Nähe für LTB: Überwege und Müll, je Ort höchstens alle 90 s
        if (!mitfahrt) {
          for (const q of querungsOrte) {
            if (Math.hypot(q.p[0] - ich.x, q.p[1] - ich.y) > 10) continue;
            const key = `${q.p[0]},${q.p[1]}`;
            if (t - (naeheGemeldet.get(key) ?? -Infinity) > 90) { naeheGemeldet.set(key, t); rueckruf.current.onNaehe?.(q.art === "zebra" ? "zebra" : "ampel"); }
          }
          if (muell.naechstes(ich.x, ich.y, 6) && t - (naeheGemeldet.get("muell") ?? -Infinity) > 120) { naeheGemeldet.set("muell", t); rueckruf.current.onNaehe?.("muell"); }
        }
        if (t - zuletztNachschub > 20) { zuletztNachschub = t; muell.nachschub(ich.x, ich.y); zeigeMuell(); }

        // Hinweise: Taster in Reichweite, Mitfahrt
        naherTaster = null;
        for (const o of tasterOrte) if (Math.hypot(o.p[0] - ich.x, o.p[1] - ich.y) < 2.5) { naherTaster = o.a; break; }
        nahesSchild = null;
        for (const sch of schilder) if (Math.hypot(sch.p[0] - ich.x, sch.p[1] - ich.y) < 3) { nahesSchild = sch.art; break; }
        const hinweis = festgehalten ? "👮 Die Polizei redet mit dir …" : mitfahrt ? (mitfahrt.art === "bus" ? "Du fährst Bus — an der nächsten Haltestelle steigst du aus." : "Du fährst mit der Bahn …")
          : naherTaster ? (t - tasterVon(naherTaster) < TASTER_WARTEN ? "Signal kommt — warten …" : "E drücken: Ampel-Taster")
          : nahesSchild ? "E drücken: Schild ansehen"
          : getragen > 0 && eimer.some((e) => Math.hypot(e[0] - ich.x, e[1] - ich.y) < EIMER_NAH) ? `E drücken: Müll einwerfen (${getragen})`
          : muell.naechstes(ich.x, ich.y, GREIFEN) ? (getragen < TRAGEN ? "E drücken: Müll aufheben" : "Hände voll — erst zum Mülleimer 🗑️") : null;
        if (hinweis !== letzterHinweis) { letzterHinweis = hinweis; rueckruf.current.onHinweis?.(hinweis); }

        // Abfahrtstafel: an der Haltestelle (≤ 12 m) für die Hülle, im Überblick über allen Haltestellen.
        if (t - zuletztTafel > 1) {
          zuletztTafel = t;
          const tafelFuer = (h: Halt) => abfahrten(h.name, zeit, linien, 4, h.art === "tramhalt");
          let nahe: Halt | null = null;
          if (!mitfahrt) for (const h of s.halte) if (h.art !== "bahnhalt" && Math.hypot(h.p[0] - ich.x, h.p[1] - ich.y) < 12) { nahe = h; break; }
          const name = nahe ? nahe.name : null;
          if (nahe) {
            rueckruf.current.onHaltestelle?.({ name: nahe.name, abfahrten: tafelFuer(nahe) });
            if (t - (tafelGelesen.get(nahe.name) ?? -Infinity) > 60) { tafelGelesen.set(nahe.name, t); ereignis({ typ: "tafel", halt: nahe.name }); }
          } else if (naheHaltestelle !== null) rueckruf.current.onHaltestelle?.(null);
          naheHaltestelle = name;
          if (optionen.current.ueberblick) for (const tf of tafeln) {
            if (Math.abs(tf.halt.p[0] - ich.x) > 150 || Math.abs(tf.halt.p[1] - ich.y) > 120) continue;
            const ab = tf.halt.art === "bahnhalt" ? [] : tafelFuer(tf.halt);
            malTafel(tf, [tf.halt.name, ...(ab.length ? ab.slice(0, 3).map((a) => `${a.linie.padEnd(3)} ${a.ziel.slice(0, 18).padEnd(18)} ${a.inMinuten ? `${a.inMinuten}'` : "jetzt"}`) : ["—"])]);
          }
        }
        infoEbene.visible = optionen.current.ueberblick;

        // Kamera: an einer offenen Tür heranzoomen, damit man sieht, wo man steht.
        let tuerNah: Tuerstand | null = null, dMin = 9;
        if (!mitfahrt) for (const o of offene) {
          const d = Math.hypot(o.tuer.p[0] - ich.x, o.tuer.p[1] - ich.y);
          if (d < dMin) { dMin = d; tuerNah = o; }
        }
        zoom += ((tuerNah ? TUER_ZOOM : optionen.current.ueberblick ? UEBERBLICK_ZOOM : ZOOM) - zoom) * Math.min(1, dt * 3);
        const blickX = tuerNah ? ich.x * 0.6 + tuerNah.tuer.p[0] * 0.4 : ich.x;
        const blickY = tuerNah ? ich.y * 0.6 + tuerNah.tuer.p[1] * 0.4 : ich.y;
        welt.scale.set(zoom);
        welt.position.set(app.screen.width / 2 - blickX * zoom, app.screen.height / 2 - blickY * zoom);

        // Nacht: dieselbe Umrechnung für die Lichter
        nacht.licht.scale.set(zoom);
        nacht.licht.position.copyFrom(welt.position);
        nacht.stelle(hell, app.screen.width, app.screen.height,
          hell < 0.6 ? fahrzeugListe.filter((f) => Math.abs(f.x - ich.x) < 80 && Math.abs(f.y - ich.y) < 60).map((f) => ({ x: f.x, y: f.y, w: f.winkel, laenge: f.laenge })) : [],
          westeAn && !mitfahrt ? [ich.x, ich.y] : null);

        vignette.width = app.screen.width;
        vignette.height = app.screen.height;

        // Minikarte unten links, im Überblick größer
        const gross = optionen.current.ueberblick;
        const r = gross ? Math.min(150, app.screen.height * 0.22) : 70;
        minikarte.c.position.set(r + 14, app.screen.height - r - 14);
        minikarte.stelle(ich.x, ich.y, r, gross ? 0.2 : 0.4, [
          ...fahrzeugListe.filter((f) => f.art === "bus").map((f) => ({ p: [f.x, f.y] as [number, number], farbe: 0xffd400, r: 3 })),
          ...andere.map((a) => ({ p: [a.x, a.y] as [number, number], farbe: a.farbe, r: 3 })),
          { p: [ich.x, ich.y], farbe: 0xff3355, r: 5 },
        ]);

        if (pruefhilfe) el.dataset.lage = `${ich.x.toFixed(1)},${ich.y.toFixed(1)}`;
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
      el.removeEventListener("pointerdown", weckeKlang);
      klang.schliesse();
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
