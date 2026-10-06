"use client";
/**
 * Schichtenmodell — ein Foto reist von Erfurt nach Tokio.
 * Idee und Geschichte: rick.theengineer (Instagram).
 *
 * Kennenlernen: Reise (3D-Stapel, echte Bytes), Weg (Karte), Pakete (TCP bei Verlust), Wissen
 * Anwenden:     Mission (Wort → ASCII → Bits → DNS → packen → routen), Fehlersuche
 * Oben umschaltbar: OSI (7 Schichten) oder TCP/IP (4).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { packe } from "@/lib/schichten/kapselung";
import { wahl, type Vorgabe } from "@/lib/vorgabe";
import { kb, type Modell } from "./Bausteine";
import { fotoAusDatei, katzenFoto, textInhalt, type Inhalt } from "./inhalt";
import Reise from "./Reise";
import Weg from "./Weg";
import Pakete from "./Pakete";
import Wissen from "./Wissen";
import Fehlersuche from "./Fehlersuche";
import Mission from "./spiel/Mission";

const REITER = [
  { id: "reise", ebene: "kennen", icon: "📸", label: "Reise" },
  { id: "weg", ebene: "kennen", icon: "🗺️", label: "Weg" },
  { id: "pakete", ebene: "kennen", icon: "📦", label: "Pakete" },
  { id: "wissen", ebene: "kennen", icon: "📘", label: "Wissen" },
  { id: "mission", ebene: "anwenden", icon: "🎮", label: "Mission" },
  { id: "fehler", ebene: "anwenden", icon: "🔧", label: "Fehlersuche" },
] as const;
type Reiter = (typeof REITER)[number]["id"];

const chip = (an: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${an ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`;

/** `vorgabe` (TaskCrawler-Station): { reiter: "reise" | "weg" | "pakete" | "wissen" | "mission" | "fehler", modell?: "osi" | "tcpip" } */
export default function Schichtenmodell({ action, vorgabe }: { action?: ReactNode; vorgabe?: Vorgabe }) {
  const fest = wahl(vorgabe, "reiter", REITER.map(r => r.id));
  const [reiter, setReiter] = useState<Reiter>(fest ?? "reise");
  const [modell, setModell] = useState<Modell>(wahl(vorgabe, "modell", ["osi", "tcpip"] as const) ?? "osi");
  const [inhalt, setInhalt] = useState<Inhalt | null>(null);

  useEffect(() => {
    let aus = false;
    katzenFoto().then(i => { if (!aus) setInhalt(i); }).catch(() => { if (!aus) setInhalt(textInhalt("Grüße aus Erfurt! 🐱")); });
    return () => { aus = true; };
  }, []);

  const ebene = REITER.find(r => r.id === reiter)!.ebene;
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-seite mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">📶 Schichtenmodell</h1>
          <p className="text-muted text-sm mt-1">Lena schickt ihrem Bruder in Tokio ein Foto. In der einen Sekunde bis zur Ankunft geht es durch sieben Schichten hinunter, um die halbe Welt und wieder hinauf.</p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!fest && (
          <div className="inline-flex flex-wrap rounded-xl border border-line p-1 bg-surface gap-1">
            <span className="self-center px-2 text-xs font-bold text-muted uppercase">Kennenlernen</span>
            {REITER.filter(r => r.ebene === "kennen").map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
            <span className="self-center px-2 text-xs font-bold text-muted uppercase border-l border-line ml-1">Anwenden</span>
            {REITER.filter(r => r.ebene === "anwenden").map(r => <button key={r.id} onClick={() => setReiter(r.id)} className={chip(reiter === r.id)}>{r.icon} {r.label}</button>)}
          </div>
        )}
        <div className="inline-flex rounded-xl border border-line p-1 bg-surface ml-auto" title="Welches Modell?">
          <button className={chip(modell === "osi")} onClick={() => setModell("osi")}>OSI · 7</button>
          <button className={chip(modell === "tcpip")} onClick={() => setModell("tcpip")}>TCP/IP · 4</button>
        </div>
      </div>

      {ebene === "kennen" && reiter !== "wissen" && reiter !== "pakete" && <InhaltWahl inhalt={inhalt} setInhalt={setInhalt} />}
      {reiter === "reise" && (inhalt ? <MitReise inhalt={inhalt}>{r => <Reise reise={r} inhalt={inhalt} modell={modell} zurKarte={() => setReiter("weg")} />}</MitReise> : <Laedt />)}
      {reiter === "weg" && (inhalt ? <MitReise inhalt={inhalt}>{r => <Weg reise={r} modell={modell} />}</MitReise> : <Laedt />)}
      {reiter === "pakete" && <Pakete />}
      {reiter === "wissen" && <Wissen />}
      {reiter === "mission" && <Mission modell={modell} />}
      {reiter === "fehler" && <Fehlersuche modell={modell} />}
    </div>
  );
}

function Laedt() {
  return <p className="text-sm text-muted">Foto wird vorbereitet …</p>;
}

function MitReise({ inhalt, children }: { inhalt: Inhalt; children: (r: ReturnType<typeof packe>) => ReactNode }) {
  const reise = useMemo(() => packe(inhalt.bytes, inhalt.art, inhalt.roh), [inhalt]);
  return <>{children(reise)}</>;
}

function InhaltWahl({ inhalt, setInhalt }: { inhalt: Inhalt | null; setInhalt: (i: Inhalt) => void }) {
  const datei = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("Grüße aus Erfurt! 🐱");
  const [fehler, setFehler] = useState<string | null>(null);
  return (
    <div className="card p-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="label">Was schickt Lena?</span>
      <button className="chip" onClick={() => katzenFoto().then(setInhalt).catch(() => setFehler("Foto ging nicht"))}>🐈 Katzenfoto</button>
      <button className="chip" onClick={() => datei.current?.click()}>📷 Eigenes Foto</button>
      <input ref={datei} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) fotoAusDatei(f).then(setInhalt).catch(() => setFehler("Dieses Bild kann der Browser nicht lesen.")); e.target.value = ""; }} />
      <input className="input w-56" value={text} onChange={e => setText(e.target.value)} maxLength={400} aria-label="Eigener Text" />
      <button className="chip" onClick={() => setInhalt(textInhalt(text))}>✏️ Text schicken</button>
      {inhalt && <span className="ml-auto text-muted">Gerade: <b className="text-fg">{inhalt.name}</b>, {kb(inhalt.bytes.length)}</span>}
      {fehler && <span className="text-bad">{fehler}</span>}
      <span className="w-full text-xs text-muted">Eigene Fotos bleiben in deinem Browser — nichts wird hochgeladen.</span>
    </div>
  );
}
