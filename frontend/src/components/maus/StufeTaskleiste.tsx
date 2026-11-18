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
import { Hinweiszeile, useAufgabenStufe } from "./aufgabenStufe";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { Kontextmenue, type Eintrag } from "./Kontextmenue";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { ausrichtungName, useSystemText } from "./systemText";
import { appName, fuerSystem } from "@/lib/maus/system";
import { FensterKnoepfe } from "./windows/FensterSymbol";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { Einstellungen } from "./windows/Einstellungen";
import { Startmenue } from "./windows/Startmenue";
import { akzentFarbe, type AppId, type Aussehen, type EinstellungId, type Treffer } from "@/lib/maus/windows";
import {
  gemischteReihenfolge, istNachNameSortiert, leistenAenderung, nachNameSortiert,
  startAngeheftet, zielAnheften, zielAusrichtung, zielLoesen,
} from "@/lib/maus/taskleiste";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";

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
  const { aussehen, setAussehen, benutzer, system } = useWindows();
  const { t, tt } = useSystemText();

  // Bei Ubuntu/macOS zuerst die Leiste auf Apps dieses Systems übertragen (Word → Writer, Edge fällt weg),
  // damit jedes Ziel auch wirklich im Dock zu sehen ist.
  const startAussehen = useRef<Aussehen>(system === "windows" ? aussehen
    : { ...aussehen, taskleiste: fuerSystem(aussehen.taskleiste, system), desktop: fuerSystem(aussehen.desktop, system) });
  useEffect(() => {
    if (system !== "windows") setAussehen(a => ({ ...a, taskleiste: startAussehen.current.taskleiste, desktop: startAussehen.current.desktop }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const name = (id: AppId) => appName(id, system);
  const ausr = (a: "mitte" | "links") => ausrichtungName(a, system);
  // Sind wirklich schon alle Apps angeheftet, wird Paint zu Beginn gelöst.
  const zielAn = useRef<AppId>(zielAnheften(startAussehen.current, system) ?? "paint");
  const zielLos = useRef<AppId>(zielLoesen(startAussehen.current) ?? "word");
  const zielAusr = useRef(zielAusrichtung(startAussehen.current));

  const { schritt, setFehler, hinweis, setHinweis, wechselt, fertig, weiterMit, punkte } = useAufgabenStufe("taskleiste", ANZAHL_AUFGABEN, onFertig);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [startOffen, setStartOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [seite, setSeite] = useState<EinstellungId>("taskleiste");
  const [menue, setMenue] = useState<Menue | null>(null);
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
      if (dazu.includes(zielAn.current)) weiterMit(true, `Angeheftet — ${name(zielAn.current)} wartet jetzt unten auf dich!`);
      else falsch(`Das war nicht ${name(zielAn.current)}. Such genau diese App.`);
    } else if (schritt === 1) {
      if (weg.includes(zielLos.current)) weiterMit(true, `Gelöst — ${name(zielLos.current)} ist weg aus der Taskleiste.`);
      else falsch(`Das war nicht ${name(zielLos.current)}. Lös genau diese App.`);
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
    else falsch(`Gesucht ist »${ausr(zielAusr.current)}«.`);
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
      ? { text: t("Von Taskleiste lösen"), aus: fest, onWahl: () => leisteSetzen(aussehen.taskleiste.filter(a => a !== id)) }
      : { text: t("An Taskleiste anheften"), onWahl: () => leisteSetzen([...aussehen.taskleiste, id]) };
    if (m.art === "leiste") {
      return [{ text: name(id), aus: true }, "trenner", umschalten, { text: "Fenster schließen", aus: true }];
    }
    return [{ text: "Öffnen", aus: true }, umschalten, { text: "Von Start lösen", aus: true }, { text: "Deinstallieren", aus: true }];
  }

  const aufgabenTexte = [
    <>Hefte <b>»{name(zielAn.current)}«</b> an die Taskleiste.
      <span data-zusatz className="block text-xs text-muted">Tipp: Start öffnen, dann Rechtsklick auf die App.</span></>,
    <>Löse <b>»{name(zielLos.current)}«</b> von der Taskleiste.
      <span data-zusatz className="block text-xs text-muted">Tipp: Rechtsklick auf das Symbol unten in der Taskleiste.</span></>,
    <>Stell die Taskleiste auf <b>»{ausr(zielAusr.current)}«</b>.
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
        { text: `Rechtsklick auf ${name(id)}.`, zu: imRahmen(`[data-start-app="${id}"]`), taste: "rechts", aktion: () => {
          const o = mitte(rahmenRef.current?.querySelector(`[data-start-app="${id}"]`) ?? null);
          if (o) setMenue({ art: "start", id, x: o.x, y: o.y });
        } },
        { text: "Klicke auf »An Taskleiste anheften«.", zu: () => mitte(menuePunkt(t("An Taskleiste anheften"))), taste: "links" },
      );
    } else if (schritt === 1) {
      const id = zielLos.current;
      schritte.push(
        { text: `Rechtsklick auf ${name(id)} unten in der Taskleiste.`, zu: imRahmen(`[data-taskleiste="${id}"]`), taste: "rechts", aktion: () => {
          setStartOffen(false);
          const o = mitte(rahmenRef.current?.querySelector(`[data-taskleiste="${id}"]`) ?? null);
          if (o) setMenue({ art: "leiste", id, x: o.x, y: o.y });
        } },
        { text: "Klicke auf »Von Taskleiste lösen«.", zu: () => mitte(menuePunkt(t("Von Taskleiste lösen"))), taste: "links" },
      );
    } else if (schritt === 2) {
      schritte.push(
        { text: "Öffne die Einstellungen in der Taskleiste.", zu: imRahmen('[data-taskleiste="einstellungen"]'), taste: "links", aktion: () => { setStartOffen(false); setFensterOffen(true); setSeite("taskleiste"); } },
        { text: `Unter »Ausrichtung« auf »${ausr(zielAusr.current)}« klicken.`, zu: () => mitte(einstellungenRef.current?.querySelector(`[data-ausrichtung="${zielAusr.current}"]`) ?? null), taste: "links" },
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
    demo.abspielen(schritte.map(x => ({ ...x, text: t(x.text) })));
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel={t("📌 Teil 3 · Taskleiste & Start")}
        auftrag={tt(fertig ? <>Super — Taskleiste und Desktop sind jetzt so, wie du sie willst!</> : aufgabenTexte[schritt])}
        punkte={punkte()}
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

      <Hinweiszeile hinweis={hinweis && { ...hinweis, text: t(hinweis.text) }} />

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
            onApp={id => startTreffer({ art: "app", id, name: name(id) })}
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
              <span className="text-sm font-bold flex-1" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>{t("Einstellungen")}</span>
              <span className={system === "macos" ? "order-first" : ""}><FensterKnoepfe onSchliessen={() => setFensterOffen(false)} groesse={24} symbol={11} /></span>
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

      {menue && <Kontextmenue x={menue.x} y={menue.y} system={system} eintraege={menueEintraege(menue)} onZu={() => setMenue(null)} />}

      <DemoBuehne demo={demo} />
    </div>
  );
}
