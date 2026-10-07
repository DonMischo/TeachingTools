"use client";
/**
 * Teil 3, Stufe: Bildschirmfoto (Windows 11, Snipping Tool, IrfanView).
 *
 * Der Browser sieht die Windows-Taste nie — Tastendrücke außerhalb des
 * Fensters erreichen die Seite nicht. Geprüft wird deshalb ausschließlich
 * am Ergebnis: kommt per Strg + V ein Bild an, hat es funktioniert. Die
 * Bildschirmtastatur zeigt die Tasten nur als Anleitung.
 *
 * Schritt 3 (speichern, in IrfanView öffnen, dort kopieren) endet ebenfalls
 * mit Strg + V — kein Ziehen von Dateien. Damit niemand einfach das Bild aus
 * Schritt 1 noch einmal einfügt, wird es an seiner Prüfsumme wiedererkannt.
 */
import { useEffect, useRef, useState } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import { PUNKTE_TEIL2, pruefsumme, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { bildAusDaten, istBildschirmgroesse, istText } from "@/lib/maus/screenshot";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { Taste, codeFuer } from "./Taste";

type Vorschau = { url: string; breite: number; hoehe: number };

const ANZAHL = 3;

/** Alle Tasten für Schritt 3: Ausschnitt, speichern, kopieren, einfügen. */
const TASTEN_3 = ["⊞", "Umschalt", "S", "Strg", "C", "V"];

const SCHRITT_3_TEXT = "Speichern und in IrfanView öffnen: Ausschnitt, »Markup und Freigabe«, speichern, mit IrfanView öffnen, dort Strg + C — hier Strg + V.";

function bildLaden(datei: File): Promise<Vorschau> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(datei);
    const bild = new Image();
    bild.onload = () => resolve({ url, breite: bild.naturalWidth, hoehe: bild.naturalHeight });
    bild.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
    bild.src = url;
  });
}

export default function StufeScreenshot({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const av = AVATARS.find(a => a.id === avatar) ?? AVATARS[0];
  const [zahl] = useState(() => 100 + Math.floor(Math.random() * 900));
  const [nr, setNr] = useState(0);
  const [bild1, setBild1] = useState<Vorschau | null>(null);
  const [bild2, setBild2] = useState<Vorschau | null>(null);
  const [bild3, setBild3] = useState<Vorschau | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const summen = useRef<string[]>([]);
  const [demoRahmen, setDemoRahmen] = useState(false);
  const [demoVorschau, setDemoVorschau] = useState(false);
  const kartenRef = useRef<HTMLDivElement>(null);
  const start = useRef(performance.now());
  const gezaehlt = useRef(-1);
  const fehler = useRef(0);
  const demo = useDemo(() => { setDemoRahmen(false); setDemoVorschau(false); });

  const fertig = nr >= ANZAHL;

  useEffect(() => {
    return () => {
      if (bild1) URL.revokeObjectURL(bild1.url);
      if (bild2) URL.revokeObjectURL(bild2.url);
      if (bild3) URL.revokeObjectURL(bild3.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fertigMelden(naechste: number) {
    if (naechste < ANZAHL) return;
    const { punkte, details } = wertung({
      stufe: "screenshot",
      geloest: naechste,
      anzahl: ANZAHL,
      dauerMs: Math.round(performance.now() - start.current),
      fehler: fehler.current,
    });
    onFertig({ punkte, dauerMs: Math.round(performance.now() - start.current), details });
  }

  async function bildEingefuegt(datei: File) {
    if (gezaehlt.current === nr || fertig) return;
    // Vor dem Laden sperren: das Einfügen kommt über das Feld *und* das Dokument
    // an, und beide warteten sonst gleichzeitig auf das Bild.
    gezaehlt.current = nr;
    let vorschau: Vorschau;
    let summe: string;
    try {
      summe = pruefsumme(await datei.arrayBuffer());
      vorschau = await bildLaden(datei);
    } catch { gezaehlt.current = -1; return; }
    if (nr === 2 && summen.current.includes(summe)) {
      fehler.current += 1;
      setHinweis({
        text: "Das ist noch das Bild von vorhin. Mach einen neuen Ausschnitt, speichere ihn, öffne ihn in IrfanView und kopiere ihn dort mit Strg + C.",
        gut: false,
      });
      URL.revokeObjectURL(vorschau.url);
      gezaehlt.current = -1;
      return;
    }
    if (nr === 0) {
      setBild1(vorschau);
      setHinweis({ text: "Klasse! Das ist dein Ausschnitt. ⭐", gut: true });
    } else if (nr === 1) {
      if (!istBildschirmgroesse(vorschau.breite, vorschau.hoehe)) {
        fehler.current += 1;
        setHinweis({
          text: `Das Bild ist ${vorschau.breite} × ${vorschau.hoehe} Pixel groß — ein ganzer Bildschirm ist zum Beispiel 1920 × 1080. Hast du vielleicht nur einen Ausschnitt gemacht? Drück die Druck-Taste …`,
          gut: false,
        });
        gezaehlt.current = -1;
        return;
      }
      setBild2(vorschau);
      setHinweis({ text: "Super, der ganze Bildschirm ist da! ⭐", gut: true });
    } else {
      setBild3(vorschau);
      setHinweis({ text: "Gespeichert, in IrfanView geöffnet und eingefügt! ⭐", gut: true });
    }
    summen.current.push(summe);
    const naechste = nr + 1;
    setTimeout(() => {
      setNr(naechste);
      setHinweis(null);
      gezaehlt.current = -1;
      fertigMelden(naechste);
    }, 900);
  }

  function einfuegen(daten: DataTransfer | null | undefined) {
    if (!daten || demo.aktiv || fertig) return;
    const bilddatei = bildAusDaten(daten);
    if (bilddatei) { bildEingefuegt(bilddatei); return; }
    if (istText(daten)) {
      fehler.current += 1;
      setHinweis({ text: "Das war Text, kein Bild — mach zuerst ein Bildschirmfoto.", gut: false });
    }
  }

  useEffect(() => {
    const handler = (e: ClipboardEvent) => einfuegen(e.clipboardData);
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nr, fertig, bild1, demo.aktiv]);

  function vorfuehren() {
    const ecke = (start: boolean) => () => {
      const el = kartenRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return start ? { x: r.left + 8, y: r.top + 8 } : { x: r.right - 8, y: r.bottom - 8 };
    };
    const feld = () => mitte(document.querySelector('[data-testid="einfuegen-feld"]'));
    const ausschnitt: DemoSchritt[] = [
      { text: "Drücke ⊞ Windows + Umschalt + S.", tasten: ["MetaLeft", "ShiftLeft", "KeyS"] },
      { text: "Zieh mit gedrückter Maustaste einen Rahmen um die Karte.", taste: "halten", zu: ecke(true), aktion: () => setDemoRahmen(true) },
      { text: "Bis zur anderen Ecke — dann loslassen.", taste: "halten", zu: ecke(false) },
    ];
    const einfuegenSchritte: DemoSchritt[] = [
      { text: "Klick in dieses Feld …", zu: feld, taste: "links", aktion: () => setDemoRahmen(false) },
      { text: "… und drücke Strg + V.", tasten: ["ControlLeft", "KeyV"], aktion: () => setDemoVorschau(true) },
      { text: "Da ist das Bild!", taste: null },
    ];
    if (nr === 0) {
      demo.abspielen([...ausschnitt, ...einfuegenSchritte]);
    } else if (nr === 1) {
      demo.abspielen([
        { text: "Drücke die Druck-Taste — oben rechts auf der Tastatur.", tasten: ["PrintScreen"] },
        ...einfuegenSchritte,
      ]);
    } else {
      demo.abspielen([
        ...ausschnitt,
        { text: "Unten rechts auf die Meldung klicken: »Markup und Freigabe«.", taste: "links", aktion: () => setDemoRahmen(false) },
        { text: "Im Snipping Tool speichern: Strg + S, z. B. in »Bilder«.", tasten: ["ControlLeft", "KeyS"] },
        { text: "Die Datei im Explorer mit Rechtsklick › Öffnen mit › IrfanView öffnen.", taste: "rechts" },
        { text: "In IrfanView Strg + C drücken: das Bild ist kopiert.", tasten: ["ControlLeft", "KeyC"] },
        ...einfuegenSchritte,
      ]);
    }
  }

  const aufgaben = [
    { text: "Ausschnitt: ⊞ Windows + Umschalt + S, Rahmen um die Karte ziehen, dann Strg + V einfügen." },
    { text: "Ganzer Bildschirm: Druck-Taste (oder ⊞ Windows + Druck) drücken, dann wieder einfügen." },
    { text: SCHRITT_3_TEXT },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="📸 Teil 3 · Bildschirmfoto"
        auftrag={<>Mach ein Bildschirmfoto von der bunten Karte — Ausschnitt, ganzer Bildschirm, dann speichern und in IrfanView öffnen. Eingefügt wird immer mit <Taste>Strg</Taste> + <Taste>V</Taste>.</>}
        punkte={Math.round((PUNKTE_TEIL2 * Math.min(nr, ANZAHL)) / ANZAHL)}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <ol className="flex flex-wrap gap-2 text-sm">
        {aufgaben.map((a, i) => (
          <li key={i} className={
            "rounded-lg px-3 py-1.5 border " +
            (i < nr ? "border-ok text-ok"
              : i === nr ? "border-accent font-bold" : "border-line text-muted")
          }>
            {i < nr ? "✅" : i === nr ? "👉" : "⬜"} {a.text}
          </li>
        ))}
      </ol>

      <div className={"grid gap-4 " + (hilfe ? "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : "md:grid-cols-2")}>
        <div className="flex flex-col gap-3">
          <h3 className="font-black">Das Motiv</h3>
          <div
            ref={kartenRef}
            data-testid="karte"
            className={"relative rounded-3xl flex flex-col items-center justify-center gap-2 shadow-lg select-none " + (hilfe ? "p-10" : "p-8")}
            style={{ background: av.bg }}
          >
            <span className={hilfe ? "text-8xl" : "text-7xl"}>{av.emoji}</span>
            <span className={"font-black text-white drop-shadow-sm " + (hilfe ? "text-5xl" : "text-4xl")} data-testid="karte-zahl">{zahl}</span>
            {demoRahmen && (
              <div aria-hidden className="absolute inset-0 rounded-3xl border-4 border-dashed border-white" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div
            tabIndex={0}
            onPaste={e => einfuegen(e.clipboardData)}
            data-testid="einfuegen-feld"
            className="rounded-2xl border-4 border-dashed border-line p-4 flex flex-col items-center gap-2 text-center min-h-40 justify-center outline-hidden focus:border-accent"
          >
            {(() => {
              const bild = [bild1, bild2, bild3][Math.min(nr, 2)];
              if (bild) {
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bild.url} alt="Eingefügtes Bildschirmfoto" className="max-h-40 rounded-lg shadow-sm" data-testid={`vorschau-${Math.min(nr, 2) + 1}`} />
                );
              }
              if (demoVorschau) {
                return <div aria-hidden className="w-32 h-20 rounded-lg bg-surface-hover border border-line flex items-center justify-center text-2xl">🖼️</div>;
              }
              return <div className="font-bold">Hier einfügen: Klick hinein und drücke <Taste>Strg</Taste> + <Taste>V</Taste></div>;
            })()}
            <p className="text-sm font-bold min-h-6" aria-live="polite"
              style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--red, #dc2626)" }}>
              {hinweis?.text}
            </p>
          </div>

          {nr === 0 && (
            <Tastatur gedrueckt={new Set(["MetaLeft", "ShiftLeft", "KeyS"])} zeigeFinger={false} />
          )}
          {nr === 1 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Deine Tastatur hat vielleicht keine echte Druck-Taste:</span>
              <span className="inline-block rounded-md border border-accent bg-surface-hover px-2 py-1 text-xs font-bold">Druck</span>
              <span className="text-muted">oder <Taste>⊞</Taste> + <span className="inline-block rounded-md border border-accent bg-surface-hover px-2 py-1 text-xs font-bold">Druck</span></span>
            </div>
          )}
          {nr === 2 && (
            <ol className="flex flex-col gap-1.5 text-sm list-decimal list-inside">
              <li>Mach wie in Schritt 1 einen Ausschnitt (<Taste>⊞</Taste> + <Taste>Umschalt</Taste> + <Taste>S</Taste>).</li>
              <li>Unten rechts erscheint eine Meldung — klick darin auf <b>»Markup und Freigabe«</b>.</li>
              <li>Speichere das Bild mit 💾 (oder <Taste>Strg</Taste> + <Taste>S</Taste>), z. B. in »Bilder«.</li>
              <li>Öffne die gespeicherte Datei im Explorer: Rechtsklick › <b>Öffnen mit</b> › <b>IrfanView</b>.</li>
              <li>In IrfanView <Taste>Strg</Taste> + <Taste>C</Taste> drücken (kopieren) …</li>
              <li>… und hier ins Feld klicken und <Taste>Strg</Taste> + <Taste>V</Taste> drücken.</li>
            </ol>
          )}
          {nr === 2 && (
            <div className="rounded-2xl border border-line bg-surface p-3 flex flex-col gap-2" data-testid="tasten-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold mr-1">Diese Tasten brauchst du:</span>
                {TASTEN_3.map(t => <Taste key={t} gross>{t}</Taste>)}
              </div>
              <Tastatur
                gedrueckt={new Set()}
                zeigeFinger={false}
                markiert={new Set(TASTEN_3.map(codeFuer).filter((c): c is string => !!c))}
              />
            </div>
          )}
        </div>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
