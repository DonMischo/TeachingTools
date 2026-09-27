"use client";
/**
 * Jobbörse: Stellen (Ausbildung, Helferjobs, FSJ), Bewerbung mit Anschreiben-
 * Bausteinen, Einstellungstest und Vorstellungsgespräch als Minispiel,
 * dazu »Mein Job« mit Urlaub, Mittagessen-Regel und Kündigung.
 */
import { useMemo, useState } from "react";
import { ANSCHREIBEN_BAUSTEINE, anschreibenQualitaet, bewerben, fachkraftStellen, naechsterStart, selbstKuendigen, terminWahrnehmen, urlaubNehmen, vorauswahlFachkraft, zusageAnnehmen } from "@/lib/leben/aktionen";
import { BERUFE, BERUF, helferBrutto, verguetung, type Beruf, type Bereich } from "@/lib/leben/berufe";
import { alter, klon, log } from "@/lib/leben/kern";
import { abrechnung } from "@/lib/leben/lohn";
import { arbeitsweg, ausbildungsjahr, krankmelden, minijob, MINIJOBS, monatsbrutto, person, vorauswahl, type Ergebnis } from "@/lib/leben/motor";
import type { Bewerbung, Spielstand } from "@/lib/leben/typen";
import { werte } from "@/lib/leben/werte";
import { istArbeitstag, jahrVon, kurzDatum } from "@/lib/leben/zeit";
import { euro, Fenster, Hinweis, Knopf, Reiter, Zeile, eingabe } from "./ui";

const STERNE = ["", "🟢 Betriebe suchen dringend", "🟢 wenig Konkurrenz", "🟡 mittel", "🟠 viele Bewerbungen", "🔴 sehr begehrt"];

const UEBERGANG_ARTEN = ["freiwillig", "ausland", "wehrdienst", "eq"];

type Filter = "alle" | "ausbildung" | "uebergang" | "helfer";

export function JobApp({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [reiter, setReiter] = useState<"stellen" | "fachkraft" | "minijob" | "bewerbungen" | "job">(s.job ? "job" : "stellen");
  const [bereich, setBereich] = useState<Bereich | "alle">("alle");
  const [art, setArt] = useState<Filter>("alle");
  const [suche, setSuche] = useState("");
  const [bewerbenFuer, setBewerbenFuer] = useState<{ b: Beruf; betrieb?: string; brutto?: number } | null>(null);
  const [termin, setTermin] = useState<Bewerbung | null>(null);
  const jahr = jahrVon(s.tag);
  const bereiche = [...new Set(BERUFE.map((b) => b.bereich))];
  const liste = BERUFE.filter((b) => (bereich === "alle" || b.bereich === bereich)
    && (art === "alle"
      || (art === "helfer" && b.art === "helfer")
      || (art === "uebergang" && (UEBERGANG_ARTEN.includes(b.art) || b.id === "fos" || b.id === "sozialassistenz"))
      || (art === "ausbildung" && (b.art === "ausbildung" || (b.art === "schulisch" && b.id !== "fos"))))
    && (!suche || `${b.name} ${b.programm ?? ""}`.toLowerCase().includes(suche.toLowerCase())));
  const offene = s.bewerbungen.filter((b) => ["versendet", "test", "gespraech", "zusage"].includes(b.status));
  const fk = fachkraftStellen(s);
  const mj = minijob(s);

  return (
    <div className="text-sm">
      <Reiter aktiv={reiter} onWahl={setReiter} reiter={[
        { id: "stellen", name: `🔎 Stellen (${BERUFE.length})` },
        ...(fk.length ? [{ id: "fachkraft" as const, name: `🎓 Fachkraft-Stellen (${fk.length})` }] : []),
        { id: "minijob", name: `🧾 Minijobs${mj ? " ✓" : ""}` },
        { id: "bewerbungen", name: `📨 Bewerbungen (${offene.length})` }, { id: "job", name: "💼 Mein Job" },
      ]} />
      {reiter === "stellen" && (
        <>
          <div className="mb-2 flex flex-wrap gap-2">
            <input className={`${eingabe} max-w-[12rem]`} placeholder="Suchen: FÖJ, Kfz, Bank …" value={suche} onChange={(e) => setSuche(e.target.value)} />
            <select className={`${eingabe} max-w-[14rem]`} value={bereich} onChange={(e) => setBereich(e.target.value as Bereich | "alle")}>
              <option value="alle">Alle Bereiche</option>{bereiche.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select className={`${eingabe} max-w-[16rem]`} value={art} onChange={(e) => setArt(e.target.value as Filter)}>
              <option value="alle">Alles</option>
              <option value="ausbildung">Ausbildung</option>
              <option value="uebergang">Erstes Jahr: FSJ, FÖJ, BFD, EQ, Schule, Ausland, Wehrdienst</option>
              <option value="helfer">Direkt arbeiten (ohne Ausbildung)</option>
            </select>
          </div>
          <p className="mb-2 text-xs text-slate-400">Vergütungen: Verzeichnis über Ausbildungsvergütungen in Thüringen (Stand 03/2026); Taschengelder der Freiwilligendienste laut Trägern (2026). Gehalt danach: grober Richtwert. Mit 🔗 geht es zum echten Angebot.</p>
          <div className="space-y-1.5">
            {liste.map((b) => {
              const uebergang = UEBERGANG_ARTEN.includes(b.art);
              const v1 = b.art === "helfer" || uebergang ? null : verguetung(b, 1, jahr);
              const netto1 = v1 ? abrechnung(v1.betrag, jahr, person(s, b.art === "ausbildung")).netto : null;
              const brutto = b.art === "helfer" ? helferBrutto(b, werte(jahr).mindestlohn) : null;
              const chance = vorauswahl(s, b, 0.6);
              const start = b.startTermin ? naechsterStart(s, b) : null;
              const vorab = (b.vorab ?? []).reduce((a, k) => a + k.betrag, 0);
              const artText = b.art === "ausbildung" ? `Ausbildung ${Math.round((b.dauer / 12) * 10) / 10} J.` : b.art === "schulisch" ? `Schule ${b.dauer / 12} J.`
                : b.art === "helfer" ? "direkt arbeiten" : `${b.programm ?? "Programm"} · ${b.dauer} Monate`;
              return (
                <div key={b.id} className={`rounded-lg p-2 ${uebergang ? "bg-emerald-500/10 ring-1 ring-emerald-400/20" : "bg-white/5"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="flex-1">{b.name}</b>
                    <span className="rounded bg-white/10 px-1.5 text-xs">{artText}</span>
                    {b.link && <a href={b.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-300 underline" title="Echtes Angebot / Träger">🔗 echt</a>}
                    <Knopf klein art="haupt" onClick={() => setBewerbenFuer({ b })}>Bewerben</Knopf>
                  </div>
                  <div className="text-xs text-slate-300">{b.text}</div>
                  <div className="mt-1 grid gap-x-4 text-xs text-slate-400 sm:grid-cols-2">
                    <span>💶 {uebergang ? <>{b.art === "wehrdienst" ? "Wehrsold" : b.art === "eq" ? "Vergütung" : "Taschengeld"} {euro(b.taschengeld ?? 0)}/Monat{b.unterkunft?.verpflegung ? " + Unterkunft & Essen" : b.unterkunft ? " + Unterkunft" : ""}</>
                      : v1 ? <>1. Jahr {euro(v1.betrag)} brutto (≈ {euro(netto1!)} netto){v1.mindest ? " — gesetzl. Mindestvergütung" : ""}</>
                      : brutto ? <>{euro(brutto)} brutto/Monat ({(b.stundenlohn ?? 0).toFixed(2).replace(".", ",")} €/h)</> : <>kein Einkommen</>}</span>
                    <span>📈 danach: {b.gehaltNach ? `~${euro(b.gehaltNach)} brutto` : b.art === "helfer" ? "bleibt ungefähr so (Mindestlohn steigt)" : b.art === "eq" ? "oft Ausbildung im selben Betrieb" : "neu bewerben — mit Pluspunkt im Lebenslauf"}</span>
                    <span>🎓 {b.art === "helfer" || (uebergang && b.schnitt >= 5) ? "kein bestimmter Abschluss nötig" : `${b.abschluss}, gute Chancen ab Schnitt ${b.schnitt.toString().replace(".", ",")}${b.faecher.length ? ` (${b.faecher.join(", ")})` : ""}`}</span>
                    <span>{STERNE[b.konkurrenz]}{b.einstellungstest ? (b.art === "wehrdienst" ? " · Eignungstest" : " · Einstellungstest") : ""}</span>
                    {start && <span>📅 Start {kurzDatum(start.tag)}{b.frist ? ` · Frist: ${b.frist.text}` : ""}</span>}
                    {!start && <span>⏰ {b.stundenWoche} h/Woche{b.schicht ? ", Schicht" : ""}{b.wochenende ? ", auch am Wochenende" : ""}</span>}
                    {b.unterkunft && <span>🏠 {b.unterkunft.titel}</span>}
                    {vorab > 0 && <span>💸 vorher: {euro(vorab)} ({(b.vorab ?? []).map((k) => k.text).join(", ")})</span>}
                    {b.kindergeld !== undefined && <span>👪 Kindergeld: {b.kindergeld ? "läuft weiter" : "entfällt"}</span>}
                    <span>📬 Chance auf Einladung: <b className={chance > 0.5 ? "text-emerald-300" : chance > 0.25 ? "text-amber-300" : "text-rose-300"}>{Math.round(chance * 100)} %</b>{b.abAlter > alter(s) ? ` · erst ab ${b.abAlter}` : ""}</span>
                  </div>
                  {b.hinweis && <div className="mt-1 text-xs text-sky-300">ℹ️ {b.hinweis}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {reiter === "fachkraft" && (
        <div>
          <Hinweis art="tipp">Mit abgeschlossener Ausbildung kannst du dich überall als Fachkraft bewerben — Gehalt, Urlaub und Extras unterscheiden sich je Betrieb. Neue Angebote gibt es jede Woche. Wer schon arbeitet, wechselt nach 4 Wochen Kündigungsfrist.</Hinweis>
          {fk.map((f, i) => (
            <div key={i} className="mb-1.5 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-2">
              <span className="flex-1"><b>{f.beruf.name}</b> — {f.betrieb}<br /><span className="text-xs text-slate-400">{f.extras}</span></span>
              <b className="text-amber-300">{euro(f.brutto)} brutto</b>
              <span className="text-xs text-slate-400">≈ {euro(abrechnung(f.brutto, jahr, person(s, false)).netto)} netto</span>
              <Knopf klein art="haupt" onClick={() => setBewerbenFuer({ b: f.beruf, betrieb: f.betrieb, brutto: f.brutto })}>Bewerben</Knopf>
            </div>
          ))}
        </div>
      )}
      {reiter === "minijob" && (
        <div>
          <Hinweis>Minijob: bis {euro(werte(jahr).minijob)} im Monat, brutto = netto. Alle hier sind samstags — wer nicht hingeht, bekommt für den Tag nichts. Als Azubi den Nebenjob beim Betrieb melden!</Hinweis>
          {MINIJOBS.map((m) => {
            const aktiv = mj?.id === m.id;
            const lohn = Math.min(werte(jahr).minijob, Math.max(m.stundenlohn, werte(jahr).mindestlohn) * m.stunden * 4.33);
            return (
              <div key={m.id} className={`mb-1.5 flex flex-wrap items-center gap-2 rounded-lg p-2 ${aktiv ? "bg-emerald-600/20" : "bg-white/5"}`}>
                <span className="flex-1"><b>{m.name}</b><br /><span className="text-xs text-slate-400">{m.text} Samstags ab {m.beginn} Uhr, {m.stunden} Std.{m.trinkgeld ? " + Trinkgeld" : ""}{m.ab > alter(s) ? ` · erst ab ${m.ab}` : ""}</span></span>
                <b>≈ {euro(lohn)}/Monat</b>
                {aktiv ? <Knopf klein art="leise" onClick={() => tu((x) => { const y = klon(x); delete y.flags.minijob; log(y, "arbeit", `Minijob gekündigt: ${m.name}`); return { stand: y, meldung: "Minijob gekündigt." }; })}>Kündigen</Knopf>
                  : <Knopf klein disabled={m.ab > alter(s) || !!mj} onClick={() => tu((x) => { const y = klon(x); y.flags.minijob = m.id; log(y, "arbeit", `Minijob angefangen: ${m.name}`); return { stand: y, meldung: `Ab Samstag: ${m.name}.` }; })}>Annehmen</Knopf>}
              </div>
            );
          })}
        </div>
      )}
      {reiter === "bewerbungen" && (
        <div>
          {s.bewerbungen.length === 0 && <p className="text-slate-400">Noch keine Bewerbungen. Tipp: Bewirb dich auf mehrere Stellen gleichzeitig — 10 bis 20 sind normal.</p>}
          {[...s.bewerbungen].reverse().map((b) => {
            const beruf = BERUF.get(b.beruf);
            const heute = b.naechsterTag === s.tag;
            return (
              <div key={b.uid} className="mb-1 flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-2">
                <span className="flex-1"><b>{beruf?.name}{b.brutto ? ` (Fachkraft, ${euro(b.brutto)})` : ""}</b> — {b.betrieb}<br /><span className="text-xs text-slate-400">beworben {kurzDatum(b.tag)}{b.jahrgang && b.jahrgang > jahrVon(b.tag) ? ` · für den Start ${b.jahrgang}` : ""}{b.status === "test" || b.status === "gespraech" ? ` · Termin ${kurzDatum(b.naechsterTag)} 10:00` : ""}{b.status === "zusage" ? ` · Start ${kurzDatum(b.startTag!)} · annehmen bis ${kurzDatum(b.naechsterTag)}` : ""}</span></span>
                <span className="text-xs font-bold">{{ versendet: "⏳ wartet", test: "📝 Test", gespraech: "🤝 Gespräch", zusage: "🎉 Zusage", absage: "❌ Absage", angenommen: "✅ angenommen", abgelehnt: "— abgelehnt" }[b.status]}</span>
                {(b.status === "test" || b.status === "gespraech") && <Knopf klein art="haupt" disabled={!heute || s.stunde < 7 || s.stunde > 14}
                  title={heute ? "Um 10 Uhr — zwischen 7 und 14 Uhr hingehen" : "Nur am Termin-Tag"} onClick={() => setTermin(b)}>Hingehen</Knopf>}
                {b.status === "zusage" && <Knopf klein art="gut" onClick={() => tu((x) => zusageAnnehmen(x, b.uid))}>Annehmen</Knopf>}
              </div>
            );
          })}
        </div>
      )}
      {reiter === "job" && <MeinJob s={s} tu={tu} />}
      {bewerbenFuer && <Anschreiben s={s} b={bewerbenFuer.b} betrieb={bewerbenFuer.betrieb} brutto={bewerbenFuer.brutto} onZu={() => setBewerbenFuer(null)}
        onSenden={(betrieb, bausteine) => { tu((x) => bewerben(x, bewerbenFuer.b.id, betrieb, bausteine, bewerbenFuer.brutto)); setBewerbenFuer(null); }} />}
      {termin && (termin.status === "test"
        ? <Einstellungstest beruf={BERUF.get(termin.beruf)!} seed={termin.uid + s.seed} onFertig={(p) => { tu((x) => terminWahrnehmen(x, termin.uid, p)); setTermin(null); }} onZu={() => setTermin(null)} />
        : <Gespraech beruf={BERUF.get(termin.beruf)!} seed={termin.uid + s.seed} onFertig={(p) => { tu((x) => terminWahrnehmen(x, termin.uid, p)); setTermin(null); }} onZu={() => setTermin(null)} />)}
    </div>
  );
}

function MeinJob({ s, tu }: { s: Spielstand; tu: (f: (s: Spielstand) => Ergebnis) => void }) {
  const [tage, setTage] = useState(5);
  const job = s.job;
  const naechster = s.naechsterJob;
  const naechsterText = naechster && (
    <Hinweis art="info">Neuer Vertrag unterschrieben: <b>{BERUF.get(naechster.beruf)?.name}</b> bei {naechster.betrieb} ab {kurzDatum(naechster.start)}{naechster.brutto ? ` (${euro(naechster.brutto)} brutto)` : ""}.</Hinweis>
  );
  if (!job) {
    return (
      <div>
        <Hinweis>Du hast gerade keinen Job{s.jobHistorie.length ? "" : " und keine Ausbildung"}. Bewirb dich unter »Stellen«.{s.flags.arbeitslosSeit !== undefined ? " Melde dich außerdem spätestens 3 Tage nach der Kündigung bei der Agentur für Arbeit (Amt → Arbeitslosengeld)." : ""}</Hinweis>
        {naechsterText}
        {s.jobHistorie.map((j, i) => <Zeile key={i} links={`${BERUF.get(j.beruf)?.name} — ${j.betrieb}`} rechts={`${kurzDatum(j.start)} – ${j.ende !== undefined ? kurzDatum(j.ende) : ""}`} />)}
      </div>
    );
  }
  const b = BERUF.get(job.beruf)!;
  const mb = monatsbrutto(s);
  const a = abrechnung(mb.brutto, jahrVon(s.tag), person(s, job.art === "ausbildung"));
  const netto = ["freiwillig", "ausland"].includes(job.art) ? mb.brutto : a.netto;
  const begonnen = s.tag >= job.start;
  return (
    <div>
      {naechsterText}
      <div className="mb-2 rounded-xl bg-white/5 p-3">
        <div className="text-lg font-black">{b.name}{job.art === "fachkraft" ? " (Fachkraft)" : ""}</div>
        <div className="text-slate-400">{job.betrieb} · {begonnen ? `seit ${kurzDatum(job.start)}` : `Start am ${kurzDatum(job.start)}`}{job.art === "ausbildung" && begonnen ? ` · ${ausbildungsjahr(job, s.tag)}. Ausbildungsjahr` : ""}{job.ende !== undefined ? ` · endet am ${kurzDatum(job.ende)}` : ""}</div>
        <Zeile links={mb.text || "Brutto"} rechts={euro(mb.brutto)} />
        <Zeile links="≈ Netto" rechts={euro(netto)} fett />
        <Zeile links="Leistung im Betrieb" rechts={`${Math.round(job.leistung)} / 100`} />
        <Zeile links="Weg zur Arbeit" rechts={`${arbeitsweg(s)} min`} />
        <Zeile links="Urlaub" rechts={`${job.urlaubstage - job.urlaubGenommen} von ${job.urlaubstage} Tagen übrig`} />
        <Zeile links="Abmahnungen" rechts={String(job.abmahnungen)} />
        {s.tag <= job.probezeitBis && <Zeile links="Probezeit bis" rechts={kurzDatum(job.probezeitBis)} />}
        {job.zwischenpruefung !== undefined && <Zeile links="Zwischenprüfung" rechts={`${job.zwischenpruefung} Punkte`} />}
        {job.art === "ausbildung" && <Zeile links="Voraussichtliche Abschlussprüfung" rechts={kurzDatum(job.start + Math.round(b.dauer * 30.44) - 20)} />}
        {["freiwillig", "ausland", "wehrdienst", "eq"].includes(job.art) && <Zeile links="Ende" rechts={kurzDatum(job.start + Math.round(b.dauer * 30.44))} />}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span>Mittagessen:</span>
        {([["mitnehmen", "🥪 Brotdose aus dem Vorrat"], ["kaufen", "🥐 Bäcker/Kantine (6,50 €)"], ["nichts", "— nichts"]] as const).map(([id, n]) => (
          <Knopf key={id} klein art={s.flags.mittag === id ? "haupt" : "leise"} onClick={() => tu((x) => { const y = klon(x); y.flags.mittag = id; return { stand: y }; })}>{n}</Knopf>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={20} className={`${eingabe} w-20`} value={tage} onChange={(e) => setTage(Number(e.target.value))} aria-label="Urlaubstage" />
        <Knopf klein onClick={() => tu((x) => urlaubNehmen(x, tage))}>🏖️ Urlaub ab heute</Knopf>
        <Knopf klein art="leise" disabled={!istArbeitstag(s.tag) || s.stunde > 10} onClick={() => tu(krankmelden)}>🤒 Krankmelden</Knopf>
        <Knopf klein art="gefahr" onClick={() => { if (confirm("Wirklich kündigen? Wer selbst kündigt, bekommt 12 Wochen kein Arbeitslosengeld.")) tu(selbstKuendigen); }}>Kündigen</Knopf>
      </div>
      {job.art === "ausbildung" && <Hinweis art="tipp">Für die Prüfungen zählt deine Leistung im Betrieb und wie viel du lernst (Zuhause → Lernen). Ausgeschlafen, satt, sauber und ordentlich angezogen arbeitest du besser.</Hinweis>}
    </div>
  );
}

function Anschreiben({ s, b, betrieb: vorgabe, brutto, onZu, onSenden }: {
  s: Spielstand; b: Beruf; betrieb?: string; brutto?: number; onZu: () => void; onSenden: (betrieb: string, bausteine: string[]) => void;
}) {
  const [betrieb, setBetrieb] = useState(vorgabe ?? b.betriebe[0]);
  const [bausteine, setBausteine] = useState<string[]>([]);
  const q = anschreibenQualitaet(bausteine);
  const start = !brutto && b.startTermin ? naechsterStart(s, b) : null;
  return (
    <Fenster titel={`Bewerbung: ${b.name}${brutto ? " (Fachkraft)" : ""}`} icon="✉️" onZu={onZu}>
      {vorgabe ? <p className="mb-2 text-sm">Betrieb: <b>{vorgabe}</b>{brutto ? ` · ${euro(brutto)} brutto` : ""}</p> : (
        <label className="mb-2 block text-sm">{UEBERGANG_ARTEN.includes(b.art) ? "Einsatzstelle" : "Betrieb"}
          <select className={eingabe} value={betrieb} onChange={(e) => setBetrieb(e.target.value)}>{b.betriebe.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
      )}
      {start && b.frist && <Hinweis art={start.jahrgang > jahrVon(s.tag) ? "warnung" : "info"}>Frist: {b.frist.text}. {start.jahrgang > jahrVon(s.tag) ? `Für ${jahrVon(s.tag)} ist sie vorbei — die Bewerbung zählt für den Start am ${kurzDatum(start.tag)} (außer es wird ein Platz frei).` : `Start am ${kurzDatum(start.tag)}.`}</Hinweis>}
      <div className="mb-2 text-sm font-bold">Was steckt in deiner Bewerbung?</div>
      {ANSCHREIBEN_BAUSTEINE.map((x) => (
        <label key={x.id} className="flex items-start gap-2 py-0.5 text-sm">
          <input type="checkbox" className="mt-1" checked={bausteine.includes(x.id)} onChange={(e) => setBausteine(e.target.checked ? [...bausteine, x.id] : bausteine.filter((y) => y !== x.id))} />
          {x.text}
        </label>
      ))}
      <div className="my-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-400" style={{ width: `${q * 100}%` }} /></div>
      <p className="mb-2 text-xs text-slate-400">Qualität der Bewerbung: {Math.round(q * 100)} %. Chance auf Einladung etwa {Math.round((brutto ? vorauswahlFachkraft(s, b.id, q) : vorauswahl(s, b, q)) * 100)} %. Eine gute Bewerbung kostet Zeit (1,5 Std.).</p>
      <Knopf art="haupt" onClick={() => onSenden(betrieb, bausteine)}>Abschicken</Knopf>
    </Fenster>
  );
}

// ───────────────────────────────────────────────────────────── Minispiele

type Frage = { frage: string; antworten: string[]; richtig: number };

function zufallAus(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function mischen<T>(r: () => number, a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

function mitAntworten(r: () => number, frage: string, richtig: string, falsch: string[]): Frage {
  const antworten = mischen(r, [richtig, ...falsch]);
  return { frage, antworten, richtig: antworten.indexOf(richtig) };
}

function testFragen(b: Beruf, seed: number): Frage[] {
  const r = zufallAus(seed);
  const z = (a: number, c: number) => a + Math.floor(r() * (c - a + 1));
  const fr: Frage[] = [];
  // Prozent
  const preis = z(4, 18) * 10, prozent = [10, 20, 25, 30][z(0, 3)];
  const erg = preis * (1 - prozent / 100);
  fr.push(mitAntworten(r, `Eine Ware kostet ${preis} €. Sie wird um ${prozent} % reduziert. Was kostet sie jetzt?`, `${erg} €`, [`${preis - prozent} €`, `${erg + 10} €`, `${preis * prozent / 100} €`]));
  // Dreisatz
  const n = z(3, 6), zeit = z(4, 9) * n;
  fr.push(mitAntworten(r, `${n} Arbeiter brauchen ${zeit} Stunden für einen Auftrag. Wie lange brauchen ${n * 2} Arbeiter?`, `${(zeit / 2).toLocaleString("de-DE")} Stunden`, [`${zeit * 2} Stunden`, `${zeit} Stunden`, `${zeit - n} Stunden`]));
  // Kopfrechnen
  const a1 = z(12, 48), a2 = z(6, 19);
  fr.push(mitAntworten(r, `${a1} × ${a2} = ?`, String(a1 * a2), [String(a1 * a2 + 10), String(a1 * a2 - a2), String(a1 * (a2 + 1))]));
  // Einheiten
  fr.push(mitAntworten(r, "Wie viele Kubikzentimeter sind ein Liter?", "1.000 cm³", ["100 cm³", "10.000 cm³", "10 cm³"]));
  // Zahlenreihe
  const s0 = z(2, 6), d = z(3, 7);
  fr.push(mitAntworten(r, `Wie geht die Reihe weiter? ${s0}, ${s0 + d}, ${s0 + 3 * d}, ${s0 + 6 * d}, …`, String(s0 + 10 * d), [String(s0 + 9 * d), String(s0 + 8 * d), String(s0 + 12 * d)]));
  // Rechtschreibung
  const rs = [
    ["Welches Wort ist richtig geschrieben?", "Rhythmus", ["Rythmus", "Rhytmus", "Rytmus"]],
    ["Welches Wort ist richtig geschrieben?", "Standard", ["Standart", "Stanndard", "Standarte"]],
    ["Welcher Satz ist richtig?", "Ich freue mich, dass du kommst.", ["Ich freue mich das du kommst.", "Ich freue mich, das du kommst.", "Ich freue mich dass du kommst."]],
    ["Welches Wort ist richtig geschrieben?", "nämlich", ["nähmlich", "nämmlich", "nemlich"]],
  ] as const;
  const w = rs[z(0, rs.length - 1)];
  fr.push(mitAntworten(r, w[0], w[1], [...w[2]]));
  // Fachbezug
  if (b.faecher.includes("Physik")) fr.push(mitAntworten(r, "Eine Lampe hat 230 V und 0,5 A. Welche Leistung hat sie?", "115 W", ["460 W", "230 W", "11,5 W"]));
  else if (b.faecher.includes("Biologie")) fr.push(mitAntworten(r, "Welches Organ reinigt das Blut?", "die Nieren", ["die Lunge", "der Magen", "die Milz"]));
  else if (b.faecher.includes("Englisch")) fr.push(mitAntworten(r, "»I have been working here since 2024.« — Was bedeutet das?", "Ich arbeite hier seit 2024.", ["Ich habe 2024 hier gearbeitet.", "Ich werde ab 2024 hier arbeiten.", "Ich arbeitete bis 2024 hier."]));
  else fr.push(mitAntworten(r, "Welche Stadt ist die Landeshauptstadt von Thüringen?", "Erfurt", ["Weimar", "Jena", "Gera"]));
  fr.push(mitAntworten(r, "Ein Kunde zahlt 50 € für eine Rechnung über 37,85 €. Wie viel Wechselgeld?", "12,15 €", ["13,15 €", "12,25 €", "11,85 €"]));
  return fr;
}

function Einstellungstest({ beruf, seed, onFertig, onZu }: { beruf: Beruf; seed: number; onFertig: (p: number) => void; onZu: () => void }) {
  const fragen = useMemo(() => testFragen(beruf, seed), [beruf, seed]);
  const [antw, setAntw] = useState<Record<number, number>>({});
  const fertig = Object.keys(antw).length === fragen.length;
  return (
    <Fenster titel={`Einstellungstest: ${beruf.name}`} icon="📝" onZu={onZu}
      fuss={<Knopf art="haupt" disabled={!fertig} onClick={() => onFertig(fragen.filter((f, i) => antw[i] === f.richtig).length / fragen.length)}>Abgeben</Knopf>}>
      <p className="mb-2 text-sm text-slate-300">Kein Taschenrechner. Du brauchst etwa 55 % zum Bestehen.</p>
      {fragen.map((f, i) => (
        <div key={i} className="mb-3">
          <div className="mb-1 font-bold">{i + 1}. {f.frage}</div>
          <div className="grid gap-1 sm:grid-cols-2">
            {f.antworten.map((a, j) => (
              <button key={j} type="button" onClick={() => setAntw((alt) => ({ ...alt, [i]: j }))}
                className={`rounded-lg px-2 py-1 text-left text-sm ${antw[i] === j ? "bg-amber-500 text-black" : "bg-white/5 hover:bg-white/10"}`}>{a}</button>
            ))}
          </div>
        </div>
      ))}
    </Fenster>
  );
}

const GESPRAECH: { frage: string; antworten: [string, number][] }[] = [
  { frage: "»Erzählen Sie mal etwas über sich.«", antworten: [["Kurz Schulabschluss, Hobbys mit Bezug zum Beruf, warum ich mich hier bewerbe.", 1], ["Ich bin halt ganz normal, keine Ahnung.", 0], ["Meine komplette Lebensgeschichte seit der Grundschule.", 0.4]] },
  { frage: "»Warum möchten Sie gerade bei uns lernen?«", antworten: [["Ich habe gelesen, dass Sie … machen, und im Praktikum hat mir genau das Spaß gemacht.", 1], ["Weil Sie in der Nähe sind.", 0.3], ["Meine Mutter meinte, ich soll mich bewerben.", 0]] },
  { frage: "»Was ist Ihre größte Schwäche?«", antworten: [["Ich bin manchmal ungeduldig — ich arbeite daran, indem ich mir Aufgaben besser einteile.", 1], ["Ich habe keine Schwächen.", 0.1], ["Ich komme morgens schlecht aus dem Bett.", 0]] },
  { frage: "»Wo sehen Sie sich in fünf Jahren?«", antworten: [["Mit abgeschlossener Ausbildung als Fachkraft, vielleicht mit einer Weiterbildung.", 1], ["Auf Ihrem Stuhl.", 0.2], ["Weiß ich noch nicht.", 0.3]] },
  { frage: "»Haben Sie noch Fragen an uns?«", antworten: [["Wie sieht ein typischer Tag für Azubis bei Ihnen aus?", 1], ["Nein.", 0.2], ["Wie viel Urlaub habe ich und wann ist Feierabend?", 0.3]] },
  { frage: "»Wie gehen Sie mit Kritik um?«", antworten: [["Ich höre zu, frage nach und versuche es beim nächsten Mal besser zu machen.", 1], ["Kommt drauf an, wer kritisiert.", 0.2], ["Ich werde schnell sauer.", 0]] },
  { frage: "»Sie kommen fünf Minuten zu spät zum Gespräch. Was sagen Sie?«", antworten: [["Entschuldigung, die Bahn hatte Verspätung — ich hätte eine frühere nehmen sollen.", 1], ["Nichts, fünf Minuten sind doch egal.", 0], ["Ist ja noch nicht so spät.", 0.1]] },
];

function Gespraech({ beruf, seed, onFertig, onZu }: { beruf: Beruf; seed: number; onFertig: (p: number) => void; onZu: () => void }) {
  const fragen = useMemo(() => { const r = zufallAus(seed); return mischen(r, GESPRAECH).slice(0, 5).map((f) => ({ ...f, antworten: mischen(r, f.antworten) })); }, [seed]);
  const [antw, setAntw] = useState<Record<number, number>>({});
  const fertig = Object.keys(antw).length === fragen.length;
  return (
    <Fenster titel={`Vorstellungsgespräch: ${beruf.name}`} icon="🤝" onZu={onZu}
      fuss={<Knopf art="haupt" disabled={!fertig} onClick={() => onFertig(fragen.reduce((a, f, i) => a + f.antworten[antw[i]][1], 0) / fragen.length)}>Gespräch beenden</Knopf>}>
      <Hinweis art="tipp">Pünktlich, gepflegt, Handy aus. Überleg, was ein Betrieb hören möchte — ehrlich, aber gut vorbereitet.</Hinweis>
      {fragen.map((f, i) => (
        <div key={i} className="mb-3">
          <div className="mb-1 font-bold">{f.frage}</div>
          {f.antworten.map(([a], j) => (
            <button key={j} type="button" onClick={() => setAntw((alt) => ({ ...alt, [i]: j }))}
              className={`mb-1 block w-full rounded-lg px-2 py-1 text-left text-sm ${antw[i] === j ? "bg-amber-500 text-black" : "bg-white/5 hover:bg-white/10"}`}>{a}</button>
          ))}
        </div>
      ))}
    </Fenster>
  );
}
