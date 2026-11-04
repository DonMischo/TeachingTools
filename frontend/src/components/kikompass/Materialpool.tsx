"use client";
/**
 * Gemeinsamer Materialpool: Lehrkräfte teilen Material, verschlagwortet nach
 * Feld im Raster und Dimension. Für alle Lehrkräfte sichtbar. Ändern und
 * löschen darf nur, wer es eingestellt hat (oder ein Admin).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type KiKompassMaterial, type KiKompassMaterialIn } from "@/lib/api";
import { BEREICHE, STUFEN, type BereichId, type StufeId } from "@/lib/kikompass/raster";
import { DIMENSIONEN, MATERIALARTEN } from "@/lib/kikompass/werkstatt";
import { baueDocx, herunterladen, type DocxBlock } from "@/lib/docx";
import { datumDe } from "./Raster";

export const LEERES_MATERIAL: KiKompassMaterialIn = {
  titel: "", text: "", fach: "", klassen: "", bereich: "reflektieren", stufe: "Ia", dimension: "ueber",
  art: MATERIALARTEN[0], link: null,
};

const bereichVon = (id: string) => BEREICHE.find(b => b.id === id);
const dimensionVon = (id: string) => DIMENSIONEN.find(d => d.id === id);

async function alsWord(m: KiKompassMaterial) {
  const b = bereichVon(m.bereich), s = STUFEN.find(x => x.id === m.stufe);
  const bloecke: DocxBlock[] = [
    { art: "titel", text: m.titel },
    { art: "text", text: `KI-Kompetenz: ${b?.name} · Stufe ${s?.id} ${s?.name} · ${dimensionVon(m.dimension)?.name}`, grau: true },
    { art: "text", text: [m.fach, m.klassen && `Klasse ${m.klassen}`, m.art].filter(Boolean).join(" · "), grau: true },
    ...m.text.split(/\n/).map(z => ({ art: "text" as const, text: z })),
    ...(m.link ? [{ art: "text" as const, text: `Link: ${m.link}` }] : []),
    { art: "text", text: `Aus dem Materialpool des KI-Kompass, geteilt von ${m.autor}.`, klein: true, grau: true },
  ];
  herunterladen(await baueDocx(bloecke), `${m.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_").slice(0, 60)}.docx`);
}

export function Materialpool({ vorlage, onVorlageVerbraucht }: {
  /** Vorbelegung aus »Material erstellen«. */
  vorlage: KiKompassMaterialIn | null;
  onVorlageVerbraucht: () => void;
}) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<{ bereich: string; stufe: string; dimension: string; q: string }>({ bereich: "", stufe: "", dimension: "", q: "" });
  const [offen, setOffen] = useState<number | null>(null);
  const [formular, setFormular] = useState<{ id: number | null; daten: KiKompassMaterialIn } | null>(
    vorlage ? { id: null, daten: vorlage } : null,
  );
  const [fehler, setFehler] = useState<string | null>(null);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["kikompass-material", filter],
    queryFn: () => api.kikompass.material(filter),
  });

  async function speichern() {
    if (!formular) return;
    setFehler(null);
    const daten = { ...formular.daten, link: formular.daten.link?.trim() || null };
    try {
      if (formular.id === null) await api.kikompass.materialAnlegen(daten);
      else await api.kikompass.materialAendern(formular.id, daten);
      setFormular(null);
      onVorlageVerbraucht();
      qc.invalidateQueries({ queryKey: ["kikompass-material"] });
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern hat nicht geklappt.");
    }
  }

  async function loeschen(m: KiKompassMaterial) {
    if (!window.confirm(`»${m.titel}« wirklich aus dem Pool löschen?`)) return;
    await api.kikompass.materialLoeschen(m.id).catch(() => setFehler("Löschen hat nicht geklappt."));
    qc.invalidateQueries({ queryKey: ["kikompass-material"] });
  }

  const setF = <K extends keyof KiKompassMaterialIn>(k: K, v: KiKompassMaterialIn[K]) =>
    setFormular(f => (f ? { ...f, daten: { ...f.daten, [k]: v } } : f));

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Material, das Kolleg·innen geteilt haben, sortiert nach dem Feld im Kompetenzraster. Teile auch deins: Was in AIS.chat
        entstanden ist, kommt hier nach deiner Überarbeitung hinein. Keine Schülernamen oder anderen personenbezogenen Daten.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <select className="input" aria-label="Bereich" value={filter.bereich} onChange={e => setFilter(f => ({ ...f, bereich: e.target.value }))}>
          <option value="">alle Bereiche</option>
          {BEREICHE.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
        </select>
        <select className="input" aria-label="Stufe" value={filter.stufe} onChange={e => setFilter(f => ({ ...f, stufe: e.target.value }))}>
          <option value="">alle Stufen</option>
          {STUFEN.map(s => <option key={s.id} value={s.id}>{s.id}: {s.name}</option>)}
        </select>
        <select className="input" aria-label="Dimension" value={filter.dimension} onChange={e => setFilter(f => ({ ...f, dimension: e.target.value }))}>
          <option value="">alle Dimensionen</option>
          {DIMENSIONEN.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="input" aria-label="Suche" placeholder="Suche …" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} />
      </div>

      {!formular && (
        <button className="btn-primary self-start" onClick={() => setFormular({ id: null, daten: { ...LEERES_MATERIAL } })}>➕ Material teilen</button>
      )}

      {formular && (
        <div className="card p-4 flex flex-col gap-3">
          <h4 className="font-semibold">{formular.id === null ? "Material teilen" : "Material bearbeiten"}</h4>
          <label className="label">Titel<input className="input w-full" maxLength={200} value={formular.daten.titel} onChange={e => setF("titel", e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">Fach<input className="input w-full" maxLength={60} value={formular.daten.fach} onChange={e => setF("fach", e.target.value)} /></label>
            <label className="label">Klassen<input className="input w-full" maxLength={20} placeholder="z. B. 7-8" value={formular.daten.klassen} onChange={e => setF("klassen", e.target.value)} /></label>
            <label className="label">Bereich
              <select className="input w-full" value={formular.daten.bereich} onChange={e => setF("bereich", e.target.value as BereichId)}>
                {BEREICHE.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
              </select>
            </label>
            <label className="label">Stufe
              <select className="input w-full" value={formular.daten.stufe} onChange={e => setF("stufe", e.target.value as StufeId)}>
                {STUFEN.map(s => <option key={s.id} value={s.id}>{s.id}: {s.name}</option>)}
              </select>
            </label>
            <label className="label">Dimension
              <select className="input w-full" value={formular.daten.dimension} onChange={e => setF("dimension", e.target.value)}>
                {DIMENSIONEN.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="label">Materialart<input className="input w-full" maxLength={80} list="kikompass-arten" value={formular.daten.art} onChange={e => setF("art", e.target.value)} /></label>
            <datalist id="kikompass-arten">{MATERIALARTEN.map(a => <option key={a} value={a} />)}</datalist>
          </div>
          <label className="label">Inhalt
            <textarea className="input w-full min-h-40" maxLength={20000} value={formular.daten.text} onChange={e => setF("text", e.target.value)}
              placeholder="Aufgaben, Ablauf, Lösungshinweise …" />
          </label>
          <label className="label">Link (optional, z. B. zur Datei in der Schulcloud)
            <input className="input w-full" maxLength={500} placeholder="https://…" value={formular.daten.link ?? ""} onChange={e => setF("link", e.target.value)} />
          </label>
          {fehler && <p className="text-sm text-bad">{fehler}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!formular.daten.titel.trim()} onClick={speichern}>Speichern</button>
            <button className="btn-secondary" onClick={() => { setFormular(null); onVorlageVerbraucht(); }}>Abbrechen</button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-muted">Lade …</p>}
      {isError && <p className="text-sm text-bad">Der Materialpool ließ sich nicht laden.</p>}
      {!isLoading && data.length === 0 && <p className="card p-4 text-sm">Hier ist noch nichts. Teile das erste Material!</p>}
      <ul className="flex flex-col gap-2">
        {data.map(m => {
          const b = bereichVon(m.bereich);
          return (
            <li key={m.id} className="card p-3 flex flex-col gap-1" style={{ borderLeft: `4px solid ${b?.farbe ?? "transparent"}` }}>
              <button className="text-left font-medium" onClick={() => setOffen(offen === m.id ? null : m.id)}>
                {m.titel}
              </button>
              <p className="text-xs text-muted">
                {b?.icon} {b?.name} · Stufe {m.stufe} · {dimensionVon(m.dimension)?.name}
                {m.fach && ` · ${m.fach}`}{m.klassen && ` · Kl. ${m.klassen}`}{m.art && ` · ${m.art}`}
                {` · ${m.autor}, ${datumDe(m.erstellt_am.slice(0, 10))}`}
              </p>
              {offen === m.id && (
                <div className="flex flex-col gap-2 mt-1">
                  {m.text && <p className="text-sm whitespace-pre-wrap">{m.text}</p>}
                  {m.link && <a className="text-sm underline break-all" href={m.link} target="_blank" rel="noreferrer noopener">{m.link}</a>}
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => alsWord(m)}>⬇️ Als Word</button>
                    {m.eigen && <button className="btn-secondary" onClick={() => setFormular({ id: m.id, daten: { ...m } })}>✏️ Bearbeiten</button>}
                    {m.eigen && <button className="btn-danger" onClick={() => loeschen(m)}>🗑 Löschen</button>}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
