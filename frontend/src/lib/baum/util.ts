// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
/* Kleine Helfer, von allen Modulen genutzt. */
BL.$ = (sel, root = document) => root.querySelector(sel);
BL.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
BL.html = (str) => { const t = document.createElement("template"); t.innerHTML = str.trim(); return t.content.firstElementChild; };
BL.clamp = (x, a, b) => Math.min(b, Math.max(a, x));
BL.lerp = (a, b, t) => a + (b - a) * t;
BL.fmt = (n, d = 0) => Number(n).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });
BL.rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
BL.shuffle = (arr, r = Math.random) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
BL.css = (name) => getComputedStyle(BL.root || document.documentElement).getPropertyValue(name).trim();
const geladen = new Set();
// Alle Regeln gelten nur unter .baumleben, damit nichts mit den Klassen der App kollidiert (.btn, .chip, .label …)
BL.scope = (css) => css.replace(/(^|[{}])(\s*)([^{}@][^{}]*?)\s*\{/g, (m, pre, ws, sel) => {
  if (/^(from|to|\d+%)/.test(sel.trim())) return m;
  return pre + ws + sel.split(",").map(x => x.trim()).map(x => x === ":root" || x === "body" ? ".baumleben" : x.startsWith(":root") ? ".baumleben" + x.slice(5) : ".baumleben " + x).join(", ") + " {";
});
BL.addStyle = (css) => { if (geladen.has(css)) return; geladen.add(css); const el = document.createElement("style"); el.dataset.baumleben = ""; el.textContent = BL.scope(css); document.head.append(el); };
BL.store = {
  get(k, d) { try { const v = localStorage.getItem("baumleben:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("baumleben:" + k, JSON.stringify(v)); } catch { } }
};
BL.tree = (id) => BL.TREES.find(t => t.id === id);
// Hauptfoto zeigt den ganzen Baum (Habitus); wo das alte Foto eine Nahaufnahme ist, gibt es ein eigenes Habitusfoto
BL.img = (id) => BL.HABITUS && BL.HABITUS[id] ? BL.HABITUS[id].datei : "/baum/img/" + id + ".webp";
BL.credit = (id) => BL.HABITUS && BL.HABITUS[id] ? BL.commonsCredit(BL.HABITUS[id], "Foto") : BL.closeCredit(id);
// Nahaufnahme (Blatt, Blüte, Frucht, Stamm) nur für Arten mit eigenem Habitusfoto
BL.closeImg = (id) => BL.HABITUS && BL.HABITUS[id] ? "/baum/img/" + id + ".webp" : null;
BL.closeCredit = (id) => {
  const c = BL.CREDITS[id]; if (!c) return "";
  return `Foto: ${c.artist} · ${c.license} · <a href="${c.page}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
};
// Canvas mit Geräte-Pixeldichte an Containergröße anpassen
BL.fitCanvas = (cv, w, h) => {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + "px"; cv.style.height = h + "px";
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return ctx;
};
BL.subtabs = (root, names, onChange) => {
  const bar = BL.html(`<div class="subtabs" role="tablist">${names.map((n, i) => `<button role="tab" data-i="${i}" aria-selected="${i === 0}">${n}</button>`).join("")}</div>`);
  bar.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    BL.$$("button", bar).forEach(x => x.setAttribute("aria-selected", x === b));
    onChange(+b.dataset.i);
  });
  root.append(bar); return bar;
};
