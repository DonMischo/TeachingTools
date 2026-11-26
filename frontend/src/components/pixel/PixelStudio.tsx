"use client";
/**
 * Pixel-Studio: Bibliothek (eigene Projekte, Vorlagen der Lehrkräfte, Neu, Import) und Editor.
 * Ohne `zugang` speichert es am Konto, mit Code und Gast-Token in der Sitzung.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, type MausZugang, type PixelProjektKurz } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ausDaten, neuesProjekt, PALETTEN, zuDaten, type PixelDaten } from "@/lib/pixel/dokument";
import { quantisieren } from "@/lib/pixel/werkzeuge";
import { sheetZuBildern } from "@/lib/pixel/befehle";
import { gifLesen, gifZuProjekt } from "@/lib/pixel/gifLesen";
import { BEISPIELE } from "@/lib/pixel/beispiele";
import { bildDateiLesen, vorschauPng } from "./leinwand";
import Editor from "./Editor";
import { SimKopf } from "@/components/SimKopf";

const GROESSEN = [8, 16, 24, 32, 48, 64, 128];

export default function PixelStudio({ action, zugang }: { action?: ReactNode; zugang?: MausZugang }) {
  const { auth } = useAuth();
  const lehrkraft = auth?.user_type === "teacher";
  const [offen, setOffen] = useState<{ id: number; name: string; daten: PixelDaten; geteilt: boolean; fremd: boolean } | null>(null);

  if (offen) return (
    <Editor key={offen.id} id={offen.id} name={offen.name} daten={offen.daten} geteilt={offen.geteilt} nurLesen={offen.fremd}
      lehrkraft={lehrkraft} zugang={zugang} zurueck={() => setOffen(null)}
      kopieren={async (name, daten) => {
        const neu = await api.pixel.anlegen({ name, daten }, zugang);
        setOffen({ id: neu.id, name: neu.name, daten: neu.daten as PixelDaten, geteilt: false, fremd: false });
      }} />
  );
  return <Bibliothek action={action} zugang={zugang} oeffne={setOffen} />;
}

function Bibliothek({ action, zugang, oeffne }: {
  action?: ReactNode; zugang?: MausZugang;
  oeffne: (o: { id: number; name: string; daten: PixelDaten; geteilt: boolean; fremd: boolean }) => void;
}) {
  const [eigene, setEigene] = useState<PixelProjektKurz[] | null>(null);
  const [vorlagen, setVorlagen] = useState<PixelProjektKurz[]>([]);
  const [fehler, setFehler] = useState("");
  const [neu, setNeu] = useState({ name: "Mein Sprite", breite: 16, hoehe: 16, palette: PALETTEN[0].id });
  const [importPalette, setImportPalette] = useState(true);
  const [sheet, setSheet] = useState({ an: false, w: 16, h: 16 });
  const datei = useRef<HTMLInputElement>(null);
  // Vorschaubilder der Beispiele brauchen ein Canvas: erst im Browser bauen
  const [beispielBilder, setBeispielBilder] = useState<Record<string, string>>({});
  useEffect(() => { setBeispielBilder(Object.fromEntries(BEISPIELE.map(b => [b.id, vorschauPng(b.bauen())]))); }, []);

  const laden = useCallback(() => {
    api.pixel.liste(zugang).then(setEigene).catch(e => { setEigene([]); setFehler(meldung(e)); });
    api.pixel.vorlagen(zugang).then(setVorlagen).catch(() => setVorlagen([]));
  }, [zugang]);
  useEffect(laden, [laden]);

  async function anlegen(daten: PixelDaten, name: string) {
    setFehler("");
    try {
      const r = await api.pixel.anlegen({ name, daten, vorschau: vorschauPng(ausDaten(daten)) }, zugang);
      oeffne({ id: r.id, name: r.name, daten: r.daten as PixelDaten, geteilt: false, fremd: false });
    } catch (e) { setFehler(meldung(e)); }
  }

  async function oeffnen(k: PixelProjektKurz, fremd: boolean) {
    try {
      const r = await api.pixel.laden(k.id, zugang);
      oeffne({ id: r.id, name: r.name, daten: r.daten as PixelDaten, geteilt: r.geteilt, fremd });
    } catch (e) { setFehler(meldung(e)); }
  }

  async function importieren(f: File) {
    try {
      const name = f.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Import";
      // animiertes GIF: alle Bilder samt Dauer
      if (f.type === "image/gif" || /\.gif$/i.test(f.name)) {
        const g = gifLesen(new Uint8Array(await f.arrayBuffer()));
        if (g.bilder.length > 1 && !sheet.an) return await anlegen(zuDaten(gifZuProjekt(g)), name);
      }
      const { rgba, w, h } = await bildDateiLesen(f, sheet.an ? 1024 : 256);
      const pal = PALETTEN.find(p => p.id === neu.palette)!.farben;
      const q = quantisieren(rgba, pal, importPalette, 64);
      if (sheet.an) {
        const s = sheetZuBildern(q.zelle, w, h, q.palette, sheet.w, sheet.h);
        if (!s) return setFehler("In dieser Feldgröße wurde nichts gefunden.");
        return await anlegen(zuDaten(s), name);
      }
      const p = neuesProjekt(w, h, q.palette);
      p.zellen[p.ebenen[0].id][0] = q.zelle;
      await anlegen(zuDaten(p), name);
    } catch (e) { setFehler(meldung(e)); }
  }

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-[var(--seite-breite)] mx-auto w-full">
      <SimKopf titel="👾 Pixel-Studio" action={action}>Sprites, Figuren und Kacheln Pixel für Pixel zeichnen und animieren. Alles wird an deinem Konto gespeichert.</SimKopf>
      {fehler && <p className="text-bad text-sm">{fehler}</p>}

      <section className="card p-4 flex flex-col gap-3">
        <h2 className="font-bold">✨ Neues Projekt</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">Name
            <input className="input" value={neu.name} maxLength={80} onChange={e => setNeu({ ...neu, name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">Breite
            <input className="input w-20" type="number" min={1} max={256} value={neu.breite} onChange={e => setNeu({ ...neu, breite: grenze(+e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">Höhe
            <input className="input w-20" type="number" min={1} max={256} value={neu.hoehe} onChange={e => setNeu({ ...neu, hoehe: grenze(+e.target.value) })} />
          </label>
          <label className="flex flex-col gap-1 text-sm">Palette
            <select className="input" value={neu.palette} onChange={e => setNeu({ ...neu, palette: e.target.value })}>
              {PALETTEN.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <button className="btn-primary" onClick={() => anlegen(zuDaten(neuesProjekt(neu.breite, neu.hoehe, PALETTEN.find(p => p.id === neu.palette)!.farben)), neu.name.trim() || "Ohne Namen")}>Anlegen</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {GROESSEN.map(g => <button key={g} className={`chip ${neu.breite === g && neu.hoehe === g ? "chip-on" : ""}`} onClick={() => setNeu({ ...neu, breite: g, hoehe: g })}>{g}×{g}</button>)}
        </div>
        <div className="flex flex-wrap gap-3 items-center text-sm border-t border-line pt-3">
          <button className="btn-secondary" onClick={() => datei.current?.click()}>🖼️ Bild importieren …</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={importPalette} onChange={e => setImportPalette(e.target.checked)} /> Farben aus dem Bild übernehmen (sonst auf die gewählte Palette abbilden)</label>
          <label className="flex items-center gap-1" title="ein Bild mit vielen gleich großen Feldern (Sprite-Sheet, Animationsstreifen) wird in Bilder zerlegt">
            <input type="checkbox" checked={sheet.an} onChange={e => setSheet({ ...sheet, an: e.target.checked })} /> als Sprite-Sheet zerschneiden</label>
          {sheet.an && <span className="flex items-center gap-1">Feld
            <input className="input w-16 py-0.5" type="number" min={1} max={256} value={sheet.w} onChange={e => setSheet({ ...sheet, w: grenze(+e.target.value) })} />×
            <input className="input w-16 py-0.5" type="number" min={1} max={256} value={sheet.h} onChange={e => setSheet({ ...sheet, h: grenze(+e.target.value) })} /></span>}
          <span className="text-muted">Animierte GIFs werden mit allen Bildern übernommen.</span>
          <input ref={datei} type="file" accept="image/png,image/gif,image/jpeg,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importieren(f); e.target.value = ""; }} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">🌟 Beispiele</h2>
        <p className="text-muted text-sm">Zum Ansehen und Abspielen; »Als Kopie bearbeiten« legt eins in deine Projekte, dann kannst du alles darin ändern.</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {BEISPIELE.map((b, k) => (
            <button key={b.id} className="card p-2 flex gap-3 items-center text-left hover:border-line-active"
              onClick={() => oeffne({ id: -1 - k, name: b.name, daten: zuDaten(b.bauen()), geteilt: false, fremd: true })}>
              <span className="w-20 h-20 shrink-0 rounded-lg flex items-center justify-center" style={SCHACH}>
                {beispielBilder[b.id] && <img src={beispielBilder[b.id]} alt="" style={{ imageRendering: "pixelated", width: "88%", height: "88%", objectFit: "contain" }} />}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-sm">{b.name}</span>
                <span className="text-xs text-muted">{b.text}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-bold">📁 Meine Projekte</h2>
        {eigene === null ? <p className="text-muted text-sm">Lade …</p>
          : eigene.length === 0 ? <p className="text-muted text-sm">Noch keine Projekte. Leg oben eins an!</p>
          : <Raster liste={eigene} oeffnen={k => oeffnen(k, false)} loeschen={async k => {
              if (!confirm(`»${k.name}« wirklich löschen?`)) return;
              await api.pixel.loeschen(k.id, zugang).catch(e => setFehler(meldung(e)));
              laden();
            }} />}
      </section>

      {vorlagen.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-bold">📚 Vorlagen der Lehrkräfte</h2>
          <p className="text-muted text-sm">Öffnen zum Ansehen, »Als Kopie bearbeiten« legt sie in deine Projekte.</p>
          <Raster liste={vorlagen} oeffnen={k => oeffnen(k, true)} />
        </section>
      )}
    </div>
  );
}

function Raster({ liste, oeffnen, loeschen }: { liste: PixelProjektKurz[]; oeffnen: (k: PixelProjektKurz) => void; loeschen?: (k: PixelProjektKurz) => void }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
      {liste.map(k => (
        <div key={k.id} className="card p-2 flex flex-col gap-1 hover:border-line-active">
          <button onClick={() => oeffnen(k)} className="aspect-square rounded-lg flex items-center justify-center overflow-hidden" style={SCHACH}>
            {k.vorschau
              ? <img src={k.vorschau} alt="" className="max-w-full max-h-full" style={{ imageRendering: "pixelated", width: "88%", height: "88%", objectFit: "contain" }} />
              : <span className="text-3xl">👾</span>}
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => oeffnen(k)} className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-sm truncate">{k.geteilt ? "📚 " : ""}{k.name}</div>
              <div className="text-xs text-muted">{k.breite}×{k.hoehe}{k.bilder > 1 ? ` · ${k.bilder} Bilder` : ""}{k.besitzer ? ` · ${k.besitzer}` : ""}</div>
            </button>
            {loeschen && <button title="Löschen" className="text-muted hover:text-bad px-1" onClick={() => loeschen(k)}>🗑</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Schachbrett für durchsichtige Pixel */
export const SCHACH = { background: "repeating-conic-gradient(#c8c8c8 0% 25%, #f0f0f0 0% 50%) 50% / 16px 16px" };

const grenze = (v: number) => Math.max(1, Math.min(256, Math.round(v) || 1));

export function meldung(e: unknown) {
  const t = e instanceof Error ? e.message : String(e);
  try { const d = JSON.parse(t).detail; if (typeof d === "string") return d; } catch { /* kein JSON */ }
  return t || "Fehler";
}
