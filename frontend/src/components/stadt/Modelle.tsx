"use client";
/**
 * Stadtstrukturmodelle als Schema (Lehrplan Kl. 12: »theoretische Grundlagen
 * der Stadtgeografie«): Burgess, Hoyt, Harris-Ullman, lateinamerikanische
 * Stadt (Borsdorf/Bähr/Janoschka) und orientalische Stadt (Dettmann/Wirth).
 */
const ZENTRUM = "#7f8fa3", UEBERGANG = "#bfae9d", ARBEIT = "#d1b48f", WOHNEN = "#d8d0a4", PENDLER = "#dbe3b4", INDUSTRIE = "#a9a29b", OBEN = "#efe6cf", ARM = "#c7a585";

function Legende({ e }: { e: [string, string][] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {e.map(([f, t]) => <li key={t} className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-black/20" style={{ background: f }} />{t}</li>)}
    </ul>
  );
}

const keil = (r: number, a0: number, a1: number, r0 = 0) => {
  const p = (w: number, rr: number) => `${100 + Math.cos(w) * rr},${100 + Math.sin(w) * rr}`;
  return `M${p(a0, r0)} L${p(a0, r)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1, r)} L${p(a1, r0)} ${r0 ? `A${r0},${r0} 0 ${a1 - a0 > Math.PI ? 1 : 0} 0 ${p(a0, r0)}` : ""} Z`;
};

const MODELLE = [
  {
    titel: "Ringmodell (Burgess 1925)", text: "Chicago: Die Stadt wächst von innen nach außen in Ringen. Jede Gruppe zieht weiter hinaus, sobald sie es sich leisten kann.",
    svg: <>{[[96, PENDLER], [76, WOHNEN], [56, ARBEIT], [36, UEBERGANG], [16, ZENTRUM]].map(([r, f]) => <circle key={String(r)} cx={100} cy={100} r={Number(r)} fill={String(f)} stroke="#0003" />)}</>,
    legende: [[ZENTRUM, "CBD"], [UEBERGANG, "Übergangszone"], [ARBEIT, "Arbeiter"], [WOHNEN, "Wohnen"], [PENDLER, "Pendler"]] as [string, string][],
  },
  {
    titel: "Sektorenmodell (Hoyt 1939)", text: "Viertel wachsen keilförmig entlang von Verkehrswegen: Industrie an Bahn und Fluss, die Oberschicht in die schönste Richtung.",
    svg: <>
      <circle cx={100} cy={100} r={96} fill={WOHNEN} stroke="#0003" />
      <path d={keil(96, -0.4, 0.4)} fill={INDUSTRIE} stroke="#0003" />
      <path d={keil(96, 0.4, 1.2)} fill={ARBEIT} stroke="#0003" />
      <path d={keil(96, -1.2, -0.4)} fill={ARBEIT} stroke="#0003" />
      <path d={keil(96, 2.3, 3.3)} fill={OBEN} stroke="#0003" />
      <circle cx={100} cy={100} r={16} fill={ZENTRUM} stroke="#0003" />
    </>,
    legende: [[ZENTRUM, "CBD"], [INDUSTRIE, "Industrie"], [ARBEIT, "Arbeiter"], [WOHNEN, "Mittelschicht"], [OBEN, "Oberschicht"]] as [string, string][],
  },
  {
    titel: "Mehrkernmodell (Harris & Ullman 1945)", text: "Große Städte haben mehrere Zentren: altes CBD, Industriegebiete, Vorortzentren, Malls — Edge Cities.",
    svg: <>
      <rect x={4} y={4} width={192} height={192} rx={8} fill={WOHNEN} stroke="#0003" />
      <path d="M20 120 Q60 90 110 140 T190 150 L190 196 L20 196Z" fill={ARBEIT} stroke="#0003" />
      <path d="M120 20 Q170 30 190 60 L190 4 L120 4Z" fill={OBEN} stroke="#0003" />
      <rect x={30} y={140} width={50} height={30} fill={INDUSTRIE} stroke="#0003" />
      <circle cx={95} cy={90} r={16} fill={ZENTRUM} stroke="#0003" />
      <circle cx={160} cy={50} r={10} fill={ZENTRUM} stroke="#0003" />
      <circle cx={150} cy={160} r={10} fill="#c8bfd6" stroke="#0003" />
    </>,
    legende: [[ZENTRUM, "Zentren"], [INDUSTRIE, "Industrie"], [ARBEIT, "Unterschicht"], [WOHNEN, "Mittelschicht"], [OBEN, "Oberschicht"], ["#c8bfd6", "Mall / Gewerbe"]] as [string, string][],
  },
  {
    titel: "Lateinamerikanische Stadt (Borsdorf, Bähr, Janoschka 2002)", text: "Kolonialer Kern mit Plaza, ein Oberschicht-Sektor, ein Industriesektor, Marginalsiedlungen am Rand — und heute Inseln: Gated Communities und Malls an der Stadtautobahn.",
    svg: <>
      <circle cx={100} cy={100} r={96} fill={ARBEIT} stroke="#0003" />
      <path d={keil(96, -2.0, -1.2, 18)} fill={OBEN} stroke="#0003" />
      <path d={keil(96, 0.9, 1.5, 18)} fill={INDUSTRIE} stroke="#0003" />
      {[[30, 150], [165, 120], [150, 40], [40, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={14} fill={ARM} stroke="#0003" />)}
      {[[70, 25], [120, 22]].map(([x, y]) => <rect key={x} x={x - 9} y={y - 9} width={18} height={18} fill="#e6dcc0" stroke="#333" />)}
      <circle cx={100} cy={100} r={84} fill="none" stroke="#f7c46c" strokeWidth={4} />
      <rect x={88} y={88} width={24} height={24} fill="#b9a48a" stroke="#0003" />
    </>,
    legende: [["#b9a48a", "Kern (verfallen)"], [OBEN, "Oberschicht-Sektor"], [INDUSTRIE, "Industrie"], [ARBEIT, "Mittel-/Unterschicht"], [ARM, "Marginalsiedlung"], ["#e6dcc0", "Gated Community"], ["#f7c46c", "Stadtautobahn"]] as [string, string][],
  },
  {
    titel: "Orientalische Stadt (Dettmann, Wirth)", text: "Medina mit Freitagsmoschee und Bazar im Zentrum, Wohnquartiere mit Sackgassen, Kasbah an der Mauer; daneben die Neustadt der Kolonialzeit.",
    svg: <>
      <rect x={4} y={4} width={192} height={192} rx={8} fill="#f1efe6" stroke="#0003" />
      <path d="M20 100 Q22 40 80 28 Q140 24 150 80 Q156 140 100 160 Q30 170 20 100Z" fill="#e7dcc6" stroke="#5e5348" strokeWidth={3} />
      <path d="M85 92 L40 70 M85 92 L120 40 M85 92 L140 120 M85 92 L60 150" stroke="#d9b98a" strokeWidth={10} />
      <circle cx={85} cy={92} r={10} fill="#7a9a6a" stroke="#0003" />
      <rect x={118} y={118} width={28} height={22} fill="#c8a57a" stroke="#0003" />
      <path d="M150 170 L196 170 L196 196 L150 196Z" fill="#e6e2d6" stroke="#0003" />
      <path d="M160 150 L196 150 L196 170 L160 170Z" fill="#e6e2d6" stroke="#0003" />
    </>,
    legende: [["#7a9a6a", "Freitagsmoschee"], ["#d9b98a", "Bazar"], ["#e7dcc6", "Wohnquartiere (Sackgassen)"], ["#c8a57a", "Kasbah"], ["#e6e2d6", "Ville nouvelle"]] as [string, string][],
  },
];

export default function Modelle() {
  return (
    <section className="card p-4 text-sm">
      <h2 className="mb-1 text-lg font-black">📐 Stadtstrukturmodelle</h2>
      <p className="mb-3 text-muted">Modelle vereinfachen: Sie zeigen, wo welche Gruppen und Nutzungen typischerweise liegen. Vergleiche sie mit den Karten im Reiter »Wachstum« (»Viertel farbig«).</p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODELLE.map(m => (
          <figure key={m.titel} className="rounded-xl border border-line p-3">
            <svg viewBox="0 0 200 200" className="mx-auto block w-40" role="img" aria-label={m.titel}>{m.svg}</svg>
            <figcaption>
              <div className="mt-2 font-bold">{m.titel}</div>
              <p className="text-muted">{m.text}</p>
              <Legende e={m.legende} />
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
