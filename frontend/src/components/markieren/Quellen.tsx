"use client";
/**
 * Referat & Quellen: links die Quelle (Buch zum Blättern oder eine Webseite im
 * nachgebauten Browser), rechts »Mein Referat« mit Zitat und
 * Literaturverzeichnis als echte Vorlage — die Lücken füllt man durch
 * Markieren, Kopieren und Einfügen. Fehlgriffe (Website-Name statt
 * Überschrift, Lektorat statt Autorin, Kurzlink statt Adresse) bekommen einen
 * eigenen Hinweis.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  QUELLEN_ART, fertig, faelle, pruefeFeld,
  type Buch, type Fall, type Feld, type Heft, type Lexikon, type Pruefung, type Quelle, type Teil, type Video, type Webseite, type Zeitung,
} from "@/lib/markieren/quellen";
import type { MarkierStand } from "@/lib/markieren/speicher";
import { sek } from "./Challenge";
import { mitTasten } from "@/components/maus/Taste";


const SERIF = { fontFamily: "Georgia, 'Times New Roman', serif" };

export default function Quellen({ stand, aendern, onAktuell }: {
  stand: MarkierStand | null;
  aendern: (f: (s: MarkierStand) => MarkierStand) => void;
  onAktuell?: (text: string) => void;
}) {
  const alle = useMemo(() => faelle(), []);
  const best = stand?.quellen ?? {};
  const [aktiv, setAktiv] = useState<string | null>(null);
  // Je Art der erste Fall als Muster.
  const beispiele = useMemo(() => alle.filter((f, i) => alle.findIndex(g => g.quelle.art === f.quelle.art) === i), [alle]);

  const fall = alle.find(f => f.id === aktiv);
  if (fall) {
    return (
      <FallAnsicht key={fall.id} fall={fall} best={best[fall.id]} onZurueck={() => setAktiv(null)}
        onFertig={ms => aendern(s => (s.quellen[fall.id] !== undefined && s.quellen[fall.id] <= ms
          ? s : { ...s, quellen: { ...s.quellen, [fall.id]: ms } }))} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 flex flex-col gap-2">
        <h2 className="text-lg font-black">📚 Zitieren wie im Referat</h2>
        <p className="text-sm">
          Wer etwas aus einem Buch, einer Zeitung, einem Video oder von einer Website übernimmt, setzt es in Anführungszeichen
          und schreibt dazu, woher es stammt. Im Text steht ein kurzer Beleg, am Ende das ganze Literaturverzeichnis:
        </p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 text-sm" style={SERIF}>
          {beispiele.map(f => (
            <div key={f.quelle.art} className="rounded-lg border border-line p-3">
              <div className="text-xs font-bold text-muted mb-1">{QUELLEN_ART[f.quelle.art]}</div>
              <p>… „Zitat{fertig(f.zitatSatz.slice(f.zitatSatz.findIndex(t => typeof t !== "string" && t.feld === "zitat") + 1), f.felder)}</p>
              <p className="mt-1 pl-6 -indent-6">{fertig(f.verzeichnis, f.felder)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Manche Lehrkräfte wollen die Angaben etwas anders angeordnet — die Teile, die du finden musst, sind dieselben.</p>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
        {alle.map(f => (
          <button key={f.id} type="button" onClick={() => { setAktiv(f.id); onAktuell?.(`Quelle »${f.titel}«`); }}
            className="card p-4 text-left flex flex-col gap-1 hover:border-accent transition-colors">
            <span className="text-xs font-bold text-muted">{QUELLEN_ART[f.quelle.art]}</span>
            <span className="font-black">{f.icon} {f.titel}</span>
            <span className="text-sm text-muted">
              {best[f.id] !== undefined ? <>✅ Bestzeit {sek(best[f.id])}</> : "noch offen"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FallAnsicht({ fall, best, onZurueck, onFertig }: {
  fall: Fall; best?: number; onZurueck: () => void; onFertig: (ms: number) => void;
}) {
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [befund, setBefund] = useState<Record<string, Pruefung>>({});
  const [eingefuegt, setEingefuegt] = useState(0);
  const [zeit, setZeit] = useState<number | null>(null);
  const start = useRef(0);
  useEffect(() => { start.current = performance.now(); }, []);

  function setze(id: string, wert: string) {
    setWerte(w => ({ ...w, [id]: wert }));
    setBefund(b => { const n = { ...b }; delete n[id]; return n; });
  }

  function pruefen() {
    const neu: Record<string, Pruefung> = {};
    for (const f of fall.felder) neu[f.id] = pruefeFeld(f, werte[f.id] ?? "");
    setBefund(neu);
    if (Object.values(neu).every(p => p.ok)) {
      const ms = Math.round(performance.now() - start.current);
      setZeit(ms);
      onFertig(ms);
    }
  }

  const falsche = fall.felder.filter(f => befund[f.id] && !befund[f.id].ok);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-bold text-lg">👉 {fall.auftrag}</p>
        <button type="button" className="btn-secondary text-sm" onClick={onZurueck}>← Alle Quellen</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2 items-start">
        <QuellenAnsicht quelle={fall.quelle} />

        <section className="card p-5 flex flex-col gap-4" aria-label="Mein Referat">
          <div className="flex items-center justify-between">
            <h3 className="font-black">📝 Mein Referat</h3>
            <span className="text-xs text-muted">{mitTasten("Markieren · [[Strg]] + [[C]] · ins Feld klicken · [[Strg]] + [[V]]")}</span>
          </div>
          {zeit === null ? (
            <>
              <div className="leading-[2.4]" style={SERIF}>
                <Vorlage teile={fall.zitatSatz} felder={fall.felder} werte={werte} befund={befund} setze={setze} onPaste={() => setEingefuegt(n => n + 1)} />
              </div>
              <div>
                <div className="text-sm font-black border-b border-line pb-1 mb-2">Literaturverzeichnis</div>
                <div className="leading-[2.4] pl-6 -indent-6" style={SERIF}>
                  <Vorlage teile={fall.verzeichnis} felder={fall.felder} werte={werte} befund={befund} setze={setze} onPaste={() => setEingefuegt(n => n + 1)} />
                </div>
              </div>
              {falsche.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm" aria-live="polite">
                  {falsche.map(f => <li key={f.id}><b>{f.label}:</b> {befund[f.id].hinweis}</li>)}
                </ul>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" className="btn-primary" onClick={pruefen}>Prüfen</button>
                <span className="text-xs text-muted">📋 {eingefuegt}× eingefügt{best !== undefined && ` · Bestzeit ${sek(best)}`}</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="font-black text-lg text-ok">✅ Richtig zitiert — in {sek(zeit)}{best !== undefined && zeit <= best ? " (Bestzeit!)" : ""}</p>
              <p style={SERIF}>{fertig(fall.zitatSatz, fall.felder)}</p>
              <div>
                <div className="text-sm font-black border-b border-line pb-1 mb-2">Literaturverzeichnis</div>
                <p className="pl-6 -indent-6" style={SERIF}>{fertig(fall.verzeichnis, fall.felder)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-primary" onClick={onZurueck}>Nächste Quelle</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Vorlage({ teile, felder, werte, befund, setze, onPaste }: {
  teile: Teil[]; felder: Feld[]; werte: Record<string, string>; befund: Record<string, Pruefung>;
  setze: (id: string, wert: string) => void; onPaste: () => void;
}) {
  return (
    <>
      {teile.map((t, i) => {
        if (typeof t === "string") return <span key={i}>{t}</span>;
        const f = felder.find(x => x.id === t.feld)!;
        const wert = werte[f.id] ?? "";
        const b = befund[f.id];
        const rand = b ? (b.ok ? "border-ok" : "border-bad") : "border-line";
        const gemeinsam = `rounded-md border-2 bg-surface px-1.5 text-base align-baseline outline-none focus:border-accent ${rand}`;
        if (f.id === "zitat") {
          return (
            <textarea key={i} aria-label={f.label} placeholder={f.label} value={wert} rows={2} spellCheck={false}
              onChange={e => setze(f.id, e.target.value)} onPaste={onPaste}
              className={`${gemeinsam} block w-full my-1 leading-normal resize-y`} />
          );
        }
        const breite = Math.max(f.label.length, wert.length, f.breit ? 14 : 4) + 2;
        return (
          <input key={i} aria-label={f.label} placeholder={f.label} value={wert} spellCheck={false}
            onChange={e => setze(f.id, e.target.value)} onPaste={onPaste}
            className={`${gemeinsam} max-w-full leading-normal`} style={{ width: `${breite}ch` }} />
        );
      })}
    </>
  );
}

function QuellenAnsicht({ quelle }: { quelle: Quelle }) {
  switch (quelle.art) {
    case "buch": return <BuchAnsicht buch={quelle} />;
    case "web": return <Browser seite={quelle} />;
    case "zeitung": return <ZeitungAnsicht zeitung={quelle} />;
    case "heft": return <HeftAnsicht heft={quelle} />;
    case "video": return <VideoAnsicht video={quelle} />;
    case "lexikon": return <LexikonAnsicht lexikon={quelle} />;
  }
}

function BuchAnsicht({ buch }: { buch: Buch }) {
  const [nr, setNr] = useState(0);
  const s = buch.seiten[nr];
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Buch">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Seiten">
        {buch.seiten.map((x, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === nr} onClick={() => setNr(i)}
            className={"text-sm rounded-lg px-3 py-1 border " + (i === nr ? "border-accent text-accent font-bold" : "border-line hover:border-accent")}>
            {x.titel}
          </button>
        ))}
      </div>
      <article className="rounded-sm border border-line bg-surface shadow-lg mx-auto w-full max-w-[34rem] min-h-[26rem] px-8 py-8 flex flex-col" style={SERIF}>
        {s.art === "titel" && (
          <div className="flex-1 flex flex-col items-center text-center gap-4 justify-between">
            <p className="text-lg tracking-wide">{s.zeilen[0]}</p>
            <div>
              <h4 className="text-3xl font-bold leading-tight">{s.zeilen[1]}</h4>
              <p className="text-lg mt-3 italic">{s.zeilen[2]}</p>
            </div>
            <p className="text-sm uppercase tracking-widest">{s.zeilen[3]}</p>
          </div>
        )}
        {s.art === "impressum" && (
          <div className="flex-1 flex flex-col justify-end gap-2 text-xs leading-relaxed">
            {s.zeilen.map((z, i) => <p key={i}>{z}</p>)}
          </div>
        )}
        {s.art === "inhalt" && (
          <>
            <div className="text-xs text-muted text-right italic border-b border-line pb-1 mb-4">{s.kopf}</div>
            <div className="flex-1 flex flex-col gap-3 text-[15px] leading-relaxed text-justify hyphens-auto" lang="de">
              {s.zeilen.map((z, i) => <p key={i}>{z}</p>)}
            </div>
            <div className="text-center text-sm mt-6">{s.nr}</div>
          </>
        )}
      </article>
    </section>
  );
}

function Browser({ seite }: { seite: Webseite }) {
  const [cookies, setCookies] = useState(true);
  const [teilen, setTeilen] = useState(false);
  const heim = seite.url.split("/").slice(0, 3).join("/");
  return (
    <section className="rounded-xl border border-line overflow-hidden shadow-lg bg-surface" aria-label="Browser">
      {/* Fensterkopf mit Reiter */}
      <div className="bg-surface-hover px-2 pt-2 flex items-end gap-2">
        <div className="rounded-t-lg bg-surface px-3 py-1.5 text-xs max-w-[22rem] truncate border border-b-0 border-line">🌐 {seite.tabTitel}</div>
        <div className="text-muted text-sm pb-1">＋</div>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line">
        <span className="text-muted text-sm select-none">← → ↻</span>
        <input readOnly value={seite.url} aria-label="Adresszeile" onFocus={e => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-full bg-surface-hover px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-accent" />
        <span className="text-muted select-none">☆ ⋮</span>
      </div>

      {/* Die Seite */}
      <div className="relative max-h-[36rem] overflow-y-auto">
        <header className="flex items-center gap-4 px-4 py-3 border-b border-line flex-wrap">
          <span className="font-black text-accent" title={heim}>{seite.site}</span>
          <nav className="flex gap-3 text-sm text-muted flex-wrap">{seite.navigation.map(n => <span key={n}>{n}</span>)}</nav>
        </header>
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_12rem]">
          <article className="flex flex-col gap-3 min-w-0">
            <div className="text-xs text-muted">Start › {seite.rubrik}</div>
            <h4 className="text-2xl font-black leading-tight">{seite.titel}</h4>
            <p className="font-bold">{seite.unterzeile}</p>
            <div className="text-xs text-muted flex flex-wrap gap-x-3">{seite.meta.map(m => <span key={m}>{m}</span>)}</div>
            <div className="relative">
              <button type="button" className="text-xs rounded-full border border-line px-3 py-1 hover:border-accent" onClick={() => setTeilen(t => !t)}>
                🔗 Teilen
              </button>
              {teilen && (
                <div className="absolute z-10 mt-1 rounded-lg border border-line bg-surface shadow-xl p-2 text-xs w-64">
                  <div className="text-muted mb-1">Link zum Teilen:</div>
                  <input readOnly value={seite.teilen} aria-label="Link zum Teilen" onFocus={e => e.currentTarget.select()}
                    className="w-full rounded bg-surface-hover px-2 py-1" />
                </div>
              )}
            </div>
            {seite.absaetze.map((a, i) => <p key={i} className="leading-relaxed">{a}</p>)}
          </article>
          <aside className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg border border-dashed border-line p-3">
              <div className="text-[10px] uppercase text-muted mb-1">Anzeige</div>
              {seite.werbung}
            </div>
            <div>
              <div className="font-bold mb-1">{seite.seitenleiste.titel}</div>
              <ul className="flex flex-col gap-1 text-accent">{seite.seitenleiste.artikel.map(a => <li key={a}>{a}</li>)}</ul>
            </div>
          </aside>
        </div>
        <footer className="border-t border-line px-4 py-3 text-xs text-muted flex flex-col gap-1">
          {seite.fuss.map(f => <span key={f}>{f}</span>)}
        </footer>

        {cookies && (
          <div className="sticky bottom-0 left-0 right-0 border-t border-line bg-surface p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] flex flex-col gap-2 text-sm" role="dialog" aria-label="Cookie-Hinweis">
            <p>🍪 Wir verwenden Cookies, um dir das beste Erlebnis zu bieten und Werbung anzuzeigen.</p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn-primary text-sm" onClick={() => setCookies(false)}>Alle akzeptieren</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => setCookies(false)}>Nur notwendige</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Fensterkopf mit Reiter und Adresszeile — für Video und Lexikon wie beim Browser. */
function Fenster({ tab, url, label, children }: { tab: string; url: string; label: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line overflow-hidden shadow-lg bg-surface" aria-label={label}>
      <div className="bg-surface-hover px-2 pt-2 flex items-end gap-2">
        <div className="rounded-t-lg bg-surface px-3 py-1.5 text-xs max-w-[22rem] truncate border border-b-0 border-line">🌐 {tab}</div>
        <div className="text-muted text-sm pb-1">＋</div>
      </div>
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-line">
        <span className="text-muted text-sm select-none">← → ↻</span>
        <input readOnly value={url} aria-label="Adresszeile" onFocus={e => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-full bg-surface-hover px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-accent" />
        <span className="text-muted select-none">☆ ⋮</span>
      </div>
      <div className="relative max-h-[36rem] overflow-y-auto">{children}</div>
    </section>
  );
}

function ZeitungAnsicht({ zeitung: z }: { zeitung: Zeitung }) {
  return (
    <section className="card p-4" aria-label="Zeitung">
      <article className="rounded-sm border border-line bg-surface shadow-lg mx-auto w-full max-w-[40rem] px-6 py-5 flex flex-col gap-3" style={SERIF}>
        <header className="border-b-4 border-double border-fg pb-2 text-center">
          <div className="flex justify-between text-[11px] text-muted">
            <span>{z.jahrgang} · {z.nummer}</span><span>{z.preis}</span>
          </div>
          <h4 className="text-4xl font-black tracking-tight leading-none mt-1">{z.name}</h4>
          <div className="text-xs italic mt-1">{z.unterzeile}</div>
          <div className="text-xs mt-1 border-t border-line pt-1">{z.datum}</div>
        </header>
        <div className="flex justify-between text-xs uppercase tracking-widest border-b border-line pb-1">
          <span>{z.ressort}</span><span>Seite {z.seite}</span>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_11rem]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="text-sm font-bold text-accent">{z.dachzeile}</div>
            <h5 className="text-2xl font-black leading-tight">{z.titel}</h5>
            <p className="font-bold text-sm">{z.vorspann}</p>
            <div className="text-xs italic">{z.autor}</div>
            <div className="text-[14px] leading-relaxed text-justify hyphens-auto md:columns-2 gap-4" lang="de">
              {z.absaetze.map((a, i) => <p key={i} className="mb-2">{i === 0 && <b>{z.ortsmarke} </b>}{a}</p>)}
            </div>
          </div>
          <aside className="flex flex-col gap-3 text-xs md:border-l border-line md:pl-3">
            <div>
              <div className="font-black text-sm">{z.meldung.titel}</div>
              <p>{z.meldung.text}</p>
            </div>
            <div className="rounded border border-dashed border-line p-2">
              <div className="text-[10px] uppercase text-muted">Anzeige</div>
              {z.anzeige}
            </div>
          </aside>
        </div>
      </article>
    </section>
  );
}

function HeftAnsicht({ heft }: { heft: Heft }) {
  const [nr, setNr] = useState(0);
  const s = heft.seiten[nr];
  return (
    <section className="card p-4 flex flex-col gap-3" aria-label="Zeitschrift">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Seiten">
        {heft.seiten.map((x, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === nr} onClick={() => setNr(i)}
            className={"text-sm rounded-lg px-3 py-1 border " + (i === nr ? "border-accent text-accent font-bold" : "border-line hover:border-accent")}>
            {x.titel}
          </button>
        ))}
      </div>
      <article className="rounded-sm border border-line bg-surface shadow-lg mx-auto w-full max-w-[34rem] min-h-[26rem] px-7 py-7 flex flex-col gap-3">
        {s.art === "cover" && (
          <div className="flex-1 flex flex-col gap-4 rounded-lg bg-surface-hover p-5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-4xl font-black tracking-tight text-accent">{s.name}</h4>
              <span className="text-xs text-right">{s.heft}<br />{s.preis}</span>
            </div>
            <p className="text-3xl font-black leading-tight mt-6">{s.thema}</p>
            <ul className="mt-auto flex flex-col gap-1 text-sm font-bold">{s.anrisse.map(a => <li key={a}>▸ {a}</li>)}</ul>
          </div>
        )}
        {s.art === "inhalt" && (
          <>
            <h4 className="text-2xl font-black">Inhalt</h4>
            <ul className="flex flex-col gap-2">
              {s.eintraege.map(e => (
                <li key={e.seite} className="flex gap-3 items-baseline border-b border-line pb-1">
                  <span className="font-black tabular-nums w-8 text-right">{e.seite}</span>
                  <span className="text-xs uppercase text-muted w-20">{e.rubrik}</span>
                  <span>{e.titel}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto text-xs text-muted flex flex-col gap-0.5">
              <div className="font-bold">Impressum</div>
              {s.impressum.map(z => <span key={z}>{z}</span>)}
            </div>
          </>
        )}
        {s.art === "artikel" && (
          <>
            <div className="flex justify-between text-xs text-muted border-b border-line pb-1">
              <span>{s.rubrik ?? ""}</span><span>{s.kopf}</span>
            </div>
            {s.ueberschrift && <h4 className="text-2xl font-black leading-tight">{s.ueberschrift}</h4>}
            {s.vorspann && <p className="font-bold">{s.vorspann}</p>}
            {s.autor && <div className="text-xs italic">{s.autor}</div>}
            <div className="flex-1 flex flex-col gap-3 text-[15px] leading-relaxed" style={SERIF}>
              {s.zeilen.map((z, i) => <p key={i}>{z}</p>)}
            </div>
            <div className="text-center text-sm mt-4">{s.nr}</div>
          </>
        )}
      </article>
    </section>
  );
}

function VideoAnsicht({ video: v }: { video: Video }) {
  const [teilen, setTeilen] = useState(false);
  return (
    <Fenster tab={`${v.titel} – ${v.plattform}`} url={v.url} label="Video">
      <div className="p-4 flex flex-col gap-3">
        <div className="font-black text-accent">▶ {v.plattform}</div>
        <div className="relative rounded-xl bg-black aspect-video flex items-center justify-center text-white">
          <span className="text-6xl opacity-80">▶</span>
          <span className="absolute bottom-2 right-3 text-xs bg-black/70 rounded px-1.5 py-0.5 tabular-nums">0:00 / {v.dauer}</span>
        </div>
        <h4 className="text-xl font-black leading-tight">{v.titel}</h4>
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="w-9 h-9 rounded-full bg-surface-hover flex items-center justify-center font-black">{v.kanal[0]}</span>
          <span className="flex flex-col leading-tight"><b>{v.kanal}</b><span className="text-xs text-muted">{v.abonnenten}</span></span>
          <span className="rounded-full border border-line px-3 py-1 text-xs font-bold">Abonnieren</span>
          <span className="relative ml-auto">
            <button type="button" className="text-xs rounded-full border border-line px-3 py-1 hover:border-accent" onClick={() => setTeilen(t => !t)}>↗ Teilen</button>
            {teilen && (
              <span className="absolute right-0 z-10 mt-1 rounded-lg border border-line bg-surface shadow-xl p-2 text-xs w-64 block">
                <span className="text-muted mb-1 block">Link zum Teilen:</span>
                <input readOnly value={v.kurzlink} aria-label="Link zum Teilen" onFocus={e => e.currentTarget.select()} className="w-full rounded bg-surface-hover px-2 py-1" />
              </span>
            )}
          </span>
        </div>
        <div className="rounded-lg bg-surface-hover p-3 text-sm flex flex-col gap-1">
          <b>{v.aufrufe} · Hochgeladen am {v.hochgeladen}</b>
          {v.beschreibung.map(b => <p key={b}>{b}</p>)}
        </div>
        <div className="rounded-lg border border-line">
          <div className="px-3 py-2 border-b border-line font-bold text-sm">📝 Abschrift</div>
          <ul className="flex flex-col text-sm">
            {v.abschrift.map(z => (
              <li key={z.zeit} className="flex gap-3 px-3 py-1.5 border-b border-line last:border-0">
                <span className="text-accent tabular-nums font-bold w-10 shrink-0">{z.zeit}</span><span>{z.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm">
          <div className="font-bold mb-1">Als Nächstes</div>
          <ul className="flex flex-col gap-1 text-accent">{v.vorschlaege.map(a => <li key={a}>▶ {a}</li>)}</ul>
        </div>
      </div>
    </Fenster>
  );
}

function LexikonAnsicht({ lexikon: l }: { lexikon: Lexikon }) {
  return (
    <Fenster tab={`${l.stichwort} – ${l.name}`} url={l.url} label="Online-Lexikon">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-line flex-wrap">
        <span className="text-2xl">🔎</span>
        <span className="font-black">{l.name}</span>
        <span className="text-xs text-muted">Das freie Wissenslexikon</span>
        <span className="ml-auto rounded-full border border-line px-3 py-1 text-xs text-muted">Suchen …</span>
      </header>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex gap-3 text-xs text-muted border-b border-line flex-wrap">
          <span className="border-b-2 border-accent pb-1 text-fg">Artikel</span><span>Diskussion</span><span className="ml-auto">Bearbeiten</span><span>Versionsgeschichte</span>
        </div>
        <h4 className="text-3xl leading-tight" style={SERIF}>{l.stichwort}</h4>
        <p className="leading-relaxed">{l.kurz}</p>
        <div className="rounded border border-line bg-surface-hover p-3 text-sm w-fit">
          <div className="font-bold mb-1">Inhaltsverzeichnis</div>
          <ol className="list-decimal pl-5">{l.inhalt.map(t => <li key={t}>{t}</li>)}</ol>
        </div>
        {l.abschnitte.map(a => (
          <div key={a.titel} className="flex flex-col gap-2">
            <h5 className="text-xl border-b border-line pb-1" style={SERIF}>{a.titel}</h5>
            {a.absaetze.map((p, i) => <p key={i} className="leading-relaxed">{p}</p>)}
          </div>
        ))}
      </div>
      <footer className="border-t border-line px-4 py-3 text-xs text-muted flex flex-col gap-1">
        <span>Diese Seite wurde zuletzt am {l.stand} bearbeitet.</span>
        <span>Der Text ist unter einer freien Lizenz verfügbar · Datenschutz · Impressum</span>
      </footer>
    </Fenster>
  );
}
