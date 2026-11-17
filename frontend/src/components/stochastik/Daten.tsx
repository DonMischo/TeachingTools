"use client";
/**
 * Kl. 5/6: Daten erfassen (Urliste → Strichliste → Häufigkeitstabelle →
 * Rangliste) und Diagramme (dieselben Daten in allen Darstellungen).
 */
import { useEffect, useMemo, useState } from "react";
import { BEISPIELE, WOCHE, type Beispiel } from "@/lib/stochastik/beispiele";
import { haeufigkeiten, rangliste } from "@/lib/stochastik/kenngroessen";
import { prozent, zahl } from "@/lib/stochastik/zahlen";
import { DIA_ARTEN, Diagramm, StrichTabelle, type DiaArt } from "./diagramme";
import { Chips, Kasten, LektionsKopf } from "./ui";

function useBeispiel() {
  const [id, setId] = useState(BEISPIELE[0].id);
  const [eigen, setEigen] = useState("");
  const b: Beispiel = id === "eigen"
    ? { id: "eigen", titel: "✏️ Eigene Daten", frage: "Eigene Urliste", urliste: eigen.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) }
    : BEISPIELE.find(x => x.id === id)!;
  const zahlen = b.zahlen || (b.urliste.length > 0 && b.urliste.every(x => Number.isFinite(Number(x.replace(",", ".")))));
  const kategorien = b.kategorien ?? (zahlen ? rangliste([...new Set(b.urliste.map(x => Number(x.replace(",", "."))))]).map(x => String(x).replace(".", ",")) : undefined);
  const wahl = (
    <div className="flex flex-col gap-2">
      <Chips wahl={id} setze={setId} optionen={[...BEISPIELE.map(x => ({ id: x.id, label: x.titel })), { id: "eigen", label: "✏️ Eigene Daten" }]} />
      {id === "eigen" && (
        <textarea className="input w-full max-w-2xl h-20" placeholder="Antworten durch Komma getrennt, z. B.: rot, blau, rot, grün, blau, rot"
          value={eigen} onChange={e => setEigen(e.target.value)} aria-label="Eigene Urliste" />
      )}
    </div>
  );
  return { b, zahlen, kategorien, wahl };
}

export function Erfassen() {
  const { b, zahlen, kategorien, wahl } = useBeispiel();
  const [gezaehlt, setGezaehlt] = useState(0);
  const [relativ, setRelativ] = useState(false);
  useEffect(() => setGezaehlt(0), [b.id, b.urliste.length]);
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
        <p className="text-sm"><b>{b.frage}</b> <span className="text-muted">({n} Antworten)</span></p>
        <div className="flex flex-wrap gap-1.5" aria-label="Urliste">
          {b.urliste.map((x, i) => (
            <span key={i} className={`rounded-lg px-2 py-1 text-sm border transition-all ${i < gezaehlt ? "line-through opacity-40 border-line" : i === gezaehlt ? "border-line-active bg-surface-hover font-bold scale-110" : "border-line"}`}>{x}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={fertig} onClick={() => setGezaehlt(g => g + 1)}>✏️ Nächste Antwort zählen</button>
          <button className="btn" disabled={fertig} onClick={() => setGezaehlt(n)}>⏩ Alle zählen</button>
          <button className="btn" onClick={() => setGezaehlt(0)}>↺ Von vorn</button>
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
  linie: "Entwicklungen über die Zeit (Temperatur, Wachstum). Für Kategorien ohne Reihenfolge ungeeignet!",
  piktogramm: "anschaulich mit Bildchen, gut für kleine Anzahlen und Plakate.",
  strichliste: "zum Erfassen beim Zählen – kein Diagramm zum Präsentieren, aber der erste Schritt.",
};

export function Diagramme() {
  const { b, kategorien, wahl } = useBeispiel();
  const [art, setArt] = useState<DiaArt>("saeulen");
  const [relativ, setRelativ] = useState(false);
  const [woche, setWoche] = useState(false);
  const zeilen = useMemo(() => (woche ? WOCHE : haeufigkeiten(b.urliste, kategorien)), [woche, b, kategorien]);
  const falsch = art === "linie" && !woche && !b.zahlen;
  return (
    <div className="flex flex-col gap-4">
      <LektionsKopf id="diagramme">
        Dieselben Daten lassen sich ganz verschieden zeigen. Welches Diagramm passt, hängt von der Frage ab: vergleichen, Anteile zeigen oder einen Verlauf.
      </LektionsKopf>
      <div className="card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={woche} onChange={e => setWoche(e.target.checked)} /> 🌡️ Temperaturen einer Woche statt Umfrage</label>
        </div>
        {!woche && wahl}
        <Chips wahl={art} setze={setArt} optionen={DIA_ARTEN} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={relativ} onChange={e => setRelativ(e.target.checked)} /> relative Häufigkeiten (in %)</label>
      </div>
      <div className="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
        <div className="card p-4">
          <Diagramm art={art} zeilen={zeilen} relativ={relativ} titel={woche ? "Mittagstemperatur in °C" : b.frage} />
        </div>
        <div className="flex flex-col gap-3">
          <Kasten art={falsch ? "achtung" : "tipp"} titel={DIA_ARTEN.find(d => d.id === art)!.label}>
            <p>{WOFUER[art]}</p>
            {falsch && <p className="font-bold">Hier verbindet die Linie Kategorien, zwischen denen es nichts gibt – das täuscht einen Verlauf vor.</p>}
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
