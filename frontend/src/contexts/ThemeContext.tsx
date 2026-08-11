"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { ColorTheme, IconTheme } from "@/lib/theme";
import { LS_COLOR, LS_ICON } from "@/lib/theme";

export interface StyleManifest {
  logo: string | null;
  favicon: string | null;
  icons: string[];       // list of nav keys that have custom SVGs
  theme: Record<string, string>;  // CSS var overrides, e.g. { accent: "#ff0000" }
}

interface ThemeCtx {
  colorTheme: ColorTheme;
  iconTheme: IconTheme;
  setColorTheme: (t: ColorTheme) => void;
  setIconTheme: (t: IconTheme) => void;
  style: StyleManifest;
  reloadStyle: () => void;
}

const DEFAULT_STYLE: StyleManifest = { logo: null, favicon: null, icons: [], theme: {} };

const Ctx = createContext<ThemeCtx>({
  colorTheme: "default",
  iconTheme: "emoji",
  setColorTheme: () => {},
  setIconTheme: () => {},
  style: DEFAULT_STYLE,
  reloadStyle: () => {},
});

export function useTheme() { return useContext(Ctx); }

function applyCustomColors(vars: Record<string, string>) {
  const el = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    if (v) el.style.setProperty(`--${k}`, v);
  }
}

function clearCustomColors() {
  const VARS = ["bg", "surface", "surface-hover", "border", "text", "text-muted", "accent", "accent-text"];
  const el = document.documentElement;
  for (const k of VARS) el.style.removeProperty(`--${k}`);
}

async function fetchManifest(): Promise<StyleManifest> {
  try {
    const r = await fetch("/api/admin/style/manifest");
    if (r.ok) return r.json();
  } catch { /* offline */ }
  return DEFAULT_STYLE;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("ege");
  const [iconTheme, setIconThemeState] = useState<IconTheme>("emoji");
  const [style, setStyle] = useState<StyleManifest>(DEFAULT_STYLE);

  useEffect(() => {
    const c = (localStorage.getItem(LS_COLOR) ?? "ege") as ColorTheme;
    const i = (localStorage.getItem(LS_ICON)  ?? "emoji")   as IconTheme;
    setColorThemeState(c);
    setIconThemeState(i);
    document.documentElement.setAttribute("data-theme", c);

    fetchManifest().then(m => {
      setStyle(m);
      if (m.theme && Object.keys(m.theme).length > 0) {
        applyCustomColors(m.theme);
      }
      if (m.favicon) {
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          document.head.appendChild(link);
        }
        link.href = m.favicon + "?v=" + Date.now();
      }
    });
  }, []);

  function setColorTheme(t: ColorTheme) {
    setColorThemeState(t);
    localStorage.setItem(LS_COLOR, t);
    document.documentElement.setAttribute("data-theme", t);
    // Re-apply custom colors on top (theme change resets inline styles)
    if (Object.keys(style.theme).length > 0) {
      setTimeout(() => applyCustomColors(style.theme), 0);
    }
  }

  function setIconTheme(t: IconTheme) {
    setIconThemeState(t);
    localStorage.setItem(LS_ICON, t);
  }

  function reloadStyle() {
    fetchManifest().then(m => {
      setStyle(m);
      clearCustomColors();
      if (m.theme && Object.keys(m.theme).length > 0) {
        applyCustomColors(m.theme);
      }
    });
  }

  return (
    <Ctx.Provider value={{ colorTheme, iconTheme, setColorTheme, setIconTheme, style, reloadStyle }}>
      {children}
    </Ctx.Provider>
  );
}
