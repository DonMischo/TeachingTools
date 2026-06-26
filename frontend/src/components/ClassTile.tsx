"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassOut, api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  cls: ClassOut;
  selected: boolean;
  onClick: () => void;
};

export function ClassTile({ cls, selected, onClick }: Props) {
  const [showLog, setShowLog] = useState(false);
  const imageUrl = cls.symbol_image ?? `/uploads/gfx/${cls.code}.png`;

  return (
    <>
      <button
        onClick={onClick}
        className={cn(
          "relative flex flex-col items-center justify-between rounded-2xl border-2 p-3 w-[180px] h-[180px] transition-colors cursor-pointer",
          selected
            ? "bg-[var(--surface-hover)] border-[var(--border-selected)]"
            : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-hover)]"
        )}
      >
        <span className="text-sm font-semibold text-[var(--text)]">{cls.code}</span>

        <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
          {cls.symbol_emoji ? (
            <span className="text-5xl">{cls.symbol_emoji}</span>
          ) : (
            <img
              src={imageUrl}
              alt={cls.code}
              className="max-h-[100px] max-w-[100px] object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        <span className="text-xs text-[var(--text-muted)]">{cls.total_points} Punkte</span>

        {/* Log button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowLog(true); }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--text-muted)] text-xs flex items-center justify-center leading-none transition-colors"
          title="Punktehistorie"
        >
          ?
        </button>
      </button>

      {showLog && (
        <TransactionLog cls={cls} onClose={() => setShowLog(false)} />
      )}
    </>
  );
}

function TransactionLog({ cls, onClose }: { cls: ClassOut; onClose: () => void }) {
  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["transactions", cls.id],
    queryFn: () => api.transactions.list(cls.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="font-semibold">{cls.display_name}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Punktehistorie · {cls.total_points} gesamt</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white text-xl leading-none">×</button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Laden…</p>
          ) : txs.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Noch keine Einträge.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {txs.map((tx) => (
                <li key={tx.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm truncate">{tx.reason || <span className="text-[var(--text-muted)] italic">Kein Grund angegeben</span>}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {tx.teacher_name} · {new Date(tx.ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${tx.points > 0 ? "text-green-400" : "text-red-400"}`}>
                    {tx.points > 0 ? "+" : ""}{tx.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
