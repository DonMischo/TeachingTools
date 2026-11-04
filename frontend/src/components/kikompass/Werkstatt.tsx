"use client";
/**
 * Material-Werkstatt für Lehrkräfte: Material-Prompt zu einem Rasterfeld,
 * Aufgaben-Umbauer (fünf Dimensionen, KI-Resilienz) und Prüfen
 * (Prüfungsformat + Erwartungshorizont). Ergebnis: Prompts für AIS.chat und
 * Word-Vorlagen. Es wird nichts gespeichert.
 */
import { useState } from "react";
import { BEREICHE, STUFEN, saetze, type BereichId, type StufeId } from "@/lib/kikompass/raster";
import {
  DIMENSIONEN, EINSATZ, MATERIALARTEN, OPERATOREN, RESILIENZ, materialPrompt, umbauHinweise, umbauPrompt,
  type DimensionId, type EinsatzId, type MaterialWunsch, type Umbau,
} from "@/lib/kikompass/werkstatt";
import { baueDocx, herunterladen, type DocxBlock } from "@/lib/docx";

export type WerkstattTeil = "material" | "umbau" | "pruefen";

function Kopieren({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="btn-secondary self-start" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* ohne Zwischenablage */ }
    }}>{ok ? "✓ kopiert" : "📋 Prompt kopieren"}</button>
  );
}

function kopf(bereich: BereichId, stufe: StufeId, titel: string): DocxBlock[] {
  const b = BEREICHE.find(x => x.id === bereich)!;
  const s = STUFEN.find(x => x.id === stufe)!;
  return [
    { art: "titel", text: titel },
    { art: "text", text: `KI-Kompetenz: ${b.name} · Stufe ${s.id} ${s.name}`, grau: true },
    ...saetze(bereich, stufe).map(k => ({ art: "text" as const, text: `🎯 ${k.text}`, klein: true })),
    { art: "linie", text: "Name:" },
  ];
}

function FeldWahl({ bereich, stufe, onBereich, onStufe }: {
  bereich: BereichId; stufe: StufeId; onBereich: (b: BereichId) => void; onStufe: (s: StufeId) => void;
}) {
  return (
    <>
      <label className="label">Kompetenzbereich
        <select className="input w-full" value={bereich} onChange={e => onBereich(e.target.value as BereichId)}>
          {BEREICHE.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
        </select>
      </label>
      <label className="label">Stufe
        <select className="input w-full" value={stufe} onChange={e => onStufe(e.target.value as StufeId)}>
          {STUFEN.map(s => <option key={s.id} value={s.id}>{s.id}: {s.name}</option>)}
        </select>
      </label>
    </>
  );
}

export function Werkstatt({ teil, onTeil }: { teil: WerkstattTeil; onTeil: (t: WerkstattTeil) => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <nav className="flex flex-wrap gap-2">
        {([["material", "🧪 Material erstellen"], ["umbau", "🔁 Aufgabe umbauen"], ["pruefen", "📝 Prüfen & bewerten"]] as const).map(([id, l]) => (
          <button key={id} className={teil === id ? "chip chip-on" : "chip"} onClick={() => onTeil(id)}>{l}</button>
        ))}
      </nav>
      {teil === "material" && <Material />}
      {teil === "umbau" && <Umbauer />}
      {teil === "pruefen" && <Pruefen />}
    </div>
  );
}

function Material() {
  const [w, setW] = useState<MaterialWunsch>({
    fach: "", klasse: "7", thema: "", bereich: "reflektieren", stufe: "Ia", dimension: "ueber", art: MATERIALARTEN[0],
  });
  const set = <K extends keyof MaterialWunsch>(k: K, v: MaterialWunsch[K]) => setW(a => ({ ...a, [k]: v }));
  const prompt = materialPrompt(w);
  return (
    <section className="card p-4 flex flex-col gap-3">
      <p className="text-sm text-muted">
        Wähle ein Feld im Raster. Der Prompt erzeugt in AIS.chat passendes Material mit den Zielen dieses Feldes.
        Prüfe das Ergebnis fachlich, bevor du es einsetzt.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Fach<input className="input w-full" value={w.fach} onChange={e => set("fach", e.target.value)} placeholder="z. B. Deutsch" /></label>
        <label className="label">Klasse<input className="input w-full" value={w.klasse} onChange={e => set("klasse", e.target.value)} /></label>
        <label className="label sm:col-span-2">Thema (optional)<input className="input w-full" value={w.thema} onChange={e => set("thema", e.target.value)} placeholder="z. B. Werbung erkennen" /></label>
        <FeldWahl bereich={w.bereich} stufe={w.stufe} onBereich={v => set("bereich", v)} onStufe={v => set("stufe", v)} />
        <label className="label">Dimension
          <select className="input w-full" value={w.dimension} onChange={e => set("dimension", e.target.value as DimensionId)}>
            {DIMENSIONEN.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="label">Materialart
          <select className="input w-full" value={w.art} onChange={e => set("art", e.target.value)}>
            {MATERIALARTEN.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted">{DIMENSIONEN.find(d => d.id === w.dimension)!.text} · Operatoren: {OPERATOREN[w.stufe].join(", ")}</p>
      <textarea className="input min-h-60 font-mono text-xs" readOnly value={prompt} aria-label="Prompt" />
      <div className="flex flex-wrap gap-2">
        <Kopieren text={prompt} />
        <button className="btn-secondary" onClick={async () => herunterladen(
          await baueDocx([...kopf(w.bereich, w.stufe, w.thema || "Arbeitsblatt"), { art: "text", text: "Hier das Material aus AIS.chat einfügen und überarbeiten." }]),
          "Arbeitsblatt_KI-Kompass.docx")}>⬇️ Leeres Arbeitsblatt mit Kompetenzkopf</button>
      </div>
    </section>
  );
}

function Umbauer() {
  const [u, setU] = useState<Umbau>({ aufgabe: "", fach: "", klasse: "8", dimension: "trotz", einsatz: "punktuell", zuhause: true, resilienz: [] });
  const set = <K extends keyof Umbau>(k: K, v: Umbau[K]) => setU(a => ({ ...a, [k]: v }));
  const hinweise = umbauHinweise(u);
  const prompt = umbauPrompt(u);
  return (
    <section className="card p-4 flex flex-col gap-3">
      <p className="text-sm text-muted">Füge eine bestehende Aufgabe ein und entscheide, welche Rolle KI spielen soll.</p>
      <label className="label">Bestehende Aufgabe
        <textarea className="input w-full min-h-24" value={u.aufgabe} onChange={e => set("aufgabe", e.target.value)}
          placeholder="z. B. Schreibe eine Erörterung zum Thema Handyverbot an Schulen." />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Fach<input className="input w-full" value={u.fach} onChange={e => set("fach", e.target.value)} /></label>
        <label className="label">Klasse<input className="input w-full" value={u.klasse} onChange={e => set("klasse", e.target.value)} /></label>
      </div>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-sm">Dimension</legend>
        {DIMENSIONEN.map(d => (
          <label key={d.id} className="flex items-start gap-2 text-sm">
            <input type="radio" name="dimension" checked={u.dimension === d.id} onChange={() => set("dimension", d.id)} className="mt-1" />
            <span><strong>{d.name}</strong>: {d.text}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="font-medium text-sm">KI-Einsatz</legend>
        {EINSATZ.map(e => (
          <label key={e.id} className="flex items-center gap-2 text-sm" title={e.text}>
            <input type="radio" name="einsatz" checked={u.einsatz === e.id} onChange={() => set("einsatz", e.id as EinsatzId)} /> {e.name}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={u.zuhause} onChange={e => set("zuhause", e.target.checked)} /> wird zu Hause bearbeitet
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium text-sm">KI-Resilienz-Bausteine</legend>
        {RESILIENZ.map(r => (
          <label key={r.id} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={u.resilienz.includes(r.id)}
              onChange={() => set("resilienz", u.resilienz.includes(r.id) ? u.resilienz.filter(x => x !== r.id) : [...u.resilienz, r.id])} />
            {r.text}
          </label>
        ))}
      </fieldset>
      {hinweise.length > 0 && (
        <ul className="text-sm flex flex-col gap-1">{hinweise.map(h => <li key={h}>⚠️ {h}</li>)}</ul>
      )}
      <textarea className="input min-h-60 font-mono text-xs" readOnly value={prompt} aria-label="Prompt" />
      <Kopieren text={prompt} />
    </section>
  );
}

const FORMATE = [
  { einsatz: "ohne KI", aufsicht: "Klassenarbeit, Test, mündliche Prüfung", zuhause: "kaum möglich: Ohne Aufsicht ist KI verfügbar. Lieber punktuell planen." },
  { einsatz: "punktuell mit KI", aufsicht: "Schreibprozess mit KI-Feedback, danach Überarbeitung in der Stunde", zuhause: "Entwurf mit KI und Nutzungserklärung, dazu Rückfrage oder Überarbeitung in der Stunde" },
  { einsatz: "durchgehend mit KI", aufsicht: "Projektarbeit im Unterricht mit Zwischenständen", zuhause: "Portfolio, Projekt, Hausarbeit: Prozess und Reflexion mitbewerten" },
];

function Pruefen() {
  const [bereich, setBereich] = useState<BereichId>("anwenden");
  const [stufe, setStufe] = useState<StufeId>("Ib");
  const [aufgabe, setAufgabe] = useState("");
  const ziele = saetze(bereich, stufe);

  async function horizont() {
    const bloecke: DocxBlock[] = [
      ...kopf(bereich, stufe, "Erwartungshorizont"),
      { art: "text", text: aufgabe || "Aufgabe:", fett: true },
      { art: "text", text: `Operatoren dieser Stufe: ${OPERATOREN[stufe].join(", ")}`, grau: true },
      ...ziele.flatMap(k => [
        { art: "text" as const, text: k.text, fett: true },
        { art: "linie" as const, text: "Erwartete Leistung:" },
        { art: "text" as const, text: "Punkte: ___ / ___" },
      ]),
      { art: "ueberschrift", text: "KI-Einsatz und Reflexion" },
      { art: "text", text: "Nutzungserklärung vollständig · Ergebnisse geprüft · Eigenanteil erkennbar · Reflexion begründet" },
      { art: "text", text: "Punkte: ___ / ___" },
    ];
    herunterladen(await baueDocx(bloecke), "Erwartungshorizont_KI-Kompass.docx");
  }

  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-semibold">Prüfungsformat wählen</h3>
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead><tr className="text-left"><th className="pr-2">KI-Einsatz</th><th className="pr-2">unter Aufsicht</th><th>zu Hause</th></tr></thead>
          <tbody>
            {FORMATE.map(f => (
              <tr key={f.einsatz} className="border-t border-line align-top">
                <td className="pr-2 font-medium">{f.einsatz}</td><td className="pr-2">{f.aufsicht}</td><td>{f.zuhause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="font-semibold mt-2">Erwartungshorizont mit Operatoren</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <FeldWahl bereich={bereich} stufe={stufe} onBereich={setBereich} onStufe={setStufe} />
        <label className="label sm:col-span-2">Aufgabe (optional)<input className="input w-full" value={aufgabe} onChange={e => setAufgabe(e.target.value)} /></label>
      </div>
      <p className="text-sm">Operatoren: <strong>{OPERATOREN[stufe].join(", ")}</strong></p>
      <ul className="text-sm list-disc pl-5">{ziele.map(k => <li key={k.id}>{k.text}</li>)}</ul>
      <button className="btn-primary self-start" onClick={horizont}>⬇️ Erwartungshorizont als Word</button>
    </section>
  );
}
