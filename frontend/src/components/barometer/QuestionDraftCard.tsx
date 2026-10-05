"use client";
import type { BarometerKind } from "@/lib/api";
import { CHART_TYPES, KIND_LABELS, MAX_SMILEY_STEPS, OPTION_PRESETS, SCALE_STYLES, type DraftItem, type DraftQuestion } from "@/lib/barometer";

export function ConditionFields<T extends DraftItem>({ item, index, items, onChange }: {
  item: T; index: number; items: DraftItem[]; onChange: (patch: Partial<T>) => void;
}) {
  const eligible = items
    .map((it, i) => ({ it, i }))
    .filter((e): e is { it: DraftQuestion; i: number } =>
      e.i < index && e.it.type === "question" && (e.it.kind === "choice" || e.it.kind === "multi"));

  const enabled = item.show_if !== null;
  const parent = enabled ? eligible.find(({ it }) => it.uid === item.show_if!.parentUid)?.it ?? eligible[0]?.it : undefined;

  return (
    <div className="flex flex-col gap-2 ml-7">
      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            if (e.target.checked) {
              onChange({
                show_if: { parentUid: eligible[0]?.it.uid ?? "", options: [] },
                same_slide: true,
              } as unknown as Partial<T>);
            } else {
              onChange({ show_if: null } as unknown as Partial<T>);
            }
          }}
        />
        Nur zeigen, wenn …
      </label>
      {enabled && eligible.length === 0 && (
        <span className="text-xs text-muted">
          Folgefragen brauchen davor eine Auswahl- oder Mehrfachauswahl-Frage.
        </span>
      )}
      {enabled && eligible.length > 0 && parent && (
        <div className="flex flex-col gap-1">
          <select
            aria-label="Bedingung Frage"
            className="input text-xs py-1 w-64"
            value={parent.uid}
            onChange={e => onChange({ show_if: { parentUid: e.target.value, options: [] } } as unknown as Partial<T>)}
          >
            {eligible.map(({ it, i }) => <option key={it.uid} value={it.uid}>Frage {i + 1}: {it.text}</option>)}
          </select>
          <div className="flex flex-wrap gap-3">
            {parent.options.map((opt, oi) => {
              const checked = item.show_if!.options.includes(oi);
              return (
                <label key={oi} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => {
                      const opts = e.target.checked
                        ? [...item.show_if!.options, oi]
                        : item.show_if!.options.filter(o => o !== oi);
                      onChange({ show_if: { parentUid: parent.uid, options: opts } } as unknown as Partial<T>);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestionDraftCard({ item, index, items, onChange, onRemove, canRemove }: {
  item: DraftQuestion; index: number; items: DraftItem[];
  onChange: (patch: Partial<DraftQuestion>) => void; onRemove: () => void; canRemove: boolean;
}) {
  const steps = item.scale_max - item.scale_min + 1;
  const smileyTooManySteps = item.kind === "scale" && item.scale_style !== "zahlen" && steps > MAX_SMILEY_STEPS;

  function addOption() { onChange({ options: [...item.options, ""] }); }
  function removeOption(oi: number) { onChange({ options: item.options.filter((_, j) => j !== oi) }); }
  function updateOption(oi: number, value: string) { onChange({ options: item.options.map((o, j) => j === oi ? value : o) }); }

  return (
    <div className="border border-line rounded-xl p-3 flex flex-col gap-2 bg-page">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted w-5 shrink-0">{index + 1}.</span>
        <input
          value={item.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="Frage…"
          className="input text-sm py-1.5 flex-1"
        />
        {canRemove && (
          <button onClick={onRemove} className="text-muted hover:text-red-400 text-sm px-1">✕</button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap items-center ml-7">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Typ
          <select aria-label="Fragetyp" value={item.kind}
            onChange={e => onChange({ kind: e.target.value as BarometerKind, chart: "" })}
            className="input text-xs py-1 w-auto">
            {(Object.keys(KIND_LABELS) as BarometerKind[]).map(k => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          Auswertung
          <select aria-label="Darstellung" value={item.chart || CHART_TYPES[item.kind][0].id}
            onChange={e => onChange({ chart: e.target.value })}
            className="input text-xs py-1 w-auto">
            {CHART_TYPES[item.kind].map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
      </div>

      {item.kind === "scale" && (
        <div className="flex flex-col gap-2 ml-7">
          <div className="flex gap-2 flex-wrap items-center">
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
                onChange={e => onChange({ scale_style: e.target.value as DraftQuestion["scale_style"] })}
                className="input text-xs py-1 w-auto">
                {SCALE_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
          {smileyTooManySteps && (
            <span className="text-xs text-red-400">Smileys: höchstens 7 Stufen</span>
          )}
        </div>
      )}

      {(item.kind === "choice" || item.kind === "multi") && (
        <div className="flex flex-col gap-2 ml-7">
          <select aria-label="Vorlage" value=""
            onChange={e => {
              const preset = OPTION_PRESETS.find(p => p.id === e.target.value);
              if (preset) onChange({ options: [...preset.options] });
            }}
            className="input text-xs py-1 w-56">
            <option value="">— Vorlage wählen —</option>
            {OPTION_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {item.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input value={opt} onChange={e => updateOption(oi, e.target.value)}
                placeholder={`Option ${oi + 1}`} className="input text-xs py-1 flex-1" />
              <button onClick={() => removeOption(oi)}
                className="text-muted hover:text-red-400 text-xs px-1">✕</button>
            </div>
          ))}
          <button onClick={addOption}
            className="text-xs text-muted hover:text-fg self-start">+ Option</button>
          <span className="text-xs text-muted">mindestens 2 Optionen</span>
          {item.kind === "multi" && (
            <div className="flex items-center gap-2">
              <input type="number" aria-label="Höchstzahl" placeholder="unbegrenzt" min={1} max={item.options.length || undefined}
                value={item.max_choices ?? ""}
                onChange={e => onChange({ max_choices: e.target.value === "" ? null : Number(e.target.value) })}
                className="input text-xs py-1 w-24" />
              <span className="text-xs text-muted">höchstens … ankreuzen</span>
            </div>
          )}
        </div>
      )}

      {item.kind === "number" && (
        <div className="flex gap-2 flex-wrap items-center ml-7">
          <input type="number" aria-label="Minimum" placeholder="Minimum"
            value={item.num_min ?? ""} onChange={e => onChange({ num_min: e.target.value === "" ? null : Number(e.target.value) })}
            className="input text-xs py-1 w-24" />
          <input type="number" aria-label="Maximum" placeholder="Maximum"
            value={item.num_max ?? ""} onChange={e => onChange({ num_max: e.target.value === "" ? null : Number(e.target.value) })}
            className="input text-xs py-1 w-24" />
          <input aria-label="Einheit" placeholder="Einheit"
            value={item.unit} onChange={e => onChange({ unit: e.target.value })}
            className="input text-xs py-1 w-24" />
        </div>
      )}

      {item.kind === "text" && (
        <div className="text-xs text-muted ml-7">
          Die Antworten siehst nur du. Über »KI-Auswertung« werden sie zu kurzen Antworten mit Anzahl verdichtet.
        </div>
      )}

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
