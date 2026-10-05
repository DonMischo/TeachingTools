"use client";
/**
 * Stufe 6: Kopieren und Einfügen.
 *
 * Links der Text, rechts ein Merkzettel. Gezählt wird nur, was wirklich
 * *eingefügt* wurde (das `paste`-Ereignis) — abgetippt zählt nicht. Ob über
 * die Tastatur oder das Menü der rechten Maustaste, ist egal: beide lösen
 * dieselben Ereignisse aus. Fürs Blatt wird trotzdem mitgeschrieben, welcher
 * Weg es war.
 */
import { useEffect, useRef, useState } from "react";
import { KOPIER_AUFGABEN, PUNKTE_KOPIEREN, passt, type Aufgabe } from "@/lib/maus/text";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo } from "./Demo";
import { KURZ, Lesetext, auswahlImFeld, markiere, useAuswahl, useStrgA } from "./Lesetext";
import { demoSchritteMarkieren } from "./StufeMarkieren";

type Schritt = "markieren" | "kopieren" | "einfuegen";

/** Was gerade markiert ist — im Merkzettel über die Textfeld-Auswahl, die `getSelection()` nicht kennt. */
function markierterText(feld: HTMLElement | null): string {
  const aktiv = document.activeElement;
  if (aktiv instanceof HTMLTextAreaElement || aktiv instanceof HTMLInputElement) {
    return aktiv.value.slice(aktiv.selectionStart ?? 0, aktiv.selectionEnd ?? 0);
  }
  return auswahlImFeld(feld) || window.getSelection()?.toString() || "";
}

function wasKopieren(a: Aufgabe) {
  if (a.art === "wort") return <>das Wort <b>»{a.ziel}«</b></>;
  if (a.art === "satz") return <>den Satz <b>»{a.ziel}«</b></>;
  return <>den <b>{a.absatz + 1}. Absatz</b></>;
}

function markierTipp(a: Aufgabe) {
  if (a.art === "wort") return "Doppelklick auf das Wort";
  if (a.art === "satz") return "linke Taste festhalten und über den Satz ziehen";
  return "dreimal schnell in den Absatz klicken";
}

export default function StufeKopieren({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const [nr, setNr] = useState(0);
  const [schritt, setSchritt] = useState<Schritt>("markieren");
  const [notiz, setNotiz] = useState("");
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const feld = useRef<HTMLDivElement>(null);
  const zettel = useRef<HTMLTextAreaElement>(null);
  const start = useRef(performance.now());
  const letzteTaste = useRef(0);
  const wege = useRef({ tastatur: 0, menue: 0 });
  const gezaehlt = useRef(-1);
  // Was gerade im Zwischenspeicher liegt — `nr` lässt die Anzeige bei jeder neuen Kopie aufleuchten.
  const [zwischen, setZwischen] = useState<{ text: string; nr: number } | null>(null);
  const zwischenRef = useRef<HTMLDivElement>(null);
  const vorDemo = useRef("");
  const zwischenVorDemo = useRef<{ text: string; nr: number } | null>(null);
  const demo = useDemo(() => { markiere(null); setNotiz(vorDemo.current); setZwischen(zwischenVorDemo.current); });

  const fertig = nr >= KOPIER_AUFGABEN.length;
  const aufgabe = KOPIER_AUFGABEN[Math.min(nr, KOPIER_AUFGABEN.length - 1)];

  useAuswahl(feld, text => {
    if (fertig) return;
    if (passt(text, aufgabe.ziel)) {
      setSchritt(s => (s === "markieren" ? "kopieren" : s));
    }
  }, demo.aktiv || fertig);

  useStrgA(feld);

  useEffect(() => {
    // Strg + C / Strg + V kurz vor dem Ereignis heißt: über die Tastatur.
    const taste = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "v"].includes(e.key.toLowerCase())) letzteTaste.current = performance.now();
    };
    const kopiert = () => {
      if (demo.aktiv) return;
      const text = markierterText(feld.current);
      if (text) setZwischen({ text, nr: Date.now() });
      if (fertig) return;
      if (passt(text, aufgabe.ziel)) {
        setSchritt("einfuegen");
        setHinweis({ text: "Kopiert! Schau: Die Kopie liegt jetzt im Zwischenspeicher. Jetzt einfügen.", gut: true });
      } else if (text.trim()) {
        setHinweis({ text: `Kopiert hast du »${KURZ(text.trim())}« — gesucht ist etwas anderes.`, gut: false });
      }
    };
    document.addEventListener("keydown", taste);
    document.addEventListener("copy", kopiert);
    // Ausschneiden legt genauso in den Zwischenspeicher (geht nur im Merkzettel).
    document.addEventListener("cut", kopiert);
    return () => {
      document.removeEventListener("keydown", taste);
      document.removeEventListener("copy", kopiert);
      document.removeEventListener("cut", kopiert);
    };
  }, [aufgabe, demo.aktiv, fertig]);

  function eingefuegt(text: string) {
    if (demo.aktiv) return;
    // Beim Einfügen zeigt der Browser, was wirklich im Zwischenspeicher liegt —
    // auch wenn es außerhalb dieser Seite kopiert wurde.
    if (text) setZwischen(z => (z?.text === text ? z : { text, nr: Date.now() }));
    if (fertig || gezaehlt.current === nr) return;
    if (!passt(text, aufgabe.ziel)) {
      setHinweis({ text: `Eingefügt wurde »${KURZ(text.trim())}« — das ist noch nicht das Gesuchte.`, gut: false });
      return;
    }
    // Zweimal schnell eingefügt zählt nur einmal.
    gezaehlt.current = nr;
    if (performance.now() - letzteTaste.current < 1500) wege.current.tastatur += 1;
    else wege.current.menue += 1;
    // Hier bewusst *keine* Auswahl leeren: das Ereignis läuft, bevor der Browser
    // einfügt, und ohne Cursor im Merkzettel landete der Text nirgends.
    setHinweis({ text: "Eingefügt! ⭐", gut: true });
    const naechste = nr + 1;
    setTimeout(() => {
      setNr(naechste);
      setSchritt("markieren");
      setHinweis(null);
      if (naechste === KOPIER_AUFGABEN.length) {
        const { tastatur, menue } = wege.current;
        onFertig({
          punkte: naechste * PUNKTE_KOPIEREN,
          dauerMs: Math.round(performance.now() - start.current),
          details: [
            `${naechste} von ${KOPIER_AUFGABEN.length} Aufgaben`,
            `Mit der Tastatur ${tastatur}×, mit dem Menü ${menue}×`,
          ],
        });
      }
    }, 900);
  }

  function vorfuehren() {
    markiere(null);
    vorDemo.current = notiz;
    zwischenVorDemo.current = zwischen;
    const zeile = aufgabe.art === "absatz" ? aufgabe.ziel.slice(0, 40) + " …" : aufgabe.ziel;
    demo.abspielen([
      ...demoSchritteMarkieren(feld.current, aufgabe),
      { text: "Halte Strg fest und drücke C: kopieren.", tasten: ["ControlLeft", "KeyC"], aktion: () => setZwischen({ text: aufgabe.ziel, nr: Date.now() }) },
      { text: "Die Kopie liegt jetzt im Zwischenspeicher.", zu: () => mitte(zwischenRef.current) },
      { text: "Klicke in den Merkzettel.", zu: () => mitte(zettel.current) },
      { text: "Linke Taste.", taste: "links" },
      { text: "Halte Strg fest und drücke V: einfügen!", tasten: ["ControlLeft", "KeyV"], aktion: () => setNotiz(n => `${n}${n ? "\n" : ""}${zeile}`) },
      { text: "Da ist es! Jetzt probierst du es.", taste: null },
    ]);
  }

  const schritte: { id: Schritt; text: string }[] = [
    { id: "markieren", text: `Markieren (${markierTipp(aufgabe)})` },
    { id: "kopieren", text: "Kopieren: Strg + C — oder Rechtsklick → Kopieren" },
    { id: "einfuegen", text: "In den Merkzettel klicken, einfügen: Strg + V — oder Rechtsklick → Einfügen" },
  ];
  const stand = schritte.findIndex(s => s.id === schritt);

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="📄 Stufe 6 · Kopieren und Einfügen"
        auftrag={fertig
          ? <>Alles kopiert und eingefügt! Zum Schluss holst du dir deinen Führerschein.</>
          : <>Kopiere {wasKopieren(aufgabe)} und füge es rechts in den Merkzettel ein.
              <span data-zusatz className="text-xs text-muted ml-2 tabular-nums">Aufgabe {nr + 1} von {KOPIER_AUFGABEN.length}</span></>}
        punkte={Math.min(nr, KOPIER_AUFGABEN.length) * PUNKTE_KOPIEREN}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      {!fertig && (
        <ol className="flex flex-wrap gap-2 text-sm">
          {schritte.map((s, i) => (
            <li key={s.id} className={
              "rounded-lg px-3 py-1.5 border " +
              (i < stand ? "border-ok text-ok"
                : i === stand ? "border-accent font-bold" : "border-line text-muted")
            }>
              {i < stand ? "✅" : `${i + 1}.`} {s.text}
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Lesetext ref={feld} />
        <div className="flex flex-col gap-4">
        <div ref={zwischenRef} className="card p-4 flex flex-col gap-2" data-testid="zwischenspeicher">
          <h3 className="font-black select-none">📋 Zwischenspeicher</h3>
          <div
            key={zwischen?.nr ?? 0}
            className={
              "rounded-lg border border-dashed border-line px-3 py-2 text-sm min-h-10 max-h-24 overflow-auto whitespace-pre-wrap select-none " +
              (zwischen ? "maus-aufleuchten" : "")
            }
          >
            {zwischen ? zwischen.text : <span className="italic text-muted">leer — noch nichts kopiert</span>}
          </div>
          <p className="text-xs text-muted leading-snug select-none">
            Strg + C legt eine Kopie hinein — die alte fliegt dabei raus. Strg + V holt sie wieder heraus, so oft du willst.
          </p>
        </div>
        <div className="card p-5 flex flex-col gap-2 flex-1">
          <h3 className="font-black select-none">📝 Mein Merkzettel</h3>
          <textarea
            ref={zettel}
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            onPaste={e => eingefuegt(e.clipboardData.getData("text/plain"))}
            placeholder="Hier einfügen …"
            className="flex-1 min-h-48 w-full rounded-xl border border-line bg-page p-3 text-[15px] leading-relaxed resize-y"
          />
          <div className="min-h-10 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
        </div>
        </div>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
