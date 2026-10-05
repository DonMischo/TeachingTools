"use client";
import type { BarometerAnswer, BarometerKind, BarometerScaleStyle, BarometerShowIf } from "@/lib/api";
import { conditionMet, scaleLabel, segmentsOf } from "@/lib/barometer";

type Question = {
  id: number;
  text: string;
  kind: BarometerKind;
  options: string[];
  scale_min: number;
  scale_max: number;
  scale_min_label: string | null;
  scale_max_label: string | null;
  scale_style: BarometerScaleStyle;
  max_choices: number | null;
  num_min: number | null;
  num_max: number | null;
  unit: string | null;
  block: string | null;
  intro: string | null;
  show_if: BarometerShowIf | null;
};

export function QuestionInput({ question, value, onChange }: {
  question: Question; value: BarometerAnswer | undefined; onChange: (v: BarometerAnswer | undefined) => void;
}) {
  const q = question;

  if (q.kind === "scale") {
    const steps = Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => q.scale_min + i);
    return (
      <div className="flex flex-col gap-1">
        {(q.scale_min_label || q.scale_max_label) && (
          <div className="flex justify-between text-xs text-muted">
            <span>{q.scale_min_label}</span>
            <span>{q.scale_max_label}</span>
          </div>
        )}
        <div className="flex gap-2">
          {steps.map(v => {
            const selected = value === v;
            return (
              <button key={v} type="button" aria-pressed={selected} onClick={() => onChange(v)}
                className={`flex-1 aspect-square rounded-xl text-sm font-bold border-2 ${selected ? "bg-accent text-accent-fg border-accent" : "border-line text-muted"}`}>
                {scaleLabel(q, v)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (q.kind === "choice") {
    return (
      <select className="input" aria-label="Antwort"
        value={typeof value === "number" ? value : ""}
        onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
        <option value="" disabled>Bitte wählen…</option>
        {q.options.map((opt, i) => <option key={i} value={i}>{opt}</option>)}
      </select>
    );
  }

  if (q.kind === "multi") {
    const selected = Array.isArray(value) ? value : [];
    const maxReached = q.max_choices != null && selected.length >= q.max_choices;
    return (
      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const checked = selected.includes(i);
          const disabled = !checked && maxReached;
          return (
            <label key={i} className={`flex items-center gap-2 text-sm ${disabled ? "text-muted opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" checked={checked} disabled={disabled}
                onChange={e => {
                  const next = e.target.checked ? [...selected, i] : selected.filter(v => v !== i);
                  onChange(next);
                }} />
              {opt}
            </label>
          );
        })}
        {q.max_choices != null && (
          <span className="text-xs text-muted">höchstens {q.max_choices}</span>
        )}
      </div>
    );
  }

  if (q.kind === "number") {
    return (
      <div className="flex items-center gap-2">
        <input type="number" step="any" aria-label="Zahl" className="input flex-1"
          min={q.num_min ?? undefined} max={q.num_max ?? undefined}
          value={typeof value === "number" ? value : ""}
          onChange={e => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
        {q.unit && <span className="text-sm text-muted">{q.unit}</span>}
      </div>
    );
  }

  // text
  return (
    <textarea className="input" maxLength={1000} rows={3} aria-label="Antwort"
      value={typeof value === "string" ? value : ""}
      onChange={e => onChange(e.target.value)} />
  );
}

export function BlockInput({ questions, answers, onChange }: {
  questions: Question[]; answers: Record<number, BarometerAnswer>; onChange: (id: number, v: BarometerAnswer | undefined) => void;
}) {
  const first = questions[0];
  const steps = Array.from({ length: first.scale_max - first.scale_min + 1 }, (_, i) => first.scale_min + i);
  return (
    <div className="flex flex-col gap-3">
      {first.intro && <div className="font-semibold text-sm">{first.intro}</div>}
      {(first.scale_min_label || first.scale_max_label) && (
        <div className="flex justify-between text-xs text-muted">
          <span>{first.scale_min_label}</span>
          <span>{first.scale_max_label}</span>
        </div>
      )}
      {questions.map(q => {
        const value = answers[q.id];
        return (
          <div key={q.id} className="flex items-center gap-3">
            <div className="text-sm flex-1">{q.text}</div>
            <div className="flex gap-1">
              {steps.map(v => {
                const selected = value === v;
                const stepLabel = scaleLabel(q, v);
                return (
                  <button key={v} type="button" aria-pressed={selected}
                    aria-label={`${q.text}: ${stepLabel}`}
                    onClick={() => onChange(q.id, v)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold border-2 ${selected ? "bg-accent text-accent-fg border-accent" : "border-line text-muted"}`}>
                    {stepLabel}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SlideForm({ questions, answers, onChange }: {
  questions: Question[]; answers: Record<number, BarometerAnswer>; onChange: (id: number, v: BarometerAnswer | undefined) => void;
}) {
  const segments = segmentsOf(questions).filter(seg =>
    seg.type === "single" ? conditionMet(seg.question, answers) : conditionMet(seg.questions[0], answers),
  );

  if (segments.length === 0) {
    return <div className="text-sm text-muted">Hier gibt es für dich nichts zu beantworten.</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {segments.map(seg => {
        if (seg.type === "block") {
          return (
            <div key={seg.block} className="border border-line rounded-xl p-4">
              <BlockInput questions={seg.questions} answers={answers} onChange={onChange} />
            </div>
          );
        }
        const q = seg.question;
        return (
          <div key={q.id} className="border border-line rounded-xl p-4 flex flex-col gap-2">
            {q.intro && <div className="text-sm text-muted">{q.intro}</div>}
            <div className="font-semibold text-sm">{q.text}</div>
            <QuestionInput question={q} value={answers[q.id]} onChange={v => onChange(q.id, v)} />
          </div>
        );
      })}
    </div>
  );
}
