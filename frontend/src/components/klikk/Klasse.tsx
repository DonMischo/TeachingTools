"use client";
/**
 * Klikk mit der Klasse: der geteilte Feed (Polling alle 6 s), Beiträge der
 * anderen mit Like und festen Kommentaren, Nachrichten der Lehrkraft — und der
 * Faktencheck, der bei jeder Nachricht hilft, Fakes zu erkennen.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api, type KlikkBeitrag } from "@/lib/api";
import { KOMMENTARE, NAME_MUSTER, SPIEL_NAME } from "@/lib/klikk/klasse";
import { MOTIVE, faktencheck, klassenEcho, klassenGemein, teilen } from "@/lib/klikk/motor";
import { trendNachId } from "@/lib/klikk/trends";
import type { Stand } from "@/lib/klikk/typen";
import type { Online } from "./spiele/SpieleApp";
import { nachweis } from "./PostMedien";

const Clip3D = lazy(() => import("./Clip3D"));
type Setze = (f: (s: Stand) => Stand) => void;

/** Lädt den Klassen-Feed und meldet Likes/Kommentare auf eigene Beiträge als Benachrichtigung. */
export function useKlasse(online: Online | undefined, setze: Setze) {
  const [liste, setListe] = useState<KlikkBeitrag[]>([]);
  const bekannt = useRef<Map<number, number> | null>(null);
  const zugang = online?.zugang;

  const laden = () => {
    if (!zugang) return;
    api.klikk.beitraege(zugang).then(neu => {
      setListe(neu);
      const vorher = bekannt.current;
      const jetzt = new Map(neu.filter(b => b.eigener).map(b => [b.id, b.likes + b.kommentare.length]));
      if (vorher) {
        const texte: { titel: string; text: string }[] = [];
        for (const b of neu.filter(x => x.eigener)) {
          const alt = vorher.get(b.id) ?? 0, jetztZahl = b.likes + b.kommentare.length;
          if (jetztZahl > alt) {
            const k = b.kommentare.at(-1);
            texte.push(k && b.kommentare.length > 0 ? { titel: `💬 ${k.name}`, text: k.kommentar } : { titel: "❤️ Aus deiner Klasse", text: `${b.likes} Likes auf deinen Beitrag` });
          }
        }
        if (texte.length) setze(st => klassenEcho(st, texte));
      }
      bekannt.current = jetzt;
    }).catch(() => {});
  };
  useEffect(() => {
    if (!zugang) return;
    laden();
    const t = setInterval(laden, 6000);
    return () => clearInterval(t);
  }, [zugang?.code, zugang?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  return { liste, laden };
}

/** Bild einer Lehrkraft-Nachricht: »weltall:id« oder »vulkan:id«. */
function newsBild(bild?: string | null) {
  if (!bild) return undefined;
  const [quelle, id] = bild.split(":");
  return quelle === "weltall" || quelle === "vulkan" ? nachweis({ art: "foto", quelle, id }) : undefined;
}

export function KlassenPost({ b, s, setze, online, aktualisieren }: { b: KlikkBeitrag; s: Stand; setze: Setze; online: Online; aktualisieren: () => void }) {
  const [kommentieren, setKommentieren] = useState(false);
  const tr = b.inhalt.trend ? trendNachId(b.inhalt.trend) : undefined;
  const motiv = MOTIVE.find(m => m.id === b.inhalt.motiv);
  const darf = NAME_MUSTER.test(s.name) && !!online.zugang;
  const riecht = (b.inhalt.hygiene ?? 100) < 35;
  const spiel = b.inhalt.spiel ? SPIEL_NAME[b.inhalt.spiel] : undefined;
  const reagieren = (body: { like?: boolean; kommentar?: string }) => {
    if (!online.zugang || !darf) return;
    if (body.kommentar && KOMMENTARE[body.kommentar]?.gemein) setze(klassenGemein);
    api.klikk.reagieren(online.zugang, b.id, { name: s.name, ...body }).then(aktualisieren).catch(() => {});
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 relative min-h-[18rem] overflow-hidden grid place-items-center"
        style={{ background: tr ? `linear-gradient(160deg, ${tr.farben[0]}, ${tr.farben[1]})` : "linear-gradient(160deg,#0ea5e9,#a855f7)" }}>
        {b.art === "video" && tr && (
          <div className="absolute inset-0">
            <Suspense fallback={<div className="w-full h-full grid place-items-center text-8xl">{tr.emoji}</div>}>
              <Clip3D clip={{ art: "tanz", figur: { klasse: ["normal", "rapper", "rocker", "krieger"][b.id % 4], form: b.id % 2 ? "w" : "m" }, hintergrund: 0x1e293b }} ersatz={tr.emoji} />
            </Suspense>
          </div>
        )}
        {b.art === "foto" && <span className="text-8xl">{motiv?.emoji ?? "📷"}</span>}
        {b.art === "spiel" && spiel && (
          <div className="text-center text-white drop-shadow">
            <div className="text-7xl">{spiel.emoji}</div>
            <div className="font-black text-2xl">{b.inhalt.punkte} {spiel.einheit}</div>
            <div className="text-sm">in {spiel.name} – schaffst du mehr? 😏</div>
          </div>
        )}
        {riecht && <span className="absolute top-8 right-3 text-3xl animate-pulse" title="Hygiene niedrig">💨🦨</span>}
        {b.art === "news" && <NachrichtBild b={b} />}
        <span className="absolute top-2 left-2 text-xs font-bold bg-black/60 text-white rounded-full px-2 py-0.5">👥 Aus deiner Klasse</span>
        {b.art !== "news" && (
          <div className="absolute right-2 bottom-4 flex flex-col items-center gap-2 text-white drop-shadow">
            <button aria-label="Gefällt mir" disabled={!darf} onClick={() => reagieren({ like: !b.gelikt })} className="text-3xl">{b.gelikt ? "❤️" : "🤍"}</button>
            <span className="text-xs font-bold -mt-1">{b.likes}</span>
            <button aria-label="Kommentieren" disabled={!darf} onClick={() => setKommentieren(v => !v)} className="text-2xl">💬</button>
            <span className="text-xs font-bold -mt-1">{b.kommentare.length}</span>
          </div>
        )}
      </div>
      <div className="p-3 text-sm flex flex-col gap-1">
        <div><b>@{b.name}</b> {b.art === "video" && tr ? `${tr.name} 🎬` : b.art === "foto" ? motiv?.text : ""}</div>
        {b.kommentare.slice(-3).map((k, i) => <div key={i} className="text-xs"><b>{k.name}</b> {k.kommentar}</div>)}
        {kommentieren && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(KOMMENTARE).filter(([id]) => id !== "stinkt" || riecht).map(([id, k]) => (
              <button key={id} className={`text-[11px] rounded-full px-2 py-0.5 border ${b.mein_kommentar === k.text ? "bg-accent text-accent-fg" : "border-line"}`}
                onClick={() => { reagieren({ kommentar: id }); setKommentieren(false); }}>{k.text}</button>
            ))}
          </div>
        )}
        {b.art === "news" && <Faktencheck id={`k${b.id}`} istFake={!!b.inhalt.fake} quelle={b.name} bild={newsBild(b.inhalt.bild)} s={s} setze={setze} />}
      </div>
    </div>
  );
}

function NachrichtBild({ b }: { b: KlikkBeitrag }) {
  const n = newsBild(b.inhalt.bild);
  return (
    <div className="absolute inset-0 flex flex-col bg-white text-zinc-900">
      <div className="px-3 py-2 text-xs font-black text-white bg-red-600">⚠️ EILMELDUNG · Klikk News</div>
      {n && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={n.datei} alt="" className="w-full h-40 object-cover" />)}
      <div className="p-4 flex flex-col gap-2">
        <div className="text-xl font-black leading-tight">{b.inhalt.schlagzeile}</div>
        <div className="text-sm text-zinc-600">{b.inhalt.unterzeile}</div>
      </div>
    </div>
  );
}

/**
 * »Stimmt das?« — drei Prüfschritte (Quelle, Bild-Rückwärtssuche, andere
 * Medien), dann ein eigenes Urteil. Daneben »Teilen«: auch ungeprüft möglich.
 */
export function Faktencheck({ id, istFake, quelle, bild, s, setze }: {
  id: string; istFake: boolean; quelle: string; bild?: { urheber: string; lizenz: string }; s: Stand; setze: Setze;
}) {
  const [schritt, setSchritt] = useState(-1);
  const check = s.checks[id];
  const geteilt = s.geteilt.some(g => g.id === id);
  const SCHRITTE = [
    { titel: "🔎 Wer hat das gepostet?", text: istFake
      ? `@${quelle}: Konto seit drei Wochen, kein Impressum, postet fast nur »Eilmeldungen« mit vielen Ausrufezeichen.`
      : `@${quelle}: Redaktion mit Impressum, verlinkt ihre Quellen.` },
    { titel: "🖼️ Bild-Rückwärtssuche", text: bild
      ? (istFake ? `Das Bild ist älter und zeigt etwas anderes: Es stammt von ${bild.urheber} (${bild.lizenz}) und wurde in ganz anderem Zusammenhang veröffentlicht.` : `Das Bild stammt von ${bild.urheber} und passt zur Meldung.`)
      : (istFake ? "Ein ähnliches Bild taucht seit Jahren mit wechselnden Geschichten auf." : "Kein Bild, das schon anders verwendet wurde.") },
    { titel: "📰 Berichten andere darüber?", text: istFake
      ? "Keine seriöse Nachrichtenseite berichtet darüber. Nur Konten, die sich gegenseitig teilen."
      : "Auch große Nachrichtenseiten und offizielle Stellen berichten darüber." },
  ];

  if (check) return (
    <div className={`rounded-lg p-2 text-xs ${check.richtig ? "bg-ok/15" : "bg-bad/15"}`}>
      {check.richtig ? "✅ Richtig erkannt" : "❌ Daneben"}: Das ist {istFake ? "eine Falschmeldung" : "eine echte Nachricht"}.
    </div>
  );
  return (
    <div className="flex flex-col gap-1 mt-1">
      <div className="flex gap-2">
        <button className="text-xs font-bold rounded-full px-2 py-1 bg-amber-400 text-zinc-900" onClick={() => setSchritt(0)}>🤔 Stimmt das?</button>
        <button className="text-xs rounded-full px-2 py-1 border border-line disabled:opacity-50" disabled={geteilt} onClick={() => setze(st => teilen(st, id, istFake))}>{geteilt ? "📤 geteilt" : "📤 Teilen"}</button>
      </div>
      {schritt >= 0 && (
        <div className="rounded-lg border border-line p-2 text-xs flex flex-col gap-1">
          {SCHRITTE.slice(0, schritt + 1).map(x => <div key={x.titel}><b>{x.titel}</b><br />{x.text}</div>)}
          {schritt < SCHRITTE.length - 1
            ? <button className="self-start underline" onClick={() => setSchritt(schritt + 1)}>Nächster Prüfschritt →</button>
            : (
              <div className="flex gap-2 mt-1">
                <span className="font-bold">Dein Urteil:</span>
                <button className="underline" onClick={() => setze(st => faktencheck(st, id, "echt", istFake))}>stimmt</button>
                <button className="underline" onClick={() => setze(st => faktencheck(st, id, "fake", istFake))}>Fake</button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
