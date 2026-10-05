"use client";
import { BLOCK_CHART_TYPES, MAX_SMILEY_STEPS, SCALE_STYLES, type DraftBlock, type DraftItem } from "@/lib/barometer";
import { ConditionFields } from "@/components/barometer/QuestionDraftCard";

export function BlockDraftCard({ item, index, items, onChange, onRemove, canRemove }: {
  item: DraftBlock; index: number; items: DraftItem[];
  onChange: (patch: Partial<DraftBlock>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const steps = item.scale_max - item.scale_min + 1;
  const smileyTooManySteps = item.scale_style !== "zahlen" && steps > MAX_SMILEY_STEPS;

  function addStatement() { onChange({ statements: [...item.statements, ""] }); }
  function removeStatement(si: number) { onChange({ statements: item.statements.filter((_, j) => j !== si) }); }
  function updateStatement(si: number, value: string) {
    onChange({ statements: item.statements.map((s, j) => j === si ? value : s) });
  }

  return (
    <div className="border border-line rounded-xl p-3 flex flex-col gap-2 bg-page">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted w-5 shrink-0">{index + 1}.</span>
        <span className="text-sm font-semibold">Aussagen-Block</span>
        {canRemove && (
          <button onClick={onRemove} className="ml-auto text-muted hover:text-red-400 text-sm px-1">✕</button>
        )}
      </div>

      {/* Einrueckung am Wrapper: .input ist volle Breite, ein ml-7 direkt daran schob es aus der Karte. */}
      <div className="ml-7">
        <input
          value={item.intro}
          onChange={e => onChange({ intro: e.target.value })}
          placeholder="Überschrift, z. B. Wie sehr stimmst du zu?"
          className="input text-sm py-1.5 w-full"
        />
      </div>

      <div className="flex gap-2 flex-wrap items-center ml-7">
        <div className="flex items-center gap-1 text-xs text-muted">
          Skala
          <input type="number" min={1} max={5} value={item.scale_min}
            onChange={e => onChange({ scale_min: Number(e.target.value) })}
            className="input w-12 text-xs py-0.5 px-1" />
          –
          <input type="number" min={2} max={10} value={item.scale_max}
            onChange={e => onChange({ scale_max: Number(e.target.value) })}
            className="input w-12 text-xs py-0.5 px-1" />
        </div>
        <input value={item.scale_min_label} onChange={e => onChange({ scale_min_label: e.target.value })}
          placeholder={`Beschriftung ${item.scale_min}`} className="input text-xs py-0.5 px-2 w-28" />
        <input value={item.scale_max_label} onChange={e => onChange({ scale_max_label: e.target.value })}
          placeholder={`Beschriftung ${item.scale_max}`} className="input text-xs py-0.5 px-2 w-28" />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Anzeige
          <select aria-label="Anzeige" value={item.scale_style}
            onChange={e => onChange({ scale_style: e.target.value as DraftBlock["scale_style"] })}
            className="input text-xs py-1 w-auto">
            {SCALE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Darstellung
          <select aria-label="Darstellung" value={item.chart || BLOCK_CHART_TYPES[0].id}
            onChange={e => onChange({ chart: e.target.value })}
            className="input text-xs py-1 w-auto">
            {BLOCK_CHART_TYPES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      </div>
      {smileyTooManySteps && (
        <span className="text-xs text-red-400 ml-7">Smileys: höchstens 7 Stufen</span>
      )}

      <div className="flex flex-col gap-2 ml-7">
        {item.statements.map((s, si) => (
          <div key={si} className="flex items-center gap-2">
            <input value={s} onChange={e => updateStatement(si, e.target.value)}
              placeholder={`Aussage ${si + 1}`} className="input text-xs py-1 flex-1" />
            <button onClick={() => removeStatement(si)}
              className="text-muted hover:text-red-400 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={addStatement}
          className="text-xs text-muted hover:text-fg self-start">+ Aussage</button>
      </div>

      {index > 0 && (
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer ml-7">
          <input type="checkbox" checked={item.same_slide} onChange={e => onChange({ same_slide: e.target.checked })} />
          Auf derselben Folie wie davor
        </label>
      )}

      <ConditionFields item={item} index={index} items={items} onChange={onChange} />
    </div>
  );
}
