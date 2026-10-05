"use client";
/**
 * Teil 2 · Scrollen — mit dem Mausrad, der Scrollleiste und mit Umschalt +
 * Rad waagrecht. Vier Aufgaben, die sich am Weg dahin nicht kümmern: Hauptsache,
 * am Ende steht die richtige Zeile bzw. Spalte im Blickfeld und wird angeklickt.
 */
import { useRef, useState, type WheelEvent as RadEreignis } from "react";
import { AvatarDisplay } from "@/components/AvatarPicker";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import {
  ZIEL_LEISTE, ZIEL_QUER, ZIEL_RAD, scrollArt, spalten, zeilen,
} from "@/lib/maus/scrollen";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";

type AufgabeId = "rad" | "leiste" | "anfang" | "quer";
const AUFGABEN: AufgabeId[] = ["rad", "leiste", "anfang", "quer"];

const ZEILEN = zeilen();
const SPALTEN = spalten();

function auftragFuer(a: AufgabeId): { text: string; tipp: string } {
  switch (a) {
    case "rad":
      return {
        text: `Dreh am Mausrad und finde »${ZEILEN[ZIEL_RAD].label}«.`,
        tipp: "Zeige mit dem Mauszeiger auf die Liste und dreh das Rad nach unten.",
      };
    case "leiste":
      return {
        text: `Zieh die Scrollleiste nach unten und finde »${ZEILEN[ZIEL_LEISTE].label}«.`,
        tipp: "Am rechten Rand der Liste ist ein Balken — mit gedrückter Taste nach unten ziehen.",
      };
    case "anfang":
      return {
        text: "Ganz nach oben: klick auf den ersten Eintrag »Anfang«.",
        tipp: "Scroll zurück nach ganz oben und klick auf die erste Zeile.",
      };
    case "quer":
      return {
        text: `Halte Umschalt und dreh am Mausrad — oder zieh die Leiste unten nach rechts — und finde »${SPALTEN[ZIEL_QUER].label}«.`,
        tipp: "Umschalt (Shift) gedrückt halten und das Mausrad drehen bewegt seitwärts.",
      };
  }
}

export default function StufeScrollen({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const [nr, setNr] = useState(0);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [erfolg, setErfolg] = useState(false);
  const [fehler, setFehler] = useState(0);
  const fehlerRef = useRef(0);
  const start = useRef(performance.now());

  const liste = useRef<HTMLDivElement>(null);
  const streifen = useRef<HTMLDivElement>(null);
  const radLotse = useRef(0);
  const scrollWeg = useRef(0);
  const letzteScrollTop = useRef(0);
  const zeigteLeisteTipp = useRef(false);

  const demo = useDemo(() => {
    if (liste.current) liste.current.scrollTo({ top: 0 });
    if (streifen.current) streifen.current.scrollTo({ left: 0 });
  });

  const fertig = nr >= AUFGABEN.length;
  const aufgabe = AUFGABEN[Math.min(nr, AUFGABEN.length - 1)];
  const auftrag = auftragFuer(aufgabe);

  function naechste(details: string[]) {
    setErfolg(true);
    setHinweis({ text: "Richtig gefunden! ⭐", gut: true });
    const dauerMs = Math.round(performance.now() - start.current);
    setTimeout(() => {
      setErfolg(false);
      setHinweis(null);
      radLotse.current = 0;
      scrollWeg.current = 0;
      const naechsteNr = nr + 1;
      setNr(naechsteNr);
      if (naechsteNr === AUFGABEN.length) {
        const { punkte, details: wertungDetails } = wertung({
          stufe: "scrollen", geloest: naechsteNr, anzahl: AUFGABEN.length, dauerMs, fehler: fehlerRef.current,
        });
        onFertig({ punkte, dauerMs, details: [...wertungDetails, ...details] });
      }
    }, 1100);
  }

  function falsch(name: string) {
    setHinweis({ text: `Das war »${name}« — noch nicht ganz. ${auftrag.tipp}`, gut: false });
    fehlerRef.current += 1;
    setFehler(fehlerRef.current);
  }

  function radAmListe(e: RadEreignis<HTMLDivElement>) {
    if (fertig || demo.aktiv) return;
    if (e.deltaY !== 0) radLotse.current += 1;
  }

  function scrollAmListe() {
    if (!liste.current || fertig || demo.aktiv) return;
    const el = liste.current;
    const weg = Math.abs(el.scrollTop - letzteScrollTop.current);
    letzteScrollTop.current = el.scrollTop;
    scrollWeg.current += weg;
    if (aufgabe === "leiste" && radLotse.current === 0 && !zeigteLeisteTipp.current
      && el.scrollTop > el.clientHeight * 2) {
      zeigteLeisteTipp.current = true;
      setHinweis({ text: "💡 Für so eine lange Liste ist die Scrollleiste schneller als das Rad!", gut: true });
    }
  }

  function klickZeile(e: (typeof ZEILEN)[number]) {
    if (fertig || erfolg || demo.aktiv) return;
    if (aufgabe === "rad" && e.index === ZIEL_RAD) {
      naechste([scrollArt(radLotse.current, scrollWeg.current) === "rad" ? "Mausrad benutzt" : "Liste durchgescrollt"]);
      return;
    }
    if (aufgabe === "leiste" && e.index === ZIEL_LEISTE) {
      naechste([scrollArt(radLotse.current, scrollWeg.current) === "rad" ? "Mit dem Rad gefunden" : "Scrollleiste benutzt"]);
      return;
    }
    if (aufgabe === "anfang" && e.index === 0) {
      naechste(["Zurück zum Anfang gescrollt"]);
      return;
    }
    if (["rad", "leiste", "anfang"].includes(aufgabe)) falsch(e.label);
  }

  function klickSpalte(e: (typeof SPALTEN)[number]) {
    if (fertig || erfolg || demo.aktiv || aufgabe !== "quer") return;
    if (e.index === ZIEL_QUER) {
      naechste(["Waagrecht gescrollt (Umschalt + Rad)"]);
      return;
    }
    falsch(e.label);
  }

  function vorfuehren() {
    if (demo.aktiv) return;
    let schritte: DemoSchritt[] = [];
    if (aufgabe === "rad" || aufgabe === "leiste" || aufgabe === "anfang") {
      const el = liste.current;
      const bereich = () => el?.getBoundingClientRect() ?? null;
      if (aufgabe === "rad") {
        schritte = [
          { text: "Zeige mit dem Mauszeiger auf die Liste.", zu: () => { const r = bereich(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; } },
          {
            text: "Dreh am Mausrad nach unten …", taste: "rad",
            aktion: () => el?.scrollTo({ top: (ZIEL_RAD - 2) * rowHoehe(hilfe), behavior: "smooth" }),
            ms: 2200,
          },
          { text: `… bis »${ZEILEN[ZIEL_RAD].label}« zu sehen ist.`, taste: null },
        ];
      } else if (aufgabe === "leiste") {
        const r = bereich();
        schritte = [
          { text: "Zeige auf die Scrollleiste am rechten Rand.", zu: () => r ? { x: r.right - 8, y: r.top + 40 } : null },
          { text: "Taste festhalten und nach unten ziehen …", taste: "halten", zu: () => r ? { x: r.right - 8, y: r.bottom - 40 } : null, aktion: () => el?.scrollTo({ top: (ZIEL_LEISTE - 2) * rowHoehe(hilfe), behavior: "smooth" }), ms: 2200 },
          { text: `… bis »${ZEILEN[ZIEL_LEISTE].label}« zu sehen ist.`, taste: null },
        ];
      } else {
        const r = bereich();
        schritte = [
          { text: "Zeige auf die Liste.", zu: () => r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null },
          { text: "Dreh das Rad nach oben, bis ganz oben Schluss ist …", taste: "rad", aktion: () => el?.scrollTo({ top: 0, behavior: "smooth" }), ms: 2200 },
          { text: "Klick auf den ersten Eintrag »Anfang«.", taste: "links" },
        ];
      }
    } else {
      const el = streifen.current;
      const r = el?.getBoundingClientRect() ?? null;
      schritte = [
        { text: "Zeige auf den Streifen.", zu: () => r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null },
        { text: "Umschalt festhalten und am Rad drehen …", tasten: ["ShiftLeft"], taste: "rad", aktion: () => el?.scrollTo({ left: (ZIEL_QUER - 2) * 120, behavior: "smooth" }), ms: 2200 },
        { text: `… bis »${SPALTEN[ZIEL_QUER].label}« ganz rechts zu sehen ist.`, tasten: ["ShiftLeft"], taste: null },
      ];
    }
    demo.abspielen(schritte);
  }

  const zeilenHoehe = rowHoehe(hilfe);
  const punkteLaufend = wertung({
    stufe: "scrollen", geloest: nr, anzahl: AUFGABEN.length,
    dauerMs: Math.round(performance.now() - start.current), fehler,
  }).punkte;

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="🖱️ Teil 2 · Scrollen"
        auftrag={fertig
          ? <>Alle Scroll-Aufgaben geschafft! Weiter geht es mit der Tastatur.</>
          : <>{auftrag.text}<div data-zusatz className="text-xs text-muted mt-1">💡 {auftrag.tipp}</div></>}
        punkte={punkteLaufend}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-4">
          {aufgabe !== "quer" || fertig ? (
            <div
              ref={liste}
              onWheel={radAmListe}
              onScroll={scrollAmListe}
              className={"card overflow-y-auto" + (erfolg ? "ring-4 ring-ok" : "")}
              style={{ height: "55vh" }}
            >
              {ZEILEN.map(e => {
                const ziel = !fertig && ((aufgabe === "rad" && e.index === ZIEL_RAD)
                  || (aufgabe === "leiste" && e.index === ZIEL_LEISTE)
                  || (aufgabe === "anfang" && e.index === 0));
                return (
                  <button
                    key={e.index}
                    type="button"
                    onClick={() => klickZeile(e)}
                    className={"w-full flex items-center gap-3 px-4 border-b border-line text-left hover:bg-surface-hover "
                      + (ziel && hilfe ? "ring-2 ring-inset ring-accent" : "")}
                    style={{ height: zeilenHoehe, fontSize: hilfe ? "1.1rem" : undefined }}
                  >
                    <AvatarDisplay avatarId={e.tier} size={hilfe ? "md" : "sm"} />
                    <span>{e.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {aufgabe === "quer" && !fertig && (
            <div
              ref={streifen}
              className="card overflow-x-auto"
              style={{ height: "55vh" }}
            >
              <div className="flex h-full items-center gap-3 px-4">
                {SPALTEN.map(e => (
                  <button
                    key={e.index}
                    type="button"
                    onClick={() => klickSpalte(e)}
                    className={"flex flex-col items-center gap-1 shrink-0 rounded-xl px-3 py-2 hover:bg-surface-hover "
                      + (e.index === ZIEL_QUER && hilfe ? "ring-2 ring-accent" : "")}
                    style={{ width: 110 }}
                  >
                    <AvatarDisplay avatarId={e.tier} size="lg" />
                    <span className="text-xs text-center">{e.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="card p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          <ul className="flex flex-col gap-1">
            {AUFGABEN.map((a, i) => (
              <li key={a} className={"text-sm flex gap-2 " + (i === nr ? "font-bold" : i < nr ? "text-muted" : "")}>
                <span>{i < nr ? "✅" : i === nr ? "👉" : "⬜"}</span>
                <span>{auftragFuer(a).text.split("»")[1]?.replace("«", "") ?? auftragFuer(a).text}</span>
              </li>
            ))}
          </ul>
          <div className="min-h-10 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
        </aside>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}

function rowHoehe(hilfe: boolean) {
  return Math.round((hilfe ? HILFE_GROESSE : 1) * 36);
}
