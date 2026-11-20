"use client";
/**
 * Freie 3D-Ansicht: Die Figur läuft frei durch eine gemalte Welt, die Kamera
 * folgt ihr über die Schulter.
 *
 *   W/S oder ↑/↓ laufen, A/D oder ←/→ drehen, Umschalt rennt
 *   Maus ziehen (oder wischen) dreht die Kamera, Mausrad zoomt
 *   Klick/Tippen auf den Boden oder eine Station: hinlaufen
 *   1–9 läuft zur Station mit dieser Nummer, 0 zum Tor; E öffnet, was vor einem steht
 *
 * Aufgaben sind kleine Kämpfe: Das Monster greift an, dann kommt die Frage;
 * jede falsche Antwort ist sein Gegenschlag, die richtige der Sieg.
 * Erklärungen stecken als Info-Splitter im Erz: zehn Hiebe legen sie frei, jeder dauert seinen Schwung lang.
 * Vor der Frage läuft ein kurzes Geschicklichkeitsspiel (Konter, Ausweichen,
 * Kombo; lib/gebaeude/kampf.ts) — die Stufe legt die Zeiten fest, »aus« lässt es weg.
 * Kämpfe beginnen nicht von selbst: Knopf bzw. E startet sie, dann zählt ein Vorlauf 3-2-1 herunter.
 * Dazu Schildblock und Schwachstelle an den Stationen, Runen und Kräftemessen
 * beim Boss am Tor, und beim Erz ein Takt: der Hieb im richtigen Moment zählt doppelt.
 * Unten rechts eine Karte des Abschnitts; ein Klick darauf läuft hin.
 * Knopf »2D« bzw. Taste V: dieselbe Welt in Draufsicht — WASD läuft in Bildschirmrichtung, um die
 * Figur herum schneidet die Durchsicht (durchsicht.ts) Kronen und Mauern weg.
 *   auf Tablets: Steuerknüppel unten links
 *
 * Kennt wie das Gebäude keine Inhalte: Wer die Welt benutzt, gibt Karte,
 * Zustände und Abschnitt vor und entscheidet, was bei der Ankunft passiert.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  ZELLE, feldBei, feldMitte, freiWeg, freieStrecke, istFrei, ortBei, ortMitte, schiebeHeraus,
  type FreiOrt, type FreiPlan,
} from "@/lib/gebaeude/frei";
import type { Objekt } from "@/lib/gebaeude/objekte";
import {
  BLOCK_ZIEL, KAMPF_NAME, KONTER_ZIEL, SAMMEL_NAME, kampfFuer, sammelFuer, ZEITEN, kampfEingabe, kampfLoslassen, kampfSchritt, neuerKampf,
  taktStelle, taktTreffer, type Kampf, type KampfArt, type Stufe, type Taste,
} from "@/lib/gebaeude/kampf";
import { tickMonster } from "@/lib/angriffe/monsterLader";
import { STANDARD_AVATAR, baueAvatar, type Avatar } from "../avatar";
import { beendeAvatar, bewegeAvatar, tickAvatare } from "../avatarModell";
import { entsorge, type RaumZustand, type Stil } from "../szene";
import { baueMaler, type Guete, type Maler } from "./malfilter";
import { KIT_VON, baueLandschaft, baueOrte, type Landschaft, type Marke } from "./welt";
import { ladeKit, ladeWeltModelle, weltModelle } from "./modelle";
import { DURCHSICHT, durchsichtFuer } from "./durchsicht";
import { kachelName, useBausatz } from "../bausatz";
import { REZEPT } from "./bauwelt";

interface Props {
  plan: FreiPlan;
  stock: number;
  /** je Abschnitt die Zustände seiner Stationen */
  zustaende: RaumZustand[][];
  /** je Abschnitt: Tor schon offen? */
  zielOffen: boolean[];
  objekte?: Objekt[][];
  /** je Abschnitt der Baustil — er bestimmt die Welt (Gebäude, Höhle, Wald) */
  stile: Stil[];
  avatar?: Avatar;
  /** je Abschnitt: bewacht ein Boss das Tor? */
  waechter?: boolean[];
  /** im TaskCrawler vorgegebene Minispiele: je Abschnitt und Station bzw. je Tor (fehlt = reihum; an Info-Stationen = Erz) */
  kaempfe?: (string | undefined)[][];
  bosse?: (string | undefined)[];
  /** Tastatur und Zeiger an (aus, solange z. B. ein Aufgabenfenster offen ist) */
  aktiv: boolean;
  /** von außen: dorthin laufen (neue `nr` = neuer Auftrag) */
  auftrag?: { ort: FreiOrt; nr: number } | null;
  /** Karte ist bei gleichem `seed` gleich bepflanzt */
  seed: number;
  /** zählt die falschen Antworten: bei jeder schlägt das Monster zurück */
  gegenschlag?: number;
  /** wie schwer die kleinen Kämpfe vor den Aufgaben sind (aus = ohne) */
  stufe?: Stufe;
  /** Ausgang eines kleinen Kampfes: gewonnen?, Reaktionszeit beim Ausweichen */
  onKampf?: (gut: boolean, art: KampfArt, reaktion: number | null) => void;
  /** Sammelspiel an einer Info-Station gelungen oder nicht */
  onSammeln?: (gut: boolean, art: KampfArt) => void;
  onAnkunft: (ort: FreiOrt) => void;
}

/** so viele Hiebe braucht ein Erz */
const HIEBE = 10;
/** ein Hieb dauert so lange wie der Schwung (Sekunden), mindestens bzw. höchstens */
const HIEB_MIN = 0.6, HIEB_MAX = 1.2;
/** Sekunden Vorlauf, bevor ein kleiner Kampf losgeht */
const VORLAUF = 3;

/** was vom laufenden Kampf zu sehen ist (der Rest läuft in der Zeichenschleife) */
interface DuellBild {
  art: KampfArt; halb: number;
  /** Ausweichen: erst nach der Pause bekannt */
  richtung: "links" | "rechts" | null;
  folge: Taste[]; pos: number;
  /** Schildblock: Schild oben? · Schwachstelle: leuchtende Seite, nötige Treffer · Runen: Phase, leuchtende Rune */
  haelt: boolean; ziel: Taste | null; noetig: number; phase: "zeigen" | "eingeben"; zeigt: number;
  ergebnis: "gut" | "schlecht" | null; reaktion: number | null;
}
const bildVon = (k: Kampf, gezeigt: boolean): DuellBild => ({
  art: k.art, halb: k.halb, richtung: gezeigt ? k.richtung : null, folge: k.folge, pos: k.pos,
  haelt: k.haelt, ziel: k.ziel, noetig: k.noetig, phase: k.phase, zeigt: k.zeigt, ergebnis: k.ergebnis, reaktion: k.reaktion,
});
/** Runen der vier Richtungen, je in eigener Farbe */
const RUNE: Record<Taste, { zeichen: string; farbe: string }> = {
  hoch: { zeichen: "ᛉ", farbe: "#38bdf8" }, links: { zeichen: "ᚠ", farbe: "#f472b6" }, runter: { zeichen: "ᛟ", farbe: "#facc15" },
  rechts: { zeichen: "ᚱ", farbe: "#4ade80" }, los: { zeichen: "", farbe: "" },
};
/** Steuerkreuz: Reihenfolge der Knöpfe im 3×3-Raster (null = leer) */
const KREUZ: (Taste | null)[] = [null, "hoch", null, "links", null, "rechts", null, "runter", null];
const PFEIL: Record<Taste, string> = { links: "⬅", rechts: "➡", hoch: "⬆", runter: "⬇", los: "👊" };
const TASTE: Record<string, Taste> = {
  e: "los", enter: "los", " ": "los", a: "links", arrowleft: "links", d: "rechts", arrowright: "rechts",
  w: "hoch", arrowup: "hoch", s: "runter", arrowdown: "runter",
};
const SIEG: Record<KampfArt, string> = {
  konter: "⚡ Konter!", ausweichen: "💨 Ausgewichen!", folge: "✨ Kombo!", block: "🛡️ Abgeblockt!", ziel: "🎯 Volltreffer!",
  runen: "🔮 Bann gebrochen!", kraft: "💪 Zurückgedrängt!",
};
const KARTE_PX = 150;
const ZUSTAND_FARBE: Record<RaumZustand, string> = { offen: "#f59e0b", geloest: "#22c55e", info: "#60a5fa", gelesen: "#94a3b8" };

const GEHEN = 6.2, RENNEN = 9.5, DREHEN = 2.3;
const RADIUS = 0.42;
/** Wegabkürzungen halten so viel Abstand zur Wand; ab dieser Nähe zum Wegpunkt wird eingelenkt; Wendegeschwindigkeit (rad/s) */
const ABSTAND_WAND = 0.62, KURVE = 1.3, WENDE = 7;
const GUETE_SCHLUESSEL = "hp_frei_guete";
const BLICK_SCHLUESSEL = "hp_frei_blick";
const GUETE_NAME: Record<Guete, string> = { 2: "🎨 gemalt", 1: "🖌️ leicht gemalt", 0: "⚡ schnell" };
const ortSchluessel = (o: FreiOrt | null) => (o ? (o.art === "raum" ? `raum${o.raum}` : o.art) : "");
const TON: Record<Marke["ton"], string> = {
  offen: "bg-amber-100 text-amber-950 border-amber-500", geloest: "bg-green-200 text-green-950 border-green-600",
  info: "bg-blue-100 text-blue-950 border-blue-500", gelesen: "bg-slate-200 text-slate-800 border-slate-500",
  zu: "bg-rose-200 text-rose-950 border-rose-600", weiter: "bg-green-200 text-green-950 border-green-600",
};

export default function FreiWelt({
  plan, stock, zustaende, zielOffen, objekte, stile, avatar = STANDARD_AVATAR, waechter, kaempfe, bosse, aktiv, auftrag, seed, gegenschlag = 0, stufe = "mittel", onKampf, onSammeln, onAnkunft,
}: Props) {
  const huelle = useRef<HTMLDivElement>(null);
  const [fehler, setFehler] = useState(false);
  const [marken, setMarken] = useState<Marke[]>([]);
  const markenEl = useRef<(HTMLDivElement | null)[]>([]);
  const [nah, setNah] = useState<FreiOrt | null>(null);
  const [guete, setGuete] = useState<Guete>(2);
  // 2D (Draufsicht) oder 3D (über die Schulter); auf dem Gerät gemerkt
  const [oben, setOben] = useState(false);
  useEffect(() => { try { setOben(localStorage.getItem(BLICK_SCHLUESSEL) === "oben"); } catch { /* ohne Speicher */ } }, []);
  const [finger, setFinger] = useState(false);
  const [hiebe, setHiebe] = useState(0);
  /** Vorlauf vor dem kleinen Kampf: 3, 2, 1 (0 = läuft) */
  const [vorlauf, setVorlauf] = useState(0);
  // Blender-Modelle (Bäume, Felsen …): bis sie da sind, baut die Welt ihre Formen selbst
  const [modelleDa, setModelleDa] = useState(() => !!weltModelle());
  // Gebäude aus Blender-Kacheln (bauwelt.ts): sobald sie da sind, wird die Landschaft neu gebaut
  const bausatzNr = useBausatz(stile.flatMap(s => (REZEPT[s] ? ["verlies3d", kachelName(s)] : [])));
  useEffect(() => { let an = true; ladeWeltModelle().then(ok => { if (an && ok) setModelleDa(true); }); return () => { an = false; }; }, []);
  // Baukästen aus der Weltenwerkstatt (fertig gefärbte Modelle), nur wenn eine Welt sie braucht
  const [kitNr, setKitNr] = useState(0);
  const kits = [...new Set(stile.flatMap(s => KIT_VON[s] ?? []))].sort().join(",");
  useEffect(() => {
    let an = true;
    for (const k of kits ? kits.split(",") : []) ladeKit(k).then(ok => { if (an && ok) setKitNr(n => n + 1); });
    return () => { an = false; };
  }, [kits]);
  const [kampf, setKampf] = useState(false);
  const [duell, setDuell] = useState<DuellBild | null>(null);
  /** das laufende Minispiel ist ein Sammelspiel an einer Info-Station (kein Gegner) */
  const [sammelt, setSammelt] = useState(false);
  /** hier ist das letzte Minispiel verloren gegangen: es muss wiederholt werden (Ort-Schlüssel) */
  const [nochmal, setNochmal] = useState<string | null>(null);
  const ringEl = useRef<HTMLDivElement>(null);
  const balkenEl = useRef<HTMLDivElement>(null);
  const ladeEl = useRef<HTMLDivElement>(null);
  const kraftEl = useRef<HTMLDivElement>(null);
  const pusteEl = useRef<HTMLDivElement>(null);
  const taktEl = useRef<HTMLDivElement>(null);
  const [volltreffer, setVolltreffer] = useState(0);
  const karteEl = useRef<HTMLCanvasElement>(null);
  const pfeilEl = useRef<HTMLDivElement>(null);
  const knueppel = useRef<HTMLDivElement>(null);
  const knauf = useRef<HTMLDivElement>(null);

  // Alles, was die Zeichenschleife liest, steht in einem Ref.
  const lage = useRef({
    plan, stock, aktiv, onAnkunft, guete, zustaende, stufe, onKampf, onSammeln, zielOffen, waechter, kaempfe, bosse, oben,
    /** laufender kleiner Kampf, sein Ort und was davon schon geschehen ist */
    duell: null as Kampf | null,
    duellOrt: null as FreiOrt | null,
    duellGezeigt: false, duellSchlag: false, duellFertig: false, duellNach: 0, duellStand: 0, duellSammeln: false,
    /** Erz-Takt: Zeit, seit die Figur am Erz steht */
    takt: 0,
    x: 0, z: 0, blick: 0, neigung: 0.34, abstand: 6.5,
    /** Hiebe am Erz, vor dem die Figur steht */
    hiebe: 0,
    /** Sekunden, bis der nächste Hieb geht (der Schwung läuft noch) */
    hiebSperre: 0,
    /** Laufrichtung beim Laufen per Klick (dreht weich nach); null = steht */
    richtung: null as number | null,
    /** Kamera-Abstand (Anteil): rückt sofort vor eine Wand, weicht langsam zurück */
    kamAnteil: 1,
    /** Sekunden bis zum Kampfbeginn */
    vorlauf: 0,
    /** kurze Szene (Kampfbeginn, letzter Hieb): danach öffnet sich der Ort */
    warte: null as { rest: number; ort: FreiOrt } | null,
    /** Wegpunkte (Welt) für das Laufen per Klick oder Auftrag */
    pfad: [] as [number, number][],
    /** an diesem Ort soll der Weg enden */
    pfadOrt: null as FreiOrt | null,
    tasten: new Set<string>(),
    knueppel: { x: 0, y: 0 },
    /** an welchem Ort die Figur gerade steht */
    drin: "",
    wandHoehe: 0,
    /** Nebeldichte der Welt (in der Draufsicht dünner) */
    nebelBasis: 0.01,
    /** bewegt, was in der Luft schwebt */
    luft: null as ((zeit: number) => void) | null,
    lichter: null as ((x: number, z: number, zeit: number) => void) | null,
    /** Bodenhöhe unter der Figur (Brücken); null = flach */
    hoeheBei: null as ((x: number, z: number) => number) | null,
    /** so viel Abstand hält die Kamera zu Wandfeldern (Höhlenwände wölben sich in den Gang) */
    kameraRand: 0.3,
    /** Deckenhöhe (Kamera bleibt darunter); 0 = offen */
    decke: 0,
    /** geglättete Höhe der Figur */
    y: 0,
    marken: [] as Marke[],
    setNah, setGuete, setHiebe, setVorlauf, setKampf, setDuell, setVolltreffer, setOben, setSammelt, setNochmal,
  });
  Object.assign(lage.current, { plan, stock, aktiv, onAnkunft, guete, zustaende, stufe, onKampf, onSammeln, zielOffen, waechter, kaempfe, bosse, oben });

  const drei = useRef<{
    szene: THREE.Scene; land: THREE.Group; orte: THREE.Group; spieler: THREE.Group;
    himmel: THREE.HemisphereLight; sonne: THREE.DirectionalLight; fackel: THREE.PointLight;
    nebel: THREE.FogExp2; maler: Maler; sonneVon: THREE.Vector3;
    /** Splitter sprühen von einem Punkt aus */
    spritze: (x: number, y: number, z: number, farbe: number, anzahl: number) => void;
  } | null>(null);

  /** Gruppe eines Ortes in der Szene (trägt `userData.erz` bzw. `userData.ding`) */
  const ortGruppe = (ort: FreiOrt): THREE.Object3D | null => {
    let aus: THREE.Object3D | null = null;
    const gesucht = ortSchluessel(ort);
    drei.current?.orte.traverse(o => { if (o.userData.ort && ortSchluessel(o.userData.ort as FreiOrt) === gesucht) aus = o; });
    return aus;
  };
  const station = (raum: number) => ortGruppe({ art: "raum", raum });
  /** kleinen Kampf (bzw. mit `sammeln` ein Sammelspiel an einer Info-Station) an einem Ort beginnen */
  const beginne = (art: KampfArt, ort: FreiOrt, sammeln = false) => {
    const l = lage.current;
    if (l.stufe === "aus") return;
    l.duell = neuerKampf(art, l.stufe);
    l.duellOrt = ort;
    l.duellSammeln = sammeln;
    l.setSammelt(sammeln);
    l.setNochmal(null);
    l.duellGezeigt = l.duellSchlag = l.duellFertig = false;
    l.duellStand = 0;
    l.vorlauf = VORLAUF;
    l.setVorlauf(VORLAUF);
    l.tasten.clear();
    l.setDuell(bildVon(l.duell, false));
  };
  const figur = () => drei.current?.spieler.children[0];
  /** Figur dreht sich zu einem Punkt */
  const schaue = (x: number, z: number) => {
    const d = drei.current, l = lage.current;
    if (d) d.spieler.rotation.y = Math.atan2(x - l.x, z - l.z);
  };

  /** Kampf an diesem Ort (Monster an der Station, Boss am Tor)? Der beginnt erst auf Knopf bzw. E */
  const wartetAufStart = (ort: FreiOrt) => {
    const l = lage.current;
    if (l.stufe === "aus") return false;
    if (ort.art === "raum") return l.zustaende[l.stock]?.[ort.raum] === "offen";
    return ort.art === "ziel" && !!l.waechter?.[l.stock] && !l.zielOffen[l.stock];
  };

  /**
   * Einen Ort betreten: Erz wird erst abgebaut, ein Monster greift erst an —
   * alles andere (und beides danach) öffnet sich sofort.
   */
  const betrete = (ort: FreiOrt) => {
    const l = lage.current;
    if (l.warte || l.duell) return;
    const z = ort.art === "raum" ? l.zustaende[l.stock]?.[ort.raum] : null;
    const st = ort.art === "raum" ? station(ort.raum) : null;
    // vorgegebenes Sammelspiel statt Erz (bei Stufe »aus« bleibt es beim Erz)
    const sammelArt = z === "info" && ort.art === "raum" && l.stufe !== "aus" ? sammelFuer(l.kaempfe?.[l.stock]?.[ort.raum]) : null;
    if (sammelArt && st) {
      schaue(st.position.x, st.position.z);
      beginne(sammelArt, ort, true);
      return;
    }
    if (z === "info" && st) {
      // erst wenn der letzte Schwung durch ist
      if (l.hiebSperre > 0) return;
      // Erz-Takt: steht der Zeiger in der Mitte, zählt der Hieb doppelt
      const voll = l.stufe !== "aus" && taktTreffer(l.takt, l.stufe);
      l.hiebe += voll ? 2 : 1;
      if (voll) { l.setVolltreffer(n => n + 1); drei.current?.spritze(st.position.x, 1.4, st.position.z, 0xfacc15, 8); }
      l.setHiebe(Math.min(HIEBE, l.hiebe));
      schaue(st.position.x, st.position.z);
      const f = figur();
      const schwung = f ? bewegeAvatar(f, "angriff") : 0;
      l.hiebSperre = Math.min(HIEB_MAX, Math.max(HIEB_MIN, schwung));
      const erz = st.userData.erz as THREE.Object3D | undefined;
      erz?.scale.setScalar(1 - 0.55 * Math.min(HIEBE, l.hiebe) / HIEBE);
      drei.current?.spritze(st.position.x, 1.2, st.position.z, 0x60a5fa, 10);
      if (l.hiebe >= HIEBE) { l.hiebe = 0; l.warte = { rest: 0.45, ort }; }
      return;
    }
    if (z === "offen" && st) {
      // Kampfbeginn: das Monster dreht sich her und greift an, dann kommt die Frage
      const ding = st.userData.ding as THREE.Object3D | undefined;
      if (ding) ding.rotation.y = Math.atan2(l.x - st.position.x, l.z - st.position.z);
      (ding?.userData.figur as { spiele(art: string): number } | undefined)?.spiele("angriff");
      schaue(st.position.x, st.position.z);
      if (l.stufe !== "aus") {
        // kleiner Kampf vor der Frage: wie im TaskCrawler vorgegeben, sonst reihum Konter, Ausweichen, Kombo, Schildblock, Schwachstelle
        const nr = (ort.art === "raum" ? ort.raum : 0) + l.stock;
        beginne(kampfFuer(ort.art === "raum" ? l.kaempfe?.[l.stock]?.[ort.raum] : undefined, nr), ort);
        return;
      }
      l.setKampf(true);
      l.warte = { rest: 0.9, ort };
      return;
    }
    // der Boss am verschlossenen Tor: Runen oder Kräftemessen — vorgegeben oder abwechselnd je Abschnitt
    if (ort.art === "ziel" && l.stufe !== "aus" && l.waechter?.[l.stock] && !l.zielOffen[l.stock]) {
      const tor = ortGruppe(ort);
      const boss = tor?.userData.ding as THREE.Object3D | undefined;
      if (tor && boss) boss.rotation.y = Math.atan2(l.x - (tor.position.x + boss.position.x), l.z - (tor.position.z + boss.position.z));
      beginne(kampfFuer(l.bosse?.[l.stock], l.stock, true), ort);
      return;
    }
    l.onAnkunft(ort);
  };

  /** Eingabe im kleinen Kampf (Taste oder Knopf) */
  const druecke = (taste: Taste) => {
    const l = lage.current, k = l.duell;
    if (!k || k.ergebnis || l.vorlauf > 0) return;
    kampfEingabe(k, taste);
  };
  /** Schildblock: Taste bzw. Knopf losgelassen */
  const lasse = () => { const l = lage.current, k = l.duell; if (k && l.vorlauf <= 0) kampfLoslassen(k); };

  /** Figur an den Anfang (oder ans Tor) des Abschnitts stellen, Blick zur Kartenmitte */
  const stelle = (anTor: boolean) => {
    const l = lage.current, e = l.plan.ebenen[l.stock];
    const [fx, fy] = anTor ? e.ziel : e.start;
    // ein Stück neben die Mitte: dort steht das Tor
    l.x = feldMitte(fx) + 0.2; l.z = feldMitte(fy) + 2.1;
    l.pfad = []; l.pfadOrt = null; l.tasten.clear();
    l.duell = null; l.warte = null; l.vorlauf = 0; l.setVorlauf(0); l.setDuell(null); l.setKampf(false);
    // Blick den Weg entlang (zur ersten Station bzw. zum Tor), nicht gegen die Wand
    const hin = freiWeg(e, [feldBei(l.x), feldBei(l.z)], anTor || !e.raeume.length ? (anTor ? e.start : e.ziel) : [e.raeume[0].x, e.raeume[0].y]);
    const vorn = hin[Math.min(hin.length - 1, 7)];
    l.blick = vorn ? Math.atan2(feldMitte(vorn[0]) - l.x, feldMitte(vorn[1]) - l.z) : 0;
    l.drin = ortSchluessel(ortBei(e, l.x, l.z, l.stock > 0));
    l.setNah(ortBei(e, l.x, l.z, l.stock > 0));
  };

  /** Weg zu einem Ort bzw. Feld anlegen */
  const laufeZu = (ort: FreiOrt | null, feld?: [number, number]) => {
    const l = lage.current, e = l.plan.ebenen[l.stock];
    const ziel: [number, number] = ort ? (ort.art === "ziel" ? e.ziel : ort.art === "zurueck" ? e.start : [e.raeume[ort.raum].x, e.raeume[ort.raum].y]) : feld!;
    const von: [number, number] = [feldBei(l.x), feldBei(l.z)];
    if (ort && ortSchluessel(ortBei(e, l.x, l.z, l.stock > 0)) === ortSchluessel(ort)) { if (!wartetAufStart(ort)) betrete(ort); return; }
    l.pfad = freiWeg(e, von, ziel).map(([x, y]) => [feldMitte(x), feldMitte(y)]);
    l.pfadOrt = ort;
  };

  // ── einmalig: Renderer, Licht, Eingaben, Schleife ────────────────────────
  useEffect(() => {
    const el = huelle.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      setFehler(true);
      return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const flaeche = renderer.domElement;
    el.appendChild(flaeche);
    Object.assign(flaeche.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });

    let start: Guete = 2;
    try { const g = Number(localStorage.getItem(GUETE_SCHLUESSEL)); if (g === 0 || g === 1) start = g; } catch { /* ohne Speicher */ }
    // ?guete=0…2 legt die Darstellung fest (zum Prüfen): dann wird auch nichts von selbst heruntergestellt
    const fest = new URLSearchParams(window.location.search).get("guete");
    if (fest === "0" || fest === "1" || fest === "2") start = Number(fest) as Guete;
    lage.current.guete = start;
    setGuete(start);
    setFinger(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    const maler = baueMaler(renderer, start);

    const szene = new THREE.Scene();
    const nebel = new THREE.FogExp2(0xffffff, 0.01);
    szene.fog = nebel;
    const himmel = new THREE.HemisphereLight(0xffffff, 0x445566, 1);
    const sonne = new THREE.DirectionalLight(0xffffff, 1);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    Object.assign(sonne.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
    sonne.shadow.bias = -0.0006;
    sonne.shadow.normalBias = 0.05;
    const fackel = new THREE.PointLight(0xffc48a, 0, 26, 1.3);
    const land = new THREE.Group(), orte = new THREE.Group(), spieler = new THREE.Group();
    spieler.scale.setScalar(1.4);
    szene.add(himmel, sonne, sonne.target, fackel, land, orte, spieler);
    // Splitter: kleine Tetraeder, die hochspritzen und zu Boden fallen
    const splitterForm = new THREE.TetrahedronGeometry(0.13);
    const splitter: { m: THREE.Mesh; v: THREE.Vector3; leben: number }[] = [];
    const spritze = (x: number, y: number, z: number, farbe: number, anzahl: number) => {
      for (let k = 0; k < anzahl; k++) {
        const m = new THREE.Mesh(splitterForm, new THREE.MeshBasicMaterial({ color: farbe }));
        m.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.5, z + (Math.random() - 0.5) * 0.6);
        m.scale.setScalar(0.6 + Math.random() * 1.2);
        szene.add(m);
        splitter.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5), leben: 0.9 + Math.random() * 0.4 });
      }
    };
    drei.current = { szene, land, orte, spieler, himmel, sonne, fackel, nebel, maler, sonneVon: new THREE.Vector3(0, 1, 0), spritze };

    const kamera = new THREE.PerspectiveCamera(55, 1, 0.2, 500);
    const groesse = () => {
      const b = el.clientWidth || 1, h = el.clientHeight || 1;
      maler.groesse(b, h);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
    };
    groesse();
    const ro = new ResizeObserver(groesse);
    ro.observe(el);

    // ── Tastatur ──
    const LAUF = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"]);
    const runter = (ev: KeyboardEvent) => {
      const l = lage.current;
      const t = ev.target as HTMLElement;
      if (!l.aktiv || t.closest("input, textarea, select, [contenteditable]")) return;
      if (l.duell) {
        // im kleinen Kampf gehören die Tasten dem Kampf (gehaltene Tasten zählen nicht mehrfach)
        const taste = TASTE[ev.key.toLowerCase()];
        if (taste) { ev.preventDefault(); if (!ev.repeat) druecke(taste); }
        return;
      }
      const e = l.plan.ebenen[l.stock];
      const ziffer = /^(?:Numpad|Digit)([0-9])$/.exec(ev.code)?.[1] ?? (/^[0-9]$/.test(ev.key) ? ev.key : null);
      if (ziffer !== null) {
        const n = Number(ziffer);
        if (n === 0) laufeZu({ art: "ziel" });
        else if (e.raeume[n - 1]) laufeZu({ art: "raum", raum: n - 1 });
        ev.preventDefault();
        return;
      }
      const k = ev.key.toLowerCase();
      if (k === "v" && !ev.repeat) { ev.preventDefault(); wechsleBlick(); return; }
      if (k === "e" || k === "enter") {
        const ort = ortBei(e, l.x, l.z, l.stock > 0);
        if (ort) { ev.preventDefault(); betrete(ort); }
        return;
      }
      if (!LAUF.has(k)) return;
      ev.preventDefault();
      l.tasten.add(k);
      if (k !== "shift") { l.pfad = []; l.pfadOrt = null; }
    };
    const hoch = (ev: KeyboardEvent) => {
      lage.current.tasten.delete(ev.key.toLowerCase());
      if (TASTE[ev.key.toLowerCase()] === "los") lasse();
    };
    const weg = () => lage.current.tasten.clear();
    window.addEventListener("keydown", runter);
    window.addEventListener("keyup", hoch);
    window.addEventListener("blur", weg);

    // ── Zeiger: ziehen dreht, tippen läuft ──
    const zeiger = new THREE.Raycaster();
    let griff: { id: number; x: number; y: number; weit: number; zeit: number } | null = null;
    const druck = (ev: PointerEvent) => {
      if (!lage.current.aktiv) return;
      griff = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, weit: 0, zeit: performance.now() };
      flaeche.setPointerCapture(ev.pointerId);
    };
    const zug = (ev: PointerEvent) => {
      if (!griff || griff.id !== ev.pointerId) return;
      const l = lage.current, dx = ev.clientX - griff.x, dy = ev.clientY - griff.y;
      griff.weit += Math.abs(dx) + Math.abs(dy);
      griff.x = ev.clientX; griff.y = ev.clientY;
      if (griff.weit < 6) return;
      if (l.oben) return; // die Draufsicht bleibt nach Norden ausgerichtet
      l.blick -= dx * 0.006;
      l.neigung = Math.max(0.05, Math.min(1.25, l.neigung + dy * 0.004));
    };
    const los = (ev: PointerEvent) => {
      if (!griff || griff.id !== ev.pointerId) return;
      const tipp = griff.weit < 6 && performance.now() - griff.zeit < 500;
      griff = null;
      const l = lage.current;
      if (!tipp || !l.aktiv) return;
      const r = flaeche.getBoundingClientRect();
      zeiger.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), kamera);
      // zuerst: eine Station, das Tor oder den Rückweg getroffen?
      for (const tr of zeiger.intersectObject(orte, true)) {
        let o: THREE.Object3D | null = tr.object;
        while (o && !o.userData.ort) o = o.parent;
        if (o) { laufeZu(o.userData.ort as FreiOrt); return; }
      }
      const p = new THREE.Vector3();
      if (!zeiger.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return;
      const feld: [number, number] = [feldBei(p.x), feldBei(p.z)];
      if (istFrei(l.plan.ebenen[l.stock], feld[0], feld[1])) laufeZu(null, feld);
    };
    const rad = (ev: WheelEvent) => {
      if (!lage.current.aktiv) return;
      ev.preventDefault();
      lage.current.abstand = Math.max(3, Math.min(12, lage.current.abstand * (ev.deltaY > 0 ? 1.1 : 0.9)));
    };
    flaeche.addEventListener("pointerdown", druck);
    flaeche.addEventListener("pointermove", zug);
    flaeche.addEventListener("pointerup", los);
    flaeche.addEventListener("pointercancel", los);
    flaeche.addEventListener("wheel", rad, { passive: false });

    // ── Schleife ──
    const auge = new THREE.Vector3(), kopf = new THREE.Vector3(), punkt = new THREE.Vector3();
    let id = 0, zuletzt = performance.now(), lahm = 0, gemessen = 0, bilder = 0, gelaufen = 0;
    const bild = (jetzt: number) => {
      const roh = (jetzt - zuletzt) / 1000;
      const dt = Math.max(0, Math.min(0.1, roh));
      zuletzt = jetzt;
      tickMonster(dt);
      tickAvatare();
      const l = lage.current, d = drei.current;
      if (!d) return;
      const e = l.plan.ebenen[l.stock];

      // kurze Szene läuft ab (Kampfbeginn, letzter Hieb): danach öffnet sich der Ort
      if (l.warte) {
        l.warte.rest -= dt;
        l.pfad = []; l.pfadOrt = null;
        if (l.warte.rest <= 0) { const ort = l.warte.ort; l.warte = null; l.tasten.clear(); l.setKampf(false); l.onAnkunft(ort); }
      }
      if (l.duell && l.duellOrt) {
        const k = l.duell, ort = l.duellOrt;
        const st = ortGruppe(ort);
        const monster = (st?.userData.ding as THREE.Object3D | undefined)?.userData.figur as { spiele(art: string): number } | undefined;
        const held = d.spieler.children[0];
        l.pfad = []; l.pfadOrt = null;
        if (l.vorlauf > 0) {
          // Vorlauf: erst einstimmen, dann geht es los
          const vorher = Math.ceil(l.vorlauf);
          l.vorlauf = Math.max(0, l.vorlauf - dt);
          if (Math.ceil(l.vorlauf) !== vorher) { l.setVorlauf(Math.ceil(l.vorlauf)); l.tasten.clear(); }
        } else if (!k.ergebnis) {
          kampfSchritt(k, dt);
          const anteil = k.t / k.dauer;
          // der Ring trifft den Kreis genau bei KONTER_ZIEL
          if (ringEl.current) ringEl.current.style.transform = `scale(${Math.max(0.2, 1 + (KONTER_ZIEL - anteil) * 2)})`;
          if (balkenEl.current) balkenEl.current.style.width = `${Math.max(0, 100 - anteil * 100)}%`;
          if (ladeEl.current) ladeEl.current.style.width = `${Math.min(100, k.ladung * 100)}%`;
          if (kraftEl.current) kraftEl.current.style.width = `${k.kraft * 100}%`;
          if (pusteEl.current) pusteEl.current.style.width = `${k.ausdauer * 100}%`;
          if ((k.art === "block" || k.art === "ziel" || k.art === "kraft") && !l.duellSchlag && k.t > 0.3) { l.duellSchlag = true; monster?.spiele("angriff"); }
          if (k.art === "konter" && !l.duellSchlag && anteil > KONTER_ZIEL - 0.25) { l.duellSchlag = true; monster?.spiele("angriff"); }
          if (k.art === "ausweichen" && !l.duellGezeigt && k.t >= k.ab) { l.duellGezeigt = true; monster?.spiele("angriff"); l.setDuell(bildVon(k, true)); }
        }
        if (k.ergebnis && !l.duellFertig) {
          l.duellFertig = true;
          l.duellNach = 0.8;
          const [mx, mz] = ortMitte(e, ort);
          if (l.duellSammeln) {
            // Sammelspiel: kein Gegner, kein Treffer — gelungen sprühen blaue Splitter, sonst bröckelt es nur
            const erz = st?.userData.erz as THREE.Object3D | undefined;
            if (k.ergebnis === "gut") { erz?.scale.setScalar(0.45); d.spritze(mx, 1.2, mz, 0x60a5fa, 14); if (held) bewegeAvatar(held, "jubel"); }
            else d.spritze(mx, 1.0, mz, 0x9ca3af, 6);
            l.setDuell(bildVon(k, true));
            l.onSammeln?.(k.ergebnis === "gut", k.art);
          } else if (k.ergebnis === "gut") {
            if (held) bewegeAvatar(held, "angriff");
            monster?.spiele("treffer");
            d.spritze(mx, 1.4, mz, 0xfacc15, 12);
          } else {
            monster?.spiele("angriff");
            if (held) bewegeAvatar(held, "treffer");
            d.spritze(l.x, 1.6, l.z, 0xe11d48, 8);
          }
          if (!l.duellSammeln) {
            l.setDuell(bildVon(k, true));
            l.onKampf?.(k.ergebnis === "gut", k.art, k.reaktion);
          }
        } else if (!k.ergebnis && k.stand !== l.duellStand) {
          // etwas Sichtbares hat sich geändert (Treffer, neue Schwachstelle, nächste Rune …)
          l.duellStand = k.stand;
          l.setDuell(bildVon(k, l.duellGezeigt));
        } else if (l.duellFertig) {
          l.duellNach -= dt;
          if (l.duellNach <= 0) {
            l.duell = null; l.duellOrt = null; l.setDuell(null); l.tasten.clear();
            // nur ein gewonnenes Minispiel öffnet Aufgabe, Info oder Tor — verloren heißt: noch einmal (E)
            if (k.ergebnis === "gut") l.onAnkunft(ort); else l.setNochmal(ortSchluessel(ort));
          }
        }
      }
      for (let k = splitter.length - 1; k >= 0; k--) {
        const s = splitter[k];
        s.v.y -= 16 * dt;
        s.m.position.addScaledVector(s.v, dt);
        s.m.rotation.x += dt * 9; s.m.rotation.z += dt * 7;
        s.leben -= dt;
        if (s.leben <= 0 || s.m.position.y < 0) { szene.remove(s.m); (s.m.material as THREE.Material).dispose(); splitter.splice(k, 1); }
      }

      // Eingaben: Tasten und Steuerknüppel
      let vor = 0, dreh = 0, ox = 0, oz = 0;
      if (l.aktiv && !l.warte && !l.duell) {
        const t = l.tasten;
        // Draufsicht: oben auf dem Bildschirm ist Norden (−z)
        ox = (t.has("d") || t.has("arrowright") ? 1 : 0) - (t.has("a") || t.has("arrowleft") ? 1 : 0) + l.knueppel.x;
        oz = (t.has("s") || t.has("arrowdown") ? 1 : 0) - (t.has("w") || t.has("arrowup") ? 1 : 0) + l.knueppel.y;
        vor = (t.has("w") || t.has("arrowup") ? 1 : 0) - (t.has("s") || t.has("arrowdown") ? 1 : 0) - l.knueppel.y;
        dreh = (t.has("a") || t.has("arrowleft") ? 1 : 0) - (t.has("d") || t.has("arrowright") ? 1 : 0) - l.knueppel.x;
        vor = Math.max(-1, Math.min(1, vor));
        dreh = Math.max(-1, Math.min(1, dreh));
      }
      if (Math.abs(l.knueppel.x) + Math.abs(l.knueppel.y) > 0.1 && l.pfad.length) { l.pfad = []; l.pfadOrt = null; }
      if (!l.oben) l.blick += dreh * DREHEN * dt;

      let vx = 0, vz = 0, tempo = 0;
      if (l.pfad.length) {
        // gerade Strecken abkürzen: den fernsten Wegpunkt ansteuern, zu dem nichts im Weg ist
        // (mit Abstand zur Wand: sonst schneidet die Figur Ecken an und prallt ab)
        while (l.pfad.length > 1 && freieStrecke(e, l.x, l.z, l.pfad[1][0], l.pfad[1][1], ABSTAND_WAND) === 1) l.pfad.shift();
        const [zx, zz] = l.pfad[0];
        const rest = Math.hypot(zx - l.x, zz - l.z);
        const weiter = l.pfad.length > 1;
        tempo = l.pfad.length > 6 ? RENNEN : GEHEN;
        // vor einer Station bzw. dem Tor stehen bleiben, nicht hineinlaufen
        const amOrt = l.pfadOrt && (() => { const [mx, mz] = ortMitte(e, l.pfadOrt!); return Math.hypot(mx - l.x, mz - l.z) < 1.9; })();
        if (amOrt) { l.pfad = []; l.pfadOrt = null; tempo = 0; }
        else if (rest < (weiter ? 0.5 : 0.25)) { l.pfad.shift(); if (!l.pfad.length) l.pfadOrt = null; }
        else {
          vx = (zx - l.x) / rest; vz = (zz - l.z) / rest;
          // kurz vor dem Wegpunkt schon zum nächsten einlenken: runde Kurven statt spitzer Haken
          if (weiter && rest < KURVE) {
            const [nx, nz] = l.pfad[1], nl = Math.hypot(nx - l.x, nz - l.z) || 1, w = 1 - rest / KURVE;
            vx = vx * (1 - w) + ((nx - l.x) / nl) * w; vz = vz * (1 - w) + ((nz - l.z) / nl) * w;
          }
          // die Laufrichtung dreht mit begrenzter Geschwindigkeit nach
          const soll = Math.atan2(vx, vz);
          if (l.richtung === null) l.richtung = soll;
          let dr = soll - l.richtung;
          dr = Math.atan2(Math.sin(dr), Math.cos(dr));
          l.richtung += Math.max(-WENDE * dt, Math.min(WENDE * dt, dr));
          vx = Math.sin(l.richtung); vz = Math.cos(l.richtung);
        }
        // die Kamera schwenkt sacht hinter die Figur
        if (vx || vz) {
          let diff = Math.atan2(vx, vz) - l.blick;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          l.blick += diff * Math.min(1, dt * 1.6);
        }
      } else if (l.oben && (ox || oz)) {
        const n = Math.hypot(ox, oz);
        vx = ox / n; vz = oz / n;
        tempo = (l.tasten.has("shift") ? RENNEN : GEHEN) * Math.min(1, n);
      } else if (!l.oben && vor) {
        vx = Math.sin(l.blick) * vor; vz = Math.cos(l.blick) * vor;
        tempo = (l.tasten.has("shift") ? RENNEN : GEHEN) * (vor < 0 ? 0.6 : 1) * Math.abs(vor);
        const n = Math.hypot(vx, vz);
        vx /= n; vz /= n;
      }
      const laeuft = tempo > 0 && (vx !== 0 || vz !== 0);
      if (!l.pfad.length) l.richtung = laeuft ? Math.atan2(vx, vz) : null;
      if (laeuft) {
        [l.x, l.z] = schiebeHeraus(e, l.x + vx * tempo * dt, l.z + vz * tempo * dt, RADIUS);
        // um die Stationen herum: nicht durch das Objekt laufen
        e.raeume.forEach((_, k) => {
          const [mx, mz] = ortMitte(e, { art: "raum", raum: k });
          const ab = Math.hypot(l.x - mx, l.z - mz);
          if (ab < 1.15 && ab > 1e-6) { l.x = mx + ((l.x - mx) / ab) * 1.15; l.z = mz + ((l.z - mz) / ab) * 1.15; }
        });
        let diff = Math.atan2(vx, vz) - d.spieler.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        d.spieler.rotation.y += diff * Math.min(1, dt * 12);
      }
      // Höhe folgt dem Boden (z. B. über eine Brücke), sanft nachgezogen
      const sollY = l.hoeheBei ? l.hoeheBei(l.x, l.z) : 0;
      l.y += (sollY - l.y) * Math.min(1, dt * 12);
      d.spieler.position.set(l.x, l.y, l.z);
      if (!laeuft && l.warte) schaue(...ortMitte(e, l.warte.ort));
      else if (!laeuft && l.duellOrt) schaue(...ortMitte(e, l.duellOrt));
      const figur = d.spieler.children[0];
      if (figur) bewegeAvatar(figur, laeuft ? (tempo > GEHEN + 0.5 ? "rennen" : "lauf") : "idle");
      // ohne Bewegungsclips (Modell lädt noch) hüpft die Figur beim Laufen
      if (laeuft && !figur?.userData.bewegung) d.spieler.position.y = l.y + Math.abs(Math.sin(jetzt / 90)) * 0.08;

      // Ankunft: neu an einem Ort
      const ort = ortBei(e, l.x, l.z, l.stock > 0);
      const schluessel = ortSchluessel(ort);
      if (schluessel !== l.drin) {
        l.drin = schluessel;
        l.setNah(ort);
        if (l.hiebe) { l.hiebe = 0; l.setHiebe(0); }
        l.hiebSperre = 0;
        // Der Rückweg öffnet sich nur auf Wunsch (E bzw. Knopf), sonst liefe man aus Versehen zurück;
        // ein Erz wartet auf die Hiebe, ein Kampf auf den Startknopf. Alles andere beginnt von selbst.
        const erz = ort?.art === "raum" && l.zustaende[l.stock]?.[ort.raum] === "info";
        if (ort && ort.art !== "zurueck" && l.aktiv) {
          l.pfad = []; l.pfadOrt = null; l.tasten.clear();
          if (!erz && !wartetAufStart(ort)) betrete(ort);
        }
      }

      // Draufsicht: schräg von Süden, weit oben; die Durchsicht schneidet um die Figur alles Hohe weg
      DURCHSICHT.uDsAn.value = l.oben ? 1 : 0;
      DURCHSICHT.uDsSpieler.value.set(l.x, 0, l.z);
      d.nebel.density = l.nebelBasis * (l.oben ? 0.4 : 1);
      if (l.oben) {
        const weit = l.abstand * 3.3;
        kopf.set(l.x, 0.6, l.z);
        punkt.set(l.x, weit, l.z + weit * 0.62);
        auge.lerp(punkt, Math.min(1, dt * 10));
        kamera.position.copy(auge);
        kamera.lookAt(auge.x, 0.6, auge.z - weit * 0.62);
      } else {
      // Kamera über der Schulter; Wände halten sie auf
      kopf.set(l.x, 2.1 + l.y, l.z);
      let flach = Math.cos(l.neigung) * l.abstand, steil = Math.sin(l.neigung) * l.abstand;
      // unter einer Decke flacher schauen statt höher steigen (gleicher Abstand)
      if (l.decke && kopf.y + steil > l.decke - 0.35) {
        steil = Math.max(0.3, l.decke - 0.35 - kopf.y);
        flach = Math.sqrt(Math.max(0, l.abstand * l.abstand - steil * steil));
      }
      let anteil = 1;
      const unterWand = l.wandHoehe > 0 && kopf.y + steil < l.wandHoehe + 0.4;
      if (unterWand) {
        anteil = freieStrecke(e, l.x, l.z, l.x - Math.sin(l.blick) * flach, l.z - Math.cos(l.blick) * flach, l.kameraRand);
        anteil = Math.max(0, anteil - 0.05);
      }
      // vor eine Wand sofort heranrücken, danach sacht zurückfedern
      l.kamAnteil = anteil < l.kamAnteil ? anteil : l.kamAnteil + (anteil - l.kamAnteil) * Math.min(1, dt * 2.5);
      const a = Math.max(0.12, l.kamAnteil);
      // nah herangerückt: etwas höher, damit die Figur nicht das ganze Bild füllt
      punkt.set(l.x - Math.sin(l.blick) * flach * a, kopf.y + steil * a + (1 - a) * (l.decke ? 0 : 0.9), l.z - Math.cos(l.blick) * flach * a);
      // unter einer geschlossenen Decke bleiben
      if (l.decke) punkt.y = Math.min(punkt.y, l.decke - 0.35);
      auge.lerp(punkt, Math.min(1, dt * 14));
      if (unterWand) {
        // das Nachziehen darf nicht durch eine Ecke führen: verdeckt etwas den Blick zum Kopf, springt die Kamera auf ihren Platz
        if (freieStrecke(e, l.x, l.z, auge.x, auge.z, 0.12) < 1) auge.copy(punkt);
        [auge.x, auge.z] = schiebeHeraus(e, auge.x, auge.z, Math.max(0.25, l.kameraRand - 0.05));
      }
      kamera.position.copy(auge);
      kamera.lookAt(kopf);
      }

      // Licht wandert mit
      d.fackel.position.set(l.x, 3.4, l.z);
      if (d.fackel.userData.staerke) d.fackel.intensity = d.fackel.userData.staerke + Math.sin(jetzt / 70) * 2.5 + Math.sin(jetzt / 23) * 1.5;
      d.sonne.target.position.set(l.x, 0, l.z);
      d.sonne.position.set(l.x + d.sonneVon.x * 70, d.sonneVon.y * 70, l.z + d.sonneVon.z * 70);

      l.luft?.(jetzt / 1000);
      l.lichter?.(l.x, l.z, jetzt / 1000);
      d.maler.male(szene, kamera);

      if (l.hiebSperre > 0) l.hiebSperre = Math.max(0, l.hiebSperre - dt);
      // Erz-Takt: der Zeiger schwingt, solange die Figur an einem Erz steht
      l.takt += dt;
      if (taktEl.current && l.stufe !== "aus") taktEl.current.style.left = `${taktStelle(l.takt, l.stufe) * 100}%`;

      // Karte: der Pfeil zeigt, wo die Figur steht und wohin die Kamera schaut
      if (pfeilEl.current) {
        const f = KARTE_PX / (e.b * ZELLE);
        pfeilEl.current.style.transform = `translate(${l.x * f}px, ${l.z * f}px) translate(-50%, -50%) rotate(${Math.PI - (l.oben ? d.spieler.rotation.y : l.blick)}rad)`;
      }

      // Schilder über den Stationen
      const b = el.clientWidth, h = el.clientHeight;
      l.marken.forEach((m, i) => {
        const s = markenEl.current[i];
        if (!s) return;
        punkt.set(m.x, m.y, m.z).project(kamera);
        const weit = Math.hypot(m.x - l.x, m.z - l.z);
        if (punkt.z > 1 || punkt.z < -1) { s.style.display = "none"; return; }
        s.style.display = "";
        s.style.transform = `translate(-50%, -50%) translate(${((punkt.x + 1) / 2) * b}px, ${((1 - punkt.y) / 2) * h}px) scale(${Math.max(0.55, Math.min(1.15, 9 / weit))})`;
        s.style.opacity = String(Math.max(0.45, Math.min(1, 26 / weit)));
      });

      // zu langsam? Dann den Pinsel schmaler stellen (einmal alle paar Sekunden prüfen)
      // Die ersten Sekunden zählen nicht (Modelle laden, Shader bauen), ebenso wenig Aussetzer
      // (Tab im Hintergrund, Aufgabenfenster): nur anhaltend langsame Bilder stellen herunter —
      // und auf »schnell«, also ganz ohne Pinsel, erst wenn auch »leicht gemalt« lange ruckelt.
      gelaufen += dt;
      if (gelaufen > 10 && roh < 0.5) { bilder++; gemessen += roh; }
      if (gemessen > 3) {
        if (bilder / gemessen < 22 && document.visibilityState === "visible") lahm++; else lahm = 0;
        if (lahm >= (l.guete === 2 ? 3 : 6) && l.guete > 0 && fest === null) { l.setGuete((l.guete - 1) as Guete); lahm = 0; }
        bilder = 0; gemessen = 0;
      }
    };
    const schleife = (jetzt: number) => { id = requestAnimationFrame(schleife); bild(jetzt); };
    stelle(false);
    id = requestAnimationFrame(schleife);
    // ?takt: Bilder von Hand weiterschalten (zum Prüfen, wenn der Browser im Hintergrund keine Bilder zeichnet)
    if (new URLSearchParams(window.location.search).has("takt")) {
      (window as unknown as Record<string, unknown>).hpFrei = { lage: lage.current, flaeche, renderer, bild: (ms = 16) => bild(zuletzt + ms) };
    }

    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      window.removeEventListener("keydown", runter);
      window.removeEventListener("keyup", hoch);
      window.removeEventListener("blur", weg);
      for (const k of spieler.children) beendeAvatar(k);
      for (const s of splitter) (s.m.material as THREE.Material).dispose();
      splitterForm.dispose();
      entsorge(szene);
      maler.entsorge();
      renderer.dispose();
      el.removeChild(flaeche);
      drei.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Güte: an den Maler geben und merken
  useEffect(() => {
    drei.current?.maler.guete(guete);
    const s = drei.current?.sonne.shadow;
    if (s) { s.mapSize.setScalar(guete === 2 ? 2048 : 1024); s.map?.dispose(); s.map = null; }
  }, [guete]);
  function wechsleBlick() {
    const l = lage.current, neu = !l.oben;
    l.oben = neu;
    l.setOben(neu);
    // zurück in 3D: die Kamera steht hinter der Figur, so wie sie gerade schaut
    if (!neu) l.blick = drei.current?.spieler.rotation.y ?? l.blick;
    try { localStorage.setItem(BLICK_SCHLUESSEL, neu ? "oben" : "schulter"); } catch { /* egal */ }
  }
  const waehleGuete = () => {
    const g = ((guete + 2) % 3) as Guete;
    setGuete(g);
    try { localStorage.setItem(GUETE_SCHLUESSEL, String(g)); } catch { /* egal */ }
  };

  // ── Spielfigur ───────────────────────────────────────────────────────────
  const avatarSchluessel = JSON.stringify(avatar);
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.spieler.children]) { d.spieler.remove(k); beendeAvatar(k); entsorge(k); }
    const figur = baueAvatar(avatar);
    const schatten = () => figur.traverse(o => { o.castShadow = !o.userData.umriss; });
    figur.userData.beiModell = schatten;
    schatten();
    d.spieler.add(figur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarSchluessel]);

  // ── Landschaft: einmal je Abschnitt und Stil ─────────────────────────────
  const stil = stile[stock] ?? "wald";
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.land.children]) { d.land.remove(k); entsorge(k); }
    const land: Landschaft = baueLandschaft(plan.ebenen[stock], stil, seed + stock);
    d.land.add(land.gruppe);
    const s = land.stimmung;
    d.nebel.color.set(s.nebel);
    d.nebel.density = s.dichte;
    lage.current.nebelBasis = s.dichte;
    durchsichtFuer(land.gruppe);
    d.himmel.color.set(s.oben); d.himmel.groundColor.set(s.unten); d.himmel.intensity = s.umgebung;
    d.sonne.color.set(s.sonne); d.sonne.intensity = s.sonneStaerke; d.sonne.castShadow = s.sonneStaerke > 0.2;
    d.sonneVon.set(...s.sonneVon).normalize();
    d.fackel.intensity = s.fackel; d.fackel.userData.staerke = s.fackel;
    d.fackel.color.set(s.fackelFarbe ?? 0xffc48a);
    lage.current.luft = land.takt ?? null;
    lage.current.lichter = land.lichter ?? null;
    lage.current.hoeheBei = land.hoehe ?? null;
    lage.current.kameraRand = land.kameraRand ?? 0.3;
    lage.current.decke = land.decke ?? 0;
    d.maler.belichtung(s.belichtung);
    lage.current.wandHoehe = land.wandHoehe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, stock, stil, seed, modelleDa, bausatzNr, kitNr]);

  // ── Stationen und Tor: neu bei jedem Fortschritt ─────────────────────────
  const schluessel = JSON.stringify([stock, zustaende[stock], zielOffen[stock], objekte?.[stock], stil, waechter?.[stock]]);
  const vorZustand = useRef<{ stock: number; plan: FreiPlan | null; z: RaumZustand[] }>({ stock: -1, plan: null, z: [] });
  useEffect(() => {
    const d = drei.current;
    if (!d) return;
    for (const k of [...d.orte.children]) { d.orte.remove(k); entsorge(k); }
    const o = baueOrte(plan.ebenen[stock], {
      zustaende: zustaende[stock] ?? [], zielOffen: zielOffen[stock] ?? false,
      zielArt: stock < plan.ebenen.length - 1 ? "weiter" : "ausgang",
      objekte: objekte?.[stock], stil, mitZurueck: stock > 0, waechter: waechter?.[stock] ?? false, abschnitt: stock,
    });
    d.orte.add(o.gruppe);
    lage.current.marken = o.marken;
    setMarken(o.marken);
    // Sieg: eine Aufgabe dieses Abschnitts ist eben gelöst worden — die Figur schlägt zu und jubelt, Splitter fliegen
    const jetzt = zustaende[stock] ?? [], alt = vorZustand.current;
    if (alt.stock === stock && alt.plan === plan) {
      jetzt.forEach((z, k) => {
        if (z !== "geloest" || alt.z[k] !== "offen") return;
        const st = station(k);
        if (!st) return;
        d.spritze(st.position.x, 1.4, st.position.z, 0xfacc15, 18);
        d.spritze(st.position.x, 1.4, st.position.z, 0x22c55e, 10);
        schaue(st.position.x, st.position.z);
        const f = figur();
        if (f) { const dauer = bewegeAvatar(f, "angriff"); window.setTimeout(() => { const g = figur(); if (g) bewegeAvatar(g, "jubel"); }, dauer * 1000 + 50); }
      });
    }
    vorZustand.current = { stock, plan, z: [...jetzt] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);

  // Karte des Abschnitts: Wände dunkel, Wege hell, Stationen in ihrer Farbe, Tor rot bzw. grün
  useEffect(() => {
    const c = karteEl.current, ctx = c?.getContext("2d");
    const e = plan.ebenen[stock];
    if (!c || !ctx || !e) return;
    const px = KARTE_PX / e.b;
    ctx.clearRect(0, 0, KARTE_PX, KARTE_PX);
    for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
      if (e.art[y * e.b + x] === 0) continue;
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillRect(x * px, y * px, px + 0.5, px + 0.5);
    }
    const punkt = (x: number, y: number, f: string, r = 4.5) => {
      ctx.beginPath();
      ctx.arc((x + 0.5) * px, (y + 0.5) * px, r, 0, Math.PI * 2);
      ctx.fillStyle = f;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#111827";
      ctx.stroke();
    };
    e.raeume.forEach((p, k) => punkt(p.x, p.y, ZUSTAND_FARBE[zustaende[stock]?.[k] ?? "offen"]));
    punkt(e.ziel[0], e.ziel[1], zielOffen[stock] ? "#22c55e" : "#e11d48", 5.5);
    if (stock > 0) punkt(e.start[0], e.start[1], "#cbd5e1", 3.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, schluessel]);
  const karteKlick = (ev: React.MouseEvent) => {
    const e = plan.ebenen[stock], r = ev.currentTarget.getBoundingClientRect();
    const feld: [number, number] = [Math.floor(((ev.clientX - r.left) / r.width) * e.b), Math.floor(((ev.clientY - r.top) / r.height) * e.h)];
    if (aktiv && !lage.current.duell && istFrei(e, feld[0], feld[1])) laufeZu(null, feld);
  };

  // Gegenschlag: bei jeder falschen Antwort greift das Monster an, die Figur zuckt
  useEffect(() => {
    if (!gegenschlag || !drei.current) return;
    const l = lage.current;
    const ort = ortBei(l.plan.ebenen[l.stock], l.x, l.z, false);
    const st = ort?.art === "raum" ? station(ort.raum) : null;
    ((st?.userData.ding as THREE.Object3D | undefined)?.userData.figur as { spiele(art: string): number } | undefined)?.spiele("angriff");
    const f = figur();
    if (f) bewegeAvatar(f, "treffer");
    drei.current.spritze(l.x, 1.6, l.z, 0xe11d48, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gegenschlag]);

  // Abschnitt gewechselt: weiter → an dessen Anfang; zurück → an dessen Tor.
  const vorher = useRef(stock);
  useEffect(() => {
    if (!drei.current) return;
    stelle(stock < vorher.current);
    vorher.current = stock;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, stock]);

  // Auftrag von außen: hinlaufen
  useEffect(() => {
    if (!auftrag || !drei.current) return;
    if (auftrag.ort.art === "zurueck" && stock === 0) return;
    laufeZu(auftrag.ort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auftrag?.nr]);

  // ── Steuerknüppel (Tablets) ──────────────────────────────────────────────
  const knueppelZug = (ev: React.PointerEvent) => {
    const r = knueppel.current!.getBoundingClientRect();
    let x = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const n = Math.hypot(x, y);
    if (n > 1) { x /= n; y /= n; }
    lage.current.knueppel = { x, y };
    if (knauf.current) knauf.current.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
  };
  const knueppelLos = () => {
    lage.current.knueppel = { x: 0, y: 0 };
    if (knauf.current) knauf.current.style.transform = "";
  };

  const knopf = "rounded-lg bg-surface/90 border border-line font-bold hover:border-accent";
  if (fehler) {
    return (
      <div className="w-full h-full min-h-[320px] flex items-center justify-center p-6 text-center text-sm text-muted">
        Dieses Gerät kann die 3D-Welt nicht zeichnen (WebGL fehlt). Wähle oben eine andere Ansicht.
      </div>
    );
  }
  return (
    <div className="relative w-full h-full min-h-[320px] overflow-hidden select-none">
      <div ref={huelle} className="absolute inset-0" data-freiwelt data-stock={stock} data-stil={stil} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {marken.map((m, i) => (
          <div key={`${ortSchluessel(m.ort)}`} ref={n => { markenEl.current[i] = n; }} style={{ display: "none" }}
            className={`absolute left-0 top-0 min-w-9 h-9 px-2 rounded-full border-2 flex items-center justify-center font-black text-base shadow-md ${TON[m.ton]}`}>
            {m.text}
          </div>
        ))}
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
        <button className={`${knopf} px-2 h-8 text-xs`} onClick={wechsleBlick} data-blick={oben ? "oben" : "schulter"}
          title={oben ? "Zurück in die 3D-Ansicht über die Schulter (V)" : "Draufsicht: dieselbe Welt von oben (V)"}>
          {oben ? "🧍 3D" : "🗺️ 2D"}
        </button>
        <button className={`${knopf} px-2 h-8 text-xs`} onClick={waehleGuete} title="Darstellung: gemalt sieht am schönsten aus, schnell läuft auf jedem Gerät">
          {GUETE_NAME[guete]}
        </button>
      </div>
      {kampf && (
        <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none" data-kampf>
          <span className="px-5 py-2 rounded-xl bg-rose-600 text-white font-black text-2xl shadow-2xl -rotate-3">⚔️ Kampf!</span>
        </div>
      )}
      {duell && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25" data-duell={duell.art} data-ergebnis={duell.ergebnis ?? ""}>
          {vorlauf > 0 && (
            <div className="absolute inset-x-0 top-[12%] flex flex-col items-center pointer-events-none" data-vorlauf={vorlauf}>
              <span key={vorlauf} className="text-7xl font-black text-white animate-pulse" style={{ textShadow: "0 0 12px #000, 0 0 4px #000" }}>{vorlauf}</span>
              <span className="text-sm font-bold text-white" style={{ textShadow: "0 0 6px #000" }}>Mach dich bereit …</span>
            </div>
          )}
          <div className="card px-5 py-4 flex flex-col items-center gap-3 shadow-2xl max-w-[92%]">
            <div className={`font-black text-xl ${duell.ergebnis === "gut" ? "text-green-500" : duell.ergebnis === "schlecht" ? "text-rose-500" : ""}`}>
              {sammelt
                ? duell.ergebnis === "gut" ? "✨ Info-Splitter geborgen!" : duell.ergebnis === "schlecht" ? "🪨 Daneben — versuch es noch einmal" : `📜 ${SAMMEL_NAME[duell.art] ?? KAMPF_NAME[duell.art]}`
                : duell.ergebnis === "gut" ? SIEG[duell.art] : duell.ergebnis === "schlecht" ? "💥 Getroffen! Noch einmal" : `⚔️ ${KAMPF_NAME[duell.art]}`}
            </div>
            {duell.art === "konter" && (
              <>
                <div className="relative w-44 h-44 flex items-center justify-center">
                  {/* grüner Bereich: so breit wie das Zeitfenster der Stufe */}
                  <div className="absolute rounded-full border-green-500/80 box-border"
                    style={{ width: 80 * (1 + 2 * duell.halb), height: 80 * (1 + 2 * duell.halb), borderWidth: 80 * 2 * duell.halb, borderStyle: "solid" }} />
                  <div ref={ringEl} className="absolute w-20 h-20 rounded-full border-4 border-fg" style={{ transform: "scale(2.6)" }} />
                  <span className="text-2xl">👊</span>
                </div>
                <p className="text-xs text-muted text-center">Drück E (oder den Knopf), wenn der Ring im Grünen ist.</p>
                <button className="btn-primary py-2 px-6" onClick={() => druecke("los")} disabled={!!duell.ergebnis}>👊 Konter</button>
              </>
            )}
            {duell.art === "ausweichen" && (
              <>
                <div className="text-6xl h-20 flex items-center" data-richtung={duell.richtung ?? ""}>{duell.richtung ? PFEIL[duell.richtung] : "👀"}</div>
                <p className="text-xs text-muted text-center">
                  {duell.ergebnis === "gut" && duell.reaktion !== null ? `Reaktion: ${duell.reaktion.toFixed(2).replace(".", ",")} s`
                    : duell.richtung ? "Schnell in diese Richtung!" : "Achtung … gleich zeigt ein Pfeil, wohin du ausweichst (A/D oder ←/→)."}
                </p>
                <div className="flex gap-3">
                  {(["links", "rechts"] as const).map(t => (
                    <button key={t} className="btn-primary text-2xl w-16 h-12" onClick={() => druecke(t)} disabled={!!duell.ergebnis} aria-label={t}>{PFEIL[t]}</button>
                  ))}
                </div>
              </>
            )}
            {duell.art === "folge" && (
              <>
                <div className="flex gap-1.5 text-3xl" data-folge={duell.folge.join(",")}>
                  {duell.folge.map((t, i) => (
                    <span key={i} className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${i < duell.pos ? "border-green-500 bg-green-500/20" : i === duell.pos ? "border-accent" : "border-line opacity-60"}`}>{PFEIL[t]}</span>
                  ))}
                </div>
                <p className="text-xs text-muted text-center">Drück die Pfeile der Reihe nach (Pfeiltasten oder W/A/S/D).</p>
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <button className="btn-primary text-xl w-12 h-10" onClick={() => druecke("hoch")} aria-label="hoch">⬆</button>
                  <span />
                  <button className="btn-primary text-xl w-12 h-10" onClick={() => druecke("links")} aria-label="links">⬅</button>
                  <button className="btn-primary text-xl w-12 h-10" onClick={() => druecke("runter")} aria-label="runter">⬇</button>
                  <button className="btn-primary text-xl w-12 h-10" onClick={() => druecke("rechts")} aria-label="rechts">➡</button>
                </div>
              </>
            )}
            {duell.art === "block" && (
              <>
                <div className="text-5xl h-16 flex items-center">{duell.haelt ? "🛡️" : "✋"}</div>
                <div className="relative w-56 h-5 rounded-full bg-line overflow-hidden">
                  {/* grüner Bereich: hier loslassen */}
                  <div className="absolute inset-y-0 bg-green-500/70" style={{ left: `${(BLOCK_ZIEL - duell.halb) * 100}%`, width: `${duell.halb * 200}%` }} />
                  <div ref={ladeEl} className="absolute inset-y-0 left-0 bg-accent/80 border-r-2 border-fg" style={{ width: "0%" }} />
                </div>
                <p className="text-xs text-muted text-center">Halte E (oder den Knopf) gedrückt und lass los, wenn der Balken im Grünen ist.</p>
                <button className="btn-primary py-2 px-6 select-none touch-none" disabled={!!duell.ergebnis}
                  onPointerDown={ev => { ev.currentTarget.setPointerCapture(ev.pointerId); druecke("los"); }} onPointerUp={lasse} onPointerCancel={lasse}>
                  🛡️ Schild halten
                </button>
              </>
            )}
            {duell.art === "ziel" && (
              <>
                <div className="grid grid-cols-3 gap-1" data-ziel={duell.ziel ?? ""}>
                  {KREUZ.map((t, i) => t === null
                    ? <span key={i} className="w-14 h-14 flex items-center justify-center text-3xl">{i === 4 ? "👾" : ""}</span>
                    : (
                      <button key={i} onClick={() => druecke(t)} disabled={!!duell.ergebnis} aria-label={t}
                        className={`w-14 h-14 rounded-full border-2 text-2xl ${duell.ziel === t ? "border-rose-500 bg-rose-500/40 animate-pulse" : "border-line opacity-50"}`}>
                        {duell.ziel === t ? "🎯" : PFEIL[t]}
                      </button>
                    ))}
                </div>
                <p className="text-xs text-muted text-center">Triff die Schwachstelle, solange sie leuchtet (Pfeiltasten oder antippen): {duell.pos} / {duell.noetig}</p>
              </>
            )}
            {duell.art === "runen" && (
              <>
                <div className="grid grid-cols-3 gap-1" data-rune={duell.phase === "zeigen" && duell.zeigt >= 0 ? duell.folge[duell.zeigt] : ""} data-phase={duell.phase}>
                  {KREUZ.map((t, i) => {
                    if (t === null) return <span key={i} className="w-14 h-14 flex items-center justify-center text-3xl">{i === 4 ? "👹" : ""}</span>;
                    const an = duell.phase === "zeigen" && duell.zeigt >= 0 && duell.folge[duell.zeigt] === t;
                    return (
                      <button key={i} onClick={() => druecke(t)} disabled={!!duell.ergebnis || duell.phase === "zeigen"} aria-label={t}
                        className="w-14 h-14 rounded-xl border-2 text-3xl font-black transition-colors"
                        style={{ borderColor: RUNE[t].farbe, color: an ? "#111827" : RUNE[t].farbe, background: an ? RUNE[t].farbe : "transparent", opacity: duell.phase === "zeigen" && !an ? 0.45 : 1 }}>
                        {RUNE[t].zeichen}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted text-center">
                  {duell.phase === "zeigen" ? "Merk dir, in welcher Reihenfolge die Runen aufleuchten …"
                    : `Jetzt du: gleiche Reihenfolge (Pfeiltasten oder antippen) — ${duell.pos} / ${duell.folge.length}`}
                </p>
              </>
            )}
            {duell.art === "kraft" && (
              <>
                <div className="relative w-60 h-6 rounded-full bg-rose-500/60 overflow-hidden border border-line">
                  <div ref={kraftEl} className="absolute inset-y-0 left-0 bg-green-500" style={{ width: "50%" }} />
                  <div className="absolute inset-y-0 left-1/2 w-0.5 bg-fg/60" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted w-60">
                  <span>Puste</span>
                  <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden"><div ref={pusteEl} className="h-full bg-sky-400" style={{ width: "100%" }} /></div>
                </div>
                <p className="text-xs text-muted text-center">Drück E im ruhigen Takt und schieb den Balken nach rechts. Wer nur hämmert, dem geht die Puste aus.</p>
                <button className="btn-primary py-2 px-6" onClick={() => druecke("los")} disabled={!!duell.ergebnis}>💪 Drücken</button>
              </>
            )}
            {duell.art !== "konter" && duell.art !== "block" && (
              <div className="w-48 h-1.5 rounded-full bg-line overflow-hidden"><div ref={balkenEl} className="h-full bg-accent" style={{ width: "100%" }} /></div>
            )}
          </div>
        </div>
      )}
      <div className="absolute right-2 bottom-2 rounded-lg overflow-hidden border border-line bg-black/55 cursor-pointer" style={{ width: KARTE_PX, height: KARTE_PX }}
        onClick={karteKlick} title="Karte: Klick läuft dorthin" data-karte>
        <canvas ref={karteEl} width={KARTE_PX} height={KARTE_PX} className="block" />
        <div ref={pfeilEl} className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
          style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "14px solid #f43f5e", filter: "drop-shadow(0 0 2px #000)" }} />
      </div>
      {nah && aktiv && !kampf && !duell && (() => {
        const z = nah.art === "raum" ? zustaende[stock]?.[nah.raum] : null;
        const sammelArt = z === "info" && nah.art === "raum" && stufe !== "aus" ? sammelFuer(kaempfe?.[stock]?.[nah.raum]) : null;
        const wiederholen = nochmal !== null && nochmal === ortSchluessel(nah) && (z === "offen" || !!sammelArt || nah.art === "ziel");
        return (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-5 flex flex-col items-center gap-1.5">
            {z === "info" && stufe !== "aus" && !sammelArt && (
              <div className="flex flex-col items-center gap-0.5" data-takt>
                {volltreffer > 0 && <span key={volltreffer} className="text-xs font-black text-amber-400 animate-bounce">💥 Volltreffer! Zählt doppelt</span>}
                <div className="relative w-44 h-3 rounded-full bg-surface/90 border border-line overflow-hidden">
                  <div className="absolute inset-y-0 bg-green-500/70" style={{ left: `${(0.5 - ZEITEN[stufe].taktHalb) * 100}%`, width: `${ZEITEN[stufe].taktHalb * 200}%` }} />
                  <div ref={taktEl} className="absolute inset-y-0 w-1 -ml-0.5 bg-fg" style={{ left: "0%" }} />
                </div>
              </div>
            )}
          <button onClick={() => betrete(nah)} data-ort-knopf
            className="btn-primary text-sm py-2 px-4 shadow-xl">
            {wiederholen ? "🔁 E · Nochmal versuchen" : nah.art === "ziel" ? (stufe !== "aus" && waechter?.[stock] && !zielOffen[stock] ? "⚔️ E · Wächter herausfordern" : "E · Zum Tor") : nah.art === "zurueck" ? "E · Zurück in den Abschnitt davor"
              : sammelArt ? `📜 E · Info bergen: ${SAMMEL_NAME[sammelArt]}` : z === "info" ? `⛏️ E · Erz abbauen (${hiebe}/${HIEBE})` : z === "offen" ? (stufe === "aus" ? "⚔️ E · Kämpfen" : "⚔️ E · Kampf starten") : z === "gelesen" ? "E · Info-Splitter lesen" : "E · Ansehen"}
          </button>
          </div>
        );
      })()}
      {finger && (
        <div ref={knueppel} className="absolute left-4 bottom-4 w-28 h-28 rounded-full bg-surface/50 border-2 border-line touch-none flex items-center justify-center"
          onPointerDown={ev => { ev.currentTarget.setPointerCapture(ev.pointerId); knueppelZug(ev); }}
          onPointerMove={ev => { if (ev.currentTarget.hasPointerCapture(ev.pointerId)) knueppelZug(ev); }}
          onPointerUp={knueppelLos} onPointerCancel={knueppelLos} aria-label="Steuerknüppel">
          <div ref={knauf} className="w-12 h-12 rounded-full bg-accent/80 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
