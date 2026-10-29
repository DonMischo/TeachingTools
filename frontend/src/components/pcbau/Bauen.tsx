"use client";
/**
 * Zusammenbauen: Teil aus der Kiste wählen → leuchtende Stelle anklicken;
 * Kabel wählen → beide Anschlüsse anklicken. Entscheidungen (Wärmeleitpaste,
 * P8/P9 …) rächen sich erst beim Einschalten.
 */
import { useEffect, useState } from "react";
import {
  antwortRichtig, ausbauen, einbauen, einschalten, hindernis, istDrin, kabel, kabelAbziehen, kabelDrin, kisteTeile,
  stecken, steckenAnKnoten, teil, teilDrin, tipp, vollstaendig, type Startergebnis, type Steckergebnis,
} from "@/lib/pcbau/logik";
import { LEER, type Bau, type Geraet } from "@/lib/pcbau/typen";
import { Ansicht, type Auswahl, type Blick } from "./Ansichten";
import { Bildschirm, FrageDialog, KabelSymbol, KategorieChip, PiepAnzeige, Vorschau, piepen } from "./Teile";

const bestKey = (id: string) => `hp_pcbau_best_${id}`;
const zeit = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

type Offen = { art: "teil" | "kabel"; id: string; bau: Bau };
type Lauf = { ergebnis: Startergebnis; fertig: boolean; ms: number | null; neuBest: boolean };

export default function Bauen({ g, blick }: { g: Geraet; blick: Blick }) {
  const [bau, setBau] = useState<Bau>(LEER);
  const [auswahl, setAuswahl] = useState<Auswahl>(null);
  const [markiert, setMarkiert] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; ok: boolean } | null>(null);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [fehler, setFehler] = useState(0);
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    try { const v = localStorage.getItem(bestKey(g.id)); setBest(v ? Number(v) : null); } catch { setBest(null); }
  }, [g.id]);

  const sag = (text: string, ok: boolean) => { setMeldung({ text, ok }); if (!ok) setFehler(f => f + 1); };
  const aendern = (b: Bau) => { setBau(b); setLauf(null); if (start === null) setStart(Date.now()); };

  function waehleTeil(id: string) {
    const t = teil(g, id)!;
    if (bau.drin.includes(id)) { setMarkiert(id); setAuswahl(null); return; }
    const h = hindernis(g, bau, id);
    if (h) { sag(h, false); return; }
    setAuswahl({ art: "teil", id });
    setMarkiert(id);
    setMeldung({ text: `${t.name}: Klicke auf die leuchtende Stelle.`, ok: true });
  }

  function waehleKabel(id: string) {
    setMarkiert(id);
    if (kabelDrin(bau, id)) { setAuswahl(null); return; }
    setAuswahl({ art: "kabel", id });
    setMeldung({ text: `${kabel(g, id)!.name}: Klicke nacheinander auf die beiden Anschlüsse.`, ok: true });
  }

  function setzeEin(id: string) {
    const t = teil(g, id)!;
    setAuswahl(null);
    if (t.frage) { setOffen({ art: "teil", id, bau }); return; }
    aendern(einbauen(g, bau, id));
    sag(`${t.name} sitzt.`, true);
  }

  function nachStecken(r: Steckergebnis, id: string) {
    if (!r.ok) { sag(r.meldung, false); return; }
    sag(r.meldung, true);
    if (r.fertig) {
      setAuswahl(null);
      if (kabel(g, id)!.frage) { setBau(r.bau); setOffen({ art: "kabel", id, bau: r.bau }); return; }
    }
    aendern(r.bau);
  }

  function antworte(i: number) {
    if (!offen) return;
    const { art, id, bau: b } = offen;
    setOffen(null);
    aendern(art === "teil" && !b.drin.includes(id) ? einbauen(g, b, id, i) : { ...b, antworten: { ...b.antworten, [id]: i } });
    sag(`${(teil(g, id) ?? kabel(g, id))!.name} ist drin.`, true);
  }

  function abbrechen() {
    if (offen?.art === "kabel" && offen.bau.antworten[offen.id] === undefined) setBau(kabelAbziehen(offen.bau, offen.id));
    setOffen(null);
  }

  function anschalten() {
    const ergebnis = einschalten(g, bau);
    const fertig = ergebnis.stufe === "ok" && vollstaendig(g, bau);
    let ms: number | null = null, neuBest = false;
    if (fertig && start !== null) {
      ms = Date.now() - start;
      if (best === null || ms < best) {
        neuBest = true;
        setBest(ms);
        try { localStorage.setItem(bestKey(g.id), String(ms)); } catch { /* Bestzeit nur im Speicher */ }
      }
    }
    setLauf({ ergebnis, fertig, ms, neuBest });
    setAuswahl(null);
    if (ergebnis.stufe !== "ok" && ergebnis.pruefung.piep && (!g.lautsprecher || kabelDrin(bau, g.lautsprecher))) piepen(ergebnis.pruefung.piep);
  }

  function zeigeTipp() {
    const t = tipp(g, bau);
    if (!t) {
      const falsch = [...bau.drin, ...Object.keys(bau.stecker)].find(id => !antwortRichtig(g, bau, id));
      setMeldung({ text: falsch ? `Alles drin — aber denk noch einmal über ${(teil(g, falsch) ?? kabel(g, falsch))!.name} nach. Anklicken, dann »Neu entscheiden«.` : "Alles Nötige ist drin. Einschalten!", ok: true });
      return;
    }
    if (t.art === "teil") waehleTeil(t.id); else waehleKabel(t.id);
    setMeldung({ text: `Tipp: ${(teil(g, t.id) ?? kabel(g, t.id))!.name} als Nächstes.`, ok: true });
  }

  function neu() {
    setBau(LEER); setAuswahl(null); setMarkiert(null); setMeldung(null); setLauf(null); setStart(null); setFehler(0);
  }

  const an = lauf?.ergebnis.stufe === "ok";
  const mTeil = markiert ? teil(g, markiert) : undefined;
  const mKabel = markiert ? kabel(g, markiert) : undefined;
  const fragZiel = offen ? (teil(g, offen.id) ?? kabel(g, offen.id))! : null;
  const fortschritt = [...kisteTeile(g), ...g.kabel].filter(x => !x.optional);
  const geschafft = fortschritt.filter(x => istDrin(g, bau, x.id)).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
      <div className="grid gap-3">
        <div className="relative">
          <Ansicht blick={blick} g={g} bau={bau} an={an} auswahl={auswahl} markiert={markiert}
            onTeil={id => { setMarkiert(id); setAuswahl(null); }}
            onZiel={setzeEin}
            onPort={p => auswahl?.art === "kabel" && nachStecken(stecken(g, bau, auswahl.id, p), auswahl.id)}
            onKnoten={id => {
              if (auswahl?.art === "teil") { if (auswahl.id === id) setzeEin(id); else sag(`Hier gehört ${teil(g, auswahl.id)!.name} nicht hin.`, false); }
              else if (auswahl?.art === "kabel") nachStecken(steckenAnKnoten(g, bau, auswahl.id, id), auswahl.id);
              else setMarkiert(id);
            }} />
          {offen && fragZiel?.frage && <FrageDialog titel={fragZiel.name} frage={fragZiel.frage} onAntwort={antworte} onAbbruch={abbrechen} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary text-base px-5" onClick={anschalten}>⏻ Einschalten</button>
          <button className="btn btn-secondary" onClick={zeigeTipp}>💡 Tipp</button>
          <button className="btn btn-secondary" onClick={neu}>↺ Alles ausbauen</button>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span>🔩 {geschafft}/{fortschritt.length}</span>
            <span>❌ {fehler}</span>
            {best !== null && <span>🏆 {zeit(best)}</span>}
          </div>
        </div>
        <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${(geschafft / fortschritt.length) * 100}%` }} />
        </div>

        {meldung && !lauf && (
          <div className={`rounded-xl px-4 py-2 text-sm font-semibold border ${meldung.ok ? "border-line bg-surface" : "border-bad/40 bg-bad/10 text-bad"}`} role="status">
            {meldung.ok ? "👉" : "✋"} {meldung.text}
          </div>
        )}

        {lauf && <Startbericht g={g} lauf={lauf} speaker={!g.lautsprecher || kabelDrin(bau, g.lautsprecher)} />}
      </div>

      <aside className="grid gap-3">
        {(mTeil || mKabel) && (
          <div className="card p-4">
            <div className="flex items-start gap-3">
              {mTeil ? <Vorschau t={mTeil} /> : <KabelSymbol k={mKabel!} />}
              <div className="min-w-0">
                <h3 className="font-black leading-tight">{mTeil?.name ?? mKabel!.name}</h3>
                {mTeil && <div className="mt-1"><KategorieChip t={mTeil} /></div>}
              </div>
            </div>
            {mTeil && <p className="font-semibold text-sm mt-3">{mTeil.kurz[0].toUpperCase() + mTeil.kurz.slice(1)}.</p>}
            <p className="text-sm text-muted mt-1">{mTeil?.info ?? mKabel!.info}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {mTeil && !mTeil.fest && teilDrin(g, bau, mTeil.id) && (
                <button className="btn btn-secondary text-sm" onClick={() => { aendern(ausbauen(g, bau, mTeil.id)); setMeldung({ text: `${mTeil.name} ausgebaut.`, ok: true }); }}>🔧 Ausbauen</button>
              )}
              {mKabel && bau.stecker[mKabel.id] && (
                <button className="btn btn-secondary text-sm" onClick={() => aendern(kabelAbziehen(bau, mKabel.id))}>🔌 Abziehen</button>
              )}
              {(mTeil?.frage && bau.drin.includes(mTeil.id)) || (mKabel?.frage && kabelDrin(bau, mKabel.id)) ? (
                <button className="btn btn-secondary text-sm" onClick={() => setOffen({ art: mTeil ? "teil" : "kabel", id: markiert!, bau })}>🤔 Neu entscheiden</button>
              ) : null}
            </div>
          </div>
        )}

        <div className="card p-3">
          <h3 className="font-black text-sm mb-2">📦 Teilekiste</h3>
          <div className="grid grid-cols-2 gap-2">
            {kisteTeile(g).map(t => {
              const drin = bau.drin.includes(t.id);
              const aktiv = auswahl?.id === t.id;
              return (
                <button key={t.id} onClick={() => waehleTeil(t.id)} aria-pressed={aktiv}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-bold transition ${aktiv ? "border-accent ring-2 ring-accent bg-accent/10" : "border-line hover:bg-surface-hover"} ${drin ? "opacity-45" : ""}`}>
                  <Vorschau t={t} className="w-full h-12" />
                  <span className="leading-tight text-center">{t.name}</span>
                  {drin && <span className="absolute top-1 right-1.5 text-ok">✓</span>}
                  {t.optional && !drin && <span className="absolute top-1 left-1.5 text-[10px] text-muted font-semibold">optional</span>}
                </button>
              );
            })}
          </div>
        </div>

        {g.kabel.length > 0 && (
          <div className="card p-3">
            <h3 className="font-black text-sm mb-2">🔌 Kabel</h3>
            <div className="grid gap-1.5">
              {g.kabel.map(k => {
                const drin = kabelDrin(bau, k.id);
                const halb = (bau.stecker[k.id]?.length ?? 0) === 1;
                const aktiv = auswahl?.id === k.id;
                return (
                  <button key={k.id} onClick={() => waehleKabel(k.id)} aria-pressed={aktiv}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-1 text-left text-xs font-bold transition ${aktiv ? "border-accent ring-2 ring-accent bg-accent/10" : "border-line hover:bg-surface-hover"} ${drin ? "opacity-45" : ""}`}>
                    <KabelSymbol k={k} />
                    <span className="flex-1 leading-tight">{k.name}{k.optional && <span className="block text-[10px] font-semibold text-muted">optional</span>}</span>
                    <span className={drin ? "text-ok" : "text-muted"}>{drin ? "✓" : halb ? "½" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Startbericht({ g, lauf, speaker }: { g: Geraet; lauf: Lauf; speaker: boolean }) {
  const e = lauf.ergebnis;
  if (e.stufe === "ok") {
    return (
      <div className="card p-4 grid gap-3 border-ok/50">
        <div>
          <h3 className="text-lg font-black text-ok">✅ {g.start.titel}</h3>
          <p className="text-sm text-muted">{g.start.text}</p>
        </div>
        <Bildschirm zeilen={g.start.bildschirm} />
        {e.warnungen.map(w => (
          <div key={w.titel} className="rounded-xl border border-line bg-surface-hover px-3 py-2 text-sm">
            <b>⚠️ {w.titel}:</b> {w.text}
          </div>
        ))}
        {lauf.fertig && lauf.ms !== null && (
          <div className="text-sm font-bold">🏁 Fertig in {zeit(lauf.ms)}{lauf.neuBest && " — neue Bestzeit! 🏆"}</div>
        )}
        {!lauf.fertig && e.warnungen.length === 0 && <div className="text-sm text-muted">Es läuft — für die Bestzeit fehlt aber noch ein nötiges Teil oder eine richtige Entscheidung.</div>}
      </div>
    );
  }
  const p = e.pruefung;
  const ICON = { aus: "🔌", fehler: "🛑", kaputt: "💥" } as const;
  return (
    <div className={`card p-4 grid gap-3 ${e.stufe === "kaputt" ? "border-bad" : ""}`}>
      <div>
        <h3 className={`text-lg font-black ${e.stufe === "aus" ? "" : "text-bad"}`}>{ICON[e.stufe]} {p.titel}</h3>
        <p className="text-sm mt-1">{p.text}</p>
        {p.piep && (
          <p className="text-sm text-muted mt-2">
            {speaker ? <>Piepcode: <PiepAnzeige code={p.piep} /> — ein BIOS meldet Fehler so, bevor es ein Bild gibt.</>
              : <>Du hörst nichts: Der Lautsprecher ist nicht angeschlossen. Sonst hättest du <PiepAnzeige code={p.piep} /> gehört.</>}
          </p>
        )}
      </div>
      {p.bildschirm && <Bildschirm zeilen={p.bildschirm} farbe="#e5e7eb" />}
      {e.stufe === "kaputt" && <div className="text-sm font-semibold">Zum Glück nur eine Simulation: Klicke das Teil an und wähle »Neu entscheiden«.</div>}
    </div>
  );
}
