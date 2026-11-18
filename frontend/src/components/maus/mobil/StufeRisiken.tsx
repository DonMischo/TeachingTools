"use client";
/**
 * Teil 4 · Risiken erkennen: zehn Lagen aus dem Alltag mit dem Handy —
 * Fremde im Spiele-Chat, Kettenbrief, Betrugs-SMS, Fake-Gewinnspiel,
 * Glücksbox, Cybermobbing, Passwort, Erpressung, öffentliches Profil, nachts
 * piepende Chats. Aus Sicht des Kindes: Was kann ICH tun?
 *
 * Jede Antwort wird erklärt; eine falsche zählt als Fehlversuch, man darf
 * aber gleich noch einmal wählen. Am Ende steht, wo es Hilfe gibt.
 */
import { useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { HILFE, SZENARIEN } from "@/lib/maus/mobil";
import { useAufgabenStufe } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { DemoBuehne, mitte, useDemo } from "../Demo";
import { Handy, MobilRahmen } from "./Handy";

export default function StufeRisiken({ avatar, onFertig, onWeiter }: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { handy: system } = useMausKontext();
  const ios = system === "ios";
  const { schritt, setSchritt, setFehler, hinweis, setHinweis, fertig, punkte } = useAufgabenStufe("risiken", SZENARIEN.length, onFertig);
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const bildschirm = useRef<HTMLDivElement>(null);
  const antwortenRef = useRef<HTMLDivElement>(null);
  const demo = useDemo();
  const sz = SZENARIEN[Math.min(schritt, SZENARIEN.length - 1)];
  const richtigGewaehlt = gewaehlt !== null && sz.optionen[gewaehlt].gut;

  function waehle(i: number) {
    if (demo.aktiv || richtigGewaehlt) return;
    setGewaehlt(i);
    if (sz.optionen[i].gut) setHinweis({ text: "Richtig! ⭐", gut: true });
    else { setFehler(f => f + 1); setHinweis({ text: "Lieber nicht — lies warum und wähl noch einmal.", gut: false }); }
  }

  function naechste() {
    setGewaehlt(null);
    setHinweis(null);
    setSchritt(s => s + 1);
  }

  const blase = (
    <div className="absolute inset-0 flex flex-col" style={{ paddingTop: 44, background: ios ? "#ffffff" : "#f8fafc", color: "#111" }} data-szenario={sz.id}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e5e7eb]">
        <span className="text-xl">{sz.icon}</span>
        <div className="min-w-0">
          <div className="text-[14px] font-bold truncate">{sz.absender}</div>
          <div className="text-[11px] text-[#6b7280]">{sz.app}</div>
        </div>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-2 overflow-y-auto">
        <div
          data-nachricht
          className="max-w-[85%] px-3 py-2 text-[14px] leading-snug"
          style={{ background: ios ? "#e9e9eb" : "#e8eaed", borderRadius: ios ? 18 : 16 }}
        >
          {sz.nachricht}
        </div>
        {richtigGewaehlt && (
          <div className="self-end max-w-[85%] px-3 py-2 text-[13px] text-white" style={{ background: ios ? "#007aff" : "#0b57d0", borderRadius: 18 }}>
            {sz.optionen[gewaehlt!].text}
          </div>
        )}
      </div>
    </div>
  );

  const telefon = (
    <Handy system={system} bildschirmRef={bildschirm}>
      {fertig ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center bg-[#ecfdf5] text-[#111]" style={{ paddingTop: 44 }}>
          <span className="text-5xl">🦸</span>
          <b>Du erkennst die Fallen!</b>
          <span className="text-[13px]">Und wenn doch mal etwas passiert: Hol dir Hilfe. Das ist mutig, nicht peinlich.</span>
        </div>
      ) : blase}
    </Handy>
  );

  return (
    <>
      <MobilRahmen
        titel="⚠️ Teil 4 · Risiken erkennen"
        avatar={avatar}
        fertig={fertig}
        auftrag={fertig
          ? <>Stark! Du weißt, was du tun kannst, wenn es im Netz unangenehm wird.</>
          : <>Lies die Nachricht auf dem Handy. {sz.frage}<div data-zusatz className="text-xs text-muted mt-1">💡 Stichwort: {sz.stichwort}</div></>}
        punkte={punkte()}
        onDemo={() => demo.abspielen([
          { text: "Erst die Nachricht genau lesen: Wer schreibt? Was will die Person?", zu: () => mitte(bildschirm.current?.querySelector("[data-nachricht]") ?? null), taste: null },
          { text: "Warnzeichen: Druck (»sofort«, »nur heute«), Geschenke, Geheimnisse, Fragen nach Fotos, Geld oder Daten.", taste: null },
          { text: "Dann die Antwort wählen, die dich schützt — und andere auch.", zu: () => mitte(antwortenRef.current), taste: null },
        ])}
        onWeiter={onWeiter}
        aufgaben={SZENARIEN.map(s => s.stichwort)}
        schritt={schritt}
        hinweis={hinweis}
        handy={telefon}
        seitenleiste={fertig ? (
          <div className="card p-4 text-sm flex flex-col gap-2" data-hilfe>
            <b>🆘 Hier bekommst du Hilfe</b>
            {HILFE.map(h => <div key={h.name}><b>{h.name}</b> — {h.text}</div>)}
          </div>
        ) : (
          <div ref={antwortenRef} className="flex flex-col gap-2" role="group" aria-label="Was machst du?">
            {sz.optionen.map((o, i) => {
              const istGewaehlt = gewaehlt === i;
              return (
                <div key={o.text} className="flex flex-col gap-1">
                  <button
                    type="button"
                    data-option={i}
                    onClick={() => waehle(i)}
                    disabled={richtigGewaehlt && !istGewaehlt}
                    className={"text-left rounded-xl border-2 px-3 py-2 text-sm "
                      + (istGewaehlt ? (o.gut ? "border-ok" : "border-bad") : "border-line hover:border-accent")}
                  >
                    {o.text}
                  </button>
                  {istGewaehlt && <p className="text-sm px-1" data-erklaerung>{o.gut ? "✅" : "❌"} {o.erklaerung}</p>}
                </div>
              );
            })}
            {richtigGewaehlt && (
              <button type="button" onClick={naechste} className="btn-primary px-3 py-1.5 w-fit">
                {schritt + 1 < SZENARIEN.length ? "Nächste Nachricht →" : "Fertig →"}
              </button>
            )}
          </div>
        )}
      />
      <DemoBuehne demo={demo} />
    </>
  );
}
