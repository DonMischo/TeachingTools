/**
 * Das Glossar — jedes Fachwort einmal erklärt, dort wo es steht.
 *
 * Die Lesetexte der Werkstatt nennen die Dinge beim Namen: Token, Perplexität,
 * Backpropagation, XOR. Das ist richtig so — nur sind diese Wörter aus dem
 * Vorwissen nicht bekannt, und ohne Erklärung bleibt der Satz eine Hülle.
 *
 * Deshalb hängt an jedem Fachwort eine kurze Auskunft, die beim Berühren oder
 * Antippen erscheint. Sie muss zwei Bedingungen erfüllen:
 *
 *   ▸ **Ein Satz muss reichen.** Wer nur wissen will, was das Wort bedeutet,
 *     liest `kurz` und ist fertig.
 *   ▸ **Kein neues Fachwort erklären, ohne es zu erklären.** Wo es nicht anders
 *     geht, steht der Begriff selbst wieder im Glossar.
 *
 * Verknüpft wird nicht von Hand: `zerlegeMitFachworten` findet die Begriffe im
 * laufenden Text. Ein Begriff wird je Absatz nur beim ersten Vorkommen
 * markiert — sonst ist der Text ein Minenfeld aus gepunkteten Wörtern.
 */

/** Ein kleines Bild zum Begriff — gezeichnet in `Fachwort.tsx`. */
export type GlossarBild = "xor" | "sigmoid" | "tal" | "lokal" | "gerade" | "kette" | "fenster";

export type Glossareintrag = {
  /** Wie der Begriff im Kasten überschrieben wird. */
  titel: string;
  /** Weitere Schreibweisen, die im Text auch markiert werden sollen. */
  auch?: string[];
  /** Ein Satz, der reicht. */
  kurz: string;
  /** Für die, die weiterlesen wollen. */
  lang?: string;
  bild?: GlossarBild;
};

export const GLOSSAR: Record<string, Glossareintrag> = {
  // ── Sprachmodell ───────────────────────────────────────────────────────
  Token: {
    titel: "Token",
    auch: ["Tokens", "Tokenisierung"],
    kurz: "Ein Stück Text, mit dem ein Modell rechnet — meist ein Wort, ein Wortteil oder ein Satzzeichen.",
    lang: "Modelle kennen keine Buchstaben. Sie haben eine feste Liste von Stücken, jedes mit einer Nummer; jeder Text wird in diese Stücke zerlegt. Häufige Wörter sind ein Token, seltene bestehen aus mehreren.",
  },
  "Byte-Pair Encoding": {
    titel: "Byte-Pair Encoding (BPE)",
    auch: ["BPE"],
    kurz: "Das übliche Verfahren, um die Token-Liste zu bauen: immer wieder das häufigste Zeichenpaar zu einem neuen Stück verschmelzen.",
    lang: "Man beginnt mit einzelnen Zeichen und wiederholt das Verschmelzen, bis die gewünschte Anzahl Stücke erreicht ist (meist 50 000 bis 200 000). Häufiges wird dadurch von allein zu einem Stück, Seltenes bleibt zerlegt.",
  },
  Bigramm: {
    titel: "Bigramm",
    auch: ["Bigramm-Modell"],
    kurz: "Ein Modell, das immer nur zwei Wörter zusammen anschaut: das letzte und das nächste.",
    lang: "»bi« heißt zwei. Ein Bigramm-Modell merkt sich für jedes Wort, wie oft welches Wort darauf folgte — mehr Zusammenhang kennt es nicht.",
  },
  Trigramm: {
    titel: "Trigramm",
    kurz: "Wie ein Bigramm, nur mit zwei Wörtern Rückblick statt einem.",
  },
  "n-Gramm": {
    titel: "n-Gramm",
    auch: ["n-Gramm-Modell", "n-Gramm-Modelle", "n-Gramm-Modellen"],
    kurz: "Ein Modell, das n Wörter am Stück betrachtet — der Sammelbegriff für Unigramm, Bigramm, Trigramm und so weiter.",
  },
  "Markow-Kette": {
    titel: "Markow-Kette",
    kurz: "Ein Ablauf, bei dem der nächste Schritt nur vom jetzigen Zustand abhängt — nicht davon, wie man dorthin kam.",
    lang: "Benannt nach dem Mathematiker Andrei Markow. Genau diese Vergesslichkeit macht unser Wortnetz klein und schnell — und begrenzt es zugleich.",
    bild: "kette",
  },
  Attention: {
    titel: "Attention (Aufmerksamkeit)",
    kurz: "Der Trick moderner Modelle: Für jedes Wort wird ausgerechnet, welche früheren Wörter jetzt wichtig sind.",
    lang: "Statt stur auf das letzte Wort zu schauen, verteilt das Modell Gewichte auf alle bisherigen Wörter — viel Gewicht heißt »das ist jetzt wichtig«. Diese Gewichte hängen vom Satz ab und werden für jedes Wort neu berechnet.",
  },
  Transformer: {
    titel: "Transformer",
    kurz: "Die Bauform, aus der fast alle heutigen Sprachmodelle bestehen — im Kern viele Attention-Schichten übereinander.",
    lang: "2017 vorgestellt und seitdem der Standard: ChatGPT, Claude und Gemini sind alle Transformer. Das »T« in GPT steht dafür.",
  },
  Perplexität: {
    titel: "Perplexität",
    kurz: "Ein Maß dafür, wie überrascht ein Modell vom nächsten Wort ist — je kleiner, desto besser sagt es vorher.",
    lang: "Anschaulich: Zwischen wie vielen gleich wahrscheinlichen Möglichkeiten schwankt das Modell im Schnitt? Perplexität 10 heißt: so unsicher, als hätte es bei jedem Wort zehn gleich gute Kandidaten. Daran wird gemessen, ob ein Modell gut ist.",
  },
  Entropie: {
    titel: "Entropie",
    kurz: "Wie viel Neues in einer Nachricht steckt — gemessen daran, wie schwer sie vorherzusagen ist.",
    lang: "Ein Text, den man Wort für Wort erraten kann, enthält wenig Information. Einer, der ständig überrascht, viel. Der Begriff stammt von Claude Shannon (1948) und ist die Grundlage der ganzen Nachrichtentechnik.",
  },
  Kreuzentropie: {
    titel: "Kreuzentropie",
    kurz: "Der Fehlerwert beim Training von Sprachmodellen: Wie sehr weicht die Vorhersage von dem ab, was wirklich kam?",
  },
  "top-k": {
    titel: "top-k",
    kurz: "Eine Einstellung beim Schreiben: Nur die k wahrscheinlichsten Wörter kommen überhaupt in den Würfelbecher.",
    lang: "Bei k = 1 wird immer das wahrscheinlichste Wort genommen — der Text wird gleichförmig. Je größer k, desto mehr Überraschung, aber auch mehr Unsinn.",
  },
  "top-p": {
    titel: "top-p (Nucleus Sampling)",
    kurz: "Wie top-k, nur nach Wahrscheinlichkeit abgeschnitten: Es kommen so viele Wörter in den Becher, bis zusammen p Prozent erreicht sind.",
  },
  Temperatur: {
    titel: "Temperatur",
    kurz: "Ein Regler, der die Unterschiede zwischen den Wahrscheinlichkeiten verstärkt oder abschwächt.",
    lang: "Niedrige Temperatur macht das Wahrscheinlichste noch wahrscheinlicher (brav und vorhersehbar), hohe rückt alle näher zusammen (wild und überraschend). Bei Temperatur 0 wird immer das Beste genommen.",
  },
  "Greedy-Decoding": {
    titel: "Greedy-Decoding",
    kurz: "Immer das wahrscheinlichste Wort nehmen, ohne zu würfeln.",
    lang: "»Greedy« heißt gierig: Das Verfahren greift in jedem Schritt nach dem Besten und schaut nicht, ob ein anderer Weg später besser wäre. Ergebnis: immer derselbe Text — und oft Wiederholungsschleifen.",
  },
  Korpus: {
    titel: "Korpus",
    auch: ["Korpora", "Web-Korpora"],
    kurz: "Die Sammlung von Texten, aus der ein Modell lernt.",
    lang: "Wer den Korpus auswählt, bestimmt, worüber ein Modell reden kann und wie es klingt. Bei großen Modellen umfasst er einen Großteil des öffentlichen Internets — und die Auswahl trifft eine Handvoll Firmen.",
  },
  "Maximum-Likelihood-Schätzung": {
    titel: "Maximum-Likelihood-Schätzung",
    kurz: "Die Parameter so wählen, dass die beobachteten Daten möglichst wahrscheinlich werden.",
    lang: "Beim Zählen von Wortpaaren ist das genau die relative Häufigkeit: Wenn nach »die« achtmal »Katze« stand und zweimal »Maus«, sind 80 % und 20 % die Werte, unter denen der Text am wenigsten überraschend ist.",
  },
  Backoff: {
    titel: "Backoff (Rückfall)",
    kurz: "Wenn eine lange Wortfolge unbekannt ist, wird mit weniger Rückblick gefragt.",
    lang: "Steht »Der Katze« nirgends im Text, hilft die Frage »was folgt auf Katze?« immer noch weiter. So bleibt das Modell auskunftsfähig, statt stecken zu bleiben.",
  },
  Glättung: {
    titel: "Glättung",
    kurz: "Ungesehenen Wortfolgen trotzdem eine kleine Wahrscheinlichkeit geben, statt null.",
    lang: "Ohne Glättung hält ein Zählmodell alles für unmöglich, was im Trainingstext zufällig nicht vorkam — bei begrenzten Daten ist das fast alles.",
  },
  Kontextfenster: {
    titel: "Kontextfenster",
    kurz: "Wie viel Text ein Modell gleichzeitig im Blick hat.",
    lang: "Alles außerhalb existiert für das Modell nicht. Heutige Modelle schaffen einige hundert Seiten; das Fenster zu vergrößern ist teuer, weil der Rechenaufwand quadratisch mit der Länge wächst.",
  },
  Halluzination: {
    titel: "Halluzination",
    kurz: "Wenn ein Modell etwas Falsches erfindet und es genauso überzeugt vorträgt wie etwas Richtiges.",
    lang: "Kein Versehen, sondern die Bauart: Das Modell sucht die wahrscheinlichste Fortsetzung, nicht die wahre. Eine Stelle, an der etwas auf Richtigkeit geprüft würde, gibt es nirgends.",
  },
  "Winograd-Schema": {
    titel: "Winograd-Schema",
    auch: ["Winograd-Schemata"],
    kurz: "Ein Satzpaar, das sich in einem Wort unterscheidet und bei dem sich dadurch der Bezug umdreht.",
    lang: "Erfunden als Prüfung, die sich nicht mit Statistik über einzelne Wörter lösen lässt: »Der Pokal passt nicht in den Koffer, weil er zu groß/klein ist.« Wer »er« richtig zuordnet, muss den Satz verstanden haben.",
  },

  // ── Bilder ─────────────────────────────────────────────────────────────
  Diffusion: {
    titel: "Diffusion",
    auch: ["Diffusionsmodell", "Diffusionsmodelle"],
    kurz: "Das Verfahren hinter Bildgeneratoren: Ein Bild wird Schritt für Schritt aus Rauschen herausgeholt.",
    lang: "Trainiert wird andersherum — man verrauscht echte Bilder und lässt das Modell lernen, das Rauschen zu erkennen. Wer Rauschen erkennen kann, kann es auch abziehen.",
  },
  Score: {
    titel: "Score",
    kurz: "Die Richtung, in der ein Bild wahrscheinlicher wird — der Wegweiser beim Entrauschen.",
    lang: "Mathematisch die Richtung des stärksten Anstiegs der Wahrscheinlichkeitsdichte. Ein Bildmodell schätzt sie; bei einer bekannten Punktwolke lässt sie sich direkt ausrechnen.",
  },
  "Classifier-Free Guidance": {
    titel: "Classifier-Free Guidance",
    auch: ["Guidance"],
    kurz: "Der Regler, wie streng sich ein Bildmodell an den Prompt hält.",
    lang: "Das Modell rechnet zweimal — einmal mit dem Wunsch, einmal ohne — und übertreibt den Unterschied. Zu wenig ergibt beliebige Bilder, zu viel überzeichnete.",
  },
  "Latent Diffusion": {
    titel: "Latent Diffusion",
    kurz: "Diffusion nicht auf Pixeln, sondern in einer verkleinerten Darstellung des Bildes.",
    lang: "Ein Vorschaltnetz schrumpft das Bild um etwa den Faktor acht je Kante; dort wird gerechnet, am Ende wird wieder vergrößert. Das macht Bildgeneratoren überhaupt bezahlbar — Stable Diffusion heißt danach.",
  },
  Autoencoder: {
    titel: "Autoencoder",
    kurz: "Ein Netz, das etwas erst zusammenpresst und dann wieder herstellt — und dabei lernt, was wichtig ist.",
  },
  Seed: {
    titel: "Seed (Startwert)",
    auch: ["Startwert", "Startwerte", "Startwerten"],
    kurz: "Die Zahl, mit der der Zufall anfängt — gleicher Seed, gleiches Ergebnis.",
    lang: "Computer würfeln nicht wirklich, sie rechnen eine Zahlenfolge aus. Der Seed ist der Anfang dieser Folge. Deshalb lässt sich ein KI-Bild exakt wiederherstellen, wenn man Prompt und Seed kennt.",
  },
  C2PA: {
    titel: "C2PA / Content Credentials",
    kurz: "Ein Verfahren, das die Herkunft eines Bildes fälschungssicher an die Datei hängt.",
    lang: "Statt dem Bild anzusehen, ob es echt ist, prüft man eine mitgelieferte, signierte Entstehungsgeschichte: Womit aufgenommen, womit bearbeitet, von wem. Das ist nachprüfbar — das Aussehen nicht.",
  },

  // ── Lernen ─────────────────────────────────────────────────────────────
  XOR: {
    titel: "XOR (»entweder oder«)",
    auch: ["XOR-Problem"],
    kurz: "Eine Aufgabe, die genau dann »ja« sagt, wenn von zwei Dingen genau eines zutrifft — und die sich nicht mit einer Geraden trennen lässt.",
    lang: "»Entweder A oder B, aber nicht beides.« Trägt man die vier Fälle in ein Feld ein, liegen die Ja-Fälle über Kreuz — und über Kreuz bekommt man mit einem einzigen geraden Strich nicht auseinander. Genau daran scheitert ein einzelnes Neuron.",
    bild: "xor",
  },
  Perzeptron: {
    titel: "Perzeptron",
    auch: ["Perzeptron-Regel"],
    kurz: "Das erste künstliche Neuron, 1958 von Frank Rosenblatt — mit einer Regel, nach der es aus Fehlern lernt.",
    lang: "Es gewichtet seine Eingaben, zählt sie zusammen und sagt ja oder nein. Liegt es falsch, werden die Gewichte ein Stück in Richtung der richtigen Antwort geschoben. Mehr steckt nicht dahinter — und genau das ist bis heute die Idee jedes Trainings.",
  },
  Backpropagation: {
    titel: "Backpropagation",
    kurz: "Das Verfahren, den Fehler rückwärts durch alle Schichten zu verteilen — jedes Gewicht erfährt seinen Anteil daran.",
    lang: "Ohne sie wäre nicht klar, wie ein Gewicht tief im Netz den Fehler am Ende beeinflusst hat. Mit ihr lässt es sich ausrechnen (über die Kettenregel), und erst dadurch sind tiefe Netze überhaupt trainierbar. Durchgesetzt hat sie sich 1986.",
  },
  Gradientenabstieg: {
    titel: "Gradientenabstieg",
    auch: ["Gradient", "Gradienten"],
    kurz: "Bergab gehen: Der Fehler wird als Landschaft gedacht, und man geht immer ein Stück in die Richtung, in der es am steilsten abwärts geht.",
    lang: "Der Gradient ist genau diese Richtung. Die Schrittweite heißt Lernrate: zu klein und es dauert ewig, zu groß und man springt über das Tal hinweg.",
    bild: "tal",
  },
  "Full Batch": {
    titel: "Full-Batch",
    auch: ["Full-Batch-Gradientenabstieg", "Full-Batch-Gradientenabstiegs"],
    kurz: "Vor jedem Schritt werden alle Beispiele durchgerechnet — nicht nur eines.",
    lang: "Das ergibt ruhigere, verlässlichere Schritte, kostet aber pro Schritt mehr. Große Modelle nehmen deshalb immer nur eine Handvoll Beispiele auf einmal (»Mini-Batch«); bei vierzig Punkten wie hier ist Full-Batch billig.",
  },
  Sigmoid: {
    titel: "Sigmoid",
    kurz: "Eine weiche S-Kurve, die jede Zahl auf einen Wert zwischen 0 und 1 zusammendrückt.",
    lang: "Statt hart »ja« oder »nein« zu sagen, antwortet ein Neuron damit »zu 73 % ja«. Nur weil der Übergang weich ist, lässt sich überhaupt berechnen, wie sehr ein Gewicht am Fehler schuld war.",
    bild: "sigmoid",
  },
  ReLU: {
    titel: "ReLU",
    kurz: "Die heute übliche Kurve in Neuronen: negative Werte werden zu null, positive bleiben, wie sie sind.",
    lang: "Einfacher und schneller als die Sigmoid — und sie verhindert, dass die Lernsignale in tiefen Netzen verschwinden.",
  },
  "lokales Minimum": {
    titel: "Lokales Minimum",
    auch: ["lokale Minima", "lokalen Minima", "lokales Minimum"],
    kurz: "Eine Mulde, in der das Training feststeckt, obwohl es tiefer ginge — von dort führt jeder kleine Schritt aufwärts.",
    lang: "Wer im Nebel bergab geht, landet irgendwann in einer Senke. Ob es die tiefste ist, sieht man von dort nicht. Der übliche Ausweg: neu würfeln und noch einmal losgehen.",
    bild: "lokal",
  },
  "linear separierbar": {
    titel: "Linear trennbar",
    auch: ["linear separierbaren", "linearer Klassifikator", "linearen Klassifikator", "lineare Separierbarkeit"],
    kurz: "Zwei Gruppen von Punkten heißen linear trennbar, wenn ein einziger gerader Strich sie auseinanderhält.",
    lang: "Genau das — und nichts mehr — kann ein einzelnes Neuron. In drei Dimensionen wäre der Strich eine Ebene, bei mehr Merkmalen eine »Hyperebene«.",
    bild: "gerade",
  },
  Hyperebene: {
    titel: "Hyperebene",
    kurz: "Das, was in vielen Dimensionen einer Geraden entspricht: eine flache Trennfläche.",
  },
  "verschwindender Gradient": {
    titel: "Verschwindende Gradienten",
    auch: ["verschwindender Gradienten"],
    kurz: "In tiefen Netzen wird das Lernsignal auf dem Weg nach hinten immer kleiner, bis vorne nichts mehr ankommt.",
    lang: "Jede Sigmoid-Schicht dämpft das Signal. Nach vielen Schichten bleibt fast nichts übrig, und die vorderen Schichten lernen nicht mehr. Deshalb nimmt man heute ReLU.",
  },
  "Universal-Approximations-Theorem": {
    titel: "Universal-Approximations-Theorem",
    kurz: "Ein Beweis, dass schon eine einzige verdeckte Schicht mit genug Neuronen praktisch jede Aufgabe lösen kann.",
    lang: "Der Haken: »genug« kann absurd viele bedeuten. Tiefe Netze schaffen dasselbe mit sehr viel weniger Neuronen — das ist der Grund für die Tiefe.",
  },
  "überwachtes Lernen": {
    titel: "Überwachtes Lernen",
    auch: ["überwachten Lernen"],
    kurz: "Lernen aus Beispielen, bei denen die richtige Antwort schon dabeisteht.",
    lang: "Jemand muss die Beispiele beschriften — beim Zeichnen-Spiel bist du das selbst. Genau diese Arbeit steckt auch hinter großen Bilderkennern, oft in schlecht bezahlter Handarbeit.",
  },
  "k-NN": {
    titel: "Nächster-Nachbar-Verfahren (k-NN)",
    auch: ["Nächster-Nachbar-Klassifikator", "Nächster Nachbar"],
    kurz: "Erkennen durch Vergleichen: Das ähnlichste bekannte Beispiel gibt die Antwort.",
    lang: "Es wird nichts gelernt und nichts zusammengefasst — die Beispiele selbst *sind* das Modell. Deshalb kostet das Training nichts und jede Antwort umso mehr.",
  },
  Generalisierung: {
    titel: "Generalisierung",
    kurz: "Die Fähigkeit, auch mit Fällen zurechtzukommen, die im Training nie vorkamen.",
    lang: "Das Gegenteil ist Auswendiglernen. Ein Modell, das seine Beispiele perfekt kann und bei allem Neuen versagt, hat nichts gelernt — man nennt das Überanpassung.",
  },
  "Out-of-Distribution": {
    titel: "Out-of-Distribution",
    kurz: "Eingaben, die ganz anders sind als alles im Training — dort raten Modelle besonders selbstsicher falsch.",
  },
  "Bias-Varianz-Abwägung": {
    titel: "Bias-Varianz-Abwägung",
    kurz: "Der Zielkonflikt zwischen »zu grob« und »zu genau auf die Beispiele zugeschnitten«.",
    lang: "Ein zu einfaches Modell übersieht die Struktur, ein zu komplexes lernt die Zufälligkeiten der Stichprobe mit. Beides macht Vorhersagen schlechter — irgendwo dazwischen liegt das Optimum.",
  },
  Softmax: {
    titel: "Softmax",
    kurz: "Eine Rechnung, die beliebige Zahlen in Wahrscheinlichkeiten verwandelt, die zusammen 100 % ergeben.",
  },
};

/** Alle Suchbegriffe (Haupteintrag + Schreibweisen), längste zuerst. */
const SUCHLISTE: { begriff: string; wort: string }[] = Object.entries(GLOSSAR)
  .flatMap(([begriff, eintrag]) => [begriff, ...(eintrag.auch ?? [])].map(wort => ({ begriff, wort })))
  .sort((a, b) => b.wort.length - a.wort.length);

const BUCHSTABE = /[A-Za-zÄÖÜäöüßéè]/;

export type Stueck = string | { begriff: string; wort: string };

/**
 * Zerlegt einen Text in gewöhnliche Stücke und Fachwörter.
 *
 * Gesucht wird nach ganzen Wörtern (»Token« steckt nicht in »Tokenbahnhof«),
 * längere Begriffe gewinnen gegen kürzere (»Byte-Pair Encoding« vor »Encoding«),
 * und jeder Begriff wird nur einmal je Text markiert — beim zweiten Mal weiß
 * man ja schon Bescheid.
 */
export function zerlegeMitFachworten(text: string): Stueck[] {
  const treffer: { start: number; ende: number; begriff: string; wort: string }[] = [];
  const schonDa = new Set<string>();

  for (const { begriff, wort } of SUCHLISTE) {
    if (schonDa.has(begriff)) continue;
    let ab = 0;
    while (ab <= text.length - wort.length) {
      const i = text.indexOf(wort, ab);
      if (i < 0) break;
      ab = i + 1;
      // Ganzes Wort? Links und rechts darf kein Buchstabe stehen.
      if (i > 0 && BUCHSTABE.test(text[i - 1])) continue;
      const danach = text[i + wort.length];
      if (danach && BUCHSTABE.test(danach)) continue;
      // Überlappt der Treffer einen längeren, schon gefundenen Begriff?
      if (treffer.some(t => i < t.ende && i + wort.length > t.start)) continue;
      treffer.push({ start: i, ende: i + wort.length, begriff, wort });
      schonDa.add(begriff);
      break;
    }
  }

  if (!treffer.length) return [text];
  treffer.sort((a, b) => a.start - b.start);

  const out: Stueck[] = [];
  let pos = 0;
  for (const t of treffer) {
    if (t.start > pos) out.push(text.slice(pos, t.start));
    out.push({ begriff: t.begriff, wort: t.wort });
    pos = t.ende;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}
