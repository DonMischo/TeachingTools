"use client";
/**
 * Simulation »Physiklabor« — der Vorbereitungsraum als Werkbank.
 *
 * Links der Schrank, in der Mitte der Tisch, rechts die Einstellungen des
 * angefassten Geräts. Der Aufbau liegt als JSON im Browser (je Konto bzw. je
 * Sitzungscode) und ist damit dieselbe Zeichenkette, die später über einen
 * Beitritts-Code an die Klasse geht.
 *
 * Zwei Modi, weil Umbauen und Ausprobieren sich gegenseitig im Weg standen:
 *
 * - **Bauen**: aufstellen, verbinden, einstellen. Keine Uhr, nichts bewegt
 *   sich, nichts stößt an. Ein Pendelkörper, den man zieht, zeigt nur, wo er
 *   losgelassen wird.
 * - **Versuch**: der Aufbau wird festgehalten, die Anschlüsse verschwinden.
 *   Man greift, was lose ist, löst aus, schaltet um — und kehrt man zum Bauen
 *   zurück, steht alles wieder so da, wie man es aufgebaut hat.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { bogen, formatiere, grad, nachSI } from "@/lib/physik/einheiten";
import { KATALOG, geraetTyp, standardWerte } from "@/lib/physik/katalog";
import { ablageHoehe, ROHRE } from "@/lib/physik/geometrie";
import { ladeSzene, speichereSzene } from "@/lib/physik/speicher";
import { istSchwinger } from "@/lib/physik/mechanik";
import { bericht, bruchBericht, stossBericht, type Marker } from "@/lib/physik/phaenomene";
import { abschuss } from "@/lib/physik/rechenwerke";
import { werkstoff } from "@/lib/physik/material";
import type { LaborZustand } from "@/lib/physik/rechenwerke";
import type { Stoss } from "@/lib/physik/welt";
import { Bericht } from "./Bericht";
import { aufgeloest, bewege, entferne, freierPlatz, haengtIrgendwo, neueSzene, portOrt, stelle, stelleEin, trenne, trenneAlle, trenneAn, treueVon, verketten } from "@/lib/physik/szene";
import type { Bereich, Modelltreue, Szene } from "@/lib/physik/typen";
import Werkbank, { PORT_FARBE } from "./Werkbank";
import { DREHBAR, FREI_DREHBAR } from "./zeichner";
import Oszilloskop from "./Oszilloskop";
import { useSimulation } from "./useSimulation";

const BEREICHE: { id: Bereich; name: string }[] = [
  { id: "aufbau", name: "🧱 Aufbau" },
  { id: "mechanik", name: "⚙️ Mechanik" },
  { id: "strom", name: "🔌 Strom" },
  { id: "optik", name: "🔦 Optik" },
  { id: "wellen", name: "〰️ Wellen" },
  { id: "waerme", name: "🌡️ Wärme" },
  { id: "messen", name: "📐 Messen" },
];

export default function PhysikLabor({ action, speicherSchluessel = "geraet" }: {
  action?: ReactNode;
  /** Wo der Aufbau abgelegt wird — je Konto oder je Sitzungscode. */
  speicherSchluessel?: string;
}) {
  // Der Aufbau traegt mit, zu welchem Speicherplatz er gehoert. Ohne das
  // schreibt der Speicher-Effekt beim ersten Rendern die leere Anfangsszene
  // ueber einen gespeicherten Aufbau — und weil StrictMode zweimal montiert,
  // liest der zweite Ladevorgang genau diese Leere zurueck. Dasselbe beim
  // Wechsel des Schluessels (Gast wird angemeldet): sonst landet der Aufbau
  // des einen Platzes auf dem anderen.
  //
  // `aufbau` ist der beim Versuchsstart festgehaltene Stand. Solange er da
  // ist, läuft ein Versuch: was darin geschieht (ein Geschoss fliegt ab, eine
  // Probe reißt), ändert nur die Arbeitskopie `szene`. Gespeichert wird immer
  // der Aufbau — ein Versuch soll niemandem den Aufbau zerlegen.
  const [stand, setStand] = useState<{ fuer: string | null; szene: Szene; aufbau: Szene | null }>(
    () => ({ fuer: null, szene: neueSzene(), aufbau: null }),
  );
  const szene = stand.szene;
  const versuch = stand.aufbau !== null;
  const setSzene = useCallback((s: Szene | ((alt: Szene) => Szene)) => {
    setStand(alt => ({ ...alt, szene: typeof s === "function" ? s(alt.szene) : s }));
  }, []);
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null);
  const [schwebt, setSchwebt] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(1);
  const [zeitProFeld, setZeitProFeld] = useState(0.2);
  const [marker, setMarker] = useState<Marker[]>([]);
  const [haltBeiStoss, setHaltBeiStoss] = useState(false);
  const [markerWerkzeug, setMarkerWerkzeug] = useState(false);
  const [offenerMarker, setOffenerMarker] = useState<string | null>(null);
  const [schwebenderMarker, setSchwebenderMarker] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [lauf, setLauf] = useState(0);
  // Zwingt die laufende Karte zum Auffrischen, ohne dafür jedes Bild zu rendern.
  const [takt, setTakt] = useState(0);

  /**
   * Ein Zusammenstoß wird festgehalten — und bleibt stehen.
   *
   * Ein Aufprall meldet sich über mehrere Bilder und mehrere Berührpunkte.
   * Damit daraus ein Marker wird und nicht zwanzig, zählt nur der erste in
   * seiner Nachbarschaft; ganz sanftes Aufliegen ist ohnehin kein Ereignis.
   */
  const beiStoss = useCallback((stoesse: Stoss[], stand: LaborZustand) => {
    setMarker(alt => {
      const neu = [...alt];
      for (const stoss of stoesse) {
        if (stoss.wucht < 0.2) continue;
        // Nur innerhalb desselben Durchlaufs zusammenfassen: ein Aufprall
        // meldet sich ueber mehrere Bilder und Beruehrpunkte, daraus soll ein
        // Marker werden. Nach »Messung neu« laeuft alles deterministisch noch
        // einmal ab — gleicher Ort, gleiche Zeit —, und das ist trotzdem ein
        // neues Ereignis.
        const schonDa = neu.some(m => m.art === "stoss" && m.lauf === lauf
          && Math.hypot(m.ort.x - stoss.ort.x, m.ort.y - stoss.ort.y) < 0.1
          && Math.abs(stand.t - m.t) < 0.5);
        if (schonDa) continue;
        neu.push({
          id: `stoss-${lauf}-${Math.round(stand.t * 1000)}-${neu.length}`,
          art: "stoss",
          ort: stoss.ort,
          t: stand.t,
          lauf,
          titel: (stoss.a === "boden" || stoss.b === "boden") ? "💥 Aufschlag" : "💥 Zusammenstoß",
          erklaerung: (stoss.a === "boden" || stoss.b === "boden")
            ? "Unten angekommen: die Lageenergie ist vollständig in Bewegungsenergie übergegangen und beim Aufschlag in Verformung und Wärme. Aus der Aufprallgeschwindigkeit lässt sich zurückrechnen, aus welcher Höhe der Körper gefallen ist."
            : "Beim Aufprall wird Bewegungsenergie in Verformung und Wärme umgesetzt — sie ist danach nicht mehr im Aufbau. Im Schulbuchmodell gäbe es diesen Stoß gar nicht: dort sind die Geräte ideal und gehen hindurch.",
          bericht: stossBericht(szene, stand, [stoss.a, stoss.b], stoss.wucht),
        });
      }
      return neu;
    });
    if (haltBeiStoss) setLaeuft(false);
  }, [szene, haltBeiStoss, lauf]);

  /**
   * Eine Probe reißt.
   *
   * Die Verbindung unter ihr wird gekappt — was daran hing, fällt — und an der
   * Stelle bleibt ein Marker mit der Spannung, bei der es passiert ist. Der
   * Marker trägt eine feste Kennung, damit derselbe Riss nicht zweimal
   * festgehalten wird, falls die Meldung ein Bild zu spät abreißt.
   */
  const reisseDurch = useCallback((
    proben: string[],
    stand: LaborZustand,
    art: "riss" | "schere" | "kerze" = "riss",
  ) => {
    for (const id of proben) {
      const g = szene.geraete.find(x => x.id === id);
      if (!g) continue;
      const ort = portOrt(aufgeloest(szene, stand.mechanik).geraete.find(x => x.id === id)!, "unten",
        stand.mechanik[id]) ?? g.pos;
      const stoff = werkstoff(g.werte.werkstoff ?? 0);
      const markerId = `riss-${id}-${lauf}`;

      setMarker(alt => {
        if (alt.some(m => m.id === markerId)) return alt;
        const kerzeGeht = stoff.brennbar;
        return [...alt, {
          id: markerId, art: "stoss", ort, t: stand.t, lauf,
          titel: art === "schere" ? "✂️ Durchtrennt" : art === "kerze" ? "🕯️ Durchgebrannt" : "💥 Riss",
          erklaerung: art === "riss"
            ? `Die Probe aus ${stoff.name} hat ihre Zugfestigkeit überschritten und ist gerissen. Entscheidend war nicht die Kraft, sondern die Spannung σ = F/A: derselbe Klotz reißt einen dünnen Draht und lässt einen dicken aus demselben Werkstoff kalt.`
            : art === "kerze"
              ? (kerzeGeht
                ? `${stoff.name} schmilzt und brennt durch — die Last fällt, ohne dass je die Zugfestigkeit erreicht war.`
                : `${stoff.name} brennt nicht; hier hat die Flamme den Draht so weit erweicht, dass er die Last nicht mehr trug.`)
              : "Mit der Schere durchtrennt — die Last fällt, unabhängig von der Zugfestigkeit.",
          bericht: bruchBericht(szene, g, stand),
        }];
      });

      setSzene(vorher => trenneAn(vorher, { geraet: id, port: "unten" }));
    }
  }, [szene, lauf]);

  const { bus, zustand, beobachte, loslassen, setzeKoerper, gibTempo, greifbar, greife, ziehe, lasse } =
    useSimulation(szene, versuch, laeuft, tempo, beiStoss, reisseDurch, lauf);

  /** Hält den Aufbau fest und startet den Versuch. */
  const starteVersuch = useCallback(() => {
    setStand(alt => ({ ...alt, aufbau: alt.aufbau ?? alt.szene }));
    setLauf(l => l + 1);
    setLaeuft(true);
    setAuswahl([]);
  }, []);

  /** Derselbe Versuch noch einmal — vom festgehaltenen Aufbau aus. */
  const vonVorn = useCallback(() => {
    setStand(alt => ({ ...alt, szene: alt.aufbau ?? alt.szene }));
    setLauf(l => l + 1);
    setLaeuft(true);
  }, []);

  /** Zurück zum Bauen: alles steht wieder da, wo es aufgebaut war. */
  const zumBauen = useCallback(() => {
    setStand(alt => ({ ...alt, szene: alt.aufbau ?? alt.szene, aufbau: null }));
    setLaeuft(false);
  }, []);

  /**
   * Auslösen.
   *
   * Das Geschoss wird vom Lager gelöst und bekommt sein Tempo; ein Marker hält
   * fest, mit welcher Spannarbeit, welcher Geschwindigkeit und welcher
   * rechnerischen Wurfweite es losging.
   */
  const loeseAus = useCallback((id: string) => {
    const g = szene.geraete.find(x => x.id === id);
    if (!g) return;
    const a = abschuss(szene, g);
    if (!a.geschoss) return;

    // Das Geschoss liegt auf dem Lager und steht damit nur in der aufgelösten
    // Ansicht an der richtigen Stelle. Beim Lösen bekommt es diesen Platz fest
    // eingetragen, sonst spränge es zurück dorthin, wo man es hergezogen hat.
    const dort = aufgeloest(szene, zustand.current.mechanik).geraete.find(x => x.id === a.geschoss!.id);
    let geloest = trenneAn(szene, { geraet: id, port: "lager" });
    if (dort) geloest = bewege(geloest, a.geschoss.id, dort.pos);

    setLaeuft(true);
    setSzene(geloest);
    gibTempo(a.geschoss.id, a.vx, a.vy, geloest);

    const markerId = `abschuss-${id}-${lauf}-${Math.round(zustand.current.t * 1000)}`;
    setMarker(alt => [...alt, {
      id: markerId, art: "stoss", ort: g.pos, t: zustand.current.t, lauf,
      titel: "🏹 Abschuss",
      erklaerung: "Die Spannkraft hat über den Spannweg Arbeit verrichtet, und die steckt jetzt als Bewegungsenergie im Geschoss: ½·m·v² = F·s. Dieselbe Spannung schießt eine leichte Murmel darum viel schneller fort als eine schwere.",
      bericht: bericht(szene, g, zustand.current),
    }]);
  }, [szene, lauf, gibTempo, zustand]);

  // Erst im Browser laden: auf dem Server gibt es kein localStorage.
  useEffect(() => {
    setStand({ fuer: speicherSchluessel, szene: ladeSzene(speicherSchluessel), aufbau: null });
    setLaeuft(false);
  }, [speicherSchluessel]);

  // Gespeichert wird nur, was auch zu diesem Platz geladen wurde.
  useEffect(() => {
    if (stand.fuer !== speicherSchluessel) return;
    speichereSzene(speicherSchluessel, stand.aufbau ?? stand.szene);
  }, [speicherSchluessel, stand]);

  const geraet = useMemo(
    () => szene.geraete.find(g => g.id === ausgewaehlt) ?? null,
    [szene.geraete, ausgewaehlt],
  );
  const typ = geraet ? geraetTyp(geraet.typ) : undefined;

  // Entf entfernt das angefasste Gerät — aber nicht, während jemand tippt.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA")) return;
      // Ein Marker unter dem Zeiger geht vor: er liegt sichtbar obenauf, und
      // wer ihn wegräumen will, meint nicht das Gerät darunter.
      if (schwebenderMarker) {
        e.preventDefault();
        setMarker(alt => alt.filter(m => m.id !== schwebenderMarker));
        if (offenerMarker === schwebenderMarker) setOffenerMarker(null);
        setSchwebenderMarker(null);
        return;
      }

      // Sonst: worüber der Zeiger steht, hat Vorrang — so räumt man mehrere
      // Geräte hintereinander weg, ohne jedes vorher anzuklicken.
      // Im Versuch ist der Aufbau fest — weggeräumt wird im Bauen.
      if (versuch) return;
      const weg = schwebt ?? ausgewaehlt;
      if (!weg) return;
      e.preventDefault();
      setSzene(s => entferne(s, weg));
      if (ausgewaehlt === weg) setAusgewaehlt(null);
      if (schwebt === weg) setSchwebt(null);
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [ausgewaehlt, schwebt, schwebenderMarker, offenerMarker, versuch]);

  const nimm = (t: string) => {
    setSzene(s => {
      // Was von selbst fiele, wird gleich auf den Boden gelegt.
      const ruhe = ablageHoehe(t, standardWerte(t));
      const platz = ruhe === null ? freierPlatz(s) : freierPlatz(s, { x: 0, y: ruhe }, true);
      const neu = stelle(s, t, platz);
      setAusgewaehlt(neu.geraete[neu.geraete.length - 1].id);
      return neu;
    });
  };

  /**
   * Was in der Karte steht.
   *
   * Ein offener Marker geht vor. Hängt er an einem Gerät, holt er seinen
   * Bericht laufend; ein Stoß dagegen zeigt die Momentaufnahme von damals —
   * die Zahlen von jetzt hätten mit dem Ereignis nichts mehr zu tun. Ohne
   * Marker zeigt die Karte das angehaltene, angetippte Gerät.
   */
  const karte = useMemo(() => {
    void takt;
    const offen = marker.find(m => m.id === offenerMarker);
    if (offen) {
      const amGeraet = offen.geraet ? szene.geraete.find(g => g.id === offen.geraet) : undefined;
      return {
        titel: offen.titel,
        hinweis: offen.erklaerung,
        werte: amGeraet ? bericht(szene, amGeraet, zustand.current) : offen.bericht,
        schliessbar: true,
      };
    }
    if (versuch && geraet && typ) {
      return {
        titel: `${typ.icon} ${typ.name}`,
        hinweis: laeuft
          ? "Die Werte laufen mit — anhalten, um einen Augenblick festzuhalten."
          : "Angehalten — das sind die Werte in diesem Augenblick.",
        werte: bericht(szene, geraet, zustand.current),
        schliessbar: false,
      };
    }
    return null;
  }, [marker, offenerMarker, laeuft, geraet, typ, szene, zustand, takt, versuch]);

  // Eine laufende Karte braucht frische Zahlen, aber nicht 60-mal je Sekunde.
  useEffect(() => {
    const laufend = marker.find(m => m.id === offenerMarker)?.geraet ?? (versuch ? ausgewaehlt : null);
    if (!laufend || !laeuft || !versuch) return;
    const uhr = window.setInterval(() => setTakt(x => x + 1), 250);
    return () => window.clearInterval(uhr);
  }, [marker, offenerMarker, laeuft, versuch, ausgewaehlt]);

  const hand = useMemo(() => ({ greifbar, greife, ziehe, lasse }), [greifbar, greife, ziehe, lasse]);

  const verbundenMit = geraet
    ? szene.verbindungen.filter(v => v.von.geraet === geraet.id || v.nach.geraet === geraet.id)
    : [];

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black tracking-tight">🔬 Physiklabor</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1 max-w-2xl">
            Der Vorbereitungsraum als Werkbank: Geräte aus dem Schrank nehmen, hinstellen, verbinden —
            und messen, was dabei herauskommt.
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={szene.titel}
          onChange={e => setSzene(s => ({ ...s, titel: e.target.value }))}
          aria-label="Name des Aufbaus"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-bold min-w-48"
        />
        <Modus versuch={versuch} onBauen={zumBauen} onVersuch={starteVersuch} />
        <Treue wert={szene.treue} gesperrt={versuch} onWechsel={t => setSzene(s => ({ ...s, treue: t }))} />
        {!versuch && (
        <button
          onClick={() => {
            setSzene(s => ({ ...neueSzene(), treue: s.treue }));
            setAusgewaehlt(null);
            setMarker([]);
            setOffenerMarker(null);
            setAuswahl([]);
          }}
          className="rounded-xl border border-[var(--border)] px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >🧹 Tisch abräumen</button>
        )}

        <span className="w-px h-6 bg-[var(--border)] mx-1" />

        {versuch && (
        <>
        <button
          onClick={() => setLaeuft(l => !l)}
          aria-pressed={laeuft}
          className="rounded-xl border border-[var(--border)] px-3 py-2 font-bold"
        >{laeuft ? "⏸️ Anhalten" : "▶️ Laufen"}</button>
        <button
          onClick={vonVorn}
          title="Setzt alles auf den Aufbau zurück und startet den Versuch noch einmal."
          className="rounded-xl border border-[var(--border)] px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)]"
        >⏮️ Von vorn</button>
        </>
        )}
        <button
          onClick={() => setMarkerWerkzeug(w => !w)}
          aria-pressed={markerWerkzeug}
          title="Danach auf ein Gerät tippen — der Marker zeigt dort laufend, was passiert."
          className={`rounded-xl border px-3 py-2 font-bold ${markerWerkzeug
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-[var(--border)] text-[var(--text-muted)]"}`}
        >🔎 Marker setzen</button>
        {versuch && (
        <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <input type="checkbox" checked={haltBeiStoss} onChange={e => setHaltBeiStoss(e.target.checked)} />
          <span title="Hält die Uhr an, sobald sich zwei Dinge berühren — zum Hinsehen.">
            Bei Berührung anhalten
          </span>
        </label>
        )}
        {marker.length > 0 && (
          <button
            onClick={() => { setMarker([]); setOffenerMarker(null); }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text)]"
          >🧹 {marker.length} Marker</button>
        )}
        {versuch && (
        <label className="flex items-center gap-1.5 text-[var(--text-muted)]">
          Tempo
          <select
            value={tempo}
            onChange={e => setTempo(Number(e.target.value))}
            aria-label="Tempo"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
          >
            <option value={0.1}>Zeitlupe (1/10)</option>
            <option value={0.25}>langsam (1/4)</option>
            <option value={1}>echt</option>
            <option value={4}>Zeitraffer (4x)</option>
          </select>
        </label>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[13rem_1fr_16rem] gap-4">
        <Schrank onNimm={nimm} gesperrt={versuch} onBauen={zumBauen} />

        <div
          className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[#0b1220]"
          style={{ height: "min(70vh, 640px)", minHeight: 360 }}
        >
          <Werkbank
            szene={szene} setSzene={setSzene}
            ausgewaehlt={ausgewaehlt} setAusgewaehlt={setAusgewaehlt}
            schwebt={schwebt} setSchwebt={setSchwebt} setzeKoerper={setzeKoerper}
            marker={marker}
            onMarkerKlick={setOffenerMarker}
            markerWerkzeug={markerWerkzeug}
            onMarkerSetzen={(g, ort) => {
              const typName = g ? geraetTyp(szene.geraete.find(x => x.id === g)?.typ ?? "")?.name : null;
              const id = `gesetzt-${Date.now()}`;
              setMarker(alt => [...alt, {
                id, art: "gesetzt", ort, t: zustand.current.t, lauf,
                titel: typName ? `🔎 ${typName}` : "🔎 Beobachtung",
                erklaerung: g
                  ? "Zeigt laufend, was an diesem Gerät gerade passiert."
                  : "An dieser Stelle ist nichts, woran der Marker hängen könnte — zieh ihn auf ein Gerät.",
                bericht: [], geraet: g ?? undefined,
              }]);
              setMarkerWerkzeug(false);
              setOffenerMarker(id);
            }}
            schwebenderMarker={schwebenderMarker} setSchwebenderMarker={setSchwebenderMarker}
            auswahl={auswahl}
            setAuswahl={setAuswahl}
            onVerbinden={ids => { setSzene(s => verketten(s, ids)); setAuswahl([]); }}
            onTrennen={ids => { setSzene(s => trenneAlle(s, ids)); setAuswahl([]); }}
            zustand={zustand} beobachte={beobachte}
            versuch={versuch} hand={hand}
          />
        </div>

        <div className="flex flex-col gap-4 min-w-0">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
          {!geraet || !typ ? (
            <p className="text-sm text-[var(--text-muted)]">
              Nichts ausgewählt. Tippe ein Gerät auf dem Tisch an, um es einzustellen.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{typ.icon}</span>
                <span className="font-black">{typ.name}</span>
              </div>

              {versuch && !typ.parameter.some(p => p.bedienung) && (
                <p className="text-xs text-[var(--text-muted)]">
                  Im Versuch ist der Aufbau fest. Zum Verstellen zurück zu 🛠️ Bauen.
                </p>
              )}

              {typ.parameter.filter(p => !versuch || p.bedienung).map(p => (
                <label key={p.schluessel} className="flex flex-col gap-1 text-sm">
                  <span className="flex justify-between">
                    <span className="text-[var(--text-muted)]">{p.name}</span>
                    <span className="font-bold tabular-nums">
                      {p.optionen
                        ? (p.optionen.find(o => o.wert === (geraet.werte[p.schluessel] ?? p.standard))?.name ?? "—")
                        : formatiere(geraet.werte[p.schluessel] ?? p.standard, p.einheit, p.anzeige)}
                    </span>
                  </span>
                  {p.optionen ? (
                    <select
                      value={geraet.werte[p.schluessel] ?? p.standard}
                      onChange={e => setSzene(s => stelleEin(s, geraet.id, { [p.schluessel]: Number(e.target.value) }))}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
                    >
                      {p.optionen.map(o => <option key={o.wert} value={o.wert}>{o.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type="range"
                      min={p.min} max={p.max} step={(p.max - p.min) / 200}
                      value={geraet.werte[p.schluessel] ?? p.standard}
                      onChange={e => setSzene(s => stelleEin(s, geraet.id, {
                        [p.schluessel]: nachSI(Number(e.target.value), p.einheit),
                      }))}
                      className="accent-[var(--accent)]"
                    />
                  )}
                </label>
              ))}

              {!versuch && (
              <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={geraet.treue !== undefined}
                  onChange={e => setSzene(s => ({
                    ...s,
                    geraete: s.geraete.map(g => g.id === geraet.id
                      ? { ...g, treue: e.target.checked ? treueVon(s, g) : undefined }
                      : g),
                  }))}
                />
                <span className="text-[var(--text-muted)]">Eigene Modelltreue</span>
              </label>
              {geraet.treue !== undefined && (
                <Treue
                  wert={geraet.treue}
                  onWechsel={t => setSzene(s => ({
                    ...s,
                    geraete: s.geraete.map(g => (g.id === geraet.id ? { ...g, treue: t } : g)),
                  }))}
                />
              )}

              {ROHRE.has(geraet.typ) && haengtIrgendwo(szene, geraet) && (
                <p className="text-xs text-[var(--text-muted)]">
                  Eingerastet — die Richtung kommt vom Vorgänger. Schräg stellen lässt es sich
                  nur um den Knick am Eingang.
                </p>
              )}

              {FREI_DREHBAR.has(geraet.typ) && !(ROHRE.has(geraet.typ) && haengtIrgendwo(szene, geraet)) && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-[var(--text-muted)]">
                    Neigung <b className="text-[var(--text)]">{Math.round(grad(geraet.winkel ?? 0))}°</b>
                  </span>
                  <input
                    type="range"
                    min={-180} max={180} step={1}
                    value={Math.round(grad(geraet.winkel ?? 0))}
                    onChange={e => setSzene(s => ({
                      ...s,
                      geraete: s.geraete.map(x => (x.id === geraet.id
                        ? { ...x, winkel: bogen(Number(e.target.value)) } : x)),
                    }))}
                    className="accent-[var(--accent)]"
                  />
                </label>
              )}

              {DREHBAR(geraet.typ) && (
              <button
                onClick={() => setSzene(s => ({
                  ...s,
                  geraete: s.geraete.map(x => (x.id === geraet.id
                    ? { ...x, winkel: ((x.winkel ?? 0) + Math.PI / 2) % (Math.PI * 2) } : x)),
                }))}
                className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--surface-hover)]"
                title="Dreht das Gerät um eine Vierteldrehung — ein Stativ wird damit zum seitlichen Ausleger."
              >↻ Um 90° drehen</button>
              )}
              </>
              )}

              {versuch && geraet.typ === "abschuss" && (
                <button
                  onClick={() => loeseAus(geraet.id)}
                  className="rounded-xl border border-[var(--accent)] text-[var(--accent)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-hover)]"
                  title="Schießt los, was auf dem Lager liegt."
                >🏹 Auslösen</button>
              )}

              {versuch && geraet.typ === "probe" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => reisseDurch([geraet.id], zustand.current, "schere")}
                    className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-hover)]"
                    title="Trennt den Draht durch — die Last fällt."
                  >✂️ Durchschneiden</button>
                  <button
                    onClick={() => reisseDurch([geraet.id], zustand.current, "kerze")}
                    className="flex-1 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-hover)]"
                    title="Hält eine Flamme daran — was schmilzt oder brennt, gibt nach."
                  >🕯️ Durchbrennen</button>
                </div>
              )}

              {versuch && istSchwinger(geraet.typ) && (
                <button
                  onClick={() => { setLaeuft(true); loslassen(geraet.id); }}
                  className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold hover:bg-[var(--surface-hover)]"
                  title="Setzt das Gerät auf seine Startauslenkung und lässt es erneut los."
                >▶️ Loslassen</button>
              )}

              {typ.signale.length > 0 && (
                <div className="text-xs text-[var(--text-muted)]">
                  <div className="font-bold mb-1">Misst</div>
                  {typ.signale.map(s => <div key={s.schluessel}>• {s.name}</div>)}
                </div>
              )}

              {!versuch && verbundenMit.length > 0 && (
                <div className="text-xs">
                  <div className="font-bold mb-1 text-[var(--text-muted)]">Verbunden</div>
                  {verbundenMit.map(v => (
                    <button
                      key={v.id}
                      onClick={() => setSzene(s => trenne(s, v.id))}
                      className="block w-full text-left rounded-lg px-2 py-1 hover:bg-[var(--surface-hover)] text-[var(--text-muted)]"
                    >✂️ {v.von.port} ↔ {v.nach.port}</button>
                  ))}
                </div>
              )}

              {!versuch && (
              <button
                onClick={() => { setSzene(s => entferne(s, geraet.id)); setAusgewaehlt(null); }}
                className="mt-auto rounded-xl border border-rose-400/40 text-rose-300 px-3 py-2 text-sm hover:bg-rose-500/10"
              >🗑️ Wegräumen</button>
              )}
            </>
          )}
        </div>

        {karte && (
          <Bericht
            titel={karte.titel}
            hinweis={karte.hinweis}
            werte={karte.werte}
            onSchliessen={karte.schliessbar ? () => setOffenerMarker(null) : undefined}
          />
        )}
        </div>
      </div>

      <Oszilloskop
        szene={szene}
        bus={bus}
        beobachte={beobachte}
        zeitProFeld={zeitProFeld}
        setZeitProFeld={setZeitProFeld}
      />

      <Legende />
    </div>
  );
}

/**
 * Bauen oder Versuch.
 *
 * Getrennt, weil beides zugleich unbequem war: wer umbauen wollte, dem fiel
 * das halbe Aufgebaute um, und wer zusehen wollte, verschob beim Antippen
 * versehentlich ein Stativ.
 */
function Modus({ versuch, onBauen, onVersuch }: { versuch: boolean; onBauen: () => void; onVersuch: () => void }) {
  const knopf = (aktiv: boolean) => `px-3 py-2 font-bold ${aktiv
    ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
    : "text-[var(--text-muted)] hover:text-[var(--text)]"}`;
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden text-sm" role="group" aria-label="Modus">
      <button
        onClick={onBauen}
        aria-pressed={!versuch}
        title="Aufstellen, verbinden, einstellen — nichts bewegt sich."
        className={knopf(!versuch)}
      >🛠️ Bauen</button>
      <button
        onClick={onVersuch}
        aria-pressed={versuch}
        title="Der Aufbau steht fest, die Uhr läuft. Lose Teile lassen sich greifen, Auslöser bedienen."
        className={knopf(versuch)}
      >🧪 Versuch</button>
    </div>
  );
}

function Treue({ wert, onWechsel, gesperrt = false }: { wert: Modelltreue; onWechsel: (t: Modelltreue) => void; gesperrt?: boolean }) {
  return (
    <div className="inline-flex rounded-xl border border-[var(--border)] overflow-hidden text-sm" role="group" aria-label="Modelltreue">
      {(["ideal", "real"] as const).map(t => (
        <button
          key={t}
          disabled={gesperrt}
          onClick={() => onWechsel(t)}
          aria-pressed={wert === t}
          title={t === "ideal"
            ? "Schulbuch: reibungsfrei, verlustfrei — die Messung bestätigt die Formel."
            : "Mit Reibung, Dämpfung und Innenwiderstand — die Messung weicht ab."}
          className={`px-3 py-2 font-bold disabled:cursor-not-allowed ${wert === t
            ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"}`}
        >{t === "ideal" ? "📘 Schulbuch" : "🔧 Real"}</button>
      ))}
    </div>
  );
}

function Schrank({ onNimm, gesperrt = false, onBauen }: { onNimm: (typ: string) => void; gesperrt?: boolean; onBauen?: () => void }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
      {gesperrt && (
        <div className="rounded-xl bg-[var(--surface-hover)] p-2 text-xs text-[var(--text-muted)]">
          Der Schrank ist zu, solange der Versuch läuft.{" "}
          <button onClick={onBauen} className="font-bold text-[var(--accent)] underline">Zum Bauen</button>
        </div>
      )}
      {BEREICHE.map(b => {
        const geraete = KATALOG.filter(t => t.bereich === b.id);
        if (!geraete.length) return null;
        return (
          <div key={b.id}>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)] mb-1">{b.name}</div>
            <div className="flex flex-col gap-1">
              {geraete.map(t => (
                <button
                  key={t.typ}
                  disabled={gesperrt}
                  onClick={() => onNimm(t.typ)}
                  aria-label={t.name + " auf den Tisch stellen"}
                  className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-left hover:bg-[var(--surface-hover)] disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="text-xl" aria-hidden="true">{t.icon}</span>
                  <span className="font-bold">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Legende() {
  const arten: { art: keyof typeof PORT_FARBE; name: string }[] = [
    { art: "mechanik", name: "Mechanik" },
    { art: "achse", name: "Achse" },
    { art: "strom", name: "Strom" },
    { art: "licht", name: "Licht" },
    { art: "welle", name: "Welle" },
    { art: "waerme", name: "Wärme" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
      <span className="font-bold">Anschlüsse:</span>
      {arten.map(a => (
        <span key={a.art} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: PORT_FARBE[a.art] }} />
          {a.name}
        </span>
      ))}
      <span>— zusammen passt nur, was dieselbe Farbe hat.</span>
    </div>
  );
}
