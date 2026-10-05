"use client";
/**
 * Teil 3 · Suchen: Windows-11-Suche statt Doppelklick auf den Desktop.
 *
 * Vier Aufgaben — App, Datei, Einstellung, kurzgetippt + Enter. Fenster sind
 * Platzhalter: es geht ums Finden, nicht ums Bedienen der App dahinter.
 */
import { useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { akzentFarbe, type AppId, type Treffer } from "@/lib/maus/windows";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { Startmenue } from "./windows/Startmenue";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";

const ANZAHL_AUFGABEN = 4;

const AUFGABEN = [
  "Öffne Paint über die Suche.",
  "Finde die Datei »Referat Planeten« und öffne sie.",
  "Öffne über die Suche die Einstellung »Farben« (dort gibt es den dunklen Modus).",
  "Tippe nur die ersten Buchstaben: öffne den Rechner mit »rech« und der Eingabetaste.",
];

type OffenesFenster = { id: string; titel: string; app: AppId };

export default function StufeSuche({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, benutzer } = useWindows();
  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState(0);
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const [startOffen, setStartOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [autoFocus, setAutoFocus] = useState(false);
  const [fenster, setFenster] = useState<OffenesFenster[]>([]);
  const [aktiv, setAktiv] = useState<string | null>(null);

  const start = useRef(performance.now());
  const gemeldet = useRef(false);
  const rahmen = useRef<HTMLDivElement>(null);
  const demo = useDemo(() => { setStartOffen(false); setSuchText(""); setFenster([]); setAktiv(null); });

  const fertig = schritt >= ANZAHL_AUFGABEN;

  function schliesseStart() {
    setStartOffen(false);
    setSuchText("");
  }

  function oeffneFenster(id: string, titel: string, app: AppId) {
    if (fenster.some(f => f.id === id)) { setAktiv(id); return; }
    setFenster(f => [...f, { id, titel, app }]);
    setAktiv(id);
  }

  function schliesseFenster(id: string) {
    setFenster(f => f.filter(w => w.id !== id));
    setAktiv(a => (a === id ? null : a));
  }

  function melden(geloest: number) {
    if (gemeldet.current) return;
    gemeldet.current = true;
    const dauerMs = Math.round(performance.now() - start.current);
    const { punkte, details } = wertung({ stufe: "suche", geloest, anzahl: ANZAHL_AUFGABEN, dauerMs, fehler });
    onFertig({ punkte, dauerMs, details });
  }

  function weiterSchritt(text: string) {
    const naechster = schritt + 1;
    setSchritt(naechster);
    setHinweis({ text, gut: true });
    schliesseStart();
    if (naechster === ANZAHL_AUFGABEN) {
      melden(naechster);
    }
  }

  function falscheWahl() {
    if (demo.aktiv) return;
    setFehler(f => f + 1);
    setHinweis({ text: "Das war nicht die gesuchte Aufgabe — probier es nochmal.", gut: false });
  }

  function apptrefferGewaehlt(id: AppId) {
    if (schritt === 0 && id === "paint") { oeffneFenster("app:paint", "Paint", "paint"); weiterSchritt("Paint ist offen! ⭐"); return; }
    if (schritt === 3 && id === "rechner") {
      if (suchText.trim().length <= 4) { oeffneFenster("app:rechner", "Rechner", "rechner"); weiterSchritt("Nur ein paar Buchstaben reichen! ⭐"); return; }
      setHinweis({ text: "Fast — probier es mit weniger Buchstaben.", gut: false });
      return;
    }
    oeffneFenster(`app:${id}`, "App", id);
    falscheWahl();
  }

  function treffer(t: Treffer) {
    if (fertig || demo.aktiv) return;
    if (t.art === "app") { apptrefferGewaehlt(t.id); return; }
    if (t.art === "datei") {
      if (schritt === 1 && t.id === "referat") { oeffneFenster(`datei:${t.id}`, t.name, t.app); weiterSchritt("Gefunden und geöffnet! ⭐"); return; }
      oeffneFenster(`datei:${t.id}`, t.name, t.app);
      falscheWahl();
      return;
    }
    if (t.art === "einstellung") {
      if (schritt === 2 && t.id === "farben") { oeffneFenster("einstellung:farben", "Einstellungen – Farben", "einstellungen"); weiterSchritt("Die Einstellung ist offen! ⭐"); return; }
      oeffneFenster(`einstellung:${t.id}`, `Einstellungen – ${t.name}`, "einstellungen");
      falscheWahl();
    }
  }

  function startAppGewaehlt(id: AppId) {
    treffer({ art: "app", id, name: id });
  }

  function desktopSymbolKlick(id: AppId) {
    if (id === "paint" && schritt === 0 && !fertig) {
      setHinweis({ text: "Das ging über den Desktop — probier die Suche.", gut: false });
    }
  }

  function vorfuehren() {
    const schritte: DemoSchritt[] = [
      { text: "Zeige auf die Suche.", zu: () => mitte(rahmen.current?.querySelector("[data-suche]") ?? null), aktion: () => setStartOffen(true) },
      { text: "Klicken …", taste: "links" },
    ];
    if (schritt === 0) {
      schritte.push(
        { text: "»paint« tippen.", tasten: ["KeyP", "KeyA", "KeyI", "KeyN", "KeyT"], aktion: () => setSuchText("paint") },
        { text: "Auf Paint klicken.", taste: "links", aktion: () => { oeffneFenster("app:paint", "Paint", "paint"); weiterSchritt("Paint ist offen! ⭐"); } },
      );
    } else if (schritt === 1) {
      schritte.push(
        { text: "»referat« tippen.", tasten: ["KeyR", "KeyE", "KeyF"], aktion: () => setSuchText("referat") },
        { text: "Auf die Datei klicken.", taste: "links", aktion: () => { oeffneFenster("datei:referat", "Referat Planeten.docx", "word"); weiterSchritt("Gefunden und geöffnet! ⭐"); } },
      );
    } else if (schritt === 2) {
      schritte.push(
        { text: "»dunkel« tippen.", tasten: ["KeyD", "KeyU"], aktion: () => setSuchText("dunkel") },
        { text: "Auf »Farben« klicken.", taste: "links", aktion: () => { oeffneFenster("einstellung:farben", "Einstellungen – Farben", "einstellungen"); weiterSchritt("Die Einstellung ist offen! ⭐"); } },
      );
    } else {
      schritte.push(
        { text: "»rech« tippen — mehr braucht es nicht.", tasten: ["KeyR", "KeyE", "KeyC", "KeyH"], aktion: () => setSuchText("rech") },
        { text: "Eingabetaste drücken.", tasten: ["Enter"], aktion: () => { oeffneFenster("app:rechner", "Rechner", "rechner"); weiterSchritt("Nur ein paar Buchstaben reichen! ⭐"); } },
      );
    }
    demo.abspielen(schritte);
  }

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="🔍 Teil 3 · Suchen"
        auftrag={fertig
          ? <>Super — du findest jetzt alles über die Suche!</>
          : <>{AUFGABEN[schritt]}<div data-zusatz className="text-xs text-muted mt-1">💡 Klicke auf die Suche in der Taskleiste oder auf Start.</div></>}
        punkte={wertung({ stufe: "suche", geloest: Math.min(schritt, ANZAHL_AUFGABEN), anzahl: ANZAHL_AUFGABEN, dauerMs: Math.round(performance.now() - start.current), fehler }).punkte}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <WindowsDesktop
          aussehen={aussehen}
          rahmenRef={rahmen}
          offen={fenster.map(f => f.app)}
          aktiv={fenster.find(f => f.id === aktiv)?.app ?? null}
          onSymbol={id => desktopSymbolKlick(id)}
          onTaskleiste={id => { const treff = fenster.find(f => f.app === id); if (treff) setAktiv(treff.id); }}
          onStart={() => setStartOffen(o => !o)}
          onSuche={() => { setStartOffen(true); setAutoFocus(true); }}
          startOffen={startOffen}
          overlay={startOffen && (
            <Startmenue
              suchText={suchText}
              onSuchText={t => { setSuchText(t); if (t.length === 0) setAutoFocus(false); }}
              angeheftet={aussehen.taskleiste}
              onApp={startAppGewaehlt}
              onTreffer={treffer}
              benutzer={benutzer}
              profilTier={aussehen.profilTier}
              dunkel={aussehen.dunkel}
              akzent={akzentFarbe(aussehen.akzent)}
              hilfe={hilfe}
              autoFocusSuche={autoFocus}
              onSchliessen={schliesseStart}
            />
          )}
        >
          {fenster.map(f => (
            <div
              key={f.id}
              className="pointer-events-auto absolute rounded-lg border border-[#0000001f] bg-white shadow-xl overflow-hidden"
              style={{ left: "8%", top: "8%", width: "60%", height: "55%", zIndex: aktiv === f.id ? 10 : 1 }}
              onPointerDown={() => setAktiv(f.id)}
            >
              <div className="flex items-center gap-2 px-2 py-1.5 border-b border-[#0000001a] bg-[#f3f3f3] text-sm font-bold">
                <span className="flex-1 truncate">{f.titel}</span>
                <button type="button" aria-label={`${f.titel} schließen`} onClick={() => schliesseFenster(f.id)} className="w-6 h-6 rounded-sm hover:bg-[#00000014]">✕</button>
              </div>
              <div className="p-4 text-sm text-[#555]">{f.titel}</div>
            </div>
          ))}
        </WindowsDesktop>

        <aside className="card p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          <ul className="flex flex-col gap-1.5">
            {AUFGABEN.map((a, i) => (
              <li key={i} className={"text-sm flex gap-2 " + (i === schritt ? "font-bold" : i < schritt ? "text-muted" : "")}>
                <span>{i < schritt ? "✅" : i === schritt ? "👉" : "⬜"}</span>
                <span>{a}</span>
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

