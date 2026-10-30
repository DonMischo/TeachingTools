"use client";
/**
 * Perspektivwechsel: die Woche als Jonas oder Emma — mit Gedanken, Gefühlen
 * und dem Scham-Regler. Wer jemandem etwas erzählen will, zieht den Regler nach
 * rechts; an zufälligen Stellen (bis zu 20-mal, manchmal kurz vor dem Ziel)
 * springt er zurück, und ein Gedanke taucht auf.
 */
import { useMemo, useRef, useState } from "react";
import { ROLLEN, SCHAM_GEDANKEN, type OpferOption, type OpferRolle } from "@/lib/klikk/opfer";

const TAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

/** Zufällige Rücksprung-Stellen: 3 bis 20, mindestens eine über 90 %. */
function stellen(schwer: boolean) {
  const n = schwer ? 8 + Math.floor(Math.random() * 13) : 3 + Math.floor(Math.random() * 10);
  const s = Array.from({ length: n - 1 }, () => 15 + Math.random() * 80);
  s.push(90 + Math.random() * 8);
  return s.sort((a, b) => a - b);
}

export function SchamRegler({ wem, schwer, geschafft, aufgeben }: { wem: string; schwer: boolean; geschafft: () => void; aufgeben: () => void }) {
  const ziele = useMemo(() => stellen(schwer), [schwer]);
  const [wert, setWert] = useState(0);
  const [naechste, setNaechste] = useState(0);
  const [gedanke, setGedanke] = useState<string | null>(null);
  const [rueck, setRueck] = useState(0);
  const leiste = useRef<HTMLDivElement>(null);
  const ziehen = useRef(false);

  const bewegen = (clientX: number) => {
    if (!ziehen.current || !leiste.current) return;
    const r = leiste.current.getBoundingClientRect();
    const neu = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    // Eine Hürde überschritten: zurück, Gedanke, Loslassen erzwingen
    if (naechste < ziele.length && neu >= ziele[naechste]) {
      ziehen.current = false;
      setWert(Math.max(0, ziele[naechste] * (0.25 + Math.random() * 0.45)));
      setGedanke(SCHAM_GEDANKEN[Math.floor(Math.random() * SCHAM_GEDANKEN.length)]);
      setNaechste(naechste + 1);
      setRueck(r => r + 1);
      return;
    }
    setWert(neu);
    if (neu >= 99.5 && naechste >= ziele.length) { ziehen.current = false; geschafft(); }
  };

  return (
    <div className="rounded-xl border border-line p-3 flex flex-col gap-2 bg-surface">
      <div className="text-sm font-bold">Es {wem} sagen</div>
      <div ref={leiste} className="relative h-10 rounded-full bg-gradient-to-r from-slate-700 via-slate-500 to-emerald-500 touch-none select-none"
        onPointerDown={e => { ziehen.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); bewegen(e.clientX); }}
        onPointerMove={e => bewegen(e.clientX)}
        onPointerUp={() => { ziehen.current = false; }}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${wert}%`, transition: ziehen.current ? "none" : "width 0.35s ease-out" }} />
        <div className="absolute top-1 w-8 h-8 rounded-full bg-white shadow-lg grid place-items-center text-lg"
          style={{ left: `calc(${wert}% - ${wert * 0.32}px)`, transition: ziehen.current ? "none" : "left 0.35s ease-out" }}>💬</div>
        <span className="absolute right-3 top-2.5 text-xs font-bold text-white/80">sagen</span>
      </div>
      <div className="min-h-10 text-sm italic text-muted">{gedanke ? `»${gedanke}«` : "Halt den Regler gedrückt und zieh ihn nach rechts."}</div>
      <div className="flex justify-between items-center text-[11px] text-muted">
        <span>{rueck ? `${rueck}× zurückgezuckt` : ""}</span>
        <button className="underline" onClick={aufgeben}>Lieber doch nicht</button>
      </div>
    </div>
  );
}

export default function OpferWoche({ zurueck }: { zurueck: () => void }) {
  const [rolle, setRolle] = useState<OpferRolle | null>(null);
  const [nr, setNr] = useState(0);
  const [gewaehlt, setGewaehlt] = useState<OpferOption | null>(null);
  const [regler, setRegler] = useState<OpferOption | null>(null);
  const [erzaehlt, setErzaehlt] = useState<{ wem: string; tag: number }[]>([]);
  const [verlauf, setVerlauf] = useState<string[]>([]);

  if (!rolle) return (
    <div className="card p-5 flex flex-col gap-3 max-w-2xl">
      <h2 className="text-xl font-black">🔄 Perspektivwechsel</h2>
      <p className="text-sm">Dieselbe Woche – diesmal von der anderen Seite. Du bekommst die Nachrichten, du hast die Gedanken, du entscheidest, ob und wem du es erzählst.</p>
      <div className="flex gap-2 flex-wrap">
        {ROLLEN.map(r => <button key={r.id} className="btn-primary" onClick={() => setRolle(r)}>{r.emoji} Als {r.name}</button>)}
        <button className="btn-secondary" onClick={zurueck}>Zurück</button>
      </div>
      <p className="text-xs text-muted">Inhalt: Mobbing, ein heimlich aufgenommenes Foto, Scham und Angst. Hilfe: Nummer gegen Kummer 116 111.</p>
    </div>
  );

  const szene = rolle.szenen[nr];
  const fertig = nr >= rolle.szenen.length;
  const ende = fertig ? rolle.ende(erzaehlt) : null;
  const waehle = (o: OpferOption) => {
    if (o.erzaehlen) { setRegler(o); return; }
    setGewaehlt(o);
    setVerlauf(v => [...v, `${TAGE[szene.tag]}: ${o.text}`]);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr] items-start max-w-5xl">
      {!fertig ? (
        <>
          <div className="rounded-3xl bg-neutral-950 text-neutral-100 p-4 flex flex-col gap-2 min-h-96">
            <div className="text-xs text-neutral-400">{rolle.emoji} {rolle.name} · {TAGE[szene.tag]}, {szene.uhr} · {szene.ort}</div>
            {szene.eingang.map((e, i) => (
              <div key={i} className="rounded-2xl bg-neutral-800 px-3 py-2 text-sm">
                <div className="text-[10px] text-neutral-400">{e.von}</div>
                {e.bild && <div className="rounded-lg bg-black/40 p-2 my-1 text-xs italic">{e.bild}</div>}
                {e.text}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {nr === 0 && !gewaehlt && <div className="card p-3 text-sm">{rolle.intro}</div>}
            <div className="card p-4 flex flex-col gap-2">
              <div className="text-xs text-muted">💭 Was {rolle.name} denkt</div>
              <p className="italic">»{gewaehlt?.danach ?? szene.gedanke}«</p>
              <div className="flex flex-col gap-1 mt-1">
                {szene.gefuehl.map(g => (
                  <div key={g.name} className="text-xs">
                    <div className="flex justify-between"><span>{g.emoji} {g.name}</span></div>
                    <div className="h-1.5 rounded bg-surface-hover"><div className="h-1.5 rounded bg-bad" style={{ width: `${gewaehlt?.erzaehlen ? g.staerke * 0.5 : g.staerke}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            {regler ? (
              <SchamRegler wem={regler.erzaehlen!} schwer={rolle.id === "emma" || szene.tag >= 2}
                geschafft={() => { setErzaehlt(e => [...e, { wem: regler.erzaehlen!, tag: szene.tag }]); setGewaehlt(regler); setVerlauf(v => [...v, `${TAGE[szene.tag]}: ${regler.text} ✓`]); setRegler(null); }}
                aufgeben={() => { setVerlauf(v => [...v, `${TAGE[szene.tag]}: wollte es ${regler.erzaehlen} sagen – und hat es nicht geschafft`]); setRegler(null); }} />
            ) : gewaehlt ? (
              <div className="card p-4 flex flex-col gap-2">
                <p className="text-sm">{gewaehlt.folge}</p>
                <button className="btn-primary self-start" onClick={() => { setGewaehlt(null); setNr(nr + 1); }}>Weiter →</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {szene.optionen.map(o => (
                  <button key={o.id} className="btn-secondary text-sm text-left" onClick={() => waehle(o)}>{o.erzaehlen ? "💬 " : ""}{o.text}</button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card p-5 flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-xl font-black">{ende!.titel}</h2>
          <p>{ende!.text}</p>
          <div className="text-sm"><b>Dein Weg:</b><ul className="list-disc pl-5">{verlauf.map((v, i) => <li key={i}>{v}</li>)}</ul></div>
          <p className="text-xs text-muted">Wer so etwas erlebt: Nummer gegen Kummer 116 111 (kostenlos, anonym), juuuport.de, Vertrauenslehrkraft. Es zu sagen ist schwer – und es ist der Schritt, der etwas ändert.</p>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setRolle(null); setNr(0); setErzaehlt([]); setVerlauf([]); }}>Andere Rolle</button>
            <button className="btn-secondary" onClick={zurueck}>Zurück</button>
          </div>
        </div>
      )}
    </div>
  );
}
