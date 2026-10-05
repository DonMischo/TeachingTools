"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import type { BarometerKind, BarometerScaleStyle } from "@/lib/api";
import { chartOf, chartRows, formatNumber, histogramRows, numberStats, scaleMean, wordFrequencies } from "@/lib/barometer";

const PALETTE = [
  "var(--accent)", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

type Question = {
  id: number; kind: BarometerKind; options: string[]; scale_min: number; scale_max: number;
  scale_min_label: string | null; scale_max_label: string | null; chart: string | null;
  scale_style?: BarometerScaleStyle; num_min?: number | null; num_max?: number | null; unit?: string | null;
};

export function ResultChart(props: {
  question: Question;
  distribution: Record<string, number>;
  count: number;
  texts?: string[];
  chart?: string;
}) {
  const { question, distribution, count, texts, chart } = props;
  // Ungueltige oder leere Ids (z. B. "" aus einem Select) fallen auf die Standarddarstellung zurueck.
  const chartId = chartOf({ kind: question.kind, chart: chart || question.chart });

  if (count === 0) {
    return <div className="text-sm text-(--text-muted) text-center py-4">Noch keine Antworten</div>;
  }

  if (question.kind === "text") {
    return <TextChart chartId={chartId} count={count} texts={texts} />;
  }

  if (question.kind === "number") {
    return <NumberChart question={question} chartId={chartId} distribution={distribution} count={count} />;
  }

  const rows = chartRows(question, distribution);
  const mean = question.kind === "scale" ? scaleMean(question, distribution) : null;

  return (
    <div className="flex flex-col gap-2">
      {chartId === "saeulen" && <ColumnChart rows={rows} />}
      {chartId === "balken" && <RowChart rows={rows} />}
      {(chartId === "donut" || chartId === "kreis") && <DonutChart rows={rows} donut={chartId === "donut"} />}
      {chartId === "gestapelt" && <StackedChart rows={rows} />}
      {chartId === "flaeche" && <AreaChartView rows={rows} />}

      {question.kind === "scale" && (
        <>
          {(question.scale_min_label || question.scale_max_label) && (
            <div className="flex justify-between text-xs text-(--text-muted)">
              <span>{question.scale_min_label}</span>
              <span>{question.scale_max_label}</span>
            </div>
          )}
          <div className="text-xs text-center text-(--text-muted)">
            {count} Antwort{count !== 1 ? "en" : ""}
            {mean != null && <> · Ø {mean.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</>}
          </div>
        </>
      )}
      {question.kind === "choice" && (
        <div className="text-xs text-center text-(--text-muted)">{count} Antwort{count !== 1 ? "en" : ""}</div>
      )}
      {question.kind === "multi" && (
        <div className="text-xs text-center text-(--text-muted)">{count} Befragte · Mehrfachauswahl</div>
      )}
    </div>
  );
}

function NumberChart({ question, chartId, distribution, count }: {
  question: Question; chartId: string; distribution: Record<string, number>; count: number;
}) {
  const unit = question.unit ? ` ${question.unit}` : "";
  if (chartId === "kennzahlen") {
    const stats = numberStats(distribution);
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Anzahl" value={stats ? String(stats.n) : "–"} />
          <StatTile label="Ø" value={stats ? `${formatNumber(stats.mean)}${unit}` : "–"} />
          <StatTile label="Median" value={stats ? `${formatNumber(stats.median)}${unit}` : "–"} />
          <StatTile label="Min – Max" value={stats ? `${formatNumber(stats.min)} – ${formatNumber(stats.max)}${unit}` : "–"} />
        </div>
        <div className="text-xs text-center text-(--text-muted)">{count} Antwort{count !== 1 ? "en" : ""}</div>
      </div>
    );
  }
  const rows = histogramRows(distribution);
  return (
    <div className="flex flex-col gap-2">
      <ColumnChart rows={rows} />
      <div className="text-xs text-center text-(--text-muted)">{count} Antwort{count !== 1 ? "en" : ""}</div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-(--border) rounded-lg px-3 py-2 flex flex-col items-center">
      <div className="text-xs text-(--text-muted)">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function ColumnChart({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RowChart({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={rows} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis dataKey="label" type="category" width={120} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutChart({ rows, donut }: { rows: { key: string; label: string; count: number }[]; donut: boolean }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="60%" height={180}>
        <PieChart>
          <Pie data={rows} dataKey="count" nameKey="label" innerRadius={donut ? 40 : 0} outerRadius={75}>
            {rows.map((r, i) => <Cell key={r.key} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 flex flex-col gap-1 text-xs">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 truncate">{r.label}</span>
            <span className="text-(--text-muted)">{r.count} ({total > 0 ? Math.round((r.count / total) * 100) : 0}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StackedChart({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-full h-6 rounded-full overflow-hidden border border-(--border)">
        {rows.map((r, i) => (
          r.count > 0 && (
            <div key={r.key} title={`${r.label}: ${r.count}`}
              style={{ width: `${total > 0 ? (r.count / total) * 100 : 0}%`, background: PALETTE[i % PALETTE.length] }} />
          )
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{r.label}: {r.count} ({total > 0 ? Math.round((r.count / total) * 100) : 0}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AreaChartView({ rows }: { rows: { key: string; label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={rows}>
        <defs>
          <linearGradient id="barometerAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
        <Tooltip />
        <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="url(#barometerAreaFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TextChart({ chartId, count, texts }: { chartId: string; count: number; texts?: string[] }) {
  if (!texts) {
    return <div className="text-sm text-(--text-muted) text-center py-2">{count} Antwort{count !== 1 ? "en" : ""}</div>;
  }
  if (chartId === "wortwolke") {
    const freqs = wordFrequencies(texts);
    if (freqs.length === 0) {
      return <div className="text-sm text-(--text-muted) text-center py-2">{count} Antwort{count !== 1 ? "en" : ""}</div>;
    }
    const max = Math.max(...freqs.map(f => f.count));
    const min = Math.min(...freqs.map(f => f.count));
    return (
      <div className="flex flex-wrap gap-2 items-baseline justify-center py-2">
        {freqs.map(f => {
          const scale = max === min ? 1 : (f.count - min) / (max - min);
          const fontSize = 0.8 + scale * 1.4;
          return (
            <span key={f.word} title={String(f.count)} style={{ fontSize: `${fontSize}rem` }} className="text-(--accent) font-semibold">
              {f.word}
            </span>
          );
        })}
      </div>
    );
  }
  // liste
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {texts.map((t, i) => (
          <div key={i} className="text-sm border border-(--border) rounded-lg px-3 py-2 bg-(--bg)">{t}</div>
        ))}
      </div>
      <div className="text-xs text-center text-(--text-muted)">{count} Antwort{count !== 1 ? "en" : ""}</div>
    </div>
  );
}
