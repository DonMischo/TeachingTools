/**
 * Quiz zum Wachstum: »Zeig mir …« (Klick in die Karte), Wissensfragen mit
 * Begründung und »Welche Epoche ist das?«. Fragen entstehen aus der
 * gezeigten Stadt, damit nur gefragt wird, was zu sehen ist.
 */
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { abstand, zurLinie, type P } from "./geometrie";
import { zoneBei } from "./haeuser";
import { BAUTEN, STRASSEN, ZONEN, type BauTyp, type Epoche, type Stadt, type Stil, type ZonenTyp } from "./modell";

export type Frage =
  | { art: "zeige"; text: string; ziel: { bau: BauTyp } | { zone: ZonenTyp } | { name: string }; erklaerung: string }
  | { art: "wahl"; text: string; optionen: string[]; richtig: number; erklaerung: string }
  | { art: "epoche"; text: string; epoche: number; optionen: string[]; richtig: number; erklaerung: string };

interface Wissen { ab: number; text: string; richtig: string; falsch: string[]; erklaerung: string }

const WISSEN: Record<Stil, Wissen[]> = {
  roemisch: [
    { ab: 0, text: "Warum liegt die Stadt nicht direkt am Ufer?", richtig: "Die Aue wird bei Hochwasser überflutet.", falsch: ["Die Römer konnten keine Brücken bauen.", "Am Ufer war es zu laut."], erklaerung: "Trockener, leicht erhöhter Grund schützte vor Hochwasser — der Fluss war trotzdem nah genug für Wasser und Transport." },
    { ab: 0, text: "Wie heißen die beiden Hauptstraßen einer Römerstadt?", richtig: "Cardo und Decumanus", falsch: ["Via und Forum", "Insula und Castellum"], erklaerung: "Der Cardo läuft Nord–Süd, der Decumanus Ost–West. Am Kreuzungspunkt liegt das Forum." },
    { ab: 0, text: "Warum ist der Grundriss so regelmäßig?", richtig: "Die Stadt wurde auf einmal nach Plan angelegt.", falsch: ["Sie wuchs langsam über Jahrhunderte.", "Das Gelände war zufällig so."], erklaerung: "Römische Kolonien wurden von Vermessern (Agrimensoren) in einem Zug abgesteckt — oft nach dem Muster eines Legionslagers." },
    { ab: 0, text: "Was sind Insulae?", richtig: "Wohnblöcke zwischen den Straßen des Rasters", falsch: ["Inseln im Fluss", "Römische Tempel"], erklaerung: "Insula heißt »Insel«: ein Block, ringsum von Straßen umgeben." },
    { ab: 1, text: "Warum liegen die Gräber an den Straßen vor der Stadt?", richtig: "Bestattungen innerhalb der Stadt waren verboten.", falsch: ["Dort war der Boden weicher.", "Man wollte Platz für Felder sparen."], erklaerung: "Das Zwölftafelgesetz verbot Gräber in der Stadt. An den Ausfallstraßen erinnerten Grabmäler an die Toten." },
    { ab: 1, text: "Warum muss die Quelle des Aquädukts höher liegen als die Stadt?", richtig: "Das Wasser fließt nur mit Gefälle.", falsch: ["Damit das Wasser kühler bleibt.", "Weil dort keine Feinde waren."], erklaerung: "Aquädukte hatten keine Pumpen. Ein gleichmäßiges, leichtes Gefälle trug das Wasser über viele Kilometer." },
    { ab: 1, text: "Warum steht das Amphitheater meist vor der Mauer?", richtig: "Es zog Tausende Zuschauer an und brauchte viel Platz.", falsch: ["Gladiatoren durften die Stadt nicht betreten.", "Es diente als zweite Mauer."], erklaerung: "Große Menschenmengen, Tiere, Lärm — und in der Mauer war kein Platz." },
    { ab: 2, text: "Warum wurde die Mauer in der Spätantike kleiner?", richtig: "Weniger Einwohner, und ein kleiner Kern war leichter zu verteidigen.", falsch: ["Die Römer hatten zu wenig Steine.", "Der Fluss hatte die Stadt verschluckt."], erklaerung: "Krisen und Einfälle ließen die Städte schrumpfen; man befestigte nur noch den Kern." },
    { ab: 3, text: "Woran erkennt man im heutigen Stadtplan eine Römerstadt?", richtig: "Am rechtwinkligen Straßenraster der Altstadt", falsch: ["An besonders krummen Gassen", "An Hochhäusern im Zentrum"], erklaerung: "In Köln, Trier oder Regensburg folgen Altstadtstraßen bis heute Cardo, Decumanus und den Insulae." },
  ],
  europaeisch: [
    { ab: 0, text: "Warum entstand die Siedlung genau hier?", richtig: "An einer Furt, wo Fernstraßen den Fluss queren", falsch: ["Weil der Boden hier am billigsten war", "Weil der König es befahl"], erklaerung: "Flussübergänge zwangen alle Reisenden vorbei — gut für Handel, Zoll und Schutz durch die Burg." },
    { ab: 0, text: "Warum steht die Burg auf dem Hügel?", richtig: "Von oben lässt sie sich verteidigen und man sieht weit.", falsch: ["Weil im Tal kein Holz wuchs.", "Damit sie näher am Himmel ist."], erklaerung: "Höhenburgen sicherten Straßen und Flussübergänge." },
    { ab: 1, text: "Warum sind die Gassen in der Altstadt eng und krumm?", richtig: "Die Stadt wuchs Haus für Haus, ohne Gesamtplan.", falsch: ["Gegen den Wind aus dem Westen", "Weil Pferde keine geraden Wege mochten"], erklaerung: "Mittelalterliche Städte sind »gewachsen«: Gassen folgen alten Wegen, dem Gelände und laufen auf Markt und Tore zu." },
    { ab: 1, text: "Was brachte das Stadtrecht?", richtig: "Markt, eigenes Gericht und das Recht auf eine Mauer", falsch: ["Steuerfreiheit für alle Bauern", "Eine Eisenbahn"], erklaerung: "»Stadtluft macht frei«: Bürger hatten eigene Rechte, die Stadt durfte sich ummauern und Märkte abhalten." },
    { ab: 2, text: "Wer wohnte in den Vorstädten vor den Toren?", richtig: "Handwerker, Fuhrleute und ärmere Leute ohne Bürgerrecht", falsch: ["Der Adel", "Die Ratsherren"], erklaerung: "In der Mauer war es eng und teuer. Draußen wohnte, wer nicht dazugehörte — oder laute, stinkende Gewerbe betrieb." },
    { ab: 3, text: "Was entstand oft an der Stelle der Stadtmauer?", richtig: "Ein Ring mit Grünanlagen", falsch: ["Ein Kanal", "Eine Autobahn"], erklaerung: "Die abgerissene Mauer hinterließ einen breiten Streifen — ideal für Ringstraßen, Parks und Prachtbauten." },
    { ab: 3, text: "Warum liegt der Bahnhof außerhalb der Altstadt?", richtig: "In der dichten Altstadt war kein Platz für Gleise.", falsch: ["Züge durften nicht in Städte fahren.", "Damit Reisende länger laufen."], erklaerung: "Bahnhöfe entstanden am damaligen Stadtrand. Die Stadt wuchs ihnen dann entgegen." },
    { ab: 3, text: "Was kennzeichnet ein Gründerzeitviertel?", richtig: "Gerade Straßen, geschlossene Blöcke, Mietshäuser mit Hinterhöfen", falsch: ["Fachwerkhäuser und krumme Gassen", "Einfamilienhäuser mit Garten"], erklaerung: "Zwischen 1870 und 1914 wuchsen die Städte rasant — mit dichten, planmäßigen Blöcken für die Arbeiter." },
    { ab: 4, text: "Warum liegt das Einkaufszentrum an der Umgehungsstraße?", richtig: "Dort ist Platz für Parkplätze und es ist mit dem Auto gut erreichbar.", falsch: ["Weil dort die meisten Menschen wohnen", "Weil es in der Altstadt verboten ist"], erklaerung: "»Grüne Wiese«: billiger Boden, Autobahnanschluss — ein Problem für den Handel in der Innenstadt." },
    { ab: 5, text: "Was bedeutet Gentrifizierung?", richtig: "Ein Viertel wird aufgewertet, Mieten steigen, Alteingesessene werden verdrängt.", falsch: ["Ein Viertel wird abgerissen und neu gebaut.", "Reiche ziehen aus der Stadt aufs Land."], erklaerung: "Typisch in sanierten Gründerzeitvierteln: erst Studierende und Kreative, dann Besserverdienende — die ursprünglichen Bewohner können sich die Mieten nicht mehr leisten." },
    { ab: 5, text: "Was passiert bei einer Konversion?", richtig: "Brachflächen (alte Industrie, Bahn, Kasernen) bekommen eine neue Nutzung.", falsch: ["Ein Fluss wird umgeleitet.", "Eine Altstadt wird zur Fußgängerzone."], erklaerung: "Statt auf der grünen Wiese zu bauen, nutzt man Flächen in der Stadt neu — das spart Landschaft (Innenentwicklung)." },
    { ab: 5, text: "Was ist Reurbanisierung?", richtig: "Menschen ziehen wieder in die Kernstadt zurück.", falsch: ["Die Stadt wächst ins Umland hinaus.", "Ein Dorf bekommt Stadtrecht."], erklaerung: "Nach Jahrzehnten der Suburbanisierung gewinnen viele Innenstädte wieder Einwohner — kurze Wege, Kultur, Arbeitsplätze." },
  ],
  amerikanisch: [
    { ab: 0, text: "Warum wurde die Stadt hier gegründet?", richtig: "Wegen der Eisenbahnlinie", falsch: ["Wegen einer mittelalterlichen Burg", "Wegen eines römischen Lagers"], erklaerung: "Eisenbahngesellschaften gründeten im Westen Hunderte Städte entlang ihrer Strecken." },
    { ab: 0, text: "Warum ist das Raster nach Norden ausgerichtet?", richtig: "Das Land war nach Himmelsrichtungen in Quadrate vermessen.", falsch: ["Wegen des Windes", "Weil es dem Flusslauf folgt"], erklaerung: "Die Land Ordinance von 1785 legte ein Raster aus Quadratmeilen über das ganze Land." },
    { ab: 0, text: "Was bedeutet »the wrong side of the tracks«?", richtig: "Auf der anderen Seite der Gleise wohnten die Ärmeren.", falsch: ["Dort fuhren die Züge falsch herum.", "Dort war das Gericht."], erklaerung: "Die Bahn teilte die Stadt — oft auch sozial." },
    { ab: 1, text: "Warum stehen im CBD Hochhäuser?", richtig: "Der Boden ist dort am teuersten, also baut man in die Höhe.", falsch: ["Weil der Boden dort am weichsten ist", "Weil dort niemand wohnen will"], erklaerung: "Im Central Business District konkurrieren alle um die beste Lage — die Bodenpreise steigen, die Gebäude auch." },
    { ab: 1, text: "Was waren Streetcar Suburbs?", richtig: "Wohnviertel an den Endhaltestellen der Straßenbahn", falsch: ["Fabriken für Straßenbahnen", "Parkhäuser"], erklaerung: "Mit der Straßenbahn konnte man weiter draußen wohnen und trotzdem im Zentrum arbeiten." },
    { ab: 2, text: "Warum haben die Vororte geschwungene Straßen und Sackgassen?", richtig: "Damit kein Durchgangsverkehr durch die Wohngebiete fährt", falsch: ["Weil das Gelände dort bergig war", "Um Straßenbahnschienen zu sparen"], erklaerung: "Suburbs wurden fürs Auto geplant — ruhig, mit großen Grundstücken, aber ohne Busse oder Läden um die Ecke." },
    { ab: 2, text: "Was passierte oft beim Bau der Interstates durch die Städte?", richtig: "Ganze Viertel, meist ärmere, wurden abgerissen.", falsch: ["Die Städte bekamen neue Mauern.", "Die Straßenbahnen wurden ausgebaut."], erklaerung: "Stadtautobahnen zerschnitten Viertel — vor allem von Schwarzen und Einwanderern." },
    { ab: 3, text: "Was ist eine Edge City?", richtig: "Ein neues Zentrum mit Büros und Malls am Autobahnring", falsch: ["Die Altstadt am Fluss", "Ein Dorf am Kartenrand"], erklaerung: "Edge Cities entstehen an den Ausfahrten weit draußen — Arbeitsplätze ziehen dem Wohnen hinterher." },
    { ab: 3, text: "Was ist eine Gated Community?", richtig: "Ein abgeschlossenes Wohnviertel mit Zaun und Wachpersonal", falsch: ["Ein Viertel an einem Stadttor", "Ein Parkhaus am Highway"], erklaerung: "Wohlhabende schotten sich ab — Ausdruck und Ursache von Segregation." },
    { ab: 3, text: "In welcher Reihenfolge liegen die Zonen von innen nach außen (Burgess)?", richtig: "CBD – Übergangszone – Arbeiter – Wohnen – Pendler", falsch: ["Pendler – CBD – Arbeiter – Wohnen – Übergang", "Wohnen – CBD – Pendler – Übergang – Arbeiter"], erklaerung: "Das Ringmodell von Burgess (Chicago, 1925): Die Stadt wächst wie Jahresringe von innen nach außen." },
  ],
  residenz: [
    { ab: 0, text: "Warum laufen alle Straßen auf das Schloss zu?", richtig: "Der Grundriss zeigt: Der Fürst ist der Mittelpunkt von allem.", falsch: ["Damit das Regenwasser zum Schloss fließt", "Weil das Gelände so geformt war"], erklaerung: "Im Absolutismus inszeniert die Stadt die Macht des Herrschers — wie Versailles für Ludwig XIV. Karlsruhe (1715) hat 32 Strahlen vom Schlossturm aus." },
    { ab: 0, text: "Wie entstand eine Residenzstadt wie Karlsruhe?", richtig: "Auf einmal geplant, auf freiem Land, nach dem Willen des Fürsten", falsch: ["Sie wuchs langsam aus einem Dorf.", "Aus einem römischen Lager"], erklaerung: "Planstadt: Der Fürst bestimmte Lage, Grundriss und sogar das Aussehen der Häuser (Modellhäuser)." },
    { ab: 0, text: "Warum sehen die Häuser der frühen Residenzstadt gleich aus?", richtig: "Wer Bauland geschenkt bekam, musste nach Modellhaus bauen.", falsch: ["Es gab nur einen Baumeister.", "Die Bürger waren alle gleich reich."], erklaerung: "Die einheitlichen Fassaden ordnen sich dem Schloss unter — Ordnung als Bild der Herrschaft." },
    { ab: 1, text: "Was zeigt die Symmetrie von Kirche und Rathaus am Markt?", richtig: "Strenge Ordnung und Planung nach einer Achse", falsch: ["Zufall beim Bau", "Streit zwischen Kirche und Rat"], erklaerung: "Achsen und Symmetrie sind Kennzeichen barocker und klassizistischer Stadtplanung." },
    { ab: 2, text: "Welche Thüringer Städte waren Residenzstädte?", richtig: "Weimar, Gotha, Meiningen, Rudolstadt", falsch: ["Erfurt, Jena, Gera, Suhl als Reichsstädte", "Keine — Thüringen hatte keine Fürsten"], erklaerung: "Thüringen bestand aus vielen kleinen Fürstentümern, jedes mit eigener Residenz — daher die vielen Schlösser und Theater." },
  ],
  festung: [
    { ab: 0, text: "Warum haben die Wälle spitze Bastionen?", richtig: "Von jeder Bastion kann man die Nachbarn seitlich beschießen — kein toter Winkel.", falsch: ["Weil Sterne schön aussehen", "Damit mehr Häuser hineinpassen"], erklaerung: "Gegen Kanonen halfen keine hohen Mauern mehr. Niedrige, dicke Erdwälle mit Bastionen (Vauban, 17. Jh.) deckten jeden Punkt davor ab." },
    { ab: 0, text: "Wozu diente das Glacis?", richtig: "Ein freies Feld ohne Deckung für Angreifer", falsch: ["Als Weide für die Pferde", "Als Friedhof der Garnison"], erklaerung: "Auf dem Glacis durfte nichts gebaut oder gepflanzt werden — freies Schussfeld." },
    { ab: 0, text: "Warum liegt in der Mitte ein großer Platz?", richtig: "Für Appelle der Garnison und kurze Wege zu allen Bastionen", falsch: ["Für den Wochenmarkt allein", "Damit das Rathaus Platz hat"], erklaerung: "Der Paradeplatz ist das Herz der Festung — vom Zentrum aus sind alle Wälle gleich schnell erreichbar." },
    { ab: 0, text: "Welche Festung steht in Erfurt?", richtig: "Die Zitadelle Petersberg", falsch: ["Die Wartburg", "Die Veste Coburg"], erklaerung: "Ab 1665 ließ der Mainzer Kurfürst auf dem Petersberg eine Zitadelle mit Bastionen bauen — eine der größten erhaltenen in Mitteleuropa." },
    { ab: 1, text: "Was geschah im 19. Jahrhundert mit den Festungswällen?", richtig: "Sie wurden geschleift; an ihrer Stelle entstanden Ringe und Parks.", falsch: ["Sie wurden höher gebaut.", "Man flutete sie zu Seen."], erklaerung: "Entfestigung: Die Städte brauchten Platz, die Wälle waren militärisch nutzlos geworden." },
  ],
  sozialistisch: [
    { ab: 0, text: "Warum wurde die Stadt gegründet?", richtig: "Für die Arbeiter eines neuen Großbetriebs (Kombinat)", falsch: ["An einer Furt mit Markt", "Als Residenz eines Fürsten"], erklaerung: "Eisenhüttenstadt (ab 1950) entstand für das Eisenhüttenkombinat Ost — Industrie zuerst, dann die Stadt." },
    { ab: 0, text: "Wozu dienten Magistrale und zentraler Platz?", richtig: "Für Aufmärsche und Feiern — sie zeigen den Staat und die Arbeiterklasse.", falsch: ["Für Autobahnverkehr", "Als Marktplatz für Bauern"], erklaerung: "Die »16 Grundsätze des Städtebaus« (1950) verlangten ein Zentrum mit Platz für Demonstrationen und eine Dominante (Kulturhaus, Rathaus)." },
    { ab: 0, text: "Was gehört zu jedem Wohnkomplex?", richtig: "Schule, Kindergarten, Kaufhalle — alles zu Fuß erreichbar", falsch: ["Ein eigenes Werk", "Eine Kirche und ein Schloss"], erklaerung: "Der Wohnkomplex war eine Einheit für mehrere Tausend Menschen mit eigener Versorgung." },
    { ab: 1, text: "Warum baute die DDR Plattenbauten?", richtig: "Schnell und billig viele Wohnungen mit Fertigteilen", falsch: ["Weil Ziegel verboten waren", "Weil die Menschen Hochhäuser wollten"], erklaerung: "Das Wohnungsbauprogramm ab 1973 sollte die Wohnungsnot lösen. Die Wohnungen hatten Bad und Fernheizung — damals begehrt." },
    { ab: 2, text: "Warum schrumpfen viele ostdeutsche Städte seit 1990?", richtig: "Arbeitsplätze fielen weg, junge Menschen zogen weg, weniger Geburten.", falsch: ["Weil die Plattenbauten zu groß waren", "Weil viele Menschen aufs Land zogen, um zu bauern"], erklaerung: "Schrumpfung: Leerstand in den Plattenbauten, Rückbau mit dem Programm »Stadtumbau Ost« (ab 2002)." },
    { ab: 2, text: "Was bedeutet Rückbau?", richtig: "Leerstehende Gebäude werden abgerissen, die Fläche wird begrünt.", falsch: ["Alte Gebäude werden originalgetreu wiederaufgebaut.", "Straßen werden verbreitert."], erklaerung: "Um Leerstand zu verringern, wurden ganze Wohnblöcke abgetragen — die Stadt wird kleiner, aber lebenswerter." },
  ],
  lateinamerika: [
    { ab: 0, text: "Wo wohnte in der Kolonialstadt die Oberschicht?", richtig: "Nahe der Plaza Mayor im Zentrum", falsch: ["In Vororten am Stadtrand", "Auf Gutshöfen im Hochland"], erklaerung: "Zentrum-Peripherie-Gefälle: Je näher an der Plaza, desto angesehener — genau umgekehrt wie in Nordamerika." },
    { ab: 0, text: "Was schrieben die Leyes de Indias vor?", richtig: "Ein Schachbrett um eine zentrale Plaza mit Kirche und Rathaus", falsch: ["Krumme Gassen zum Schutz vor Wind", "Eine Stadtmauer mit Bastionen"], erklaerung: "Die spanische Krone legte 1573 fest, wie neue Städte in Amerika auszusehen hatten." },
    { ab: 1, text: "Wie bewegt sich die Oberschicht in der sektoralen Stadt?", richtig: "Entlang eines Prachtboulevards immer weiter nach außen", falsch: ["Zurück ins Zentrum", "In die Marginalsiedlungen"], erklaerung: "Ein Oberschichtsektor wächst keilförmig hinaus (wie im Sektorenmodell von Hoyt)." },
    { ab: 2, text: "Wo entstehen Marginalsiedlungen?", richtig: "In Ungunstlagen: steile Hänge, Überschwemmungsgebiete, am Rand", falsch: ["Auf der Plaza Mayor", "Im Oberschicht-Sektor"], erklaerung: "Dort ist der Boden billig oder niemandes — aber Rutschungen und Hochwasser bedrohen die Bewohner." },
    { ab: 2, text: "Warum wuchsen die Städte ab 1950 so schnell?", richtig: "Landflucht und hohe Geburtenraten", falsch: ["Einwanderung aus Europa allein", "Weil die Städte Mauern abrissen"], erklaerung: "Push-Faktoren (Armut, Landmangel) und Pull-Faktoren (Arbeit, Schulen) — viele wurden Megacities." },
    { ab: 3, text: "Was meint »fragmentierte Stadt«?", richtig: "Reiche und arme Inseln liegen nah beieinander, aber abgeschottet.", falsch: ["Die Stadt ist durch Flüsse geteilt.", "Die Stadt besteht aus vielen Dörfern."], erklaerung: "Gated Communities, Malls und Bürotürme neben Marginalsiedlungen — verbunden nur durch Stadtautobahnen (Borsdorf, Bähr, Janoschka 2002)." },
  ],
  orientalisch: [
    { ab: 0, text: "Warum enden viele Gassen in der Medina als Sackgasse?", richtig: "Sie schützen die Privatsphäre der Familien — Fremde gehen nicht hinein.", falsch: ["Weil das Geld für Straßen fehlte", "Wegen der Kanonen"], erklaerung: "Öffentliches Leben spielt im Bazar, das Wohnen ist privat: Häuser öffnen sich nach innen zum Hof." },
    { ab: 0, text: "Wo liegen im Bazar die wertvollsten Waren?", richtig: "Nahe der Freitagsmoschee", falsch: ["Direkt an den Toren", "Außerhalb der Mauer"], erklaerung: "Gold, Bücher und Stoffe im Zentrum; laute, schmutzige oder sperrige Waren (Schmiede, Gerber, Holz) zu den Toren hin." },
    { ab: 0, text: "Was war eine Karawanserei?", richtig: "Herberge und Warenlager für Fernhändler", falsch: ["Ein Badehaus", "Eine Schule für Koranlehrer"], erklaerung: "Sie lagen an den Toren — dort kamen die Karawanen an." },
    { ab: 0, text: "Wo liegt die Kasbah?", richtig: "Am Rand der Medina an der Mauer, oft erhöht", falsch: ["Im Zentrum neben der Moschee", "Weit außerhalb der Stadt"], erklaerung: "Der Herrscher sicherte sich nach außen und gegen die eigene Stadt." },
    { ab: 1, text: "Warum baute die Kolonialmacht die Ville nouvelle neben die Medina?", richtig: "Europäer und Einheimische sollten getrennt leben; die Medina blieb erhalten.", falsch: ["Weil die Medina abgebrannt war", "Weil dort mehr Wasser war"], erklaerung: "In Marokko ließ Lyautey Neustädte neben den Altstädten bauen — es entstand eine dualistische Stadt." },
    { ab: 2, text: "Wer lebt heute oft in der Medina?", richtig: "Ärmere Familien und Zugezogene; dazu Touristen im Bazar", falsch: ["Fast nur reiche Familien", "Niemand — sie ist ein Museum"], erklaerung: "Wohlhabende zogen in die Neubauviertel; viele Medinas sind UNESCO-Welterbe (Fès seit 1981)." },
  ],
};

function mischen<T>(a: T[], z: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(z() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** Fragen zu Epoche idx (und davor) */
export function quizFragen(stil: Stil, epochen: Epoche[], idx: number, seed: number): Frage[] {
  const z = zufallsquelle(seed);
  const s = epochen[idx].stadt;
  const fragen: Frage[] = [];
  const typen = mischen([...new Set(s.bauten.map(b => b.typ))].filter(t => t !== "tor"), z).slice(0, 4);
  for (const t of typen) fragen.push({ art: "zeige", text: `Klicke auf: ${BAUTEN[t].icon} ${BAUTEN[t].label}`, ziel: { bau: t }, erklaerung: BAUTEN[t].text });
  const zonen = mischen([...new Set(s.zonen.map(x => x.typ))].filter(t => t !== "park" && t !== "parkplatz"), z).slice(0, 2);
  for (const t of zonen) fragen.push({ art: "zeige", text: `Klicke in das Viertel: ${ZONEN[t].label}`, ziel: { zone: t }, erklaerung: ZONEN_TEXT[t] ?? "" });
  const namen = mischen([...new Set(s.strassen.map(st => st.name).filter((n): n is string => !!n && n !== "Via" && n !== "Fernstraße"))], z).slice(0, 1);
  for (const n of namen) fragen.push({ art: "zeige", text: `Klicke auf: ${n}`, ziel: { name: n }, erklaerung: STRASSEN_TEXT[n] ?? "" });
  for (const w of mischen(WISSEN[stil].filter(w => w.ab <= idx), z).slice(0, 4)) {
    const optionen = mischen([w.richtig, ...w.falsch], z);
    fragen.push({ art: "wahl", text: w.text, optionen, richtig: optionen.indexOf(w.richtig), erklaerung: w.erklaerung });
  }
  if (epochen.length > 2) {
    const e = Math.floor(z() * epochen.length);
    const optionen = epochen.map(x => `${x.jahr}: ${x.titel}`);
    fragen.push({ art: "epoche", text: "Aus welcher Zeit stammt diese Karte?", epoche: e, optionen, richtig: e, erklaerung: epochen[e].neu.join(" · ") });
  }
  return mischen(fragen, z);
}

export const ZONEN_TEXT: Partial<Record<ZonenTyp, string>> = {
  insulae: "Wohnblöcke im Raster, ringsum von Straßen begrenzt.",
  suburbium: "Vorstadt vor den Toren, entlang der Fernstraßen.",
  verlassen: "In der Spätantike aufgegeben: Ruinen und Gärten.",
  dorf: "Die erste Siedlung bei Burg und Furt.",
  altstadt: "Innerhalb der alten Mauer: dicht, eng, gewachsen.",
  vorstadt: "Vor den Toren entlang der Ausfallstraßen.",
  gruenderzeit: "1870–1914: gerade Straßen, geschlossene Blöcke, Mietskasernen.",
  industrie: "Fabriken an Bahn und Fluss.",
  grosssiedlung: "Hochhaussiedlung am Stadtrand, 1960er/70er.",
  einfamilienhaus: "Häuser mit Garten, geschwungene Straßen, Sackgassen.",
  gewerbe: "Einkauf und Gewerbe an der Autobahnausfahrt.",
  kleinstadt: "Die ersten Blöcke rund um Main Street und Bahnhof.",
  cbd: "Central Business District: Büros, Banken, Hochhäuser.",
  uebergang: "Um den CBD: alte Häuser, Lager, Leerstand — im Wandel.",
  arbeiter: "Kleine Häuser nahe den Fabriken an der Bahn.",
  vorort: "Wohnviertel im Raster, an den Straßenbahnlinien.",
  pendler: "Suburbs fürs Auto: groß, grün, weit draußen.",
  gated: "Abgeschlossenes Wohnviertel mit Mauer und Wachpersonal.",
  konversion: "Neue Nutzung auf alter Industrie- oder Bahnfläche.",
  residenz: "Einheitliche Modellhäuser im Fächer vor dem Schloss.",
  schlossgarten: "Park hinter dem Schloss, früher nur für den Hof.",
  festung: "Raster hinter den Wällen, um den Paradeplatz.",
  glacis: "Freies Schussfeld vor den Wällen — nichts durfte dort stehen.",
  graben: "Wassergraben vor dem Wall.",
  tradition: "Wohnblöcke der 1950er mit Innenhöfen im Stil der »Nationalen Tradition«.",
  platte: "Plattenbauten aus Fertigteilen (WBS 70), 5 bis 11 Geschosse.",
  rueckbau: "Hier standen Plattenbauten — nach 1990 leer und abgerissen.",
  kombinat: "Großbetrieb, für den die Stadt gebaut wurde.",
  kolonial: "Koloniales Schachbrett um die Plaza Mayor.",
  verfall: "Alte Häuser im Zentrum, in viele kleine Wohnungen geteilt.",
  oberschicht: "Villen und Hochhäuser entlang des Prachtboulevards.",
  marginal: "Selbst gebaute Siedlung in einer Ungunstlage.",
  sozialbau: "Staatlicher Wohnungsbau am Stadtrand.",
  medina: "Wohnquartiere der Altstadt mit Innenhofhäusern und Sackgassen.",
  bazar: "Markt in überdachten Gassen, nach Waren geordnet.",
  ville: "Neustadt der Kolonialzeit mit Raster und Boulevards.",
};

const STRASSEN_TEXT: Record<string, string> = {
  "Cardo maximus": "Die Nord–Süd-Achse der Römerstadt.",
  "Decumanus maximus": "Die Ost–West-Achse der Römerstadt.",
  "Main Street": "Die Hauptstraße vom Bahnhof in die Stadt.",
  "Streetcar": "Straßenbahn-Avenue hinaus in die Wohnviertel.",
  Ring: "Boulevard auf der Linie der abgerissenen Stadtmauer.",
  Bahnhofstraße: "Vom Bahnhof in die Altstadt — Hotels, Kaufhäuser.",
  Eisenbahn: "Die Bahn kam im 19. Jahrhundert und brachte die Industrie.",
  Railroad: "Die Eisenbahn ist der Grund für die Stadt.",
  Interstate: "Autobahn mitten durch die Stadt, ab 1956.",
  Beltway: "Autobahnring um die ganze Stadt.",
  Umgehung: "Umgehungsstraße für den Durchgangsverkehr.",
  "Aquädukt": "Wasserleitung mit gleichmäßigem Gefälle.",
  Hauptachse: "Die Mittelachse läuft genau auf das Schloss zu.",
  Zirkel: "Bogenstraße um den Schlossplatz.",
  "Via triumphalis": "Prachtstraße für den Einzug des Fürsten.",
  Magistrale: "Breite Hauptstraße vom Werk zum zentralen Platz.",
  Prachtboulevard: "Entlang dieser Straße zog die Oberschicht hinaus.",
  Stadtautobahn: "Verbindet die Inseln der fragmentierten Stadt.",
  Hauptgasse: "Vom Tor zur Moschee — hier liegt der Bazar.",
  Boulevard: "Breite Straße der Ville nouvelle.",
};

/** Hat der Klick bei p das Ziel getroffen? */
export function trifft(f: Extract<Frage, { art: "zeige" }>, s: Stadt, p: P): boolean {
  const ziel = f.ziel;
  if ("bau" in ziel) return s.bauten.some(b => b.typ === ziel.bau && abstand(b, p) < Math.max(BAUTEN[b.typ].b, BAUTEN[b.typ].h) / 2 + 35);
  if ("zone" in ziel) return zoneBei(s, p) === ziel.zone;
  return s.strassen.some(st => st.name === ziel.name && zurLinie(p, st.punkte).d < STRASSEN[st.art].breite / 2 + 30);
}

/** wo das Ziel liegt (zum Zeigen nach einer falschen Antwort) */
export function zielOrt(f: Extract<Frage, { art: "zeige" }>, s: Stadt): P | null {
  const ziel = f.ziel;
  if ("bau" in ziel) return s.bauten.find(b => b.typ === ziel.bau) ?? null;
  if ("zone" in ziel) {
    const z = [...s.zonen].reverse().find(x => x.typ === ziel.zone);
    if (!z) return null;
    // ein Punkt der Zone, der wirklich dazu zählt
    for (const p of z.poly) for (const t of [0.5, 0.3, 0.7]) {
      const c = z.poly.reduce((a, q) => ({ x: a.x + q.x / z.poly.length, y: a.y + q.y / z.poly.length }), { x: 0, y: 0 });
      const q = { x: c.x + (p.x - c.x) * t, y: c.y + (p.y - c.y) * t };
      if (zoneBei(s, q) === ziel.zone) return q;
    }
    return null;
  }
  const st = s.strassen.find(x => x.name === ziel.name);
  return st ? st.punkte[Math.floor(st.punkte.length / 2)] : null;
}

