"use client";
/**
 * Lernpfad für Lehrkräfte (Etappen von Stufe 0 bis III, Fortschritt und
 * Notizen im Browser) und das Workshop-Paket für 90 Minuten im Kollegium.
 */
import { useEffect, useState } from "react";
import { STUFEN } from "@/lib/kikompass/raster";
import { baueDocx, herunterladen } from "@/lib/docx";
import { kopiereText } from "@/lib/zwischenablage";
import { WORKFLOWS } from "@/lib/kikompass/workflows";
import {
  DATENSCHUTZ_REGELN, ETAPPEN, PROMPT_FORMEL, WORKSHOP, einheitenVon, handoutDocx, workshopDocx,
  type Einheit, type Sprungziel,
} from "@/lib/kikompass/lernpfad";

type Stand = Record<string, { fertig?: boolean; notiz?: string }>;

export function Lernpfad({ speicherSchluessel, onSprung, onWorkflow }: {
  speicherSchluessel: string;
  onSprung: (ziel: Sprungziel) => void;
  onWorkflow: (id: string) => void;
}) {
  const [teil, setTeil] = useState<"pfad" | "workshop">("pfad");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="Lernpfad oder Workshop">
        <button className={teil === "pfad" ? "chip chip-on" : "chip"} onClick={() => setTeil("pfad")}>🎓 Mein Lernpfad</button>
        <button className={teil === "workshop" ? "chip chip-on" : "chip"} onClick={() => setTeil("workshop")}>👥 Workshop fürs Kollegium (90 Min.)</button>
      </div>
      {teil === "pfad"
        ? <Pfad speicherSchluessel={speicherSchluessel} onSprung={onSprung} onWorkflow={onWorkflow} />
        : <Workshop />}
    </div>
  );
}

function Pfad({ speicherSchluessel, onSprung, onWorkflow }: {
  speicherSchluessel: string;
  onSprung: (ziel: Sprungziel) => void;
  onWorkflow: (id: string) => void;
}) {
  const schluessel = `hp_kikompass_lernpfad_${speicherSchluessel}`;
  const [stand, setStand] = useState<Stand>({});
  const [geladenFuer, setGeladenFuer] = useState<string | null>(null);
  const [etappe, setEtappe] = useState(ETAPPEN[0].id);

  useEffect(() => {
    try { setStand(JSON.parse(localStorage.getItem(schluessel) ?? "{}") ?? {}); } catch { setStand({}); }
    setGeladenFuer(schluessel);
  }, [schluessel]);
  useEffect(() => {
    if (geladenFuer !== schluessel) return;
    try { localStorage.setItem(schluessel, JSON.stringify(stand)); } catch { /* privat */ }
  }, [stand, geladenFuer, schluessel]);

  const setze = (id: string, teil: { fertig?: boolean; notiz?: string }) =>
    setStand(alt => ({ ...alt, [id]: { ...alt[id], ...teil } }));
  const fertig = (id: string) => einheitenVon(id).filter(e => stand[e.id]?.fertig).length;
  const e = ETAPPEN.find(x => x.id === etappe)!;
  const stufe = STUFEN.find(s => s.id === e.stufe);

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <p className="text-sm text-muted">
        Kleine Einheiten von 5 bis 30 Minuten, von »noch nie ausprobiert« bis »eigene Workflows bauen«.
        Fang dort an, wo du stehst. Haken und Notizen bleiben in diesem Browser.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Etappen">
        {ETAPPEN.map(x => (
          <button key={x.id} onClick={() => setEtappe(x.id)} className={etappe === x.id ? "chip chip-on" : "chip"}>
            <strong>{x.titel}</strong>{" "}
            <span className="text-xs opacity-75">{fertig(x.id)}/{einheitenVon(x.id).length}</span>
          </button>
        ))}
      </nav>
      <div>
        <h3 className="text-xl font-semibold">{e.titel}</h3>
        <p className="text-sm text-muted">Stufe {e.stufe}{stufe ? ` · ${stufe.name}` : ""} · {e.ziel}</p>
      </div>
      {e.id === "start" && (
        <div className="card p-3 text-sm">
          <p className="font-medium">🔒 Fünf Datenschutzregeln</p>
          <ol className="list-decimal ml-5">{DATENSCHUTZ_REGELN.map(r => <li key={r}>{r}</li>)}</ol>
        </div>
      )}
      {e.id === "prompten" && (
        <div className="card p-3 text-sm">
          <p className="font-medium">🧪 Die Prompt-Formel</p>
          <ul className="ml-5 list-disc">{PROMPT_FORMEL.map(r => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {einheitenVon(e.id).map(x => (
          <EinheitKarte key={x.id} e={x} stand={stand[x.id] ?? {}} onChange={t => setze(x.id, t)}
            onSprung={onSprung} onWorkflow={onWorkflow} />
        ))}
      </ol>
    </div>
  );
}

function EinheitKarte({ e, stand, onChange, onSprung, onWorkflow }: {
  e: Einheit;
  stand: { fertig?: boolean; notiz?: string };
  onChange: (t: { fertig?: boolean; notiz?: string }) => void;
  onSprung: (ziel: Sprungziel) => void;
  onWorkflow: (id: string) => void;
}) {
  const [kopiert, setKopiert] = useState(false);
  const wf = e.workflow ? WORKFLOWS.find(w => w.id === e.workflow) : undefined;
  async function kopieren() {
    if (e.prompt && await kopiereText(e.prompt)) { setKopiert(true); setTimeout(() => setKopiert(false), 1500); }
  }
  return (
    <li className={`card p-4 flex flex-col gap-2 ${stand.fertig ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold flex-1">{stand.fertig ? "✅" : "⬜"} {e.titel}</span>
        <span className="text-xs text-muted">⏱ {e.minuten} Min.</span>
      </div>
      <p className="text-sm text-muted">{e.ziel}</p>
      <p className="text-sm"><strong>Ausprobieren:</strong> {e.ausprobieren}</p>
      {e.prompt && (
        <div className="flex flex-col gap-1">
          <pre className="text-xs whitespace-pre-wrap rounded bg-surface p-2 border border-line font-sans">{e.prompt}</pre>
          <button className="btn-secondary text-sm self-start" onClick={kopieren}>{kopiert ? "✓ Kopiert" : "📋 Prompt kopieren"}</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {wf && <button className="btn-secondary text-sm" onClick={() => onWorkflow(wf.id)}>🔀 Workflow »{wf.titel}«</button>}
        {e.sprung && <button className="btn-secondary text-sm" onClick={() => onSprung(e.sprung!.ziel)}>{e.sprung.titel}</button>}
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span><strong>Nachdenken:</strong> {e.reflexion}</span>
        <textarea className="input min-h-16" value={stand.notiz ?? ""} onChange={ev => onChange({ notiz: ev.target.value })}
          aria-label={`Notiz zu ${e.titel}`} placeholder="Deine Notiz (bleibt in diesem Browser)" />
      </label>
      <label className="flex items-center gap-2 text-sm self-start">
        <input type="checkbox" checked={!!stand.fertig} onChange={ev => onChange({ fertig: ev.target.checked })} />
        Erledigt
      </label>
    </li>
  );
}

function Workshop() {
  const zeiten = WORKSHOP.phasen.reduce<{ von: number; bis: number }[]>(
    (l, p) => [...l, { von: l.at(-1)?.bis ?? 0, bis: (l.at(-1)?.bis ?? 0) + p.minuten }], []);
  async function laden(was: "ablauf" | "handout") {
    const bloecke = was === "ablauf" ? workshopDocx() : handoutDocx();
    herunterladen(await baueDocx(bloecke), was === "ablauf" ? "Prompt-Werkstatt_Ablaufplan.docx" : "KI_im_Unterricht_Handout.docx");
  }
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h3 className="text-xl font-semibold">{WORKSHOP.titel}</h3>
        <p className="text-sm text-muted">{WORKSHOP.fuer}</p>
        <p className="text-sm mt-1"><strong>Ziel:</strong> {WORKSHOP.ziel}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => laden("ablauf")}>⬇ Ablaufplan als Word</button>
        <button className="btn-secondary" onClick={() => laden("handout")}>⬇ Handout als Word</button>
      </div>
      <div className="card p-3 text-sm">
        <p className="font-medium">Vorbereitung</p>
        <ul className="flex flex-col gap-1 mt-1">{WORKSHOP.vorbereitung.map(v => <li key={v}>☐ {v}</li>)}</ul>
      </div>
      <ol className="flex flex-col gap-2">
        {WORKSHOP.phasen.map((p, i) => (
          <li key={p.titel} className="card p-3 flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xs font-mono text-muted">{zeiten[i].von}–{zeiten[i].bis} Min.</span>
              <span className="font-semibold">{p.titel}</span>
            </div>
            <p className="text-sm">{p.ablauf}</p>
            <p className="text-xs text-muted">Material: {p.material}</p>
          </li>
        ))}
      </ol>
      <div className="card p-3 text-sm">
        <p className="font-medium">Tipps für die Moderation</p>
        <ul className="ml-5 list-disc">{WORKSHOP.tipps.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    </div>
  );
}
