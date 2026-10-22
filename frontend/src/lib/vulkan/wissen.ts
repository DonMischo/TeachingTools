/**
 * Wissen zur Vulkan-Simulation: kurze Lexikon-Einträge zu Auswurfmassen,
 * Ausbruchsarten, Lava und Gefahren — mit Fakten, Fotos aus der Galerie
 * (Ids aus galerie.ts) und einem Hinweis, wo man es in der Simulation sieht.
 */
import type { Stoff } from "./modell";

export type WissensGruppe = "tephra" | "ausbruch" | "lava" | "gefahr";

export const GRUPPEN: { id: WissensGruppe; name: string; icon: string }[] = [
  { id: "tephra", name: "Auswurf: Asche, Lapilli, Bomben", icon: "🪨" },
  { id: "ausbruch", name: "Wie Vulkane ausbrechen", icon: "💥" },
  { id: "lava", name: "Lava", icon: "🔥" },
  { id: "gefahr", name: "Gefahren und Überwachung", icon: "⚠️" },
];

export interface WissensEintrag {
  id: string;
  gruppe: WissensGruppe;
  icon: string;
  titel: string;
  /** ein Satz für die Liste */
  kurz: string;
  absaetze: string[];
  /** Merkmal → Wert */
  fakten?: [string, string][];
  /** Ids aus der Galerie */
  bilder: string[];
  /** wo man es in der Simulation sieht */
  sim?: string;
}

export const WISSEN: WissensEintrag[] = [
  // ── Auswurf ──
  {
    id: "tephra", gruppe: "tephra", icon: "🧺", titel: "Tephra — alles, was durch die Luft fliegt",
    kurz: "Sammelname für Asche, Lapilli und Bomben; unterschieden nach Korngröße.",
    absaetze: [
      "Bei einem explosiven Ausbruch zerreißt das Gas das Magma in Fetzen. Alles, was dabei durch die Luft geschleudert wird, heißt Tephra (griechisch für »Asche«). Man teilt sie nach der Korngröße ein — nicht nach dem Gestein.",
      "Je größer ein Stück, desto schneller fällt es und desto näher am Krater landet es. Darum liegen am Krater grobe Lapilli und Bomben, weiter weg nur noch feine Asche.",
    ],
    fakten: [["Asche", "kleiner als 2 mm"], ["Lapilli", "2 bis 64 mm (Erbse bis Walnuss)"], ["Bomben und Blöcke", "größer als 64 mm"], ["Verfestigt", "Asche → Tuff, Glutwolken-Ablagerung → Ignimbrit"]],
    bilder: ["aetna-asche", "lapilli", "bombe", "ascheschichten"],
    sim: "Im Querschnitt: graue Teilchen sind Asche, braune Lapilli und Bomben. Die Asche fällt Schritt für Schritt und lässt den Kegel wachsen.",
  },
  {
    id: "asche", gruppe: "tephra", icon: "🌫️", titel: "Vulkanasche",
    kurz: "Winzige, scharfkantige Splitter aus Glas und Gestein — keine Asche wie im Kamin.",
    absaetze: [
      "Vulkanasche ist nicht verbrannt: Es sind feinste Splitter aus vulkanischem Glas, Kristallen und Gestein. Sie sind hart und scharfkantig, schmelzen in heißen Flugzeugtriebwerken und kratzen Scheiben.",
      "Feine Asche schwebt tagelang in der Luft und treibt Hunderte bis Tausende Kilometer weit. 2010 legte die Aschefahne des Eyjafjallajökull wochenlang Teile des europäischen Flugverkehrs lahm.",
    ],
    fakten: [["Größe", "unter 2 mm, oft unter 0,1 mm"], ["Fallgeschwindigkeit", "0,1 mm-Korn: etwa 0,5 m/s; feiner Staub: wenige cm/s"], ["Reichweite", "Hunderte bis Tausende km"], ["Gewicht", "nass bis etwa 1,5–2 t je m³: 10 cm können Dächer eindrücken"]],
    bilder: ["vulkanstaub", "eyjafjallajoekull", "aetna-iss", "sakurajima"],
    sim: "Die Aschewolke auf der Karte zieht mit dem Wind. Dreh am Regler »Wind« — die Ascheschicht wird in Windrichtung dicker.",
  },
  {
    id: "lapilli", gruppe: "tephra", icon: "🫘", titel: "Lapilli und Schlacke",
    kurz: "Erbsen- bis walnussgroße Brocken; bei Basalt dunkle, blasige Schlacke.",
    absaetze: [
      "Lapilli (italienisch »Steinchen«) fliegen auf steilen Bahnen aus dem Krater und fallen meist innerhalb weniger Kilometer. Bei Basalt sind sie dunkel und voller Blasen — man nennt sie Schlacke.",
      "Lose geschüttete Lapilli halten nur einen Hang von etwa 30–35°: Wird er steiler, rutschen sie nach. So entstehen Schlackenkegel mit geraden, gleich steilen Flanken.",
    ],
    fakten: [["Größe", "2–64 mm"], ["Fallgeschwindigkeit", "etwa 5–20 m/s"], ["Schüttwinkel", "etwa 30–35°"]],
    bilder: ["lapilli", "aetna-asche", "schlackenkegel", "paricutin"],
    sim: "Lockeres Material rutscht im Modell bis zum Schüttwinkel von 33° ab — erst Lava darüber hält einen steileren Hang.",
  },
  {
    id: "bomben", gruppe: "tephra", icon: "☄️", titel: "Bomben und Blöcke",
    kurz: "Große Brocken über 64 mm, die auf Wurfbahnen fliegen.",
    absaetze: [
      "Bomben sind Lavafetzen, die noch flüssig aus dem Krater fliegen. In der Luft drehen sie sich und erkalten — so bekommen sie Spindel- oder Brotlaibformen mit rissiger Kruste. Blöcke dagegen sind schon fest: alte Gesteinsbrocken, die die Explosion herausgerissen hat, kantig statt rund.",
      "Wegen ihres Gewichts fliegen sie wie geworfene Steine auf Wurfparabeln und landen meist in wenigen hundert Metern bis einigen Kilometern Entfernung.",
    ],
    fakten: [["Größe", "über 64 mm, manche so groß wie Autos"], ["Flugbahn", "Wurfparabel, kaum vom Wind beeinflusst"], ["Reichweite", "meist unter 5 km"]],
    bilder: ["bombe", "stromboli-1979"],
    sim: "Im Querschnitt fliegen Lapilli und Bomben auf Wurfbahnen, landen und rollen den Hang hinab.",
  },
  {
    id: "bims", gruppe: "tephra", icon: "🧽", titel: "Bims",
    kurz: "Erstarrter Gesteinsschaum, der auf Wasser schwimmt.",
    absaetze: [
      "Zähes, gasreiches Magma (viel Kieselsäure) schäumt beim Aufstieg auf wie eine geschüttelte Sprudelflasche. Erstarrt der Schaum blitzschnell, bleibt ein Gestein voller Bläschen: Bims. Er ist hell und so leicht, dass er schwimmt — nach Ausbrüchen im Meer treiben manchmal riesige Bimsflöße.",
      "Bims liegt vor allem um Vulkane mit zähem Magma, in Deutschland etwa um den Laacher See. Er wurde dort als Baustoff abgebaut.",
    ],
    fakten: [["Magma", "zäh, viel SiO₂ und Gas"], ["Dichte", "oft unter 1 g/cm³ — schwimmt"], ["Farbe", "hell, weiß bis grau"]],
    bilder: ["bims", "laacher-see"],
  },
  {
    id: "sedimentation", gruppe: "tephra", icon: "⬇️", titel: "Wie Asche sich ablagert",
    kurz: "Dick am Krater, dünn in der Ferne, länger in Windrichtung.",
    absaetze: [
      "Was aus der Säule fällt, sortiert sich nach Gewicht: Bomben und Lapilli fallen nah am Krater, feine Asche erst weit weg. Die Ablagerung wird mit der Entfernung schnell dünner — und sie zieht sich wie eine Zunge in die Richtung, in die der Wind weht.",
      "Geologen zeichnen dafür Linien gleicher Dicke (Isopachen). Aus ihnen lesen sie ab, wie groß ein Ausbruch war und woher der Wind wehte — auch bei Ausbrüchen, die Tausende Jahre zurückliegen. Jeder Ausbruch hinterlässt eine Schicht; viele Ausbrüche stapeln sich zu Ascheschichten wie auf Izu-Ōshima.",
    ],
    fakten: [["Nah am Krater", "grob und dick (Meter)"], ["Weit weg", "fein und dünn (Millimeter)"], ["Form", "lang gezogen in Windrichtung"]],
    bilder: ["ascheschichten", "augustine", "tuffring"],
    sim: "Genau so verteilt das Modell die Asche: ein Ring um den Krater (Lapilli) und eine Fahne mit dem Wind. Im Querschnitt siehst du die Schichten übereinander.",
  },
  {
    id: "tuff", gruppe: "tephra", icon: "🧱", titel: "Tuff und Ignimbrit",
    kurz: "Aus Asche wird Gestein: verfestigte Tephra.",
    absaetze: [
      "Liegt Asche lange genug, wird sie zusammengepresst und verkittet: Tuff. Er ist weich und leicht zu bearbeiten — der Weiberner Tuff aus der Eifel ist ein bekannter Baustein.",
      "Ignimbrit ist die Ablagerung von Glutwolken. War sie beim Ablagern noch heiß, verschweißen die Glasteilchen zu hartem Gestein. Ignimbrite füllen ganze Täler und können Hunderte Meter dick sein.",
    ],
    fakten: [["Tuff", "verfestigte Fallasche"], ["Ignimbrit", "Ablagerung einer Glutwolke"]],
    bilder: ["weiberner-tuff", "tuffring", "ignimbrit", "pinatubo-glutwolke"],
    sim: "Nach einem Caldera-Ausbruch liegt im Querschnitt eine helle Ignimbrit-Schicht, die in den Tälern am dicksten ist.",
  },
  // ── Ausbruchsarten ──
  {
    id: "hawaiianisch", gruppe: "ausbruch", icon: "⛲", titel: "Hawaiianisch: Lavafontänen",
    kurz: "Dünnflüssiger Basalt, wenig Explosion, viel fließende Lava.",
    absaetze: [
      "Basaltmagma ist heiß und dünnflüssig, das Gas entweicht leicht. Es reißt die Lava zu Fontänen hoch, die als Spritzer zurückfallen und als Lavaströme abfließen — oft aus langen Spalten. So wachsen Schildvulkane wie auf Hawaii und Island.",
    ],
    fakten: [["Magma", "Basalt, ~1200 °C, dünnflüssig"], ["Explosivität", "sehr gering (VEI 0–1)"], ["Beispiele", "Kīlauea, Mauna Loa, Island"]],
    bilder: ["lavafontaene", "halemaumau", "pahoehoe"],
    sim: "Typ »Schildvulkan« oder »Hotspot«: Im Querschnitt spritzen Lavafontänen, Spalten öffnen sich an den Flanken.",
  },
  {
    id: "strombolianisch", gruppe: "ausbruch", icon: "🎆", titel: "Strombolianisch: kleine Explosionen",
    kurz: "Gasblasen platzen im Krater und werfen glühende Fetzen.",
    absaetze: [
      "Große Gasblasen steigen im Schlot auf und platzen an der Oberfläche. Jede Explosion wirft glühende Lavafetzen und Schlacke einige hundert Meter hoch. Benannt nach dem Stromboli, der so seit über 2000 Jahren alle paar Minuten ausbricht — der »Leuchtturm des Mittelmeers«.",
    ],
    fakten: [["Magma", "Basalt bis basaltischer Andesit"], ["Explosivität", "gering (VEI 1–2)"], ["Ergebnis", "Schlackenkegel"]],
    bilder: ["stromboli-1979", "stromboli-sciara", "paricutin"],
  },
  {
    id: "vulkanianisch", gruppe: "ausbruch", icon: "💣", titel: "Vulkanianisch: kurze, heftige Schläge",
    kurz: "Zähes Magma verstopft den Schlot, bis der Druck ihn freisprengt.",
    absaetze: [
      "Zähes Magma bildet einen Pfropfen im Schlot. Darunter staut sich das Gas, bis es den Pfropfen in einer kurzen, heftigen Explosion zerschlägt. Dunkle Aschewolken steigen einige Kilometer hoch, Blöcke fliegen weit. Benannt nach der Insel Vulcano — die auch dem Wort »Vulkan« seinen Namen gab.",
    ],
    fakten: [["Magma", "Andesit, zäh"], ["Säule", "meist unter 10–20 km"], ["Beispiele", "Sakurajima, Fuego"]],
    bilder: ["sakurajima", "fuego", "mayon-nacht"],
  },
  {
    id: "plinianisch", gruppe: "ausbruch", icon: "🍄", titel: "Plinianisch: die große Eruptionssäule",
    kurz: "Eine Säule aus Gas und Asche schießt 20–50 km hoch und breitet sich als Schirm aus.",
    absaetze: [
      "Bei sehr gasreichem, zähem Magma strömt Gas und Asche minutenlang bis stundenlang mit hoher Geschwindigkeit aus dem Schlot. Die heiße Säule ist leichter als die Luft und steigt wie ein Heißluftballon auf, bis sie so dicht ist wie ihre Umgebung. Dort breitet sie sich als Schirmwolke aus und der Wind trägt sie fort.",
      "Benannt nach Plinius dem Jüngeren, der den Vesuv-Ausbruch 79 n. Chr. beschrieb: eine Wolke »wie eine Pinie«. Fällt die Säule in sich zusammen, entstehen Glutwolken.",
    ],
    fakten: [["Säulenhöhe", "20–50 km"], ["Explosivität", "VEI 4–6 und mehr"], ["Beispiele", "Vesuv 79, St. Helens 1980, Pinatubo 1991"]],
    bilder: ["st-helens-1980", "pinatubo-1991", "augustine", "hunga-tonga"],
    sim: "Typ »Schichtvulkan«: Die Säule steigt im Querschnitt auf, breitet sich oben als Schirm aus und treibt mit dem Wind aus dem Bild.",
  },
  {
    id: "surtseyanisch", gruppe: "ausbruch", icon: "💨", titel: "Surtseyanisch: Magma trifft Wasser",
    kurz: "Im flachen Wasser verdampft Meerwasser explosionsartig — auch Basalt explodiert.",
    absaetze: [
      "Trifft aufsteigendes Magma auf Wasser, verdampft es schlagartig und dehnt sich auf über das Tausendfache aus. Die Dampfexplosionen zerreißen das Magma zu feiner Asche — selbst dünnflüssiger Basalt, der an Land ruhig fließen würde. Benannt nach Surtsey vor Island, das 1963 so aus dem Meer wuchs.",
      "In großer Tiefe passiert das nicht: Der Wasserdruck verhindert, dass das Wasser verdampft. Dort quillt die Lava als Kissenlava. An Land entstehen durch Grundwasser Maare wie in der Eifel.",
    ],
    fakten: [["Wassertiefe", "flach (bis einige hundert Meter)"], ["Tiefer", "keine Explosion, Kissenlava"], ["Beispiele", "Surtsey 1963, Hunga Tonga 2022, Eifelmaare"]],
    bilder: ["surtsey", "hunga-tonga", "weinfelder-maar", "kissenlava"],
    sim: "»Im Meer« starten: Liegt der Schlot flach unter Wasser, steigt eine Dampf- und Aschesäule aus dem Meer; in der Tiefe (Hotspot) nicht.",
  },
  {
    id: "glutwolke", gruppe: "ausbruch", icon: "🌋", titel: "Glutwolken (pyroklastische Ströme)",
    kurz: "Heiße Lawinen aus Gas, Asche und Gestein — die gefährlichste Erscheinung an Vulkanen.",
    absaetze: [
      "Bricht eine Eruptionssäule in sich zusammen oder stürzt ein Lavadom ein, rast eine heiße Wolke aus Gas, Asche und Gestein den Hang hinab — schneller als ein Auto, mehrere hundert Grad heiß. Sie folgt Tälern, springt aber auch über Hügel und sogar übers Wasser.",
      "1902 zerstörte eine Glutwolke des Mont Pelée in Minuten die Stadt Saint-Pierre auf Martinique; etwa 28 000 Menschen starben. Auch in Pompeji starben die Menschen in Glutwolken.",
    ],
    fakten: [["Geschwindigkeit", "über 100 km/h, teils mehrere hundert"], ["Temperatur", "etwa 200–700 °C"], ["Ablagerung", "Ignimbrit"]],
    bilder: ["pinatubo-glutwolke", "mayon", "pompeji"],
    sim: "Bei sehr explosiven Ausbrüchen fällt die Säule am Ende zusammen: Glutlawinen laufen im Querschnitt die Flanken hinab, darüber quillt Asche auf.",
  },
  {
    id: "vei", gruppe: "ausbruch", icon: "📏", titel: "Wie stark? Der Vulkanexplosivitätsindex (VEI)",
    kurz: "Eine Skala von 0 bis 8 nach der Menge der Tephra — jede Stufe zehnmal mehr.",
    absaetze: [
      "Der VEI misst, wie viel Tephra ein Ausbruch fördert und wie hoch die Säule steigt. Ab Stufe 2 bedeutet jede Stufe etwa zehnmal so viel Auswurf. Lavaströme zählen nicht mit — ein Schildvulkan kann riesige Mengen Lava fördern und trotzdem VEI 0 haben.",
    ],
    fakten: [
      ["VEI 0", "unter 10 000 m³ — Kīlauea (Lavaströme)"], ["VEI 1–2", "bis 10 Mio. m³ — Stromboli, Ätna"],
      ["VEI 3", "bis 0,1 km³ — Nevado del Ruiz 1985"], ["VEI 4", "bis 1 km³ — Eyjafjallajökull 2010"],
      ["VEI 5", "bis 10 km³ — Vesuv 79, St. Helens 1980"], ["VEI 6", "bis 100 km³ — Pinatubo 1991, Laacher See"],
      ["VEI 7", "bis 1000 km³ — Tambora 1815"], ["VEI 8", "über 1000 km³ — Yellowstone (vor 2,1 Mio. J.)"],
    ],
    bilder: ["eyjafjallajoekull", "st-helens-1980", "pinatubo-1991", "yellowstone"],
    sim: "Rechts unter »explosiv« steht, welcher Anteil des Magmas als Asche herauskommt — Basalt fast nichts, Andesit mit viel Gas die Hälfte.",
  },
  // ── Lava ──
  {
    id: "lavaarten", gruppe: "lava", icon: "🌊", titel: "Pāhoehoe und ʻAʻā",
    kurz: "Glatte Stricklava und raue Brockenlava — zwei Gesichter derselben Basaltlava.",
    absaetze: [
      "Heiße, dünnflüssige Basaltlava erstarrt mit einer glatten, oft seilartig gefalteten Haut: Pāhoehoe (Stricklava). Fließt sie schneller oder wird kühler und zäher, zerreißt die Kruste in scharfkantige, raue Brocken: ʻAʻā (Brockenlava). Beide Namen stammen aus dem Hawaiischen.",
      "Erstarrt ein Strom außen, fließt innen die Lava weiter wie in einem isolierten Rohr — in Lavaröhren kommt sie viele Kilometer weit.",
    ],
    fakten: [["Pāhoehoe", "glatt, seilig, heiß und dünnflüssig"], ["ʻAʻā", "rau, brockig, kühler und zäher"]],
    bilder: ["pahoehoe", "pahoehoe-aa", "mauna-loa-2022", "lavaroehre"],
    sim: "Lava fließt im Modell nur, wo sie dicker ist als eine Mindestdicke — die wächst, je zäher und kühler sie wird.",
  },
  {
    id: "zaehigkeit", gruppe: "lava", icon: "🍯", titel: "Warum manche Lava fließt und andere nicht",
    kurz: "Kieselsäure macht Magma zäh — das entscheidet über die Form des Vulkans.",
    absaetze: [
      "Kieselsäure (SiO₂) bildet im Magma lange Ketten, die sich verhaken. Viel SiO₂ macht das Magma zäh und kühler. Wenig SiO₂ (Basalt, etwa 50 %) fließt fast wie Ketchup, Andesit (etwa 60 %) wie Teer, Rhyolith (über 70 %) kaum noch — er bleibt als Dom über dem Schlot stehen.",
      "In zähem Magma kann das Gas nicht entweichen: Der Druck steigt, bis es explodiert. Darum sind Vulkane mit zähem Magma steil und explosiv (Schichtvulkane), solche mit dünnflüssigem flach und ruhig (Schildvulkane).",
    ],
    fakten: [["Basalt", "~50 % SiO₂, ~1200 °C, dünnflüssig"], ["Andesit", "~60 % SiO₂, ~1050 °C, zäh"], ["Rhyolith", "über 70 % SiO₂, ~850 °C, sehr zäh"]],
    bilder: ["skjaldbreidur", "fuji", "st-helens-dom"],
    sim: "Schieb den Regler »Kieselsäure« und schau, welche Form entsteht: Schild, Schichtvulkan oder Lavadom.",
  },
  {
    id: "kissenlava", gruppe: "lava", icon: "🫧", titel: "Kissenlava und Hyaloklastit",
    kurz: "Lava unter Wasser erstarrt sofort zu runden Kissen oder zerspringt zu Glas.",
    absaetze: [
      "Im Wasser bildet die Lava sofort eine erstarrte Haut. Von innen drückt neue Lava nach, die Haut reißt, ein neues »Kissen« quillt heraus — so entstehen Haufen aus kissenförmigen Lavaballen. Der größte Teil der Erdkruste unter den Ozeanen ist so entstanden.",
      "Wird Lava im Wasser oder unter Gletschereis abgeschreckt, kann sie auch in Glassplitter zerspringen. Verkittet heißt dieses Gestein Hyaloklastit.",
    ],
    fakten: [["Entstehung", "Lava unter Wasser"], ["Form", "runde Kissen, 0,5–1 m"], ["Glasbruch", "Hyaloklastit"]],
    bilder: ["kissenlava", "loihi-kissenlava", "hyaloklastit", "lava-meer"],
    sim: "Unter Wasser kühlt die Lava im Modell sehr schnell und türmt sich steil — darum wachsen Inseln erst langsam aus dem Meer.",
  },
  // ── Gefahren ──
  {
    id: "lahar", gruppe: "gefahr", icon: "🌧️", titel: "Lahare — Schlammströme",
    kurz: "Regen oder Schmelzwasser macht lose Asche zu einem reißenden Schlammstrom.",
    absaetze: [
      "Lose Asche auf steilen Hängen ist gefährlich, auch Jahre nach einem Ausbruch: Starker Regen oder schmelzendes Gletschereis verwandelt sie in einen Strom aus Schlamm und Gestein, der wie flüssiger Beton durch die Täler rast.",
      "1985 schmolz ein eigentlich kleiner Ausbruch des Nevado del Ruiz Gletschereis. Lahare erreichten die 70 km entfernte Stadt Armero; etwa 23 000 Menschen starben.",
    ],
    fakten: [["Auslöser", "Regen, Schmelzwasser, Kraterseen"], ["Geschwindigkeit", "bis über 50 km/h"], ["Reichweite", "Dutzende km"]],
    bilder: ["lahar", "nevado-del-ruiz", "mayon"],
  },
  {
    id: "gase", gruppe: "gefahr", icon: "♨️", titel: "Vulkangase",
    kurz: "Vor allem Wasserdampf, dazu CO₂ und Schwefelgase — unsichtbar und gefährlich.",
    absaetze: [
      "Magma enthält gelöste Gase, vor allem Wasserdampf, dazu Kohlenstoffdioxid und Schwefeldioxid. Sie treiben jeden Ausbruch an und entweichen auch zwischen den Ausbrüchen aus Fumarolen.",
      "Kohlenstoffdioxid ist schwerer als Luft und sammelt sich in Senken — 1986 erstickten am Nyos-See in Kamerun rund 1700 Menschen. Schwefeldioxid bildet hoch in der Luft feine Tröpfchen, die Sonnenlicht abhalten: Nach dem Pinatubo-Ausbruch war es weltweit etwa ein Jahr lang um rund 0,5 °C kühler.",
    ],
    fakten: [["Hauptgas", "Wasserdampf"], ["Gefährlich", "CO₂ (erstickt), SO₂ (giftig, kühlt das Klima)"], ["Sichtbar", "Schwefel an Fumarolen"]],
    bilder: ["fumarole", "pinatubo-1991"],
  },
  {
    id: "pompeji", gruppe: "gefahr", icon: "🏛️", titel: "Pompeji 79 n. Chr.",
    kurz: "Der Vesuv begrub zwei römische Städte unter Asche und Glutwolken.",
    absaetze: [
      "Im Jahr 79 brach der Vesuv nach langer Ruhe aus. Erst regnete einen Tag lang Bims und Asche auf Pompeji, Dächer brachen ein. Dann rasten Glutwolken die Hänge hinab und töteten alle, die noch in der Stadt waren. Pompeji und Herculaneum verschwanden unter meterdicken Schichten.",
      "Die Körper der Toten hinterließen Hohlräume in der erhärteten Asche. Ab 1863 füllten Archäologen sie mit Gips — so sieht man bis heute die Haltung der Menschen in ihren letzten Momenten.",
    ],
    fakten: [["Ausbruch", "79 n. Chr. — überliefert der 24. August, nach neueren Funden eher der 24. Oktober"], ["Stärke", "VEI 5, plinianisch"], ["Zeuge", "Plinius der Jüngere"]],
    bilder: ["pompeji", "vesuv"],
  },
  {
    id: "ueberwachung", gruppe: "gefahr", icon: "📡", titel: "Vulkane überwachen und vorhersagen",
    kurz: "Erdbeben, Bodenhebung und Gase verraten aufsteigendes Magma.",
    absaetze: [
      "Steigt Magma auf, kündigt sich das oft an: Das Gestein bricht und es gibt viele kleine Erdbeben. Der Boden hebt sich um Zentimeter bis Meter — Satelliten und GPS messen das. Aus Fumarolen entweicht mehr Schwefeldioxid, Quellen werden wärmer.",
      "So konnte der Pinatubo-Ausbruch 1991 vorhergesagt werden: Zehntausende Menschen wurden rechtzeitig in Sicherheit gebracht. Einen genauen Termin kann man aber bis heute nicht vorhersagen.",
    ],
    fakten: [["Erdbeben", "Seismometer"], ["Bodenhebung", "GPS, Radarsatelliten"], ["Gase", "SO₂- und CO₂-Messung"]],
    bilder: ["pinatubo-1991", "fumarole", "halemaumau"],
  },
];

/** Welcher Eintrag passt zu einem Stoff in der Legende des Querschnitts */
export const WISSEN_ZU_STOFF: Record<Stoff, string> = {
  basalt: "lavaarten", andesit: "zaehigkeit", rhyolith: "zaehigkeit",
  schlacke: "lapilli", asche: "asche", ignimbrit: "tuff", schutt: "lapilli",
};
