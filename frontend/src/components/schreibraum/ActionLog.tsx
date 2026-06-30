"use client";
import { useEffect, useState } from "react";
import { api, SchreibraumActionLog } from "@/lib/api";

type Filter = "all" | "connection" | "edits" | "other";

const FILTER_GROUPS: Record<Filter, string[]> = {
  all:        [],
  connection: ["connect", "disconnect", "join", "kick"],
  edits:      ["insert", "delete", "replace"],
  other:      ["save"],
};

const ACTION_BG: Record<string, string> = {
  join:       "rgba(187,247,208,0.25)",
  disconnect: "rgba(226,232,240,0.2)",
  connect:    "rgba(219,234,254,0.25)",
  kick:       "rgba(254,226,226,0.3)",
  save:       "rgba(254,249,195,0.3)",
  insert:     "rgba(243,244,246,0.15)",
  delete:     "rgba(255,228,230,0.25)",
  replace:    "rgba(254,243,199,0.25)",
};

export default function ActionLog({ roomId }: { roomId: string }) {
  const [logs, setLogs] = useState<SchreibraumActionLog[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    async function load() {
      try { setLogs(await api.schreibraum.log(roomId)); } catch {}
    }
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 4000);
    return () => clearInterval(id);
  }, [roomId]);

  const visible = (filter === "all"
    ? logs
    : logs.filter((l) => FILTER_GROUPS[filter].includes(l.action))
  ).slice(0, 50);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "3px 0", fontSize: 11, fontWeight: active ? 700 : 400,
    borderRadius: 5, border: "none", cursor: "pointer",
    background: active ? "var(--accent)" : "var(--bg)",
    color: active ? "#fff" : "var(--text-muted)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {(["all", "connection", "edits", "other"] as Filter[]).map((f) => (
          <button key={f} style={btnStyle(filter === f)} onClick={() => setFilter(f)}>
            {f === "all" ? "Alle" : f === "connection" ? "🔌" : f === "edits" ? "✏️" : "📁"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto" }}>
        {visible.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Keine Einträge</div>
        )}
        {visible.map((l) => (
          <div key={l.id} style={{
            display: "flex", gap: 6, alignItems: "baseline",
            padding: "3px 7px", borderRadius: 5, fontSize: 11,
            background: ACTION_BG[l.action] ?? ACTION_BG.insert,
          }}>
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>
              {new Date(l.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span style={{ fontWeight: 600, color: "var(--text)", flexShrink: 0 }}>{l.participant_name}</span>
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{l.action}</span>
            {l.detail && (
              <span style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {l.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
