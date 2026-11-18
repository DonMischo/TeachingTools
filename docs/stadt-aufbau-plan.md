# Aufbau: Recherche und Plan für Stufen, Berufe, Dörfer und Balancing

Stand 2026-11-18. Grundlage für die nächste Ausbaustufe des Reiters »🏰 Aufbau« der Stadtentwicklung
(`lib/stadt/aufbau.ts`, `components/stadt/aufbau/`).

---

## 1. Befund

### 1.1 Leistung (Vorsorge, kein akutes Problem)

Im Spiel ruckelt es derzeit nicht spürbar. Die Messung zeigt aber, dass die Rechenzeit mit der Stadtgröße stark wächst. Mit Dörfern, Wegen und Berufen kommt noch mehr dazu. Große europäische Stadt (1.580 Höfe, ≈ 19.000 Einwohner), vitest auf dem Entwicklungsrechner:

| Messung | Wert |
|---|---|
| ein Zeitschritt `schritt()` zu Beginn | 20 ms |
| ein Zeitschritt bei 1.580 Höfen | **290 ms** (Spitze 393 ms) |
| Straßenketten fürs Zeichnen `strassenKetten()` | 56 ms |
| Takt bei 4× | alle 112 ms ein Schritt |

Ein Schritt dauert also länger als der Takt. Der Browser holt das auf, die Zeit läuft dann aber langsamer als eingestellt.

Ursachen im Code:

- **Häuser suchen (`hausplaetze`):** Jeder Schritt durchläuft alle 262.144 Felder. Für jedes Straßenfeld prüft er 12 Grundstücke à 9 Felder, und jedes Feld rechnet die Neigung neu (4 Höhenabfragen). Das sind Millionen Höhenabfragen je Schritt.
- **Versorgung (`hausWerte`):** Alle 4 Schritte wird jedes Haus gegen jedes Bedürfnis und jedes Gebäude geprüft.
- **Zeichnen (`aktualisiere`):** Bei jedem Schritt werden alle Felder nach Straßen durchsucht, die Ketten verfolgt, das Straßenband neu gebaut und 10.000 Bäume umgestellt. Das passiert auch, wenn sich nichts geändert hat.

### 1.2 Spielbalance

Der Screenshot (Stufe 4, 26.418 Einwohner) zeigt das Problem: Die Versorgung mit Markt liegt bei 12 %, mit Kirche bei 9 %. Die Stadt wächst trotzdem.

- **Häuser ohne Versorgung:** Häuser entstehen im Einzugsbereich *irgendeines* Gebäudes, auch neben Fabrik oder Bahnhof ohne Markt.
- **Platz unabhängig von Versorgung:** Der »Platz für …« ergibt sich aus der Summe der Gebäude, nicht daraus, wie gut die Häuser versorgt sind. Unversorgte Häuser haben nur weniger Bewohner (4 statt 12), verschwinden aber nie.
- **Keine Wirtschaft:** Es gibt keine Kosten, keine Arbeitskräfte und keine Nahrung. Ein Gebäude ist immer nur Gewinn.
- **Kein Umland:** Die Stadt steht allein, ohne Dörfer und Felder. Dabei war die vormoderne Stadt ohne Umland nicht lebensfähig.

---

## 2. Was die Forschung sagt (und was wir daraus machen)

| Befund | Quelle | Für das Spiel |
|---|---|---|
| **Zentrale Orte:** Güter haben eine Reichweite. Häufige Güter (Brot) braucht man nah, seltene (Markt, Gericht, Dom) nimmt man weite Wege in Kauf. Orte bilden eine Hierarchie; im Versorgungsprinzip (K = 3) versorgt ein höherrangiger Ort sich selbst und den Anteil von zwei niederrangigen. | Christaller 1933, [Zusammenfassung](https://en.wikipedia.org/wiki/Central_place_theory) | Jedes Gebäude bekommt eine **Güterordnung**: Brunnen und Bäcker klein, Markt mittel, Kirche und Rathaus groß, Dom und Universität sehr groß. Reichweiten nicht frei wählen, sondern aus der Ordnung. Dörfer sind die unterste Stufe der Hierarchie. |
| **Ringe der Landnutzung:** Wie teuer der Transport ist, bestimmt, was wo angebaut wird. Innen Gärten und Milch, dann Holz (schwer zu fahren), dann Getreide, außen Weide. | von Thünen 1826, [Überblick](https://en.wikipedia.org/wiki/Johann_Heinrich_von_Th%C3%BCnen) | **Felder um Dörfer und Stadt** in Ringen: Gärten am Rand, Getreide weiter draußen, Wald und Weide außen. Ertrag sinkt mit der Wegzeit zum Markt. |
| **Kleine Städte:** Um 1500 gab es im Reich rund 3.000 Städte, davon etwa 2.800 mit 100–1.000 Einwohnern. Die größte (Augsburg) hatte rund 50.000. | [Britannica: Germany, Urban life](https://www.britannica.com/place/Germany/Urban-life) | Stufenschwellen **viel kleiner** als jetzt: Marktort ab einigen Hundert, Stadt ab etwa 1.000, Großstadt erst mit der Industrie. |
| **Ackerbürgerstadt:** Viele Kleinstädte waren Mischformen aus Dorf und Stadt; die Bürger bewirtschafteten eigene Felder. Eine Stadt ist bei Weber »immer ein Marktort«. | Weber, nach [ELTE-Aufsatz](https://ojs.elte.hu/hsce/article/download/2407/2766/5486) | Frühe Stufen: Höfe mit eigenen Feldern auch in der Stadt (Drei-/Vierseithof passt). Ohne Markt keine Stadt. |
| **Vom Dorf zur Stadt:** Marktrechte gab es schon vor dem Stadtrecht. Ab dem 12. Jh. wurde Marktrecht zu Stadtrecht. Viele Marktorte des 14./15. Jh. entstanden auf Dörfern des 13. Jh. | [Kloepfer, BLB](https://regionalia.blb-karlsruhe.de/files/23878/BLB_Kloepfer_Verwaltung_Stadt_Mittelalter.pdf); [Market town](https://en.wikipedia.com/wiki/Market_town) | Dein Vorschlag passt historisch: **Die Karte startet mit Dörfern; einen Markt in ein Dorf setzen erhebt es zum Marktort.** Mauer und Rathaus machen ihn zur Stadt. |
| **Marktabstand:** In England durfte kein neuer Markt näher als etwa eine Tagesreise (rund 10 km hin und zurück) an einem bestehenden entstehen. | [Market town](https://en.wikipedia.com/wiki/Market_town) | Zweiter Markt nur weit genug weg, sonst teilen sich beide die Kundschaft (Wirkung halbiert). Auf unserer 3-km-Karte gilt der Abstand innerhalb der Stadt (siehe 4.4). |
| **Berufe:** Die großen Erwerbszweige der spätmittelalterlichen Stadt waren Lebensmittel, Textil, Bau und Fernhandel. Montpellier 1435–46: Bauern 25 % der Erwerbstätigen mit bekanntem Beruf, Metzger 4 %, Zimmerleute 6 %. In Manresa waren Schuster mit 15 % die größte Gruppe. | [medievalists.net](https://www.medievalists.net/2023/08/jobs-medieval-city/), [Montpellier](https://www.medievalists.net/2021/11/most-common-jobs-medieval-city/) | **Berufsgruppen** statt Einzelberufen: Bauern, Nahrung (Müller, Bäcker, Metzger, Brauer), Textil (Weber), Bau (Zimmerer, Maurer), Handel. Anteile als Zielwerte für eine »gesunde« Stadt. |
| **Skalierung:** Infrastruktur wächst mit etwa N^0,8 (Größenvorteil), Wirtschaftsleistung und Erfindungen mit etwa N^1,15–1,2 (steigende Erträge). | Bettencourt u. a. 2007, [PNAS](https://pmc.ncbi.nlm.nih.gov/articles/PMC1852329) | **Balancing-Formeln:** Unterhalt der Straßen und Leitungen ∝ N^0,8, Steuern und Handel ∝ N^1,15. Große Städte lohnen sich, brauchen aber mehr Versorgung. |
| **Wachstum als Zellautomat:** Bewährte Modelle wachsen nach Steigung, Landnutzung, Ausschlussflächen, Stadtrand, Verkehr und Gelände (SLEUTH: Slope, Land use, Exclusion, Urban extent, Transportation, Hillshade). | Clarke, [SLEUTH](https://people.geog.ucsb.edu/~kclarke/Silva&Clarke2005.pdf) | Unser Feldraster ist schon ein solcher Automat. Neu: Wachstum am **Straßenrand und an Verkehrsachsen** (Straßenzug-Wachstum), ausgeschlossen sind nasse Aue, Wasser und Steilhang. |
| **Aufbauspiel-Vorbild:** Mehrere Bevölkerungsstufen. Grundbedürfnisse erhöhen die Bewohner je Haus, Luxusbedürfnisse die Zufriedenheit. Aufsteigen nur bei vollem Haus und erfüllten Grundbedürfnissen. Betriebe brauchen Arbeitskräfte bestimmter Stufen. | [Anno 1800 Wiki](https://anno1800.fandom.com/wiki/Population?oldid=3313), [Anno Union](https://www.anno-union.com/en/devblog-residential-tiers/) | Übernehmen, aber einfacher und historisch begründet (siehe 3). |

Zwei Werte sind **nicht belegt** und als Spielannahmen markiert:

- **Ackerfläche je Kopf:** Ich habe keinen seriösen Wert gefunden. Ein Forum nennt 3–12 Acres (1,2–5 ha) je Person einschließlich Brache. Wir setzen 1,5 ha je Person an.
- **Verstädterung vor 1800:** Der verbreitete Lehrbuchwert sind etwa 10–15 % der Bevölkerung in Städten (de Vries 1984); nicht nachgeprüft. Daraus folgt: Auf 1 Stadtbewohner kommen 6–9 Landbewohner.

---

## 3. Spielmodell (Entwurf)

### 3.1 Karte und Start

- **Startdörfer:** Beim Start gibt es 3–5 **Dörfer** an guten Plätzen, also trocken, eben, nah am Wasser und weiter als 600 m voneinander. Jedes Dorf hat 4–8 Höfe, eine Kapelle, einen Brunnen und Felder in Thünen-Ringen. Die Dörfer verbinden Feldwege.
- **Stadterhebung:** Den Markt setzt du in ein Dorf (Stadterhebung) oder auf freies Land (Gründungsstadt). Das gewählte Dorf wird Kern der Stadt, die anderen bleiben **Umland**. Sie liefern Nahrung über die Wege und wachsen langsam mit.
- **Neue Dörfer:** Später können weitere Dörfer entstehen, wenn Nahrung fehlt und freies Ackerland da ist (Rodung, Landesausbau).

### 3.2 Schichten und Häuser

| Schicht | wohnt in | Bewohner je Haus | arbeitet in |
|---|---|---|---|
| Bauern | Hof im Dorf / Ackerbürgerhof | 6–8 | Feld, Weide, Wald |
| Handwerker | Hof / Giebelhaus in der Stadt | 5–8 | Mühle, Bäcker, Schmied, Weber, Bau |
| Bürger (Kaufleute) | Bürgerhaus am Markt | 8–12 | Handel, Kontor, Rathaus |
| Arbeiter (ab Industrie) | Mietshaus / Zechenkolonie | 20–40 | Fabrik, Zeche, Bahn |
| Angestellte (Moderne) | Wohnblock / Einfamilienhaus | 3–60 | Büro, Verwaltung, Handel |

Die Schichten sind je Stadttyp benannt, z. B. Bergleute in der Bergmannsstadt.

- **Aufsteigen:** Ein Haus steigt auf, wenn es voll ist und seine Grundbedürfnisse erfüllt sind.
- **Absteigen:** Fehlt ein Grundbedürfnis längere Zeit (etwa 20 Schritte), steigt es ab. Ist es dann leer, verschwindet es. **Versorgung zählt also wirklich.**

### 3.3 Bedürfnisse (Reichweite nach Güterordnung)

| Bedürfnis | Gebäude | Ordnung | Reichweite (Gehzeit) | ab Schicht |
|---|---|---|---|---|
| Wasser | Brunnen | 1 | 2 min (≈ 150 m) | Bauern |
| Nahrung | Markt (verteilt, was die Bauern liefern) | 2 | 6 min (≈ 400 m) | Handwerker |
| Glaube | Kapelle → Kirche → Dom | 1 / 3 / 4 | 3 / 8 / 20 min | Bauern |
| Schutz | Mauer bzw. Burg | 3 | ganze Stadt innerhalb der Mauer | Handwerker |
| Recht | Rathaus | 3 | 10 min | Bürger |
| Bildung | Schule → Universität | 2 / 4 | 6 / 25 min | Bürger |
| Gesundheit | Spital | 3 | 10 min | Bürger |
| Nahverkehr (ab 1880) | Haltestelle | 1 | 5 min | Arbeiter |

Gehzeit statt Luftlinie: gerechnet auf dem Straßennetz (Wegsuche ab dem Gebäude, einmal je Änderung). Damit lohnen sich Straßen und Brücken.

### 3.4 Berufe und Warenkette (einfach gehalten)

| Kette | Schritte |
|---|---|
| Nahrung | Feld (Bauern) → Mühle (Handwerker, braucht Wasser) → Bäcker → **Markt** → Häuser in Reichweite |
| Bauen | Wald (Holzfäller) → Zimmerei; Steinbruch → Maurer. Neue Gebäude brauchen Baustoff, sonst bauen sie langsam. |
| Handel | Kontor oder Markt + Wege zu anderen Märkten → Bürger, Steuern |
| Industrie | Zeche → Hütte → Fabrik (Arbeiter); die Bahn bringt Rohstoffe |

- **Betriebe brauchen Personal:** Jeder Betrieb braucht Arbeitskräfte einer Schicht, z. B. eine Mühle 4 Handwerker, ein Feld 1 Bauernhof je 6 ha. Ohne Leute steht er still.
- **Anzeige:** Die Seitenleiste zeigt das **Berufsgefüge** als Balken und vergleicht es mit Zielanteilen aus der Forschung: früh rund 25 % Bauern, je etwa 15 % Nahrung und Textil, rund 10 % Bau, Rest Handel und Dienste.

### 3.5 Verkehr zwischen Dorf und Stadt

- **Wegarten:** Feldweg, Landstraße, Chaussee, Kanal, Bahn, Tram, Straße. Je Epoche gibt es eine Wegart mit eigener Geschwindigkeit: zu Fuß 4 km/h, Ochsenkarren 3 km/h, Pferdefuhrwerk 8 km/h, Kahn 5 km/h (stromab mehr), Bahn 40 km/h, Tram 15 km/h, Auto 40 km/h.
- **Ertrag eines Dorfes** = Feldertrag × (1 − Wegzeit / Grenzzeit). Das ist Thünen auf unserem Wegnetz. Gute Wege zum Markt heben also den Ertrag.
- **Darstellung:** Karren und Fußgänger laufen sichtbar zwischen Dorf und Markt (später). Sie zeigen den Warenfluss, und man sieht Engpässe.

---

## 4. Stufen und Balancing (europäische Stadt; andere Typen analog)

### 4.1 Stufen

| Stufe | Name | Schwelle | Pflicht | schaltet frei |
|---|---|---|---|---|
| 0 | Dörfer | — | — | Brunnen, Kapelle, Feld, Mühle |
| 1 | Marktort | Markt in einem Dorf oder auf freiem Land, ≥ 150 Einw. im Kern | Markt, Brunnen | Bäcker, Schmied, Kirche, Burg |
| 2 | Stadt | ≥ 800 Einw., ≥ 70 % der Häuser mit Wasser, Nahrung, Glaube | Kirche, Mauer oder Burg, Rathaus | Bürgerhäuser, Kontor, Spital, Brücke, Trockenlegen |
| 3 | Handelsstadt | ≥ 3.000 Einw., ≥ 50 Bürgerhäuser, ≥ 70 % versorgt | Kontor oder Fernhandel, Schule | Dom, Universität, zweiter Markt |
| 4 | Industriestadt | ≥ 12.000 Einw. | Bahnhof, Fabrik | Arbeiterviertel, Ring statt Mauer, Tram |
| 5 | Moderne | ≥ 40.000 Einw. | Schulen, Haltestellen für ≥ 60 % | Großsiedlung, Einkaufszentrum |

Die Schwellen sind gegenüber jetzt (2.500 / 9.000 / 25.000) für die frühen Stufen deutlich gesenkt, passend zur Größe echter mittelalterlicher Städte. Die Versorgungsquote ist Pflicht für den Aufstieg, nicht nur die Gebäude.

### 4.2 Wie viele Einwohner es gibt

Der »Platz für …« aus der Summe der Gebäude entfällt. Die Einwohner ergeben sich aus den Häusern:

```
Bewohner(Haus) = Grundzahl(Schicht) × (0,4 + 0,6 × Anteil erfüllter Grundbedürfnisse)
Neue Häuser nur, wenn
  (a) das Grundstück Wasser und Nahrung in Reichweite hat und
  (b) Nahrung im Überschuss ist: Ertrag aller Felder ≥ 1,1 × Bedarf der Stadt
Nahrungsbedarf = Einwohner × 1 Einheit; Feldertrag = Fläche[ha] / 1,5 × Wegfaktor
```

So begrenzen Nahrung und Versorgung das Wachstum. Ein neues Dorf oder eine bessere Straße schafft Platz für Hunderte, ein Markt ohne Umland nicht.

### 4.3 Kosten und Steuern (Skalierung nach Bettencourt)

- **Einnahmen:** Steuern je Schritt = c₁ × Einwohner^1,15 × Zufriedenheit.
- **Ausgaben:** Unterhalt je Schritt = c₂ × (Straßenfelder)^0,8 + Summe der Gebäudekosten.
- **Bauen kostet:** Geld (Taler) und Baustoff. Startkapital reicht für Markt, Brunnen und Kirche.
- Damit wird Zersiedelung teuer: viele Straßen bei wenig Einwohnern. Dichte, gut versorgte Städte tragen sich.

### 4.4 Reichweiten auf unserer Karte

Die Karte ist rund 3 km breit, ein Feld 6 m. Innerhalb der Stadt rechnen wir in Gehminuten mit 80 m je Minute auf Wegen:

- Markt 6 min ≈ 480 m Weg
- Kirche 8 min
- Brunnen 2 min

Zwei Märkte näher als 600 m teilen sich die Kunden; das Kärtchen zeigt dann »teilt sich die Kundschaft mit …«.

### 4.5 Zielwerte zum Prüfen (Tests)

- Eine »gut gespielte« Stadt (Testskript setzt Gebäude nach Plan) erreicht jede Stufe in einer begrenzten Zahl von Schritten.
- Eine »schlecht gespielte« Stadt (nur Markt, keine Versorgung) bleibt unter Stufe 2.
- Bei 70 % Versorgung steigt die Einwohnerzahl, bei 30 % sinkt sie.
- Ab Stufe 2 liegt das Verhältnis Land zu Stadt zwischen 2:1 und 9:1.
- Jede Gebäudeart lohnt sich irgendwo: Kein Gebäude ist immer schlechter als ein anderes.

---

## 5. Umsetzung in Phasen

| Phase | Inhalt | Prüfung |
|---|---|---|
| 0 Leistung (mit Phase 1/2) | Bebaubarkeit je Feld einmal vorab rechnen. Liste der Straßenfelder mit freien Nachbarn führen statt jedes Mal alles zu durchsuchen. Versorgung als Abdeckungs-Raster je Bedürfnis, nur bei Änderungen neu. Neu zeichnen nur, wenn sich etwas geändert hat. Die Simulation läuft in einem Web Worker. | Schritt < 10 ms bei 3.000 Häusern (Messtest), flüssig bei 4× |
| 1 Dörfer und Stadterhebung | Startdörfer mit Höfen, Kapelle, Brunnen und Feldern in Ringen. Markt ins Dorf setzen erhebt es zum Marktort. Feldwege zwischen den Dörfern. | Tests: Dörfer an gültigen Plätzen; Erhebung übernimmt Dorf und Häuser |
| 2 Bedürfnisse nach Güterordnung, Gehzeit | Reichweite auf dem Wegnetz. Häuser steigen auf und ab, leere verschwinden. Versorgungsquote als Pflicht für die Stufe. Platz aus Gebäuden entfällt. | Tests aus 4.5 (gut/schlecht gespielt, 70/30 %) |
| 3 Nahrung und Umland | Feldertrag nach Fläche und Wegzeit. Nahrungsbilanz begrenzt das Wachstum. Neue Dörfer entstehen bei Bedarf. | Test: mehr Felder oder bessere Wege → mehr Einwohner |
| 4 Berufe und Betriebe | Schichten, Arbeitskräfte je Betrieb, Berufsgefüge-Anzeige, Warenkette Getreide → Mühle → Bäcker → Markt | Test: Betrieb ohne Personal steht still; Anteile nahe den Zielwerten |
| 5 Geld und Unterhalt | Steuern ∝ N^1,15, Unterhalt ∝ Straßen^0,8, Baukosten | Test: Zersiedelung führt ins Minus, dichte Stadt ins Plus |
| 6 Verkehr | Wegarten je Epoche, Karren und Fußgänger als Figuren, Engpässe sichtbar | Sicht im Browser |
| 7 Übrige Stadttypen | Stufen, Schichten und Ketten je Typ: Bergbau (Erz → Hütte), Industrie (Zeche → Hütte → Fabrik), Hafen (Kontor, Werft, Fernhandel), Tech (Uni → Firmen) | je Typ ein »gut gespielt«-Test |

---

## 6. Offene Entscheidungen

1. **Geld (Phase 5):** wirklich mit Steuern und Kosten, oder nur Nahrung, Versorgung und Personal als Grenzen? Mit Geld wird es ein echtes Aufbauspiel, aber schwerer für jüngere Klassen.
2. **Warenkette:** vollständig mit Lager und Transport, oder vereinfacht als »Betrieb versorgt Häuser in Reichweite, wenn er Personal und Rohstoff hat«? Ich empfehle die vereinfachte Fassung.
3. **Bisheriger Bau-Modus (2D):** bleibt er, oder geht er im Aufbau auf, sobald der fertig ist?

---

## 7. Umsetzungsstand (2026-11-18)

Umgesetzt (`lib/stadt/aufbau.ts`, `lib/stadt/aufbauRegeln.ts`, Tests in `tests/aufbau.test.ts`):

- **Dörfer und Stadterhebung (Phase 1):** 3–4 Dörfer mit Höfen, Brunnen, Kapelle, Äckern in Ringen und Feldwegen; Namen ausgedacht. Das Kern-Gebäude (Markt …) erhebt ein Dorf zum Marktort und legt Landstraßen zu den anderen.
- **Bedürfnisse nach Güterordnung (Phase 2):** Reichweite in Gehminuten auf dem Wegenetz (80 m/min): Brunnen 2 min, Kapelle 3, Markt 6, Kirche 8, Rathaus 10, Burg 14, Dom 20. Schichten Bauern → Handwerker → Bürger → Arbeiter → Angestellte mit Auf- und Abstieg; ein leeres Haus verschwindet. Für den Aufstieg müssen 70 % der Häuser voll versorgt sein. Ab der Handelsstadt sind mehrere Märkte erlaubt; liegen sie näher als 600 m, halbiert sich ihre Wirkung.
- **Nahrung (Phase 3, vereinfacht):** Jeder Bauernhof liefert 30 Einheiten, wenn er einen Markt über Wege erreicht, sonst 30 %. Dazu kommen Einfuhren über Bahnhof, Kai und Kontor sowie die Mühle mit +15 %. Neue Stadthäuser entstehen nur bei Nahrungsüberschuss. Fehlt Nahrung, bekommen die Dörfer neue Höfe (Landesausbau).
- **Geld (Phase 5):** Baukosten aus Fläche und Höhe; Steuern 0,0065 · Steuerkraft^1,15 · Zufriedenheit; Unterhalt 0,005 · Baukosten + 0,012 · Stadtstraßen^0,8. Dorfbauten und Feldwege kosten nichts. Trockenlegen kostet 40 Taler, Abreißen gibt 25 % zurück.
- **Leistung (Phase 0):** Neigung je Feld wird einmal vorab gerechnet. Straßenliste und Versorgungsraster werden nur bei Änderungen neu erstellt, Straßen und Bäume nur bei Änderungen neu gezeichnet. Ein Schritt dauert rund 10 ms statt bis zu 290 ms.
- **Korrekturen:** In der Wegsuche (A*) wurde jeder Knoten ab dem zweiten verworfen, weil der Schlüssel mit Schätzung gegen die reinen Kosten verglichen wurde. Gebäude dürfen nicht mehr auf Straßen stehen und brauchen eine freie Zufahrt.

Verlauf der »gut gespielten« Teststadt (europäisch, Seed 12): Stufe 2 nach etwa 60 Schritten, Stufe 3 nach etwa 280. Bei rund 8.200 Einwohnern ist Schluss, weil alle Dörfer voll sind; dann braucht es Bahn oder Schiff. Die Versorgung liegt fast überall bei 100 %.

Offen: Berufe und Betriebe mit Personal (Phase 4), Karren und Fußgänger sichtbar (Phase 6), eigene Ketten je Stadttyp (Phase 7). Spät im Spiel sammelt sich viel Geld an; ein Ventil fehlt noch (teure Großbauten, Unterhalt der höheren Stufen).
