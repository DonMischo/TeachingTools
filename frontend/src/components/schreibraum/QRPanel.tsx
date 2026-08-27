"use client";
import { useEffect, useState } from "react";
import { JoinQR } from "@/components/JoinQR";

const STORAGE_KEY = "schreibraum_qr_addresses";

function loadSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveSaved(list: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function QRPanel({ roomCode }: { roomCode: string }) {
  const detected = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : "";
  const [base, setBase] = useState(detected);
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [custom, setCustom] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    fetch("/server-ip").then((r) => r.json()).then(({ ip }) => {
      if (ip && ip !== "127.0.0.1") {
        const port = window.location.port ? `:${window.location.port}` : "";
        const lanUrl = `http://${ip}${port}`;
        setSaved((prev) => {
          const merged = [...new Set([lanUrl, ...prev])];
          saveSaved(merged);
          return merged;
        });
        setBase(lanUrl);
      }
    }).catch(() => {});
  }, []);

  const joinUrl = `${base}/schreibraum/${roomCode}`;

  function addCustom() {
    if (!custom.trim()) return;
    const updated = [...new Set([custom.trim(), ...saved])];
    setSaved(updated);
    saveSaved(updated);
    setBase(custom.trim());
    setCustom("");
    setShowCustom(false);
  }

  function remove(addr: string) {
    const updated = saved.filter((a) => a !== addr);
    setSaved(updated);
    saveSaved(updated);
    if (base === addr) setBase(detected);
  }

  const btnBase: React.CSSProperties = {
    fontSize: 12, padding: "4px 8px", borderRadius: 6, cursor: "pointer",
    border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)",
  };

  const activeStyle: React.CSSProperties = {
    background: "rgba(255,235,59,0.15)",
    color: "#c8a000",
    border: "1px solid rgba(255,235,59,0.4)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <JoinQR url={joinUrl} size={180} className="block rounded-lg" />
      <div style={{ fontSize: 11, wordBreak: "break-all", color: "var(--text-muted)", background: "var(--surface)", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)" }}>
        {joinUrl}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {saved.map((addr) => (
          <div key={addr} style={{ display: "flex", gap: 4 }}>
            <button
              style={{ ...btnBase, flex: 1, textAlign: "left", ...(base === addr ? activeStyle : {}) }}
              onClick={() => setBase(addr)}
            >
              {addr}
            </button>
            <button style={{ ...btnBase, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none" }} onClick={() => remove(addr)}>✕</button>
          </div>
        ))}

        {showCustom ? (
          <div style={{ display: "flex", gap: 4 }}>
            <input
              autoFocus
              style={{ flex: 1, fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", outline: "none" }}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="http://192.168.1.x:1339"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <button style={{ ...btnBase, background: "rgba(255,235,59,0.15)", color: "#c8a000", border: "1px solid rgba(255,235,59,0.4)" }} onClick={addCustom}>OK</button>
          </div>
        ) : (
          <button style={{ ...btnBase, border: "1px dashed var(--border)" }} onClick={() => setShowCustom(true)}>
            + Eigene URL
          </button>
        )}
      </div>
    </div>
  );
}
