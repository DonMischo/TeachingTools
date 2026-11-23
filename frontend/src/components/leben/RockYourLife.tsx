"use client";
/**
 * »Rock your Life« — die Hülle: Spielstand laden/speichern, Kopfleiste,
 * Wohnungsbild, Aktionen zu Hause, »Wohin?«, Handy mit Apps, Dialoge.
 * Mit Sitzungscode meldet sie Zusammenfassung und Protokoll an die Lehrkraft.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import HelpButton from "@/components/HelpButton";
import { arztBesuch, ausgehen, einkaufen, elternBesuchen, moebelKaufenGebraucht, moebelKaufenNeu, moebelVerkaufen, sportDraussen } from "@/lib/leben/aktionen";
import { BERUF } from "@/lib/leben/berufe";
import { alter, klon, log } from "@/lib/leben/kern";
import {
  arbeiten, arbeitHeute, duschen, freizeit, mahlzeit, minijob, minijobArbeiten, neuesSpiel, putzen, routine, schlafen, waschen,
  type Ergebnis, type Freizeit, type StartOptionen,
} from "@/lib/leben/motor";
import { herunterladen, hochladen, lokalLaden, lokalSpeichern, zusammenfassung } from "@/lib/leben/speichern";
import type { Spielstand } from "@/lib/leben/typen";
import { datumText, ENDE_TAG, feiertag, kurzDatum, monatsIndex, uhrText } from "@/lib/leben/zeit";
import { Ausgehen } from "./Ausgehen";
import { BankApp } from "./BankApp";
import { EreignisDialog, Endbericht, MonatsbilanzDialog, Tagebuch, WohinDialog, type Ziel } from "./Dialoge";
import { JobApp } from "./JobApp";
import { Laden } from "./Laden";
import { LehrerUebersicht } from "./LehrerUebersicht";
import { Moebel } from "./Moebel";
import { OrdnerApp, PostApp } from "./PostOrdner";
import { Start } from "./Start";
import { SteuerApp } from "./SteuerApp";
import { AmtApp, VertraegeApp } from "./VertraegeAmt";
import { RechercheApp, WohnungApp } from "./WohnungApp";
import { type Platz } from "./Wohnungsbild";
import { Wohnung3D } from "./Wohnung3D";
import { Checkliste } from "./Checkliste";
import { MobilApp, Stil } from "./Stil";
import { IchApp } from "./IchApp";
import { offenePunkte } from "@/lib/leben/notizen";
import { BLINKEN, frei, hakenOffen, hervor, tutorialEnde, tutorialHaken, tutorialSchritt, tutorialWeiter, TutorialKarte, type Frei, type Haken, type Tat } from "./Tutorial";
import { Balken, euro, Fenster, Knopf } from "./ui";

export type LebenZugang = { code: string; token: string | null } | null;

type App = "bank" | "post" | "ordner" | "vertraege" | "amt" | "steuer" | "jobs" | "wohnen" | "recherche" | "tagebuch" | "mobil" | "ich" | "notizen";
const APPS: { id: App; icon: string; name: string }[] = [
  { id: "jobs", icon: "💼", name: "Jobs" }, { id: "bank", icon: "🏦", name: "Bank" }, { id: "post", icon: "📬", name: "Post" },
  { id: "ordner", icon: "🗂️", name: "Ordner" }, { id: "wohnen", icon: "🏠", name: "Wohnen" }, { id: "vertraege", icon: "📄", name: "Verträge" },
  { id: "amt", icon: "🏛️", name: "Amt" }, { id: "steuer", icon: "🧮", name: "Steuer" }, { id: "recherche", icon: "🔎", name: "Recherche" },
  { id: "mobil", icon: "🚗", name: "Mobil" }, { id: "tagebuch", icon: "📓", name: "Tagebuch" },
  { id: "ich", icon: "🪪", name: "Ich" }, { id: "notizen", icon: "🗒️", name: "Notizen" },
];

type Modal = null | { art: "wohin" } | { art: "laden"; markt: string } | { art: "moebel" } | { art: "ausgehen" } | { art: "app"; app: App } | { art: "lehrer" } | { art: "stil"; start: "kleidung" | "friseur" | "handy" };

export default function RockYourLife({ speicherSchluessel = "geraet", zugang = null, lehrkraft = false, name, action }: {
  speicherSchluessel?: string; zugang?: LebenZugang; lehrkraft?: boolean; name?: string; action?: ReactNode;
}) {
  const [s, setS] = useState<Spielstand | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [meldungen, setMeldungen] = useState<{ id: number; text: string; fehler?: boolean }[]>([]);
  const [platz, setPlatz] = useState<Platz>("mitte");
  const [bilanzGesehen, setBilanzGesehen] = useState(0);
  const zaehler = useRef(0);
  const datei = useRef<HTMLInputElement>(null);

  // Laden — Schlüssel an den State binden (StrictMode-Falle, siehe Memory)
  const [geladenFuer, setGeladenFuer] = useState<string | null>(null);
  useEffect(() => {
    const x = lokalLaden(speicherSchluessel);
    setS(x);
    setBilanzGesehen(x?.bilanzen.length ?? 0);
    setGeladenFuer(speicherSchluessel);
    setGeladen(true);
  }, [speicherSchluessel]);
  useEffect(() => {
    if (!geladen || geladenFuer !== speicherSchluessel) return;
    lokalSpeichern(speicherSchluessel, s);
  }, [s, geladen, geladenFuer, speicherSchluessel]);

  // An die Lehrkraft melden (Zusammenfassung + neue Protokollzeilen)
  const gemeldet = useRef<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (!s || !zugang?.code) return;
    const t = setTimeout(() => {
      const merk = `hp_leben_meldung_${speicherSchluessel}`;
      let stand = gemeldet.current;
      if (!stand) { try { stand = JSON.parse(localStorage.getItem(merk) ?? "null"); } catch { stand = null; } }
      const neustart = !stand || stand.id !== s.id;
      const ab = neustart ? 0 : Math.min(stand!.n, s.log.length);
      const neu = s.log.slice(ab, ab + 400).map((l) => ({ ...l, datum: kurzDatum(l.tag), text: l.text.slice(0, 400) }));
      api.leben.stand({ code: zugang.code, token: zugang.token }, {
        spiel_id: s.id, figur: s.figur.name, zusammenfassung: zusammenfassung(s), neu, neustart,
      }).then(() => {
        gemeldet.current = { id: s.id, n: ab + neu.length };
        try { localStorage.setItem(merk, JSON.stringify(gemeldet.current)); } catch { /* egal */ }
      }).catch(() => { /* offline oder Token abgelaufen — der nächste Versuch holt es nach */ });
    }, 2500);
    return () => clearTimeout(t);
  }, [s, zugang?.code, zugang?.token, speicherSchluessel]);

  const melde = useCallback((text: string, fehler = false) => {
    const id = ++zaehler.current;
    setMeldungen((m) => [...m.slice(-3), { id, text, fehler }]);
    setTimeout(() => setMeldungen((m) => m.filter((x) => x.id !== id)), fehler ? 7000 : 5500);
  }, []);

  // Aktionen rechnen auf dem neuesten Stand (Ref), nicht im setState-Updater —
  // der liefe in StrictMode doppelt und würde Meldungen verdoppeln.
  const aktuell = useRef<Spielstand | null>(null);
  aktuell.current = s;
  const tu = useCallback((f: (x: Spielstand) => Ergebnis, p?: Platz, tat?: Tat) => {
    const alt = aktuell.current;
    if (!alt) return;
    const r = f(alt);
    if (r.fehler) { melde(r.fehler, true); return; }
    const neu = (tat && tutorialWeiter(r.stand, tat)) || r.stand;
    aktuell.current = neu;
    setS(neu);
    if (r.meldung) melde(r.meldung);
    if (p) setPlatz(p);
  }, [melde]);
  // Übungsschritte, die keine Spielaktion sind (App öffnen, »Weiter«)
  const tutTat = useCallback((tat: Tat) => {
    const neu = aktuell.current && tutorialWeiter(aktuell.current, tat);
    if (neu) { aktuell.current = neu; setS(neu); }
  }, []);
  // Übung »Uhr und Geld«: Maus drüber, antippen oder per Tastatur fokussieren hakt ab
  const angeschaut = useCallback((id: Haken) => {
    const neu = aktuell.current && tutorialHaken(aktuell.current, id);
    if (neu) { aktuell.current = neu; setS(neu); }
  }, []);

  if (!geladen) return <div className="p-6 text-center text-slate-400">Lädt …</div>;

  const kopf = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <h1 className="text-xl font-black">🎸 Rock your Life</h1>
      <span className="text-sm text-slate-400">Lebenssimulation · Erfurt 2026–2031</span>
      <HelpButton slug="leben" />
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {lehrkraft && zugang?.code && <Knopf klein onClick={() => setModal({ art: "lehrer" })}>👩‍🏫 Klassenübersicht</Knopf>}
        {action}
      </div>
    </div>
  );

  if (!s) {
    return (
      <div className="p-2 sm:p-4">
        {kopf}
        <Start name={name} onStart={(o: StartOptionen, uebung?: boolean) => { const x = neuesSpiel(o); if (uebung) x.flags.tutorial = 0; setS(x); setBilanzGesehen(0); }} onLaden={(x) => { setS(x); setBilanzGesehen(x.bilanzen.length); melde("Spielstand geladen."); }} />
        {modal?.art === "lehrer" && zugang?.code && <LehrerUebersicht code={zugang.code} onZu={() => setModal(null)} />}
      </div>
    );
  }

  const neuesLeben = () => { if (confirm("Wirklich ein neues Leben beginnen? Der aktuelle Stand wird gelöscht (vorher herunterladen!).")) { setS(null); } };

  if (s.beendet) {
    return <div className="p-2 sm:p-4">{kopf}<Endbericht s={s} onNeu={neuesLeben} onDownload={() => herunterladen(s)} /></div>;
  }

  const b = s.beduerfnisse;
  const job = arbeitHeute(s);
  const ungelesen = s.post.filter((p) => !p.gelesen).length;
  const offeneRechnungen = s.post.filter((p) => p.aktion?.art === "rechnung" && !p.aktion.bezahlt).length;
  const dringend = offenePunkte(s).filter((p) => p.dringend).length;
  const ft = feiertag(s.tag);
  const mahlzeitJetzt = s.stunde < 10.5 ? "fruehstueck" : s.stunde < 15 ? "mittag" : s.stunde < 22 ? "abend" : "snack";
  const neueBilanz = s.bilanzen.length > bilanzGesehen ? s.bilanzen[s.bilanzen.length - 1] : null;
  const fortschritt = s.tag / ENDE_TAG;
  const fehlt = String(s.flags.fehltZuhause ?? "");
  const uebung = tutorialSchritt(s) !== null;

  const zu = () => setModal(null);
  const ziel = (z: Ziel, markt?: string) => {
    switch (z) {
      case "arbeit": setModal(null); tu(arbeiten, "tuer"); break;
      case "laden": setModal({ art: "laden", markt: markt ?? "lidl" }); break;
      case "moebel": setModal({ art: "moebel" }); break;
      case "ausgehen": setModal({ art: "ausgehen" }); break;
      case "amt": setModal({ art: "app", app: "amt" }); break;
      case "termin": setModal({ art: "app", app: "jobs" }); break;
      case "arzt": setModal(null); tu(arztBesuch, "tuer"); break;
      case "eltern": setModal(null); tu((x) => elternBesuchen(x, true), "tuer"); break;
      case "sport": setModal(null); tu((x) => sportDraussen(x, false), "tuer"); break;
      case "studio": setModal(null); tu((x) => sportDraussen(x, true), "tuer"); break;
      case "stil": setModal({ art: "stil", start: "kleidung" }); break;
      case "friseur": setModal({ art: "stil", start: "friseur" }); break;
      case "minijob": setModal(null); tu(minijobArbeiten, "tuer"); break;
    }
  };

  const checklisteZiel = (z: string) => {
    if (z === "stil") setModal({ art: "stil", start: "kleidung" });
    else if (z === "moebel") setModal({ art: "moebel" });
    else if (z === "laden") setModal({ art: "wohin" });
    else setModal({ art: "app", app: z as App });
  };

  const aktion = (icon: string, text: string, f: (x: Spielstand) => Ergebnis, p: Platz, title?: string, was: Frei = "mehr", tat?: Tat) => frei(s, was) && (
    <button key={text} type="button" title={title ?? text} onClick={() => tu(f, p, tat)}
      className={`flex min-w-18 flex-col items-center gap-0.5 rounded-xl bg-slate-800 px-2 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-white/10 hover:bg-slate-700 ${hervor(s, was) ? BLINKEN : ""}`}>
      <span className="text-xl">{icon}</span>{text}
    </button>
  );

  return (
    <div className="p-2 sm:p-4">
      {kopf}
      {uebung && (
        <div className="mb-2">
          <TutorialKarte s={s} onWeiter={() => tutTat("ok")} onEnde={() => setS(tutorialEnde(s))}
            onNeu={() => { if (confirm("Die Übung ist vorbei. Jetzt ein echtes Leben anfangen?")) setS(null); }} />
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-2xl bg-slate-950 p-2 text-slate-100 shadow-2xl ring-1 ring-black/30 lg:flex-row">
        {/* Links: Kopfleiste + Wohnung + Aktionen */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2">
            <span className="text-2xl">{s.figur.avatar}</span>
            <div className="leading-tight">
              <div className="font-black">{s.figur.name} <span className="text-xs font-normal text-slate-400">({alter(s)})</span></div>
              <div className="text-xs text-slate-400">{s.job ? `${BERUF.get(s.job.beruf)?.name}${s.tag < s.job.start ? ` ab ${kurzDatum(s.job.start)}` : ""}` : "ohne Job"} · {s.wohnung.form === "eltern" ? "bei den Eltern" : s.wohnung.stadtteil}</div>
            </div>
            <div className={`ml-auto rounded-xl text-right leading-tight ${hakenOffen(s, "uhr") ? BLINKEN : ""}`} tabIndex={0} data-testid="uhr"
              title="Uhrzeit und Datum im Spiel. Jede Aktion kostet Zeit — Schlafen, Arbeit und Läden haben feste Zeiten."
              onMouseEnter={() => angeschaut("uhr")} onFocus={() => angeschaut("uhr")} onClick={() => angeschaut("uhr")}>
              <div className="font-black tabular-nums">🕒 {uhrText(s.stunde)} · {datumText(s.tag, true)}</div>
              <div className="text-xs text-slate-400">{ft ? `🎉 ${ft} · ` : ""}Monat {monatsIndex(s.tag) + 1} von 60{job.muss && !job.erledigt ? ` · heute ${job.schule ? "Berufsschule" : "Arbeit"} ab ${uhrText(job.beginn)}` : ""}</div>
            </div>
            <div className={`rounded-xl px-3 py-1 text-right ${s.konto.stand < 0 ? "bg-rose-700" : "bg-emerald-800"} ${hakenOffen(s, "geld") ? BLINKEN : ""}`} tabIndex={0} data-testid="konto"
              title={`Geld auf deinem Konto. Bargeld in der Tasche: ${euro(s.bargeld ?? 0)}. Rot heißt: Du hast Schulden.`}
              onMouseEnter={() => angeschaut("geld")} onFocus={() => angeschaut("geld")} onClick={() => angeschaut("geld")}>
              <div className="text-xs opacity-80">Konto</div><div className="font-black tabular-nums">{euro(s.konto.stand)}</div>
            </div>
            <div className="w-full"><div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-amber-400" style={{ width: `${fortschritt * 100}%` }} /></div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-slate-900 px-3 py-2 sm:grid-cols-4 xl:grid-cols-7">
            <Balken icon="🍽️" label="Hunger (voll = satt)" wert={b.hunger} />
            <Balken icon="⚡" label="Energie" wert={b.energie} />
            <Balken icon="🚿" label="Hygiene" wert={b.hygiene} />
            {!uebung && <Balken icon="💬" label="Soziales" wert={b.sozial} />}
            <Balken icon="🎮" label="Spaß" wert={b.spass} />
            {!uebung && <Balken icon="❤️" label="Gesundheit" wert={b.gesundheit} />}
            {!uebung && <Balken icon="🧹" label="Ordnung" wert={b.ordnung} />}
          </div>
          {!uebung && <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
            <button type="button" className="flex items-center gap-1.5 hover:text-white" onClick={() => setModal({ art: "stil", start: "kleidung" })} title="Kleidung (schlechtestes Teil)">
              👕 <Mini wert={Math.min(s.kleidung.alltag.zustand, s.kleidung.unterwaesche.zustand, s.kleidung.schuhe.zustand)} /></button>
            <button type="button" className="flex items-center gap-1.5 hover:text-white" onClick={() => setModal({ art: "stil", start: "friseur" })} title="Frisur">💇 <Mini wert={s.frisur} /></button>
            <button type="button" className="flex items-center gap-1.5 hover:text-white" onClick={() => setModal({ art: "stil", start: "handy" })} title={`Handy: ${s.handy.modell}`}>📱 <Mini wert={s.handy.zustand} /></button>
            {s.auto && <span title={s.auto.modell}>🚗 {Math.round(s.auto.zustand)} %</span>}
            {s.wohnung.form === "unterkunft" && <span>📍 {s.wohnung.titel}</span>}
            {minijob(s) && <span>🧾 Minijob samstags</span>}
          </div>}
          <div className="relative h-[32vh] min-h-[220px] overflow-hidden rounded-xl bg-slate-800 sm:h-[46vh] sm:min-h-[300px]">
            <Wohnung3D s={s} platz={platz} onVerschieben={(uid, x, y, drehen) => tu((alt) => {
              const neu = klon(alt); const m = neu.moebel.find((q) => q.uid === uid);
              if (m) { if (drehen) m.gedreht = !m.gedreht; else { m.x = x; m.y = y; } }
              return { stand: neu };
            })} />
            <div className="pointer-events-none absolute right-2 top-2 flex max-w-[70%] flex-col items-end gap-1">
              {meldungen.map((m) => (
                <div key={m.id} className={`rounded-xl px-3 py-2 text-sm font-bold shadow-lg ${m.fehler ? "bg-rose-600 text-white" : "bg-slate-900/90 text-white ring-1 ring-white/15"}`}>{m.text}</div>
              ))}
            </div>
            {fehlt && <div className="absolute bottom-2 right-2 rounded-lg bg-amber-500/90 px-2 py-1 text-xs font-bold text-black">Fehlt zu Hause: {fehlt}</div>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aktion("😴", "Schlafen", (x) => schlafen(x, arbeitHeute(x, x.stunde >= 12 ? x.tag + 1 : x.tag).muss ? Math.max(4, arbeitHeute(x, x.stunde >= 12 ? x.tag + 1 : x.tag).beginn - 1.5) : 8.5), "bett", "Schlafen bis zum Aufstehen", "schlafen", "schlafen")}
            {aktion("😪", "Nickerchen", (x) => schlafen(x, (x.stunde + 1.5) % 24), "bett")}
            {aktion("🍳", "Essen", (x) => mahlzeit(x, mahlzeitJetzt), "kueche", "Aus dem Vorrat essen", "essen", "essen")}
            {aktion("🚿", "Duschen", duschen, "bad", undefined, "duschen", "duschen")}
            {aktion("🧹", "Putzen", putzen, "mitte")}
            {aktion("🧺", "Wäsche", waschen, "bad")}
            {(["serie", "zocken", "lesen", "telefonieren", "lernen", "sport"] as Freizeit[]).map((f) => aktion(
              { serie: "📺", zocken: "🎮", lesen: "📖", telefonieren: "📞", lernen: "📚", sport: "🤸", chillen: "🛋️" }[f],
              { serie: "Serie", zocken: "Zocken", lesen: "Lesen", telefonieren: "Anrufen", lernen: "Lernen", sport: "Workout", chillen: "Chillen" }[f],
              (x) => freizeit(x, f, f === "sport" ? 1 : 2), f === "lernen" ? "tisch" : f === "sport" ? "mitte" : "sofa",
              undefined, f === "serie" || f === "zocken" ? "spass" : "mehr", "spass"))}
            {frei(s, "raus") && <button type="button" onClick={() => setModal({ art: "wohin" })}
              className={`flex min-w-20 flex-col items-center gap-0.5 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-black shadow-sm hover:bg-amber-400 ${hervor(s, "raus") ? BLINKEN : ""}`}>
              <span className="text-xl">🚪</span>Raus!
            </button>}
          </div>
          {frei(s, "zeit") && <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-900 px-2 py-1.5">
            <span className="text-xs font-bold text-slate-400">⏩ Zeit vergehen lassen:</span>
            <span className={`rounded-xl ${hervor(s, "zeit") ? BLINKEN : ""}`}><Knopf klein onClick={() => tu((x) => routine(x, 1), "mitte", "zeit")}>1 Tag</Knopf></span>
            {!uebung && <>
              <Knopf klein onClick={() => tu((x) => routine(x, 7), "mitte")}>1 Woche</Knopf>
              <Knopf klein onClick={() => tu((x) => routine(x, 31), "mitte")}>bis etwas passiert</Knopf>
              <span className="text-xs text-slate-500">Routine: aufstehen, essen, duschen, arbeiten, schlafen — stoppt bei Post, Ereignissen, Hunger, Monatsende.</span>
            </>}
          </div>}
        </div>

        {/* Rechts: Handy */}
        <div className="w-full shrink-0 rounded-4xl bg-black p-2 ring-4 ring-slate-700 lg:w-72">
          <div className="rounded-[1.6rem] bg-linear-to-b from-indigo-900 to-slate-900 p-3">
            <div className="mb-2 flex justify-between text-xs text-slate-300"><span>{uhrText(s.stunde)}</span><span>📶 🔋</span></div>
            {!uebung && <div className="mb-3 rounded-xl bg-black/30 p-2">
              <div className="mb-1 text-xs font-black text-white">📋 Nächste Schritte</div>
              <Checkliste s={s} onZiel={checklisteZiel} />
            </div>}
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-3">
              {APPS.filter((a) => frei(s, appFrei(a.id))).map((a) => (
                <button key={a.id} type="button" onClick={() => { setModal({ art: "app", app: a.id }); if (a.id === "bank" || a.id === "jobs") tutTat(a.id); }} className="relative flex flex-col items-center gap-0.5 text-[11px] text-white">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-sm ring-1 ring-white/10 ${hervor(s, appFrei(a.id)) ? BLINKEN : ""}`}>{a.icon}</span>
                  {a.name}
                  {a.id === "post" && ungelesen > 0 && <span className="absolute -right-0.5 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-black">{ungelesen}</span>}
                  {a.id === "notizen" && dringend > 0 && <span className="absolute -right-0.5 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-black">{dringend}</span>}
                  {a.id === "bank" && offeneRechnungen > 0 && <span className="absolute -right-0.5 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">!</span>}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs text-slate-300">
              <div>💶 Bargeld: <b>{euro(s.bargeld)}</b> · 🐷 {euro(s.sparkonto)}</div>
              <div className="flex flex-wrap gap-1 pt-1">
                <Knopf klein art="leise" onClick={() => herunterladen(s)}>💾 Speichern (.json)</Knopf>
                <Knopf klein art="leise" onClick={() => datei.current?.click()}>📂 Laden</Knopf>
                <Knopf klein art="leise" onClick={neuesLeben}>🔄 Neu</Knopf>
              </div>
              <input ref={datei} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const x = await hochladen(f);
                if (x) { setS(x); setBilanzGesehen(x.bilanzen.length); melde("Spielstand geladen."); } else melde("Ungültige Datei.", true);
                e.target.value = "";
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Dialoge */}
      {s.offen.length > 0 && <EreignisDialog s={s} tu={tu} />}
      {s.offen.length === 0 && neueBilanz && <MonatsbilanzDialog s={s} b={neueBilanz} onZu={() => setBilanzGesehen(s.bilanzen.length)} />}
      {modal?.art === "wohin" && <WohinDialog s={s} nurLaden={uebung} onZiel={ziel} onZu={zu} onSchwarz={(an) => tu((x) => { const y = klon(x); y.flags.schwarzfahren = an; if (an) log(y, "system", "Fährt ab jetzt ohne Fahrschein."); return { stand: y }; })} />}
      {modal?.art === "laden" && <Laden s={s} marktId={modal.markt} onZu={zu} uebung={uebung}
        onKaufen={(korb, bar) => { tu((x) => einkaufen(x, korb.length ? modal.markt : modal.markt, korb, bar), "kueche", "kauf"); setModal(null); }}
        onRecherche={(produkt, preis, quelle) => tu((x) => { const y = klon(x); let r: Record<string, unknown> = {}; try { r = JSON.parse(String(x.flags.recherche ?? "{}")); } catch { r = {}; } r[produkt] = { preis, quelle }; y.flags.recherche = JSON.stringify(r); log(y, "system", `Recherche Preis ${produkt}: ${preis} € (${quelle})`); return { stand: y, meldung: "Recherche gespeichert." }; })} />}
      {modal?.art === "moebel" && <Moebel s={s} onZu={zu}
        onNeu={(id, liefern) => tu((x) => moebelKaufenNeu(x, id, liefern), "mitte")}
        onGebraucht={(a) => tu((x) => moebelKaufenGebraucht(x, a), "mitte")}
        onVerkaufen={(uid) => tu((x) => moebelVerkaufen(x, uid))} />}
      {modal?.art === "ausgehen" && <Ausgehen s={s} onZu={zu} onLos={(ort, g, heim, h) => { setModal(null); tu((x) => ausgehen(x, ort, g, heim, h), "bett"); }} />}
      {modal?.art === "app" && (
        <Fenster titel={APPS.find((a) => a.id === modal.app)!.name} icon={APPS.find((a) => a.id === modal.app)!.icon} onZu={zu} breit>
          {modal.app === "bank" && <BankApp s={s} tu={tu} />}
          {modal.app === "post" && <PostApp s={s} tu={tu} />}
          {modal.app === "ordner" && <OrdnerApp s={s} />}
          {modal.app === "vertraege" && <VertraegeApp s={s} tu={tu} />}
          {modal.app === "amt" && <AmtApp s={s} tu={tu} />}
          {modal.app === "steuer" && <SteuerApp s={s} tu={tu} />}
          {modal.app === "jobs" && <JobApp s={s} tu={tu} />}
          {modal.app === "wohnen" && <WohnungApp s={s} tu={tu} />}
          {modal.app === "recherche" && <RechercheApp s={s} tu={tu} />}
          {modal.app === "tagebuch" && <Tagebuch s={s} />}
          {modal.app === "mobil" && <MobilApp s={s} tu={tu} />}
          {(modal.app === "ich" || modal.app === "notizen") && <IchApp key={modal.app} s={s} tu={tu} start={modal.app === "ich" ? "bogen" : "notizen"} />}
        </Fenster>
      )}
      {modal?.art === "lehrer" && zugang?.code && <LehrerUebersicht code={zugang.code} onZu={zu} />}
      {modal?.art === "stil" && <Stil s={s} tu={tu} onZu={zu} start={modal.start} />}
    </div>
  );
}

const appFrei = (a: App): Frei => (a === "bank" || a === "jobs" ? a : "mehr");

function Mini({ wert }: { wert: number }) {
  const f = wert > 60 ? "bg-emerald-500" : wert > 25 ? "bg-amber-400" : "bg-rose-500";
  return <span className="inline-block h-2 w-12 overflow-hidden rounded-full bg-white/10"><span className={`block h-full ${f}`} style={{ width: `${Math.max(4, wert)}%` }} /></span>;
}
