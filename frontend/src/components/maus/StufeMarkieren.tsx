"use client";
/**
 * Stufe 5: Markieren — ein Wort, ein Absatz, der ganze Text.
 *
 * Jede Aufgabe lässt zwei Wege zu: den schnellen (Doppelklick, Dreifachklick,
 * Strg + A) und das Ziehen mit gedrückter Taste. Beides soll ein Kind können;
 * welcher Weg genommen wurde, spielt für die Punkte keine Rolle.
 */
import { useEffect, useRef, useState } from "react";
import { MARKIER_AUFGABEN, PUNKTE_MARKIEREN, passt, type Aufgabe } from "@/lib/maus/text";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, useDemo, type DemoSchritt } from "./Demo";
import { KURZ, Lesetext, bereichFuer, markiere, ortIn, useAuswahl, useStrgA } from "./Lesetext";

const GRUPPEN: { art: Aufgabe["art"]; titel: string }[] = [
  { art: "wort", titel: "Ein Wort" },
  { art: "absatz", titel: "Ein Absatz" },
  { art: "alles", titel: "Der ganze Text" },
];

function auftragFuer(a: Aufgabe) {
  if (a.art === "wort") {
    return {
      text: <>Markiere das Wort <b>»{a.ziel}«</b>.</>,
      tipp: "Doppelklick auf das Wort — oder mit gedrückter linker Taste darüberziehen.",
    };
  }
  if (a.art === "absatz") {
    return {
      text: <>Markiere den <b>{a.absatz + 1}. Absatz</b> (er beginnt mit »{a.ziel.split(" ").slice(0, 3).join(" ")} …«).</>,
      tipp: "Dreimal schnell in den Absatz klicken — oder vom ersten bis zum letzten Wort ziehen.",
    };
  }
  return {
    text: <>Markiere den <b>ganzen Text</b>.</>,
    tipp: "Klicke in den Text und drücke Strg + A — oder ziehe vom Anfang bis ganz zum Ende.",
  };
}

export function demoSchritteMarkieren(feld: HTMLElement | null, a: Aufgabe): DemoSchritt[] {
  const bereich = () => bereichFuer(feld, a);
  if (a.art === "wort") {
    return [
      { text: `Zeige auf das Wort »${a.ziel}«.`, zu: () => ortIn(bereich(), "mitte") },
      { text: "Doppelklick: klick-klick!", taste: "doppel", aktion: () => markiere(bereich()) },
      { text: "Das Wort ist blau — es ist markiert.", taste: null },
    ];
  }
  if (a.art === "satz") {
    return [
      { text: "Zeige vor das erste Wort.", zu: () => ortIn(bereich(), "anfang") },
      { text: "Linke Taste drücken und festhalten …", taste: "halten" },
      { text: "… und bis hinter das letzte Wort ziehen.", taste: "halten", zu: () => ortIn(bereich(), "ende"), aktion: () => setTimeout(() => markiere(bereich()), 1800) },
      { text: "Loslassen. Der Satz ist markiert.", taste: null },
    ];
  }
  if (a.art === "absatz") {
    return [
      { text: "Zeige in den Absatz.", zu: () => ortIn(bereich(), "anfang") },
      { text: "Dreimal schnell klicken: klick-klick-klick!", taste: "doppel", aktion: () => setTimeout(() => markiere(bereich()), 900) },
      { text: "Der ganze Absatz ist markiert.", taste: null },
    ];
  }
  return [
    { text: "Klicke in den Text.", zu: () => ortIn(bereich(), "anfang") },
    { text: "Halte die Strg-Taste fest …", tasten: ["ControlLeft"] },
    { text: "… und drücke A. Alles ist markiert!", tasten: ["ControlLeft", "KeyA"], aktion: () => markiere(bereich()) },
  ];
}

export default function StufeMarkieren({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const [nr, setNr] = useState(0);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [erfolg, setErfolg] = useState(false);
  const feld = useRef<HTMLDivElement>(null);
  const start = useRef(performance.now());
  const strgA = useRef(false);
  const hinweisUhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demo = useDemo(() => markiere(null));

  const fertig = nr >= MARKIER_AUFGABEN.length;
  const aufgabe = MARKIER_AUFGABEN[Math.min(nr, MARKIER_AUFGABEN.length - 1)];

  useAuswahl(feld, (text, endgueltig) => {
    if (fertig || erfolg) return;
    if (hinweisUhr.current) clearTimeout(hinweisUhr.current);
    if (passt(text, aufgabe.ziel)) {
      setErfolg(true);
      setHinweis({ text: "Richtig markiert! ⭐", gut: true });
      setTimeout(() => {
        markiere(null);
        setErfolg(false);
        setHinweis(null);
        const naechste = nr + 1;
        setNr(naechste);
        if (naechste === MARKIER_AUFGABEN.length) {
          onFertig({
            punkte: naechste * PUNKTE_MARKIEREN,
            dauerMs: Math.round(performance.now() - start.current),
            details: [
              `${naechste} von ${MARKIER_AUFGABEN.length} Aufgaben`,
              strgA.current ? "Alles markiert mit Strg + A" : "Alles markiert durch Ziehen",
            ],
          });
        }
      }, 1100);
    } else if (endgueltig && text.trim()) {
      // Kurz warten: beim Dreifachklick steht nach dem zweiten Klick erst ein Wort da.
      hinweisUhr.current = setTimeout(() => {
        setHinweis({ text: `Noch nicht ganz — markiert ist: »${KURZ(text.trim())}«`, gut: false });
      }, 700);
    }
  }, demo.aktiv || fertig);

  useStrgA(feld, () => { strgA.current = true; });
  useEffect(() => () => { if (hinweisUhr.current) clearTimeout(hinweisUhr.current); }, []);

  const auftrag = auftragFuer(aufgabe);

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="🖍️ Stufe 5 · Markieren"
        auftrag={fertig
          ? <>Alle Markier-Aufgaben geschafft! Weiter geht es mit Kopieren und Einfügen.</>
          : <>{auftrag.text}<div data-zusatz className="text-xs text-[var(--text-muted)] mt-1">💡 {auftrag.tipp}</div></>}
        punkte={Math.min(nr, MARKIER_AUFGABEN.length) * PUNKTE_MARKIEREN}
        onDemo={fertig ? undefined : () => { markiere(null); demo.abspielen(demoSchritteMarkieren(feld.current, aufgabe)); }}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className={erfolg ? "ring-4 ring-[var(--green,#16a34a)] rounded-2xl transition-shadow" : ""}>
          <Lesetext ref={feld} />
        </div>

        <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          {GRUPPEN.map(g => (
            <div key={g.art}>
              <div className="text-xs font-bold text-[var(--text-muted)] mb-1">{g.titel}</div>
              <ul className="flex flex-col gap-1">
                {MARKIER_AUFGABEN.map((a, i) => a.art !== g.art ? null : (
                  <li key={i} className={"text-sm flex gap-2 " + (i === nr ? "font-bold" : i < nr ? "text-[var(--text-muted)]" : "")}>
                    <span>{i < nr ? "✅" : i === nr ? "👉" : "⬜"}</span>
                    <span className="truncate">{a.art === "wort" ? `»${a.ziel}«` : a.art === "absatz" ? `${a.absatz + 1}. Absatz` : "Alles"}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="min-h-[2.5rem] text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
        </aside>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
