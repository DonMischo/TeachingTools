"use client";
/**
 * »Elemon« als eigenes Spiel (ohne Klikk-Woche): dieselbe App wie auf dem
 * Klikk-Handy, die Spielzeit läuft hier mit der echten Uhr (4 Spielminuten je
 * Minute — eine Energie etwa alle 11 Minuten). Mit Code: Duelle mit allen in
 * der Sitzung. Für Lehrkräfte: QR-Karten mit wilden Elemon zum Ausdrucken.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { MausZugang } from "@/lib/api";
import { ARTEN, ART } from "@/lib/klikk/elemon/daten";
import { ITEMS, qrItem, qrWild, type ItemId } from "@/lib/klikk/elemon/spiel";
import { NAME_MUSTER, namensVorschlaege } from "@/lib/klikk/klasse";
import { ergaenze, neuerStand } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import ElemonApp from "./ElemonApp";

/** Spielminuten je echter Minute */
const TEMPO = 4;

/** Uhr nach der echten Zeit stellen — nur vorwärts, Aktionen dürfen sie vorziehen */
function uhrStellen(s: Stand, jetzt = Date.now()): Stand {
  const start = Number(s.flags.elemonStart ?? 0);
  if (!start) return { ...s, flags: { ...s.flags, elemonStart: jetzt } };
  const real = Math.floor(((jetzt - start) / 60_000) * TEMPO);
  const spiel = s.tag * 1440 + s.uhr;
  if (real <= spiel) return s;
  return { ...s, tag: Math.floor(real / 1440), uhr: real % 1440 };
}

export default function ElemonSpiel({ zugang, speicherSchluessel = "standalone", verwaltung }: {
  zugang?: MausZugang; speicherSchluessel?: string; verwaltung?: boolean;
}) {
  const schluessel = `hp_elemon_${speicherSchluessel}`;
  const code = zugang?.code, token = zugang?.token ?? null;
  const online = useMemo(() => ({ zugang: code ? { code, token } : undefined, konto: !token }), [code, token]);
  // Stand und Schlüssel gehören zusammen: erst laden, dann speichern (StrictMode-Falle)
  const [lage, setLage] = useState<{ schluessel: string; s: Stand } | null>(null);
  useEffect(() => {
    let s: Stand | null = null;
    try { const roh = localStorage.getItem(schluessel); if (roh) s = JSON.parse(roh); } catch { /* leer */ }
    setLage({ schluessel, s: uhrStellen(s ? ergaenze(s) : neuerStand(Math.floor(Math.random() * 1e6))) });
  }, [schluessel]);
  useEffect(() => {
    if (!lage) return;
    try { localStorage.setItem(lage.schluessel, JSON.stringify(lage.s)); } catch { /* voll oder gesperrt */ }
  }, [lage]);
  const setze = useCallback((f: (s: Stand) => Stand) => setLage(l => (l ? { ...l, s: uhrStellen(f(l.s)) } : l)), []);
  useEffect(() => {
    const t = setInterval(() => setze(s => s), 15_000);
    return () => clearInterval(t);
  }, [setze]);
  const [vorschlagSeed, setVorschlagSeed] = useState(1);

  if (!lage) return <div className="card p-6 text-sm text-muted">Lade …</div>;
  const s = lage.s;

  return (
    <div className="flex flex-col gap-4 items-start">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface shadow-lg overflow-hidden min-h-[600px] flex flex-col">
        {!NAME_MUSTER.test(s.name) ? (
          <div className="p-4 flex flex-col gap-3">
            <div className="text-center"><div className="text-4xl">🐾</div><div className="font-black text-xl">Elemon</div></div>
            <p className="text-sm font-bold">Wähle deinen Trainer-Namen:</p>
            <p className="text-xs text-muted">Unter diesem Namen sehen dich die anderen bei Duellen. Echte Namen gibt es hier nicht.</p>
            {namensVorschlaege(s.seed + vorschlagSeed * 101).map(n => (
              <button key={n} className="btn-secondary" onClick={() => setze(st => ({ ...st, name: n }))}>{n}</button>
            ))}
            <button className="text-xs underline text-muted self-start" onClick={() => setVorschlagSeed(v => v + 1)}>Andere Vorschläge</button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto"><ElemonApp s={s} setze={setze} online={online} eigenstaendig /></div>
        )}
      </div>
      {NAME_MUSTER.test(s.name) && (
        <button className="text-xs underline text-muted" onClick={() => {
          if (confirm("Spielstand löschen und neu anfangen?")) setLage({ schluessel, s: uhrStellen(neuerStand(Math.floor(Math.random() * 1e6))) });
        }}>Spielstand löschen & neu anfangen</button>
      )}
      {verwaltung && <QrKarten />}
    </div>
  );
}

const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/**
 * Druckbare QR-Karten: wilde Elemon (scannen = Kampf, fangen) und Items
 * (scannen = gutschreiben, Menge laut Multiplikator). Jede Item-Karte trägt eine
 * eigene Nummer; nach dem Scannen ist genau diese Karte eine Weile gesperrt —
 * je nach Item braucht es also mehrere Karten (höchstens 3–10).
 */
function QrKarten() {
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [stufe, setStufe] = useState(5);
  const [items, setItems] = useState<Record<ItemId, { anzahl: number; menge: number }>>(
    () => Object.fromEntries(ITEM_IDS.map(id => [id, { anzahl: 0, menge: ITEMS[id].menge }])) as Record<ItemId, { anzahl: number; menge: number }>);
  const itemKarten = ITEM_IDS.flatMap(id => Array.from({ length: items[id].anzahl }, (_, i) => ({ id, nr: i + 1, menge: items[id].menge })));
  const setzeItem = (id: ItemId, feld: "anzahl" | "menge", wert: number) => setItems(v => ({ ...v, [id]: { ...v[id], [feld]: wert } }));
  const zufaellig = () => setAuswahl([...ARTEN].sort(() => Math.random() - 0.5).slice(0, 12).map(a => a.id));
  return (
    <div className="card p-4 flex flex-col gap-3 w-full max-w-4xl">
      <style>{`@media print { body * { visibility: hidden; } .elemon-druck, .elemon-druck * { visibility: visible; } .elemon-druck { position: absolute; inset: 0; } }`}</style>
      <h3 className="font-bold">🖨️ QR-Karten für wilde Elemon und Items</h3>
      <p className="text-xs text-muted">Ausdrucken und im Raum oder Schulhaus verteilen. Wer eine Karte scannt (📷 in Elemon), kämpft gegen dieses Elemon und kann es mit dem Käfig fangen. Funktioniert auch ohne Sitzung.</p>
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <label>Stufe <input type="number" min={1} max={50} value={stufe} onChange={e => setStufe(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} className="input w-20" /></label>
        <button className="btn-secondary text-sm" onClick={zufaellig}>🎲 12 zufällige</button>
        <button className="btn-secondary text-sm" onClick={() => setAuswahl(ARTEN.map(a => a.id))}>Alle {ARTEN.length}</button>
        <button className="btn-secondary text-sm" onClick={() => setAuswahl([])}>Leeren</button>
        <button className="btn-primary text-sm" disabled={!auswahl.length && !itemKarten.length} onClick={() => window.print()}>Drucken</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {ARTEN.map(a => (
          <button key={a.id} onClick={() => setAuswahl(v => v.includes(a.id) ? v.filter(x => x !== a.id) : [...v, a.id])}
            className={`rounded-full border px-2 py-0.5 text-xs ${auswahl.includes(a.id) ? "border-accent bg-accent/15" : "border-line"}`}>
            {a.emoji} {a.name}{a.seltenheit === 3 ? " ★" : ""}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <b className="text-sm">Item-Karten</b>
        <p className="text-xs text-muted">Jede Karte hat eine Nummer und ist nach dem Scannen für alle in der Sitzung eine Weile leer. Wie viele Karten es höchstens gibt, hängt davon ab, wie oft das Item gebraucht wird.</p>
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {ITEM_IDS.map(id => {
            const info = ITEMS[id];
            return (
              <div key={id} className="rounded-lg border border-line p-2 flex flex-wrap items-center gap-2">
                <span className="font-bold w-32">{info.emoji} {info.name}</span>
                <label className="text-xs">Karten <input type="number" min={0} max={info.maxKarten} value={items[id].anzahl} className="input w-16"
                  onChange={e => setzeItem(id, "anzahl", Math.max(0, Math.min(info.maxKarten, Number(e.target.value) || 0)))} /> / {info.maxKarten}</label>
                <label className="text-xs">× <input type="number" min={1} max={5} value={items[id].menge} className="input w-14"
                  onChange={e => setzeItem(id, "menge", Math.max(1, Math.min(5, Number(e.target.value) || 1)))} /></label>
                <span className="text-[10px] text-muted">leer für {info.sperreMin} Min.</span>
              </div>
            );
          })}
        </div>
      </div>
      {(auswahl.length > 0 || itemKarten.length > 0) && (
        <div className="elemon-druck grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white text-black p-2">
          {itemKarten.map(k => (
            <div key={`${k.id}-${k.nr}`} className="border-2 border-dashed border-amber-500 rounded-xl p-3 flex flex-col items-center gap-1 break-inside-avoid">
              <div className="text-3xl">{ITEMS[k.id].emoji}</div>
              <QRCodeSVG value={qrItem(k.id, k.menge, k.nr)} size={128} />
              <div className="text-xs font-bold">{k.menge}× {ITEMS[k.id].name}</div>
              <div className="text-[10px]">Karte {k.nr} · scannen in Elemon 📷</div>
            </div>
          ))}
          {auswahl.map(id => (
            <div key={id} className="border-2 border-dashed border-gray-400 rounded-xl p-3 flex flex-col items-center gap-1 break-inside-avoid">
              <div className="text-3xl">{ART[id].emoji}</div>
              <QRCodeSVG value={qrWild(id, stufe)} size={128} />
              <div className="text-xs font-bold">Ein wildes Elemon! (Lv {stufe})</div>
              <div className="text-[10px]">Scannen in Elemon 📷</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
