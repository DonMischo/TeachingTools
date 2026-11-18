"use client";
/**
 * Teil 4 · Privatsphäre einstellen: in den nachgebauten Einstellungen
 * Displaysperre, Sperrbildschirm-Vorschau, Foto-Standort, Quick Share bzw.
 * AirDrop und Werbe-ID/Tracking selbst finden und umstellen.
 *
 * Der Weg steht nicht im Auftrag — Suchen gehört dazu. Wer nicht weiterkommt,
 * klappt »Wo finde ich das?« auf oder schaut sich die Vorführung an.
 */
import { useEffect, useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { PRIVAT_AUFGABEN, setze, type Wert } from "@/lib/maus/mobil";
import { useAufgabenStufe } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { DemoBuehne, useDemo } from "../Demo";
import { EinstellListe, Handy, MobilRahmen, einstellDemo, useHandyEinstellungen } from "./Handy";

export default function StufePrivatsphaere({ avatar, onFertig, onWeiter }: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { handy: system } = useMausKontext();
  const aufgaben = PRIVAT_AUFGABEN[system];
  const { schritt, setFehler, hinweis, setHinweis, fertig, weiterMit, punkte } = useAufgabenStufe("privatsphaere", aufgaben.length, onFertig);
  const e = useHandyEinstellungen(system);
  const [wegZeigen, setWegZeigen] = useState(false);
  const bildschirm = useRef<HTMLDivElement>(null);
  const demo = useDemo(() => e.zurStart());
  const aufgabe = aufgaben[Math.min(schritt, aufgaben.length - 1)];

  useEffect(() => { setWegZeigen(false); }, [schritt]);

  function wert(id: string, w: Wert) {
    if (demo.aktiv || fertig) return;
    const neu = setze(e.werte, id, w);
    e.setWerte(neu);
    // Android schließt die Auswahl nach dem Tippen, iOS bleibt auf der Seite.
    if (system === "android" && e.wahl === id) e.setWahl(null);
    const schlecht = aufgabe.schlecht?.(id, w);
    if (schlecht) { setFehler(f => f + 1); setHinweis({ text: schlecht, gut: false }); return; }
    if (aufgabe.geschafft(neu)) {
      weiterMit(true, "Geschafft — so ist es sicherer! ⭐");
      setTimeout(() => e.zurStart(), 700);
    }
  }

  const telefon = (
    <Handy system={system} bildschirmRef={bildschirm} onHomeLeiste={() => { if (!demo.aktiv) e.zurStart(); }}>
      <EinstellListe
        system={system}
        seite={e.seite}
        werte={e.werte}
        offeneWahl={e.wahl}
        onSeite={id => { if (!demo.aktiv) e.oeffne(id); }}
        onWahlOeffnen={id => { if (!demo.aktiv) e.setWahl(id); }}
        onWert={wert}
        onZurueck={() => { if (!demo.aktiv) e.zurueck(); }}
        onLeer={t => setHinweis({ text: `In »${t}« ist es nicht.`, gut: false })}
      />
    </Handy>
  );

  return (
    <>
      <MobilRahmen
        titel="🛡️ Teil 4 · Privatsphäre einstellen"
        avatar={avatar}
        fertig={fertig}
        auftrag={fertig
          ? <>Dein {system === "ios" ? "iPhone" : "Handy"} ist jetzt viel besser geschützt — und du weißt, wo du das alles findest!</>
          : <>{aufgabe.text}<div data-zusatz className="text-xs text-muted mt-1">💡 Such es in den Einstellungen.</div></>}
        punkte={punkte()}
        onDemo={() => demo.abspielen(einstellDemo(system, aufgabe, () => bildschirm.current, e.oeffne, e.zurStart))}
        onWeiter={onWeiter}
        aufgaben={aufgaben.map(a => a.text)}
        schritt={schritt}
        hinweis={hinweis}
        handy={telefon}
        seitenleiste={!fertig && (
          <div className="card p-4 text-sm flex flex-col gap-2">
            <div><b>Warum?</b> {aufgabe.warum}</div>
            {wegZeigen
              ? <div data-weg><b>Weg:</b> {aufgabe.weg}</div>
              : <button type="button" onClick={() => setWegZeigen(true)} className="text-left underline text-muted">Wo finde ich das?</button>}
          </div>
        )}
      />
      <DemoBuehne demo={demo} />
    </>
  );
}
