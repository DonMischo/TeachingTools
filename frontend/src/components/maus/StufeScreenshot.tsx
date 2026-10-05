"use client";
/**
 * Teil 2, Stufe: Bildschirmfoto (Windows 11, Snipping Tool).
 *
 * Der Browser sieht die Windows-Taste nie — Tastendrücke außerhalb des
 * Fensters erreichen die Seite nicht. Geprüft wird deshalb ausschließlich
 * am Ergebnis: kommt per Einfügen oder Ablegen ein Bild an, hat es
 * funktioniert. Die Bildschirmtastatur zeigt die Tasten nur als Anleitung.
 */
import { useEffect, useRef, useState } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import { PUNKTE_TEIL2, type StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { bildAusDaten, istBildschirmgroesse, istText } from "@/lib/maus/screenshot";
import { Tastatur } from "@/components/tippen/Tastatur";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, useDemo } from "./Demo";
import { useMausKontext } from "./MausKontext";

type Vorschau = { url: string; breite: number; hoehe: number };

const ANZAHL = 3;

const SCHRITT_3_TEXT =
  "1. Mach wie in Schritt 1 einen Ausschnitt (⊞ Windows + Umschalt + S). " +
  "2. Unten rechts erscheint eine Meldung — klick darin auf »Markup und Freigabe«. " +
  "3. Erst jetzt öffnet sich das Fenster mit dem Speichern-Knopf 💾 (oder Strg + S): speichere das Bild. " +
  "4. Zieh die gespeicherte Datei hierher.";

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-block rounded-md border border-line bg-surface-hover px-1.5 py-0.5 text-xs font-bold shadow-[0_2px_0_var(--border)]">{children}</kbd>;
}

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
  const [datei3, setDatei3] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [ueber, setUeber] = useState(false);
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
    try { vorschau = await bildLaden(datei); } catch { gezaehlt.current = -1; return; }
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
    }
    const naechste = nr + 1;
    setTimeout(() => {
      setNr(naechste);
      setHinweis(null);
      gezaehlt.current = -1;
      fertigMelden(naechste);
    }, 900);
  }

  function einfuegen(daten: DataTransfer | null | undefined) {
    if (!daten || demo.aktiv || fertig || nr === 2) return;
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

  // Daneben fallen gelassene Dateien soll der Browser nicht öffnen.
  useEffect(() => {
    const halt = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", halt);
    window.addEventListener("drop", halt);
    return () => { window.removeEventListener("dragover", halt); window.removeEventListener("drop", halt); };
  }, []);

  function abgelegt(datei: File | undefined) {
    if (!datei || fertig || nr !== 2 || gezaehlt.current === nr) return;
    if (!datei.type.startsWith("image/")) {
      fehler.current += 1;
      setHinweis({ text: `»${datei.name}« ist kein Bild — zieh die gespeicherte Bilddatei hierher.`, gut: false });
      return;
    }
    gezaehlt.current = nr;
    setDatei3(datei.name);
    setHinweis({ text: "Gefunden und hineingezogen! ⭐", gut: true });
    const naechste = nr + 1;
    setTimeout(() => { setNr(naechste); fertigMelden(naechste); }, 900);
  }

  function vorfuehren() {
    const ecke = (start: boolean) => () => {
      const el = kartenRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return start ? { x: r.left + 8, y: r.top + 8 } : { x: r.right - 8, y: r.bottom - 8 };
    };
    demo.abspielen([
      { text: "Drücke ⊞ Windows + Umschalt + S.", tasten: ["MetaLeft", "ShiftLeft", "KeyS"] },
      { text: "Zieh mit gedrückter Maustaste einen Rahmen um die Karte.", taste: "halten", zu: ecke(true), aktion: () => setDemoRahmen(true) },
      { text: "Bis zur anderen Ecke — dann loslassen.", taste: "halten", zu: ecke(false) },
      { text: "Klick in dieses Feld und drücke Strg + V.", tasten: ["ControlLeft", "KeyV"], aktion: () => { setDemoRahmen(false); setDemoVorschau(true); } },
      { text: "Da ist das Bild!", taste: null },
    ]);
  }

  const aufgaben = [
    { text: "Ausschnitt: ⊞ Windows + Umschalt + S, Rahmen um die Karte ziehen, dann Strg + V einfügen." },
    { text: "Ganzer Bildschirm: Druck-Taste (oder ⊞ Windows + Druck) drücken, dann wieder einfügen." },
    { text: SCHRITT_3_TEXT },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="📸 Teil 2 · Bildschirmfoto"
        auftrag={<>Mach ein Bildschirmfoto von der bunten Karte — Ausschnitt, ganzer Bildschirm, dann speichern und wiederfinden.</>}
        punkte={Math.round((PUNKTE_TEIL2 * Math.min(nr, ANZAHL)) / ANZAHL)}
        onDemo={nr < 2 ? vorfuehren : undefined}
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
            onDragOver={e => { if (nr === 2) { e.preventDefault(); setUeber(true); } }}
            onDragLeave={() => setUeber(false)}
            onDrop={e => { if (nr === 2) { e.preventDefault(); setUeber(false); abgelegt(e.dataTransfer.files[0]); } }}
            data-testid="einfuegen-feld"
            className={
              "rounded-2xl border-4 border-dashed p-4 flex flex-col items-center gap-2 text-center min-h-40 justify-center outline-hidden " +
              (ueber ? "border-accent bg-surface-hover" : "border-line")
            }
          >
            {nr === 2 ? (
              datei3 ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="text-4xl">🏆</div>
                  <div className="font-bold">Gefunden: »{datei3}«</div>
                </div>
              ) : (
                <>
                  <div className="text-4xl">📥</div>
                  <div className="font-bold">Datei hierher ziehen</div>
                </>
              )
            ) : (
              <>
                {(nr === 0 ? bild1 : bild2) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(nr === 0 ? bild1 : bild2)!.url}
                    alt="Eingefügtes Bildschirmfoto"
                    className="max-h-40 rounded-lg shadow-sm"
                    data-testid={nr === 0 ? "vorschau-1" : "vorschau-2"}
                  />
                ) : demoVorschau ? (
                  <div aria-hidden className="w-32 h-20 rounded-lg bg-surface-hover border border-line flex items-center justify-center text-2xl">🖼️</div>
                ) : (
                  <div className="font-bold">Hier einfügen: Klick hinein und drücke <Kbd>Strg</Kbd> + <Kbd>V</Kbd></div>
                )}
              </>
            )}
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
              <span className="text-muted">oder <Kbd>⊞</Kbd> + <span className="inline-block rounded-md border border-accent bg-surface-hover px-2 py-1 text-xs font-bold">Druck</span></span>
            </div>
          )}
          {nr === 2 && (
            <ol className="flex flex-col gap-1 text-sm text-muted list-decimal list-inside">
              <li>Mach wie in Schritt 1 einen Ausschnitt (⊞ Windows + Umschalt + S).</li>
              <li>Unten rechts erscheint eine Meldung — klick darin auf »Markup und Freigabe«.</li>
              <li>Erst jetzt öffnet sich das Fenster mit dem Speichern-Knopf 💾 (oder Strg + S): speichere das Bild.</li>
              <li>Zieh die gespeicherte Datei hierher.</li>
            </ol>
          )}
        </div>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
