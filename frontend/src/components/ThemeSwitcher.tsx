"use client";
import { useTheme } from "@/contexts/ThemeContext";
import { COLOR_THEMES, ICON_THEMES } from "@/lib/theme";

export function ThemeSwitcher({ onClose }: { onClose: () => void }) {
  const { colorTheme, iconTheme, setColorTheme, setIconTheme } = useTheme();

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <aside className="fixed top-0 left-12 h-full w-64 z-50 bg-surface border-r border-line flex flex-col overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>🎨 Darstellung</span>
          <button onClick={onClose} className="text-muted hover:text-fg text-lg leading-none">×</button>
        </div>

        <div className="flex flex-col gap-6 p-4">
          {/* Color theme */}
          <section>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Farbthema</p>
            <div className="flex flex-col gap-1.5">
              {COLOR_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setColorTheme(t.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-surface-hover"
                  style={colorTheme === t.id ? {
                    background: "var(--surface-hover)",
                    border: `1px solid ${t.dot}40`,
                    outline: "none",
                  } : { border: "1px solid transparent" }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: "50%",
                    background: t.dot,
                    boxShadow: colorTheme === t.id ? `0 0 6px ${t.dot}` : "none",
                    flexShrink: 0,
                  }} />
                  <span className="text-sm font-medium text-fg">{t.label}</span>
                  {colorTheme === t.id && (
                    <span className="ml-auto text-xs" style={{ color: t.dot }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <hr className="border-line" />

          {/* Icon theme */}
          <section>
            <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">Icons</p>
            <div className="flex flex-col gap-1.5">
              {ICON_THEMES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setIconTheme(t.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-surface-hover"
                  style={iconTheme === t.id ? {
                    background: "var(--surface-hover)",
                    border: "1px solid var(--border-selected)",
                  } : { border: "1px solid transparent" }}
                >
                  <span className="text-base w-6 text-center">
                    {t.id === "emoji" ? "😀" : t.id === "cyberpunk" ? "◈" : "⚔️"}
                  </span>
                  <span className="text-sm font-medium text-fg">{t.label}</span>
                  {iconTheme === t.id && (
                    <span className="ml-auto text-xs text-accent">✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Preview swatches for EGE */}
          {colorTheme === "ege" && (
            <>
              <hr className="border-line" />
              <section>
                <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-2">EGE Farben</p>
                <div className="flex gap-2 flex-wrap">
                  {["#f0d9a8","#e07820","#7a9e2e","#1878a8","#1a3060"].map(c => (
                    <span key={c} title={c} style={{ width: 22, height: 22, borderRadius: 4, background: c, display: "inline-block", border: "1px solid rgba(0,0,0,.15)" }} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
