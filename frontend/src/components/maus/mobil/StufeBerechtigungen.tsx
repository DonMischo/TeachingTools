"use client";
/**
 * Teil 4 · Berechtigungen: Apps fragen nach Kamera, Mikrofon, Standort,
 * Kontakten, Fotos, Tracking. Jede Frage erscheint wie im echten System —
 * das Kind entscheidet und bekommt erklärt, warum. Zum Schluss nimmt es einem
 * Spiel in den Einstellungen ein Recht wieder weg.
 *
 * Urteile (lib/maus/mobil.ts): »gut« und »ok« lösen, »nochmal« hält ohne
 * Fehler an (z. B. Kamera abgelehnt, aber der Videoanruf braucht sie),
 * »schlecht« zählt als Fehlversuch.
 */
import { useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { ANFRAGEN, RECHT_ENTZIEHEN, geloest, setze, urteilFuer, type Antwort, type Wert } from "@/lib/maus/mobil";
import { useAufgabenStufe } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { DemoBuehne, mitte, useDemo } from "../Demo";
import { EinstellListe, Handy, MobilRahmen, einstellDemo, useHandyEinstellungen } from "./Handy";

export default function StufeBerechtigungen({ avatar, onFertig, onWeiter }: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { handy: system } = useMausKontext();
  const ios = system === "ios";
  const anfragen = ANFRAGEN[system];
  const entziehen = RECHT_ENTZIEHEN[system];
  const anzahl = anfragen.length + 1;
  const { schritt, setSchritt, setFehler, hinweis, setHinweis, fertig, punkte } = useAufgabenStufe("berechtigungen", anzahl, onFertig);
  const [genau, setGenau] = useState(true);
  const [erklaerung, setErklaerung] = useState<{ text: string; gut: boolean } | null>(null);
  const e = useHandyEinstellungen(system);
  const bildschirm = useRef<HTMLDivElement>(null);
  const demo = useDemo(() => e.zurStart());
  const anfrage = anfragen[Math.min(schritt, anfragen.length - 1)];
  const imEinstellen = schritt >= anfragen.length;
  const akzent = ios ? "#007aff" : "#0b57d0";

  function antworten(a: Antwort) {
    if (demo.aktiv || erklaerung?.gut) return;
    const u = urteilFuer(anfrage, a, genau);
    if (u.urteil === "schlecht") setFehler(f => f + 1);
    setErklaerung({ text: u.erklaerung, gut: geloest(u.urteil) });
    setHinweis(geloest(u.urteil) ? { text: u.urteil === "gut" ? "Sehr gut! ⭐" : "Geht in Ordnung. ⭐", gut: true } : { text: u.urteil === "schlecht" ? "Lieber nicht — lies warum." : "Fast — lies den Tipp.", gut: false });
  }

  function naechste() {
    setErklaerung(null);
    setHinweis(null);
    setGenau(true);
    setSchritt(s => s + 1);
  }

  function wert(id: string, w: Wert) {
    if (demo.aktiv || fertig) return;
    const neu = setze(e.werte, id, w);
    e.setWerte(neu);
    if (system === "android" && e.wahl === id) e.setWahl(null);
    if (entziehen.geschafft(neu)) {
      setHinweis({ text: "Recht entzogen! ⭐", gut: true });
      setTimeout(() => setSchritt(s => s + 1), 700);
    }
  }

  function vorfuehren() {
    if (imEinstellen) {
      demo.abspielen(einstellDemo(system, entziehen, () => bildschirm.current, e.oeffne, e.zurStart));
      return;
    }
    demo.abspielen([
      { text: `Erst lesen: Wer fragt? »${anfrage.app}«. Was will die App? Braucht sie das wirklich?`, zu: () => mitte(bildschirm.current?.querySelector("[data-dialog]") ?? null), taste: null },
      ...(anfrage.genau ? [{ text: "Beim Standort: »Genau« ausschalten reicht oft — dann kennt die App nur die Gegend.", zu: () => mitte(bildschirm.current?.querySelector("[data-genau]") ?? null), taste: null }] : []),
      { text: "Dann die passende Antwort antippen. Im Zweifel: ablehnen — erlauben kannst du später immer noch.", taste: null },
    ]);
  }

  const dialog = !imEinstellen && (
    <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 44, background: "#e5e7eb" }}>
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#111] opacity-60">
        <span className="text-5xl">{anfrage.icon}</span>
        <b>{anfrage.app}</b>
      </div>
      <div className="absolute inset-0 bg-[#00000059] flex items-center justify-center p-4">
        <div
          data-dialog
          className={"w-full bg-white text-[#111] shadow-2xl overflow-hidden " + (ios ? "rounded-2xl text-center" : "rounded-[28px] p-5")}
        >
          {ios ? (
            <>
              <div className="p-4 flex flex-col gap-2">
                <span className="text-2xl">{anfrage.icon}</span>
                <b className="text-[15px] leading-snug">{anfrage.frage}</b>
                {anfrage.genau && (
                  <button type="button" data-genau onClick={() => setGenau(g => !g)} className="mx-auto rounded-xl bg-[#e5e7eb] px-3 py-1 text-[12px] font-bold">
                    🗺️ Genau: {genau ? "Ein" : "Aus"}
                  </button>
                )}
              </div>
              <div className="flex flex-col border-t border-[#d1d5db]">
                {anfrage.antworten.map(a => (
                  <button key={a.text} type="button" data-antwort={a.text} onClick={() => antworten(a)} className="py-2.5 text-[15px] border-b border-[#d1d5db] last:border-0" style={{ color: akzent }}>
                    {a.text}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-2xl text-center">{anfrage.icon}</span>
              <b className="text-[16px] leading-snug text-center font-normal">{anfrage.frage}</b>
              {anfrage.genau && (
                <div className="flex gap-2 justify-center" data-genau>
                  {[true, false].map(g => (
                    <button key={String(g)} type="button" aria-pressed={genau === g} onClick={() => setGenau(g)}
                      className="rounded-xl px-3 py-2 text-[12px] font-bold border-2" style={{ borderColor: genau === g ? akzent : "#e5e7eb" }}>
                      {g ? "📍 Genau" : "🗺️ Ungefähr"}
                    </button>
                  ))}
                </div>
              )}
              {anfrage.antworten.map(a => (
                <button key={a.text} type="button" data-antwort={a.text} onClick={() => antworten(a)} className="rounded-full py-2.5 text-[14px] font-bold" style={{ background: "#d3e3fd", color: "#041e49" }}>
                  {a.text}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const telefon = (
    <Handy system={system} bildschirmRef={bildschirm} onHomeLeiste={() => { if (imEinstellen && !demo.aktiv) e.zurStart(); }}>
      {imEinstellen ? (
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
      ) : dialog}
    </Handy>
  );

  return (
    <>
      <MobilRahmen
        titel="🔐 Teil 4 · Berechtigungen"
        avatar={avatar}
        fertig={fertig}
        auftrag={fertig
          ? <>Super! Du entscheidest selbst, was eine App darf — und nimmst Rechte auch wieder weg.</>
          : imEinstellen
            ? <>{entziehen.text}</>
            : <>{anfrage.lage} Was antwortest du?<div data-zusatz className="text-xs text-muted mt-1">💡 Frag dich: Braucht die App das für das, was ich gerade tun will?</div></>}
        punkte={punkte()}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        aufgaben={[...anfragen.map(a => `${a.icon} ${a.app}`), "🛠️ Recht wieder wegnehmen"]}
        schritt={schritt}
        hinweis={hinweis}
        handy={telefon}
        seitenleiste={
          <>
            {erklaerung && (
              <div className={"card p-4 text-sm flex flex-col gap-2 border-2 " + (erklaerung.gut ? "border-ok" : "border-bad")} data-erklaerung>
                <span>{erklaerung.text}</span>
                {erklaerung.gut && <button type="button" onClick={naechste} className="btn-primary px-3 py-1.5 w-fit">Nächste Frage →</button>}
              </div>
            )}
            {imEinstellen && !fertig && <div className="card p-4 text-sm"><b>Warum?</b> {entziehen.warum}</div>}
          </>
        }
      />
      <DemoBuehne demo={demo} />
    </>
  );
}
