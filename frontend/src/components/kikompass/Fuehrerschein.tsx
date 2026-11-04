"use client";
/**
 * KI-Führerschein: vier Module (eines je Bereich), darin Stationen. Ist ein
 * Modul fertig, meldet ein Schülerkonto es einmal und bekommt Hauspunkte.
 * Sind alle vier fertig, gibt es die Urkunde.
 */
import { useRef, useState } from "react";
import { api, type MausPruefungOut } from "@/lib/api";
import { BEREICHE, type BereichId } from "@/lib/kikompass/raster";
import {
  MODUL_REIHENFOLGE, fuehrerscheinFertig, modulFertig, stationFertig, stationenVon, type StationStand,
} from "@/lib/kikompass/stationen";
import { leinwandAlsPdf } from "@/lib/maus/pdf";
import { herunterladen } from "@/lib/docx";
import { StationAnsicht } from "./StationAnsicht";
import { datumDe, heute } from "./Raster";

export function Fuehrerschein({ stande, onStation, name, konto, code }: {
  stande: Record<string, StationStand>;
  onStation: (id: string, stand: StationStand) => void;
  name: string;
  /** Nur Konten melden Module (Hauspunkte nur für Schülerkonten). */
  konto: boolean;
  code: string | null;
}) {
  const [offen, setOffen] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Partial<Record<BereichId, MausPruefungOut | "fehler">>>({});

  const station = offen ? MODUL_REIHENFOLGE.flatMap(stationenVon).find(s => s.id === offen) : null;
  if (station) {
    return (
      <StationAnsicht key={station.id} station={station} stand={stande[station.id]}
        onChange={s => onStation(station.id, s)} onZurueck={() => setOffen(null)} />
    );
  }

  async function melden(modul: BereichId) {
    try {
      const r = await api.kikompass.pruefung({ modul, code });
      setMeldung(m => ({ ...m, [modul]: r }));
    } catch {
      setMeldung(m => ({ ...m, [modul]: "fehler" }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted max-w-3xl">
        Vier Module, eines je Kompetenzbereich. In jedem Modul gibt es Stationen auf Stufe 0 (Einstieg) und Stufe I (Basis).
        Eine Station ist geschafft, wenn du den Selbst-Check bestehst und deine Reflexion schreibst.
        Für Stationen mit 🤖 brauchst du AIS.chat, den Zugang bekommst du per QR-Code von deiner Lehrkraft.
      </p>
      {MODUL_REIHENFOLGE.map(modul => {
        const b = BEREICHE.find(x => x.id === modul)!;
        const liste = stationenVon(modul);
        const geschafft = liste.filter(s => stationFertig(s, stande[s.id])).length;
        const fertig = modulFertig(modul, stande);
        const m = meldung[modul];
        return (
          <section key={modul} className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold" style={{ color: b.farbe }}>
              {b.icon} {b.name} <span className="text-sm text-muted font-normal">· {geschafft}/{liste.length} Stationen</span>
            </h3>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
              {liste.map(s => {
                const ok = stationFertig(s, stande[s.id]);
                const angefangen = !!stande[s.id];
                return (
                  <button key={s.id} onClick={() => setOffen(s.id)}
                    className="card p-3 text-left hover:bg-surface-hover flex flex-col gap-1"
                    style={{ borderLeft: `4px solid ${b.farbe}` }}>
                    <span className="text-2xl">{s.icon}</span>
                    <span className="font-medium">{s.titel}</span>
                    <span className="text-xs text-muted">
                      Stufe {s.stufe} · {s.minuten} min{s.ais ? " · 🤖 AIS.chat" : ""}
                    </span>
                    <span className="text-xs">{ok ? "✅ geschafft" : angefangen ? "✏️ angefangen" : "○ offen"}</span>
                  </button>
                );
              })}
            </div>
            {fertig && konto && (
              <div className="flex items-center gap-3 text-sm">
                {!m && <button className="btn-primary" onClick={() => melden(modul)}>🎓 Modul {b.name} abschließen</button>}
                {m === "fehler" && <span className="text-bad">Das hat nicht geklappt. Ist dein Stand gespeichert? Versuch es gleich noch einmal.</span>}
                {m && m !== "fehler" && (
                  <span className="text-ok">
                    Modul bestanden!{m.punkte > 0 ? ` +${m.punkte} Hauspunkte${m.haus ? ` für ${m.haus}` : ""}.` : m.schon_vergeben ? " (Punkte gab es schon.)" : ""}
                  </span>
                )}
              </div>
            )}
          </section>
        );
      })}
      <Urkunde name={name} fertig={fuehrerscheinFertig(stande)} stande={stande} />
    </div>
  );
}

function Urkunde({ name, fertig, stande }: { name: string; fertig: boolean; stande: Record<string, StationStand> }) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [eigenerName, setEigenerName] = useState(name);
  if (!fertig) {
    return (
      <section className="card p-4 text-sm text-muted">
        🪪 Die Urkunde »KI-Führerschein Stufe I« gibt es, sobald alle vier Module geschafft sind.
      </section>
    );
  }
  const daten = Object.values(stande).map(s => s.erledigt_am).filter((d): d is string => !!d).sort();
  const datum = daten.at(-1) ?? heute();

  async function pdf() {
    const c = leinwand.current!;
    c.width = 1754; c.height = 1240; // A4 quer, 150 dpi
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "#1f6fb5"; g.lineWidth = 16; g.strokeRect(40, 40, c.width - 80, c.height - 80);
    g.textAlign = "center"; g.fillStyle = "#222222";
    g.font = "bold 110px sans-serif"; g.fillText("🧭 KI-Führerschein", c.width / 2, 260);
    g.font = "56px sans-serif"; g.fillText("Stufe I · Basis", c.width / 2, 350);
    g.font = "bold 90px sans-serif"; g.fillText(eigenerName.trim() || "________________", c.width / 2, 560);
    g.font = "44px sans-serif";
    g.fillText("hat alle vier Module des KI-Führerscheins erfolgreich abgeschlossen:", c.width / 2, 680);
    BEREICHE.forEach((b, i) => {
      g.fillStyle = b.farbe; g.font = "bold 48px sans-serif";
      g.fillText(`${b.name}`, 300 + i * 385, 800);
    });
    g.fillStyle = "#222222"; g.font = "40px sans-serif";
    g.fillText(`Datum: ${datumDe(datum)}`, c.width / 2, 950);
    g.font = "26px sans-serif"; g.fillStyle = "#666666";
    g.fillText("Kompetenzbereiche nach Alles, Falck, Flick & Schulz (2025), CC BY 4.0 · TT – Teaching Tools", c.width / 2, 1120);
    herunterladen(await leinwandAlsPdf(c), "KI-Fuehrerschein.pdf");
  }

  return (
    <section className="card p-4 flex flex-col gap-3 items-start">
      <h3 className="text-lg font-semibold">🪪 Deine Urkunde</h3>
      <label className="text-sm flex flex-col gap-1">
        Name auf der Urkunde
        <input className="input" value={eigenerName} maxLength={60} onChange={e => setEigenerName(e.target.value)} />
      </label>
      <button className="btn-primary" onClick={pdf}>⬇️ KI-Führerschein als PDF</button>
      <canvas ref={leinwand} className="hidden" />
    </section>
  );
}
