"use client";
/**
 * Lehrkraft-Bereich von Klikk: Klassenübersicht (anonym, erst ab drei),
 * Werbeauktion, eine (Falsch-)Meldung in den Klassen-Feed stellen, Feed
 * moderieren und Karten für die Nachbesprechung (druckbar).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { GALERIE as WELTALL } from "@/lib/sonnensystem/galerie";
import { GALERIE as VULKANE } from "@/lib/vulkan/galerie";
import { AuktionLeitung } from "./Werbeauktion";
import { klassenZiel, zeit } from "@/lib/klikk/motor";
import { nachweis } from "./PostMedien";

const LABEL: Record<string, string> = {
  agb_sekunden: "AGB gelesen (Sekunden)", rechte_erlaubt: "Erlaubte App-Rechte (von 4)",
  mobbing_mitgemacht: "Mitgemacht beim Mobbing (Punkte)", jonas_geschrieben: "Jonas privat geschrieben",
  bus: "Reaktion aufs Bus-Foto", umfrage: "»Loser«-Umfrage", signale_bemerkt: "Warnsignale bemerkt (von 5)",
  emma_foto: "Emmas Foto", gleis: "Mo und das #GleisSelfie", videos_riskant_echt: "Riskante Videos (echt)",
  videos_gefaked: "Gefakte Videos", leon: "Reaktion auf »leon.16«", gewinnspiel_nummer: "Handynummer ans »Gewinnspiel«",
  werbung_geklickt: "Werbung angeklickt", werbung_bestellt: "»Bestellen« gedrückt", fakes_erkannt: "Faktenchecks richtig",
  ungeprueft_geteilt: "Ungeprüft geteilt", schlaf_schnitt: "Schlaf im Schnitt (Std.)", nachts_am_handy: "Nachts am Handy",
  hausaufgaben: "Hausaufgaben gemacht (von 5)", beitraege_gesehen: "Beiträge angesehen", offline_minuten: "Offline-Freizeit (Min.)",
  handy_waehrend_freizeit: "Aufs Handy während Freizeit", gemeine_kommentare_gemeldet: "Gemeine Kommentare gemeldet",
};
const WAHL: Record<string, string> = {
  still: "geschwiegen / nichts", lachen: "mitgelacht", weiter: "weiterverbreitet", stopp: "widersprochen", jonas: "für Jonas gestimmt",
  screenshot: "Lehrkraft informiert", emma: "Emma gewarnt", melden: "gemeldet", dabei: "mitgegangen", ohne: "nicht mitgegangen",
  antworten: "geantwortet", foto: "Foto geschickt", zeigen: "Mama gezeigt", block: "blockiert",
};

const BLAETTER = [
  { id: "uhr", label: "⏱️ Klassen-Uhr" },
  { id: "uebersicht", label: "📊 Klassenübersicht" },
  { id: "auktion", label: "🔨 Werbeauktion" },
  { id: "news", label: "📰 Meldung posten" },
  { id: "feed", label: "🧹 Feed" },
  { id: "karten", label: "🗂️ Nachbesprechung" },
] as const;

export default function Lehrkraft() {
  const [blatt, setBlatt] = useState<(typeof BLAETTER)[number]["id"]>("uhr");
  const { data: sitzung } = useQuery({ queryKey: ["klikk-sitzung"], queryFn: () => api.toolSessions.create("klikk") });
  const code = sitzung?.code;
  return (
    <div className="flex flex-col gap-3">
      <div className="inline-flex flex-wrap self-start rounded-xl border border-line p-1 bg-surface print:hidden">
        {BLAETTER.map(b => (
          <button key={b.id} onClick={() => setBlatt(b.id)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${blatt === b.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>{b.label}</button>
        ))}
      </div>
      {!code ? <div className="card p-4 text-sm text-muted">Lade die Sitzung …</div> : (
        <>
          {blatt === "uhr" && <KlassenUhr code={code} />}
          {blatt === "uebersicht" && <Uebersicht code={code} />}
          {blatt === "auktion" && <AuktionLeitung />}
          {blatt === "news" && <MeldungPosten code={code} />}
          {blatt === "feed" && <FeedModeration code={code} />}
          {blatt === "karten" && <Nachbesprechung />}
        </>
      )}
    </div>
  );
}

function KlassenUhr({ code }: { code: string }) {
  const qc = useQueryClient();
  const [mpt, setMpt] = useState(6);
  const { data } = useQuery({ queryKey: ["klikk-uhr", code], queryFn: () => api.klikk.uhr({ code, token: null }), refetchInterval: 2000 });
  const steuern = useMutation({
    mutationFn: (aktion: "start" | "pause" | "weiter" | "stopp") => api.klikk.uhrSteuern(code, aktion, mpt),
    onSuccess: u => qc.setQueryData(["klikk-uhr", code], u),
  });
  const z = data?.laeuft && data.start_ms ? klassenZiel((data.pausiert_ms ?? data.jetzt_ms) - data.start_ms, data.minuten_pro_tag) : null;
  return (
    <div className="card p-4 flex flex-col gap-3 max-w-2xl text-sm">
      <p>Im Klassenmodus läuft die Spielzeit für alle gleich: ein Tag von 6 bis 24 Uhr dauert wenige echte Minuten. Handlungen kosten keine Spielzeit mehr – nur noch echte. So entsteht der Druck, <i>jetzt</i> nachzusehen.</p>
      <div className="flex items-center gap-2 flex-wrap">
        Minuten pro Spieltag:
        {[4, 6, 8, 10].map(m => <button key={m} disabled={!!data?.laeuft} onClick={() => setMpt(m)} className={`rounded-full px-3 py-1 border border-line ${mpt === m ? "bg-accent text-accent-fg" : ""}`}>{m}</button>)}
        <span className="text-xs text-muted">(5 Tage ≈ {mpt * 5} Min.)</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {!data?.laeuft && <button className="btn-primary" onClick={() => steuern.mutate("start")}>▶ Woche starten</button>}
        {data?.laeuft && !data.pausiert && <button className="btn-secondary" onClick={() => steuern.mutate("pause")}>⏸ Pause</button>}
        {data?.laeuft && data.pausiert && <button className="btn-primary" onClick={() => steuern.mutate("weiter")}>▶ Weiter</button>}
        {data?.laeuft && <button className="btn-secondary" onClick={() => { if (confirm("Klassen-Uhr stoppen? Alle spielen dann wieder im eigenen Tempo.")) steuern.mutate("stopp"); }}>⏹ Stopp</button>}
      </div>
      {z && (
        <div className="text-3xl font-black">
          {z.tag > 4 ? "Woche vorbei" : `${["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"][z.tag]}, ${zeit(z.uhr)}`}
          {data?.pausiert && <span className="text-sm font-normal text-muted"> (pausiert)</span>}
        </div>
      )}
      <p className="text-xs text-muted">Wer später einsteigt, springt zur aktuellen Klassenzeit (Nachrichten der verpassten Tage sind da, ungelesen).</p>
    </div>
  );
}

function Uebersicht({ code }: { code: string }) {
  const { data } = useQuery({ queryKey: ["klikk-uebersicht", code], queryFn: () => api.klikk.uebersicht(code), refetchInterval: 10000 });
  if (!data) return <div className="card p-4 text-sm text-muted">Lade …</div>;
  if (data.anzahl < 3) return (
    <div className="card p-4 text-sm">
      <b>{data.anzahl} von mindestens 3 Wochen abgegeben.</b>
      <p className="text-muted mt-1">Damit niemand erkennbar ist, erscheinen Zahlen erst ab drei. Eine Woche zählt, sobald jemand den Datenspiegel erreicht (Sitzung über Code/QR).</p>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4 text-sm"><b>{data.anzahl} Schüler·innen</b> haben die Woche beendet. Alle Zahlen sind anonym zusammengefasst.</div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
        {Object.entries(data.werte).map(([k, w]) => (
          <div key={k} className="card p-3 text-sm">
            <div className="text-xs text-muted">{LABEL[k] ?? k}</div>
            {w.art === "ja" && <><div className="text-2xl font-black">{Math.round((w.ja / w.von) * 100)} %</div><div className="text-xs text-muted">{w.ja} von {w.von}</div></>}
            {w.art === "zahl" && <><div className="text-2xl font-black">Ø {String(w.schnitt).replace(".", ",")}</div><div className="text-xs text-muted">von {w.min} bis {w.max}</div></>}
            {w.art === "wahl" && (
              <div className="flex flex-col gap-1 mt-1">
                {Object.entries(w.zaehlung).sort((a, b) => b[1] - a[1]).map(([wahl, n]) => {
                  const gesamt = Object.values(w.zaehlung).reduce((a, b) => a + b, 0);
                  return (
                    <div key={wahl}>
                      <div className="flex justify-between text-xs"><span>{WAHL[wahl] ?? wahl}</span><span>{n}</span></div>
                      <div className="h-1.5 bg-surface-hover rounded"><div className="h-1.5 bg-accent rounded" style={{ width: `${(n / gesamt) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const BILDER = [
  ...WELTALL.slice(0, 14).map(b => ({ id: `weltall:${b.id}`, titel: `🪐 ${b.titel}` })),
  ...VULKANE.slice(0, 14).map(b => ({ id: `vulkan:${b.id}`, titel: `🌋 ${b.titel}` })),
];

/** Ein eigenes Bild im Browser verkleinern (längste Seite 900 px, JPEG) — so passt es direkt in den Beitrag. */
function verkleinern(datei: File): Promise<string> {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Das Bild ließ sich nicht lesen.")); };
    img.src = url;
  });
}

function MeldungPosten({ code }: { code: string }) {
  const [schlagzeile, setSchlagzeile] = useState("");
  const [unterzeile, setUnterzeile] = useState("");
  const [bild, setBild] = useState(BILDER[0]?.id ?? "");
  const [eigenesBild, setEigenesBild] = useState<string | null>(null);
  const [bildFehler, setBildFehler] = useState<string | null>(null);
  const [fake, setFake] = useState(true);
  const [ok, setOk] = useState(false);
  const posten = useMutation({
    mutationFn: () => api.klikk.posten({ code, token: null }, {
      name: "", art: "news", tag: 0, schlagzeile, unterzeile, fake,
      ...(eigenesBild ? { bild_daten: eigenesBild } : { bild }),
    }),
    onSuccess: () => { setOk(true); setSchlagzeile(""); setUnterzeile(""); setEigenesBild(null); },
  });
  const [quelle, id] = bild.split(":");
  const n = quelle === "weltall" || quelle === "vulkan" ? nachweis({ art: "foto", quelle, id }) : undefined;
  return (
    <div className="card p-4 flex flex-col gap-3 max-w-2xl">
      <p className="text-sm">Eine Meldung erscheint bei allen in der Sitzung als nächster Beitrag im Feed – mit Faktencheck-Knopf. Echte Bilder mit erfundener Geschichte sind der häufigste Fake-Trick.</p>
      <label className="text-sm">Schlagzeile<input className="input w-full mt-1" maxLength={120} value={schlagzeile} onChange={e => setSchlagzeile(e.target.value)} placeholder="z. B. Ab Montag Handyverbot an allen Schulen!" /></label>
      <label className="text-sm">Unterzeile<textarea className="input w-full mt-1" maxLength={300} rows={2} value={unterzeile} onChange={e => setUnterzeile(e.target.value)} /></label>
      <label className="text-sm">Bild aus den Galerien
        <select className="input w-full mt-1" value={bild} disabled={!!eigenesBild} onChange={e => setBild(e.target.value)}>
          {BILDER.map(b => <option key={b.id} value={b.id}>{b.titel}</option>)}
        </select>
      </label>
      <label className="text-sm">… oder ein eigenes Bild
        <input type="file" accept="image/jpeg,image/png,image/webp" className="block mt-1 text-sm"
          onChange={async e => {
            const datei = e.target.files?.[0];
            setBildFehler(null);
            if (!datei) return;
            try { setEigenesBild(await verkleinern(datei)); } catch (err) { setBildFehler((err as Error).message); }
          }} />
      </label>
      {bildFehler && <p className="text-sm text-bad">{bildFehler}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {eigenesBild ? <img src={eigenesBild} alt="" className="h-32 w-full object-cover rounded-lg" /> : n && <img src={n.datei} alt="" className="h-32 w-full object-cover rounded-lg" />}
      {eigenesBild && <button className="text-xs underline text-muted self-start" onClick={() => setEigenesBild(null)}>Eigenes Bild entfernen</button>}
      <p className="text-xs text-muted">Nur Bilder verwenden, an denen du die Rechte hast – und keine erkennbaren Personen aus der Schule.</p>
      <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={fake} onChange={e => setFake(e.target.checked)} /> Das ist eine Falschmeldung (der Faktencheck deckt sie auf)</label>
      <button className="btn-primary self-start" disabled={!schlagzeile.trim() || posten.isPending} onClick={() => posten.mutate()}>📰 In den Klassen-Feed stellen</button>
      {ok && <p className="text-sm text-ok">Gepostet. Sie erscheint bei allen beim nächsten Wischen.</p>}
    </div>
  );
}

function FeedModeration({ code }: { code: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["klikk-feed", code], queryFn: () => api.klikk.beitraege({ code, token: null }), refetchInterval: 8000 });
  const weg = useMutation({ mutationFn: (id: number) => api.klikk.loeschen({ code, token: null }, id), onSuccess: () => qc.invalidateQueries({ queryKey: ["klikk-feed", code] }) });
  return (
    <div className="card p-4 flex flex-col gap-2 text-sm">
      <p className="text-muted">Alle Beiträge der Sitzung. Kommentare gibt es nur aus einer festen Liste; Namen sind generiert.</p>
      {!data?.length && <p>Noch nichts gepostet.</p>}
      {data?.map(b => (
        <div key={b.id} className="flex items-center gap-2 border-t border-line pt-2">
          <span className="flex-1">
            <b>@{b.name}</b> · {b.art === "news" ? `📰 ${b.inhalt.schlagzeile}${b.inhalt.fake ? " (Fake)" : ""}` : b.art === "video" ? `🎬 ${b.inhalt.trend}${b.inhalt.fake ? " (gefaked)" : ""}` : `📷 ${b.inhalt.motiv}`}
            <span className="text-xs text-muted"> · ❤️ {b.likes} · 💬 {b.kommentare.map(k => k.kommentar).join(", ") || "–"}</span>
          </span>
          <button className="btn-secondary text-xs" onClick={() => weg.mutate(b.id)}>🗑</button>
        </div>
      ))}
    </div>
  );
}

const KARTEN: { titel: string; emoji: string; fragen: string[]; rollenspiel: string; material: string }[] = [
  { titel: "Cybermobbing gegen Jonas", emoji: "🎸",
    fragen: ["Ab wann war es kein Spaß mehr – und für wen war es nie einer?", "Wer hat zugeschaut? Was bewirkt Schweigen in einer Gruppe?", "Welche Warnsignale hat Jonas gezeigt, und wer hat sie bemerkt?", "Was hätte eine einzige Nachricht verändert?"],
    rollenspiel: "Zu dritt: Frau Yilmaz, Jonas und eine Person, die mitgelacht hat. Spielt das Gespräch am Freitag – einmal mit »war nur Spaß«, einmal ehrlich.",
    material: "klicksafe.de: Cybermobbing · juuuport.de" },
  { titel: "Das heimliche Foto von Emma", emoji: "📷",
    fragen: ["Warum ist Weiterleiten genauso schlimm wie Fotografieren?", "Was kann Emma tun – und was können die anderen tun?", "Warum soll man so ein Foto nicht als »Beweis« speichern?"],
    rollenspiel: "Zwei Personen: Eine schreibt Emma, wie im Spiel (»Da geht ein Foto rum, ich helf dir«). Wie reagiert Emma? Was braucht sie?",
    material: "§ 201a StGB · nummergegenkummer.de" },
  { titel: "Challenges und Reichweite", emoji: "🛤️",
    fragen: ["Warum bekommen riskante Videos mehr Aufrufe?", "Wer trägt Verantwortung, wenn jemand ein (gefaktes) Video nachmacht?", "Wie widerspricht man einem Freund, ohne uncool zu wirken?"],
    rollenspiel: "Mo will zum Bahndamm. Drei Versuche, ihn umzustimmen – welcher Satz wirkt?",
    material: "Bundespolizei: Gefahren an Bahnanlagen" },
  { titel: "Daten, Werbung, Tracking", emoji: "🪞",
    fragen: ["Welche Erkenntnis im Datenspiegel hat dich am meisten überrascht?", "Woher wusste die Pizza-Werbung, wo du wohnst?", "Was würdest du an deinem echten Handy jetzt ändern?"],
    rollenspiel: "Werbeauktion nachbesprechen: Wer hat für welches Merkmal am meisten geboten – und was verkauft man solchen Leuten?",
    material: "Handy-Einstellungen: App-Tracking, Werbe-ID, Standort" },
  { titel: "Fremde im Netz", emoji: "😎",
    fragen: ["Woran erkennt man, dass »leon.16« nicht 16 ist?", "Warum sagen Täter »erzähl's nicht deinen Eltern«?", "Wem würdest du so etwas zeigen?"],
    rollenspiel: "Eine Person zeigt einem Erwachsenen den Chat. Übt die ersten zwei Sätze.",
    material: "Onlinewache der Polizei · jugendschutz.net" },
];

function Nachbesprechung() {
  return (
    <div className="flex flex-col gap-3">
      <button className="btn-secondary self-start print:hidden" onClick={() => window.print()}>🖨️ Karten drucken</button>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
        {KARTEN.map(k => (
          <div key={k.titel} className="card p-4 text-sm break-inside-avoid">
            <h3 className="font-black text-lg">{k.emoji} {k.titel}</h3>
            <ul className="list-disc pl-5 mt-2 flex flex-col gap-1">{k.fragen.map(f => <li key={f}>{f}</li>)}</ul>
            <p className="mt-2"><b>🎭 Rollenspiel:</b> {k.rollenspiel}</p>
            <p className="mt-1 text-xs text-muted">📎 {k.material}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
