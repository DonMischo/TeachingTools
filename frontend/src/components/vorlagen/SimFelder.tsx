"use client";
/**
 * Werkzeug (Simulation) mit Einstellungen wählen — wie an TaskCrawler-Aufgaben.
 * Die Einstellungen je Werkzeug kommen aus dem Katalog (`api.exitgame.katalog`,
 * `werkzeuge`); genutzt im TaskCrawler-Formular und an Fragmente-Clippings.
 */
import type { ExitGameSim } from "@/lib/api";
import { Feld } from "./felder";
import { EPOCHEN, MEDIEN } from "@/lib/medien/medien";

export type Katalog = {
  ansichten: Record<string, string>;
  stile: Record<string, string>;
  objekte: Record<string, string>;
  werkzeuge: Record<string, { name: string; config?: Record<string, string>; hinweis?: string }>;
};

/** Werkzeug-Einstellung als Text anzeigen, beim Tippen wieder in Zahl/Objekt wandeln. */
function alsText(v: unknown): string {
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}
function ausText(t: string): unknown {
  if (t.trim() === "") return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t.trim())) return Number(t);
  if (/^[[{]/.test(t.trim())) { try { return JSON.parse(t); } catch { /* noch unfertig getippt */ } }
  return t;
}

/** Werkzeug (Simulation) zum Ausprobieren: Auswahl und Einstellungen — an Aufgaben, Erklärungen und Beispielen. */
export function SimFelder({ sim, katalog, onChange }: { sim?: ExitGameSim; katalog: Katalog; onChange: (sim: ExitGameSim | undefined) => void }) {
  const werkzeug = sim ? katalog.werkzeuge[sim.tool] : undefined;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Feld label="Werkzeug zum Ausprobieren (optional)" hint={werkzeug?.hinweis}>
        <select className="input" value={sim?.tool ?? ""}
          onChange={e => onChange(e.target.value ? { tool: e.target.value, config: {} } : undefined)}>
          <option value="">— kein Werkzeug —</option>
          {Object.entries(katalog.werkzeuge).map(([k, w]) => <option key={k} value={k}>{w.name}</option>)}
        </select>
      </Feld>
      {sim && werkzeug?.config && Object.entries(werkzeug.config).map(([key, beschreibung]) => {
        const k = key.replace(/\?$/, "");
        // Geschichte der Medien: Station aus dem Zeitstrahl wählen statt Id tippen
        if (sim.tool === "medien" && k === "station") return (
          <Feld key={k} label="Station der Zeitreise" hint="Die Zeitreise öffnet genau dort — auch wenn die Station noch gesperrt wäre.">
            <select className="input text-sm" value={alsText(sim.config?.station)}
              onChange={e => {
                const config = { ...sim.config, ...(e.target.value ? { station: e.target.value, reiter: "zeitreise" } : {}) };
                if (!e.target.value) delete config.station;
                onChange({ ...sim, config });
              }}>
              <option value="">— Anfang bzw. erste offene Station —</option>
              {EPOCHEN.map(ep => (
                <optgroup key={ep.id} label={`${ep.icon} ${ep.name}`}>
                  {MEDIEN.filter(m => m.epoche === ep.id).map(m => <option key={m.id} value={m.id}>{m.icon} {m.name} ({m.jahrText})</option>)}
                </optgroup>
              ))}
            </select>
          </Feld>
        );
        return (
          <Feld key={k} label={`Einstellung »${k}«`} hint={beschreibung}>
            <input className="input text-sm" defaultValue={alsText(sim.config?.[k])}
              onBlur={e => {
                const config = { ...sim.config };
                const v = ausText(e.target.value);
                if (v === undefined) delete config[k]; else config[k] = v;
                onChange({ ...sim, config });
              }} />
          </Feld>
        );
      })}
    </div>
  );
}
