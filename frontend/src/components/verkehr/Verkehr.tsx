"use client";
/**
 * Verkehrssicherheit — zu Fuß durch das Viertel um die Schule in der
 * Eugen-Richter-Straße. Hülle mit Anzeigen; die Bühne selbst ist `Spielfeld`.
 *
 * Mit `zugang` (Code der Sitzung) laufen alle im selben Live-Raum; ohne läuft
 * die Stadt nur in diesem Browser (die Lehrkraft probiert aus, bevor sie den
 * Code herausgibt).
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KARTE, type Untergrund } from "@/lib/verkehr/stadt";
import { GESTEN } from "@/lib/verkehr/gesten";
import { MELDUNGEN, type Meldung, type RegelId } from "@/lib/verkehr/regeln";
import { soloNetz } from "@/lib/verkehr/netz";
import { ERFOLGE, MISSIONEN } from "@/lib/verkehr/missionen";
import { ECHTE_UHR, FAKTOR_MAX, gestellt, mitFaktor, type Abfahrt, type UhrStellung } from "@/lib/verkehr/fahrplan";
import type { SchildArt } from "@/lib/verkehr/schilder";
import { useVerkehrLive, type Zugang } from "./useVerkehrLive";
import { Auftraege, useFortschritt } from "./Auftraege";
import { SchildQuiz } from "./SchildQuiz";
import { Steuerkreuz, type Steuerkanal } from "./Steuerkreuz";
import { LtbHelfer } from "./LtbHelfer";
import { BEGRUESSUNG, Ltb, type LtbAnlass, type LtbOrt } from "@/lib/verkehr/ltb";
import { ZOOM_STUFEN } from "@/lib/verkehr/bewegung";

const Spielfeld = lazy(() => import("./Spielfeld"));

const UNTERGRUND: Record<Untergrund["art"], { text: string; farbe: string; icon: string }> = {
  gehweg: { text: "Gehweg", farbe: "#16a34a", icon: "🚶" },
  fahrbahn: { text: "Fahrbahn — Vorsicht!", farbe: "#dc2626", icon: "⚠️" },
  spielstrasse: { text: "Spielstraße — Autos nur Schritttempo", farbe: "#2563eb", icon: "🏠" },
  radweg: { text: "Radweg", farbe: "#ea580c", icon: "🚲" },
  gleis: { text: "Gleis — Lebensgefahr!", farbe: "#dc2626", icon: "🛤️" },
  bahnsteig: { text: "Bahnsteig", farbe: "#16a34a", icon: "🚉" },
  gelaende: { text: "Gelände", farbe: "#57534e", icon: "🌳" },
  haus: { text: "Haus", farbe: "#57534e", icon: "🏠" },
};

const JACKEN = [0x2f6fd6, 0xe63946, 0x2a9d8f, 0xf4a261, 0x8e44ad, 0xe9c46a, 0x06d6a0, 0xff6b9d];

/** Kurze Namen der Verstöße für die Übersicht der Lehrkraft. */
const KURZ: Partial<Record<RegelId, string>> = {
  rot: "🔴 Rot", nichtGeschaut: "👀 nicht geschaut", umweg: "↪️ Umweg", troedeln: "🐌 gebummelt",
  radweg: "🚲 Radweg", gleis: "🛤️ Gleis", angefahren: "💥 angefahren", beleidigung: "🤬 beleidigt",
  tuerBlockiert: "🚪 Tür blockiert", verdeckt: "🚌 hinter Bus", weisseLinie: "⬜ weiße Linie",
};

/** Uhrzeiten zum Umstellen: Wochentag (1 = Mo) und Minute des Tages; null = echte Zeit. */
const ZEITEN: { name: string; tag: number; minute: number }[] = [
  { name: "🚗 Mo 7:30 Berufsverkehr", tag: 1, minute: 7 * 60 + 30 },
  { name: "☀️ Mi 11:00 Vormittag", tag: 3, minute: 11 * 60 },
  { name: "🚦 Do 16:30 Feierabend", tag: 4, minute: 16 * 60 + 30 },
  { name: "🌆 Fr 19:30 Abend", tag: 5, minute: 19 * 60 + 30 },
  { name: "🌙 Di 22:30 Nacht", tag: 2, minute: 22 * 60 + 30 },
  { name: "🛍️ Sa 10:00 Wochenende", tag: 6, minute: 10 * 60 },
];

/** Versatz in Sekunden, damit die Spieluhr jetzt auf Wochentag/Uhrzeit dieser Woche steht. */
function versatzFuer(tag: number, minute: number): number {
  const jetzt = new Date();
  const ziel = new Date(jetzt);
  ziel.setDate(jetzt.getDate() + (tag - jetzt.getDay()));
  ziel.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return Math.round((ziel.getTime() - jetzt.getTime()) / 1000);
}

function lies<T>(key: string, sonst: T): T {
  try { const v = localStorage.getItem(key); return v === null ? sonst : (JSON.parse(v) as T); } catch { return sonst; }
}
function schreib(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* gesperrt */ }
}

export default function Verkehr({ action, zugang = null, speicherSchluessel = "lokal", konto = false }: {
  action?: ReactNode;
  zugang?: Zugang | null;
  /** Wo der Fortschritt der Aufträge liegt (je Konto bzw. Gast). */
  speicherSchluessel?: string;
  /** Schülerkonto: der Führerschein bringt Hauspunkte. */
  konto?: boolean;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  const [untergrund, setUntergrund] = useState<Untergrund["art"]>("gehweg");
  const [vollbild, setVollbild] = useState(false);
  const [ersatzVollbild, setErsatzVollbild] = useState(false);
  const [punkte, setPunkte] = useState(0);
  const [meldungen, setMeldungen] = useState<(Meldung & { n: number; erfolg?: boolean })[]>([]);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [uhr, setUhr] = useState<{ text: string; abschnitt: string; rush: boolean; dunkel: boolean } | null>(null);
  const [tafel, setTafel] = useState<{ name: string; abfahrten: Abfahrt[] } | null>(null);
  const [ueberblick, setUeberblick] = useState(false);
  const [zoomStufe, setZoomStufe] = useState(0);
  // Näher heran schaltet den Überblick ab; weiter weg als normal öffnet ihn.
  const zoome = (r: 1 | -1) => {
    if (r === 1 && ueberblick) return setUeberblick(false);
    if (r === -1 && zoomStufe === 0) return setUeberblick(true);
    setZoomStufe((z) => Math.max(0, Math.min(ZOOM_STUFEN.length - 1, z + r)));
  };
  const [tonAn, setTonAn] = useState(true);
  const [weste, setWeste] = useState(false);
  const [hilfe, setHilfe] = useState(true);
  const [seite, setSeite] = useState(true);
  const [touch, setTouch] = useState(false);
  const [soloUhr, setSoloUhr] = useState<UhrStellung>(ECHTE_UHR);
  const [uhrTafel, setUhrTafel] = useState(false);
  const [getragen, setGetragen] = useState(0);
  // LTB, der Pinguin: an/aus bleibt im Browser; die Begrüßung läuft einmal je Gerät.
  const [ltbAn, setLtbAn] = useState(true);
  const [ltbText, setLtbText] = useState<string | null>(null);
  const [intro, setIntro] = useState<number | null>(null);
  const ltb = useRef(new Ltb());
  const ltbZeit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zuletztGesagt = useRef(0);
  const zaehler = useRef(0);
  const steuerkanal = useRef<Steuerkanal>({ stick: { x: 0, y: 0 } });
  // Jede Figur eine eigene Jackenfarbe, damit man sich in der Stadt findet.
  const [farbe] = useState(() => JACKEN[Math.floor(Math.random() * JACKEN.length)]);
  const u = UNTERGRUND[untergrund];

  useEffect(() => {
    setLtbAn(lies("hp_verkehr_ltb", true));
    // Läuft die Begrüßung, erklärt LTB die Steuerung — die Hilfe bleibt dann zu.
    if (lies("hp_verkehr_ltb", true) && !lies("hp_verkehr_ltb_intro", false)) { setIntro(0); setHilfe(false); }
    setTonAn(lies("hp_verkehr_ton", true));
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const t = setTimeout(() => setHilfe(false), 10000);
    const fs = () => setVollbild(document.fullscreenElement === huelle.current);
    document.addEventListener("fullscreenchange", fs);
    return () => { clearTimeout(t); document.removeEventListener("fullscreenchange", fs); };
  }, []);

  const live = useVerkehrLive(zugang);
  const soloUhrRef = useRef(soloUhr);
  soloUhrRef.current = soloUhr;
  const solo = useMemo(() => soloNetz(() => soloUhrRef.current), []);
  const netz = zugang ? live.netz : solo;
  const beleidigungen = zugang ? live.beleidigungen : true;
  const darfUhrStellen = !zugang || live.lehrkraft;
  const uhrSt = zugang ? live.uhrStellung : soloUhr;
  const setzeUhr = (st: UhrStellung) => (zugang ? live.setzeUhr(st) : setSoloUhr(st));
  // »Echte Uhrzeit« heißt auch: echtes Tempo.
  const stelleUhr = (v: number | null) => setzeUhr(v === null ? ECHTE_UHR : gestellt(uhrSt, netz.uhr(), v));
  const stelleTempo = (f: number) => setzeUhr(mitFaktor(uhrSt, netz.uhr(), f));

  const zeige = useCallback((m: Meldung & { erfolg?: boolean }) => {
    const n = ++zaehler.current;
    setPunkte((p) => p + m.punkte);
    setMeldungen((alt) => [...alt.slice(-2), { ...m, n }]);
    setTimeout(() => setMeldungen((alt) => alt.filter((x) => x.n !== n)), m.schwer || m.erfolg ? 7000 : 4500);
  }, []);

  const fortschritt = useFortschritt(speicherSchluessel);
  const { buche } = fortschritt;

  /** LTB etwas sagen lassen — er entscheidet selbst, ob es gerade passt. */
  const ltbSag = useCallback((a: LtbAnlass) => {
    if (!ltbAn || intro !== null) return;
    const text = ltb.current.sag(a, performance.now() / 1000);
    if (!text) return;
    zuletztGesagt.current = performance.now();
    setLtbText(text);
    clearTimeout(ltbZeit.current);
    ltbZeit.current = setTimeout(() => setLtbText(null), 9000);
  }, [ltbAn, intro]);

  // Ab und zu ein Tipp, wenn eine Weile nichts war
  useEffect(() => {
    const id = setInterval(() => { if (performance.now() - zuletztGesagt.current > 75_000) ltbSag({ typ: "leerlauf" }); }, 15_000);
    return () => clearInterval(id);
  }, [ltbSag]);

  const onMeldung = useCallback((m: Meldung, t: number) => {
    zeige(m);
    buche({ typ: "meldung", id: m.id, t });
    ltbSag({ typ: "meldung", id: m.id });
  }, [zeige, buche, ltbSag]);

  const onUntergrund = useCallback((art: Untergrund["art"]) => { setUntergrund(art); ltbSag({ typ: "untergrund", art }); }, [ltbSag]);
  // Vorige Werte als Ref: der Tipp kommt nur beim Wechsel, nicht bei jedem Update.
  const vorher = useRef({ tafel: false, dunkel: false, rush: false });
  const onHaltestelle = useCallback((h: { name: string; abfahrten: Abfahrt[] } | null) => {
    if (h && !vorher.current.tafel) ltbSag({ typ: "haltestelle" });
    vorher.current.tafel = !!h;
    setTafel(h);
  }, [ltbSag]);
  const onZeit = useCallback((z: { text: string; abschnitt: string; rush: boolean; dunkel: boolean }) => {
    if (z.dunkel && !vorher.current.dunkel) ltbSag({ typ: "dunkel" });
    if (z.rush && !vorher.current.rush) ltbSag({ typ: "rush" });
    vorher.current.dunkel = z.dunkel;
    vorher.current.rush = z.rush;
    setUhr(z);
  }, [ltbSag]);

  // Gefragt antwortet LTB immer — auch wenn er gerade still sein soll.
  const onFrage = useCallback((ort: LtbOrt) => {
    if (intro !== null) return;
    zuletztGesagt.current = performance.now();
    setLtbText(ltb.current.frag(ort, performance.now() / 1000));
    clearTimeout(ltbZeit.current);
    ltbZeit.current = setTimeout(() => setLtbText(null), 12000);
  }, [intro]);

  const ltbUmschalten = () => {
    const an = !ltbAn;
    schreib("hp_verkehr_ltb", an);
    setLtbAn(an);
    setIntro(an ? 0 : null);
    setLtbText(null);
  };
  const introWeiter = () => {
    if (intro === null) return;
    if (intro + 1 >= BEGRUESSUNG.length) { schreib("hp_verkehr_ltb_intro", true); setIntro(null); } else setIntro(intro + 1);
  };

  // Geschaffte Aufträge und neue Erfolge ansagen
  useEffect(() => {
    for (const id of fortschritt.neu.auftraege) {
      const m = MISSIONEN.find((x) => x.id === id);
      if (m) zeige({ id: "sicherGequert", punkte: 0, text: `✅ Auftrag geschafft: ${m.titel}` });
    }
    for (const id of fortschritt.neu.erfolge) {
      const e = ERFOLGE.find((x) => x.id === id);
      if (e) zeige({ id: "sicherGequert", punkte: 0, erfolg: true, text: `${e.icon} Erfolg: ${e.titel} — ${e.text}` });
    }
  }, [fortschritt.neu, zeige]);

  // Schilder-Quiz: jede Schildart bringt beim ersten richtigen Mal Punkte.
  const [quiz, setQuiz] = useState<SchildArt | null>(null);
  const onAntwort = (richtig: boolean) => {
    if (!quiz) return;
    const neu = richtig && !fortschritt.f.schilder.includes(quiz);
    buche({ typ: "schild", art: quiz, richtig });
    if (neu) { zeige(MELDUNGEN.schildRichtig); netz.sendeMeldung("schildRichtig", MELDUNGEN.schildRichtig.punkte); }
  };

  const zurBuehne = () => (document.querySelector('[aria-label^="Spielfeld"]') as HTMLElement | null)?.focus();

  async function vollbildUmschalten() {
    const el = huelle.current;
    if (!el) return;
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
    if (ersatzVollbild) { setErsatzVollbild(false); return; }
    // iPhones kennen kein Vollbild für Elemente — dann füllt die Hülle das Fenster.
    if (el.requestFullscreen) await el.requestFullscreen().catch(() => setErsatzVollbild(true));
    else setErsatzVollbild(true);
    zurBuehne();
  }
  const gross = vollbild || ersatzVollbild;

  const tonUmschalten = () => { setTonAn((a) => { schreib("hp_verkehr_ton", !a); return !a; }); zurBuehne(); };
  const hudKnopf = "pointer-events-auto flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-900/70 px-2 text-base text-white shadow-lg ring-1 ring-white/15 backdrop-blur hover:bg-slate-800/80";

  const seitenleiste = zugang && live.lehrkraft ? (
    <div className="text-sm">
      <h2 className="font-black mb-2">👩‍🏫 Klasse in der Stadt</h2>
      <label className="flex items-center gap-2 mb-3">
        <input type="checkbox" checked={live.beleidigungen} onChange={(e) => live.setzeBeleidigungen(e.target.checked)} />
        Schimpfen erlauben (🤬 → Polizei)
      </label>
      {live.liste.filter((s) => !s.lehrkraft).length === 0 && (
        <p className="text-[var(--text-muted)]">Noch niemand da. »Zum Mitmachen« zeigt den Code.</p>
      )}
      <ul className="flex flex-col gap-2">
        {[...live.liste].filter((s) => !s.lehrkraft).sort((a, b) => b.punkte - a.punkte).map((s) => (
          <li key={s.key} className="rounded-lg border border-[var(--border)] px-2 py-1">
            <div className="flex justify-between font-bold"><span>{s.name}</span><span>⭐ {s.punkte}</span></div>
            <div className="text-xs text-[var(--text-muted)]">
              {Object.entries(s.verstoesse).map(([id, n]) => `${KURZ[id as RegelId] ?? id} ×${n}`).join(" · ") || "keine Verstöße"}
            </div>
          </li>
        ))}
      </ul>
    </div>
  ) : (
    <Auftraege f={fortschritt.f} neuAnfangen={fortschritt.neuAnfangen} konto={konto} code={zugang?.code}
      onBestanden={() => buche({ typ: "fuehrerschein" })} />
  );

  return (
    <div className={ersatzVollbild ? "fixed inset-0 z-50 flex flex-col bg-slate-950" : "flex flex-col gap-3 p-4"}>
      {!gross && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <h1 className="text-xl font-black">🚦 <span className="text-amber-500">GTA</span> – Ganztagsaufmerksamkeit im Verkehr <span className="font-bold text-[var(--text-muted)]">· zu Fuß</span></h1>
          {zugang && (
            <span className="text-xs text-[var(--text-muted)]" title="Live-Raum">
              {live.connected ? `🟢 ${live.liste.length} in der Stadt` : "🟠 verbinde …"}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">{action}</div>
        </div>
      )}

      <div ref={huelle} className={`relative flex gap-3 ${gross ? "h-full w-full bg-slate-950 p-0" : ""}`}>
        <div className={`relative flex-1 overflow-hidden ${gross ? "" : "h-[calc(100dvh-7rem)] min-h-[440px] rounded-2xl shadow-2xl ring-1 ring-black/20"}`}>
          <Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-900 text-sm text-white/70">🏙️ Stadt wird gebaut …</div>}>
            <Spielfeld netz={netz} farbe={farbe} steuerkanal={steuerkanal} ueberblick={ueberblick} zoomStufe={zoomStufe} onZoom={zoome} tonAn={tonAn}
              onUntergrund={onUntergrund} onMeldung={onMeldung} onHinweis={setHinweis}
              onEreignis={buche} onSchild={setQuiz} onZeit={onZeit} onHaltestelle={onHaltestelle} onWeste={setWeste}
              onTragen={setGetragen} onNaehe={(was) => ltbSag({ typ: "naehe", was })}
              onUeberblick={() => setUeberblick((v) => !v)} onFrage={onFrage} />
          </Suspense>

          {/* Kopfzeile im Bild */}
          <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start gap-2">
            <button type="button" title="Uhrzeit und Zeitraffer"
              className={`pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg ring-1 backdrop-blur hover:bg-slate-800/80 ${uhrTafel ? "ring-amber-400" : "ring-white/15"}`}
              onClick={() => setUhrTafel((v) => !v)}>
              <span className="tabular-nums">{uhr?.dunkel ? "🌙" : "🕒"} {uhr?.text ?? "--:--"}</span>
              {uhr && <span className={`rounded-md px-1.5 text-xs ${uhr.rush ? "bg-amber-500 text-black" : "bg-white/15"}`}>{uhr.abschnitt}</span>}
              {uhrSt.faktor > 1 && <span className="rounded-md bg-sky-500 px-1.5 text-xs text-black">⏩ ×{uhrSt.faktor}</span>}
            </button>
            <div className="rounded-xl px-3 py-1.5 text-sm font-bold text-white shadow-lg ring-1 ring-white/15" style={{ background: u.farbe }}>
              {u.icon} {u.text}
            </div>
            <div className="rounded-xl bg-slate-900/70 px-3 py-1.5 text-sm font-black text-amber-300 shadow-lg ring-1 ring-white/15 backdrop-blur" title="Punkte in dieser Runde">
              ⭐ {punkte}
            </div>
            {weste && <div className="rounded-xl bg-lime-400 px-2 py-1.5 text-sm font-bold text-black shadow-lg">🦺 Weste</div>}
            {getragen > 0 && <div className="rounded-xl bg-emerald-600 px-2 py-1.5 text-sm font-bold text-white shadow-lg" title="Müll in der Hand">🗑️ {getragen}/3</div>}
            <div className="ml-auto flex gap-1.5">
              <button type="button" className={`${hudKnopf} ${ueberblick ? "ring-2 ring-amber-400" : ""}`} title="Überblick: Straßennamen, Abfahrten, Karte (M)"
                onClick={() => { setUeberblick((v) => !v); zurBuehne(); }}>🗺️</button>
              <button type="button" className={`${hudKnopf} ${zoomStufe > 0 && !ueberblick ? "ring-2 ring-amber-400" : ""}`}
                title="Näher heran (+ / − oder Mausrad)"
                onClick={() => { setUeberblick(false); setZoomStufe((z) => (z + 1) % ZOOM_STUFEN.length); zurBuehne(); }}>
                🔍{zoomStufe > 0 && !ueberblick ? <sup className="text-[10px]">{zoomStufe + 1}</sup> : null}
              </button>
              <button type="button" className={hudKnopf} title={tonAn ? "Ton aus" : "Ton an"} onClick={tonUmschalten}>{tonAn ? "🔊" : "🔇"}</button>
              <button type="button" className={`${hudKnopf} ${ltbAn ? "ring-2 ring-sky-400" : "opacity-60"}`} title={ltbAn ? "LTB, den Pinguin, ausschalten" : "LTB, den Pinguin, einschalten"}
                onClick={ltbUmschalten}>🐧</button>
              <button type="button" className={`${hudKnopf} ${touch ? "ring-2 ring-amber-400" : ""}`} title="Steuerung am Bildschirm (Handy/Tablet)"
                onClick={() => setTouch((v) => !v)}>🎮</button>
              <button type="button" className={hudKnopf} title="Hilfe zur Steuerung" onClick={() => setHilfe((v) => !v)}>❔</button>
              <button type="button" className={hudKnopf} title={gross ? "Vollbild verlassen" : "Vollbild"} onClick={vollbildUmschalten}>{gross ? "🗗" : "⛶"}</button>
              <button type="button" className={`${hudKnopf} ${seite ? "ring-2 ring-amber-400" : ""}`} title={seite ? "Seitenleiste einklappen" : "Aufträge zeigen"} onClick={() => setSeite((v) => !v)}>🪪</button>
            </div>
          </div>

          {uhrTafel && (
            <div className="absolute left-2 top-14 z-30 w-72 rounded-xl bg-slate-900/90 px-4 py-3 text-xs text-white shadow-xl ring-1 ring-white/15 backdrop-blur">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-black">🕒 Uhr{zugang ? " für alle" : ""}</span>
                <button type="button" className="underline opacity-80" onClick={() => { setUhrTafel(false); zurBuehne(); }}>schließen</button>
              </div>
              {darfUhrStellen ? (
                <>
                  <label className="block">
                    <span className="font-bold">Uhrzeit:</span>
                    <select className="mt-1 w-full rounded bg-slate-800 px-2 py-1 text-white"
                      value={uhrSt.versatz === 0 && uhrSt.faktor === 1 ? "echt" : ZEITEN.find((z) => Math.abs(versatzFuer(z.tag, z.minute) - uhrSt.versatz) < 3600 * 3)?.name ?? "eigen"}
                      onChange={(e) => {
                        const z = ZEITEN.find((x) => x.name === e.target.value);
                        stelleUhr(z ? versatzFuer(z.tag, z.minute) : null);
                      }}>
                      <option value="echt">🕒 Echte Uhrzeit</option>
                      {ZEITEN.map((z) => <option key={z.name} value={z.name}>{z.name}</option>)}
                      <option value="eigen" disabled hidden>gestellt</option>
                    </select>
                  </label>
                  <div className="mt-3 font-bold">Zeitraffer: ×{uhrSt.faktor}</div>
                  <div className="mt-1 flex gap-1.5">
                    {[1, 2, 5, 10].map((f) => (
                      <button key={f} type="button" onClick={() => stelleTempo(f)}
                        className={`flex-1 rounded px-2 py-1 font-bold ${uhrSt.faktor === f ? "bg-sky-500 text-black" : "bg-slate-700 hover:bg-slate-600"}`}>
                        {f === 1 ? "echt" : `×${f}`}
                      </button>
                    ))}
                  </div>
                  <input type="range" min={1} max={FAKTOR_MAX} step={0.5} value={uhrSt.faktor} aria-label="Zeitraffer stufenlos"
                    className="mt-2 w-full accent-sky-500" onChange={(e) => stelleTempo(Number(e.target.value))} />
                  <div className="mt-1 opacity-70">Schneller laufen Uhr, Tag und Nacht, Berufsverkehr und Fahrplan — Autos und Ampeln bleiben echt schnell.</div>
                </>
              ) : (
                <div className="opacity-80">Die Lehrkraft stellt die Uhr{uhrSt.faktor > 1 ? ` — gerade im Zeitraffer ×${uhrSt.faktor}` : ""}.</div>
              )}
            </div>
          )}

          {hilfe && !uhrTafel && !(ltbAn && intro !== null) && !ltbText && (
            <div className="absolute left-2 top-14 z-10 max-w-xs rounded-xl bg-slate-900/85 px-4 py-3 text-xs leading-relaxed text-white shadow-xl ring-1 ring-white/15 backdrop-blur">
              <div className="mb-1 font-black">Steuerung</div>
              <div><b>Laufen:</b> Pfeiltasten, WASD oder Maus (klicken = hingehen, gedrückt halten = folgen) · <b>Rennen:</b> Umschalt</div>
              <div><b>Umschauen:</b> Leertaste · <b>Taster / Schild:</b> E</div>
              <div><b>Warnweste:</b> V · <b>Überblick:</b> M · <b>Zoom:</b> + / − oder Mausrad · <b>Aussteigen:</b> X oder auf den Bus tippen · <b>LTB fragen:</b> L oder auf den Pinguin klicken · <b>Müll aufheben/einwerfen:</b> E</div>
              <div><b>Gesten:</b> {GESTEN.filter((g) => beleidigungen || !g.beleidigung).map((g) => `${g.taste} ${g.emoji}`).join("  ")}</div>
              <div className="mt-1 opacity-70">Erst ins Bild klicken, dann laufen. Du startest vor der Schule.</div>
              <div className="mt-1 opacity-70">🕒 Uhrzeit und Zeitraffer: oben links auf die Uhr klicken.</div>
              <button type="button" className="mt-2 underline opacity-80" onClick={() => setHilfe(false)}>schließen</button>
            </div>
          )}

          {tafel && (
            <div className="pointer-events-none absolute right-2 top-14 z-10 w-72 rounded-xl bg-black/90 p-3 font-mono text-xs text-amber-400 shadow-2xl ring-1 ring-amber-500/30">
              <div className="mb-1 flex justify-between border-b border-amber-500/30 pb-1 text-amber-300">
                <span className="font-bold">🚏 {tafel.name}</span>
                <span className="tabular-nums">{uhr?.text.split(" ")[1]}</span>
              </div>
              {tafel.abfahrten.length === 0 && <div className="py-1 text-amber-500/80">Heute keine Abfahrten mehr</div>}
              {tafel.abfahrten.map((a, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span className="w-7 rounded bg-amber-400 px-1 text-center font-bold text-black">{a.linie}</span>
                  <span className="flex-1 truncate">{a.ziel}</span>
                  <span className="tabular-nums">{a.inMinuten === 0 ? "jetzt" : `${a.inMinuten} min`}</span>
                </div>
              ))}
              <div className="mt-1 text-[10px] text-amber-500/60">
                {tafel.abfahrten.some((a) => a.echt)
                  ? "Linie 9: EVAG-Fahrplan (ab 17.08.2026), ohne Verspätungen"
                  : "Nach EVAG-Takt gerechnet, nicht der Echtzeit-Fahrplan"}
              </div>
            </div>
          )}

          {ltbAn && intro !== null && (
            <LtbHelfer text={BEGRUESSUNG[intro]} weiter={intro + 1 < BEGRUESSUNG.length ? introWeiter : undefined}
              onZu={() => { schreib("hp_verkehr_ltb_intro", true); setIntro(null); zurBuehne(); }} />
          )}
          {intro === null && ltbText && <LtbHelfer text={ltbText} onZu={() => { setLtbText(null); zurBuehne(); }} />}
          {quiz && <SchildQuiz key={quiz} art={quiz} onAntwort={onAntwort} onZu={() => { setQuiz(null); zurBuehne(); }} />}
          {hinweis && (
            <div className="pointer-events-none absolute bottom-32 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-black shadow-xl">
              {hinweis}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex w-[min(92%,560px)] -translate-x-1/2 flex-col gap-2">
            {meldungen.map((m) => (
              <div key={m.n} role="status"
                className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-xl ring-1 ring-white/20 backdrop-blur ${
                  m.erfolg ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-black"
                    : m.punkte > 0 ? "bg-green-600/95 text-white" : m.schwer ? "bg-red-600/95 text-white" : m.punkte < 0 ? "bg-orange-500/95 text-white" : "bg-slate-800/90 text-white"}`}>
                {m.punkte !== 0 && <span className="mr-2 font-black">{m.punkte > 0 ? `+${m.punkte}` : m.punkte}</span>}{m.text}
              </div>
            ))}
          </div>
          {touch && <Steuerkreuz kanal={steuerkanal} beleidigungen={beleidigungen} />}
          <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-white/80 [text-shadow:0_0_3px_#000]">
            {KARTE.nachweis}
          </div>
        </div>

        {seite && (
          <aside className={`w-72 shrink-0 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg ${
            gross ? "absolute right-3 top-14 bottom-3 z-20 max-h-none w-72 shadow-2xl" : "max-h-[calc(100dvh-7rem)]"} ${touch && !gross ? "hidden lg:block" : ""}`}>
            {seitenleiste}
          </aside>
        )}
      </div>
    </div>
  );
}
