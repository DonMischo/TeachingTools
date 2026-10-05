"use client";
/**
 * Stufe »Hintergrund & Farben«: Einstellungen öffnen, Hintergrund, Modus und
 * Akzentfarbe ändern — alles bezogen auf das Aussehen, das beim Start der
 * Stufe galt, damit jede Aufgabe eine echte Änderung verlangt.
 */
import { useEffect, useRef, useState } from "react";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { Einstellungen } from "./windows/Einstellungen";
import { AKZENTE, HINTERGRUENDE, type Aussehen, type EinstellungId } from "@/lib/maus/windows";
import { gegenModus, zielAkzent, zielHintergrund } from "@/lib/maus/einstellungen";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";

const ANZAHL_AUFGABEN = 4;

export default function StufeAussehen({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, setAussehen, benutzer } = useWindows();

  const start = useRef(performance.now());
  const startAussehen = useRef<Aussehen>(aussehen);
  const zielHG = useRef(zielHintergrund(startAussehen.current));
  const zielDunkel = useRef(gegenModus(startAussehen.current));
  const zielAK = useRef(zielAkzent(startAussehen.current));

  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState(0);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [seite, setSeite] = useState<EinstellungId>("hintergrund");
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const gemeldet = useRef(false);
  // Zwischen »richtig« und dem nächsten Schritt zählt kein zweiter Treffer —
  // sonst übersprängen zwei schnelle Klicks eine Aufgabe.
  const wechselt = useRef(false);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const einstellungenRef = useRef<HTMLDivElement>(null);

  // Nach der Vorführung steht alles wieder so da wie vorher.
  const vorDemo = useRef<{ aussehen: Aussehen; fensterOffen: boolean; seite: EinstellungId } | null>(null);
  const demo = useDemo(() => {
    if (vorDemo.current) {
      setAussehen(vorDemo.current.aussehen);
      setFensterOffen(vorDemo.current.fensterOffen);
      setSeite(vorDemo.current.seite);
      vorDemo.current = null;
    }
  });

  const fertig = schritt >= ANZAHL_AUFGABEN;

  useEffect(() => {
    if (fertig && !gemeldet.current) {
      gemeldet.current = true;
      const dauerMs = Math.round(performance.now() - start.current);
      const { punkte, details } = wertung({ stufe: "aussehen", geloest: ANZAHL_AUFGABEN, anzahl: ANZAHL_AUFGABEN, dauerMs, fehler });
      onFertig({ punkte, dauerMs, details });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertig]);

  function oeffnen() {
    if (demo.aktiv) return;
    setFensterOffen(true);
    setSeite("hintergrund");
    if (schritt === 0) setSchritt(1);
  }

  function schliessen() {
    setFensterOffen(false);
  }

  function weiterMit(gut: boolean, text: string) {
    if (wechselt.current) return;
    setHinweis({ text, gut });
    if (!gut) return;
    wechselt.current = true;
    setTimeout(() => { setHinweis(null); setSchritt(s => s + 1); wechselt.current = false; }, 700);
  }

  function aufAuswahl(feld: keyof Aussehen, wert: unknown) {
    if (demo.aktiv || fertig || wechselt.current) return;
    if (schritt === 1 && feld === "hintergrund") {
      if (wert === zielHG.current) weiterMit(true, "Toll — genau der richtige Hintergrund!");
      else { setFehler(f => f + 1); weiterMit(false, "Das ist noch nicht der gesuchte Hintergrund."); }
    } else if (schritt === 2 && feld === "dunkel") {
      if (wert === zielDunkel.current) weiterMit(true, "Genau der richtige Modus!");
      else { setFehler(f => f + 1); weiterMit(false, "Das ist noch nicht der gesuchte Modus."); }
    } else if (schritt === 3 && feld === "akzent") {
      if (wert === zielAK.current) weiterMit(true, "Super — die richtige Akzentfarbe!");
      else { setFehler(f => f + 1); weiterMit(false, "Das ist noch nicht die gesuchte Farbe."); }
    }
  }

  const desktopSymbole = aussehen.taskleiste.includes("einstellungen")
    ? aussehen.desktop
    : [...aussehen.desktop.filter(id => id !== "einstellungen"), "einstellungen" as const];

  const aufgabenTexte = [
    "Öffne die Einstellungen.",
    <>Stell den Hintergrund <b>»{HINTERGRUND_NAME(zielHG.current)}«</b> ein.</>,
    <>Schalte auf den <b>{zielDunkel.current ? "dunklen" : "hellen"} Modus</b>.</>,
    <>Wähle die Akzentfarbe <b>»{AKZENT_NAME(zielAK.current)}«</b>.</>,
  ];

  // Vorführen zeigt nur — gelöst wird keine Aufgabe, und danach wird alles zurückgestellt.
  function vorfuehren() {
    vorDemo.current = { aussehen, fensterOffen, seite };
    const schritte: DemoSchritt[] = [];
    const inEinstellungen = (sel: string) => () => mitte(einstellungenRef.current?.querySelector(sel) ?? null);
    if (!fensterOffen) {
      schritte.push({
        text: "Klicke auf »Einstellungen« — in der Taskleiste oder auf dem Desktop.",
        zu: () => mitte(rahmenRef.current?.querySelector('[data-taskleiste="einstellungen"]') ?? rahmenRef.current?.querySelector('[data-desktop-symbol="einstellungen"]') ?? null),
        taste: "links",
        aktion: () => { setFensterOffen(true); setSeite("hintergrund"); },
      });
    }
    const aktuelleSeite: EinstellungId = fensterOffen ? seite : "hintergrund";
    const seiteOeffnen = (ziel: EinstellungId, name: string) => {
      if (aktuelleSeite === ziel) return;
      schritte.push({ text: `Öffne links die Seite »${name}«.`, zu: inEinstellungen(`[data-einstellung-nav="${ziel}"]`), taste: "links", aktion: () => setSeite(ziel) });
    };
    if (schritt === 1) {
      seiteOeffnen("hintergrund", "Hintergrund");
      schritte.push({ text: `Klicke auf den Hintergrund »${HINTERGRUND_NAME(zielHG.current)}«.`, zu: inEinstellungen(`[data-hintergrund="${zielHG.current}"]`), taste: "links", aktion: () => setAussehen(a => ({ ...a, hintergrund: zielHG.current })) });
    } else if (schritt === 2) {
      seiteOeffnen("farben", "Farben");
      schritte.push({ text: `Klicke auf »${zielDunkel.current ? "Dunkel" : "Hell"}«.`, zu: inEinstellungen(`[data-modus="${zielDunkel.current ? "dunkel" : "hell"}"]`), taste: "links", aktion: () => setAussehen(a => ({ ...a, dunkel: zielDunkel.current })) });
    } else if (schritt === 3) {
      seiteOeffnen("farben", "Farben");
      schritte.push({ text: `Klicke auf die Akzentfarbe »${AKZENT_NAME(zielAK.current)}«.`, zu: inEinstellungen(`[data-akzent="${zielAK.current}"]`), taste: "links", aktion: () => setAussehen(a => ({ ...a, akzent: zielAK.current })) });
    }
    schritte.push({ text: "Jetzt bist du dran!", taste: null });
    demo.abspielen(schritte);
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🎨 Teil 3 · Hintergrund & Farben"
        auftrag={fertig ? <>Alles geschafft — dein Windows sieht jetzt anders aus!</> : aufgabenTexte[schritt]}
        punkte={wertung({
          stufe: "aussehen", geloest: Math.min(schritt, ANZAHL_AUFGABEN), anzahl: ANZAHL_AUFGABEN,
          dauerMs: performance.now() - start.current, fehler,
        }).punkte}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      <WindowsDesktop
        aussehen={aussehen}
        symbole={desktopSymbole}
        offen={fensterOffen ? ["einstellungen"] : []}
        aktiv={fensterOffen ? "einstellungen" : null}
        onSymbol={id => { if (id === "einstellungen") oeffnen(); }}
        onTaskleiste={id => { if (id === "einstellungen") (fensterOffen ? schliessen() : oeffnen()); }}
        rahmenRef={rahmenRef}
      >
        {fensterOffen && (
          <div
            ref={einstellungenRef}
            className="pointer-events-auto absolute rounded-xl shadow-xl overflow-hidden flex flex-col"
            style={{ left: "8%", top: "6%", width: "84%", height: "82%", background: aussehen.dunkel ? "#202020" : "#f3f3f3" }}
          >
            <div className="flex items-center gap-2 px-2 shrink-0" style={{ height: 32, background: aussehen.dunkel ? "#2b2b2b" : "#ffffff", borderBottom: `1px solid ${aussehen.dunkel ? "#ffffff1a" : "#0000001a"}` }}>
              <AppSymbol id="einstellungen" groesse={18} titel={false} />
              <span className="text-sm font-bold flex-1" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>Einstellungen</span>
              <button type="button" onClick={schliessen} aria-label="Schließen" className="rounded-sm hover:bg-red-500 hover:text-white w-6 h-6" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Einstellungen
                aussehen={aussehen}
                onAussehen={setAussehen}
                seite={seite}
                onSeite={setSeite}
                benutzer={benutzer}
                hilfe={hilfe}
                onAuswahl={aufAuswahl}
              />
            </div>
          </div>
        )}
      </WindowsDesktop>

      <DemoBuehne demo={demo} />
    </div>
  );
}

function HINTERGRUND_NAME(id: string): string {
  return HINTERGRUENDE.find(h => h.id === id)?.name ?? id;
}

function AKZENT_NAME(id: string): string {
  return AKZENTE.find(a => a.id === id)?.name ?? id;
}
