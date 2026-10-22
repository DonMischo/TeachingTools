/**
 * Galerie »Echte Vulkane«: Fotos von Wikimedia Commons mit Erklärung.
 * Dateien und Lizenzen holt scripts/fetch-vulkan.mjs nach
 * public/vulkan/galerie/ bzw. bilder.json — hier stehen nur die Texte.
 */
import nachweise from "./bilder.json";
import type { FotoBereich, FotoBild, Nachweis } from "@/components/galerie/FotoGalerie";
import type { TypId } from "./modell";

export const BEREICHE: FotoBereich[] = [
  { id: "schicht", name: "Schichtvulkane", icon: "🗻" },
  { id: "ausbruch", name: "Ausbruch: Säule, Asche, Glutwolken", icon: "💥" },
  { id: "schild", name: "Schildvulkane und Lava", icon: "🛡️" },
  { id: "hotspot", name: "Hotspots", icon: "🌺" },
  { id: "formen", name: "Caldera, Dom, Kegel, Säulen", icon: "⭕" },
  { id: "deutschland", name: "Vulkane in Deutschland", icon: "🇩🇪" },
];

export interface VulkanBild extends FotoBild {
  /** passt zu diesem Vulkantyp der Simulation (Bildstreifen darunter) */
  typ?: TypId;
}

export const GALERIE: VulkanBild[] = [
  // ── Schichtvulkane ──
  { id: "fuji", bereich: "schicht", typ: "schicht", titel: "Fuji (Japan)",
    text: "Der Fuji ist ein fast perfekter Kegel: 3776 m hoch, die Hänge oben über 30° steil. Er besteht aus vielen Schichten von Asche, Schlacke und Lava — typisch für Vulkane über einer Subduktionszone.", begriffe: ["Kegelform", "steile Flanken"] },
  { id: "mayon", bereich: "schicht", typ: "schicht", titel: "Mayon (Philippinen)",
    text: "Der Mayon gilt als der regelmäßigste Vulkankegel der Erde und ist einer der aktivsten der Philippinen. Rinnen an den Flanken zeigen, wo Glutlawinen und Schlammströme (Lahare) abgehen.", begriffe: ["Kegel", "Rinnen"] },
  { id: "vesuv", bereich: "schicht", typ: "schicht", titel: "Vesuv über dem Golf von Neapel",
    text: "Der Vesuv begrub 79 n. Chr. Pompeji unter Asche und Bims. Heute leben Hunderttausende an seinen Hängen — deshalb wird er genau überwacht.", begriffe: ["Somma-Wall", "Kegel"] },
  { id: "teide", bereich: "schicht", typ: "schicht", titel: "Teide und Pico Viejo (Teneriffa)",
    text: "Links der Teide, mit 3715 m der höchste Berg Spaniens, rechts sein Nachbar Pico Viejo mit großem Krater. Beide stehen in einer riesigen älteren Caldera.", begriffe: ["Krater", "Nebenvulkan"] },
  { id: "stromboli-sciara", bereich: "schicht", typ: "schicht", titel: "Sciara del Fuoco am Stromboli",
    text: "Die »Feuerrutsche«: Über diesen steilen Hang laufen Lava, Lavabrocken und Schlacke bis ins Meer. Der Stromboli bricht seit über 2000 Jahren fast ständig in kleinen Explosionen aus.", begriffe: ["Schutthang", "Schlacke"] },
  // ── Ausbruch ──
  { id: "st-helens-1980", bereich: "ausbruch", typ: "schicht", titel: "Mount St. Helens, 18. Mai 1980",
    text: "Die Eruptionssäule stieg in 15 Minuten auf über 24 km Höhe. Zuvor war die ganze Nordflanke abgerutscht — der Gipfel war danach 400 m niedriger.", begriffe: ["Eruptionssäule", "Aschewolke"] },
  { id: "pinatubo-1991", bereich: "ausbruch", typ: "schicht", titel: "Pinatubo (Philippinen), Juni 1991",
    text: "Drei Tage vor dem Hauptausbruch: eine Aschesäule über dem Vulkan. Der Ausbruch war einer der größten des 20. Jahrhunderts und kühlte die Erde ein Jahr lang um etwa 0,5 °C ab.", begriffe: ["Eruptionssäule", "Schirmwolke"] },
  { id: "pinatubo-glutwolke", bereich: "ausbruch", typ: "schicht", titel: "Glutwolken-Ablagerung am Pinatubo",
    text: "Pyroklastische Ströme — heiße Wolken aus Gas, Asche und Gestein — haben dieses Tal meterhoch aufgefüllt. Sie rasen mit über 100 km/h den Hang hinab.", begriffe: ["Ignimbrit", "aufgefülltes Tal"] },
  { id: "eyjafjallajoekull", bereich: "ausbruch", typ: "schicht", titel: "Eyjafjallajökull (Island), 2010",
    text: "Die Aschefahne zog mit dem Wind nach Südosten über Europa und legte tagelang den Flugverkehr lahm. Feine Asche schwebt lange in der Luft.", begriffe: ["Aschefahne", "Wind"] },
  { id: "aetna-iss", bereich: "ausbruch", typ: "schicht", titel: "Ätna aus der Raumstation",
    text: "Die Aschefahne des Ätna treibt mit dem Wind übers Meer. Von oben sieht man gut, dass die Asche nur zu einer Seite fällt.", begriffe: ["Aschefahne", "Windrichtung"] },
  { id: "mayon-nacht", bereich: "ausbruch", typ: "schicht", titel: "Mayon bei Nacht",
    text: "Glühende Lava und Gesteinsbrocken laufen die Flanken hinab. Lange Belichtung macht ihre Bahnen sichtbar.", begriffe: ["Lavastrom", "Glut"] },
  { id: "stromboli-1979", bereich: "ausbruch", typ: "schicht", titel: "Explosion am Stromboli (1979)",
    text: "Bei einer »strombolianischen« Explosion werden glühende Lavafetzen auf Wurfparabeln aus dem Krater geschleudert.", begriffe: ["Wurfbahnen", "Lapilli"] },
  { id: "aetna-asche", bereich: "ausbruch", typ: "schicht", titel: "Asche und Lapilli vom Ätna (2021)",
    text: "So sieht Tephra aus der Nähe aus: feine Asche und erbsen- bis nussgroße Lapilli, die nach einem Ausbruch auf Sizilien niedergingen.", begriffe: ["Asche", "Lapilli"] },
  { id: "lapilli", bereich: "ausbruch", typ: "schicht", titel: "Lapilli auf Lipari",
    text: "Lapilli (italienisch »Steinchen«) sind 2–64 mm große Auswurfbrocken. Locker aufgeschüttet halten sie nur einen Hang von etwa 30–35°.", begriffe: ["Lapilli", "Schüttwinkel"] },
  { id: "bombe", bereich: "ausbruch", titel: "Vulkanische Bombe",
    text: "Ein Lavafetzen, der im Flug abkühlte und dabei seine Spindelform bekam. Bomben sind größer als 64 mm und landen meist nahe am Krater." },
  // ── Schildvulkane und Lava ──
  { id: "skjaldbreidur", bereich: "schild", typ: "schild", titel: "Skjaldbreiður (Island)",
    text: "Nach diesem Berg sind die Schildvulkane benannt: »Skjaldbreiður« heißt »breiter Schild«. Die Hänge steigen nur mit etwa 7° an — gebaut aus dünnflüssiger Basaltlava.", begriffe: ["flache Hänge", "Schildform"] },
  { id: "mauna-loa", bereich: "schild", typ: "hotspot", titel: "Mauna Loa (Hawaii)",
    text: "Der größte Vulkan der Erde: über 4000 m über dem Meer, vom Meeresboden aus mehr als 9000 m hoch. Trotzdem sieht er flach aus — die Hänge haben nur 4–6°.", begriffe: ["Schildvulkan", "flache Hänge"] },
  { id: "lavafontaene", bereich: "schild", typ: "schild", titel: "Lavafontänen am Kīlauea (2018)",
    text: "Dünnflüssiges Basaltmagma: Das Gas entweicht leicht und reißt die Lava zu Fontänen hoch. Die Spritzer fallen zurück und fließen als Lavastrom weiter.", begriffe: ["Lavafontäne", "Spalte"] },
  { id: "pahoehoe", bereich: "schild", typ: "schild", titel: "Pāhoehoe-Lava",
    text: "Heiße, dünnflüssige Basaltlava erstarrt mit glatter, seiliger Haut — »Pāhoehoe« ist hawaiisch und heißt etwa »glatt«.", begriffe: ["Stricklava"] },
  { id: "pahoehoe-aa", bereich: "schild", typ: "schild", titel: "Pāhoehoe und ʻAʻā nebeneinander",
    text: "Vorn glatte Pāhoehoe-Lava, dahinter raue, brockige ʻAʻā-Lava. Wird die Lava kühler und zäher, zerbricht ihre Kruste in scharfkantige Blöcke.", begriffe: ["Pāhoehoe", "ʻAʻā"] },
  { id: "mauna-loa-2022", bereich: "schild", typ: "schild", titel: "Lavafront am Mauna Loa (2022)",
    text: "Die Front eines ʻAʻā-Stroms schiebt sich langsam voran. Vorn kühlt sie ab und bricht, von hinten drückt heiße Lava nach." },
  { id: "lavaroehre", bereich: "schild", typ: "schild", titel: "Lavaröhre (Thurston Lava Tube)",
    text: "Erstarrt ein Lavastrom außen, fließt innen heiße Lava weiter wie in einem Rohr — sie kühlt kaum ab und kommt so viele Kilometer weit. Läuft die Röhre leer, bleibt ein Tunnel." },
  { id: "lava-meer", bereich: "schild", typ: "hotspot", titel: "Lava erreicht den Pazifik",
    text: "Im Wasser erstarrt Lava blitzschnell, es zischt und dampft. So wachsen Vulkaninseln ins Meer hinaus." },
  // ── Hotspots ──
  { id: "hawaii-iss", bereich: "hotspot", typ: "hotspot", titel: "Die Hawaii-Inselkette aus dem All",
    text: "Die Inseln liegen wie an einer Schnur aufgereiht. Rechts unten die junge, große Hauptinsel Hawaiʻi mit ihren dunklen Lavafeldern; nach Nordwesten (nach oben links) werden die Inseln älter und kleiner.", begriffe: ["Inselkette"] },
  { id: "hawaii-emperor", bereich: "hotspot", typ: "hotspot", titel: "Hawaii-Emperor-Kette",
    text: "Unter dem Meer setzt sich die Kette als Reihe von Seamounts fort, bis über 80 Millionen Jahre alt. Der Knick vor etwa 47 Mio. Jahren zeigt, dass die Pazifische Platte damals ihre Richtung änderte.", begriffe: ["Seamounts", "Knick"] },
  { id: "hawaii-hotspot", bereich: "hotspot", typ: "hotspot", titel: "So funktioniert ein Hotspot",
    text: "Der Mantelplume bleibt an Ort und Stelle, die Platte wandert darüber hinweg. Jeder Vulkan wird vom Nachschub abgeschnitten, erlischt und sinkt langsam ab.", begriffe: ["Mantelplume", "Plattenbewegung"] },
  { id: "halemaumau", bereich: "hotspot", typ: "hotspot", titel: "Lavasee im Halemaʻumaʻu (Kīlauea, 2021)",
    text: "Im Gipfelkrater des Kīlauea steht ein See aus flüssiger Lava. Der Kīlauea sitzt heute direkt über dem Hawaii-Hotspot.", begriffe: ["Lavasee", "Gipfelkrater"] },
  { id: "kissenlava", bereich: "hotspot", typ: "hotspot", titel: "Kissenlava vor Hawaii",
    text: "Unter Wasser bildet Lava runde »Kissen«: Die Haut erstarrt sofort, das Innere drückt nach und quillt zum nächsten Kissen heraus. So beginnt jede Vulkaninsel am Meeresboden." },
  { id: "loihi-kissenlava", bereich: "hotspot", typ: "hotspot", titel: "Kissenlava vom jüngsten Hawaii-Vulkan",
    text: "Gesammelt am Kamaʻehuakanaloa (früher Lōʻihi), einem Seamount südöstlich der Hauptinsel. Er wächst noch unter Wasser — in einigen zehntausend Jahren wird er zur nächsten Insel." },
  { id: "yellowstone", bereich: "hotspot", typ: "hotspot", titel: "Yellowstone: Hotspot unter einem Kontinent",
    text: "Auch unter Yellowstone liegt ein Hotspot, doch unter dem Kontinent ist das Magma zäh und gasreich: Riesige Ausbrüche haben Calderen hinterlassen. Heute zeugen heiße Quellen wie die Grand Prismatic Spring davon.", begriffe: ["heiße Quelle"] },
  { id: "fernandina", bereich: "hotspot", typ: "hotspot", titel: "Fernandina (Galápagos)",
    text: "Die jüngste Galápagos-Insel ist ein Schildvulkan über dem Galápagos-Hotspot — mit einer großen Gipfelcaldera." },
  // ── Formen ──
  { id: "crater-lake", bereich: "formen", titel: "Crater Lake (USA)",
    text: "Vor 7700 Jahren brach der Vulkan Mount Mazama nach einem gewaltigen Ausbruch in seine leere Magmakammer ein. In der Caldera (8 km breit) sammelte sich ein See, 594 m tief.", begriffe: ["Caldera", "Kratersee"] },
  { id: "santorin", bereich: "formen", titel: "Caldera von Santorin",
    text: "Die Inseln sind der Rand einer Caldera, die vor etwa 3600 Jahren einbrach. In der Mitte wächst mit Nea Kameni schon ein neuer Vulkan.", begriffe: ["Calderarand", "neuer Vulkan"] },
  { id: "st-helens-dom", bereich: "formen", typ: "schicht", titel: "Lavadom im Krater des Mount St. Helens",
    text: "Nach 1980 quoll sehr zähe Lava aus dem Schlot und türmte sich zu einem Dom — sie war zu zäh, um zu fließen.", begriffe: ["Lavadom", "Krater"] },
  { id: "paricutin", bereich: "formen", titel: "Parícutin (Mexiko)",
    text: "1943 öffnete sich in einem Maisfeld eine Spalte. In einem Jahr wuchs daraus ein 336 m hoher Schlackenkegel — gasreicher Basalt, Fontänen und Lapilli.", begriffe: ["Schlackenkegel"] },
  { id: "basaltsaeulen", bereich: "formen", typ: "schild", titel: "Basaltsäulen (Giant's Causeway)",
    text: "Ein dicker Basaltstrom zog sich beim langsamen Abkühlen zusammen und riss in sechseckige Säulen — wie trocknender Schlamm.", begriffe: ["Säulen", "Abkühlung"] },
  // ── Deutschland ──
  { id: "laacher-see", bereich: "deutschland", titel: "Laacher See (Eifel)",
    text: "Vor rund 13 000 Jahren explodierte hier ein Vulkan; seine Asche fand man bis nach Schweden und Italien. Der See füllt die Caldera.", begriffe: ["Caldera"] },
  { id: "weinfelder-maar", bereich: "deutschland", titel: "Weinfelder Maar (Eifel)",
    text: "Ein Maar entsteht, wenn aufsteigendes Magma auf Grundwasser trifft: Der Dampf sprengt einen runden Trichter, in dem sich später Wasser sammelt.", begriffe: ["Maar"] },
  { id: "vogelsberg", bereich: "deutschland", typ: "schild", titel: "Vogelsberg (Hessen)",
    text: "Das größte zusammenhängende Basaltgebiet Mitteleuropas. Vor 15–19 Millionen Jahren flossen hier viele dünnflüssige Lavaströme übereinander — heute ein flaches, abgetragenes Bergland." },
  { id: "rhoen-basalt", bereich: "deutschland", typ: "schild", titel: "Basalt in der Rhön",
    text: "Die Kuppen der Rhön sind Reste von Basaltvulkanen; das harte Gestein blieb stehen, als die weichere Umgebung abgetragen wurde.", begriffe: ["Basaltblöcke", "Kuppe"] },
];

const alle = nachweise as Record<string, Nachweis>;
export const nachweisFuer = (id: string): Nachweis | undefined => alle[id];
export const bilderZuTyp = (typ: TypId) => GALERIE.filter(b => b.typ === typ);
