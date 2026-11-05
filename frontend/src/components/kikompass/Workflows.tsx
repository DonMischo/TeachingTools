"use client";
/**
 * Workflow-Bibliothek: Karten zur Auswahl, dann der Ablauf Schritt für Schritt
 * (farbig nach Akteur, Prompts zum Kopieren, Checklisten, Schleifen) und auf
 * Wunsch als Flussdiagramm in der Diagramm-Werkstatt.
 */
import { useState } from "react";
import Link from "next/link";
import { STUFEN } from "@/lib/kikompass/raster";
import { kopiereText } from "@/lib/zwischenablage";
import { DIAGRAMM_IMPORT } from "@/lib/diagramm/vorlagen";
import {
  AKTEURE, WORKFLOWS, alsD2, fuelle, fuerGruppe, ziel,
  type Schritt, type Werte, type Workflow, type Zielgruppe,
} from "@/lib/kikompass/workflows";

const stufeName = (id: string) => STUFEN.find(s => s.id === id)?.name ?? id;

export function Workflows({ lehrkraft, mitWerkstatt }: {
  lehrkraft: boolean;
  /** Diagramm-Werkstatt braucht ein Konto. */
  mitWerkstatt: boolean;
}) {
  const [gruppe, setGruppe] = useState<Zielgruppe>(lehrkraft ? "lehrkraft" : "lernende");
  const [offen, setOffen] = useState<string | null>(null);
  const w = WORKFLOWS.find(x => x.id === offen);

  if (w) return <WorkflowAnsicht w={w} mitWerkstatt={mitWerkstatt} onZurueck={() => setOffen(null)} />;

  const liste = fuerGruppe(gruppe);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 max-w-3xl">
        <h2 className="text-lg font-semibold">🔀 Workflows mit KI</h2>
        <p className="text-sm text-muted">
          Wiederkehrende Abläufe Schritt für Schritt: wer was tut, welcher Prompt passt und was du prüfen musst.
          Jeden Ablauf gibt es auch als Flussdiagramm zum Anpassen.
        </p>
      </div>
      {lehrkraft && (
        <div className="flex gap-2" role="group" aria-label="Zielgruppe">
          <button className={gruppe === "lehrkraft" ? "chip chip-on" : "chip"} onClick={() => setGruppe("lehrkraft")}>👩‍🏫 Für Lehrkräfte</button>
          <button className={gruppe === "lernende" ? "chip chip-on" : "chip"} onClick={() => setGruppe("lernende")}>🎒 Für Lernende</button>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
        {liste.map(x => (
          <button key={x.id} onClick={() => setOffen(x.id)} className="card p-4 text-left flex flex-col gap-1 hover:border-accent">
            <span className="font-semibold">{x.icon} {x.titel}</span>
            <span className="text-xs text-muted">Stufe {x.stufe} · {stufeName(x.stufe)} · {x.schritte.length} Schritte</span>
            <span className="text-sm">{x.kurz}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkflowAnsicht({ w, mitWerkstatt, onZurueck }: { w: Workflow; mitWerkstatt: boolean; onZurueck: () => void }) {
  const [werte, setWerte] = useState<Werte>({});
  const [ttZiel, setTtZiel] = useState(w.ttZiele?.[0]?.id ?? "");
  const tt = w.ttZiele?.find(t => t.id === ttZiel);
  const alle: Werte = { ...werte, werkzeug: tt?.name };
  const brauchtFelder = w.schritte.some(s => s.prompt);

  function inWerkstatt() {
    try {
      localStorage.setItem(DIAGRAMM_IMPORT, JSON.stringify({ name: w.titel, code: alsD2(w) }));
      window.open("/simulationen/diagramme", "_blank");
    } catch { /* ohne Speicher */ }
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <button className="text-sm text-muted hover:text-fg self-start" onClick={onZurueck}>← Alle Workflows</button>
      <div>
        <h2 className="text-lg font-semibold">{w.icon} {w.titel}</h2>
        <p className="text-sm text-muted">Stufe {w.stufe} · {stufeName(w.stufe)}</p>
        <p className="text-sm mt-1">{w.kurz}</p>
      </div>
      {w.hinweis && <p className="text-sm rounded border border-line p-3">💡 {w.hinweis}</p>}

      {(brauchtFelder || w.ttZiele) && (
        <div className="card p-3 flex flex-wrap gap-3 items-end">
          {w.ttZiele && (
            <label className="flex flex-col gap-1 text-sm">TT-Werkzeug
              <select className="input" value={ttZiel} onChange={e => setTtZiel(e.target.value)}>
                {w.ttZiele.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          {brauchtFelder && (["thema", "fach", "klasse"] as const).map(k => (
            <label key={k} className="flex flex-col gap-1 text-sm">{{ thema: "Thema", fach: "Fach", klasse: "Klasse" }[k]}
              <input className="input" value={werte[k] ?? ""} onChange={e => setWerte(v => ({ ...v, [k]: e.target.value }))}
                placeholder={{ thema: "z. B. Photosynthese", fach: "z. B. Biologie", klasse: "z. B. 7" }[k]} />
            </label>
          ))}
          {brauchtFelder && <p className="text-xs text-muted w-full">Die Angaben landen direkt in den Prompts. Keine Namen oder persönlichen Daten.</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted" aria-label="Legende">
        {Object.values(AKTEURE).map(a => (
          <span key={a.name} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ background: a.farbe }} /> {a.icon} {a.name}
          </span>
        ))}
      </div>

      <ol className="flex flex-col gap-2">
        {w.schritte.map((s, i) => (
          <SchrittKarte key={s.id} w={w} s={s} nr={i + 1} werte={alle} tt={tt} />
        ))}
        <li className="self-start rounded-full border border-line px-4 py-1 text-sm">🏁 Fertig</li>
      </ol>

      <div className="flex flex-wrap gap-2 items-center">
        {mitWerkstatt && <button className="btn-secondary" onClick={inWerkstatt}>🔀 Als Flussdiagramm in der Diagramm-Werkstatt öffnen</button>}
        <span className="text-xs text-muted">Dort kannst du Schritte ändern, ergänzen und das Diagramm als Bild speichern.</span>
      </div>
    </div>
  );
}

function SchrittKarte({ w, s, nr, werte, tt }: { w: Workflow; s: Schritt; nr: number; werte: Werte; tt?: { name: string; href: string; hinweis?: string } }) {
  const a = AKTEURE[s.wer];
  const [kopiert, setKopiert] = useState(false);
  const prompt = s.prompt ? fuelle(s.prompt, werte) : null;
  const link = s.link === "tt-ziel" ? (tt ? { href: tt.href, label: `↗ ${tt.name} öffnen` } : null) : s.link;

  async function kopieren() {
    if (prompt && await kopiereText(prompt)) { setKopiert(true); setTimeout(() => setKopiert(false), 1500); }
  }

  const sprung = (id: string) => {
    const i = ziel(w, id);
    return i < 0 ? "zum Ende" : `zurück zu Schritt ${i + 1}`;
  };

  return (
    <li className="flex flex-col gap-2">
      <div className="rounded-lg border border-line p-3 flex flex-col gap-2" style={{ borderLeft: `6px solid ${a.farbe}` }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{nr}. {s.titel}</span>
          <span className="text-xs rounded-full px-2 py-0.5" style={{ background: a.farbe, color: "#1f2937" }}>{a.icon} {a.name}</span>
        </div>
        <p className="text-sm">{s.text}</p>
        {s.link === "tt-ziel" && tt?.hinweis && <p className="text-xs text-muted">💡 {tt.hinweis}</p>}
        {prompt && (
          <div className="flex flex-col gap-1">
            <pre className="text-xs whitespace-pre-wrap rounded bg-surface p-2 border border-line font-sans">{prompt}</pre>
            <button className="btn-secondary text-sm self-start" onClick={kopieren}>{kopiert ? "✓ Kopiert" : "📋 Prompt kopieren"}</button>
          </div>
        )}
        {s.check && (
          <ul className="text-sm flex flex-col gap-1">
            {s.check.map(c => <li key={c} className="flex gap-2"><span aria-hidden>☐</span>{c}</li>)}
          </ul>
        )}
        {link && <Link href={link.href} target="_blank" className="text-sm text-accent hover:underline self-start">{link.label}</Link>}
      </div>
      {s.pruefe && (
        <div className="ml-6 rounded-lg border border-dashed border-line p-2 text-sm flex flex-col gap-1" style={{ background: "#fef08a33" }}>
          <span>❓ <b>{s.pruefe.frage}</b></span>
          <span className="text-xs">✅ ja: {s.pruefe.ja ? `weiter mit Schritt ${ziel(w, s.pruefe.ja) + 1}` : "weiter"} · ↩ nein: {sprung(s.pruefe.nein)}</span>
          {s.pruefe.neinText && <span className="text-xs text-muted">{s.pruefe.neinText}</span>}
        </div>
      )}
    </li>
  );
}
