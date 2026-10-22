"use client";
/**
 * Galerie »Echte Küsten«: Fotos von Rügen, Møn, Sylt, Wattenmeer und
 * Küstenschutz — mit Erklärung, Begriffen zum Entdecken und Nachweis.
 * `BildStreifen` zeigt eine Auswahl (z. B. die Bilder zu einem Kliff).
 */
import FotoGalerie, { BildStreifen as Streifen } from "@/components/galerie/FotoGalerie";
import { BEREICHE, GALERIE, nachweisFuer, type GalerieBild } from "@/lib/kueste/galerie";

export function BildStreifen({ bilder }: { bilder: GalerieBild[] }) {
  return <Streifen bilder={bilder} nachweisFuer={nachweisFuer} />;
}

export default function KuestenGalerie() {
  return (
    <FotoGalerie
      bilder={GALERIE} bereiche={BEREICHE} nachweisFuer={nachweisFuer}
      einleitung="So sehen die Küsten aus, die im Querschnitt simuliert werden: Kreidefelsen auf Rügen und Møn, Steilufer aus Mergel und Sand, Watt, Dünen — und was Menschen zum Schutz bauen. Antippen vergrößert; mit ← → blätterst du."
    />
  );
}
