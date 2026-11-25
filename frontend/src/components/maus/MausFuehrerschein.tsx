"use client";
/**
 * Der Maus-Führerschein — Grundkurs am Computer für Kinder ab etwa zehn.
 *
 * Teil 1: Klicken, Doppelklick, Rechtsklick, Ziehen, Markieren, Kopieren —
 * Teil 2: Scrollen, Tastatur, Dateien ordnen, Fenster, Speichern & USB-Stick;
 * Teil 3: Suchen, Apps, Bildschirmfoto, Aussehen;
 * Teil 4: Handy (Android/iOS) — Bedienen, Apps installieren, Berechtigungen,
 * Privatsphäre, Risiken erkennen. Jeder
 * Teil endet mit einem Blatt zum Speichern. Jede Stufe hat »Vorführen« und
 * »Weiter«; Sterne zeigen, wie gut sie lief.
 *
 * Teil 1–3 gibt es für Windows 11, Ubuntu und macOS (Auswahl oben): gleiche
 * Aufgaben, aber Optik, Begriffe und Tastenkürzel des gewählten Systems.
 *
 * Dazu kommen:
 *   • Hilfsmodus — größere Ziele, mehr Zeit (ein Schalter, keine NTA-Daten)
 *   • Prüfung je Teil — alle Stufen am Stück, ohne Vorführung; bestanden ist,
 *     wer keine überspringt. Schülerkonten bekommen dafür einmalig Hauspunkte.
 *   • Fortschritt bleibt beim Neuladen erhalten (im Browser, je Konto/Gast)
 *   • über einen Code meldet das Kind seinen Stand an die Live-Übersicht
 *
 * Gerechnet wird im Browser; Fehler beim Melden bleiben still — ein
 * abgelehnter Eintrag soll keinem Kind die geschaffte Stufe verderben.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { useQuery } from "@tanstack/react-query";
import { api, type MausPruefungOut, type MausStufenStand, type MausZugang } from "@/lib/api";
import {
  ALLE_TEILE, GRENZEN, TEILE, gesamt, merkePunkte, punkteAuf, sterne, sterneAusAltstand, teilBestanden,
  type Ergebnisse, type SterneJeSystem, type MausModus, type StufeId, type StufenErgebnis, type Teil,
} from "@/lib/maus/ergebnis";
import { MausBild, MausStile } from "./MausBild";
import { MausKontext, type HandySystem } from "./MausKontext";
import Klickspiel from "./Klickspiel";
import StufeRechtsklick from "./StufeRechtsklick";
import StufeZiehen from "./StufeZiehen";
import StufeMarkieren from "./StufeMarkieren";
import StufeKopieren from "./StufeKopieren";
import StufeSpeichern from "./StufeSpeichern";
import StufeScrollen from "./StufeScrollen";
import StufeTastatur from "./StufeTastatur";
import StufeExplorer from "./StufeExplorer";
import StufeFenster from "./StufeFenster";
import StufeDatei from "./StufeDatei";
import StufeScreenshot from "./StufeScreenshot";
import StufeSuche from "./StufeSuche";
import StufeApps from "./StufeApps";
import StufeAussehen from "./StufeAussehen";
import StufeBedienhilfe from "./StufeBedienhilfe";
import StufeTaskleiste from "./StufeTaskleiste";
import StufeProfil from "./StufeProfil";
import StufeHandy from "./mobil/StufeHandy";
import StufeAppStore from "./mobil/StufeAppStore";
import StufeBerechtigungen from "./mobil/StufeBerechtigungen";
import StufePrivatsphaere from "./mobil/StufePrivatsphaere";
import StufeRisiken from "./mobil/StufeRisiken";
import { BETRIEBSSYSTEME, SYSTEME, echtesSystem, hinweisFremd, type Betriebssystem } from "@/lib/maus/system";
import { mitTasten } from "./Taste";
import { WindowsKontext } from "./windows/WindowsKontext";
import { STANDARD_AUSSEHEN, aussehenAus, type Aussehen } from "@/lib/maus/windows";
import { benutzernameAus } from "@/lib/maus/dateisystem";
import MausBestenliste from "./MausBestenliste";
import MausUebersicht from "./MausUebersicht";
import { useMeinStand } from "@/hooks/useMeinStand";

type SpeicherReiter = "speichern1" | "speichern2" | "speichern3" | "speichern4";
type ReiterId = StufeId | SpeicherReiter | "bestenliste" | "uebersicht";

const SPEICHERN: Record<Teil, SpeicherReiter> = { 1: "speichern1", 2: "speichern2", 3: "speichern3", 4: "speichern4" };

const REITER: { id: ReiterId; icon: string; label: string; teil: Teil | 0 }[] = [
  { id: "klick", icon: "👆", label: "Klicken", teil: 1 },
  { id: "doppelklick", icon: "✌️", label: "Doppelklick", teil: 1 },
  { id: "rechtsklick", icon: "📋", label: "Rechtsklick", teil: 1 },
  { id: "ziehen", icon: "✋", label: "Ziehen", teil: 1 },
  { id: "markieren", icon: "🖍️", label: "Markieren", teil: 1 },
  { id: "kopieren", icon: "📄", label: "Kopieren", teil: 1 },
  { id: "speichern1", icon: "💾", label: "Führerschein", teil: 1 },
  { id: "scrollen", icon: "🖱️", label: "Scrollen", teil: 2 },
  { id: "tastatur", icon: "⌨️", label: "Tastatur", teil: 2 },
  { id: "explorer", icon: "📁", label: "Dateien", teil: 2 },
  { id: "fenster", icon: "🪟", label: "Fenster", teil: 2 },
  { id: "datei", icon: "💽", label: "Speichern & USB-Stick", teil: 2 },
  { id: "speichern2", icon: "💾", label: "Urkunde", teil: 2 },
  { id: "suche", icon: "🔍", label: "Suchen", teil: 3 },
  { id: "apps", icon: "🧰", label: "Welche App?", teil: 3 },
  { id: "screenshot", icon: "📸", label: "Bildschirmfoto", teil: 3 },
  { id: "aussehen", icon: "🎨", label: "Hintergrund & Farben", teil: 3 },
  { id: "bedienhilfe", icon: "🔎", label: "Zeiger & Text", teil: 3 },
  { id: "taskleiste", icon: "📌", label: "Taskleiste & Start", teil: 3 },
  { id: "profil", icon: "🔒", label: "Profil & Sperrbildschirm", teil: 3 },
  { id: "speichern3", icon: "💾", label: "Urkunde", teil: 3 },
  { id: "handy", icon: "📱", label: "Handy bedienen", teil: 4 },
  { id: "appstore", icon: "🛍️", label: "Apps installieren", teil: 4 },
  { id: "berechtigungen", icon: "🔐", label: "Berechtigungen", teil: 4 },
  { id: "privatsphaere", icon: "🛡️", label: "Privatsphäre", teil: 4 },
  { id: "risiken", icon: "⚠️", label: "Risiken erkennen", teil: 4 },
  { id: "speichern4", icon: "💾", label: "Urkunde", teil: 4 },
  { id: "bestenliste", icon: "🏆", label: "Bestenliste", teil: 0 },
  { id: "uebersicht", icon: "👩‍🏫", label: "Klassenübersicht", teil: 0 },
];

const NAMEN = Object.fromEntries(REITER.map(r => [r.id, `${r.icon} ${r.label}`])) as Record<ReiterId, string>;

const TIER_SCHLUESSEL = "hp_maus_tier";
const EINZELLISTEN: MausModus[] = ["klick", "doppelklick", "ziehen"];

type Gespeichert = {
  ergebnisse: Ergebnisse; bestanden: Teil[]; hilfe: boolean; aussehen: Aussehen;
  system: Betriebssystem; handy: HandySystem; jeSystem: SterneJeSystem;
};

type Pruefung = {
  teil: Teil;
  nr: number;
  lauf: number;
  ergebnisse: Ergebnisse;
  uebersprungen: StufeId[];
  fertig: boolean;
  antwort?: MausPruefungOut | null;
  fehler?: boolean;
};

/**
 * Speicherschlüssel für einen Gast: Code plus die Gast-Id aus dem Token. Am
 * Schulrechner sitzen nacheinander mehrere Kinder — ein Schlüssel nur je Code
 * gäbe dem zweiten Kind den Stand des ersten.
 */
export function schluesselFuerGast(code: string, token: string): string {
  try {
    const teil = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(atob(teil)).sub;
    return `gast-${code}-${sub}`;
  } catch {
    return `gast-${code}`;
  }
}

/**
 * Speicherschlüssel für einen Gast nach seinem Namen — so findet ein Kind
 * seinen Stand wieder, auch mit neuem Code oder nach Ablauf des Gast-Tokens.
 * Groß-/Kleinschreibung und Leerzeichen zählen nicht (»mia « = »Mia«). Gilt
 * nur in diesem Browser; zwei gleichnamige Kinder am selben Rechner teilen
 * sich den Stand (so gewollt, ohne Rückfrage).
 */
export function schluesselFuerGastName(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return n ? `gast-name-${n}` : null;
}

function stand(ergebnisse: Ergebnisse): MausStufenStand {
  const aus: MausStufenStand = {};
  for (const [id, e] of Object.entries(ergebnisse)) {
    if (!e) continue;
    aus[id] = { punkte: e.punkte, sterne: sterne(id as StufeId, e.punkte), dauer_ms: e.dauerMs };
  }
  return aus;
}

function besser(alt: StufenErgebnis | undefined, neu: StufenErgebnis): StufenErgebnis {
  return alt && alt.punkte >= neu.punkte ? alt : neu;
}

function laden(schluessel: string): Gespeichert | null {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    if (!roh || typeof roh !== "object" || typeof roh.ergebnisse !== "object") return null;
    return {
      ergebnisse: roh.ergebnisse ?? {},
      bestanden: Array.isArray(roh.bestanden) ? roh.bestanden.filter((t: unknown) => ALLE_TEILE.includes(t as Teil)) : [],
      hilfe: roh.hilfe === true,
      aussehen: aussehenAus(roh.aussehen),
      system: BETRIEBSSYSTEME.includes(roh.system) ? roh.system : "windows",
      handy: roh.handy === "ios" ? "ios" : "android",
      jeSystem: roh.jeSystem && typeof roh.jeSystem === "object"
        ? roh.jeSystem
        : sterneAusAltstand(roh.ergebnisse ?? {}, roh.system ?? "windows", roh.handy ?? "android"),
    };
  } catch {
    return null;
  }
}

/**
 * `vorgabe` (TaskCrawler-Station): `{ reiter: <Stufen-Id> }` legt die Stufe fest (klick, doppelklick,
 * rechtsklick, ziehen, markieren, kopieren, scrollen, tastatur, explorer, fenster, datei,
 * suche, apps, screenshot, aussehen, bedienhilfe, taskleiste, profil, handy, appstore,
 * berechtigungen, privatsphaere, risiken) und blendet Stufenleiste, Prüfungen
 * und »Weiter« aus.
 */
export default function MausFuehrerschein({
  action, zugang, name = "", speicherSchluessel = "lokal", ersatzSchluessel, konto, klasse, verwaltung = false, vorgabe,
}: {
  action?: ReactNode;
  vorgabe?: Vorgabe;
  /** Beitritt über Code/QR — dann laufen Einträge und Fortschritt über den Code. */
  zugang?: MausZugang;
  /** Vorschlag für den Namen auf dem Führerschein. */
  name?: string;
  /** Wessen Fortschritt im Browser liegt (Konto oder Gast). */
  speicherSchluessel?: string;
  /** Älterer Schlüssel, aus dem ein noch leerer Stand einmalig übernommen wird. */
  ersatzSchluessel?: string;
  /** Angemeldet? Nur Schülerkonten bekommen Hauspunkte. */
  konto?: { typ: "student" | "teacher" };
  klasse?: string | null;
  /** Werkzeugseite einer Lehrkraft: mit Klassenübersicht. */
  verwaltung?: boolean;
}) {
  const festerReiter = wahl(vorgabe, "reiter", REITER.filter(r => r.teil && !r.id.startsWith("speichern")).map(r => r.id));
  const [reiter, setReiter] = useState<ReiterId>(festerReiter ?? "klick");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [ergebnisse, setErgebnisse] = useState<Ergebnisse>({});
  const [bestanden, setBestanden] = useState<Teil[]>([]);
  const [hilfe, setHilfe] = useState(false);
  // Das eigene Windows (Hintergrund, Zeiger, Taskleiste …) — Teil 3 verändert es.
  const [aussehen, setAussehen] = useState<Aussehen>(STANDARD_AUSSEHEN);
  // Welches System Teil 1–3 nachbilden und welches Handy Teil 4.
  const [system, setSystem] = useState<Betriebssystem>("windows");
  const [handy, setHandy] = useState<HandySystem>("android");
  // Bestwerte je System — nur für die Sterne.
  const [jeSystem, setJeSystem] = useState<SterneJeSystem>({});
  const [echt, setEcht] = useState<Betriebssystem | null>("windows");
  const [geladen, setGeladen] = useState(false);
  const [pruefung, setPruefung] = useState<Pruefung | null>(null);
  const [nurTouch, setNurTouch] = useState(false);
  const gemeldet = useRef<Partial<Record<MausModus, number>>>({});
  const abgeschlossen = useRef<number | null>(null);
  const schluessel = `hp_maus_${speicherSchluessel}`;

  // Die Sitzung der Lehrkraft — für den Filter »Diese Sitzung« in der Bestenliste.
  const { data: eigeneSitzung } = useQuery({
    queryKey: ["maus-sitzung"],
    queryFn: () => api.toolSessions.create("maus"),
    enabled: verwaltung && !zugang,
  });
  const sitzungCode = zugang?.code ?? eigeneSitzung?.code ?? null;

  useEffect(() => {
    try { setAvatar(localStorage.getItem(TIER_SCHLUESSEL)); } catch {}
    setEcht(echtesSystem());
    if (typeof window.matchMedia === "function") {
      setNurTouch(window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches);
    }
  }, []);

  // Fortschritt laden — und als schon gemeldet vormerken, sonst ginge jede
  // Neuladung erneut an die Bestenliste.
  useEffect(() => {
    const g = laden(schluessel) ?? (ersatzSchluessel ? laden(`hp_maus_${ersatzSchluessel}`) : null);
    setErgebnisse(g?.ergebnisse ?? {});
    setBestanden(g?.bestanden ?? []);
    setHilfe(g?.hilfe ?? false);
    setAussehen(g?.aussehen ?? STANDARD_AUSSEHEN);
    setSystem(g?.system ?? "windows");
    setHandy(g?.handy ?? "android");
    setJeSystem(g?.jeSystem ?? {});
    const e = g?.ergebnisse ?? {};
    gemeldet.current = {
      klick: e.klick?.punkte ?? 0, doppelklick: e.doppelklick?.punkte ?? 0,
      ziehen: e.ziehen?.punkte ?? 0, gesamt: gesamt(e),
    };
    setGeladen(true);
  }, [schluessel, ersatzSchluessel]);

  useEffect(() => {
    if (!geladen) return;
    try { localStorage.setItem(schluessel, JSON.stringify({ ergebnisse, bestanden, hilfe, aussehen, system, handy, jeSystem })); } catch {}
  }, [geladen, schluessel, ergebnisse, bestanden, hilfe, aussehen, system, handy, jeSystem]);

  // Bestenliste: nur melden, was besser ist als das zuletzt Gemeldete.
  useEffect(() => {
    if (!geladen) return;
    const werte: Record<MausModus, number> = {
      klick: ergebnisse.klick?.punkte ?? 0,
      doppelklick: ergebnisse.doppelklick?.punkte ?? 0,
      ziehen: ergebnisse.ziehen?.punkte ?? 0,
      gesamt: gesamt(ergebnisse),
    };
    for (const modus of [...EINZELLISTEN, "gesamt"] as MausModus[]) {
      const wert = werte[modus];
      if (wert <= 0 || wert <= (gemeldet.current[modus] ?? 0)) continue;
      gemeldet.current[modus] = wert;
      const e = modus === "gesamt" ? null : ergebnisse[modus as StufeId];
      const anzahl = (t: Teil) => TEILE[t].filter(id => ergebnisse[id]).length;
      api.mausBestenliste.eintragen({
        modus,
        wert: Math.min(wert, GRENZEN[modus]),
        dauer_ms: e ? e.dauerMs : Object.values(ergebnisse).reduce((s, x) => s + (x?.dauerMs ?? 0), 0),
        kontext: e ? e.details[0] ?? "" : ALLE_TEILE.map(t => `Teil ${t}: ${anzahl(t)}/${TEILE[t].length}`).join(" · "),
        hilfe,
      }, zugang).catch(() => {});
    }
  }, [geladen, ergebnisse, hilfe, zugang]);

  // Stand an die Live-Übersicht der Sitzung — gebündelt, nicht bei jedem Klick.
  useMeinStand(zugang, geladen ? { stufen: stand(ergebnisse), hilfe, bestanden } : null);

  const waehleTier = useCallback((id: string) => {
    setAvatar(id);
    try { localStorage.setItem(TIER_SCHLUESSEL, id); } catch {}
  }, []);

  function fertig(stufe: StufeId) {
    return (e: StufenErgebnis) => {
      setErgebnisse(alt => ({ ...alt, [stufe]: besser(alt[stufe], e) }));
      setJeSystem(alt => merkePunkte(alt, stufe, system, handy, e.punkte));
      setPruefung(p => (p && TEILE[p.teil][p.nr] === stufe
        ? { ...p, ergebnisse: { ...p.ergebnisse, [stufe]: besser(p.ergebnisse[stufe], e) } }
        : p));
    };
  }

  // ── Prüfung ────────────────────────────────────────────────────────────
  function starte(teil: Teil) {
    setPruefung({ teil, nr: 0, lauf: Date.now(), ergebnisse: {}, uebersprungen: [], fertig: false });
  }

  function pruefungWeiter() {
    setPruefung(p => {
      if (!p) return p;
      const id = TEILE[p.teil][p.nr];
      const uebersprungen = p.ergebnisse[id] ? p.uebersprungen : [...p.uebersprungen, id];
      const nr = p.nr + 1;
      return { ...p, nr, uebersprungen, fertig: nr >= TEILE[p.teil].length };
    });
  }

  const pruefungBestanden = !!pruefung?.fertig
    && pruefung.uebersprungen.length === 0 && teilBestanden(pruefung.ergebnisse, pruefung.teil);

  // Abschluss genau einmal je Lauf: Stempel merken, Hauspunkte anfragen.
  useEffect(() => {
    if (!pruefung?.fertig || abgeschlossen.current === pruefung.lauf) return;
    abgeschlossen.current = pruefung.lauf;
    if (!pruefungBestanden) return;
    const { teil, lauf, ergebnisse: pe } = pruefung;
    setBestanden(b => (b.includes(teil) ? b : [...b, teil]));
    if (!konto) { setPruefung(p => (p && p.lauf === lauf ? { ...p, antwort: null } : p)); return; }
    api.maus.pruefung({ teil, stufen: stand(pe), hilfe, code: zugang?.code ?? null })
      .then(antwort => setPruefung(p => (p && p.lauf === lauf ? { ...p, antwort } : p)))
      .catch(() => setPruefung(p => (p && p.lauf === lauf ? { ...p, antwort: null, fehler: true } : p)));
  }, [pruefung, pruefungBestanden, konto, hilfe, zugang?.code]);

  function zurUrkunde(teil: Teil) {
    setPruefung(null);
    setReiter(SPEICHERN[teil]);
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  const sichtbar = REITER.filter(r => r.id !== "uebersicht" || verwaltung);
  const weiter = () => {
    if (festerReiter) return;
    const nr = sichtbar.findIndex(r => r.id === reiter);
    setReiter(sichtbar[Math.min(nr + 1, sichtbar.length - 1)].id);
  };
  const tier = avatar ?? "cat";

  function stufe(id: StufeId, key: string, onWeiter: () => void) {
    // `key` gehört direkt ans Element, nicht in gespreizte Props (React warnt sonst).
    const p = { onFertig: fertig(id), onWeiter };
    switch (id) {
      case "klick": return <Klickspiel key={key} {...p} art="klick" />;
      case "doppelklick": return <Klickspiel key={key} {...p} art="doppelklick" />;
      case "rechtsklick": return <StufeRechtsklick key={key} {...p} avatar={avatar} onAvatar={waehleTier} />;
      case "ziehen": return <StufeZiehen key={key} {...p} avatar={tier} />;
      case "markieren": return <StufeMarkieren key={key} {...p} avatar={tier} />;
      case "kopieren": return <StufeKopieren key={key} {...p} avatar={tier} />;
      case "scrollen": return <StufeScrollen key={key} {...p} avatar={tier} />;
      case "tastatur": return <StufeTastatur key={key} {...p} avatar={tier} />;
      case "explorer": return <StufeExplorer key={key} {...p} avatar={tier} />;
      case "fenster": return <StufeFenster key={key} {...p} avatar={tier} />;
      case "datei": return <StufeDatei key={key} {...p} avatar={tier} />;
      case "screenshot": return <StufeScreenshot key={key} {...p} avatar={tier} />;
      case "suche": return <StufeSuche key={key} {...p} avatar={tier} />;
      case "apps": return <StufeApps key={key} {...p} avatar={tier} />;
      case "aussehen": return <StufeAussehen key={key} {...p} avatar={tier} />;
      case "bedienhilfe": return <StufeBedienhilfe key={key} {...p} avatar={tier} />;
      case "taskleiste": return <StufeTaskleiste key={key} {...p} avatar={tier} />;
      case "profil": return <StufeProfil key={key} {...p} avatar={tier} />;
      case "handy": return <StufeHandy key={key} {...p} avatar={tier} />;
      case "appstore": return <StufeAppStore key={key} {...p} avatar={tier} />;
      case "berechtigungen": return <StufeBerechtigungen key={key} {...p} avatar={tier} />;
      case "privatsphaere": return <StufePrivatsphaere key={key} {...p} avatar={tier} />;
      case "risiken": return <StufeRisiken key={key} {...p} avatar={tier} />;
    }
  }

  function reiterKnopf(r: (typeof REITER)[number]) {
    const n = r.teil && !r.id.startsWith("speichern")
      ? sterne(r.id as StufeId, punkteAuf(jeSystem, r.id as StufeId, system, handy))
      : 0;
    const aktiv = reiter === r.id;
    return (
      <button
        key={r.id}
        role="tab"
        aria-selected={aktiv}
        onClick={() => setReiter(r.id)}
        className={
          "text-sm rounded-lg px-3 py-1.5 border transition-colors " +
          (aktiv ? "border-accent text-accent font-bold" : "border-line hover:border-accent")
        }
      >
        {r.icon} {r.label}
        {n > 0 && <span className="ml-1 text-amber-500 tracking-tighter" aria-label={`${n} Sterne`}>{"★".repeat(n)}</span>}
      </button>
    );
  }

  // ── Anzeige ────────────────────────────────────────────────────────────
  const aktuellerTeil = pruefung ? pruefung.teil : REITER.find(r => r.id === reiter)?.teil ?? 0;
  const imTeil4 = aktuellerTeil === 4;
  // Der Hinweis zum fremden System gilt nur am Computer (Teil 1–3).
  const fremd = aktuellerTeil !== 0 && !imTeil4 ? hinweisFremd(system, echt) : null;
  let inhalt: ReactNode;
  if (pruefung && !pruefung.fertig) {
    const id = TEILE[pruefung.teil][pruefung.nr];
    inhalt = stufe(id, `pruefung-${pruefung.lauf}-${id}-${system}-${handy}`, pruefungWeiter);
  } else if (pruefung?.fertig) {
    inhalt = (
      <PruefungsErgebnis
        pruefung={pruefung}
        bestanden={pruefungBestanden}
        konto={konto}
        onUrkunde={() => zurUrkunde(pruefung.teil)}
        onNochmal={() => starte(pruefung.teil)}
        onZurueck={() => setPruefung(null)}
      />
    );
  } else if (reiter.startsWith("speichern")) {
    const teil = Number(reiter.slice(-1)) as Teil;
    inhalt = (
      <StufeSpeichern
        key={reiter}
        teil={teil}
        bestanden={bestanden.includes(teil)}
        avatar={tier}
        name={name}
        ergebnisse={ergebnisse}
        onWeiter={weiter}
      />
    );
  } else if (reiter === "bestenliste") {
    inhalt = <MausBestenliste zugang={zugang} sitzungCode={sitzungCode} klasse={klasse} />;
  } else if (reiter === "uebersicht") {
    inhalt = verwaltung ? <MausUebersicht /> : null;
  } else {
    // Der Schlüssel wirft die Stufe beim Wechsel weg: kein Timer läuft im Hintergrund weiter.
    // System und Handy gehören dazu — wer umschaltet, fängt die Stufe im neuen System neu an.
    inhalt = stufe(reiter as StufeId, `${reiter}-${system}-${handy}`, weiter);
  }

  return (
    <MausKontext.Provider value={{ pruefung: !!pruefung && !pruefung.fertig, hilfe, handy, setHandy }}>
    <WindowsKontext.Provider value={{ aussehen, setAussehen, benutzer: benutzernameAus(name), system }}>
      <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-seite mx-auto w-full">
        <MausStile />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <MausBild groesse={30} /> Maus-Führerschein
          </h1>
          <div className="flex-1" />
          <label className="text-sm flex items-center gap-1.5" title="Welcher Computer wird nachgebildet? (Teil 1–3)">
            <span aria-hidden>💻</span>
            <select
              aria-label="Betriebssystem"
              data-testid="system-wahl"
              value={system}
              onChange={e => setSystem(e.target.value as Betriebssystem)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-sm font-bold"
            >
              {BETRIEBSSYSTEME.map(b => <option key={b} value={b}>{SYSTEME[b].icon} {SYSTEME[b].name}</option>)}
            </select>
          </label>
          <label className="text-sm flex items-center gap-1.5" title="Welches Handy? (Teil 4)">
            <span aria-hidden>📱</span>
            <select
              aria-label="Handy"
              data-testid="handy-wahl"
              value={handy}
              onChange={e => setHandy(e.target.value as HandySystem)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-sm font-bold"
            >
              <option value="android">🤖 Android</option>
              <option value="ios">🍎 iPhone (iOS)</option>
            </select>
          </label>
          <label className="text-xs flex items-center gap-1.5 cursor-pointer text-muted" title="Größere Ziele und mehr Zeit">
            <input type="checkbox" checked={hilfe} onChange={e => setHilfe(e.target.checked)} />
            🤝 Hilfsmodus
          </label>
          <span className="rounded-full bg-surface-hover px-3 py-1 text-sm font-black tabular-nums" title="Punkte aller Stufen">
            ⭐ {gesamt(ergebnisse).toLocaleString("de-DE")}
          </span>
          {action}
        </div>

        {fremd && (
          <div className="rounded-xl border border-line bg-surface px-4 py-2 text-sm" data-testid="system-hinweis">
            {SYSTEME[system].icon} {mitTasten(fremd)}
          </div>
        )}

        {nurTouch && !imTeil4 && (
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            🖱️ Dieses Training ist für die <b>Maus</b> gemacht. Rechtsklick, Doppelklick und Markieren gehen auf einem Tablet anders — nimm am besten einen Computer.
          </div>
        )}

        {pruefung ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-accent bg-surface px-4 py-3" data-testid="pruefung">
            <span className="text-2xl">🎓</span>
            <div className="flex-1">
              <div className="font-black">Prüfung Teil {pruefung.teil}</div>
              <div className="text-xs text-muted">
                {pruefung.fertig
                  ? "Fertig!"
                  : `Stufe ${pruefung.nr + 1} von ${TEILE[pruefung.teil].length} · ohne Vorführung · nicht überspringen!`}
              </div>
            </div>
            {!pruefung.fertig && (
              <button onClick={() => setPruefung(null)} className="text-sm rounded-lg px-3 py-1.5 border border-line hover:border-accent">
                Prüfung abbrechen
              </button>
            )}
          </div>
        ) : festerReiter ? null : (
          <div role="tablist" aria-label="Stufe" className="flex flex-col gap-2">
            {ALLE_TEILE.map(t => (
              <div key={t} className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-muted w-12">Teil {t}</span>
                {REITER.filter(r => r.teil === t).map(reiterKnopf)}
                <button
                  onClick={() => starte(t)}
                  className="text-sm rounded-lg px-3 py-1.5 border-2 border-dashed border-accent text-accent font-bold hover:bg-surface-hover"
                >
                  🎓 Prüfung{bestanden.includes(t) && " ✅"}
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12" />
              {sichtbar.filter(r => r.teil === 0).map(reiterKnopf)}
            </div>
          </div>
        )}

        {inhalt}
      </div>
    </WindowsKontext.Provider>
    </MausKontext.Provider>
  );
}

function PruefungsErgebnis({
  pruefung, bestanden, konto, onUrkunde, onNochmal, onZurueck,
}: {
  pruefung: Pruefung;
  bestanden: boolean;
  konto?: { typ: "student" | "teacher" };
  onUrkunde: () => void;
  onNochmal: () => void;
  onZurueck: () => void;
}) {
  const { teil, antwort, fehler } = pruefung;

  let punkteText: ReactNode = null;
  if (bestanden) {
    if (!konto) punkteText = "Mit deinem Schülerkonto gäbe es dafür Hauspunkte.";
    else if (konto.typ === "teacher") punkteText = null;
    else if (antwort === undefined) punkteText = "Hauspunkte werden eingetragen …";
    else if (fehler || antwort === null) punkteText = "Die Hauspunkte ließen sich gerade nicht eintragen.";
    else if (antwort.punkte > 0) punkteText = <b>+{antwort.punkte} Hauspunkte für {antwort.haus ? `Haus ${antwort.haus}` : "deine Klasse"}! 🏆</b>;
    else if (antwort.schon_vergeben) punkteText = "Die Hauspunkte für diesen Teil hast du schon bekommen.";
  }

  return (
    <div className="card p-8 flex flex-col items-center gap-4 text-center" data-testid="pruefungsergebnis">
      <div className="text-6xl">{bestanden ? "🎓" : "💪"}</div>
      <h2 className="text-2xl font-black">
        {bestanden ? `Prüfung Teil ${teil} bestanden!` : "Noch nicht bestanden"}
      </h2>
      {!bestanden && (
        <p className="text-sm max-w-md">
          Übersprungen: {pruefung.uebersprungen.map(id => NAMEN[id]).join(", ")}. Übe diese Stufen noch einmal — dann klappt es beim nächsten Versuch.
        </p>
      )}
      {punkteText && <p className="text-base">{punkteText}</p>}
      <ul className="flex flex-wrap justify-center gap-2 text-sm">
        {TEILE[teil].map(id => {
          const e = pruefung.ergebnisse[id];
          const n = e ? sterne(id, e.punkte) : 0;
          return (
            <li key={id} className="rounded-lg border border-line px-3 py-1.5">
              {NAMEN[id]} <span className="text-amber-500">{n ? "★".repeat(n) : "–"}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2 justify-center">
        {bestanden ? (
          <button onClick={onUrkunde} className="btn-primary px-4 py-2">
            💾 Zur Urkunde
          </button>
        ) : (
          <button onClick={onNochmal} className="btn-primary px-4 py-2">
            ↺ Nochmal versuchen
          </button>
        )}
        <button onClick={onZurueck} className="rounded-lg px-4 py-2 border border-line hover:border-accent">
          Zurück zum Üben
        </button>
      </div>
    </div>
  );
}
