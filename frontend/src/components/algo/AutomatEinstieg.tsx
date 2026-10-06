"use client";
/**
 * Reiter »Automat«: Handlungsschritte ordnen und von einem Ausführer prüfen
 * lassen, der alles wörtlich nimmt. Gelöst ist ein Automat, wenn derselbe
 * Algorithmus an beiden Automaten (A und B) klappt — also allgemein gültig ist.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { aufgabenWertung, type Wertung } from "@/lib/algo/wertung";
import { HilfeLeiste, WertungZeile, useMessung } from "./Hilfe";
import { AUTOMATEN, MERKMAL, fuehreAutomatAus, gemischt, type AusfuehrSchritt, type Automat } from "@/lib/algo/automaten";

const AUSFUEHRER = [
  { id: "robo", icon: "🤖", name: "Robo", text: "Robo ist ein Roboter. Er macht genau das, was auf der Karte steht — nicht mehr und nicht weniger." },
  { id: "alien", icon: "👽", name: "Zorp", text: "Zorp kommt vom Planeten Xylo und hat noch nie einen Automaten gesehen. Er nimmt jedes Wort wörtlich." },
] as const;

export default function AutomatEinstieg({ erledigt, onGeloest, onFluss }: {
  erledigt: string[];
  onGeloest: (automatId: string, w: Wertung) => void;
  onFluss: (beispielId: string) => void;
}) {
  const [aId, setAId] = useState(AUTOMATEN[0].id);
  const a = AUTOMATEN.find(x => x.id === aId)!;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {AUTOMATEN.map(x => (
          <button key={x.id} type="button" onClick={() => setAId(x.id)}
            className={`rounded-xl border px-3 py-2 text-sm font-bold ${x.id === aId ? "border-line-active bg-surface-hover" : "border-line bg-surface hover:bg-surface-hover"}`}>
            {x.icon} {x.name} {erledigt.includes(x.id) && "✅"}
          </button>
        ))}
      </div>
      <AutomatAufgabe key={a.id} a={a} onGeloest={w => onGeloest(a.id, w)} onFluss={onFluss} />
      <section className="card p-4 text-sm leading-relaxed border-l-4 border-l-accent">
        <b>📌 Merke:</b> Eine Handlungsvorschrift zur Lösung eines Problems nennt man einen <b>Algorithmus</b>.
        Er besteht aus <b>endlich vielen</b>, <b>ausführbaren</b>, <b>präzise (eindeutig)</b> formulierten <b>Einzelschritten</b>,
        die Eingaben in eine bestimmte Ausgabe überführen. Funktioniert er auch an anderen, ähnlichen Automaten, ist er <b>allgemein gültig</b>.
        <br />Computerprogramme sind Algorithmen, die angeben, wie der Computer verschiedene Aufgaben ausführen soll.
      </section>
    </div>
  );
}

const RICHTZEIT_AUTOMAT = 150;

function AutomatAufgabe({ a, onGeloest, onFluss }: { a: Automat; onGeloest: (w: Wertung) => void; onFluss: (id: string) => void }) {
  const m = useMessung(RICHTZEIT_AUTOMAT);
  const [wertung, setWertung] = useState<Wertung | null>(null);
  const gezaehlt = useRef<object | null>(null);
  const stapel = useMemo(() => gemischt(a.handlungen.map(h => h.id), a.id.length * 7919 + 13), [a]);
  const [plan, setPlan] = useState<string[]>([]);
  const [variante, setVariante] = useState("a");
  const [wer, setWer] = useState<(typeof AUSFUEHRER)[number]["id"]>("robo");
  const [lauf, setLauf] = useState<{ schritte: AusfuehrSchritt[]; ok: boolean; i: number } | null>(null);
  const [geschafft, setGeschafft] = useState<string[]>([]);
  const [notiz, setNotiz] = useState("");
  const [notizAuf, setNotizAuf] = useState(false);
  const notizKey = `hp_algo_notiz_${a.id}`;
  useEffect(() => { try { setNotiz(localStorage.getItem(notizKey) ?? ""); } catch { /* egal */ } }, [notizKey]);

  // Abspielen: alle 1,1 s ein Schritt
  useEffect(() => {
    if (!lauf || lauf.i >= lauf.schritte.length - 1) return;
    const t = setTimeout(() => setLauf(l => l && { ...l, i: l.i + 1 }), 1100);
    return () => clearTimeout(t);
  }, [lauf]);
  const fertig = lauf && lauf.i >= lauf.schritte.length - 1;
  useEffect(() => {
    if (!fertig || gezaehlt.current === lauf) return;
    gezaehlt.current = lauf;
    if (!lauf.ok) { m.fehler(); return; }
    if (geschafft.includes(variante)) return;
    const neu = [...geschafft, variante];
    setGeschafft(neu);
    if (a.varianten.every(v => neu.includes(v.id))) {
      const w = aufgabenWertung({ ...m, richtzeit: RICHTZEIT_AUTOMAT });
      setWertung(w);
      onGeloest(w);
    }
  }, [fertig, lauf, variante, geschafft, a.varianten, onGeloest, m]);

  const neuerPlan = (p: string[]) => { setPlan(p); setLauf(null); setGeschafft([]); };
  const schritt = lauf?.schritte[lauf.i];
  const ausf = AUSFUEHRER.find(x => x.id === wer)!;
  const textVon = (id: string) => a.handlungen.find(h => h.id === id)!.text;
  const knopf = "w-6 h-6 rounded bg-surface-hover hover:bg-line text-xs";

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-4 text-sm flex flex-col gap-2">
        <h2 className="text-lg font-black">{a.icon} {a.name}</h2>
        <p>{a.geschichte}</p>
        <p className="text-muted">Lege die Handlungsschritte in die richtige Reihenfolge. Nicht jede Karte ist brauchbar — manche sind zu ungenau oder passen nur zu einem einzigen Automaten.</p>
        {notizAuf ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold">✏️ Erst selbst: Schreib die Schritte in Stichpunkten auf (5 Minuten). Vergleiche danach mit den Karten.</span>
            <textarea className="input min-h-28 font-mono text-sm" value={notiz}
              onChange={e => { setNotiz(e.target.value); try { localStorage.setItem(notizKey, e.target.value); } catch { /* egal */ } }} />
          </label>
        ) : <button type="button" className="self-start text-xs underline text-muted" onClick={() => setNotizAuf(true)}>✏️ Erst selbst aufschreiben</button>}
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="card p-3 flex flex-col gap-2">
          <h3 className="text-sm font-bold">🃏 Karten — antippen zum Hinzufügen</h3>
          {stapel.filter(id => !plan.includes(id)).map(id => (
            <button key={id} type="button" onClick={() => neuerPlan([...plan, id])}
              className="text-left text-sm rounded-lg border border-line bg-page px-3 py-2 hover:border-line-active">
              {textVon(id)}
            </button>
          ))}
        </section>
        <section className="card p-3 flex flex-col gap-2">
          <h3 className="text-sm font-bold">📜 Dein Algorithmus</h3>
          {plan.length === 0 && <p className="text-sm text-muted">Noch leer — tippe links auf Karten.</p>}
          <ol className="flex flex-col gap-1">
            {plan.map((id, i) => {
              const aktiv = schritt?.handlung?.id === id;
              const kaputt = fertig && schritt?.art === "fehler" && schritt.handlung?.id === id;
              return (
                <li key={id} className={`flex items-center gap-2 text-sm rounded-lg border px-2 py-1.5 ${kaputt ? "border-bad bg-bad/10" : aktiv ? "border-line-active bg-surface-hover" : "border-line"}`}>
                  <span className="font-black tabular-nums w-5 text-right">{i + 1}.</span>
                  <span className="flex-1">{textVon(id)}</span>
                  <span className="inline-flex gap-1 shrink-0">
                    <button type="button" className={knopf} aria-label="nach oben" disabled={i === 0}
                      onClick={() => { const p = [...plan]; [p[i - 1], p[i]] = [p[i], p[i - 1]]; neuerPlan(p); }}>▲</button>
                    <button type="button" className={knopf} aria-label="nach unten" disabled={i === plan.length - 1}
                      onClick={() => { const p = [...plan]; [p[i + 1], p[i]] = [p[i], p[i + 1]]; neuerPlan(p); }}>▼</button>
                    <button type="button" className={knopf} aria-label="Karte entfernen" onClick={() => neuerPlan(plan.filter(x => x !== id))}>✕</button>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      <section className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Wer führt aus?</span>
          {AUSFUEHRER.map(x => (
            <button key={x.id} type="button" onClick={() => setWer(x.id)} className={`chip ${wer === x.id ? "chip-on" : ""}`}>{x.icon} {x.name}</button>
          ))}
          <span className="text-sm font-bold ml-4">An welchem Automaten?</span>
          {a.varianten.map(v => (
            <button key={v.id} type="button" onClick={() => { setVariante(v.id); setLauf(null); }} className={`chip ${variante === v.id ? "chip-on" : ""}`}>
              {v.name} {geschafft.includes(v.id) && "✅"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{ausf.text} {a.varianten.find(v => v.id === variante)!.text}</p>
        <div className="grid sm:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
          <AutomatBild a={a} teil={schritt?.handlung?.teil} />
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="text-5xl" aria-hidden>{ausf.icon}</span>
              <div className="relative rounded-2xl border border-line bg-page px-4 py-3 text-sm min-h-14 flex-1" aria-live="polite">
                {schritt ? (
                  <>
                    {schritt.handlung && <div className="text-xs text-muted mb-1">Karte {plan.indexOf(schritt.handlung.id) + 1}: »{schritt.handlung.text}«</div>}
                    <div>{schritt.handlung?.sagt ?? "Fertig mit allen Karten."}</div>
                  </>
                ) : <span className="text-muted">Ich warte auf deinen Algorithmus.</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 min-h-7">
              {(schritt?.tatsachen ?? []).map(t => <span key={t} className="chip">{a.tatsachen[t] ?? t}</span>)}
            </div>
            {fertig && schritt?.art === "fehler" && (
              <div className="rounded-lg border border-bad/60 bg-bad/10 p-3 text-sm flex flex-col gap-1" role="alert">
                <span className="self-start rounded px-1.5 py-0.5 text-xs font-black bg-bad text-white">{MERKMAL[schritt.fehler.art]}</span>
                <span>{schritt.fehler.text}</span>
              </div>
            )}
            {fertig && lauf.ok && (
              <div className="rounded-lg border border-ok/60 bg-ok/10 p-3 text-sm">
                🎉 Geschafft an {a.varianten.find(v => v.id === variante)!.name}!{" "}
                {a.varianten.every(v => geschafft.includes(v.id))
                  ? "Dein Algorithmus klappt an beiden Automaten — er ist allgemein gültig."
                  : "Klappt derselbe Algorithmus auch am anderen Automaten?"}
              </div>
            )}
            {wertung && <WertungZeile w={wertung} />}
            <HilfeLeiste m={m}
              tipp="Der Ausführer macht nur genaue Einzelschritte. Verdächtig sind Karten mit »irgendwie«, »hol dir« oder mit einer festen Münze oder einem festen Preis."
              hinweis={<>Die erste Karte lautet »{textVon(a.loesung[0])}«, die letzte »{textVon(a.loesung.at(-1)!)}«. Insgesamt braucht es {a.loesung.length} Karten.</>}
              onVorfuehren={() => { neuerPlan(a.loesung); setLauf({ ...fuehreAutomatAus(a, variante, a.loesung), i: 0 }); }} />
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={!plan.length || (!!lauf && !fertig)}
                onClick={() => setLauf({ ...fuehreAutomatAus(a, variante, plan), i: 0 })}>▶ Ausführen</button>
              <button type="button" className="btn-secondary" onClick={() => neuerPlan([])}>⟲ Alles zurück</button>
            </div>
          </div>
        </div>
      </section>

      <InnenAufgabe a={a} onFluss={onFluss} />
    </div>
  );
}

function AutomatBild({ a, teil }: { a: Automat; teil?: string }) {
  return (
    <svg viewBox="0 0 200 260" className="w-full max-w-[220px]" role="img" aria-label={a.name}>
      <rect x={20} y={10} width={160} height={240} rx={14} style={{ fill: "var(--surface-hover)", stroke: "var(--border)", strokeWidth: 3 }} />
      {a.teile.map(t => {
        const an = t.id === teil;
        const stil = { fill: an ? "var(--accent)" : "var(--bg)", stroke: an ? "var(--accent)" : "var(--border)", strokeWidth: 2, transition: "fill 200ms" };
        return (
          <g key={t.id}>
            {t.rund
              ? <ellipse cx={t.x + t.w / 2} cy={t.y + t.h / 2} rx={t.w / 2} ry={t.h / 2} style={stil} />
              : <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={4} style={stil} />}
            <text x={t.x + t.w / 2} y={t.y + t.h + 11} textAnchor="middle" style={{ fontSize: 9, fill: "var(--text-muted)" }}>{t.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function InnenAufgabe({ a, onFluss }: { a: Automat; onFluss: (id: string) => void }) {
  const stapel = useMemo(() => gemischt(a.innen.map((_, i) => i), a.id.length * 31 + 5), [a]);
  const [folge, setFolge] = useState<number[]>([]);
  const fertig = folge.length === a.innen.length;
  const richtig = fertig && folge.every((x, i) => x === i);
  return (
    <section className="card p-4 flex flex-col gap-3">
      <h3 className="font-black">🔧 Und was macht eigentlich der Automat?</h3>
      <p className="text-sm text-muted">
        Während du ihn bedienst, arbeitet der Automat seinen eigenen Algorithmus ab. Spielt es zu zweit nach (eine Person ist Kundschaft, eine der Automat) — und bringt dann seine Schritte in die richtige Reihenfolge.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          {stapel.filter(i => !folge.includes(i)).map(i => (
            <button key={i} type="button" onClick={() => setFolge([...folge, i])}
              className="text-left text-sm rounded-lg border border-line bg-page px-3 py-2 hover:border-line-active">{a.innen[i]}</button>
          ))}
        </div>
        <ol className="flex flex-col gap-1">
          {folge.map((x, i) => (
            <li key={x} className={`text-sm rounded-lg border px-3 py-2 ${fertig ? (x === i ? "border-ok" : "border-bad") : "border-line"}`}>
              <b>{i + 1}.</b> {a.innen[x]}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <button type="button" className="btn-secondary" onClick={() => setFolge([])}>⟲ Neu ordnen</button>
        {fertig && (richtig
          ? <>
              <span className="text-sm text-ok font-bold">Richtig! Auch das ist ein Algorithmus — mit Entscheidungen und Wiederholungen.</span>
              <button type="button" className="btn-primary" onClick={() => onFluss(a.fluss)}>🔀 Bedienung als Flussdiagramm</button>
              {a.id === "kaugummi" && <button type="button" className="btn-secondary" onClick={() => onFluss("kaugummi-innen")}>🔧 Automat von innen als Flussdiagramm</button>}
            </>
          : <span className="text-sm text-bad">Noch nicht ganz — rot markierte Schritte stehen an der falschen Stelle.</span>)}
      </div>
    </section>
  );
}
