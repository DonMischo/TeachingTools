/**
 * Baumleben — Lebenslauf eines Baumes, Stoffströme, Fotosynthese, 30 Bäume bestimmen
 * und das Spiel »Sei ein Baum«. Die Module stammen aus der eigenständigen HTML-Fassung
 * und arbeiten direkt am DOM; mountBaumleben() baut die Ansicht in ein Element und
 * gibt eine Aufräumfunktion zurück.
 */
import { BL } from "./bl";
import "./util";
import "./trees";
import "./credits";
import "./leaves";
import "./treegen";
import "./life";
import "./flows";
import "./photo";
import "./key";
import "./game";

// Farben aus dem Theme der App; die botanischen Farben (Blattgrün, Wasser, Zucker …) sind fest,
// passend zu den dunklen Farbthemen.
const CSS = `
:root {
  --paper: var(--bg); --panel: var(--surface); --ink: var(--text); --muted: var(--text-muted); --line: var(--border);
  --leaf: #8cc77a; --leaf-soft: #22301d; --xylem: #6fa8e0; --phloem: #e2b043; --nutri: #b893d8;
  --gas: #8fc0ba; --soil: #b58f6c; --warn: #ec7a62; --sky: #1b2630;
  --display: inherit; --body: inherit; --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  color: var(--ink); display: grid; gap: 16px;
}
* { box-sizing: border-box }
[hidden] { display: none !important }
h2, h3 { font-family: var(--display); font-weight: 800; text-wrap: balance; margin: 0; line-height: 1.2 }
h2 { font-size: 1.4rem } h3 { font-size: 1.1rem }
p { margin: 0 }
button, input, select { font: inherit; color: inherit }
:focus-visible { outline: 2px solid var(--leaf); outline-offset: 2px }
.mono, .num { font-family: var(--mono); font-variant-numeric: tabular-nums }
nav.bl-tabs { display: flex; gap: 4px; flex-wrap: wrap; border: 1px solid var(--line); background: var(--panel); border-radius: 12px; padding: 4px; width: fit-content; max-width: 100% }
nav.bl-tabs button { border: 0; background: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; color: var(--muted); font-weight: 700; font-size: .9rem }
nav.bl-tabs button:hover { color: var(--ink) }
nav.bl-tabs button[aria-selected="true"] { background: var(--leaf); color: #10200c }
section.view { display: grid; gap: 20px }
.lead { color: var(--muted); max-width: 75ch }
.bench { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 20px; align-items: start }
@media (max-width: 900px) { .bench { grid-template-columns: minmax(0, 1fr) } }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; min-width: 0 }
.stack { display: grid; gap: 12px; min-width: 0 }
.row { display: flex; gap: 8px 12px; flex-wrap: wrap; align-items: center }
.label { font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 400 }
.btn { border: 1px solid var(--line); background: var(--panel); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600 }
.btn:hover { border-color: var(--leaf) }
.btn.primary { background: var(--leaf); color: #10200c; border-color: var(--leaf) }
.btn:disabled { opacity: .45; cursor: not-allowed }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; flex-wrap: wrap }
.seg button { border: 0; background: none; padding: 5px 10px; cursor: pointer; color: var(--muted) }
.seg button[aria-pressed="true"] { background: var(--leaf-soft); color: var(--ink) }
.chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: .8rem; border: 1px solid var(--line); background: none }
label.slider { display: grid; grid-template-columns: 9.5em minmax(0,1fr) 4.5em; gap: 8px; align-items: center; font-size: .9rem }
label.slider output { font-family: var(--mono); font-size: .8rem; text-align: right }
input[type=range] { accent-color: var(--leaf); width: 100% }
select { background: var(--panel) }
canvas, svg { display: block; max-width: 100% }
.canvas-box { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); background: var(--sky) }
.subtabs { display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 8px }
.subtabs button { background: none; border: 0; padding: 4px 2px; margin-right: 10px; cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent }
.subtabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--phloem) }
.prose { display: grid; gap: 10px; max-width: 72ch }
.prose ul { margin: 0; padding-left: 1.2em; list-style: disc }
.eq { font-family: var(--mono); background: var(--leaf-soft); border-radius: 6px; padding: 8px 12px; overflow-x: auto; white-space: nowrap; font-size: .92rem }
.note { font-size: .85rem; color: var(--muted) }
.meter { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden }
.meter > i { display: block; height: 100%; background: var(--leaf) }
table.data { border-collapse: collapse; width: 100%; font-size: .9rem }
table.data td, table.data th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top }
table.data th { font-weight: 700; color: var(--muted); font-size: .8rem }
.scroll-x { overflow-x: auto }
.answers { display: grid; gap: 8px }
.answers button { padding: 10px 12px; text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); cursor: pointer }
.answers button.ok { border-color: var(--leaf); background: var(--leaf-soft) }
.answers button.bad { border-color: var(--warn); color: var(--warn) }
.bl-foot { color: var(--muted); font-size: .8rem }
.leaf-svg { width: 100%; height: 100%; overflow: visible }
.lf-fill { fill: var(--leaf-soft); stroke: var(--leaf); stroke-width: .07; stroke-linejoin: round }
.lf-silver { fill: color-mix(in srgb, var(--leaf-soft) 60%, var(--panel)) }
.lf-vein { fill: none; stroke: var(--leaf); stroke-width: .04; opacity: .7 }
.lf-pet, .lf-twig { fill: none; stroke: var(--soil); stroke-width: .12; stroke-linecap: round }
.lf-twig { stroke-width: .3 }
.lf-needle { fill: none; stroke: var(--leaf); stroke-linecap: round }
.lf-dark { stroke: color-mix(in srgb, var(--leaf) 70%, var(--ink)) }
.lf-flat { fill: var(--leaf); stroke: none }
.lf-stripe { fill: var(--panel) }
.lf-shoot { fill: var(--soil) }
.lf-gland { fill: var(--warn) }
.lf-inset text, .lf-scale text { font: .42px var(--mono); fill: var(--muted) }
.lf-scale path { stroke: var(--muted); stroke-width: .06 }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
`;

const VIEWS = [
  ["leben", "Lebenslauf", "Life"],
  ["stroeme", "Im Baum", "Flows"],
  ["foto", "Fotosynthese", "Photo"],
  ["bestimmen", "Bäume bestimmen", "Key"],
  ["spiel", "Sei ein Baum", "Game"],
] as const;

export function mountBaumleben(root: HTMLElement): () => void {
  BL.root = root;
  BL.addStyle(CSS);
  root.innerHTML = `
    <nav class="bl-tabs" role="tablist" id="tabs">${VIEWS.map(([id, label]) => `<button role="tab" data-view="${id}">${label}</button>`).join("")}</nav>
    ${VIEWS.map(([id]) => `<section class="view" id="view-${id}" hidden></section>`).join("")}
    <p class="bl-foot">Modellwerte sind gerundete Richtwerte für den Unterricht. Fotos: Wikimedia Commons, Urheber und Lizenz stehen beim jeweiligen Baum unter »Bäume bestimmen«. Blattschemata sind eigene Zeichnungen.</p>`;
  const built: Record<string, boolean> = {};
  const show = (name: string) => {
    if (!VIEWS.some(v => v[0] === name)) name = "leben";
    root.querySelectorAll<HTMLButtonElement>("#tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.view === name)));
    for (const [id, , mod] of VIEWS) {
      const el = root.querySelector<HTMLElement>("#view-" + id)!;
      el.hidden = id !== name;
      if (id === name) {
        if (!built[id]) { built[id] = true; BL[mod].init(el); }
        BL[mod].onShow?.();
      } else if (built[id]) BL[mod].onHide?.();
    }
    BL.store.set("tab", name);
  };
  BL.show = show;
  root.querySelector("#tabs")!.addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-view]");
    if (b) show(b.dataset.view!);
  });
  show(BL.store.get("tab", "leben"));
  return () => {
    for (const [id, , mod] of VIEWS) if (built[id]) BL[mod].onHide?.();
    root.innerHTML = "";
  };
}
