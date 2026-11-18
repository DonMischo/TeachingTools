"use client";
/**
 * Stufe 3.2 »Welche App?« — Aufgaben- und Dateikarten auf die passende App
 * ziehen (oder: Karte anklicken, dann Kachel anklicken — beides geht).
 *
 * Vorweg (Runde 0) die Dateitypen: was die Endung hinter dem Punkt verrät —
 * Dateinamen werden nach Art sortiert (Text, Bild, Musik …). Runde 1 fragt
 * nach einer Tätigkeit (APP_AUFGABEN), Runde 2 nach einer Datei (DATEITYPEN).
 * Mehrere Apps dürfen richtig sein — dann zeigt der Erfolgshinweis die
 * übrigen als »Auch richtig«. Fährt die Maus über eine App, steht da, was sie
 * kann und welche Dateien zu ihr gehören.
 */
import { useRef, useState } from "react";
import { AppSymbol } from "./windows/AppSymbol";
import {
  APP_INFO, AUSWAHL_APPS, DATEI_ARTEN, DATEI_BEISPIELE, alternativen, artVon, endungVon, kartenRichtig, kartenText,
  ziehKarten, type AppKarte, type DateiArtId,
} from "@/lib/maus/apps";
import { APP_AUFGABEN, DATEITYPEN, istRichtig, type AppId } from "@/lib/maus/windows";
import { appName, fuerSystem } from "@/lib/maus/system";
import { useWindows } from "./windows/WindowsKontext";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { Hinweiszeile } from "./aufgabenStufe";

type Hinweis = { text: string; gut: boolean } | null;

/** »Urlaub.jpg« mit hervorgehobener Endung. */
function Dateiname({ name }: { name: string }) {
  const endung = endungVon(name);
  const stamm = endung ? name.slice(0, name.length - endung.length) : name;
  return <span>{stamm}<span className="text-accent font-black">{name.slice(stamm.length)}</span></span>;
}

/** App-Kachel mit Kurzinfo beim Draufzeigen (oder Fokus per Tab). */
function AppKachel({ id, groesse, wackelt, onKlick, onFallen }: {
  id: AppId; groesse: number; wackelt: boolean; onKlick: () => void; onFallen: (e: React.DragEvent) => void;
}) {
  const [offen, setOffen] = useState(false);
  const { system } = useWindows();
  const info = APP_INFO[id];
  return (
    <div className="relative" onMouseEnter={() => setOffen(true)} onMouseLeave={() => setOffen(false)}>
      <button
        type="button"
        data-app-kachel={id}
        onDragOver={e => e.preventDefault()}
        onDrop={onFallen}
        onClick={onKlick}
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        aria-describedby={info ? `app-info-${id}` : undefined}
        className={
          "w-full flex flex-col items-center gap-1 rounded-xl border p-2 border-line hover:border-accent " +
          (wackelt ? "maus-wackeln" : "")
        }
      >
        <AppSymbol id={id} groesse={groesse} titel={false} />
        <span className="text-[11px] font-bold text-center leading-tight">{appName(id, system)}</span>
      </button>
      {info && (
        <div
          id={`app-info-${id}`}
          role="tooltip"
          className={
            "absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 w-56 rounded-xl border border-line bg-surface shadow-xl p-3 text-left pointer-events-none " +
            (offen ? "block" : "hidden")
          }
        >
          <div className="text-sm font-black">{appName(id, system)}</div>
          <div className="text-xs mt-0.5">{info.was}</div>
          <div className="text-xs mt-1.5 text-muted">
            {info.endungen.length
              ? <>Dateien: {info.endungen.map(e => <code key={e} className="font-bold text-accent mr-1">{e}</code>)}</>
              : "Öffnet keine Dateien."}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StufeApps({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { system } = useWindows();
  // Nur Apps dieses Systems: bei Ubuntu z. B. Writer statt Word, am Mac Vorschau statt IrfanView.
  const auswahl = fuerSystem(AUSWAHL_APPS, system);
  const fuerHier = <T extends { richtig: AppId[] }>(l: T[]) => l.map(a => ({ ...a, richtig: fuerSystem(a.richtig, system) })).filter(a => a.richtig.length > 0);
  const anzahl0 = hilfe ? 5 : 8;
  const anzahl1 = hilfe ? 6 : 10;
  const anzahl2 = hilfe ? 5 : 8;

  const [karten1] = useState<AppKarte[]>(() => ziehKarten(fuerHier(APP_AUFGABEN), anzahl1).map(aufgabe => ({ art: "aufgabe" as const, aufgabe })));
  const [karten2] = useState<AppKarte[]>(() => ziehKarten(fuerHier(DATEITYPEN), anzahl2).map(datei => ({ art: "datei" as const, datei })));
  // Runde 0 nimmt aus jeder Art eine Datei, bevor sie mischt — so kommt jede Art einmal dran.
  const [karten0] = useState<string[]>(() => {
    const je = DATEI_ARTEN.map(a => ziehKarten(DATEI_BEISPIELE.filter(n => artVon(n) === a.id), 1)[0]);
    return ziehKarten(je, anzahl0);
  });
  const gesamtAnzahl = karten0.length + karten1.length + karten2.length;

  const [runde, setRunde] = useState<0 | 1 | 2>(0);
  const [erledigt0, setErledigt0] = useState<Set<number>>(new Set());
  const [erledigt1, setErledigt1] = useState<Set<number>>(new Set());
  const [erledigt2, setErledigt2] = useState<Set<number>>(new Set());
  const [gewaehlteKarte, setGewaehlteKarte] = useState<number | null>(null);
  const [wackelId, setWackelId] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const wackelUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useRef(performance.now());
  const fehler = useRef(0);
  const gemeldet = useRef(false);
  const demo = useDemo();

  const karten = runde === 1 ? karten1 : karten2;
  const erledigt = runde === 0 ? erledigt0 : runde === 1 ? erledigt1 : erledigt2;
  const setErledigt = runde === 1 ? setErledigt1 : setErledigt2;
  const offen = (runde === 0 ? karten0 : karten).map((_, i) => i).filter(i => !erledigt.has(i));
  const fertigAlles = erledigt0.size >= karten0.length && erledigt1.size >= karten1.length && erledigt2.size >= karten2.length;
  const geloest = erledigt0.size + erledigt1.size + erledigt2.size;

  function melden(g1: number, g2: number) {
    if (gemeldet.current || erledigt0.size < karten0.length || g1 < karten1.length || g2 < karten2.length) return;
    gemeldet.current = true;
    const { punkte, details } = wertung({
      stufe: "apps",
      geloest: karten0.length + g1 + g2,
      anzahl: gesamtAnzahl,
      dauerMs: Math.round(performance.now() - start.current),
      fehler: fehler.current,
    });
    onFertig({ punkte, dauerMs: Math.round(performance.now() - start.current), details });
  }

  function auswerten(index: number, appId: AppId) {
    if (demo.aktiv) return;
    const karte = karten[index];
    if (istRichtig({ richtig: kartenRichtig(karte) }, appId)) {
      const alt = alternativen({ richtig: kartenRichtig(karte) }, appId).map(id => appName(id, system));
      setHinweis({ text: alt.length > 0 ? `Richtig! Auch richtig: ${alt.join(", ")}` : "Richtig!", gut: true });
      const neu = new Set(erledigt);
      neu.add(index);
      setErledigt(neu);
      setGewaehlteKarte(null);
      const g1 = runde === 1 ? neu.size : erledigt1.size;
      const g2 = runde === 2 ? neu.size : erledigt2.size;
      if (runde === 1 && neu.size >= karten1.length) {
        setTimeout(() => setRunde(2), 400);
      }
      melden(g1, g2);
    } else {
      fehler.current += 1;
      setWackelId(appId);
      if (wackelUhr.current) clearTimeout(wackelUhr.current);
      wackelUhr.current = setTimeout(() => setWackelId(null), 650);
      setHinweis({ text: `Mit ›${appName(appId, system)}‹ geht das nicht so gut — probier eine andere.`, gut: false });
    }
  }

  /** Runde 0: Datei auf eine Art gelegt. */
  function artWahl(index: number, art: DateiArtId) {
    if (demo.aktiv) return;
    const name = karten0[index];
    const richtig = artVon(name);
    if (art === richtig) {
      const a = DATEI_ARTEN.find(x => x.id === art)!;
      setHinweis({ text: `Richtig! ${endungVon(name)} ist ${a.name === "PDF" ? "ein PDF" : `eine ${a.name}-Datei`}.`, gut: true });
      const neu = new Set(erledigt0);
      neu.add(index);
      setErledigt0(neu);
      setGewaehlteKarte(null);
      if (neu.size >= karten0.length) setTimeout(() => setRunde(1), 400);
    } else {
      fehler.current += 1;
      setWackelId(art);
      if (wackelUhr.current) clearTimeout(wackelUhr.current);
      wackelUhr.current = setTimeout(() => setWackelId(null), 650);
      setHinweis({ text: `Schau auf die Endung hinter dem Punkt: ${endungVon(name)}.`, gut: false });
    }
  }

  function aufArtFallen(e: React.DragEvent, art: DateiArtId) {
    e.preventDefault();
    const index = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(index) || !offen.includes(index)) return;
    artWahl(index, art);
  }

  function karteGezogen(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
  }

  function aufKachelFallen(e: React.DragEvent, appId: AppId) {
    e.preventDefault();
    const index = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(index) || !offen.includes(index)) return;
    auswerten(index, appId);
  }

  function kachelKlick(appId: AppId) {
    if (gewaehlteKarte === null) return;
    auswerten(gewaehlteKarte, appId);
  }

  function karteKlick(index: number) {
    setGewaehlteKarte(index === gewaehlteKarte ? null : index);
  }

  function vorfuehren() {
    const index = offen[0];
    if (index === undefined) return;
    if (runde === 0) {
      const art = artVon(karten0[index])!;
      demo.abspielen([
        { text: `Schau auf die Endung hinter dem Punkt: ${endungVon(karten0[index])}.`, zu: () => mitte(document.querySelector(`[data-karte="${index}"]`)) },
        { text: "Linke Taste festhalten …", taste: "halten" },
        { text: `… und auf »${DATEI_ARTEN.find(a => a.id === art)!.name}« ziehen.`, taste: "halten", zu: () => mitte(document.querySelector(`[data-art="${art}"]`)) },
        { text: "Loslassen. Oder: erst die Datei, dann die Art anklicken.", taste: null },
      ]);
      return;
    }
    const karte = karten[index];
    const appId = kartenRichtig(karte)[0];
    // Nur zeigen, nicht lösen: der Zeiger fährt von der Karte zur passenden App.
    const schritte: DemoSchritt[] = [
      { text: `Nimm die Karte »${kartenText(karte)}«.`, zu: () => mitte(document.querySelector(`[data-karte="${index}"]`)) },
      { text: "Linke Taste festhalten …", taste: "halten" },
      { text: `… und auf ${appName(appId, system)} ziehen.`, taste: "halten", zu: () => mitte(document.querySelector(`[data-app-kachel="${appId}"]`)) },
      { text: "Loslassen. Oder: erst die Karte, dann die App anklicken.", taste: null },
    ];
    demo.abspielen(schritte);
  }

  const kachelGroesse = hilfe ? 56 : 40;

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🧰 Teil 3 · Welche App?"
        auftrag={fertigAlles
          ? <>Super, du kennst dich mit den Apps aus!</>
          : runde === 0
            ? <>Erst die <b>Dateitypen</b>: Welche Art von Datei ist das? Ziehe jede Datei auf die passende Art — oder klicke erst die Datei, dann die Art an.
                <span data-zusatz className="text-xs text-muted ml-2">{erledigt0.size} von {karten0.length}</span></>
          : runde === 1
            ? <>Welche App brauchst du dafür? Ziehe die Karte auf die passende App — oder klicke erst die Karte, dann die App an.
                <span data-zusatz className="text-xs text-muted ml-2">{erledigt1.size} von {karten1.length}</span></>
            : <>Welche App öffnet diese Datei?
                <span data-zusatz className="text-xs text-muted ml-2">{erledigt2.size} von {karten2.length}</span></>}
        punkte={wertung({
          stufe: "apps", geloest, anzahl: gesamtAnzahl,
          dauerMs: performance.now() - start.current, fehler: fehler.current,
        }).punkte}
        onDemo={fertigAlles ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertigAlles}
      />

      <Hinweiszeile hinweis={hinweis} />

      {!fertigAlles && runde === 0 && (
        <>
          <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-2xl font-mono">
                <span className="rounded-md bg-surface-hover px-1.5">Urlaub</span>
                <span className="font-black">.</span>
                <span className="rounded-md bg-accent text-accent-fg px-1.5 font-black">jpg</span>
              </div>
              <p className="text-sm flex-1 min-w-64">
                <b>Vor dem Punkt</b> steht der Name — den suchst du dir aus.{" "}
                <b>Hinter dem Punkt</b> steht die <b>Endung</b>: Sie verrät, was für eine Datei das ist.
                Danach entscheidet Windows, mit welcher App sie aufgeht.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DATEI_ARTEN.map(a => (
                <button
                  key={a.id}
                  type="button"
                  data-art={a.id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => aufArtFallen(e, a.id)}
                  onClick={() => { if (gewaehlteKarte !== null) artWahl(gewaehlteKarte, a.id); }}
                  className={
                    "rounded-xl border p-2 text-left border-line hover:border-accent " +
                    (wackelId === a.id ? "maus-wackeln" : "")
                  }
                >
                  <div className="font-black text-sm">{a.icon} {a.name}</div>
                  <div className="text-xs text-muted">{a.erklaerung}</div>
                  <div className="text-xs mt-1">{a.endungen.map(e => <code key={e} className="font-bold text-accent mr-1.5">{e}</code>)}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {offen.map(index => (
              <button
                key={index}
                type="button"
                data-karte={index}
                draggable
                onDragStart={e => karteGezogen(e, index)}
                onClick={() => karteKlick(index)}
                aria-pressed={gewaehlteKarte === index}
                className={
                  "rounded-xl border px-3 py-2 text-sm font-bold font-mono cursor-grab " +
                  (gewaehlteKarte === index ? "border-accent bg-surface-hover" : "border-line hover:border-accent")
                }
              >
                📄 <Dateiname name={karten0[index]} />
              </button>
            ))}
          </div>
        </>
      )}

      {!fertigAlles && runde > 0 && (
        <>
          <div className="flex flex-wrap gap-2 justify-center">
            {offen.map(index => {
              const karte = karten[index];
              const ausgewaehlt = gewaehlteKarte === index;
              return (
                <button
                  key={index}
                  type="button"
                  data-karte={index}
                  draggable
                  onDragStart={e => karteGezogen(e, index)}
                  onClick={() => karteKlick(index)}
                  aria-pressed={ausgewaehlt}
                  className={
                    "rounded-xl border px-3 py-2 text-sm font-bold text-left cursor-grab " +
                    (ausgewaehlt ? "border-accent bg-surface-hover" : "border-line hover:border-accent")
                  }
                >
                  {karte.art === "datei" ? <Dateiname name={kartenText(karte)} /> : kartenText(karte)}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 justify-items-center">
            {auswahl.map(id => (
              <AppKachel
                key={id}
                id={id}
                groesse={kachelGroesse}
                wackelt={wackelId === id}
                onKlick={() => kachelKlick(id)}
                onFallen={e => aufKachelFallen(e, id)}
              />
            ))}
          </div>
        </>
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
