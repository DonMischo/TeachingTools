"use client";
/**
 * »Ich« — Charakterbogen auf einen Blick (Personalien, Schule, Arbeit, Wohnen,
 * Versicherungen, Geld) und Notizblock mit allem, was noch offen ist, plus
 * eigenen Notizen.
 */
import { useState } from "react";
import { ABSCHLUESSE, BERUF, FAECHER } from "@/lib/leben/berufe";
import { alter, klon } from "@/lib/leben/kern";
import { aktiv, type Ergebnis } from "@/lib/leben/motor";
import { offenePunkte } from "@/lib/leben/notizen";
import type { Spielstand } from "@/lib/leben/typen";
import { ARTEN } from "@/lib/leben/vertraege";
import { warmmiete } from "@/lib/leben/wohnungen";
import { kurzDatum } from "@/lib/leben/zeit";
import { eingabe, euro, Reiter, Zeile } from "./ui";

const JOB_ART: Record<string, string> = {
  ausbildung: "Ausbildung", schulisch: "schulische Ausbildung", helfer: "Helfer·in", freiwillig: "Freiwilligendienst",
  fachkraft: "Fachkraft", wehrdienst: "Wehrdienst", ausland: "Auslandsjahr", eq: "Einstiegsqualifizierung",
};
const WOHNFORM: Record<string, string> = { eltern: "bei den Eltern", wg: "WG-Zimmer", wohnung: "eigene Wohnung", azubiwohnheim: "Azubi-Wohnheim", unterkunft: "Unterkunft" };
const MAX_NOTIZ = 2000;

function Block({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <h3 className="mb-1 text-sm font-black text-amber-300">{titel}</h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function IchApp({ s, tu, start = "bogen" }: { s: Spielstand; tu: (f: (x: Spielstand) => Ergebnis) => void; start?: "bogen" | "notizen" }) {
  const [reiter, setReiter] = useState<"bogen" | "notizen">(start);
  return (
    <div className="space-y-3">
      <Reiter reiter={[{ id: "bogen", name: "🪪 Charakterbogen" }, { id: "notizen", name: "🗒️ Notizblock" }]} aktiv={reiter} onWahl={setReiter} />
      {reiter === "bogen" ? <Bogen s={s} /> : <Notizblock s={s} tu={tu} />}
    </div>
  );
}

function Bogen({ s }: { s: Spielstand }) {
  const f = s.figur;
  const job = s.job;
  const vertraege = s.vertraege.filter((v) => aktiv(s, v));
  const monatlich = vertraege.reduce((summe, v) => summe + (v.jaehrlich ? v.monatlich / 12 : v.monatlich), 0);
  const schulden = s.kredite.reduce((summe, k) => summe + k.rest, 0);
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="charakterbogen">
      <Block titel={`${f.avatar} Personalien`}>
        <Zeile links="Name" rechts={f.name} fett />
        <Zeile links="Geburtstag" rechts={`${f.geburtstag.split("-").reverse().join(".")} (${alter(s)} Jahre)`} />
        <Zeile links="Steuer-ID" rechts={<span className="font-mono">{f.steuerId}</span>} />
        <Zeile links="Sozialversicherungsnr." rechts={<span className="font-mono">{f.svNummer}</span>} />
        <Zeile links="IBAN" rechts={<span className="font-mono text-xs">{f.iban}</span>} />
        <Zeile links="Krankenkasse" rechts={f.krankenkasse ? `${f.krankenkasse} (Zusatzbeitrag ${f.kvZusatz.toLocaleString("de-DE")} %)` : "noch keine gewählt"} />
        <Zeile links="Kirchensteuer" rechts={f.kirche ? "ja" : "nein"} />
      </Block>
      <Block titel="🎓 Schule">
        <Zeile links="Abschluss" rechts={ABSCHLUESSE[s.zeugnis.abschluss]} fett />
        {FAECHER.filter((x) => s.zeugnis.noten[x] !== undefined).map((x) => <Zeile key={x} klein links={x} rechts={s.zeugnis.noten[x]} />)}
      </Block>
      <Block titel="💼 Arbeit">
        {job ? <>
          <Zeile links={JOB_ART[job.art] ?? job.art} rechts={BERUF.get(job.beruf)?.name ?? job.beruf} fett />
          <Zeile links="Betrieb" rechts={job.betrieb} />
          <Zeile links="Seit" rechts={kurzDatum(job.start)} />
          {job.probezeitBis > s.tag && <Zeile links="Probezeit bis" rechts={kurzDatum(job.probezeitBis)} />}
          <Zeile links="Urlaub" rechts={`${job.urlaubstage - job.urlaubGenommen} von ${job.urlaubstage} Tagen übrig`} />
          <Zeile links="Zufriedenheit Betrieb" rechts={`${Math.round(job.leistung)} %`} />
          {job.abmahnungen > 0 && <Zeile links="Abmahnungen" rechts={job.abmahnungen} />}
        </> : <Zeile links="Job" rechts="keiner" />}
        {s.naechsterJob && <Zeile links="Nächster Job" rechts={`${BERUF.get(s.naechsterJob.beruf)?.name ?? s.naechsterJob.beruf} ab ${kurzDatum(s.naechsterJob.start)}`} />}
        {s.jobHistorie.length > 0 && <Zeile klein links="Frühere Jobs" rechts={s.jobHistorie.map((j) => BERUF.get(j.beruf)?.name ?? j.beruf).join(", ")} />}
      </Block>
      <Block titel="🏠 Wohnen">
        <Zeile links="Wohnform" rechts={WOHNFORM[s.wohnung.form] ?? s.wohnung.form} fett />
        {s.wohnung.form !== "eltern" && <>
          <Zeile links="Adresse" rechts={s.wohnung.adresse} />
          <Zeile links="Größe" rechts={`${s.wohnung.qm} m², ${s.wohnung.zimmer} Zimmer`} />
          <Zeile links="Warmmiete" rechts={euro(warmmiete(s.wohnung))} />
          <Zeile links="Eingezogen" rechts={kurzDatum(s.wohnung.einzug)} />
        </>}
        {s.wohnung.kostgeld ? <Zeile links="Kostgeld an die Eltern" rechts={euro(s.wohnung.kostgeld)} /> : null}
        <Zeile links="Wohnsitz angemeldet" rechts={s.flags.angemeldet || s.wohnung.form === "eltern" ? "ja" : "nein"} />
      </Block>
      <Block titel="🛡️ Versicherungen & Verträge">
        {vertraege.length === 0 && <Zeile links="—" rechts="keine" />}
        {vertraege.map((v) => (
          <Zeile key={v.uid} klein links={`${ARTEN[v.art]?.icon ?? "📄"} ${v.name}`} rechts={`${euro(v.monatlich)}${v.jaehrlich ? " / Jahr" : " / Monat"}${v.gekuendigtZum !== undefined ? " · gekündigt" : ""}`} />
        ))}
        {vertraege.length > 0 && <Zeile fett links="Zusammen etwa" rechts={`${euro(monatlich)} / Monat`} />}
      </Block>
      <Block titel="💶 Geld">
        <Zeile links="Girokonto" rechts={euro(s.konto.stand)} fett />
        {s.konto.dispo > 0 && <Zeile klein links="Dispo-Rahmen" rechts={euro(s.konto.dispo)} />}
        <Zeile links="Sparkonto" rechts={euro(s.sparkonto)} />
        <Zeile links="Bargeld" rechts={euro(s.bargeld)} />
        {schulden > 0 && <Zeile links="Schulden (Kredite)" rechts={euro(schulden)} />}
        <Zeile links="Handy" rechts={`${s.handy.modell} (${Math.round(s.handy.zustand)} %)`} />
        <Zeile links="Führerschein / Auto" rechts={s.auto ? `${s.auto.modell}, ${s.auto.baujahr}` : s.fahrschule ? "in der Fahrschule" : "nein"} />
      </Block>
    </div>
  );
}

function Notizblock({ s, tu }: { s: Spielstand; tu: (f: (x: Spielstand) => Ergebnis) => void }) {
  const punkte = offenePunkte(s);
  const [text, setText] = useState(String(s.flags.notizen ?? ""));
  const speichern = (t: string) => tu((x) => { const y = klon(x); if (t.trim()) y.flags.notizen = t.slice(0, MAX_NOTIZ); else delete y.flags.notizen; return { stand: y }; });
  return (
    <div className="space-y-3" data-testid="notizblock">
      <section className="rounded-xl bg-amber-50 p-3 text-slate-900">
        <h3 className="mb-2 font-black">📌 Noch offen</h3>
        {punkte.length === 0 ? <p className="text-sm">Gerade ist nichts offen. 👍</p> : (
          <ul className="space-y-1.5">
            {punkte.map((p, i) => (
              <li key={i} className={`flex gap-2 text-sm ${p.dringend ? "font-bold text-rose-700" : ""}`}>
                <span>{p.icon}</span>
                <span className="flex-1">{p.text}</span>
                {p.wann && <span className="whitespace-nowrap text-xs text-slate-500">{p.wann}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-1 text-sm font-black text-amber-300">✏️ Eigene Notizen</h3>
        <textarea className={`${eingabe} min-h-32`} value={text} maxLength={MAX_NOTIZ} placeholder="z. B. Termin beim Bürgeramt, Fragen an den Ausbilder …"
          onChange={(e) => setText(e.target.value)} onBlur={() => speichern(text)} aria-label="Eigene Notizen" />
        <p className="text-xs text-slate-400">Wird beim Verlassen des Feldes gespeichert. Keine echten Namen oder Daten eintragen.</p>
      </section>
    </div>
  );
}
