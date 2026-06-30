"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import { api, SchreibraumRoom, SchreibraumParticipant } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { EditorHandle } from "@/components/schreibraum/Editor";
import ActionLog from "@/components/schreibraum/ActionLog";
import QRPanel from "@/components/schreibraum/QRPanel";

const Editor = dynamic(() => import("@/components/schreibraum/Editor"), { ssr: false });

// ── Collapsible sidebar panel ─────────────────────────────────────────────────

function Panel({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", userSelect: "none", borderBottom: open ? "1px solid var(--border)" : "none" }}
      >
        <span style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-muted)" }}>{title}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && <div style={{ padding: 12 }}>{children}</div>}
    </div>
  );
}

// ── Add-access form ───────────────────────────────────────────────────────────

function AddAccessForm({ roomId, onAdded }: { roomId: string; onAdded: (g: any) => void }) {
  const { toast } = useToast();
  const [classCode, setClassCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [allClasses, setAllClasses] = useState<{ id: number; code: string }[]>([]);

  useEffect(() => {
    api.classes.list().then((cs) => setAllClasses(cs)).catch(() => {});
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!classCode) return;
    const cls = allClasses.find((c) => c.code === classCode);
    if (!cls) { toast("Klasse nicht gefunden", "error"); return; }
    setSaving(true);
    try {
      const grant = await api.schreibraum.addAccess(roomId, { class_id: cls.id });
      onAdded(grant);
      setClassCode("");
    } catch (e: any) {
      toast(e.message ?? "Fehler", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleAdd} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
      <select
        value={classCode}
        onChange={(e) => setClassCode(e.target.value)}
        style={{ flex: 1, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}
      >
        <option value="">Klasse wählen…</option>
        {allClasses.map((c) => <option key={c.id} value={c.code}>{c.code}</option>)}
      </select>
      <button type="submit" disabled={saving || !classCode} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "var(--accent)", color: "#111", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
        + Klasse
      </button>
    </form>
  );
}

// ── Hamburger export menu ─────────────────────────────────────────────────────

function ExportMenu({ onMd, onHtml, onPdf, onLog }: { onMd(): void; onHtml(): void; onPdf(): void; onLog(): void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Exportieren"
        style={{ fontSize: 15, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: open ? "var(--surface-hover)" : "var(--surface)", color: "var(--text)", cursor: "pointer", lineHeight: 1 }}
      >
        ⋮
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 180, overflow: "hidden",
          }}>
            {[
              { icon: "📝", label: "Markdown (.md)", fn: onMd },
              { icon: "🌐", label: "HTML (.html)", fn: onHtml },
              { icon: "🖨️", label: "PDF (drucken)", fn: onPdf },
              { icon: "📊", label: "Log (.csv)", fn: onLog },
            ].map(({ icon, label, fn }) => (
              <button
                key={label}
                onClick={() => { fn(); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13, textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SchreibraumEditorPage() {
  const { code } = useParams<{ code: string }>();
  const { auth } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const editorRef = useRef<EditorHandle>(null);

  const [room, setRoom] = useState<SchreibraumRoom | null>(null);
  const [participant, setParticipant] = useState<SchreibraumParticipant | null>(null);
  const [mode, setMode] = useState("next-free-line");
  const [kicked, setKicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveMsg, setSaveMsg] = useState("");

  // Wortstaffel turn state
  const turnsWsRef = useRef<WebSocket | null>(null);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [turnOrder, setTurnOrder] = useState<string[]>([]);

  const isTeacher = auth?.user_type === "teacher";

  useEffect(() => {
    if (!auth || !code) return;
    async function init() {
      try {
        const r = await api.schreibraum.getByCode(code.toUpperCase());
        setRoom(r);
        setMode(r.mode);
        const p = await api.schreibraum.join(r.id);
        setParticipant(p);
      } catch (e: any) {
        setError(e.message ?? "Fehler beim Beitreten");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [auth, code]);

  // Wortstaffel turns WS
  useEffect(() => {
    if (!participant || mode !== "wortstaffel") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/api/schreibraum/ws/${code.toUpperCase()}/turns?token=${participant.session_token}`);
    turnsWsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.event === "state") {
          setCurrentTurnId(msg.current_participant_id ?? null);
          setTurnOrder(msg.order ?? []);
        } else if (msg.event === "turn_changed") {
          setCurrentTurnId(msg.participant_id ?? null);
        }
      } catch {}
    };
    return () => { ws.close(); turnsWsRef.current = null; };
  }, [participant, mode, code]);

  function sendTurnAction(action: object) {
    turnsWsRef.current?.readyState === WebSocket.OPEN && turnsWsRef.current.send(JSON.stringify(action));
  }

  async function handleSave() {
    if (!room || !editorRef.current) return;
    setSaveMsg("Speichern…");
    try {
      const state = editorRef.current.getYdocState();
      await fetch(`/api/schreibraum/rooms/${room.id}/document/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: Uint8Array.from(atob(state), (c) => c.charCodeAt(0)),
      });
      setSaveMsg("Gespeichert ✓");
    } catch {
      setSaveMsg("Fehler");
    }
    setTimeout(() => setSaveMsg(""), 3000);
  }

  async function togglePermanent() {
    if (!room) return;
    const next = !room.is_permanent;
    if (!next && !confirm("Temporär: Der Raum wird gelöscht, sobald er leer ist. Fortfahren?")) return;
    try {
      await api.schreibraum.patch(room.id, { is_permanent: next });
      setRoom((r) => r ? { ...r, is_permanent: next } : r);
    } catch (e: any) {
      toast("Fehler: " + (e.message ?? ""), "error");
    }
  }

  async function handleModeChange(newMode: string) {
    if (!room) return;
    setMode(newMode);
    try {
      await api.schreibraum.patch(room.id, { mode: newMode });
      setRoom((r) => r ? { ...r, mode: newMode } : r);
    } catch {}
  }

  function downloadFile(blob: Blob, filename: string) {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadMarkdown() {
    const md = editorRef.current?.getMarkdown() ?? "";
    downloadFile(new Blob([md], { type: "text/markdown" }), `raum-${room?.code ?? code}.md`);
  }

  function downloadHtml() {
    const html = editorRef.current?.getHTML() ?? "";
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Raum ${room?.code}</title><style>body{font-family:serif;font-size:16px;line-height:1.7;max-width:800px;margin:40px auto;padding:0 20px}</style></head><body>${html}</body></html>`;
    downloadFile(new Blob([full], { type: "text/html" }), `raum-${room?.code ?? code}.html`);
  }

  function downloadPdf() {
    const html = editorRef.current?.getHTML() ?? "";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Raum ${room?.code}</title><style>body{font-family:serif;font-size:16px;line-height:1.7;max-width:800px;margin:40px auto;padding:0 20px}@media print{@page{margin:20mm}}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  async function downloadLog() {
    if (!room) return;
    try {
      const logs = await api.schreibraum.log(room.id);
      const rows = [["Zeit", "Teilnehmer", "Aktion", "Detail"],
        ...logs.map((l) => [new Date(l.ts).toLocaleString(), l.participant_name, l.action, l.detail ?? ""])];
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      downloadFile(new Blob([csv], { type: "text/csv" }), `raum-${room.code}-log.csv`);
    } catch {}
  }

  const outlineBtn: React.CSSProperties = {
    width: "100%", padding: "7px 0", borderRadius: 8, cursor: "pointer",
    border: "1px solid var(--border)", background: "var(--bg)",
    color: "var(--text-muted)", fontWeight: 600, fontSize: 13,
  };

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!auth) {
    return <div style={{ padding: 32, color: "var(--text-muted)" }}>Bitte anmelden, um den Schreibraum zu nutzen.</div>;
  }
  if (loading) {
    return <div style={{ padding: 32, color: "var(--text-muted)" }}>Lade Raum…</div>;
  }
  if (kicked) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>Du wurdest aus dem Raum entfernt.</div>
        <button onClick={() => router.push("/schreibraum")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#111", fontWeight: 700, cursor: "pointer" }}>
          Zurück zur Übersicht
        </button>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div style={{ color: "#ef4444", marginBottom: 12 }}>{error}</div>
        <button onClick={() => router.push("/schreibraum")} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#111", fontWeight: 700, cursor: "pointer" }}>
          Zurück
        </button>
      </div>
    );
  }
  if (!room || !participant) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
        borderBottom: "1px solid var(--border)", background: "var(--surface)",
        flexShrink: 0, flexWrap: "wrap",
      }}>
        <button onClick={() => router.push("/schreibraum")} style={{ fontSize: 13, color: "var(--text-muted)", border: "none", background: "transparent", cursor: "pointer" }}>
          ← Zurück
        </button>

        <span style={{ fontWeight: 700, fontSize: 16 }}>{room.title}</span>

        {/* Join code — click to copy */}
        <span
          onClick={() => navigator.clipboard.writeText(room.code)}
          title="Code kopieren"
          style={{ fontWeight: 800, fontSize: 15, letterSpacing: 3, color: "var(--accent)", background: "rgba(255,235,59,0.1)", padding: "2px 10px", borderRadius: 7, fontFamily: "monospace", cursor: "copy" }}
        >
          {room.code}
        </span>

        {/* Permanent toggle (teacher) */}
        {isTeacher && (
          <button
            onClick={togglePermanent}
            title={room.is_permanent ? "Permanent — klick für temporär" : "Temporär — klick für permanent"}
            style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99,
              border: "none", cursor: "pointer",
              background: room.is_permanent ? "rgba(34,197,94,0.15)" : "rgba(250,204,21,0.15)",
              color: room.is_permanent ? "#4caf50" : "#c8a000",
            }}
          >
            {room.is_permanent ? "permanent" : "temporär"}
          </button>
        )}

        {/* Right side: save feedback + export menu + user badge */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {saveMsg && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{saveMsg}</span>}

          {isTeacher && (
            <>
              <button
                onClick={handleSave}
                style={{ fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--accent)", color: "#111", fontWeight: 700, cursor: "pointer" }}
              >
                💾 Speichern
              </button>
              <ExportMenu onMd={downloadMarkdown} onHtml={downloadHtml} onPdf={downloadPdf} onLog={downloadLog} />
            </>
          )}

          <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: participant.color, display: "inline-block" }} />
            {participant.name}
            {isTeacher && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 8, background: "rgba(255,235,59,0.15)", color: "#c8a000", fontWeight: 600 }}>👑 Lehrer</span>}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, minHeight: 0, display: "grid",
        gridTemplateColumns: isTeacher ? "1fr 260px" : "1fr",
        gap: 0, overflow: "hidden",
      }}>
        {/* Editor area */}
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Wortstaffel banners */}
          {mode === "wortstaffel" && !isTeacher && (
            currentTurnId === participant.id ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)" }}>
                <span style={{ fontWeight: 700, color: "#4caf50", fontSize: 15 }}>✍️ Du bist dran!</span>
                <button
                  onClick={() => sendTurnAction({ action: "next_turn" })}
                  style={{ marginLeft: "auto", padding: "5px 14px", borderRadius: 8, border: "none", background: "#4caf50", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                >
                  Fertig →
                </button>
              </div>
            ) : (
              <div style={{ padding: "8px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)" }}>
                ⏳ Bitte warten — ein anderer Schüler schreibt gerade.
              </div>
            )
          )}
          <Editor
            ref={editorRef}
            roomId={room.id}
            roomCode={room.code}
            roomTitle={room.title}
            participant={participant}
            mode={mode}
            onKicked={() => setKicked(true)}
            onModeChange={isTeacher ? handleModeChange : (m) => setMode(m)}
            readOnly={mode === "wortstaffel" && !isTeacher && currentTurnId !== participant.id}
          />
        </div>

        {/* Teacher sidebar */}
        {isTeacher && (
          <div style={{
            borderLeft: "1px solid var(--border)", overflowY: "auto",
            padding: 12, display: "flex", flexDirection: "column", gap: 10,
            background: "var(--bg)",
          }}>
            {/* QR code */}
            <Panel title="QR-Code / Beitritt" defaultOpen={true}>
              <QRPanel roomCode={room.code} />
            </Panel>

            {/* Wortstaffel turn control */}
            {mode === "wortstaffel" && (
              <Panel title="Wortstaffel — Reihe" defaultOpen={true}>
                <WortstaffelPanel
                  roomId={room.id}
                  currentTurnId={currentTurnId}
                  onSetTurn={(pid) => sendTurnAction({ action: "set_turn", participant_id: pid })}
                  onNext={() => sendTurnAction({ action: "next_turn" })}
                  onClear={() => sendTurnAction({ action: "clear_turn" })}
                />
              </Panel>
            )}

            {/* Access / Zugang */}
            <Panel title="Zugang" defaultOpen={false}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
                {room.access.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Nur Lehrer — noch kein Schüler-Zugang</span>
                )}
                {room.access.map((g) => (
                  <span key={g.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}>
                    {g.label}
                    <button
                      onClick={async () => {
                        try {
                          await api.schreibraum.removeAccess(room.id, g.id);
                          setRoom((r) => r ? { ...r, access: r.access.filter((a) => a.id !== g.id) } : r);
                        } catch (e: any) { toast(e.message ?? "Fehler", "error"); }
                      }}
                      style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11 }}
                    >✕</button>
                  </span>
                ))}
              </div>
              <AddAccessForm roomId={room.id} onAdded={(grant) => setRoom((r) => r ? { ...r, access: [...r.access, grant] } : r)} />
            </Panel>

            {/* Participants */}
            <Panel title="Schüler" defaultOpen={true}>
              <ParticipantPanel roomId={room.id} />
            </Panel>

            {/* Action log */}
            <Panel title="Aktivitätslog" defaultOpen={false}>
              <ActionLog roomId={room.id} />
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wortstaffel teacher panel ─────────────────────────────────────────────────

function WortstaffelPanel({
  roomId,
  currentTurnId,
  onSetTurn,
  onNext,
  onClear,
}: {
  roomId: string;
  currentTurnId: string | null;
  onSetTurn(pid: string): void;
  onNext(): void;
  onClear(): void;
}) {
  const [participants, setParticipants] = useState<SchreibraumParticipant[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const ps = await api.schreibraum.participants(roomId);
        if (alive) setParticipants(ps.filter((p) => !p.is_teacher && !p.is_kicked));
      } catch {}
    }
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [roomId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <button
          onClick={onNext}
          style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#111", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
        >
          ▶ Nächste
        </button>
        <button
          onClick={onClear}
          title="Niemandem dran"
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
        >
          ✕
        </button>
      </div>
      {participants.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Noch keine Schüler</div>
      )}
      {participants.map((p) => {
        const active = p.id === currentTurnId;
        return (
          <div
            key={p.id}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 8,
              background: active ? "rgba(34,197,94,0.15)" : "var(--surface)",
              border: active ? "1px solid rgba(34,197,94,0.4)" : "1px solid transparent",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <button
              onClick={() => onSetTurn(p.id)}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, background: active ? "#4caf50" : "var(--border)", color: active ? "#fff" : "var(--text-muted)" }}
            >
              {active ? "✓ Dran" : "Dran"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Participant panel (auto-refreshing) ───────────────────────────────────────

function ParticipantPanel({ roomId }: { roomId: string }) {
  const [participants, setParticipants] = useState<SchreibraumParticipant[]>([]);

  async function load() {
    try { setParticipants(await api.schreibraum.participants(roomId)); } catch {}
  }

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => clearInterval(id);
  }, [roomId]);

  const students = participants.filter((p) => !p.is_teacher);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {students.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Noch keine Schüler</div>}
      {students.map((p) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", borderRadius: 8, fontSize: 13,
          background: p.is_kicked ? "rgba(239,68,68,0.08)" : "var(--surface)",
        }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ flex: 1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
          {p.is_kicked ? (
            <button
              onClick={async () => { try { await api.schreibraum.rejoinToggle(roomId, p.id); load(); } catch {} }}
              style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, border: "none", cursor: "pointer", background: p.rejoin_allowed ? "rgba(34,197,94,0.15)" : "var(--border)", color: p.rejoin_allowed ? "#4caf50" : "var(--text-muted)" }}
            >
              {p.rejoin_allowed ? "Rückkehr ✓" : "Gekickt"}
            </button>
          ) : (
            <button
              onClick={async () => { if (!confirm(`${p.name} kicken?`)) return; try { await api.schreibraum.kick(roomId, p.id); load(); } catch {} }}
              style={{ fontSize: 11, padding: "2px 7px", borderRadius: 5, border: "none", background: "rgba(239,68,68,0.12)", color: "#ef4444", cursor: "pointer" }}
            >
              Kick
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
