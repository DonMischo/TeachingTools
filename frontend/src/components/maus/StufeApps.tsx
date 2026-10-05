"use client";
/**
 * Stufe 3.2 »Welche App?« — Aufgaben- und Dateikarten auf die passende App
 * ziehen (oder: Karte anklicken, dann Kachel anklicken — beides geht).
 *
 * Runde 1 fragt nach einer Tätigkeit (APP_AUFGABEN), Runde 2 nach einer
 * Datei (DATEITYPEN). Mehrere Apps dürfen richtig sein — dann zeigt der
 * Erfolgshinweis die übrigen als »Auch richtig«.
 */
import { useRef, useState } from "react";
import { AppSymbol } from "./windows/AppSymbol";
import { AUSWAHL_APPS, alternativen, kartenRichtig, kartenText, ziehKarten, type AppKarte } from "@/lib/maus/apps";
import { APP_AUFGABEN, APPS, DATEITYPEN, istRichtig, type AppId } from "@/lib/maus/windows";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";

type Hinweis = { text: string; gut: boolean } | null;

export default function StufeApps({
  onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const anzahl1 = hilfe ? 6 : 10;
  const anzahl2 = hilfe ? 5 : 8;

  const [karten1] = useState<AppKarte[]>(() => ziehKarten(APP_AUFGABEN, anzahl1).map(aufgabe => ({ art: "aufgabe" as const, aufgabe })));
  const [karten2] = useState<AppKarte[]>(() => ziehKarten(DATEITYPEN, anzahl2).map(datei => ({ art: "datei" as const, datei })));
  const gesamtAnzahl = karten1.length + karten2.length;

  const [runde, setRunde] = useState<1 | 2>(1);
  const [erledigt1, setErledigt1] = useState<Set<number>>(new Set());
  const [erledigt2, setErledigt2] = useState<Set<number>>(new Set());
  const [gewaehlteKarte, setGewaehlteKarte] = useState<number | null>(null);
  const [wackelId, setWackelId] = useState<AppId | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const wackelUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useRef(performance.now());
  const fehler = useRef(0);
  const gemeldet = useRef(false);
  const demo = useDemo();

  const karten = runde === 1 ? karten1 : karten2;
  const erledigt = runde === 1 ? erledigt1 : erledigt2;
  const setErledigt = runde === 1 ? setErledigt1 : setErledigt2;
  const offen = karten.map((_, i) => i).filter(i => !erledigt.has(i));
  const fertigAlles = erledigt1.size >= karten1.length && erledigt2.size >= karten2.length;

  function melden(g1: number, g2: number) {
    if (gemeldet.current || g1 < karten1.length || g2 < karten2.length) return;
    gemeldet.current = true;
    const { punkte, details } = wertung({
      stufe: "apps",
      geloest: g1 + g2,
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
      const alt = alternativen({ richtig: kartenRichtig(karte) }, appId).map(id => APPS[id].name);
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
      setHinweis({ text: `Mit ›${APPS[appId].name}‹ geht das nicht so gut — probier eine andere.`, gut: false });
    }
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
    const karte = karten[index];
    const appId = kartenRichtig(karte)[0];
    // Nur zeigen, nicht lösen: der Zeiger fährt von der Karte zur passenden App.
    const schritte: DemoSchritt[] = [
      { text: `Nimm die Karte »${kartenText(karte)}«.`, zu: () => mitte(document.querySelector(`[data-karte="${index}"]`)) },
      { text: "Linke Taste festhalten …", taste: "halten" },
      { text: `… und auf ${APPS[appId].name} ziehen.`, taste: "halten", zu: () => mitte(document.querySelector(`[data-app-kachel="${appId}"]`)) },
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
          : runde === 1
            ? <>Welche App brauchst du dafür? Ziehe die Karte auf die passende App — oder klicke erst die Karte, dann die App an.
                <span data-zusatz className="text-xs text-(--text-muted) ml-2">{erledigt1.size} von {karten1.length}</span></>
            : <>Welche App öffnet diese Datei?
                <span data-zusatz className="text-xs text-(--text-muted) ml-2">{erledigt2.size} von {karten2.length}</span></>}
        punkte={wertung({
          stufe: "apps", geloest: erledigt1.size + erledigt2.size, anzahl: gesamtAnzahl,
          dauerMs: performance.now() - start.current, fehler: fehler.current,
        }).punkte}
        onDemo={fertigAlles ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertigAlles}
      />

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      {!fertigAlles && (
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
                    (ausgewaehlt ? "border-(--accent) bg-(--surface-hover)" : "border-(--border) hover:border-(--accent)")
                  }
                >
                  {kartenText(karte)}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 justify-items-center">
            {AUSWAHL_APPS.map(id => (
              <button
                key={id}
                type="button"
                data-app-kachel={id}
                onDragOver={e => e.preventDefault()}
                onDrop={e => aufKachelFallen(e, id)}
                onClick={() => kachelKlick(id)}
                className={
                  "flex flex-col items-center gap-1 rounded-xl border p-2 border-(--border) hover:border-(--accent) " +
                  (wackelId === id ? "maus-wackeln" : "")
                }
              >
                <AppSymbol id={id} groesse={kachelGroesse} titel={false} />
                <span className="text-[11px] font-bold text-center leading-tight">{APPS[id].name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <DemoBuehne demo={demo} />
    </div>
  );
}
