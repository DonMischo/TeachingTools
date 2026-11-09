"use client";
/**
 * Eine Station der Zeitreise: Titelbild, Geschichte, »besser / Haken«,
 * Übertragungs-Profil im Vergleich zur Station davor, Bildergeschichte
 * zur Bedienung, Mitmach-Demo, Kurioses — und die Frage, die weiterschaltet.
 */
import { useState } from "react";
import { PROFIL_ACHSEN, epoche, vorher, type Medium } from "@/lib/medien/medien";
import { bilderZu, nachweisFuer } from "@/lib/medien/galerie";
import { mitStation, type Aenderung } from "@/lib/medien/fortschritt";
import { BildStreifen } from "@/components/galerie/FotoGalerie";
import { DEMOS } from "./demos";

export default function Station({ m, geschafft, aendere, weiter }: {
  m: Medium; geschafft: boolean; aendere: (a: Aenderung) => void; weiter?: () => void;
}) {
  const e = epoche(m.epoche);
  const davor = vorher(m.id);
  const Demo = m.demo ? DEMOS[m.demo] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Titel */}
      <div className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden shadow-md"
        style={{ background: `linear-gradient(135deg, ${e.farbe}, ${e.farbe}cc 55%, #111827)` }}>
        <div className="absolute -right-4 -bottom-10 text-[10rem] leading-none opacity-20 select-none" aria-hidden>{m.icon}</div>
        <div className="relative flex items-start gap-4">
          <div className="text-6xl leading-none drop-shadow" aria-hidden>{m.icon}</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-wide">
              <span className="rounded-full bg-white/20 px-2 py-0.5">{e.icon} {e.name}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5">überträgt: {m.art}</span>
              {m.flop && <span className="rounded-full bg-black/40 px-2 py-0.5">💀 Flop</span>}
              {geschafft && <span className="rounded-full bg-emerald-500/80 px-2 py-0.5">✓ geschafft</span>}
            </div>
            <h2 className="text-3xl font-black tracking-tight">{m.name}</h2>
            <div className="text-white/80 font-bold">{m.jahrText}</div>
            <p className="text-white/95 max-w-2xl">{m.kurz}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        <div className="flex flex-col gap-3">
          <section className="card p-4">
            <h3 className="font-black mb-1">📖 Was ist das?</h3>
            <p className="text-sm leading-relaxed">{m.geschichte}</p>
          </section>
          <div className="grid sm:grid-cols-2 gap-3">
            <section className="card p-4 border-l-4" style={{ borderLeftColor: "var(--color-ok)" }}>
              <h3 className="font-black mb-1 text-ok">✅ Besser fürs Übertragen</h3>
              <p className="text-sm leading-relaxed">{m.besser}</p>
            </section>
            <section className="card p-4 border-l-4" style={{ borderLeftColor: "var(--color-bad)" }}>
              <h3 className="font-black mb-1 text-bad">⚠️ Der Haken</h3>
              <p className="text-sm leading-relaxed">{m.haken}</p>
            </section>
          </div>
        </div>
        <Profil m={m} davor={davor} farbe={e.farbe} />
      </div>

      {/* Bildergeschichte */}
      <section className="card p-4">
        <h3 className="font-black mb-3">🛠️ So benutzt man es</h3>
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {m.schritte.map((s, i) => (
            <li key={i} className="relative rounded-xl border border-line bg-surface-hover p-3 pt-4 flex flex-col items-center text-center gap-2">
              <span className="absolute top-1.5 left-2 text-xs font-black rounded-full w-5 h-5 flex items-center justify-center text-white" style={{ background: e.farbe }}>{i + 1}</span>
              <span className="text-4xl leading-none" aria-hidden>{s.icon}</span>
              <span className="text-sm leading-snug">{s.text}</span>
              {i < m.schritte.length - 1 && <span className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-muted text-lg" aria-hidden>➜</span>}
            </li>
          ))}
        </ol>
      </section>

      {Demo && (
        <section className="card p-4 border-2" style={{ borderColor: `${e.farbe}66` }}>
          <h3 className="font-black mb-3">🎮 Probier's aus</h3>
          <Demo />
        </section>
      )}

      <section className="rounded-2xl p-4 flex gap-3 border-2" style={{ background: "rgba(245, 158, 11, 0.12)", borderColor: "rgba(245, 158, 11, 0.5)" }}>
        <span className="text-3xl" aria-hidden>😂</span>
        <div>
          <h3 className="font-black">Kurios!</h3>
          <p className="text-sm leading-relaxed">{m.witz}</p>
        </div>
      </section>

      <Frage key={m.id} m={m} geschafft={geschafft} aendere={aendere} weiter={weiter} />
    </div>
  );
}

function Profil({ m, davor, farbe }: { m: Medium; davor?: Medium; farbe: string }) {
  return (
    <section className="card p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-black">📊 Übertragungs-Profil</h3>
        <p className="text-xs text-muted">{davor ? <>Pfeile: verglichen mit der Station davor ({davor.icon} {davor.name})</> : "Wie gut transportiert dieses Medium Information?"}</p>
      </div>
      {PROFIL_ACHSEN.map(a => {
        const w = m.profil[a.id], alt = davor?.profil[a.id];
        const d = alt === undefined ? 0 : w - alt;
        return (
          <div key={a.id} title={a.frage}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{a.icon} {a.name}</span>
              <span className={`text-xs font-black ${d > 0 ? "text-ok" : d < 0 ? "text-bad" : "text-muted"}`}>
                {d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : alt === undefined ? "" : "="}
              </span>
            </div>
            <div className="flex gap-1 mt-1" aria-label={`${a.name}: ${w} von 5`}>
              {[1, 2, 3, 4, 5].map(k => (
                <div key={k} className={`h-3 flex-1 rounded-sm ${k <= w ? "" : "bg-surface-hover"}`}
                  style={k <= w ? { background: farbe, opacity: 0.55 + k * 0.09 } : undefined} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Frage({ m, geschafft, aendere, weiter }: { m: Medium; geschafft: boolean; aendere: (a: Aenderung) => void; weiter?: () => void }) {
  const [falsch, setFalsch] = useState<number[]>([]);
  const [richtig, setRichtig] = useState(geschafft);
  const bilder = bilderZu(m.id);
  const antworte = (i: number) => {
    if (richtig) return;
    if (i === m.frage.richtig) { setRichtig(true); aendere(mitStation(m.id)); }
    else setFalsch(f => (f.includes(i) ? f : [...f, i]));
  };
  return (
    <section className="card p-4 flex flex-col gap-3 border-2 border-accent/50">
      <div>
        <h3 className="font-black">❓ Station schaffen</h3>
        <p className="text-sm mt-1 font-bold">{m.frage.text}</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {m.frage.optionen.map((o, i) => {
          const istRichtig = richtig && i === m.frage.richtig, istFalsch = falsch.includes(i);
          return (
            <button key={i} onClick={() => antworte(i)} disabled={richtig || istFalsch}
              className={`rounded-xl border-2 p-3 text-sm text-left font-bold transition-colors
                ${istRichtig ? "border-ok bg-ok/15" : istFalsch ? "border-bad bg-bad/10 line-through opacity-70" : "border-line hover:border-accent bg-surface"}`}>
              {istRichtig ? "✅ " : istFalsch ? "❌ " : ""}{o}
            </button>
          );
        })}
      </div>
      {falsch.length > 0 && !richtig && <p className="text-sm text-bad">Nicht ganz — schau noch mal bei »Besser fürs Übertragen« nach.</p>}
      {richtig && (
        <div className="flex flex-col gap-3">
          <p className="text-sm"><b className="text-ok">Richtig!</b> {m.frage.erklaerung}</p>
          {bilder.length > 0 && (
            <div>
              <div className="text-sm font-black mb-1.5">📷 Freigeschaltet: {bilder.length} {bilder.length === 1 ? "Foto" : "Fotos"} für die Galerie</div>
              <BildStreifen bilder={bilder} nachweisFuer={nachweisFuer} />
            </div>
          )}
          {weiter ? <button className="btn-primary self-start" onClick={weiter}>Weiter in der Zeit ›</button>
            : <p className="font-black">🏁 Du bist in der Gegenwart angekommen! Was wohl als Nächstes kommt?</p>}
        </div>
      )}
    </section>
  );
}
