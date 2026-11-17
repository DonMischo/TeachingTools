"use client";
/**
 * Kl. 5/6: Daten erfassen (Urliste → Strichliste → Häufigkeitstabelle →
 * Rangliste) und Diagramme (dieselben Daten in allen Darstellungen).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BEISPIELE, type Beispiel } from "@/lib/stochastik/beispiele";
import { haeufigkeiten, rangliste } from "@/lib/stochastik/kenngroessen";
import { prozent, zahl } from "@/lib/stochastik/zahlen";
import { REIHE } from "@/lib/stochastik/zufall";
import { DIA_ARTEN, Diagramm, StrichTabelle, type DiaArt } from "./diagramme";
import { Chips, Kasten, LektionsKopf } from "./ui";

/**
 * Eigene Daten: erst Merkmale anlegen (»Hund«, »Katze« …), dann mit
 * »Fertig« in den Zählmodus und jede Antwort per Klick auf ihr Merkmal
 * zählen. Der Stand gilt für »Daten erfassen« und »Diagramme« zugleich.
 */
type Eigene = { frage: string; merkmale: string[]; urliste: string[]; zaehlen: boolean };
const START: Eigene = { frage: "Was isst du in der Pause am liebsten?", merkmale: ["Brötchen", "Obst", "Müsliriegel"], urliste: [], zaehlen: false };
const EigeneKontext = createContext<{ e: Eigene; setE: (f: (e: Eigene) => Eigene) => void } | null>(null);

export function EigeneDaten({ children }: { children: ReactNode }) {
  const [e, setE0] = useState<Eigene>(START);
  return <EigeneKontext.Provider value={{ e, setE: f => setE0(f) }}>{children}</EigeneKontext.Provider>;
}

function useEigene() {
  const k = useContext(EigeneKontext);
  const [lokal, setLokal] = useState<Eigene>(START);
  return k ?? { e: lokal, setE: (f: (e: Eigene) => Eigene) => setLokal(f) };
}

function EigeneEingabe() {
  const { e, setE } = useEigene();
  const [neu, setNeu] = useState("");
  const dazu = () => {
    const t = neu.trim();
    if (t && !e.merkmale.includes(t)) setE(x => ({ ...x, merkmale: [...x.merkmale, t] }));
    setNeu("");
  };
  if (!e.zaehlen) return (
    <div className="rounded-xl border border-line bg-page p-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm max-w-xl"><span className="text-muted">1 · Frage</span>
        <input className="input" value={e.frage} onChange={ev => setE(x => ({ ...x, frage: ev.target.value }))} /></label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">2 · Mögliche Antworten (Merkmale)</span>
        <div className="flex flex-wrap gap-1.5">
          {e.merkmale.map((m, i) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full pl-3 pr-1 py-1 text-sm font-bold text-white" style={{ background: REIHE[i % REIHE.length] }}>
              {m}
              <button aria-label={`${m} entfernen`} className="rounded-full w-6 h-6 hover:bg-black/20"
                onClick={() => setE(x => ({ ...x, merkmale: x.merkmale.filter(y => y !== m), urliste: x.urliste.filter(y => y !== m) }))}>🗑</button>
            </span>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={ev => { ev.preventDefault(); dazu(); }}>
          <input className="input w-48" placeholder="neues Merkmal" value={neu} onChange={ev => setNeu(ev.target.value)} aria-label="Neues Merkmal" />
          <button className="btn">＋ Hinzufügen</button>
        </form>
      </div>
      <button className="btn btn-primary self-start" disabled={e.merkmale.length < 2} onClick={() => setE(x => ({ ...x, zaehlen: true }))}>
        ✔ Fertig – jetzt zählen
      </button>
      {e.merkmale.length < 2 && <span className="text-xs text-muted">Mindestens zwei Merkmale anlegen.</span>}
    </div>
  );
  return (
    <div className="rounded-xl border border-line bg-page p-3 flex flex-col gap-3">
      <p className="text-sm"><b>{e.frage}</b> – tippe für jede Antwort auf ihr Merkmal.</p>
      <div className="flex flex-wrap gap-2">
        {e.merkmale.map((m, i) => (
          <button key={m} onClick={() => setE(x => ({ ...x, urliste: [...x.urliste, m] }))}
            className="rounded-xl px-4 py-3 text-base font-black text-white shadow-sm active:scale-95 transition-transform"
            style={{ background: REIHE[i % REIHE.length] }}>
            ＋ {m} <span className="ml-1 opacity-80 tabular-nums">{e.urliste.filter(x => x === m).length}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={!e.urliste.length} onClick={() => setE(x => ({ ...x, urliste: x.urliste.slice(0, -1) }))}>↶ Letzte zurück</button>
        <button className="btn" disabled={!e.urliste.length} onClick={() => setE(x => ({ ...x, urliste: [] }))}>↺ Leeren</button>
        <button className="btn" onClick={() => setE(x => ({ ...x, zaehlen: false }))}>✏️ Merkmale ändern</button>
      </div>
    </div>
  );
}

function useBeispiel() {
  const [id, setId] = useState(BEISPIELE[0].id);
  const { e } = useEigene();
  const b: Beispiel = id === "eigen"
    ? { id: "eigen", titel: "✏️ Eigene Daten", frage: e.frage, urliste: e.urliste, kategorien: e.merkmale }
    : BEISPIELE.find(x => x.id === id)!;
  const zahlen = b.zahlen || (id === "eigen" && e.merkmale.length > 0 && e.merkmale.every(x => Number.isFinite(Number(x.replace(",", ".")))));
  const kategorien = b.kategorien ?? (zahlen ? rangliste([...new Set(b.urliste.map(x => Number(x.replace(",", "."))))]).map(x => String(x).replace(".", ",")) : undefined);
  const wahl = (
    <div className="flex flex-col gap-2">
      <Chips wahl={id} setze={setId} optionen={[...BEISPIELE.map(x => ({ id: x.id, label: x.titel })), { id: "eigen", label: "✏️ Eigene Daten" }]} />
      {id === "eigen" && <EigeneEingabe />}
    </div>
  );
  return { b, zahlen, kategorien, wahl, eigen: id === "eigen" };
}

export function Erfassen() {
  const { b, zahlen, kategorien, wahl, eigen } = useBeispiel();
  const [gezaehlt0, setGezaehlt] = useState(0);
  const [relativ, setRelativ] = useState(false);
  useEffect(() => setGezaehlt(0), [b.id]);
  // Eigene Daten werden beim Klicken schon gezählt – da ist alles sofort in der Strichliste.
  const gezaehlt = eigen ? b.urliste.length : gezaehlt0;
  const fertig = gezaehlt >= b.urliste.length;
  const tab = haeufigkeiten(b.urliste.slice(0, gezaehlt).map(x => x.replace(".", ",")), kategorien);
  const n = b.urliste.length;
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="erfassen">
        Wer eine Frage stellt, bekommt zuerst eine ungeordnete <b>Urliste</b>. Mit einer <b>Strichliste</b> zählst du sie aus,
        die <b>Häufigkeitstabelle</b> zeigt die Anzahlen. Die <b>absolute Häufigkeit</b> ist die Anzahl, die <b>relative Häufigkeit</b> der Anteil an allen.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        {wahl}
        {!eigen && <p className="text-sm"><b>{b.frage}</b> <span className="text-muted">({n} Antworten)</span></p>}
        <div className="flex flex-wrap gap-1.5" aria-label="Urliste">
          {b.urliste.map((x, i) => (
            <span key={i} className={`rounded-lg px-2 py-1 text-sm border transition-all ${!eigen && i < gezaehlt ? "line-through opacity-40 border-line" : !eigen && i === gezaehlt ? "border-line-active bg-surface-hover font-bold scale-110" : "border-line"}`}>{x}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {!eigen && <>
            <button className="btn btn-primary" disabled={fertig} onClick={() => setGezaehlt(g => g + 1)}>✏️ Nächste Antwort zählen</button>
            <button className="btn" disabled={fertig} onClick={() => setGezaehlt(n)}>⏩ Alle zählen</button>
            <button className="btn" onClick={() => setGezaehlt(0)}>↺ Von vorn</button>
          </>}
          <label className="flex items-center gap-2 text-sm ml-2"><input type="checkbox" checked={relativ} onChange={e => setRelativ(e.target.checked)} /> relative Häufigkeit zeigen</label>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="card p-4 flex flex-col gap-2">
          <h3 className="font-black">Strichliste und Häufigkeitstabelle</h3>
          <StrichTabelle zeilen={tab} relativ={relativ} />
          {fertig && relativ && <p className="text-xs text-muted">Alle relativen Häufigkeiten zusammen ergeben 1 = 100 %.</p>}
        </div>
        <div className="flex flex-col gap-4">
          {zahlen && (
            <div className="card p-4 flex flex-col gap-2">
              <h3 className="font-black">Rangliste</h3>
              <p className="text-sm text-muted">Zahlen der Größe nach geordnet – so findest du später Minimum, Maximum und Median.</p>
              <p className="font-mono text-sm break-words">{rangliste(b.urliste.map(x => Number(x.replace(",", ".")))).map(x => zahl(x)).join(" · ")}</p>
            </div>
          )}
          <Kasten art="merk" titel="Absolut und relativ">
            <p>absolute Häufigkeit = <b>Anzahl</b>, z. B. {tab[0]?.anzahl ?? 0}-mal »{tab[0]?.wert}«</p>
            <p>relative Häufigkeit = <b>Anzahl : alle</b> = {tab[0]?.anzahl ?? 0} : {Math.max(1, gezaehlt)} {gezaehlt ? `≈ ${prozent((tab[0]?.anzahl ?? 0) / gezaehlt)}` : ""}</p>
            <p className="text-muted">Relative Häufigkeiten kannst du als Bruch, Dezimalzahl oder in Prozent angeben.</p>
          </Kasten>
        </div>
      </div>
    </div>
  );
}

const WOFUER: Record<DiaArt, string> = {
  saeulen: "Werte vergleichen – die Höhe zeigt die Anzahl. Der Klassiker.",
  balken: "wie Säulen, nur liegend – gut bei langen Beschriftungen oder vielen Kategorien.",
  kreis: "Anteile an einem Ganzen. Der Winkel jedes Stücks ist relative Häufigkeit · 360°.",
  ring: "wie der Kreis, mit Platz in der Mitte – modern, Anteile sind gleich gut zu sehen.",
  piktogramm: "anschaulich mit Bildchen, gut für kleine Anzahlen und Plakate.",
  strichliste: "zum Erfassen beim Zählen – kein Diagramm zum Präsentieren, aber der erste Schritt.",
};

export function Diagramme() {
  const { b, kategorien, wahl } = useBeispiel();
  const [art, setArt] = useState<DiaArt>("saeulen");
  const [relativ, setRelativ] = useState(false);
  const zeilen = useMemo(() => haeufigkeiten(b.urliste, kategorien), [b, kategorien]);
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="diagramme">
        Dieselben Daten lassen sich ganz verschieden zeigen. Welches Diagramm passt, hängt von der Frage ab: Werte vergleichen oder Anteile an einem Ganzen zeigen.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        {wahl}
        <Chips wahl={art} setze={setArt} optionen={DIA_ARTEN} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={relativ} onChange={e => setRelativ(e.target.checked)} /> relative Häufigkeiten (in %)</label>
      </div>
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="card p-4">
          <Diagramm art={art} zeilen={zeilen} relativ={relativ} titel={b.frage} />
        </div>
        <div className="flex flex-col gap-3">
          <Kasten art="tipp" titel={DIA_ARTEN.find(d => d.id === art)!.label}>
            <p>{WOFUER[art]}</p>
          </Kasten>
          <Kasten art="so" titel="Ablesen">
            <p>Größter Wert: <b>{[...zeilen].sort((x, y) => y.anzahl - x.anzahl)[0]?.wert}</b> ({[...zeilen].sort((x, y) => y.anzahl - x.anzahl)[0]?.anzahl})</p>
            <p>Kleinster Wert: <b>{[...zeilen].sort((x, y) => x.anzahl - y.anzahl)[0]?.wert}</b> ({[...zeilen].sort((x, y) => x.anzahl - y.anzahl)[0]?.anzahl})</p>
            <p className="text-muted">Achte auf die Achse: Beginnt sie nicht bei 0, wirken Unterschiede größer, als sie sind.</p>
          </Kasten>
        </div>
      </div>
    </div>
  );
}
