"use client";
/**
 * Die Pixi-Bühne der Verkehrs-Simulation. Liest die Tasten, bewegt die Figur,
 * lässt Ampeln und Autos laufen, prüft die Regeln und führt die Kamera nach.
 * Wird per React.lazy geladen — Pixi ist groß.
 */
import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { BAHNSTEIG_AB, schulMitte, schulStart, stadt, startpunkt, winkelVon, type Halt, type Stadt, type Untergrund } from "@/lib/verkehr/stadt";
import { eingabeAusTasten, KEINE_EINGABE, schritt, type Figur } from "@/lib/verkehr/bewegung";
import {
  beschriftung, kopfWinkel, zeichneSchild, zeichneAutoampel, zeichneFahrzeug, zeichneGelenkbus, zeichneSpieler, type SpielerFigur, zeichneFussampel, zeichnePolizist, zeichneStadt,
} from "@/lib/verkehr/zeichnen";
import { GESTEN, gestenDeckkraft, gesteZuTaste, type Geste } from "@/lib/verkehr/gesten";
import { autoLicht, baueAnlagen, fussGruen, FUSS_GRUEN, TASTER_WARTEN, type Anlage, type Licht } from "@/lib/verkehr/ampeln";
import { BUS, BUSTYP_JE_LINIE, Strassenverkehr, type Fahrzeug, type Fussgaenger } from "@/lib/verkehr/autos";
import { entpacke, packe, winkelZu, type Netz } from "@/lib/verkehr/netz";
import { baueSchilder, type SchildArt } from "@/lib/verkehr/schilder";
import { Gruppenblick } from "@/lib/verkehr/gruppe";
import type { Ereignis } from "@/lib/verkehr/missionen";
import { aussteigerLage, aussteigerZahl, TUER_BREITE, tuerPhase, tueren } from "@/lib/verkehr/tueren";
import { bahnStand, bahnTakt, baueBahnen, umlauf, wagenLagen } from "@/lib/verkehr/schiene";
import { type UhrStellung, werktag, abfahrten, abfahrtMinuten, richtungenAmSteig, abschnitt, helligkeit, istRush, linienImViertel, spielSekunden, spielzeit, takt, uhrText, verkehrsFaktor, ABSCHNITT_NAME, type Abfahrt } from "@/lib/verkehr/fahrplan";
import { Klang } from "@/lib/verkehr/klang";
import { laternen, Nacht } from "@/lib/verkehr/nacht";
import { ZOOM_STUFEN } from "@/lib/verkehr/bewegung";
import type { LtbOrt } from "@/lib/verkehr/ltb";
import { stadtRaster } from "@/lib/verkehr/wegsuche";
import { lichtOk, MODELLE, pruefe, SCHLOESSER, tempoVon, type Fahrrad, type Schloss } from "@/lib/verkehr/fahrrad";
import { abstellen, RadWaechter } from "@/lib/verkehr/radregeln";
import { pruefeAussehen, STANDARD_AUSSEHEN, zufallsAussehen, type Aussehen } from "@/lib/verkehr/aussehen";
import { AUSSEN_Y, Busszene, LAYOUTS, type SzenenMeldung } from "@/lib/verkehr/busszene";
import { BusBild } from "@/lib/verkehr/busbild";
import type { P } from "@/lib/verkehr/geometrie";
import { haltTafeln, malTafel, Minikarte, strassenNamen } from "@/lib/verkehr/ueberblick";
import type { Steuerkanal } from "./Steuerkreuz";
import { baueEimer, EIMER_NAH, GREIFEN, Muell, TRAGEN } from "@/lib/verkehr/muell";
import { baueKreuzungen, VorfahrtWaechter } from "@/lib/verkehr/vorfahrt";
import { Passanten, type Passant } from "@/lib/verkehr/passanten";
import { Einstiegsregeln, Regelwaechter, UMSCHAUEN_DAUER, MELDUNGEN, type Meldung, type OffeneTuer, type Verdecker } from "@/lib/verkehr/regeln";

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
  /** Wie die Figur aussieht (ändert sich ohne Neubau der Stadt). */
  aussehen?: Aussehen;
  /** Das Handy ist offen: die Figur hält es in der Hand. */
  handyOffen?: boolean;
  /** Vom Handy: Route in der Stadt zeigen, hinbeamen. */
  handyKanal?: React.MutableRefObject<HandyKanal>;
  /** Wo die Figur ist (fürs Handy), etwa zweimal je Sekunde. */
  onLage?: (l: { x: number; y: number; w: number }) => void;
  /** H gedrückt: Handy auf/zu. */
  onHandy?: () => void;
  /** Am Ende der Handy-Route angekommen. */
  onAngekommen?: () => void;
  /** Die Polizei hält einen an (Gespräch beginnt). */
  onPolizei?: (anlass: "beleidigung" | "rot" | "gleis") => void;
  /** Das Gespräch läuft: stehen bleiben, der Beamte steht daneben. */
  polizeiOffen?: boolean;
  /** Das eigene Fahrrad (null = keins) und das Alter (Gehweg-Regel). */
  rad?: Fahrrad | null;
  alter?: number;
  /** Das Rad wurde geklaut. */
  onRadGeklaut?: () => void;
  /** Das Rad hat sich geändert (zusammengeklappt). */
  onRadAendern?: (r: Fahrrad) => void;
  /** Wo die Figur steht; »bus« = sie fährt mit. */
  onUntergrund?: (u: Untergrund["art"] | "bus") => void;
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
  /** Index in ZOOM_STUFEN. */
  zoomStufe?: number;
  /** Näher (+1) oder weiter weg (-1): Tasten + und -, Mausrad. */
  onZoom?: (richtung: 1 | -1) => void;
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
  /** LTB wurde gefragt (L oder Klick auf den Pinguin) — hier steht man gerade. */
  onFrage?: (ort: LtbOrt) => void;
};

export type HandyKanal = {
  route?: (punkte: P[] | null) => void;
  beame?: (p: P) => string | null;
  /** Nach der Wache: die Eltern bringen einen zur Schule. */
  zurSchule?: () => void;
};

export default function Spielfeld({ farbe = 0x2f6fd6, aussehen, handyOffen = false, handyKanal, polizeiOffen = false, rad = null, alter = 12, netz, steuerkanal, ueberblick = false, zoomStufe = 0, tonAn = true, ...rueck }: SpielfeldProps) {
  const huelle = useRef<HTMLDivElement>(null);
  const rueckruf = useRef(rueck);
  const netzRef = useRef(netz);
  const optionen = useRef({ ueberblick, zoomStufe, tonAn, steuerkanal, aussehen, handyOffen, farbe, handyKanal, polizeiOffen, rad, alter });
  useEffect(() => { rueckruf.current = rueck; netzRef.current = netz; optionen.current = { ueberblick, zoomStufe, tonAn, steuerkanal, aussehen, handyOffen, farbe, handyKanal, polizeiOffen, rad, alter }; });

  useEffect(() => {
    const el = huelle.current!;
    const app = new Application();
    let aus = false;
    let bereit = false;
    const gedrueckt = new Set<string>();
    let einmal: ((code: string) => void) | null = null;
    /** LTB fragen (L oder auf den Pinguin klicken) — steht erst, wenn die Stadt gebaut ist. */
    let frageLtb: (() => void) | null = null;
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
      // Bilder — und die Lage der Figur steht in data-lage, der nächste Müll in data-muell.
      const pruefhilfe = new URLSearchParams(window.location.search).has("takt");
      // Zum Prüfen (?takt&allein): den Verkehr selbst rechnen, auch wenn ein anderer Taktgeber ist.
      const allein = pruefhilfe && new URLSearchParams(window.location.search).has("allein");
      if (pruefhilfe) {
        app.ticker.stop();
        zeitgeber = setInterval(() => app.ticker.update(performance.now()), 16);
      }

      const s = stadt();
      const anlagen = baueAnlagen(s);
      // Tastendrücke kommen mit der Server-Uhr — in Spielzeit umrechnen
      const tasterVon = (a: Anlage) => { const v = netzRef.current.taster().get(a.id); return v === undefined ? -Infinity : spielSekunden(v, stellungJetzt()); };
      const verkehr = new Strassenverkehr(s, anlagen);
      verkehr.schule = schulMitte(s);
      const waechter = new Regelwaechter(s, anlagen, tasterVon);
      const uhr = () => netzRef.current.uhr();
      // Zum Prüfen (?takt): eigene Uhrstellung ohne Lehrkraft — el.dispatchEvent(new CustomEvent("vk-uhr", { detail: { versatz, faktor } }))
      let pruefUhr: UhrStellung | null = null;
      const stellungJetzt = () => pruefUhr ?? netzRef.current.uhrStellung();
      if (pruefhilfe) el.addEventListener("vk-uhr", (e) => {
        const d = (e as CustomEvent<{ versatz: number; faktor?: number }>).detail;
        pruefUhr = { versatz: d.versatz, faktor: d.faktor ?? 1, anker: uhr() };
      });
      /**
       * Spielzeit in Sekunden: läuft im Zeitraffer schneller. Die ganze Stadt rechnet damit
       * (Laufen, Autos, Busse, Ampeln, Bahnen) — nur Kamera und Server-Zeitstempel bleiben echt.
       */
      const spielUhr = () => spielSekunden(uhr(), stellungJetzt());

      const welt = new Container();
      welt.scale.set(ZOOM_STUFEN[0]);
      const { boden, oben: kronen, haltZeichen } = zeichneStadt(s);
      const ampelEbene = new Container();
      const autoEbene = new Container();
      const figuren = new Container();
      const namen = strassenNamen(s);
      const { c: tafelEbene, tafeln } = haltTafeln(s.halte);
      const infoEbene = new Container();
      infoEbene.addChild(namen, tafelEbene);
      // Route vom Handy: blaue Linie auf dem Boden, mit Ziel-Nadel
      const routeGrafik = new Graphics();
      let routeEnde: P | null = null;
      // Die Bus-Szene liegt über den Fahrzeugen (Bus ohne Dach, Leute drin).
      const szenenEbene = new Container();
      welt.addChild(boden, routeGrafik, figuren, autoEbene, haltZeichen, ampelEbene, szenenEbene, kronen, infoEbene);
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
      // Kreuzungen: wer hat Vorfahrt? Daraus auch die Schilder 205 und 306
      const kreuzungen = baueKreuzungen(s, anlagen);
      const schilder = baueSchilder(s, kreuzungen);
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
      // Tux (Larry Ewing, The GIMP) — steht aufrecht im Bild; bis er geladen ist, der gezeichnete
      let tux: Sprite | null = null;
      Assets.load({ src: "/verkehr/tux.svg", data: { resolution: 3 } }).then((tex: Texture) => {
        if (aus) return;
        tux = new Sprite(tex);
        tux.anchor.set(0.5, 0.85);
        tux.height = 0.62; tux.width = 0.62 * (216 / 256);
        pinguin.removeChildren();
        pinguin.addChild(tux);
      }).catch(() => { /* dann bleibt der gezeichnete Pinguin */ });
      const pinguinLage = { x: 0, y: 0 };
      const querungsOrte = s.karte.punkte.filter((p) => p.art === "zebra" || p.art === "ampelUebergang");
      const naeheGemeldet = new Map<string, number>();

      const [sx, sy] = schulStart(s);
      pinguinLage.x = sx - 1.5; pinguinLage.y = sy;

      // Maus wie in Diablo: klicken = dorthin gehen, gedrückt halten = dem Zeiger folgen.
      let mausZiel: { x: number; y: number } | null = null;
      let mausHaelt = false;
      // Der Weg dorthin (Wegsuche wie in Diablo 2): um Häuser herum, über Gehwege und Überwege.
      let mausWeg: P[] = [];
      let wegFuer: { x: number; y: number } | null = null, zuletztSuche = -Infinity;
      const plane = () => {
        if (!mausZiel) return;
        wegFuer = { ...mausZiel };
        zuletztSuche = performance.now() / 1000;
        mausWeg = stadtRaster(s, [ich.x, ich.y], [mausZiel.x, mausZiel.y]).suche([ich.x, ich.y], [mausZiel.x, mausZiel.y]) ?? [[mausZiel.x, mausZiel.y]];
      };
      const zielMarke = new Graphics().circle(0, 0, 0.6).stroke({ width: 0.12, color: 0xffd400 }).circle(0, 0, 0.15).fill(0xffd400);
      zielMarke.visible = false;
      figuren.addChild(zielMarke);
      // Die Welt kann gedreht sein (Bus-Szene) — Pixi rechnet den Klick zurück.
      const weltPunkt = (e: PointerEvent) => {
        const r = app.canvas.getBoundingClientRect();
        const p = welt.toLocal({ x: e.clientX - r.left, y: e.clientY - r.top });
        return { x: p.x, y: p.y };
      };
      const mausRunter = (e: PointerEvent) => {
        // In der Bus-Szene: klicken oder tippen = dorthin gehen (auch drinnen, auch am Handy).
        if (szene?.sz.mitIch && szeneBus) {
          const w = weltPunkt(e);
          const [lx, ly] = zuBus(szeneBus, w.x, w.y);
          const imRand = lx > szene!.sz.l.rand.x0 && lx < szene!.sz.l.rand.x1 && ly > szene!.sz.l.rand.y0 && ly < szene!.sz.l.rand.y1;
          if (imRand || szene.sz.ich.drin) {
            klang.wecke();
            szene.sz.gehZu(Math.max(szene!.sz.l.rand.x0 + 0.2, Math.min(szene!.sz.l.rand.x1 - 0.2, lx)), Math.max(szene!.sz.l.rand.y0 + 0.2, Math.min(szene!.sz.l.rand.y1 - 0.2, ly)));
            szeneHaelt = e.button === 0 && e.pointerType !== "touch";
            return;
          }
          // Draußen weit weg geklickt: die Szene lässt los, es geht normal weiter.
          lasseLos();
        }
        // An der offenen Tür: aufs Fahrzeug tippen oder klicken = einsteigen (wie E).
        if (einstiegBereit) {
          const w = weltPunkt(e);
          // Man steht an der Tür — das Fahrzeug ist direkt daneben.
          if (Math.hypot(w.x - ich.x, w.y - ich.y) < 8) { willEinsteigen = true; return; }
        }
        // Auf den Pinguin klicken oder tippen = LTB fragen.
        const w = weltPunkt(e);
        if (pinguin.visible && Math.hypot(w.x - pinguinLage.x, w.y - pinguinLage.y) < 1.5) { klang.wecke(); frageLtb?.(); return; }
        if (e.button !== 0 || e.pointerType === "touch") return;
        klang.wecke();
        mausHaelt = true;
        mausZiel = weltPunkt(e);
        plane();
        app.canvas.setPointerCapture(e.pointerId);
      };
      let szeneHaelt = false, szeneFolgt = -Infinity;
      const mausBewegt = (e: PointerEvent) => {
        if (szeneHaelt && szene?.sz.mitIch && szeneBus && performance.now() - szeneFolgt > 200) {
          szeneFolgt = performance.now();
          const w = weltPunkt(e);
          const [lx, ly] = zuBus(szeneBus, w.x, w.y);
          szene.sz.gehZu(Math.max(szene!.sz.l.rand.x0 + 0.2, Math.min(szene!.sz.l.rand.x1 - 0.2, lx)), Math.max(szene!.sz.l.rand.y0 + 0.2, Math.min(szene!.sz.l.rand.y1 - 0.2, ly)));
        }
        if (mausHaelt) mausZiel = weltPunkt(e);
      };
      const mausHoch = () => { mausHaelt = false; szeneHaelt = false; };
      app.canvas.addEventListener("pointerdown", mausRunter);
      app.canvas.addEventListener("pointermove", mausBewegt);
      app.canvas.addEventListener("pointerup", mausHoch);
      app.canvas.addEventListener("pointercancel", mausHoch);
      // Mausrad: näher heran oder weiter weg.
      app.canvas.addEventListener("wheel", (e) => { e.preventDefault(); rueckruf.current.onZoom?.(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      let ich: Figur = { x: sx, y: sy, winkel: 0, tempo: 0 };
      // Zum Prüfen (?takt): die Figur an einen Ort setzen — el.dispatchEvent(new CustomEvent("vk-setze", { detail: [x, y] }))
      if (pruefhilfe) el.addEventListener("vk-setze", (e) => { const [x, y] = (e as CustomEvent<[number, number]>).detail; ich = { ...ich, x, y }; });
      const startAussehen = optionen.current.aussehen ?? { ...zufallsAussehen(), shirtFarbe: optionen.current.farbe };
      const figur = zeichneSpieler(startAussehen);
      let letztesAussehen: Aussehen | undefined = optionen.current.aussehen;
      // Wie im ersten GTA größer als maßstäblich — sonst ist das Kind ein Punkt.
      figur.scale.set(FIGUR_GROESSER);
      figuren.addChild(pinguin, figur);

      // Fahrrad: von oben — unter der Figur (fahren) oder rechts daneben (schieben)
      const radBild = new Graphics();
      figur.addChildAt(radBild, 1);
      let radModus: "keins" | "schiebt" | "faehrt" = "keins";
      let letztesRad: Fahrrad | null = null;
      let abgestellt: { p: P; w: number; schloss: Schloss; amStaender: boolean } | null = null;
      const abgestelltBild = new Container();
      abgestelltBild.visible = false;
      figuren.addChild(abgestelltBild);
      let zuletztKlauProbe = -Infinity, helmGemeldet = false;
      let radHinweis: string | null = null, radHinweisBis = -Infinity;
      const radWaechter = new RadWaechter(s, anlagen, tasterVon);
      const vorfahrtWaechter = new VorfahrtWaechter(kreuzungen);
      // Klingel (R): Passanten gehen zur Seite
      let klingel: { x: number; y: number; t: number } | null = null;
      // Passanten: Statisten auf den Gehwegen, nur auf diesem Gerät
      const passanten = new Passanten(s);
      const passantenBilder = new Map<number, { fig: Container; ruf: Container | null }>();
      const zeichnePassanten = (liste: Passant[]) => {
        const da = new Set<number>();
        for (const p of liste) {
          da.add(p.id);
          let b = passantenBilder.get(p.id);
          if (!b) {
            const fig = zeichneSpieler(zufallsAussehen());
            fig.scale.set(FIGUR_GROESSER);
            figuren.addChild(fig);
            b = { fig, ruf: null };
            passantenBilder.set(p.id, b);
          }
          const [x, y] = passanten.lage(p);
          b.fig.position.set(x, y);
          b.fig.rotation = p.winkel;
          if (p.ruf && !b.ruf) { b.ruf = beschriftung(`💢 ${p.ruf.text}`, 0xffffff, 0.8); figuren.addChild(b.ruf); }
          if (!p.ruf && b.ruf) { b.ruf.destroy(); b.ruf = null; }
          b.ruf?.position.set(x, y - 1.6);
        }
        for (const [id, b] of passantenBilder) if (!da.has(id)) { b.fig.destroy({ children: true }); b.ruf?.destroy(); passantenBilder.delete(id); }
      };
      const maleRad = (g: Graphics, farbe: number, geklappt: boolean) => {
        g.clear();
        if (geklappt) {
          g.circle(0, -0.08, 0.26).stroke({ width: 0.06, color: 0x222222 }).circle(0.06, 0.08, 0.26).stroke({ width: 0.06, color: 0x222222 })
            .moveTo(-0.15, 0).lineTo(0.2, 0).stroke({ width: 0.08, color: farbe });
          return;
        }
        g.ellipse(-0.55, 0, 0.34, 0.06).fill(0x1f2937).ellipse(0.55, 0, 0.34, 0.06).fill(0x1f2937)
          .moveTo(-0.55, 0).lineTo(0.5, 0).stroke({ width: 0.09, color: farbe })
          .moveTo(0.46, -0.3).lineTo(0.46, 0.3).stroke({ width: 0.06, color: 0x111827 })
          .ellipse(-0.18, 0, 0.12, 0.07).fill(0x111827);
      };
      const zeigeRad = () => {
        const r = optionen.current.rad;
        radBild.visible = radModus !== "keins" && !!r;
        if (!r) return;
        maleRad(radBild, r.farbe, !!r.geklappt);
        radBild.position.set(0, radModus === "schiebt" ? 0.45 : 0);
      };
      const radSagt = (text: string) => { radHinweis = text; radHinweisBis = uhr() + 4; };
      const radAufAb = () => {
        const r = optionen.current.rad;
        if (!r || radModus === "keins" || mitfahrt || szene?.sz.mitIch) return;
        if (radModus === "faehrt") { radModus = "schiebt"; zeigeRad(); return; }
        if (r.geklappt) { radSagt("Erst aufklappen (K), dann aufsteigen."); return; }
        if (!pruefe(r).fahrbar) { radSagt("Platter Reifen! Erst flicken und aufpumpen (🚲 Werkstatt)."); return; }
        radModus = "faehrt";
        zeigeRad();
        if (!helmGemeldet && optionen.current.aussehen?.muetze === "helm") { helmGemeldet = true; melde(MELDUNGEN.radHelm); }
      };
      const maleAbgestellt = () => {
        abgestelltBild.removeChildren();
        if (!abgestellt || !optionen.current.rad) { abgestelltBild.visible = false; return; }
        const g = new Graphics();
        maleRad(g, optionen.current.rad.farbe, false);
        g.scale.set(FIGUR_GROESSER);
        abgestelltBild.addChild(g);
        if (abgestellt.schloss !== "keins") {
          const t = beschriftung("🔒", 0xffffff, 0.9);
          t.position.set(0, -0.8);
          abgestelltBild.addChild(t);
        }
        abgestelltBild.position.set(abgestellt.p[0], abgestellt.p[1]);
        g.rotation = abgestellt.w;
        abgestelltBild.visible = true;
      };
      const radAbstellen = () => {
        const r = optionen.current.rad;
        if (!r || radModus === "keins" || mitfahrt || szene?.sz.mitIch) return;
        const p: P = [ich.x - Math.sin(figur.rotation) * 0.6, ich.y + Math.cos(figur.rotation) * 0.6];
        const pr = abstellen(s, p);
        abgestellt = { p, w: figur.rotation, schloss: r.schloss, amStaender: pr.amStaender };
        radModus = "keins";
        zeigeRad(); maleAbgestellt();
        melde(pr.amStaender ? MELDUNGEN.radOrdentlich : pr.ok ? MELDUNGEN.radAbgestellt : { ...MELDUNGEN.radBlockiert, text: `${MELDUNGEN.radBlockiert.text} ${pr.grund ?? ""}` });
      };
      const radNehmen = () => { abgestellt = null; maleAbgestellt(); radModus = "schiebt"; zeigeRad(); };
      const radKlappen = () => {
        const r = optionen.current.rad;
        if (!r || !MODELLE[r.modell].klappbar || radModus !== "schiebt") { if (r && !MODELLE[r.modell].klappbar) radSagt("Nur das Klapprad lässt sich zusammenklappen."); return; }
        rueckruf.current.onRadAendern?.({ ...r, geklappt: !r.geklappt });
      };
      const weste = westeFuer();
      // Über dem Oberteil, unter Handy und Kopf
      figur.addChildAt(weste, 3);
      weste.visible = false;
      let westeAn = false;
      // Der Ranzen auf dem Rücken — B nimmt ihn ab (im Bus richtig)
      const ranzen = figur.ranzen;
      let rucksackAn = true;

      // Bus-Szene: ein Bus ganz nah, ohne Dach, mit Leuten — sobald man an einem haltenden Bus steht oder mitfährt.
      let szene: { bus: number; sz: Busszene; bild: BusBild; tempo: number; bremse: number; gehalten: boolean } | null = null;
      let szeneBus: Fahrzeug | undefined;
      let szeneHinweis: string | null = null;
      let szeneFehltSeit: number | null = null;
      let zuletztLage = -Infinity;
      let dreh = 0;
      /**
       * Auf welcher Seite der Bahnsteig liegt (+1 rechts, −1 links: Mittelbahnsteig).
       * Die Szene hat die Türen immer bei +y — liegt der Steig links, wird gespiegelt.
       */
      let szeneSeite: 1 | -1 = 1;
      const zuBus = (f: Fahrzeug, wx: number, wy: number): [number, number] => {
        const c = Math.cos(f.winkel), sn = Math.sin(f.winkel), dx = wx - f.x, dy = wy - f.y;
        return [dx * c + dy * sn, (-dx * sn + dy * c) * szeneSeite];
      };
      const zurWelt = (f: Fahrzeug, lx: number, ly0: number): [number, number] => {
        const c = Math.cos(f.winkel), sn = Math.sin(f.winkel), ly = ly0 * szeneSeite;
        return [f.x + lx * c - ly * sn, f.y + lx * sn + ly * c];
      };
      /** Seite des nächsten Halts (Bus- oder Bahnsteig) zum Fahrzeug. */
      const steigSeite = (f: Fahrzeug): 1 | -1 => {
        let best: Halt | null = null, bd = f.laenge / 2 + 15;
        for (const h of s.halte) {
          if (h.art === "bahnhalt") continue;
          const d = Math.hypot(h.p[0] - f.x, h.p[1] - f.y);
          if (d < bd) { bd = d; best = h; }
        }
        if (!best) return szeneSeite;
        return -(best.p[0] - f.x) * Math.sin(f.winkel) + (best.p[1] - f.y) * Math.cos(f.winkel) >= 0 ? 1 : -1;
      };
      /** Die Figur verlässt die Szene und läuft wieder frei. */
      const lasseLos = () => {
        if (!szene?.sz.mitIch) return;
        szene.sz.mitIch = false;
        // Aus dem Bus gestiegen und weggegangen: ausgestiegen
        if (szene.sz.rausGekommen) { szene.sz.rausGekommen = false; haltGewuenscht = false; melde(MELDUNGEN.ausgestiegen); }
        figuren.addChild(figur);
        waechter.zuruecksetzen();
      };
      const beendeSzene = () => {
        if (!szene) return;
        lasseLos();
        szene.bild.destroy();
        szene = null;
        szeneBus = undefined;
      };
      // Zum Prüfen (?takt): die Figur in die laufende Szene setzen — detail: [x, y] in Bus-Koordinaten
      if (pruefhilfe) el.addEventListener("vk-szene", (e) => {
        if (!szene) return;
        const [x, y] = (e as CustomEvent<[number, number]>).detail;
        szene.sz.mitIch = true;
        Object.assign(szene.sz.ich, { x, y, weg: [], rucksack: rucksackAn });
        szenenEbene.addChild(figur);
      });
      // Handy: Route malen und hinbeamen
      if (optionen.current.handyKanal) {
        optionen.current.handyKanal.current.route = (punkte) => {
          routeGrafik.clear();
          routeEnde = punkte && punkte.length > 1 ? punkte[punkte.length - 1] : null;
          if (!punkte || punkte.length < 2) return;
          routeGrafik.moveTo(punkte[0][0], punkte[0][1]);
          for (const p of punkte.slice(1)) routeGrafik.lineTo(p[0], p[1]);
          routeGrafik.stroke({ width: 1.3, color: 0x1a73e8, alpha: 0.75, cap: "round", join: "round" });
          routeGrafik.moveTo(punkte[0][0], punkte[0][1]);
          for (const p of punkte.slice(1)) routeGrafik.lineTo(p[0], p[1]);
          routeGrafik.stroke({ width: 0.35, color: 0xffffff, alpha: 0.9, cap: "round", join: "round" });
          const [zx, zy] = routeEnde!;
          routeGrafik.circle(zx, zy, 1.4).fill(0xea4335).stroke({ width: 0.3, color: 0xffffff }).circle(zx, zy, 0.5).fill(0xffffff);
        };
        optionen.current.handyKanal.current.zurSchule = () => {
          if (szene?.sz.mitIch) lasseLos();
          mitfahrt = null;
          ich = { ...ich, x: sx, y: sy };
          mausZiel = null; mausWeg = [];
          waechter.zuruecksetzen();
        };
        optionen.current.handyKanal.current.beame = (p) => {
          if (mitfahrt) return "Im Bus geht das nicht — erst aussteigen.";
          if ((netzRef.current.strafe()?.bis ?? 0) > uhr()) return "Die Polizei lässt dich nicht weg.";
          if (szene?.sz.mitIch) lasseLos();
          const [x, y] = startpunkt(s, p);
          ich = { ...ich, x, y };
          mausZiel = null; mausWeg = []; unfallZiel = null;
          waechter.zuruecksetzen();
          klang.grosserErfolg();
          return null;
        };
      }
      /** Wie voll der Bus ist, nach der Uhrzeit. */
      const fuellung = () => ({ rushMorgen: 0.85, rushAbend: 0.8, tag: 0.45, frueh: 0.35, abend: 0.3, nacht: 0.12 } as const)[abschnitt(zeit)];

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
      const fremde = new Map<string, { figur: SpielerFigur; aussehen: string; blase: ReturnType<typeof baueBlase>; schild: Text; polizei: Container; x: number; y: number }>();
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
        rueckruf.current.onMeldung?.(m, spielUhr());
        netzRef.current.sendeMeldung(m.id, m.punkte);
        if (m.punkte > 0) klang.erfolg(); else if (m.punkte < 0 && m.id !== "angefahren" && m.id !== "beleidigung") klang.fehler();
        // Manchmal hat eine Streife gesehen, wie man bei Rot oder über die Gleise ging
        if ((m.id === "rot" || m.id === "gleis") && !optionen.current.polizeiOffen && Math.random() < 0.35) rueckruf.current.onPolizei?.(m.id);
        if (m.id === "radRot" && !optionen.current.polizeiOffen && Math.random() < 0.35) rueckruf.current.onPolizei?.("rot");
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
        const t = spielUhr();
        // Fahrrad: F auf/ab, P abstellen, K klappen, E am abgestellten Rad nehmen
        if (code === "KeyF") radAufAb();
        if (code === "KeyP") radAbstellen();
        if (code === "KeyK") radKlappen();
        if (code === "KeyR" && radModus !== "keins" && optionen.current.rad && !mitfahrt) {
          if (optionen.current.rad.teile.klingel === "ok") { klingel = { x: ich.x, y: ich.y, t }; klang.fahrradKlingel(); zeigeBlase("🔔"); }
          else radSagt("Deine Klingel fehlt oder ist kaputt — ab in die Werkstatt (🚲).");
        }
        if (code === "KeyE" && abgestellt && !mitfahrt && Math.hypot(abgestellt.p[0] - ich.x, abgestellt.p[1] - ich.y) < 2.5) { radNehmen(); return; }
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
        if (code === "KeyL") frageLtb?.();
        if (code === "KeyH") rueckruf.current.onHandy?.();
        // X im Bus: Haltewunsch — ausgestiegen wird erst, wenn die Türen offen sind.
        if (code === "KeyX" && mitfahrt?.art === "bus" && !haltGewuenscht) { haltGewuenscht = true; klang.ampelTick(true); }
        if (code === "Equal" || code === "NumpadAdd" || code === "BracketRight") rueckruf.current.onZoom?.(1);
        if (code === "Minus" || code === "NumpadSubtract" || code === "Slash") rueckruf.current.onZoom?.(-1);
        if (code === "KeyB") {
          if (szene?.sz.mitIch) { const m = szene.sz.rucksack(); if (m) melde(MELDUNGEN[m]); rucksackAn = szene.sz.ich.rucksack; }
          else rucksackAn = !rucksackAn;
          ranzen.visible = rucksackAn;
        }
        if (code === "KeyE" && szene?.sz.mitIch) {
          const m = szene.sz.aktion(t);
          if (m) melde(MELDUNGEN[m]);
          if (m === "platzAngeboten") klang.grosserErfolg();
        } else if (code === "KeyE") {
          if (einstiegBereit && !mitfahrt) willEinsteigen = true;
          else if (naherTaster) {
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
      // Wer mitfährt, dessen Bus verschwindet nicht am Kartenrand
      verkehr.behalten = (f) => f.id === szene?.bus && !!szene?.sz.ich.drin;
      // Busse und Straßenbahnen: die echten Linien aus OSM, Bahnen auf den Gleisen
      const buslinien = linien.flatMap((l) => {
        const tram = l.art === "tram";
        const namenDerLinie = new Set(l.richtungen.flatMap((r) => r.halte));
        // Gemeinsame Halte (Hauptbahnhof: Bus und Bahn am selben Steig) zählen für beide
        const linienHalte = s.halte.filter((h) => h.art !== "bahnhalt" && namenDerLinie.has(h.name));
        // Auf dem echten Fahrweg; Busse ohne Spur in den Daten wie bisher über die Haltestellen.
        const fahrt = verkehr.baueLinienweg(l.richtungen, linienHalte, tram) ?? (tram ? null : verkehr.baueBuslinie(linienHalte));
        if (!fahrt) return [];
        fahrt.anzeige = `${l.nr} ${l.richtungen[0]?.ziel ?? ""}`.trim();
        fahrt.bustyp = tram ? "tram" : BUSTYP_JE_LINIE[l.nr];
        fahrt.schiene = tram;
        return [{ linie: l, fahrt }];
      });
      if (!buslinien.length) {
        const fahrt = verkehr.baueBuslinie(s.halte.filter((h) => h.art === "bushalt"));
        if (fahrt) verkehr.setzeBusse(fahrt, 2);
      }
      let zeit = spielzeit(uhr(), stellungJetzt());
      let hell = helligkeit(zeit);
      let zuletztUhr = -Infinity, letzteUhr = "";
      let wegSeitMeldung = 0, schrittWeg = 0;
      let zuletztTafel = -Infinity;
      let naheHaltestelle: string | null = null;
      const tafelGelesen = new Map<string, number>();
      // Die Straßenbahnen fahren jetzt als Linien auf den Gleisen; hier bleibt nur der Zug
      const bahnen = baueBahnen(s).filter((b) => b.art === "zug");
      const einstieg = new Einstiegsregeln();
      let mitfahrt: { art: "bus"; id: number; abRi: number } | { art: "bahn"; i: number } | null = null;
      /** Im Bus X gedrückt: an der nächsten Haltestelle aussteigen. */
      let haltGewuenscht = false;
      /** An einer offenen Tür: E (oder Tippen auf den Bus) steigt ein. */
      let einstiegBereit = false, willEinsteigen = false;

      // Was LTB gefragt wird, hängt vom Ort ab: das Wichtigste in der Nähe zuerst.
      let gehwegFragen = 0;
      frageLtb = () => {
        const nah = (p: readonly number[], r: number) => Math.hypot(p[0] - ich.x, p[1] - ich.y) < r;
        const ort = ((): LtbOrt => {
          if (mitfahrt) return mitfahrt.art === "bus" ? { wo: "bus", haltGewuenscht } : { wo: "bahn" };
          if (einstiegBereit) return { wo: "tuer" };
          const halt = s.halte.find((h) => h.art !== "bahnhalt" && nah(h.p, 12));
          if (halt) {
            const [b] = abfahrten(halt.name, zeit, linien, 1, halt.art === "tramhalt");
            return { wo: "haltestelle", name: halt.name, naechste: b && { linie: b.linie, ziel: b.ziel, inMinuten: b.inMinuten } };
          }
          const schild = schilder.find((x) => nah(x.p, 5));
          if (schild) return { wo: "schild", art: schild.art };
          const u = s.untergrund(ich.x, ich.y).art;
          if (u === "fahrbahn" || u === "gleis" || u === "radweg") return { wo: "untergrund", art: u };
          const q = querungsOrte.find((x) => nah(x.p, 12));
          if (q) return { wo: q.art === "zebra" ? "zebra" : "ampel" };
          if (eimer.some((e) => nah(e, 4))) return { wo: "eimer", getragen };
          if (muell.naechstes(ich.x, ich.y, 5)) return { wo: "muell" };
          if (nah(schulMitte(s), 90)) return { wo: "schule" };
          if (u === "spielstrasse" || u === "bahnsteig") return { wo: "untergrund", art: u };
          if (hell < 0.35 && !westeAn) return { wo: "sonst", dunkel: true, weste: westeAn };
          // Auf dem Gehweg im Wechsel: Gehweg-Tipp und allgemeiner Tipp.
          if (u === "gehweg" && gehwegFragen++ % 2 === 0) return { wo: "untergrund", art: u };
          return { wo: "sonst", dunkel: hell < 0.35, weste: westeAn };
        })();
        rueckruf.current.onFrage?.(ort);
      };

      const fahrzeuge = new Map<string, Container>();
      /** Gelenkbusse: Richtung des hinteren Wagens je Bus. */
      const knicke = new Map<number, number>();
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
      let zoom = ZOOM_STUFEN[0];
      let letzterUntergrund = "";

      app.ticker.add((tick) => {
        const n = netzRef.current;
        // Echte Zeit für Kamera und Server-Zeitstempel, Spielzeit für alles in der Stadt
        const dtEcht = Math.min(tick.deltaMS / 1000, 0.1);
        const tEcht = uhr();
        const stellung = stellungJetzt();
        const inSpielzeit = (x: number) => spielSekunden(x, stellung);
        const dt = dtEcht * stellung.faktor;
        const t = inSpielzeit(tEcht);
        // Beim Umschauen, beim Mitfahren, bei der Polizei und nach einem Unfall bleibt die Figur stehen.
        const festgehalten = (n.strafe()?.bis ?? 0) > tEcht || optionen.current.polizeiOffen;
        const vorher = { x: ich.x, y: ich.y };
        const tasten = eingabeAusTasten(gedrueckt);
        // Tasten haben Vorrang: wer tippt, bricht den Mausweg ab.
        if (tasten.hoch || tasten.runter || tasten.links || tasten.rechts) mausZiel = null;
        let stick = optionen.current.steuerkanal?.current.stick;
        // Gedrückt halten: dem Zeiger folgen, den Weg alle Viertelsekunde neu suchen.
        if (mausZiel && mausHaelt && wegFuer && performance.now() / 1000 - zuletztSuche > 0.25
          && Math.hypot(mausZiel.x - wegFuer.x, mausZiel.y - wegFuer.y) > 1) plane();
        while (mausWeg.length > 1 && Math.hypot(mausWeg[0][0] - ich.x, mausWeg[0][1] - ich.y) < 0.4) mausWeg.shift();
        if (mausZiel && (!stick || Math.hypot(stick.x, stick.y) < 0.15)) {
          const [wx, wy] = mausWeg[0] ?? [mausZiel.x, mausZiel.y];
          const dx = wx - ich.x, dy = wy - ich.y, d = Math.hypot(dx, dy);
          if (d < 0.3 && !mausHaelt && mausWeg.length <= 1) { mausZiel = null; mausWeg = []; }
          // Gehen (Stärke 0,9); Umschalt rennt wie bei den Tasten.
          else if (d >= 0.3) stick = { x: (dx / d) * 0.9, y: (dy / d) * 0.9 };
        }
        let eingabe = { ...tasten, stick };
        // Bei gedrehter Welt (Bus-Szene) meinen die Tasten den Bildschirm: mitdrehen.
        const stickAn = !!stick && Math.hypot(stick.x, stick.y) > 0.15;
        const bx = stickAn ? stick!.x : (tasten.rechts ? 1 : 0) - (tasten.links ? 1 : 0);
        const by = stickAn ? stick!.y : (tasten.runter ? 1 : 0) - (tasten.hoch ? 1 : 0);
        if (Math.abs(dreh) > 0.02 && (bx || by)) {
          const c = Math.cos(-dreh), sn = Math.sin(-dreh), l = Math.hypot(bx, by);
          const staerke = stickAn ? Math.min(1, l) : 0.9;
          eingabe = { ...KEINE_EINGABE, rennen: tasten.rennen, stick: { x: ((bx * c - by * sn) / l) * staerke, y: ((bx * sn + by * c) / l) * staerke } };
        }
        if (t >= unfallBis && !mitfahrt && !festgehalten && !szene?.sz.mitIch) {
          // Im Zeitraffer in Teilschritten, damit niemand durch Wände läuft
          const r = optionen.current.rad;
          const tempoJetzt = radModus === "faehrt" && r ? { gehen: tempoVon(r), rennen: tempoVon(r) * 1.35 } : radModus === "schiebt" ? { gehen: 1.3, rennen: 2.4 } : undefined;
          for (let rest = dt; rest > 1e-6; rest -= 0.05) ich = schritt(ich, t - umschauenSeit < UMSCHAUEN_DAUER ? KEINE_EINGABE : eingabe, Math.min(0.05, rest), s, tempoJetzt);
        }
        // Hängt die Figur fest (Hauswand), gibt der Mausweg auf.
        if (mausZiel && !mausHaelt && Math.hypot(ich.x - vorher.x, ich.y - vorher.y) < 0.002 && t - umschauenSeit >= UMSCHAUEN_DAUER) mausZiel = null;
        zielMarke.visible = !!mausZiel && !mitfahrt;
        if (mausZiel) zielMarke.position.set(mausZiel.x, mausZiel.y);
        // Weg und Schritte (Geräusch, Statistik)
        const gelaufen = Math.hypot(ich.x - vorher.x, ich.y - vorher.y);
        if (gelaufen > 0 && gelaufen < 2) {
          wegSeitMeldung += gelaufen;
          schrittWeg += gelaufen;
          if (schrittWeg > (ich.tempo > 2 ? 1.6 : 0.8)) { schrittWeg = 0; klang.schritt(ich.tempo > 2); }
          if (wegSeitMeldung > 10) { ereignis({ typ: "weg", meter: wegSeitMeldung }); wegSeitMeldung = 0; }
        }

        // Fürs Handy: wo bin ich? Und bin ich am Ziel der Route?
        if (tEcht - zuletztLage > 0.5) {
          zuletztLage = tEcht;
          rueckruf.current.onLage?.({ x: ich.x, y: ich.y, w: figur.rotation });
          if (routeEnde && Math.hypot(routeEnde[0] - ich.x, routeEnde[1] - ich.y) < 8) {
            routeGrafik.clear(); routeEnde = null;
            rueckruf.current.onAngekommen?.();
          }
        }
        // Uhr: Tagesabschnitt, Verkehrsdichte, Takte, Helligkeit — einmal je Sekunde reicht.
        // Neues oder geändertes Rad aus der Tafel
        const radJetzt = optionen.current.rad ?? null;
        if (radJetzt !== letztesRad) {
          if (!radJetzt) { radModus = "keins"; abgestellt = null; }
          else if (!letztesRad || letztesRad.modell !== radJetzt.modell) { if (!abgestellt) radModus = "schiebt"; }
          if (radJetzt?.geklappt && radModus === "faehrt") radModus = "schiebt";
          letztesRad = radJetzt;
          zeigeRad(); maleAbgestellt();
        }
        // Abgestellt und weit weg: wird es geklaut? Schloss und Ständer machen es seltener
        if (abgestellt && Math.hypot(abgestellt.p[0] - ich.x, abgestellt.p[1] - ich.y) > 40 && t - zuletztKlauProbe > 20) {
          zuletztKlauProbe = t;
          const risiko = SCHLOESSER[abgestellt.schloss].klauRisiko * (abgestellt.amStaender ? 0.5 : 1) * 0.12;
          if (Math.random() < risiko) {
            abgestellt = null; maleAbgestellt();
            melde(MELDUNGEN.radGeklaut);
            rueckruf.current.onRadGeklaut?.();
          }
        }
        if (t - zuletztUhr >= 1) {
          zuletztUhr = t;
          zeit = spielzeit(tEcht, stellung);
          hell = helligkeit(zeit);
          verkehr.ziel = Math.round(28 * verkehrsFaktor(zeit));
          verkehr.dunkel = hell < 0.35;
          verkehr.stunde = zeit.minute / 60;
          verkehr.elternzeit = werktag(zeit) && zeit.minute >= 7 * 60 + 30 && zeit.minute < 8 * 60 + 15;
          if (n.taktgeber() || allein) for (const b of buslinien) {
            // Nach Fahrplan: jede Fahrt kommt vom Kartenrand und ist pünktlich am Halt
            if (b.fahrt.abschnitte?.length) {
              const tag = Math.floor((t - zeit.minute * 60) / 86400);
              verkehr.fahrplan(b.fahrt, t, tag, (halt, ziel) => abfahrtMinuten(b.linie, halt, ziel, zeit, 3).map((x) => t + (x - zeit.minute) * 60));
              continue;
            }
            const k = takt(b.linie, zeit);
            // Kein Bus verschwindet vor den Augen (oder unter den Füßen) eines Spielers
            verkehr.busseAnpassen(b.fahrt, k === null ? 0 : k <= 10 ? 2 : 1, (f) => f.id === szene?.bus
              || [{ x: ich.x, y: ich.y }, ...n.andere()].some((m) => Math.hypot(m.x - f.x, m.y - f.y) < 200));
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
        const bestraft = !!strafe && tEcht < strafe.bis;
        if (strafe && strafe.bis !== strafeGemeldet) {
          strafeGemeldet = strafe.bis;
          klang.pfeife();
          mensch.karmaBis = inSpielzeit(strafe.karmaBis);
          melde(MELDUNGEN.beleidigung);
          rueckruf.current.onPolizei?.("beleidigung");
        }
        // Während des Gesprächs steht der Beamte neben einem
        stellePolizei(polizei, optionen.current.polizeiOffen ? 5 : bestraft ? strafe!.bis - tEcht : -1, ich.x, ich.y);

        // Verkehr auf der Straße: der Taktgeber rechnet, die anderen zeigen, was er schickt.
        const unterwegs = t >= unfallBis && !mitfahrt && !bestraft;
        const andere = n.andere();
        const menschen: Fussgaenger[] = unterwegs ? [mensch] : [];
        for (const a of andere) if (!a.mitfahrt) menschen.push({ id: a.key, x: a.x, y: a.y, hand: inSpielzeit(a.hand), karmaBis: inSpielzeit(a.karmaBis) });
        let fahrzeugListe: Fahrzeug[];
        let unfaelle: { fussgaenger: string }[] = [];
        if (n.taktgeber() || allein) {
          // Im Zeitraffer in Teilschritten von höchstens 0,1 s
          for (let rest = dt; rest > 1e-6; rest -= 0.1)
            unfaelle.push(...verkehr.schritt(Math.min(0.1, rest), t - Math.max(0, rest - 0.1), menschen, tasterVon).filter((u) => u.fussgaenger === "ich"));
          fahrzeugListe = verkehr.fahrzeuge;
          if (tEcht - zuletztVerkehr > 0.2) { zuletztVerkehr = tEcht; n.sendeVerkehr(verkehr.fahrzeuge.map(packe)); }
        } else {
          // Geglättet: die Pakete kommen nur fünfmal je Sekunde.
          const neu = new Map<number, Fahrzeug>();
          for (const g of n.fahrzeuge() ?? []) {
            const ziel = entpacke(g, BUS);
            const alt = gezeigt.get(ziel.id);
            if (alt && Math.hypot(alt.x - ziel.x, alt.y - ziel.y) < 15) {
              const f = Math.min(1, dtEcht * 8);
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
        for (const f of fahrzeugListe) {
          zeigeFahrzeug(`s${f.id}`, () => mitAnzeige(f.typ === "gelenk"
            ? zeichneGelenkbus(f.farbe, f.laenge, f.breite, (LAYOUTS.gelenk.gelenk!.x0 + LAYOUTS.gelenk.gelenk!.x1) / 2)
            : zeichneFahrzeug(f.art, f.farbe, f.laenge, f.breite), f.anzeige), f.x, f.y, f.winkel);
          const c = fahrzeuge.get(`s${f.id}`) as (Container & { heck?: Container }) | undefined;
          // Der Bus der Szene wird von der Szene gemalt (ohne Dach)
          if (c) c.visible = szene?.bus !== f.id;
          if (f.typ === "gelenk" && c?.heck) {
            // Das Heck folgt dem Vorderwagen wie ein Anhänger: je schneller, desto eher gerade
            const alt = knicke.get(f.id) ?? f.winkel;
            let hw = alt + Math.atan2(Math.sin(f.winkel - alt), Math.cos(f.winkel - alt)) * Math.min(1, (f.tempo * dt) / 7);
            const rel = Math.max(-0.6, Math.min(0.6, Math.atan2(Math.sin(hw - f.winkel), Math.cos(hw - f.winkel))));
            hw = f.winkel + rel;
            knicke.set(f.id, hw);
            c.heck.rotation = rel;
          }
        }

        // Die anderen Spieler zeichnen
        const daSind = new Set<string>();
        for (const a of andere) {
          daSind.add(a.key);
          let d = fremde.get(a.key);
          if (!d) {
            const fig = zeichneSpieler(pruefeAussehen(a.aussehen, { ...STANDARD_AUSSEHEN, shirtFarbe: a.farbe }));
            fig.scale.set(FIGUR_GROESSER);
            const schild = beschriftung(a.name, 0xffffff, 0.9);
            const bl = baueBlase();
            const pol = zeichnePolizist();
            pol.scale.set(FIGUR_GROESSER);
            figuren.addChild(fig, schild, bl, pol);
            d = { figur: fig, aussehen: JSON.stringify(a.aussehen ?? a.farbe), blase: bl, schild, polizei: pol, x: a.x, y: a.y };
            fremde.set(a.key, d);
          }
          // Hat sich jemand umgezogen?
          const aKey = JSON.stringify(a.aussehen ?? a.farbe);
          if (aKey !== d.aussehen) { d.aussehen = aKey; d.figur.stelle(pruefeAussehen(a.aussehen, { ...STANDARD_AUSSEHEN, shirtFarbe: a.farbe })); }
          const f = Math.min(1, dtEcht * 10);
          if (Math.hypot(d.x - a.x, d.y - a.y) > 10) { d.x = a.x; d.y = a.y; }
          d.x += (a.x - d.x) * f; d.y += (a.y - d.y) * f;
          d.figur.position.set(d.x, d.y);
          d.figur.rotation = a.w;
          d.figur.visible = d.schild.visible = !a.mitfahrt;
          d.schild.position.set(d.x, d.y + 1.4);
          const g = n.gesten().get(a.key);
          const geste = g && GESTEN.find((x) => x.id === g.id);
          d.blase.alpha = g ? gestenDeckkraft(tEcht - g.t) : 0;
          d.blase.visible = d.blase.alpha > 0 && !a.mitfahrt;
          if (geste) d.blase.emoji.text = geste.emoji;
          d.blase.position.set(d.x, d.y - 2);
          stellePolizei(d.polizei, a.strafeBis > tEcht ? a.strafeBis - tEcht : -1, d.x, d.y);
        }
        for (const [key, d] of fremde) if (!daSind.has(key)) {
          for (const c of [d.figur, d.blase, d.schild, d.polizei]) c.destroy();
          fremde.delete(key);
        }

        // Offene Türen sammeln: Busse an Haltestellen, Bahnen am Bahnsteig.
        const offene: Tuerstand[] = [];
        const haltende: Verdecker[] = [];
        for (const f of fahrzeugListe) {
          if (f.art === "auto" || f.haltSeit == null) continue;
          haltende.push({ x: f.x, y: f.y, winkel: f.winkel, laenge: f.laenge });
          const seit = t - f.haltSeit;
          tueren(f.x, f.y, f.winkel, BUS.breite, LAYOUTS[f.typ ?? "solo"].tuerX).forEach((tuer, i) =>
            offene.push({ fahrzeug: `bus-${f.id}`, halt: String(f.haltRi), phase: tuerPhase(seit, f.haltDauer), tuer, alter: seit, nr: i, id: f.id }));
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
          if (szene && o.id === szene.bus) continue;
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

        // Bus-Szene: anfangen, wenn man an einem haltenden (oder gleich haltenden) Bus steht
        // Fehlt der Bus kurz in den Daten (Paket verloren), gilt die letzte Lage noch ein paar Sekunden
        const gefunden = szene ? fahrzeugListe.find((f) => f.id === szene!.bus) : undefined;
        if (gefunden) { szeneBus = gefunden; szeneFehltSeit = null; }
        else if (szene) szeneFehltSeit ??= tEcht;
        const busWeg = !!szene && szeneFehltSeit !== null && tEcht - szeneFehltSeit > 3;
        if (szene && (busWeg || (!szene.sz.mitIch && szeneBus && Math.hypot(szeneBus.x - ich.x, szeneBus.y - ich.y) > 24))) {
          if (mitfahrt?.art === "bus") {
            // Der Bus ist ganz weg: auf den nächsten Gehweg
            mitfahrt = null;
            const [gx, gy] = startpunkt(s, [ich.x, ich.y]);
            ich = { ...ich, x: gx, y: gy };
          }
          beendeSzene();
        }
        if (!szene && t >= unfallBis && !mitfahrt) {
          const kandidat = fahrzeugListe.filter((f) => {
            if (f.art === "auto") return false;
            const d = Math.hypot(f.x - ich.x, f.y - ich.y);
            if (f.haltSeit != null) return d < f.laenge / 2 + 8;
            // Kommt gerade an die Haltestelle, an der ich stehe
            return d < f.laenge / 2 + 14 && f.tempo < 8 && s.halte.some((h) => (h.art === "bushalt" || h.art === "tramhalt") && Math.hypot(h.p[0] - f.x, h.p[1] - f.y) < 30 && Math.hypot(h.p[0] - ich.x, h.p[1] - ich.y) < 12);
          }).sort((a, b) => Math.hypot(a.x - ich.x, a.y - ich.y) - Math.hypot(b.x - ich.x, b.y - ich.y))[0];
          if (kandidat) {
            const sz = new Busszene(kandidat.id * 7919 + Math.floor(t), fuellung(), t, kandidat.typ ?? "solo");
            const bild = new BusBild(sz);
            szenenEbene.addChild(bild.c);
            szene = { bus: kandidat.id, sz, bild, tempo: kandidat.tempo, bremse: 0, gehalten: false };
            szeneBus = kandidat;
          }
        }
        szeneHinweis = null;
        if (szene && szeneBus) {
          const f = szeneBus, sz = szene.sz;
          const phase = f.haltSeit != null ? tuerPhase(t - f.haltSeit, f.haltDauer) : "faehrt";
          if (f.haltSeit != null) szene.gehalten = true;
          // Die Steigseite gilt, solange niemand drin ist oder der Bus hält (unterwegs nicht umklappen)
          if (!sz.ich.drin || f.haltSeit != null || !sz.mitIch) szeneSeite = steigSeite(f);
          // Die Figur fangen: neben dem Bus auf dem Gehweg (Türseite) — schon, während er heranfährt
          const [lx, ly] = zuBus(f, ich.x, ich.y);
          const faehrtWeg = phase === "faehrt" && szene.gehalten;
          if (!sz.mitIch && t >= unfallBis && !faehrtWeg && lx > szene!.sz.l.rand.x0 + 0.5 && lx < szene!.sz.l.rand.x1 - 0.5 && ly > AUSSEN_Y + 0.15 && ly < szene!.sz.l.rand.y1 - 0.5) {
            sz.mitIch = true;
            // Mit Rad (nicht geklappt) braucht man Platz wie ein Kinderwagen — und die blaue Fläche
            const mitRad = radModus !== "keins" && !!optionen.current.rad && !optionen.current.rad.geklappt;
            if (radModus === "faehrt") { radModus = "schiebt"; zeigeRad(); }
            Object.assign(sz.ich, { x: lx, y: ly, weg: [], rucksack: rucksackAn, mitRad, r: mitRad ? 0.42 : rucksackAn ? 0.27 : 0.23 });
            mausZiel = null; mausWeg = [];
            szenenEbene.addChild(figur);
          }
          if (sz.mitIch) {
            // Tasten und Stick meinen den Bildschirm: in Bus-Richtung drehen
            if (bx || by) {
              const w = -(f.winkel + dreh), c = Math.cos(w), sn = Math.sin(w);
              sz.laufe(bx * c - by * sn, (bx * sn + by * c) * szeneSeite, tasten.rennen ? 2.4 : 1.5);
            } else sz.laufe(0, 0, 1.5);
          }
          // Bremsen und Anfahren, dazu ab und zu eine scharfe Bremsung
          const beschl = dt > 0 ? (szene.tempo - f.tempo) / dt : 0;
          szene.tempo = f.tempo;
          szene.bremse = szene.bremse * 0.85 + beschl * 0.15;
          let ruck = szene.bremse;
          if (phase === "faehrt" && sz.ich.drin && Math.random() < dt / 50) { ruck = 3.5; klang.hupe(); }
          const halt = f.haltSeit != null ? `${f.id}@${f.haltRi}@${Math.round(f.haltSeit)}` : null;
          // Teilschritte von höchstens 0,05 s (Gedränge), die letzte Antwort zählt, Meldungen aus allen
          const meldungen: SzenenMeldung[] = [];
          let r!: ReturnType<Busszene["schritt"]>;
          let eingestiegen: number | undefined, ausgestiegen = false;
          for (let rest = dt; rest > 1e-6; rest -= 0.05) {
            r = sz.schritt({ t: t - Math.max(0, rest - 0.05), dt: Math.min(0.05, rest), phase, halt, beschleunigung: ruck, fuellung: fuellung() });
            meldungen.push(...r.meldungen);
            if (r.eingestiegen !== undefined) eingestiegen = r.eingestiegen;
            if (r.ausgestiegen) ausgestiegen = true;
          }
          r = { ...r, meldungen, eingestiegen, ausgestiegen };
          for (const m of r.meldungen) melde(MELDUNGEN[m]);
          szeneHinweis = r.hinweis;
          if (sz.mitIch) {
            const [wx, wy] = zurWelt(f, sz.ich.x, sz.ich.y);
            ich = { ...ich, x: wx, y: wy, tempo: sz.ich.weg.length ? 1.5 : 0, winkel: (sz.ich.winkel ?? 0) + f.winkel };
            mitfahrt = sz.ich.drin ? { art: "bus", id: f.id, abRi: f.haltRi ?? 0 } : null;
            if (r.eingestiegen !== undefined) {
              haltGewuenscht = false;
              ereignis({ typ: "eingestiegen", art: f.art === "tram" ? "tram" : "bus", gut: r.meldungen.includes("gutEingestiegen") || r.meldungen.includes("rausRein"), linie: f.anzeige?.split(" ")[0], gelenk: f.typ === "gelenk" });
            }
            if (r.ausgestiegen) { haltGewuenscht = false; melde(MELDUNGEN.ausgestiegen); }
            // Draußen und der Bus fährt, oder weit genug weg: frei laufen
            if (!sz.ich.drin && (faehrtWeg || sz.ich.y > szene!.sz.l.rand.y1 - 0.45 || Math.abs(sz.ich.x) > szene!.sz.l.rand.x1 - 0.45)) lasseLos();
          }
          szene.bild.c.position.set(f.x, f.y);
          szene.bild.c.rotation = f.winkel;
          szene.bild.c.scale.y = szeneSeite;
          szene.bild.spiegel(szeneSeite);
          szene.bild.male(sz, phase, t, r.rampe, !sz.ich.drin);
        }

        // Ein- und Aussteigen (Bahnen; Busse macht die Szene)
        if (mitfahrt?.art === "bus") {
          if (!szene) mitfahrt = null;
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
          const { meldungen, einsteigen, bereit } = einstieg.pruefe(ich.x, ich.y, offene.filter((o) => !szene || o.id !== szene.bus), willEinsteigen);
          willEinsteigen = false;
          einstiegBereit = !!bereit;
          for (const m of meldungen) melde(m);
          if (einsteigen) {
            const o = einsteigen as Tuerstand;
            haltGewuenscht = false;
            mitfahrt = o.fahrzeug.startsWith("bus") ? { art: "bus", id: o.id, abRi: Number(o.halt) } : { art: "bahn", i: o.id - 1000 };
            const art = mitfahrt.art === "bus" ? "bus" : bahnen[mitfahrt.i].art;
            const linieNr = mitfahrt.art === "bus" ? fahrzeugListe.find((f) => f.id === o.id)?.anzeige?.split(" ")[0] : undefined;
            ereignis({ typ: "eingestiegen", art, gut: meldungen.some((m) => m.id === "gutEingestiegen"), linie: linieNr });
          }
        }
        figur.visible = !mitfahrt || !!szene?.sz.mitIch;
        // In der Szene maßstäblich (sonst passt man nicht auf einen Sitz), draußen größer wie im ersten GTA
        const massstab = figur.scale.x + ((szene?.sz.mitIch ? 1 : FIGUR_GROESSER) - figur.scale.x) * Math.min(1, dtEcht * 4);
        figur.scale.set(massstab);
        ranzen.visible = rucksackAn && !(szene?.sz.mitIch && szene.sz.ich.sitz !== null);
        mensch.x = ich.x; mensch.y = ich.y;
        figur.position.set(ich.x, ich.y);
        if (ich.tempo) figur.rotation = ich.winkel;
        figur.kopf.rotation = kopfWinkel(t - umschauenSeit, UMSCHAUEN_DAUER);
        figur.alpha = t < unfallBis ? 0.4 + 0.4 * Math.sin(t * 20) : 1;

        meineBlase.alpha = gestenDeckkraft(tEcht - gesteSeit);
        meineBlase.visible = meineBlase.alpha > 0 && !mitfahrt;
        meineBlase.position.set(ich.x, ich.y - 2);
        // Neues Aussehen: umziehen und den anderen zeigen
        const neuesAussehen = optionen.current.aussehen;
        if (neuesAussehen && neuesAussehen !== letztesAussehen) { letztesAussehen = neuesAussehen; figur.stelle(neuesAussehen); n.sendeAussehen(neuesAussehen); }
        figur.handy.visible = optionen.current.handyOffen && !mitfahrt;
        n.sendeIch(ich.x, ich.y, figur.rotation, !!mitfahrt, optionen.current.aussehen?.shirtFarbe ?? optionen.current.farbe, westeAn);

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

        // Regeln (in der Bus-Szene gelten die Regeln der Szene)
        const radFaehrt = radModus === "faehrt" && !!optionen.current.rad;
        // Passanten laufen um die Figur herum (tagsüber mehr, nachts wenige)
        passanten.schritt(dt, t, [ich.x, ich.y], mitfahrt || szene?.sz.mitIch ? 0 : Math.round(4 + 14 * hell), fahrzeugListe, klingel,
          radFaehrt ? { x: ich.x, y: ich.y, tempo: ich.tempo } : null, [ich.x, ich.y]);
        zeichnePassanten(passanten.liste);
        if (unterwegs && !szene?.sz.mitIch && radFaehrt) {
          // Auf dem Rad: Radregeln (Fußgängerregeln ruhen)
          const leute = [...andere.filter((a) => !a.mitfahrt).map((a) => ({ x: a.x, y: a.y })), ...passanten.liste.map((p) => { const [x, y] = passanten.lage(p); return { x, y }; })];
          const r = radWaechter.pruefe({ x: ich.x, y: ich.y, winkel: figur.rotation, tempo: ich.tempo, t, alter: optionen.current.alter,
            dunkel: hell < 0.35, lichtOk: lichtOk(optionen.current.rad!), passanten: leute, seitKlingeln: klingel ? t - klingel.t : Infinity });
          for (const id of r.meldungen) melde(MELDUNGEN[id]);
          if (r.hinweis) radSagt(r.hinweis);
          // Kreuzungen: Vorfahrt, Stopp, rechts vor links
          const v = vorfahrtWaechter.pruefe({ x: ich.x, y: ich.y, winkel: figur.rotation, tempo: ich.tempo, t, schaut: t - umschauenSeit < UMSCHAUEN_DAUER }, fahrzeugListe);
          for (const id of v.meldungen) { melde(MELDUNGEN[id]); if (id === "radVorfahrt") zeigeBlase("⚠️"); }
          if (v.hinweis && v.regel !== "vorfahrt" && v.regel !== "ampel") radSagt(v.hinweis);
          waechter.zuruecksetzen();
        } else if (unterwegs && !szene?.sz.mitIch) {
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
        pinguin.visible = !mitfahrt && !szene?.sz.mitIch;
        pinguin.position.set(pinguinLage.x, pinguinLage.y);
        if (tux) {
          // Aufrecht auf dem Bildschirm (auch wenn die Welt gedreht ist), watschelnd, zur Figur schauend
          pinguin.rotation = -dreh + (pd > 0.4 ? Math.sin(tEcht * 12) * 0.12 : 0);
          const nachLinks = (ich.x - pinguinLage.x) * Math.cos(dreh) - (ich.y - pinguinLage.y) * Math.sin(dreh) < 0;
          tux.scale.x = Math.abs(tux.scale.x) * (nachLinks ? -1 : 1);
        } else pinguin.rotation = Math.atan2(ich.y - pinguinLage.y, ich.x - pinguinLage.x) + (pd > 0.4 ? Math.sin(t * 12) * 0.25 : 0);

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
        const hinweis = festgehalten ? "👮 Die Polizei redet mit dir …"
          : szeneHinweis ? szeneHinweis
          : radHinweis && uhr() < radHinweisBis ? radHinweis
          : abgestellt && !mitfahrt && Math.hypot(abgestellt.p[0] - ich.x, abgestellt.p[1] - ich.y) < 2.5 ? "E drücken: Fahrrad nehmen"
          : szene?.sz.mitIch && !mitfahrt ? "Seitlich neben einer Tür warten (grün), erst aussteigen lassen, dann an die Tür und E drücken."
          : mitfahrt ? (mitfahrt.art === "bus"
            ? (haltGewuenscht ? "🔔 Halt gewünscht — wenn die Türen aufgehen: zur Tür und hinaus." : `${szeneBus?.art === "tram" ? "In der Bahn" : "Im Bus"}: X = Halt wünschen · E = setzen/aufstehen · B = Rucksack · zum Aussteigen zur Tür gehen`)
            : "Du fährst mit der Bahn …")
          : einstiegBereit ? "E drücken oder auf den Bus tippen: einsteigen"
          : naherTaster ? (t - tasterVon(naherTaster) < TASTER_WARTEN ? "Signal kommt — warten …" : "E drücken: Ampel-Taster")
          : nahesSchild ? "E drücken: Schild ansehen"
          : getragen > 0 && eimer.some((e) => Math.hypot(e[0] - ich.x, e[1] - ich.y) < EIMER_NAH) ? `E drücken: Müll einwerfen (${getragen})`
          : muell.naechstes(ich.x, ich.y, GREIFEN) ? (getragen < TRAGEN ? "E drücken: Müll aufheben" : "Hände voll — erst zum Mülleimer 🗑️")
          : radModus === "faehrt" ? "Auf dem Rad: F = absteigen · P = abstellen · R = klingeln · Leertaste = schauen · rechts fahren, Radweg nutzen"
          : radModus === "schiebt" ? `Du schiebst dein Rad: F = aufsteigen · P = abstellen${optionen.current.rad && MODELLE[optionen.current.rad.modell].klappbar ? " · K = klappen" : ""}` : null;
        if (hinweis !== letzterHinweis) { letzterHinweis = hinweis; rueckruf.current.onHinweis?.(hinweis); }

        // Abfahrtstafel: an der Haltestelle (≤ 12 m) für die Hülle, im Überblick über allen Haltestellen.
        if (t - zuletztTafel > 1) {
          zuletztTafel = t;
          // Nur die Richtungen, die an diesem Steig halten
          const tafelFuer = (h: Halt) => abfahrten(h.name, zeit, linien, 4, h.art === "tramhalt", richtungenAmSteig(h, linien));
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
          if (szene && o.id === szene.bus) continue;
          const d = Math.hypot(o.tuer.p[0] - ich.x, o.tuer.p[1] - ich.y);
          if (d < dMin) { dMin = d; tuerNah = o; }
        }
        const nah = ZOOM_STUFEN[optionen.current.zoomStufe] ?? ZOOM_STUFEN[0];
        // Bus-Szene: der ganze Bus füllt das Bild, waagerecht, Türen unten
        const szenenBlick = !!szene && !!szeneBus && (szene.sz.mitIch || Math.hypot(szeneBus.x - ich.x, szeneBus.y - ich.y) < 16);
        // Lange Fahrzeuge (Straßenbahn): nicht alles ins Bild zwingen, sondern der Figur folgen
        const szenenLaenge = Math.min(szeneBus?.laenge ?? 12, 20);
        const szenenZoom = Math.min(app.screen.width / (szenenLaenge + 3.5), app.screen.height / 8.5);
        zoom += ((szenenBlick ? szenenZoom : tuerNah ? Math.max(TUER_ZOOM, nah) : optionen.current.ueberblick ? UEBERBLICK_ZOOM : nah) - zoom) * Math.min(1, dtEcht * 3);
        // Türen immer unten: liegt der Steig links, steht das Fahrzeug im Bild auf dem Kopf (Front links)
        const zielDreh = szenenBlick ? -szeneBus!.winkel + (szeneSeite < 0 ? Math.PI : 0) : 0;
        const dd = Math.atan2(Math.sin(zielDreh - dreh), Math.cos(zielDreh - dreh));
        dreh += dd * Math.min(1, dtEcht * 3);
        if (Math.abs(dreh) < 0.001 && !szenenBlick) dreh = 0;
        const halbeLaenge = (szeneBus?.laenge ?? 12) / 2;
        const blickLaengs = szenenBlick && halbeLaenge > 10
          ? Math.max(-halbeLaenge + 10, Math.min(halbeLaenge - 10, szene!.sz.mitIch ? szene!.sz.ich.x : zuBus(szeneBus!, ich.x, ich.y)[0]))
          : 0;
        const [blickX, blickY] = szenenBlick ? zurWelt(szeneBus!, blickLaengs, 1.1)
          : tuerNah ? [ich.x * 0.6 + tuerNah.tuer.p[0] * 0.4, ich.y * 0.6 + tuerNah.tuer.p[1] * 0.4] : [ich.x, ich.y];
        welt.scale.set(zoom);
        welt.rotation = dreh;
        // Baumkronen und Namen würden den Bus verdecken
        kronen.alpha += ((szenenBlick ? 0 : 1) - kronen.alpha) * Math.min(1, dtEcht * 4);
        kronen.visible = kronen.alpha > 0.02;
        const dc = Math.cos(dreh), ds = Math.sin(dreh);
        welt.position.set(app.screen.width / 2 - (blickX * dc - blickY * ds) * zoom, app.screen.height / 2 - (blickX * ds + blickY * dc) * zoom);

        // Nacht: dieselbe Umrechnung für die Lichter
        nacht.licht.scale.set(zoom);
        nacht.licht.rotation = dreh;
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
          ...fahrzeugListe.filter((f) => f.art !== "auto").map((f) => ({ p: [f.x, f.y] as [number, number], farbe: f.art === "tram" ? 0xff4d4d : 0xffd400, r: 3 })),
          ...andere.map((a) => ({ p: [a.x, a.y] as [number, number], farbe: a.farbe, r: 3 })),
          { p: [ich.x, ich.y], farbe: 0xff3355, r: 5 },
        ]);

        if (pruefhilfe) {
          el.dataset.lage = `${ich.x.toFixed(1)},${ich.y.toFixed(1)}`;
          const bus = fahrzeugListe.filter((f) => f.art !== "auto").sort((a, b) => Math.hypot(a.x - ich.x, a.y - ich.y) - Math.hypot(b.x - ich.x, b.y - ich.y))[0];
          el.dataset.bus = bus ? `${bus.id}|${bus.x.toFixed(1)},${bus.y.toFixed(1)}|${bus.haltSeit != null ? "haelt" : bus.tempo.toFixed(1)}` : "";
          el.dataset.szene = szene ? `${szene.bus}|${szene.sz.l.typ}|${szeneBus?.haltSeit != null ? tuerPhase(t - szeneBus.haltSeit, szeneBus.haltDauer) : "faehrt"}|${szene.sz.mitIch ? (szene.sz.ich.drin ? "drin" : "draussen") : "frei"}|${szene.sz.fahrgaeste.length}|${szeneHinweis ?? ""}|${szene.sz.ich.x.toFixed(2)},${szene.sz.ich.y.toFixed(2)},${szene.sz.ich.weg.length}` : "";
          const m = muell.naechstes(ich.x, ich.y, 60);
          el.dataset.muell = m ? `${m.p[0].toFixed(1)},${m.p[1].toFixed(1)}` : "";
        }
        const u = mitfahrt ? "bus" : s.untergrund(ich.x, ich.y).art;
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
    // Farbe und Aussehen kommen über `optionen` — die Stadt wird dafür nicht neu gebaut.
  }, []);

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
