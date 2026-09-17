"use client";
/**
 * Das Datenblatt eines Himmelskörpers: Foto, Zahlen mit Erdvergleich,
 * Besonderheiten, Monde und passende Bilder aus der Galerie.
 *
 * Die Zahlen sind so übersetzt, dass man sie sich vorstellen kann: Schwerkraft
 * als »so schwer fühlst du dich«, Abstand als Lichtlaufzeit.
 *
 * Raumfahrzeuge haben keine Dichte und keine Schwerkraft; bei ihnen stehen
 * dafür Betreiber, Startdatum, Zweck und die Bahnhöhe. Deshalb sind fast alle
 * Zeilen einzeln abgesichert.
 */
import { useMemo, type ReactNode } from "react";
import {
  ART_NAME, ERDE, KM_JE_AE, KOERPER_NACH_ID, LICHT_KM_S, mondeVon, satellitenVon, type Koerper,
} from "@/lib/sonnensystem/daten";
import { abstand, heliozentrisch, julianischerTag, umlaufTage } from "@/lib/sonnensystem/bahnen";
import { foto, type Bildnachweis } from "@/lib/sonnensystem/bilder";
import { GALERIE, bildFuer, freigeschaltet } from "@/lib/sonnensystem/galerie";
import { dauer, gerundet, km, malErde, tage, zahl, zehnerpotenz } from "@/lib/sonnensystem/format";

export function Steckbrief({ koerper, onWaehle, onSchliessen, onGalerie, erforscht = [], alleZeigen = false }: {
  koerper: Koerper;
  onWaehle: (id: string) => void;
  onSchliessen: () => void;
  onGalerie?: (id: string) => void;
  /** Welche Bilder schon freigeschaltet sind */
  erforscht?: readonly string[];
  alleZeigen?: boolean;
}) {
  const k = koerper;
  const bild = foto(k.id);
  const monde = mondeVon(k.id);
  const satelliten = satellitenVon(k.id);
  const mutter = k.mutter ? KOERPER_NACH_ID[k.mutter] : null;
  const alleBilder = GALERIE.filter(g => g.koerper === k.id && !g.portraet);
  const bilderDazu = alleBilder.filter(g => alleZeigen || freigeschaltet(g, erforscht));
  const gesperrt = alleBilder.length - bilderDazu.length;

  // Heute: wie weit von der Erde? Für Monde zählt ihr Planet.
  const heuteVonErde = useMemo(() => {
    const jd = julianischerTag(new Date());
    const bezug = mutter ?? k;
    if (k.id === "erde") return null;
    if (k.id === "mond") return 384_400;
    const erde = heliozentrisch(ERDE.bahn!, jd);
    const p = bezug.bahn ? heliozentrisch(bezug.bahn, jd) : [0, 0, 0] as [number, number, number];
    if (bezug.id === "erde") return null;
    return abstand(erde, p) * KM_JE_AE;
  }, [k, mutter]);

  const wiegt40 = k.schwerkraft !== undefined ? (40 * k.schwerkraft) / ERDE.schwerkraft! : 0;

  return (
    <aside
      className="fixed inset-x-0 bottom-0 top-auto sm:top-0 sm:left-auto sm:w-[420px] max-h-[82dvh] sm:max-h-none z-50 flex flex-col
        bg-slate-950/95 backdrop-blur text-slate-100 border-t sm:border-t-0 sm:border-l border-white/10 shadow-2xl rounded-t-2xl sm:rounded-none"
      aria-label={`Steckbrief ${k.name}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">
            {ART_NAME[k.art]}{mutter ? ` von ${mutter.name}` : ""}
          </div>
          <h2 className="text-2xl font-black leading-tight">{k.name}</h2>
        </div>
        <button onClick={onSchliessen} className="w-9 h-9 rounded-lg hover:bg-white/10 text-lg" aria-label="Steckbrief schließen">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 flex flex-col gap-4">
        {bild && (
          <figure>
            <div className="aspect-square max-h-64 mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <img src={bild.datei} alt={`${k.name} — Foto`} className="w-full h-full object-contain" />
            </div>
            <Nachweis bild={bild} />
          </figure>
        )}

        <p className="text-sm leading-relaxed text-slate-200">{k.intro}</p>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {k.groesse ? (
            <Zeile name="Größe">{k.groesse}</Zeile>
          ) : (
            <Zeile name="Durchmesser">
              {zahl(k.radiusKm * 2)} km {k.id !== "erde" && <Vergleich>{malErde(k.radiusKm, ERDE.radiusKm)} Erde</Vergleich>}
            </Zeile>
          )}
          <Zeile name="Masse">
            {k.art === "satellit"
              ? `${zahl(k.masseKg)} kg`
              : <>{zehnerpotenz(k.masseKg)} kg {k.id !== "erde" && <Vergleich>{malErde(k.masseKg, ERDE.masseKg)} Erde</Vergleich>}</>}
          </Zeile>
          {k.dichte !== undefined && (
            <Zeile name="Dichte">
              {zahl(k.dichte, 2)} g/cm³ {k.dichte < 1 && <Vergleich>leichter als Wasser</Vergleich>}
            </Zeile>
          )}
          {k.schwerkraft !== undefined && (
            <Zeile name="Schwerkraft">
              {gerundet(k.schwerkraft)} m/s²
              {k.id !== "erde" && (
                <div className="text-xs text-slate-400">Wer auf der Erde 40 kg wiegt, fühlt sich hier wie {gerundet(wiegt40)} kg.</div>
              )}
            </Zeile>
          )}
          {k.rotationStunden !== undefined && (
            <Zeile name="Eine Drehung">
              {tage(k.rotationStunden / 24)}{k.rotationStunden < 0 ? " — rückwärts" : ""}
            </Zeile>
          )}
          {k.sonnentagStunden && k.id !== "erde" && (
            <Zeile name="Von Mittag bis Mittag">{tage(k.sonnentagStunden / 24)}</Zeile>
          )}
          {k.bahn && (
            <>
              <Zeile name="Ein Jahr">{tage(umlaufTage(k.bahn))}</Zeile>
              <Zeile name="Abstand zur Sonne">
                {km(k.bahn.a * KM_JE_AE)}
                <div className="text-xs text-slate-400">
                  zwischen {km(k.bahn.a * (1 - k.bahn.e) * KM_JE_AE)} und {km(k.bahn.a * (1 + k.bahn.e) * KM_JE_AE)} · Sonnenlicht braucht {dauer((k.bahn.a * KM_JE_AE) / LICHT_KM_S)}
                </div>
              </Zeile>
            </>
          )}
          {k.mondBahn && mutter && (
            <>
              <Zeile name={`Abstand zu ${mutter.name}`}>{km(k.mondBahn.aKm)}</Zeile>
              <Zeile name="Ein Umlauf">{tage(Math.abs(k.mondBahn.umlaufTage))}{k.mondBahn.umlaufTage < 0 ? " — rückwärts" : ""}</Zeile>
            </>
          )}
          {k.satBahn && mutter && (
            <>
              <Zeile name="Bahnhöhe">
                {km(k.satBahn.aKm - mutter.radiusKm)} über der Oberfläche
                {k.satBahn.e > 0.01 && (
                  <div className="text-xs text-slate-400">
                    eine Ellipse: zwischen {km(k.satBahn.aKm * (1 - k.satBahn.e) - mutter.radiusKm)} und {km(k.satBahn.aKm * (1 + k.satBahn.e) - mutter.radiusKm)}
                  </div>
                )}
              </Zeile>
              <Zeile name="Ein Umlauf">
                {k.satBahn.umlaufMinuten < 120
                  ? `${gerundet(k.satBahn.umlaufMinuten)} Minuten`
                  : tage(k.satBahn.umlaufMinuten / 1440)}
                {k.satBahn.geostationaer && <div className="text-xs text-slate-400">genau eine Erddrehung — er steht still über einem Punkt</div>}
              </Zeile>
              <Zeile name="Bahnneigung">
                {zahl(k.satBahn.neigung, 1)}° zum Äquator
                {k.satBahn.neigung > 90 && <div className="text-xs text-slate-400">über 90°: er läuft der Erddrehung entgegen</div>}
              </Zeile>
            </>
          )}
          {heuteVonErde !== null && (
            <Zeile name="Heute von der Erde">
              {km(heuteVonErde)}
              <div className="text-xs text-slate-400">Licht braucht {dauer(heuteVonErde / LICHT_KM_S)}{mutter && k.id !== "mond" ? ` (bis ${mutter.name})` : ""}</div>
            </Zeile>
          )}
          {k.achsneigung !== undefined && (
            <Zeile name="Achsneigung">{zahl(k.achsneigung, k.achsneigung < 10 ? 1 : 0)}°</Zeile>
          )}
          <Zeile name="Temperatur">{k.temperatur}</Zeile>
          <Zeile name="Atmosphäre">{k.atmosphaere}</Zeile>
          {k.zweck && <Zeile name="Aufgabe">{k.zweck}</Zeile>}
          {k.betreiber && <Zeile name="Betrieben von">{k.betreiber}</Zeile>}
          {k.start && <Zeile name="Start">{k.start}</Zeile>}
          {k.mondeAnzahl !== undefined && (
            <Zeile name="Monde">
              {k.mondeAnzahl === 0 ? "keine" : `${k.mondeAnzahl} bekannte`}
              {monde.length > 0 && (
                <div className="text-xs text-slate-400">
                  {monde.length} davon hier · {monde.filter(m => erforscht.includes(m.id)).length} gescannt
                </div>
              )}
            </Zeile>
          )}
          {k.entdeckung && <Zeile name="Entdeckt">{k.entdeckung}</Zeile>}
        </dl>

        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sky-300 mb-2">Erstaunlich</h3>
          <ul className="flex flex-col gap-2">
            {k.fakten.map(f => (
              <li key={f} className="text-sm leading-snug text-slate-200 pl-3 border-l-2 border-sky-400/40">{f}</li>
            ))}
          </ul>
        </section>

        {monde.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sky-300 mb-2">
              Wichtige Monde{k.mondeAnzahl && k.mondeAnzahl > monde.length ? ` (${monde.length} von ${k.mondeAnzahl})` : ""}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {monde.map(m => {
                const mb = foto(m.id);
                const gescannt = alleZeigen || erforscht.includes(m.id);
                return (
                  <button key={m.id} onClick={() => onWaehle(m.id)} className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-white/10">
                    {mb && <img src={mb.datei} alt="" className={`w-14 h-14 rounded-full object-cover bg-black ${gescannt ? "" : "opacity-40 grayscale"}`} />}
                    <span className="text-xs font-bold">{m.name}{gescannt ? " ✓" : ""}</span>
                    <span className="text-[10px] text-slate-400">{zahl(m.radiusKm * 2)} km</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {satelliten.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sky-300 mb-2">Raumfahrzeuge in der Umlaufbahn</h3>
            <p className="text-xs text-slate-400 mb-2">
              {satelliten.filter(s => alleZeigen || erforscht.includes(s.id)).length} von {satelliten.length} gescannt
            </p>
            <div className="grid grid-cols-3 gap-2">
              {satelliten.map(s => {
                const sb = foto(s.id);
                const gescannt = alleZeigen || erforscht.includes(s.id);
                return (
                  <button key={s.id} onClick={() => onWaehle(s.id)} className="flex flex-col items-center gap-1 rounded-lg p-2 hover:bg-white/10">
                    {sb && <img src={sb.datei} alt="" className={`w-14 h-14 rounded-lg object-cover bg-black ${gescannt ? "" : "opacity-40 grayscale"}`} />}
                    <span className="text-xs font-bold text-center leading-tight">{s.name.split("-")[0]}{gescannt ? " ✓" : ""}</span>
                    <span className="text-[10px] text-slate-400">{km(s.satBahn!.aKm - k.radiusKm)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {mutter && (
          <button onClick={() => onWaehle(mutter.id)} className="self-start text-sm text-sky-300 hover:text-sky-200">
            ← zurück zu {mutter.name}
          </button>
        )}

        {alleBilder.length > 0 && onGalerie && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-sky-300 mb-2">Aus Teleskopen und Sonden</h3>
            {gesperrt > 0 && (
              <p className="text-xs text-slate-400 mb-2">
                🔒 {gesperrt} {gesperrt === 1 ? "Bild ist" : "Bilder sind"} noch gesperrt — scanne {k.name} im Flugmodus.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {bilderDazu.map(g => (
                <button key={g.id} onClick={() => onGalerie(g.id)} className="text-left rounded-lg overflow-hidden bg-white/5 hover:bg-white/10">
                  <img src={bildFuer(g)?.datei} alt="" className="w-full aspect-video object-cover" />
                  <div className="px-2 py-1 text-[11px] leading-tight">{g.titel}<span className="block text-slate-400">{g.von}</span></div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function Zeile({ name, children }: { name: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-400 whitespace-nowrap">{name}</dt>
      <dd className="text-slate-100">{children}</dd>
    </>
  );
}

function Vergleich({ children }: { children: ReactNode }) {
  return <span className="ml-1 text-xs text-sky-300/90 whitespace-nowrap">({children})</span>;
}

export function Nachweis({ bild }: { bild: Bildnachweis }) {
  return (
    <figcaption className="mt-1 text-[10px] leading-snug text-slate-500">
      Bild: {bild.urheber} · <a href={bild.seite} target="_blank" rel="noreferrer" className="underline hover:text-slate-300">{bild.lizenz}</a>
    </figcaption>
  );
}
