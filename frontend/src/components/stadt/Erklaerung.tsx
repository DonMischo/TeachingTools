"use client";
/** Reiter »So geht's«: Stadttypen im Vergleich, Stadtmodelle, Standortfaktoren, Quellen */
import Modelle from "./Modelle";

const TYPEN = [
  {
    icon: "🏛️", titel: "Römische Stadt", zeit: "1. Jh. v. Chr. – 4. Jh. n. Chr.",
    punkte: [
      ["Entstehung", "Auf einmal geplant: als Kolonie für Veteranen oder aus einem Legionslager."],
      ["Grundriss", "Rechteck, Raster aus Insulae; Cardo (N–S) und Decumanus (O–W) kreuzen sich am Forum."],
      ["Lage", "Eben, trocken, nahe am Fluss oder an der Küste, an einer Fernstraße."],
      ["Zentrum", "Forum mit Tempel, Basilika und Markt."],
      ["Typisch", "Thermen, Aquädukt, Amphitheater vor der Mauer, Gräber an den Ausfallstraßen."],
      ["Beispiele", "Köln (Colonia Claudia Ara Agrippinensium), Trier, Xanten, Augsburg."],
    ],
  },
  {
    icon: "⛪", titel: "Europäische (mittelalterliche) Stadt", zeit: "ab dem 11. Jh., gewachsen bis heute",
    punkte: [
      ["Entstehung", "Gewachsen: aus Burg, Kloster, Furt oder Marktsiedlung; Stadtrecht durch den Stadtherrn."],
      ["Grundriss", "Unregelmäßig, krumme Gassen auf Markt und Tore zu, Mauer folgt dem Gelände."],
      ["Lage", "Flussübergang (Furt, Brücke), Kreuzung von Handelswegen, Schutz durch eine Anhöhe."],
      ["Zentrum", "Marktplatz mit Rathaus und Kirche."],
      ["Wandel", "Vorstädte → Mauer fällt, Ring entsteht → Bahnhof, Gründerzeit, Industrie → Großsiedlungen, Einfamilienhäuser, Einkaufszentren."],
      ["Beispiele", "Erfurt, Nürnberg, Rothenburg; Ringe in Wien und Köln."],
    ],
  },
  {
    icon: "🏙️", titel: "Amerikanische Stadt", zeit: "ab dem 19. Jh.",
    punkte: [
      ["Entstehung", "Geplant und verkauft: Eisenbahngesellschaften und Landspekulanten legten Städte an."],
      ["Grundriss", "Schachbrett nach Himmelsrichtungen (Land Ordinance 1785), unabhängig vom Gelände."],
      ["Lage", "An der Bahnlinie, später am Highway."],
      ["Zentrum", "CBD mit Hochhäusern; abends leer."],
      ["Wandel", "Straßenbahn-Vororte → Auto, Suburbs mit Sackgassen → Beltway, Malls, Edge Cities, Urban Sprawl."],
      ["Modell", "Ringmodell nach Burgess (1925): CBD, Übergangszone, Arbeiter, Wohnen, Pendler."],
    ],
  },
  {
    icon: "👑", titel: "Residenzstadt", zeit: "17./18. Jh. (Absolutismus)",
    punkte: [
      ["Entstehung", "Auf einmal geplant nach dem Willen des Fürsten, oft auf freiem Land."],
      ["Grundriss", "Achsen und Strahlen laufen auf das Schloss zu (Fächer), streng symmetrisch."],
      ["Typisch", "Schlossgarten, Hoftheater, Kasernen, einheitliche Modellhäuser."],
      ["Beispiele", "Karlsruhe (1715), Mannheim, Ludwigsburg; Residenzen in Thüringen: Weimar, Gotha, Meiningen."],
    ],
  },
  {
    icon: "⭐", titel: "Festungsstadt", zeit: "17./18. Jh.",
    punkte: [
      ["Entstehung", "Gegen Artillerie: niedrige Wälle mit Bastionen (Vauban)."],
      ["Grundriss", "Sternförmiger Wall, Graben, Glacis; innen Raster um den Paradeplatz."],
      ["Wandel", "Entfestigung im 19. Jh.: Ringe und Parks auf den Wällen."],
      ["Beispiele", "Neuf-Brisach, Saarlouis; Zitadelle Petersberg in Erfurt."],
    ],
  },
  {
    icon: "🏭", titel: "Sozialistische Stadt", zeit: "DDR, 1950–1990",
    punkte: [
      ["Entstehung", "Für einen Großbetrieb geplant, nach den »16 Grundsätzen des Städtebaus« (1950)."],
      ["Grundriss", "Magistrale zum zentralen Platz mit Kulturhaus, Wohnkomplexe mit eigener Versorgung."],
      ["Wandel", "Plattenbau (WBS 70) → nach 1990 Schrumpfung, Leerstand, Rückbau (Stadtumbau Ost)."],
      ["Beispiele", "Eisenhüttenstadt, Halle-Neustadt, Schwedt; in Erfurt der Herrenberg und der Roter Berg."],
    ],
  },
  {
    icon: "⛪", titel: "Lateinamerikanische Stadt", zeit: "ab dem 16. Jh.",
    punkte: [
      ["Entstehung", "Kolonialstadt nach den Leyes de Indias (1573): Schachbrett um die Plaza Mayor."],
      ["Phasen", "kompakt → sektoral → polarisiert → fragmentiert (Borsdorf, Bähr, Janoschka 2002)."],
      ["Typisch", "Marginalsiedlungen in Ungunstlagen, Gated Communities, Malls — Segregation."],
      ["Beispiele", "Lima, Santiago de Chile, Mexiko-Stadt, São Paulo."],
    ],
  },
  {
    icon: "🕌", titel: "Orientalische Stadt", zeit: "ab dem 7. Jh.",
    punkte: [
      ["Zentrum", "Freitagsmoschee mit Bazar (Suq), nach Waren geordnet."],
      ["Wohnen", "Quartiere mit Sackgassen und Innenhofhäusern — Privatsphäre."],
      ["Wandel", "Kolonialzeit: Ville nouvelle daneben (dualistische Stadt); heute Wachstum und Tourismus."],
      ["Beispiele", "Fès, Marrakesch, Tunis, Damaskus."],
    ],
  },
];

export default function Erklaerung() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TYPEN.map(t => (
          <section key={t.titel} className="card p-4">
            <h2 className="text-lg font-black">{t.icon} {t.titel}</h2>
            <p className="mb-2 text-xs text-muted">{t.zeit}</p>
            <dl className="flex flex-col gap-1.5 text-sm">
              {t.punkte.map(([k, v]) => <div key={k}><dt className="font-bold">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </section>
        ))}
      </div>
      <Modelle />
      <section className="card p-4 text-sm">
        <h2 className="mb-2 text-lg font-black">📍 Standortfaktoren — worauf es ankommt</h2>
        <ul className="grid gap-1 md:grid-cols-2">
          <li>💧 <b>Wasser</b>: Trinkwasser, Mühlen, Transport per Schiff — aber nicht <b>in</b> der Aue (Hochwasser).</li>
          <li>🛤️ <b>Verkehr</b>: Fernstraßen, Furten, Brücken, später Bahn und Autobahn.</li>
          <li>⛰️ <b>Schutz</b>: Anhöhe für die Burg, Fluss als Graben, Mauer.</li>
          <li>📐 <b>Gelände</b>: Ein Raster braucht ebenes Land, krumme Gassen passen sich an.</li>
          <li>💰 <b>Bodenpreis</b>: Teuer im Zentrum (Hochhäuser), billig draußen (Malls, Suburbs).</li>
          <li>🏭 <b>Arbeit</b>: Fabriken an Bahn und Fluss, Wohnungen in der Nähe.</li>
        </ul>
        <p className="mt-3 text-muted">Unten links in der Karte steht beim Darüberfahren, was dort ist: Höhe, Neigung, Aue und Abstand zum Wasser. Mit 🎲 entsteht ein neues Gelände, 🌧️ lässt Regen das Gelände über Jahrtausende formen.</p>
      </section>
      <section className="card p-4 text-sm">
        <h2 className="mb-2 text-lg font-black">🛠️ So ist die Simulation gebaut</h2>
        <ul className="flex flex-col gap-1">
          <li><b>Gelände</b>: Perlin-Rauschen, ein Fluss mit Aue und Furt, Hügel. <b>Erosion</b> nach der »Simulation« aus <a className="underline" href="https://github.com/dandrino/terrain-erosion-3-ways" target="_blank" rel="noreferrer">terrain-erosion-3-ways</a> von Daniel Andrino (MIT).</li>
          <li><b>Straßen</b>: Gassen, Vororte und Gründerzeit folgen einem Tensorfeld wie in <a className="underline" href="https://github.com/ProbableTrain/MapGenerator" target="_blank" rel="noreferrer">MapGenerator</a> von Keir (LGPL-3.0); alte Fernstraßen suchen den bequemsten Weg über das Gelände.</li>
          <li><b>3D-Flug</b>: der Algorithmus von »Voxel Space« (NovaLogic, 1992), erklärt von <a className="underline" href="https://github.com/s-macke/VoxelSpace" target="_blank" rel="noreferrer">Sebastian Macke</a> (MIT).</li>
          <li>Alles neu in TypeScript geschrieben, kein Code und keine Karten übernommen.</li>
        </ul>
      </section>
    </div>
  );
}
