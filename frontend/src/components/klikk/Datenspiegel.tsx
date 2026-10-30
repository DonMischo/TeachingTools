"use client";
/** Der Datenspiegel: was die Woche über dich verraten hat — mit Belegen. */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TAGE, istGewaehlt } from "@/lib/klikk/geschichte";
import { WERBUNG } from "@/lib/klikk/posts";
import { RISIKO_NAME, TRENDS, trendNachId } from "@/lib/klikk/trends";
import { zeit } from "@/lib/klikk/motor";
import { KLIKK_ERFOLGE } from "@/lib/klikk/erfolge";
import { APP_NAME, HILFE_LEITER, epilog, faelle, influencerChance, wocheWerte, abzeichenWahrheit, datenfluesse, erkenntnisse, profilWert, punktestaende, warnsignale } from "@/lib/klikk/profil";
import type { Stand } from "@/lib/klikk/typen";
import type { MausZugang } from "@/lib/api";
import { AuktionSchueler } from "./Werbeauktion";

const BLAETTER = [
  { id: "profil", label: "🪞 Was Klikk weiß" },
  { id: "adkit", label: "🕸️ Wer mitliest" },
  { id: "werbung", label: "🎯 Deine Werbung" },
  { id: "punkte", label: "⚖️ Zwei Punktestände" },
  { id: "trends", label: "📈 Reichweite & Risiko" },
  { id: "signale", label: "🚨 Warnsignale" },
  { id: "faelle", label: "⚖️ Fälle" },
  { id: "erfolge", label: "🏅 Erfolge" },
  { id: "zukunft", label: "🔮 5 Jahre später" },
  { id: "hilfe", label: "🤝 Hilfe" },
  { id: "auktion", label: "🔨 Werbeauktion" },
] as const;
type Blatt = (typeof BLAETTER)[number]["id"];

const wann = (tag: number, uhr: number) => `${TAGE[tag]?.slice(0, 2)} ${zeit(uhr)}`;

export default function Datenspiegel({ s, neu, zugang, perspektive }: { s: Stand; neu: () => void; zugang?: MausZugang; perspektive?: () => void }) {
  const [blatt, setBlatt] = useState<Blatt>("profil");
  // Anonyme Zahlen für die Klassenübersicht der Lehrkraft (keine Namen, keine Inhalte)
  const zCode = zugang?.code, zToken = zugang?.token ?? null;
  useEffect(() => {
    if (zCode) api.klikk.woche({ code: zCode, token: zToken }, wocheWerte(s)).catch(() => {});
  }, [zCode, zToken]); // eslint-disable-line react-hooks/exhaustive-deps
  const [offen, setOffen] = useState<number | null>(null);
  const e = erkenntnisse(s);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-5">
        <h2 className="text-2xl font-black">🪞 Datenspiegel</h2>
        <p className="text-sm text-muted mt-1">
          Eine Woche Klikk, fünf Nachmittage. Alles hier stammt aus dem, was du im Spiel getan hast — gemessen, nicht geraten.
          Diese Daten liegen nur in deinem Browser. Bei echten Apps liegen sie auf deren Servern.
        </p>
      </div>

      <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface">
        {BLAETTER.filter(b => b.id !== "auktion" || zugang).map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{b.label}</button>
        ))}
      </div>

      {blatt === "profil" && (
        <>
          <div className="card p-4 flex flex-wrap gap-4 items-center">
            <span className="text-4xl">👤</span>
            <div className="flex-1 min-w-48">
              <div className="font-black">@{s.name}</div>
              <div className="text-xs text-muted">Werbe-Profil · {e.length} Merkmale · {e.filter(x => x.heikel).length} davon heikel</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black">{profilWert(s).toFixed(2).replace(".", ",")} €</div>
              <div className="text-[11px] text-muted">pro Monat auf dem Werbemarkt (grob geschätzt)</div>
            </div>
          </div>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
            {e.map((x, i) => (
              <button key={x.titel} onClick={() => setOffen(offen === i ? null : i)}
                className={`card p-4 text-left ${x.heikel ? "border-bad" : ""}`}>
                <div className="text-xs text-muted">{x.titel}{x.heikel ? " · ⚠️ heikel" : ""}</div>
                <div className="font-bold mt-1">{x.wert}</div>
                {offen === i
                  ? <ul className="text-xs mt-2 list-disc pl-4 text-muted">{x.belege.map((b, k) => <li key={k}>{b}</li>)}</ul>
                  : <div className="text-[11px] text-muted mt-2 underline">Belege zeigen</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {blatt === "adkit" && <AdKit s={s} />}

      {blatt === "werbung" && (
        <div className="card p-4">
          <p className="text-sm text-muted mb-3">Klikk sagte bei jeder Anzeige: »Basierend auf deinen Aktivitäten.« Das war der echte Grund:</p>
          {s.werbung.length === 0 && <p className="text-sm">Du hast keine Werbung gesehen — du warst kaum im Feed.</p>}
          {s.werbungKlicks.length > 0 && (
            <div className="rounded-xl bg-surface-hover p-3 mb-3 text-sm">
              <b>Angeklickt:</b> {s.werbungKlicks.map(k => `${WERBUNG.find(w => w.id === k.id)?.firma} (${k.stufe === "seite" ? "angesehen" : k.stufe === "kasse" ? "bis zur Kasse" : "»Bestellen« gedrückt"})`).join(" · ")}.
              <span className="text-muted"> Jeder Klick macht dein Profil wertvoller: Klikk weiß jetzt, worauf du anspringst.</span>
            </div>
          )}
          {s.schleich.length > 0 && (
            <div className="rounded-xl bg-surface-hover p-3 mb-3 text-sm">
              <b>Versteckte Werbung:</b> Du hast Beiträge gesehen, für die {s.schleich.join(", ")} bezahlt hat — ohne »Anzeige« oder »Werbung« darüber.
              <span className="text-muted"> In Deutschland muss Werbung gekennzeichnet sein. Rabattcodes, »geschenkt bekommen« und »nicht gesponsert 😉« sind typische Hinweise.</span>
            </div>
          )}
          {[...new Set(s.werbung.map(w => w.id))].map(id => {
            const w = WERBUNG.find(x => x.id === id)!;
            const mal = s.werbung.filter(x => x.id === id);
            return (
              <div key={id} className="border-t border-line first:border-t-0 py-3 flex gap-3">
                <span className="text-3xl">{w.emoji}</span>
                <div>
                  <div className="font-bold">{w.firma} <span className="text-xs text-muted font-normal">· {mal.length}× gesehen, zuerst {wann(mal[0].tag, mal[0].uhr)}</span></div>
                  <div className="text-sm">{w.grund(s)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {blatt === "punkte" && <Punkte s={s} />}
      {blatt === "trends" && <Trends s={s} />}
      {blatt === "signale" && <Signale s={s} />}
      {blatt === "faelle" && <Faelle s={s} />}
      {blatt === "erfolge" && <Erfolge s={s} />}
      {blatt === "zukunft" && <Zukunft s={s} />}
      {blatt === "hilfe" && <Hilfe />}
      {blatt === "auktion" && zugang && <AuktionSchueler zugang={zugang} merkmale={e.map(x => ({ titel: x.titel, wert: x.wert, heikel: !!x.heikel }))} />}

      {perspektive && <button className="btn-primary self-start text-sm" onClick={perspektive}>🔄 Dieselbe Woche als Jonas oder Emma erleben</button>}
      <button className="btn-secondary self-start text-sm" onClick={() => { if (confirm("Alle Daten dieser Woche löschen und neu anfangen?")) neu(); }}>
        🗑 Daten löschen & neue Woche
      </button>
    </div>
  );
}

function AdKit({ s }: { s: Stand }) {
  const fluesse = datenfluesse(s);
  const fremde = fluesse.filter(f => f.an === "AdKit");
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 text-sm">
        <p>
          Wetter, Spiel, Shop und Quiz sahen aus wie vier verschiedene Apps von vier verschiedenen Firmen. Alle hatten dasselbe
          Werbe-Baukastenteil eingebaut: <b>AdKit</b>. AdKit schickt alles an einen Ort und verknüpft es mit deinem Klikk-Profil —
          über die Geräte-ID deines Handys.
        </p>
      </div>
      <svg viewBox="0 0 600 260" className="w-full max-w-2xl card p-2" role="img" aria-label="Datenflüsse von den Apps über AdKit zu Klikk">
        {(["wetter", "candy", "sneakr", "quiz"] as const).map((app, i) => {
          const y = 30 + i * 60;
          const aktiv = fremde.some(f => f.app === app);
          return (
            <g key={app} opacity={aktiv ? 1 : 0.3}>
              <rect x="10" y={y - 18} width="150" height="36" rx="10" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.3" />
              <text x="85" y={y + 5} textAnchor="middle" fontSize="13" fill="currentColor">{APP_NAME[app]}</text>
              <line x1="160" y1={y} x2="250" y2="130" stroke={aktiv ? "#f43f5e" : "currentColor"} strokeWidth={aktiv ? 2.5 : 1} strokeDasharray={aktiv ? "" : "4 4"} />
            </g>
          );
        })}
        <rect x="250" y="105" width="110" height="50" rx="12" fill="#f43f5e" />
        <text x="305" y="135" textAnchor="middle" fontSize="15" fontWeight="bold" fill="#fff">AdKit</text>
        <line x1="360" y1="130" x2="440" y2="130" stroke="#f43f5e" strokeWidth="3" />
        <rect x="440" y="105" width="150" height="50" rx="12" fill="#8b5cf6" />
        <text x="515" y="128" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#fff">Klikk-Profil</text>
        <text x="515" y="145" textAnchor="middle" fontSize="11" fill="#fff">@{s.name}</text>
      </svg>
      {fluesse.map(f => (
        <div key={f.app} className="card p-4">
          <div className="font-bold">{APP_NAME[f.app]} <span className="text-xs text-muted font-normal">→ {f.an}</span></div>
          <ul className="text-xs mt-2 flex flex-col gap-1">
            {f.zeilen.map((z, i) => <li key={i}><span className="text-muted tabular-nums mr-2">{wann(z.tag, z.uhr)}</span>{z.text}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Punkte({ s }: { s: Stand }) {
  const p = punktestaende(s);
  const wahr = abzeichenWahrheit(s);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {([["📱 Was Klikk gezählt hat", p.app], ["🌱 Was das Spiel gezählt hat", p.leben]] as const).map(([titel, zeilen]) => (
          <div key={titel} className="card p-4">
            <h3 className="font-black mb-2">{titel}</h3>
            <table className="w-full text-sm"><tbody>
              {zeilen.map(([k, v]) => <tr key={k} className="border-t border-line first:border-t-0"><td className="py-1.5 text-muted">{k}</td><td className="py-1.5 text-right font-bold">{v}</td></tr>)}
            </tbody></table>
          </div>
        ))}
      </div>
      {wahr.length > 0 && (
        <div className="card p-4">
          <h3 className="font-black mb-2">🏅 Deine Abzeichen — noch mal angesehen</h3>
          {wahr.map(a => (
            <div key={a.name} className="border-t border-line first:border-t-0 py-2 text-sm">
              <b>{a.name}</b> <span className="text-muted">»{a.klikk}«</span>
              <p className="mt-1">{a.wahr}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Trends({ s }: { s: Stand }) {
  const reihen: [string, string, number][] = [
    ...[...TRENDS].sort((a, b) => a.aufrufe - b.aufrufe).map(t => [t.name, RISIKO_NAME[t.risiko], t.aufrufe] as [string, string, number]),
    ["Mos Video (Freitag)", "nach dem Unfall", 48000],
    ...s.videos.map(v => [`Dein Video: ${trendNachId(v.trend)?.name}${v.fake ? " (gefaked)" : ""}`, RISIKO_NAME[trendNachId(v.trend)?.risiko ?? "harmlos"], v.aufrufe] as [string, string, number]),
  ];
  const max = Math.max(...reihen.map(r => r[2]));
  const gleis = istGewaehlt(s, "gleis");
  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm text-muted">Aufrufe der Trends dieser Woche. Je gefährlicher, desto mehr Reichweite — und Klikk hat sie weiter oben im Feed gezeigt.</p>
      {reihen.map(([name, risiko, n]) => (
        <div key={name}>
          <div className="flex justify-between text-sm"><b>{name}</b><span className="text-muted">{risiko} · {n.toLocaleString("de-DE")} Aufrufe</span></div>
          <div className="h-3 rounded-full bg-surface-hover overflow-hidden mt-1"><div className="h-full bg-bad" style={{ width: `${(n / max) * 100}%` }} /></div>
        </div>
      ))}
      <p className="text-sm">
        {gleis === "dabei" ? "Du warst am Bahndamm. Dein Video brachte 340 Follower — und eine Anzeige der Bundespolizei. Das Video läuft weiter, auch wenn du es löschst: andere haben es längst gespeichert."
          : gleis === "stopp" ? "Du hast Mo widersprochen — und Mo hat es sich überlegt. Ein Satz zur richtigen Zeit kann reichen."
          : "Mo war am Bahndamm. Ein gebrochener Arm, eine Anzeige — und ein Video, das bleibt."}
      </p>
      <p className="text-xs text-muted">An Bahngleisen verunglücken jedes Jahr Menschen schwer. Züge sind fast lautlos und brauchen hunderte Meter zum Bremsen; an Oberleitungen reicht schon Nähe für einen lebensgefährlichen Stromschlag.</p>
    </div>
  );
}

function Signale({ s }: { s: Stand }) {
  const sig = warnsignale(s);
  const bemerkt = sig.filter(x => x.bemerkt).length;
  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-sm">Jonas hat die ganze Woche Zeichen gegeben. Niemand hat sie dir gezeigt — du konntest sie nur sehen, wenn du bei ihm nachgeschaut hast.</p>
      <p className="font-black">Bemerkt: {bemerkt} von {sig.length}</p>
      {sig.map(x => (
        <div key={x.id} className="border-t border-line py-2 text-sm flex gap-2">
          <span>{x.bemerkt ? "👁️" : "·"}</span>
          <span className="flex-1">{x.text}</span>
          <span className="text-xs text-muted">{x.bemerkt ? `gesehen ${wann(x.bemerkt.tag, x.bemerkt.uhr)}` : "nicht gesehen"}</span>
        </div>
      ))}
      <p className="text-xs text-muted mt-2">
        Typische Zeichen, dass es jemandem nicht gut geht: zieht sich zurück, löscht Bilder oder Konten, ist nachts online, schreibt »alles egal«,
        fehlt in der Schule. Ein »Alles okay?« ist kein Risiko — Wegschauen schon eher.
      </p>
    </div>
  );
}

function Erfolge({ s }: { s: Stand }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[true, false].map(gut => (
        <div key={String(gut)} className="card p-4">
          <h3 className="font-black mb-1">{gut ? "🏅 Erfolge" : "🌑 Schattenseiten"}</h3>
          <p className="text-xs text-muted mb-2">{gut ? "Was im echten Leben zählt." : "Abzeichen, die eine echte App stolz verleihen würde."}</p>
          {KLIKK_ERFOLGE.filter(e => e.gut === gut).map(e => {
            const ja = e.erreicht(s);
            return (
              <div key={e.id} className={`flex gap-2 py-1.5 border-t border-line text-sm ${ja ? "" : "opacity-40"}`}>
                <span className="text-xl">{e.icon}</span>
                <span><b>{e.name}</b><span className="block text-xs text-muted">{e.text}</span></span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Zukunft({ s }: { s: Stand }) {
  const e = epilog(s);
  const c = influencerChance(s);
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 text-sm">
        <h3 className="font-black text-lg">📨 Bewerbung um einen Ausbildungsplatz – fünf Jahre später</h3>
        <p className="text-muted">Du bist 19. Die Personalabteilung gibt deinen Namen in eine Suchmaschine ein. Das findet sie:</p>
        <ul className="mt-2 flex flex-col gap-1">
          {e.funde.length === 0 && <li>Fast nichts.</li>}
          {e.funde.map((f, i) => <li key={i}>{f.gut ? "✅" : "⚠️"} {f.text}</li>)}
        </ul>
        <p className="mt-3 font-bold">{e.urteil}</p>
      </div>
      <div className="card p-4 text-sm">
        <h3 className="font-black">💰 Und die Influencer-Karriere?</h3>
        <p>Reichweite deiner Woche: <b>{c.reichweite.toLocaleString("de-DE")}</b>. Deine Chance, davon einmal leben zu können: <b>{c.prozent.toFixed(3).replace(".", ",")} %</b>.</p>
        <p className="text-xs text-muted mt-1">Die allermeisten Accounts verdienen nie Geld. Die wenigen, die davon leben, haben meist hunderttausende Follower, ein Team und Jahre Arbeit hinter sich. Marken »bezahlen« Anfänger oft nur mit Produkten.</p>
      </div>
    </div>
  );
}

function Faelle({ s }: { s: Stand }) {
  const farbe = { gut: "border-ok", mittel: "border-amber-500", schlecht: "border-bad" };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Was diese Woche passiert ist, was du getan hast — und was in so einem Fall hilft.</p>
      {faelle(s).map(f => (
        <div key={f.titel} className={`card p-4 border-l-4 ${farbe[f.bilanz]} flex flex-col gap-1 text-sm`}>
          <h3 className="font-black">{f.emoji} {f.titel}</h3>
          <p><b>Was passiert ist:</b> {f.passiert}</p>
          <p><b>Dein Weg:</b> {f.deinWeg}</p>
          <p><b>Wie es ausging:</b> {f.ausgang}</p>
          {f.recht && <p className="text-xs text-muted mt-1">⚖️ {f.recht}</p>}
        </div>
      ))}
      <div className="card p-4 text-sm">
        <h3 className="font-black mb-2">🪜 Was hilft – von leicht bis ernst</h3>
        <ol className="flex flex-col gap-1">{HILFE_LEITER.map(h => <li key={h.stufe}><b>{h.stufe}:</b> {h.text}</li>)}</ol>
      </div>
    </div>
  );
}

function Hilfe() {
  const stellen: [string, string, string][] = [
    ["📞 Nummer gegen Kummer", "116 111", "kostenlos und anonym, Mo–Sa 14–20 Uhr"],
    ["💬 juuuport.de", "Jugendliche helfen Jugendlichen", "bei Mobbing, Stress und Ärger im Netz"],
    ["🛡️ klicksafe.de", "Infos zu Cybermobbing, Datenschutz und Challenges", "auch für Eltern"],
    ["👩‍🏫 Vertrauenslehrkraft / Schulsozialarbeit", "an deiner Schule", "darf nichts weitererzählen, was du nicht willst"],
    ["🚨 Polizei / Onlinewache", "110 oder Onlinewache deines Bundeslandes", "wenn dich jemand erpresst oder bedroht – Anzeige ist auch online möglich"],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 text-sm">
        <h3 className="font-black mb-1">Wenn es dich oder jemanden betrifft</h3>
        <p>Screenshots machen (mit Datum), nicht zurückschlagen, Account melden <i>und</i> einem Erwachsenen zeigen. Melden allein reicht oft nicht — Plattformen lehnen viele Meldungen ab.</p>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
        {stellen.map(([name, was, info]) => (
          <div key={name} className="card p-4"><div className="font-bold">{name}</div><div className="text-sm">{was}</div><div className="text-xs text-muted mt-1">{info}</div></div>
        ))}
      </div>
      <div className="card p-4 text-sm">
        <h3 className="font-black mb-1">Wenn Fremde schreiben</h3>
        <p className="mb-1">Wer schnell Komplimente macht, auf eine andere App wechseln will, »erzähl's nicht deinen Eltern« sagt oder nach Fotos fragt, ist ein Warnsignal — auch wenn das Profil »16« sagt.</p>
        <p>Wenn jemand droht, ein Foto zu verbreiten: nichts mehr schicken, nicht bezahlen, Screenshots machen, einem Erwachsenen zeigen. <b>Schuld hat immer der Erpresser.</b></p>
      </div>
      <div className="card p-4 text-sm">
        <h3 className="font-black mb-1">An deinem echten Handy</h3>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>Einstellungen → Datenschutz: Welche App darf Standort, Kontakte, Mikrofon?</li>
          <li>»App-Tracking« bzw. »Werbe-ID« ausschalten oder zurücksetzen.</li>
          <li>Mitteilungen nur für Menschen, nicht für Apps.</li>
          <li>Nachts: Handy aus dem Zimmer oder Ruhemodus.</li>
          <li>Drittanbietersperre beim Mobilfunkanbieter: dann können »Gewinnspiele« kein Abo über die Handyrechnung abbuchen.</li>
        </ul>
      </div>
    </div>
  );
}
