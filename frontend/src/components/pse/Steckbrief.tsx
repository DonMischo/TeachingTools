"use client";
/**
 * Steckbrief eines Elements: Foto der Stoffprobe, Kenndaten, Text und die
 * typischen Reaktionen.
 *
 * Bild und Links kommen bewusst ohne next/image und next/link aus: dieselbe
 * Datei laeuft in der Offline-Fassung (standalone), und die kennt kein Next.
 *
 * Die Reaktionen sind Links in die Gleichungswaage — dort stehen sie
 * unausgeglichen in den Schalen und wollen Faktoren bekommen. So hängen
 * Nachschlagen und Rechnen zusammen.
 */
import { celsius, HAUPTGRUPPEN, hauptgruppenName, KATEGORIEN, konfigurationHoch, type PseElement } from "@/lib/pse/elemente";
import { probe } from "@/lib/pse/bilder";
import { reaktionenZu, waageLink } from "@/lib/pse/reaktionen";
import { formatReaction, parseReaction } from "@/lib/chemie";
import { textZu } from "@/lib/pse/texte";

/**
 * Zahl mit Einheit, oder »—« wenn PubChem nichts weiß (etwa bei Element 118).
 * Ohne `stellen` bleibt die Genauigkeit der Quelle stehen: die Atommasse des
 * Eisens ist mit 55,84 angegeben, nicht mit 55,840.
 */
const wert = (n: number | null | undefined, einheit: string, stellen?: number): string =>
  n === null || n === undefined ? "—"
    : `${(stellen === undefined ? String(n) : n.toFixed(stellen)).replace(".", ",")} ${einheit}`;

function Zeile({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-line/50 last:border-0">
      <dt className="text-muted">{k}</dt>
      <dd className="font-medium text-right tabular-nums">{v}</dd>
    </div>
  );
}

/**
 * Die Reaktion zum Hinsehen — mit tiefgestellten Indizes und hochgestellten
 * Ladungen, gesetzt vom selben Formatierer wie in der Gleichungswaage.
 * Lässt sie sich nicht lesen, steht sie eben wie geschrieben da.
 */
function gesetzt(src: string): string {
  const r = parseReaction(src);
  return r.ok ? formatReaction(r.r) : src.replace("->", "→");
}

export default function Steckbrief({ e, onSchliessen, onAtommodell }: {
  e: PseElement; onSchliessen: () => void;
  /** Führt in den Reiter »Atommodelle« — mit diesem Element. */
  onAtommodell?: () => void;
}) {
  const kat = KATEGORIEN[e.kategorie];
  const bild = probe(e.symbol);
  const text = textZu(e.symbol);
  const reaktionen = reaktionenZu(e.symbol);
  const gruppe = hauptgruppenName(e);

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div
          style={{ background: `${kat.farbe}33`, borderColor: kat.farbe }}
          className="rounded-xl border-2 px-3 py-2 text-center shrink-0"
        >
          <div className="text-[10px] text-muted tabular-nums">{e.z}</div>
          <div className="text-2xl font-black leading-none">{e.symbol}</div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-tight">{e.name}</h2>
          <p className="text-xs text-muted">{kat.label}</p>
          <p className="text-xs text-muted mt-0.5">
            {e.periode}. Periode
            {e.hauptgruppe ? `, ${HAUPTGRUPPEN[e.hauptgruppe].roemisch}. Hauptgruppe` : ""}
          </p>
          {gruppe && (
            <p className="text-xs mt-0.5" title={HAUPTGRUPPEN[e.hauptgruppe!].kurz}>
              <strong>{gruppe}</strong>
              <span className="text-muted"> — {HAUPTGRUPPEN[e.hauptgruppe!].kurz}</span>
            </p>
          )}
        </div>
        <button onClick={onSchliessen} className="text-muted hover:text-fg text-lg leading-none" aria-label="Steckbrief schließen">×</button>
      </div>

      {bild && (
        <figure className="flex flex-col gap-1">
          <img src={bild.datei} alt={`Stoffprobe ${e.name}`}
            className="w-full h-44 rounded-xl bg-black/20 object-contain" />
          <figcaption className="text-[10px] text-muted">
            Foto: {bild.urheber}, {bild.lizenz} —{" "}
            <a href={bild.seite} target="_blank" rel="noreferrer" className="underline hover:text-fg">Wikimedia Commons</a>
          </figcaption>
        </figure>
      )}

      {text && (
        <div className="flex flex-col gap-2 text-sm">
          <p>{text.wesen}</p>
          {text.vorkommen && <p><span className="text-muted">Vorkommen: </span>{text.vorkommen}</p>}
          {text.verwendung && <p><span className="text-muted">Verwendung: </span>{text.verwendung}</p>}
          {text.merk && <p className="rounded-lg bg-accent/10 px-3 py-2">💡 {text.merk}</p>}
        </div>
      )}

      {onAtommodell && (
        <button onClick={onAtommodell}
          className="rounded-xl border border-line px-3 py-2 text-left hover:border-accent group">
          <span className="text-sm font-medium">⚛️ Atommodelle</span>
          <span className="block text-xs text-muted mt-0.5">
            {e.name} als Kugel, Kern mit Hülle, Schalen und Orbitale — animiert
          </span>
        </button>
      )}

      <dl className="text-sm">
        <Zeile k="Atommasse" v={wert(e.masse, "u")} />
        <Zeile k="Zustand (20 °C)" v={e.zustand ?? "—"} />
        <Zeile k="Schmelzpunkt" v={wert(celsius(e.schmelzpunkt), "°C", 0)} />
        <Zeile k="Siedepunkt" v={wert(celsius(e.siedepunkt), "°C", 0)} />
        {/* PubChem gibt die Dichte durchweg in g/cm³ — bei Gasen sind das winzige
            Zahlen, deshalb hier mal 1000 als g/l. */}
        <Zeile k="Dichte" v={e.zustand === "gasförmig"
          ? wert(e.dichte === null ? null : e.dichte * 1000, "g/l", 4)
          : wert(e.dichte, "g/cm³", 2)} />
        <Zeile k="Elektronegativität" v={e.en === null ? "—" : String(e.en).replace(".", ",")} />
        <Zeile k="Elektronenkonfiguration" v={konfigurationHoch(e.konfiguration)} />
        <Zeile k="Oxidationszahlen" v={e.oxidationszahlen.length ? e.oxidationszahlen.map(n => (n > 0 ? `+${n}` : String(n).replace("-", "−"))).join(", ") : "—"} />
        <Zeile k="Entdeckt" v={e.entdeckt || "—"} />
      </dl>

      {reaktionen.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Typische Reaktionen</h3>
          <p className="text-xs text-muted -mt-1">
            Ein Klick öffnet die Gleichungswaage — dort gleichst du die Gleichung aus.
          </p>
          {reaktionen.map(r => (
            <a
              key={r.src}
              href={waageLink(r.src)}
              className="rounded-xl border border-line px-3 py-2 hover:border-accent group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="text-xs text-muted group-hover:text-accent">⚖️ ausgleichen</span>
              </div>
              <div className="text-xs text-muted mt-0.5">{gesetzt(r.src)}</div>
              {r.hinweis && <div className="text-xs text-muted mt-1">{r.hinweis}</div>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
