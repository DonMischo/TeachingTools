"use client";
/**
 * Stufe »Taskleiste & Start«: eine App anheften, eine lösen, die Taskleiste
 * nach links oder in die Mitte stellen und den Desktop nach Namen sortieren.
 *
 * Die Ziele richten sich nach dem Aussehen zu Beginn der Stufe — jede Aufgabe
 * verlangt eine echte Änderung. Die Änderungen bleiben (WindowsKontext), so
 * wie sie auch am echten Rechner bleiben.
 */
import { useEffect, useRef, useState } from "react";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { Kontextmenue, type Eintrag } from "./Kontextmenue";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { Einstellungen } from "./windows/Einstellungen";
import { Startmenue } from "./windows/Startmenue";
import { APPS, akzentFarbe, type AppId, type Aussehen, type EinstellungId, type Treffer } from "@/lib/maus/windows";
import {
  gemischteReihenfolge, istNachNameSortiert, leistenAenderung, nachNameSortiert,
  startAngeheftet, zielAnheften, zielAusrichtung, zielLoesen,
} from "@/lib/maus/taskleiste";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";

const ANZAHL_AUFGABEN = 4;
const AUFGABEN = ["App anheften", "App lösen", "Taskleiste ausrichten", "Desktop sortieren"];
/** Diese beiden bleiben in der Taskleiste — sonst fände das Kind die Einstellungen nicht mehr. */
const FEST_ANGEHEFTET: AppId[] = ["explorer", "einstellungen"];

type Menue = { art: "start" | "leiste"; id: AppId; x: number; y: number } | { art: "desktop"; x: number; y: number };

function menuePunkt(text: string): Element | null {
  return Array.from(document.querySelectorAll('[role="menuitem"]')).find(b => b.textContent?.includes(text)) ?? null;
}

export default function StufeTaskleiste({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, setAussehen, benutzer } = useWindows();

  const start = useRef(performance.now());
  const startAussehen = useRef<Aussehen>(aussehen);
  // Sind wirklich schon alle Apps angeheftet, wird Paint zu Beginn gelöst.
  const zielAn = useRef<AppId>(zielAnheften(startAussehen.current) ?? "paint");
  const zielLos = useRef<AppId>(zielLoesen(startAussehen.current) ?? "word");
  const zielAusr = useRef(zielAusrichtung(startAussehen.current));

  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState(0);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [startOffen, setStartOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [seite, setSeite] = useState<EinstellungId>("taskleiste");
  const [menue, setMenue] = useState<Menue | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const gemeldet = useRef(false);
  const wechselt = useRef(false);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const einstellungenRef = useRef<HTMLDivElement>(null);

  // Vorbereitung: etwas zum Sortieren und eine App, die sich anheften lässt.
  useEffect(() => {
    const s = startAussehen.current;
    const desktopMischen = s.desktop.length > 1 && istNachNameSortiert(s.desktop);
    const zielSchonDa = s.taskleiste.includes(zielAn.current);
    if (!desktopMischen && !zielSchonDa) return;
    setAussehen(a => ({
      ...a,
      desktop: desktopMischen ? gemischteReihenfolge(s.desktop) : a.desktop,
      taskleiste: zielSchonDa ? a.taskleiste.filter(id => id !== zielAn.current) : a.taskleiste,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vorDemo = useRef<{ aussehen: Aussehen; fensterOffen: boolean; startOffen: boolean; seite: EinstellungId } | null>(null);
  const demo = useDemo(() => {
    if (!vorDemo.current) return;
    setAussehen(vorDemo.current.aussehen);
    setFensterOffen(vorDemo.current.fensterOffen);
    setStartOffen(vorDemo.current.startOffen);
    setSeite(vorDemo.current.seite);
    setMenue(null);
    vorDemo.current = null;
  });

  const fertig = schritt >= ANZAHL_AUFGABEN;

  useEffect(() => {
    if (fertig && !gemeldet.current) {
      gemeldet.current = true;
      const dauerMs = Math.round(performance.now() - start.current);
      const { punkte, details } = wertung({ stufe: "taskleiste", geloest: ANZAHL_AUFGABEN, anzahl: ANZAHL_AUFGABEN, dauerMs, fehler });
      onFertig({ punkte, dauerMs, details });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertig]);

  function weiterMit(gut: boolean, text: string) {
    if (wechselt.current) return;
    setHinweis({ text, gut });
    if (!gut) return;
    wechselt.current = true;
    setTimeout(() => { setHinweis(null); setSchritt(s => s + 1); wechselt.current = false; }, 700);
  }

  function falsch(text: string) {
    setFehler(f => f + 1);
    weiterMit(false, text);
  }

  /** Jede Änderung an der Taskleiste — ob per Rechtsklick oder Schalter — landet hier. */
  function leistePruefen(alt: AppId[], neu: AppId[]) {
    if (demo.aktiv || fertig || wechselt.current) return;
    const { dazu, weg } = leistenAenderung(alt, neu);
    if (dazu.length === 0 && weg.length === 0) return;
    if (schritt === 0) {
      if (dazu.includes(zielAn.current)) weiterMit(true, `Angeheftet — ${APPS[zielAn.current].name} wartet jetzt unten auf dich!`);
      else falsch(`Das war nicht ${APPS[zielAn.current].name}. Such genau diese App.`);
    } else if (schritt === 1) {
      if (weg.includes(zielLos.current)) weiterMit(true, `Gelöst — ${APPS[zielLos.current].name} ist weg aus der Taskleiste.`);
      else falsch(`Das war nicht ${APPS[zielLos.current].name}. Lös genau diese App.`);
    }
  }

  function leisteSetzen(neu: AppId[]) {
    const alt = aussehen.taskleiste;
    setAussehen(a => ({ ...a, taskleiste: neu }));
    leistePruefen(alt, neu);
  }

  function aufAuswahl(feld: keyof Aussehen, wert: unknown) {
    if (feld === "taskleiste") { leistePruefen(aussehen.taskleiste, wert as AppId[]); return; }
    if (demo.aktiv || fertig || wechselt.current || feld !== "ausrichtung" || schritt !== 2) return;
    if (wert === zielAusr.current) weiterMit(true, "Genau — die Taskleiste sitzt jetzt anders!");
    else falsch(`Gesucht ist »${zielAusr.current === "links" ? "Links" : "Mitte"}«.`);
  }

  function einstellungenOeffnen(ziel: EinstellungId = "taskleiste") {
    if (demo.aktiv) return;
    setFensterOffen(true);
    setSeite(ziel);
    setStartOffen(false);
  }

  function desktopSortieren() {
    if (demo.aktiv) return;
    setAussehen(a => ({ ...a, desktop: nachNameSortiert(a.desktop) }));
    if (schritt === 3 && !fertig) weiterMit(true, "Aufgeräumt — alles steht jetzt nach dem Alphabet!");
  }

  function startTreffer(t: Treffer) {
    if (t.art === "einstellung") einstellungenOeffnen(t.id);
    else if (t.art === "app" && t.id === "einstellungen") einstellungenOeffnen();
    else setHinweis({ text: "Heute öffnen wir keine Apps — klick sie mit der rechten Maustaste an.", gut: false });
  }

  function menueEintraege(m: Menue): (Eintrag | "trenner")[] {
    if (m.art === "desktop") {
      return [
        { text: "Ansicht", aus: true },
        { text: "Sortieren nach: Name", onWahl: desktopSortieren },
        { text: "Sortieren nach: Größe", aus: true },
        { text: "Sortieren nach: Änderungsdatum", aus: true },
        { text: "Aktualisieren", aus: true },
        "trenner",
        { text: "Neu", aus: true },
        { text: "Anpassen", aus: true },
      ];
    }
    const id = m.id;
    const angeheftet = aussehen.taskleiste.includes(id);
    const fest = FEST_ANGEHEFTET.includes(id);
    const umschalten: Eintrag = angeheftet
      ? { text: "Von Taskleiste lösen", aus: fest, onWahl: () => leisteSetzen(aussehen.taskleiste.filter(a => a !== id)) }
      : { text: "An Taskleiste anheften", onWahl: () => leisteSetzen([...aussehen.taskleiste, id]) };
    if (m.art === "leiste") {
      return [{ text: APPS[id].name, aus: true }, "trenner", umschalten, { text: "Fenster schließen", aus: true }];
    }
    return [{ text: "Öffnen", aus: true }, umschalten, { text: "Von Start lösen", aus: true }, { text: "Deinstallieren", aus: true }];
  }

  const aufgabenTexte = [
    <>Hefte <b>»{APPS[zielAn.current].name}«</b> an die Taskleiste.
      <span data-zusatz className="block text-xs text-muted">Tipp: Start öffnen, dann Rechtsklick auf die App.</span></>,
    <>Löse <b>»{APPS[zielLos.current].name}«</b> von der Taskleiste.
      <span data-zusatz className="block text-xs text-muted">Tipp: Rechtsklick auf das Symbol unten in der Taskleiste.</span></>,
    <>Stell die Taskleiste auf <b>»{zielAusr.current === "links" ? "Links" : "Mitte"}«</b>.
      <span data-zusatz className="block text-xs text-muted">Tipp: Einstellungen › Taskleiste › Ausrichtung.</span></>,
    <>Räum den Desktop auf: <b>Rechtsklick auf eine freie Stelle → Sortieren nach: Name</b>.</>,
  ];

  // Vorführen zeigt nur — gelöst wird keine Aufgabe, danach steht alles wie vorher.
  function vorfuehren() {
    vorDemo.current = { aussehen, fensterOffen, startOffen, seite };
    setMenue(null);
    const imRahmen = (sel: string) => () => mitte(rahmenRef.current?.querySelector(sel) ?? null);
    const schritte: DemoSchritt[] = [];
    if (schritt === 0) {
      const id = zielAn.current;
      schritte.push(
        { text: "Klicke auf Start.", zu: imRahmen("[data-start]"), taste: "links", aktion: () => { setFensterOffen(false); setSuchText(""); setStartOffen(true); } },
        { text: `Rechtsklick auf ${APPS[id].name}.`, zu: imRahmen(`[data-start-app="${id}"]`), taste: "rechts", aktion: () => {
          const o = mitte(rahmenRef.current?.querySelector(`[data-start-app="${id}"]`) ?? null);
          if (o) setMenue({ art: "start", id, x: o.x, y: o.y });
        } },
        { text: "Klicke auf »An Taskleiste anheften«.", zu: () => mitte(menuePunkt("An Taskleiste anheften")), taste: "links" },
      );
    } else if (schritt === 1) {
      const id = zielLos.current;
      schritte.push(
        { text: `Rechtsklick auf ${APPS[id].name} unten in der Taskleiste.`, zu: imRahmen(`[data-taskleiste="${id}"]`), taste: "rechts", aktion: () => {
          setStartOffen(false);
          const o = mitte(rahmenRef.current?.querySelector(`[data-taskleiste="${id}"]`) ?? null);
          if (o) setMenue({ art: "leiste", id, x: o.x, y: o.y });
        } },
        { text: "Klicke auf »Von Taskleiste lösen«.", zu: () => mitte(menuePunkt("Von Taskleiste lösen")), taste: "links" },
      );
    } else if (schritt === 2) {
      schritte.push(
        { text: "Öffne die Einstellungen in der Taskleiste.", zu: imRahmen('[data-taskleiste="einstellungen"]'), taste: "links", aktion: () => { setStartOffen(false); setFensterOffen(true); setSeite("taskleiste"); } },
        { text: `Unter »Ausrichtung« auf »${zielAusr.current === "links" ? "Links" : "Mitte"}« klicken.`, zu: () => mitte(einstellungenRef.current?.querySelector(`[data-ausrichtung="${zielAusr.current}"]`) ?? null), taste: "links" },
      );
    } else if (schritt === 3) {
      const frei = () => {
        const r = rahmenRef.current?.getBoundingClientRect();
        return r ? { x: r.left + r.width * 0.62, y: r.top + r.height * 0.4 } : null;
      };
      schritte.push(
        { text: "Rechtsklick auf eine freie Stelle des Desktops.", zu: frei, taste: "rechts", aktion: () => {
          setStartOffen(false);
          setFensterOffen(false);
          const o = frei();
          if (o) setMenue({ art: "desktop", x: o.x, y: o.y });
        } },
        { text: "Klicke auf »Sortieren nach: Name«.", zu: () => mitte(menuePunkt("Sortieren nach: Name")), taste: "links" },
      );
    }
    schritte.push({ text: "Jetzt bist du dran!", taste: null });
    demo.abspielen(schritte);
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="📌 Teil 3 · Taskleiste & Start"
        auftrag={fertig ? <>Super — Taskleiste und Desktop sind jetzt so, wie du sie willst!</> : aufgabenTexte[schritt]}
        punkte={wertung({
          stufe: "taskleiste", geloest: Math.min(schritt, ANZAHL_AUFGABEN), anzahl: ANZAHL_AUFGABEN,
          dauerMs: performance.now() - start.current, fehler,
        }).punkte}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {AUFGABEN.map((a, i) => (
          <li key={a} className={i === schritt ? "font-bold" : i < schritt ? "text-muted" : ""}>
            {i < schritt ? "✅" : i === schritt ? "👉" : "⬜"} {a}
          </li>
        ))}
      </ul>

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      <WindowsDesktop
        aussehen={aussehen}
        offen={fensterOffen ? ["einstellungen"] : []}
        aktiv={fensterOffen ? "einstellungen" : null}
        onSymbol={id => { if (id === "einstellungen") einstellungenOeffnen(); }}
        onTaskleiste={id => {
          if (id === "einstellungen") (fensterOffen ? setFensterOffen(false) : einstellungenOeffnen());
        }}
        onTaskleisteKontext={(id, x, y) => { if (!demo.aktiv) { setStartOffen(false); setMenue({ art: "leiste", id, x, y }); } }}
        onDesktopKontext={(x, y) => { if (!demo.aktiv) { setStartOffen(false); setMenue({ art: "desktop", x, y }); } }}
        onStart={() => { setSuchText(""); setStartOffen(o => !o); }}
        onSuche={() => setStartOffen(true)}
        startOffen={startOffen}
        rahmenRef={rahmenRef}
        overlay={startOffen && (
          <Startmenue
            suchText={suchText}
            onSuchText={setSuchText}
            angeheftet={startAngeheftet(zielAn.current)}
            onApp={id => startTreffer({ art: "app", id, name: APPS[id].name })}
            onTreffer={startTreffer}
            onAppKontext={(id, x, y) => { if (!demo.aktiv) setMenue({ art: "start", id, x, y }); }}
            benutzer={benutzer}
            profilTier={aussehen.profilTier}
            dunkel={aussehen.dunkel}
            akzent={akzentFarbe(aussehen.akzent)}
            hilfe={hilfe}
            onSchliessen={() => setStartOffen(false)}
          />
        )}
      >
        {fensterOffen && (
          <div
            ref={einstellungenRef}
            className="pointer-events-auto absolute rounded-xl shadow-xl overflow-hidden flex flex-col"
            style={{ left: "8%", top: "6%", width: "84%", height: "80%", background: aussehen.dunkel ? "#202020" : "#f3f3f3" }}
          >
            <div className="flex items-center gap-2 px-2 shrink-0" style={{ height: 32, background: aussehen.dunkel ? "#2b2b2b" : "#ffffff", borderBottom: `1px solid ${aussehen.dunkel ? "#ffffff1a" : "#0000001a"}` }}>
              <AppSymbol id="einstellungen" groesse={18} titel={false} />
              <span className="text-sm font-bold flex-1" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>Einstellungen</span>
              <button type="button" onClick={() => setFensterOffen(false)} aria-label="Schließen" className="rounded-sm hover:bg-red-500 hover:text-white w-6 h-6" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>✕</button>
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

      {menue && <Kontextmenue x={menue.x} y={menue.y} eintraege={menueEintraege(menue)} onZu={() => setMenue(null)} />}

      <DemoBuehne demo={demo} />
    </div>
  );
}
