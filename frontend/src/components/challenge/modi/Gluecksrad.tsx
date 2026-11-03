"use client";
/**
 * Glücksrad (umgedreht): Die Rätselwand verdeckt den Titel der Etappe. Die Fragen stehen offen da;
 * wer eine richtig beantwortet (Fakten legen, »Prüfen« = antworte), deckt ihren Anteil der Buchstaben auf,
 * ein Teiltreffer die Hälfte davon. Erst alle richtigen Antworten zeigen das ganze Wort. Falsche Antworten
 * kosten ein Leben und bringen zwei Teile an den Galgen.
 */
import { useEffect, useMemo, useState } from "react";
import type { ChallengeAntwort } from "@/lib/api";
import { BestenlisteKnopf } from "@/components/challenge/Bestenliste";
import Papierkorb, { WegKnopf } from "@/components/challenge/Papierkorb";
import { aufgedeckt, galgenTeile, istRatbar, maskiere, MUENZEN_JE_STAERKE, verdeckte, verteile } from "@/lib/challenge/gluecksrad";
import { useAblage } from "@/lib/challenge/useAblage";
import { useSpielwert } from "@/lib/challenge/useSpielwert";
import type { ModusProps } from "./typen";
import { Ablage, FaktKarte, Herzen, Frage, Treffermeldung } from "./teile";
import { Buehne, Galgen, GluecksradStil, Moderator } from "./gluecksrad/grafik";

export default function Gluecksrad(props: ModusProps) {
  return <Spiel key={props.brett.etappe} {...props} />;
}

function Spiel({ brett, lauf, zurKarte }: ModusProps) {
  const wort = brett.etappen.find((e) => e.nr === brett.etappe)?.titel || "Glücksrad";
  const anteil = useMemo(() => verteile(wort, brett.challenges.map((c) => c.id)), [wort]); // eslint-disable-line react-hooks/exhaustive-deps
  const [geloest, setGeloest] = useState<string[]>(() => brett.challenges.filter((c) => c.erledigt).map((c) => c.id));
  const [teil, setTeil] = useState<string[]>([]);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [ablage, setAblage] = useState<string[]>([]);
  const [tipp, setTipp] = useState(false);
  const [ergebnis, setErgebnis] = useState<ChallengeAntwort | null>(null);
  const [meldung, setMeldung] = useState("Beantworte die Fragen – jede richtige Antwort deckt Buchstaben auf.");
  const [muenzen, setMuenzen] = useState(0);
  const [sende, setSende] = useState(false);
  const korb = useAblage(brett.etappe);

  const offene = brett.challenges.filter((c) => !geloest.includes(c.id));
  const frage = offene.find((c) => c.id === aktiv) ?? offene[0] ?? null;
  const fakten = new Map(brett.fakten.map((f) => [f.id, f]));
  const offen = aufgedeckt(anteil, geloest, teil);
  const alles = offene.length === 0;
  const maxWert = Math.max(1, Math.round(brett.challenges.reduce((s, c) => s + c.strength, 0) * MUENZEN_JE_STAERKE * 1.5));
  useSpielwert(lauf, "gluecksrad", brett.etappe, Math.min(muenzen, maxWert), maxWert);
  useEffect(() => { if (frage) lauf.waehle(); }, [frage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const waehle = (id: string) => { setAktiv(id); setAblage([]); setTipp(false); setErgebnis(null); };
  const lege = (fid: string) => {
    if (!frage || ablage.includes(fid) || !fakten.has(fid) || korb.istWeg(fid)) return;
    lauf.gelegt();
    setAblage([...ablage, fid]);
  };
  const pruefe = async () => {
    if (!frage || !ablage.length || sende) return;
    setSende(true);
    try {
      const a = await lauf.antworte(frage.id, ablage, tipp);
      setErgebnis(a);
      const neu = anteil[frage.id] ?? [];
      if (a.komplett) {
        const plus = Math.round(frage.strength * MUENZEN_JE_STAERKE * (a.kombo ? 1.5 : 1));
        setGeloest((g) => [...g, frage.id]);
        setMuenzen((m) => m + plus);
        setAktiv(null);
        setMeldung(offene.length === 1 ? `Gelöst! Das Rätselwort: »${wort}« (+${plus} 🪙)`
          : neu.length ? `Richtig! ${neu.length === 1 ? "Ein Buchstabe" : `${neu.length} Buchstaben`} aufgedeckt: ${neu.map((b) => b.toUpperCase()).join(" ")} (+${plus} 🪙)`
          : `Richtig! (+${plus} 🪙)`);
      } else if (a.treffer) {
        setTeil((t) => (t.includes(frage.id) ? t : [...t, frage.id]));
        setMeldung("Teilweise richtig – ein paar Buchstaben zeigen sich. Für den Rest fehlt noch etwas.");
      } else {
        setMeldung(a.zurueck_zur_karte ? "Der Galgen ist voll! Zurück zur Karte – lies nach und versuch es noch einmal." : "Falsch – zwei Teile mehr am Galgen.");
      }
      setAblage([]); setTipp(false);
    } catch { setAblage([]); }
    finally { setSende(false); }
  };

  const wand = maskiere(wort, offen, alles);
  const inventar = brett.fakten.filter((f) => !ablage.includes(f.id) && !korb.istWeg(f.id));

  return (
    <>
      <GluecksradStil />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Herzen leben={brett.leben} />
        <span className="font-bold" aria-live="polite">🪙 {muenzen}</span>
        <div className="flex gap-2">
          <BestenlisteKnopf lauf={lauf} spiel="gluecksrad" rechts />
          <button className="btn-secondary" onClick={zurKarte}>Karte</button>
        </div>
      </div>

      <Buehne>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label="Rätselwand">
              {wand.map((w, i) => (
                <div key={i} className="gl-wort">
                  {w.map((k, j) => (istRatbar(k.zeichen) ? (
                    <span key={j} className="gl-kachel" data-offen={!k.verdeckt} role="img" aria-label={k.verdeckt ? "verdeckt" : k.zeichen}>
                      <span className="gl-hinten" />
                      <span className="gl-vorn">{k.verdeckt ? "" : k.zeichen.toUpperCase()}</span>
                    </span>
                  ) : <span key={j} className="gl-sonder">{k.zeichen}</span>))}
                </div>
              ))}
            </div>
            <p className="text-xs opacity-80">
              {alles ? "Alle Buchstaben aufgedeckt!" : `Noch ${verdeckte(wort, offen)} Buchstaben verdeckt · ${offene.length} ${offene.length === 1 ? "Frage" : "Fragen"} offen`}
            </p>
          </div>
          <Galgen stufe={galgenTeile(brett.leben)} />
        </div>
        <div className="flex items-end gap-2">
          <Moderator />
          <p className="text-sm font-bold flex-1" role="status">{meldung}</p>
        </div>
      </Buehne>

      {brett.challenges.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fragen">
          {brett.challenges.map((c, i) => {
            const fertig = geloest.includes(c.id);
            return (
              <button key={c.id} role="tab" aria-selected={c.id === frage?.id} disabled={fertig || sende}
                className={`btn-secondary ${c.id === frage?.id ? "border-accent" : ""}`} onClick={() => waehle(c.id)}>
                {fertig ? "✅" : "❓"} Frage {i + 1}
              </button>
            );
          })}
        </div>
      )}

      <Treffermeldung antwort={ergebnis} />
      {frage && (
        <>
          <div className="card p-3 flex flex-col gap-2" aria-label="Frage">
            <Frage x={frage} />
            <Ablage karten={ablage.map((fid) => fakten.get(fid)!)} leer="Lege passende Fakten hierher."
              onLege={lege} onNimm={(fid) => setAblage(ablage.filter((x) => x !== fid))} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!ablage.length || sende} onClick={pruefe}>Prüfen</button>
              {frage.tip && (tipp ? <span className="text-muted self-center">💡 {frage.tip}</span>
                : <button className="btn-secondary" onClick={() => setTipp(true)}>💡 Tipp</button>)}
            </div>
          </div>
          <h2 className="font-bold">🎒 Fakten</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2">
            {inventar.map((f) => (
              <div key={f.id} className="flex flex-col">
                <FaktKarte fakt={f} onClick={() => lege(f.id)} />
                <WegKnopf fakt={f} onClick={() => korb.wegwerfen(f.id)} />
              </div>
            ))}
          </div>
          <Papierkorb weg={korb.weg} fakten={brett.fakten} onZurueck={korb.zurueckholen} />
        </>
      )}
    </>
  );
}
