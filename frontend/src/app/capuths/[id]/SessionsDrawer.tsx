"use client";

import { ClassOut } from "@/lib/api";

type Session = {
  join_code: string;
  status: string;
  class_id: number;
  participant_count: number;
  points_awarded: number | null;
  started_at: string | null;
  finished_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessions: Session[];
  classes: ClassOut[];
  onReset: (code: string) => void;
  onOpen: (code: string) => void;
};

export function SessionsDrawer({ open, onClose, sessions, classes, onReset, onOpen }: Props) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-64 flex flex-col
          bg-[var(--surface)] border-l border-[var(--border)]
          shadow-2xl transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="font-semibold text-sm">Sessions</span>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">Noch keine Sessions.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {sessions.map((s) => {
                const cls = classes.find((c) => c.id === s.class_id);
                const scored = s.points_awarded !== null;
                const statusColor =
                  s.status === "active" ? "text-yellow-400" :
                  s.status === "waiting" ? "text-blue-400" : "text-[var(--text-muted)]";
                const statusLabel =
                  s.status === "active" ? "Läuft" :
                  s.status === "waiting" ? "Wartet" : "Beendet";

                return (
                  <li key={s.join_code} className="px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">
                        {cls?.display_name ?? `Klasse ${s.class_id}`}
                      </span>
                      <span className={`text-xs font-semibold shrink-0 ${statusColor}`}>{statusLabel}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-mono">{s.join_code}</span>
                      <span>·</span>
                      <span>{s.participant_count} Teiln.</span>
                      {scored && (
                        <>
                          <span>·</span>
                          <span className="text-yellow-400 font-semibold">{s.points_awarded} Pkt.</span>
                        </>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      {s.status !== "finished" && (
                        <button
                          onClick={() => { onClose(); onOpen(s.join_code); }}
                          className="text-xs px-2.5 py-1 bg-green-700 hover:bg-green-600 text-white rounded-md"
                        >
                          Öffnen
                        </button>
                      )}
                      {scored && (
                        <a
                          href={`/api/sessions/${s.join_code}/report?fmt=csv`}
                          download
                          className="text-xs px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded-md"
                        >
                          ↓ Bericht
                        </a>
                      )}
                      {!scored && (
                        <button
                          onClick={() => onReset(s.join_code)}
                          className="text-xs px-2.5 py-1 border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-[var(--text-muted)] rounded-md transition-colors"
                        >
                          ↺ Reset
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
