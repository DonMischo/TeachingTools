"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useRouter } from "next/navigation";
import { useTheme } from "@/contexts/ThemeContext";
import type { StyleManifest } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";

// ── CSS variables the user can customise ─────────────────────────────────────

const COLOR_VARS: { key: string; label: string; hint: string }[] = [
  { key: "bg",           label: "Hintergrund",       hint: "Seitenhintergrund" },
  { key: "surface",      label: "Fläche",            hint: "Karten, Panels" },
  { key: "surface-hover",label: "Fläche (Hover)",    hint: "Hover-Zustand" },
  { key: "border",       label: "Rahmen",            hint: "Trennlinien, Ränder" },
  { key: "text",         label: "Text",              hint: "Primärtext" },
  { key: "text-muted",   label: "Text (gedimmt)",    hint: "Sekundärtext, Hints" },
  { key: "accent",       label: "Akzentfarbe",       hint: "Buttons, aktive Elemente" },
  { key: "accent-text",  label: "Akzent-Text",       hint: "Text auf Akzentfläche" },
];

const NAV_KEYS = ["home","caputh","sportundspiele","haeuser","schreibraum","admin","punkte","user","login"] as const;

// ── Helper: read current computed CSS var ─────────────────────────────────────

function getComputedVar(key: string): string {
  if (typeof window === "undefined") return "#888888";
  return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim() || "#888888";
}

// ── Drag-and-drop ZIP zone ────────────────────────────────────────────────────

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragEnter={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      onClick={() => ref.current?.click()}
      className="cursor-pointer rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-3 py-10 px-6 text-center"
      style={{
        borderColor: dragging ? "var(--accent)" : "var(--border)",
        background: dragging ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--bg)",
      }}
    >
      <span className="text-4xl">📦</span>
      <div>
        <p className="font-semibold text-sm">ZIP hier hineinziehen</p>
        <p className="text-xs text-(--text-muted) mt-1">oder klicken zum Auswählen</p>
      </div>
      <input ref={ref} type="file" accept=".zip,application/zip" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </div>
  );
}

// ── Color editor ──────────────────────────────────────────────────────────────

function ColorEditor({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const [colors, setColors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialise from computed styles once mounted
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const { key } of COLOR_VARS) {
      const val = getComputedVar(key);
      // Convert to hex for color input
      init[key] = val.startsWith("#") ? val : val;
    }
    setColors(init);
  }, []);

  function applyLive(key: string, value: string) {
    setColors(prev => ({ ...prev, [key]: value }));
    document.documentElement.style.setProperty(`--${key}`, value);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/style/colors", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(colors),
      });
      if (!r.ok) throw new Error(await r.text());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e: any) {
      toast(e.message ?? "Fehler beim Speichern", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Farbanpassungen zurücksetzen?")) return;
    await fetch("/api/admin/style/colors", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Remove inline overrides
    for (const { key } of COLOR_VARS) {
      document.documentElement.style.removeProperty(`--${key}`);
    }
    onSaved();
    // Re-read computed values
    const init: Record<string, string> = {};
    for (const { key } of COLOR_VARS) init[key] = getComputedVar(key);
    setColors(init);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {COLOR_VARS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-(--bg) border border-(--border)">
            <input
              type="color"
              value={colors[key] ?? "#888888"}
              onChange={e => applyLive(key, e.target.value)}
              className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent p-0.5"
              title={label}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-(--text-muted) font-mono">{colors[key] ?? ""} · {hint}</div>
            </div>
            <div className="w-6 h-6 rounded-full border border-(--border) shrink-0"
              style={{ backgroundColor: colors[key] }} />
          </div>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm py-2 px-5"
        >
          {saving ? "Speichere…" : saved ? "✓ Gespeichert" : "Farben speichern"}
        </button>
        <button onClick={handleReset} className="btn-secondary text-sm py-2 px-4">
          Zurücksetzen
        </button>
      </div>
    </div>
  );
}

// ── Current style status ──────────────────────────────────────────────────────

function StyleStatus({ manifest, onReset }: { manifest: StyleManifest; onReset: () => void }) {
  const hasAnything = manifest.logo || manifest.icons.length > 0 || Object.keys(manifest.theme).length > 0;

  if (!hasAnything) {
    return (
      <p className="text-sm text-(--text-muted) italic">Kein benutzerdefiniertes Style Pack aktiv.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-(--text-muted) w-16 shrink-0">Logo</span>
        {manifest.logo ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={manifest.logo} alt="custom logo" className="h-8 w-auto rounded-sm" />
            <span className="text-xs text-green-400">✓ aktiv</span>
          </div>
        ) : (
          <span className="text-xs text-(--text-muted)">–</span>
        )}
      </div>

      {/* Icons */}
      <div className="flex items-start gap-3">
        <span className="text-xs text-(--text-muted) w-16 shrink-0 pt-0.5">Icons</span>
        <div className="flex flex-wrap gap-1.5">
          {NAV_KEYS.map(k => (
            <span key={k}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                manifest.icons.includes(k)
                  ? "border-green-700 bg-green-900/30 text-green-300"
                  : "border-(--border) text-(--text-muted) opacity-40"
              }`}>
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* Theme colors */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-(--text-muted) w-16 shrink-0">Farben</span>
        {Object.keys(manifest.theme).length > 0 ? (
          <div className="flex gap-1.5 flex-wrap items-center">
            {Object.entries(manifest.theme).map(([k, v]) => (
              <div key={k} title={`--${k}: ${v}`}
                className="w-5 h-5 rounded-full border border-(--border)"
                style={{ backgroundColor: v }} />
            ))}
            <span className="text-xs text-green-400 ml-1">✓ {Object.keys(manifest.theme).length} Variablen</span>
          </div>
        ) : (
          <span className="text-xs text-(--text-muted)">–</span>
        )}
      </div>

      <button
        onClick={onReset}
        className="self-start text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors mt-1"
      >
        ✕ Alles zurücksetzen
      </button>
    </div>
  );
}

// ── ZIP format docs ───────────────────────────────────────────────────────────

function ZipFormatDocs() {
  return (
    <details className="text-xs text-(--text-muted)">
      <summary className="cursor-pointer hover:text-(--text) select-none">ZIP-Format anzeigen</summary>
      <pre className="mt-2 p-3 rounded-lg bg-(--bg) border border-(--border) font-mono leading-relaxed overflow-x-auto text-[11px]">{`style-pack.zip
├── theme.json          ← Farbvariablen
├── logo.svg            ← oder .png / .jpg / .webp
└── icons/
    ├── home.svg
    ├── caputh.svg
    ├── sportundspiele.svg
    ├── haeuser.svg
    ├── schreibraum.svg
    ├── admin.svg
    ├── punkte.svg
    ├── user.svg
    └── login.svg

theme.json Beispiel:
{
  "bg": "#0d1117",
  "surface": "#161b22",
  "surface-hover": "#21262d",
  "border": "#30363d",
  "text": "#e6edf3",
  "text-muted": "#8b949e",
  "accent": "#58a6ff",
  "accent-text": "#0d1117"
}`}</pre>
    </details>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminStylePage() {
  const { auth } = useAuth();
  const router = useRouter();
  const { style, reloadStyle } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [tab, setTab] = useState<"pack" | "colors">("pack");

  const { ready: aReady, isAdmin: aAdmin, has: aHas } = useAdminAccess();
  const allowed = aAdmin || aHas("style_pack");
  useEffect(() => {
    if (aReady && !allowed) router.replace("/");
  }, [aReady, allowed, router]);

  const handleZip = useCallback(async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/style/pack", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const result = await r.json();
      setUploadResult(result);
      reloadStyle();
    } catch (e: any) {
      setUploadResult({ error: e.message ?? "Upload fehlgeschlagen" });
    } finally {
      setUploading(false);
    }
  }, [reloadStyle]);

  async function handleReset() {
    if (!confirm("Alle benutzerdefinierten Stile zurücksetzen?")) return;
    await fetch("/api/admin/style", { method: "DELETE", credentials: "include" });
    reloadStyle();
    setUploadResult(null);
  }

  if (!auth || !aReady || !allowed) return null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-(--seite-breite) mx-auto w-full">
      <div>
        <button onClick={() => router.push("/admin")} className="mb-2 text-sm text-(--text-muted) hover:text-(--text) transition-colors">← Zurück</button>
        <h1 className="text-2xl font-black tracking-tight">🎨 Style Pack</h1>
        <p className="text-(--text-muted) text-sm mt-1">Logo · Icons · Farben anpassen</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-(--surface) border border-(--border) rounded-xl p-1 self-start">
        {([["pack", "📦 Style Pack"], ["colors", "🎨 Farben"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              tab === t
                ? "bg-(--accent) text-(--accent-text,#111)"
                : "text-(--text-muted) hover:text-(--text)"
            }`}>{label}</button>
        ))}
      </div>

      {/* ── Pack tab ── */}
      {tab === "pack" && (
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-(--border) bg-(--surface) p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-sm">ZIP hochladen</h2>
            <ZipFormatDocs />
            <DropZone onFile={handleZip} />
            {uploading && <p className="text-sm text-(--text-muted) animate-pulse">Verarbeite ZIP…</p>}
            {uploadResult && !uploadResult.error && (
              <div className="text-sm rounded-lg p-3 bg-green-900/30 text-green-300">
                <strong>Erfolgreich importiert:</strong>
                {uploadResult.logo && <div>• Logo: {uploadResult.logo}</div>}
                {uploadResult.icons?.length > 0 && <div>• Icons: {uploadResult.icons.join(", ")}</div>}
                {uploadResult.theme && <div>• Farbschema</div>}
                {uploadResult.errors?.length > 0 && (
                  <div className="mt-1 text-yellow-400 text-xs">
                    Warnungen: {uploadResult.errors.join("; ")}
                  </div>
                )}
              </div>
            )}
            {uploadResult?.error && (
              <div className="text-sm rounded-lg p-3 bg-red-900/30 text-red-300">{uploadResult.error}</div>
            )}
          </section>

          <section className="rounded-2xl border border-(--border) bg-(--surface) p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-sm">Aktives Style Pack</h2>
            <StyleStatus manifest={style} onReset={handleReset} />
          </section>
        </div>
      )}

      {/* ── Colors tab ── */}
      {tab === "colors" && (
        <section className="rounded-2xl border border-(--border) bg-(--surface) p-5 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-sm">Farbvariablen</h2>
            <p className="text-xs text-(--text-muted) mt-1">
              Änderungen werden sofort in der Vorschau angezeigt und nach dem Speichern
              für alle Nutzer übernommen. Sie überschreiben das gewählte Farbschema.
            </p>
          </div>
          <ColorEditor onSaved={reloadStyle} />
        </section>
      )}
    </div>
  );
}
