/**
 * »Mehr dazu« — der Lesestoff zu jeder Station, in drei Stufen.
 *
 * Gedacht für die, die mehr wissen wollen, als die Station zeigt: neben jedem
 * Schritt steht ein Kasten, den man aufklappen kann. Wer nur spielen will,
 * merkt nichts davon.
 *
 * Die drei Stufen sind kein Niveau-Urteil, sondern eine Lesehilfe:
 *
 *   »5-7«  Kurze Sätze, jedes Fachwort hat ein Bild daneben. Wer die Stufe
 *          liest, soll die Sache *sehen* können, ohne einen Begriff zu lernen.
 *   »8+«   Der Fachbegriff wird genannt und erklärt. Das ist die Stufe, die im
 *          Unterricht meistens passt.
 *   »10+«  Nennt die Dinge beim Namen (Perplexität, Backoff, Gradient) und sagt
 *          dazu, was heutige Modelle anders machen als unser Spielzeug.
 *
 * Beim Schreiben gilt: lieber ein gutes Bild als drei richtige Begriffe. Und
 * jede Stufe muss für sich allein stehen — niemand liest erst die untere.
 */

export type Lesestufe = "5-7" | "8+" | "10+";

export const LESESTUFEN: { id: Lesestufe; label: string; titel: string }[] = [
  { id: "5-7", label: "Klasse 5–7", titel: "Kurz und mit Bildern" },
  { id: "8+", label: "Klasse 8+", titel: "Mit den richtigen Begriffen" },
  { id: "10+", label: "Klasse 10+", titel: "Genauer, mit Fachwörtern" },
];

export type Wissenstext = {
  titel: string;
  stufen: Record<Lesestufe, string[]>;
};

export const WISSEN: Record<string, Wissenstext> = {
  auftrag: {
    titel: "Was passiert mit deinem Auftrag?",
    stufen: {
      "5-7": [
        "Du schreibst einen Satz. Für dich ist das ein Auftrag — für die Maschine ist es nur eine Reihe von Zeichen.",
        "Sie versteht ihn nicht so, wie deine Lehrerin ihn versteht. Sie rechnet damit. Was jetzt kommt, ist eine lange Rechnung, die am Ende wie eine Antwort aussieht.",
      ],
      "8+": [
        "Der Auftrag heißt bei KI-Programmen »Prompt«. Er ist der einzige Hebel, den du hast: alles, was das Modell tut, hängt an diesen paar Wörtern.",
        "Wichtig ist der Unterschied zwischen *verstehen* und *verarbeiten*. Das Modell verarbeitet den Prompt: es macht Zahlen daraus und rechnet weiter. Ein Verständnis von Katzen, Texten oder Aufgaben steckt nirgendwo darin.",
      ],
      "10+": [
        "Der Prompt ist die Bedingung, unter der das Modell die Wahrscheinlichkeit des nächsten Wortes berechnet. Formal: P(nächstes Wort | alles bisher). Alles, was »Prompt Engineering« heißt, ist der Versuch, diese Bedingung geschickt zu wählen.",
        "Daraus folgt auch die Grenze: Ein Modell kann nicht wissen, was du meinst, sondern nur, welche Fortsetzung zu solchen Wörtern häufig passt. Zwei Prompts mit gleicher Bedeutung, aber anderen Wörtern, führen deshalb zu verschiedenen Antworten.",
      ],
    },
  },

  zerlegen: {
    titel: "Warum zerschneidet die Maschine die Wörter?",
    stufen: {
      "5-7": [
        "Die Maschine kennt keine Buchstaben. Sie hat eine lange Liste von Wortstücken, und jedes Stück hat eine Nummer.",
        "Häufige Wörter stehen ganz in der Liste. Seltene Wörter muss sie zusammensetzen, so wie du ein langes Wort in Silben sprichst.",
        "Das ist praktisch: Mit ein paar tausend Stücken kann sie jedes Wort bauen — auch eines, das sie noch nie gesehen hat.",
      ],
      "8+": [
        "Die Stücke heißen »Token«, das Zerschneiden heißt Tokenisierung. Die Liste ist nicht ausgedacht, sondern aus riesigen Textmengen gelernt: Was oft zusammen vorkommt, wird ein eigenes Token.",
        "Deshalb ist »Katze« ein Stück, »Kätzchen« aber zwei oder drei. Und deshalb gehört das Leerzeichen zum Wort dahinter: » Katze« am Satzanfang ist für das Modell etwas anderes als »Katze«.",
        "Ab hier gibt es keine Wörter mehr, nur noch Nummern. Alles Weitere ist Rechnen mit diesen Nummern.",
      ],
      "10+": [
        "Das übliche Verfahren heißt Byte-Pair Encoding: Man beginnt mit einzelnen Zeichen und verschmilzt wieder und wieder das häufigste Paar zu einem neuen Token, bis die gewünschte Wortschatzgröße erreicht ist (typisch 50 000 bis 200 000).",
        "Das erklärt drei Beobachtungen: Deutsch braucht mehr Token als Englisch (weniger Trainingstext, lange Komposita), Zahlen zerfallen oft in einzelne Ziffern (weshalb Modelle beim Rechnen stolpern), und Tippfehler machen aus einem Token plötzlich vier.",
        "Wer für eine API bezahlt, bezahlt pro Token — nicht pro Wort. Ein deutscher Text kostet deshalb bei gleicher Länge mehr als ein englischer.",
      ],
    },
  },

  netz: {
    titel: "Was ist dieses Netz eigentlich?",
    stufen: {
      "5-7": [
        "Stell dir eine Wiese vor, über die viele Leute laufen. Wo viele gehen, entsteht ein breiter Trampelpfad. Wo selten jemand geht, bleibt ein schmaler.",
        "Genau so ist das Netz: Der dicke Faden ist der breite Pfad — dieses Wort kam nach dem anderen sehr oft.",
        "Die Maschine sucht sich also einfach einen Weg über die Wiese. Sie überlegt nicht, wohin sie will.",
      ],
      "8+": [
        "Jeder Faden trägt eine Wahrscheinlichkeit: Wie oft folgt dieses Wort auf jenes? Alle Fäden, die von einem Wort ausgehen, ergeben zusammen 100 %.",
        "Unser Netz schaut dabei nur auf das letzte Wort. So ein Modell heißt Bigramm-Modell — »bi« für zwei, weil immer zwei Wörter zusammen betrachtet werden.",
        "Das ist auch seine Schwäche: Es hat schon vergessen, worüber der Satz ging, sobald zwei Wörter vorbei sind. Ein Satz kann deshalb Wort für Wort richtig und als Ganzes Unsinn sein.",
      ],
      "10+": [
        "Formal ist das eine Markow-Kette: Der nächste Zustand hängt nur vom aktuellen ab, nicht von der Vorgeschichte. Genau diese Annahme macht das Modell klein und rechenbar — und begrenzt es zugleich.",
        "Echte Sprachmodelle geben die Markow-Annahme auf. Sie bekommen den ganzen bisherigen Text und bestimmen mit »Attention« selbst, welche früheren Wörter jetzt wichtig sind. Deshalb können sie einen Faden über Absätze halten.",
        "Was gleich bleibt: Am Ende steht immer eine Wahrscheinlichkeitsverteilung über den nächsten Token. Der Unterschied liegt darin, wie diese Verteilung berechnet wird — Zählen hier, Milliarden Gewichte dort.",
      ],
    },
  },

  auswahl: {
    titel: "Warum kommt nicht immer dasselbe heraus?",
    stufen: {
      "5-7": [
        "Die Maschine nimmt nicht immer das wahrscheinlichste Wort. Sie würfelt — aber mit gezinkten Würfeln: Das dicke Wort kommt öfter, das dünne seltener.",
        "Mit dem Regler stellst du ein, wie viele Wörter überhaupt in den Würfelbecher dürfen. Ganz links liegt nur eines darin. Dann schreibt die ganze Klasse denselben Text.",
        "Je mehr im Becher liegen, desto überraschender wird der Text — und desto öfter auch komisch.",
      ],
      "8+": [
        "Der Regler heißt in der Fachsprache »top-k«: Es werden nur die k wahrscheinlichsten Wörter zur Auswahl gestellt, aus denen dann gewürfelt wird.",
        "Es gibt einen zweiten, ähnlichen Regler, den du in vielen KI-Werkzeugen findest: die »Temperatur«. Sie schneidet nichts weg, sondern macht die Unterschiede größer oder kleiner — bei niedriger Temperatur wird das Wahrscheinlichste noch wahrscheinlicher, bei hoher rücken alle näher zusammen.",
        "Beides steuert dasselbe Spannungsfeld: zuverlässig und langweilig auf der einen Seite, überraschend und riskant auf der anderen.",
      ],
      "10+": [
        "Reines Greedy-Decoding (immer das Maximum) ist deterministisch und läuft leicht in Wiederholungsschleifen. Deshalb nutzt man Sampling-Verfahren: top-k schneidet nach Rang ab, top-p (nucleus) nach kumulierter Wahrscheinlichkeit, Temperatur skaliert die Logits vor dem Softmax.",
        "Temperatur T teilt die Logits: T < 1 spitzt die Verteilung zu, T > 1 flacht sie ab, T → 0 ist wieder Greedy. Die drei Regler werden in der Praxis kombiniert.",
        "Dass eine KI bei derselben Frage zweimal Verschiedenes antwortet, ist also kein Fehler, sondern eine Einstellung. Wer Reproduzierbarkeit braucht, setzt Temperatur 0 oder einen festen Seed.",
      ],
    },
  },

  ergebnis: {
    titel: "Was sagt die Erwartbarkeit aus?",
    stufen: {
      "5-7": [
        "Die Erwartbarkeit sagt, wie sehr dein Text der Maschine ähnelt. Hoch heißt: Genau so hätte sie ihn auch geschrieben.",
        "Oben auf der Tafel stehen deshalb die brävsten Texte, unten die eigenwilligen. Lies beide einmal laut vor — der Unterschied ist zu hören.",
        "Und dabei merkst du etwas Wichtiges: Der erwartbare Text ist nicht der beste. Er ist nur der, den niemand überraschend findet.",
      ],
      "8+": [
        "Gerechnet wird der Durchschnitt aller Wahrscheinlichkeiten, mit denen deine Wörter angeboten wurden — genauer das geometrische Mittel, damit lange Texte nicht benachteiligt werden.",
        "Diese Zahl ist die Kehrseite eines Maßes, das in der KI-Forschung ständig benutzt wird: der Perplexität. Je besser ein Modell den nächsten Schritt vorhersagt, desto niedriger seine Perplexität — daran wird gemessen, ob ein Modell gut ist.",
        "Genau deshalb klingen KI-Texte oft glatt und ein bisschen fad: Das Modell ist darauf trainiert, das Erwartbare zu treffen.",
      ],
      "10+": [
        "Perplexität ist 2 hoch der mittleren Entropie pro Wort, also der Kehrwert unseres geometrischen Mittels. Sie beantwortet: Zwischen wie vielen gleich wahrscheinlichen Möglichkeiten schwankt das Modell an jeder Stelle im Schnitt?",
        "Das verbindet Sprachmodelle mit Informationstheorie und mit Kompression: Ein Modell, das gut vorhersagt, kann Text stark komprimieren — Vorhersage und Kompression sind mathematisch dasselbe Problem.",
        "Vorsicht bei der Deutung: Niedrige Perplexität heißt gut vorhergesagt, nicht wahr, nicht gut geschrieben und schon gar nicht klug. Ein Modell kann sehr sicher etwas Falsches behaupten.",
      ],
    },
  },

  trainieren: {
    titel: "Woher kommen die Zahlen?",
    stufen: {
      "5-7": [
        "Niemand hat die Zahlen eingetippt. Man liest einen Text und zählt mit: Welches Wort kommt nach welchem?",
        "Wenn nach »die« achtmal »Katze« stand und zweimal »Maus«, dann ist der Faden zu »Katze« viermal so dick. Das ist alles.",
        "Deshalb kann das Netz auch nur nachsagen, was im Text stand. Gib ihm ein Märchen, klingt es wie ein Märchen. Gib ihm einen Spielbericht, klingt es wie Fußball.",
      ],
      "8+": [
        "Das nennt man Training: Aus Daten werden die Zahlen des Modells. Bei unserem Netz ist Training wirklich nur Zählen und Teilen — das ist keine Vereinfachung, sondern genau das Verfahren.",
        "Zwei Dinge siehst du sofort. Erstens: Mit wenig Text wird das Modell zum Papagei, weil es zu jedem Wort nur eine Fortsetzung kennt. Zweitens: Es übernimmt jede Eigenheit des Textes, ohne sie zu prüfen — auch Fehler und Einseitigkeiten.",
        "Das ist der Kern der Debatte über Trainingsdaten: Ein Modell kann nicht besser oder gerechter sein als der Text, aus dem es gezählt wurde.",
      ],
      "10+": [
        "Was hier zählt, heißt Maximum-Likelihood-Schätzung: Die relative Häufigkeit ist genau der Parameterwert, der die Trainingsdaten am wahrscheinlichsten macht. Unser Netz ist also ein vollwertig trainiertes Modell — nur mit sehr wenigen Parametern.",
        "Große Modelle zählen nicht, sie passen Milliarden Gewichte per Gradientenabstieg an. Das Ziel ist dasselbe (Vorhersage des nächsten Tokens), aber sie können generalisieren: Ein Zählmodell kennt eine ungesehene Wortfolge gar nicht, ein neuronales schätzt sie aus Ähnlichkeiten.",
        "Auch das Auswendiglernen ist ein echtes Forschungsthema: Große Modelle geben seltene Trainingsbeispiele wörtlich wieder — mit den bekannten Folgen für Urheberrecht und Datenschutz. Hier kannst du das im Kleinen provozieren.",
      ],
    },
  },

  rueckblick: {
    titel: "Warum hilft mehr Rückblick — und wann schadet er?",
    stufen: {
      "5-7": [
        "Stell den Regler auf 1: Die Maschine schaut gar nicht zurück und würfelt einfach Wörter. Das ist Wortsalat.",
        "Auf 2 schaut sie ein Wort zurück. Jetzt passen die Wörter zusammen — aber der Satz kann trotzdem in die Irre laufen.",
        "Auf 3 schaut sie zwei Wörter zurück. Das klingt fast zu gut: Sie sagt jetzt oft einfach den Text auf, den sie gelesen hat.",
      ],
      "8+": [
        "Man nennt das Unigramm, Bigramm und Trigramm — je nachdem, wie viele Wörter zusammen betrachtet werden. Mehr Kontext heißt bessere Vorhersage.",
        "Aber es gibt einen Haken: Je länger der Rückblick, desto seltener kommt jede einzelne Kombination im Text vor. Mit 200 Wörtern Text gibt es zu den meisten Dreiergruppen genau *eine* Fortsetzung — das Modell hat keine Wahl mehr und plappert den Text nach.",
        "Dieses Problem heißt Datenknappheit. Die Lösung großer Modelle ist nicht »noch mehr zurückschauen«, sondern klüger zurückschauen: Sie lernen, welche früheren Wörter wichtig sind und welche nicht.",
      ],
      "10+": [
        "Der Zielkonflikt heißt Bias-Varianz-Abwägung: Kurzer Kontext unterschätzt die Struktur der Sprache, langer Kontext überpasst die Stichprobe. Der Parameterraum wächst exponentiell mit n, die Daten aber nicht.",
        "Klassische Gegenmittel sind Glättung (Laplace, Kneser-Ney) und Backoff — genau das macht unser Netz: Fehlt eine Dreierkombination, fällt es auf die Zweierkombination zurück und sagt das auch an.",
        "Transformer lösen dasselbe Problem anders: Attention gewichtet beliebig weit zurückliegende Token, und weil die Repräsentationen kontinuierlich sind, lässt sich von ähnlichen Kontexten auf ungesehene schließen. Das ist der eigentliche Sprung gegenüber n-Gramm-Modellen.",
      ],
    },
  },

  verrauschen: {
    titel: "Warum macht man ein Bild erst kaputt?",
    stufen: {
      "5-7": [
        "Ein Bildmodell lernt genau eine Sache: Rauschen wieder wegnehmen.",
        "Zum Üben braucht es Paare — ein sauberes Bild und dasselbe Bild mit Rauschen. Die bekommt man geschenkt: Man nimmt ein Foto und schüttet selbst Rauschen darüber. Millionen Übungsaufgaben, ohne dass jemand etwas erklären muss.",
        "Und weil man dabei genau weiß, wie viel Rauschen man dazugetan hat, weiß man auch immer die richtige Antwort.",
      ],
      "8+": [
        "Der Hinweg heißt Vorwärtsprozess und ist reine Rechnung: x_t = √ᾱ·x₀ + √(1−ᾱ)·ε. Das Bild wird leiser gedreht, das Rauschen lauter — nach einem festen Fahrplan.",
        "Der Trick daran ist das Erzeugen von Trainingsdaten: Zu jedem verrauschten Bild ist das hinzugefügte Rauschen bekannt. Das Modell wird darauf trainiert, genau dieses Rauschen vorherzusagen; die Abweichung ist sein Fehler.",
        "Der Fahrplan ist mit Absicht ungleichmäßig: Am Anfang wird wenig zerstört (feine Details), am Ende viel (grobe Struktur). Beim Erzeugen läuft es andersherum — erst grobe Flächen, dann Details.",
      ],
      "10+": [
        "Formal ist der Vorwärtsprozess eine Markow-Kette, die die Datenverteilung in eine Standardnormalverteilung überführt. Weil sich die Schritte zusammenfassen lassen, kommt man in einem Sprung zu jedem beliebigen t — das macht das Training überhaupt bezahlbar.",
        "Trainiert wird auf einen einfachen Fehler: Vorhersage des Rauschens ε mit quadratischer Abweichung. Dass daraus ein Bildgenerator wird, liegt an einem Zusammenhang aus der Statistik — das vorhergesagte Rauschen ist bis auf einen Faktor die Richtung, in der die Wahrscheinlichkeitsdichte wächst (der Score).",
        "Stable Diffusion & Co. tun das nicht auf Pixeln, sondern in einem komprimierten Raum (Latent Diffusion): Ein Autoencoder verkleinert das Bild um etwa den Faktor acht je Kante, was den Rechenaufwand drastisch senkt.",
      ],
    },
  },

  entrauschen: {
    titel: "Wie wird aus Rauschen ein Bild?",
    stufen: {
      "5-7": [
        "Das Modell malt kein Bild. Es schubst jeden Punkt immer wieder ein kleines Stück dorthin, wo es wahrscheinlicher wird — dreißigmal hintereinander.",
        "Am Anfang sieht man gar nichts. Dann tauchen grobe Flächen auf, dann Formen, ganz zum Schluss die feinen Sachen.",
        "Der Seed ist der Würfel am Anfang. Mit demselben Seed kommt immer genau dasselbe Bild heraus — jedes Mal wieder.",
      ],
      "8+": [
        "In jedem Schritt schätzt das Modell: Welcher Teil von dem, was ich sehe, ist Rauschen? Dann zieht es einen Teil davon ab und würfelt ein bisschen neues dazu. Nach vielen Schritten ist vom Rauschen nichts mehr übrig.",
        "Die Punktwolke hier rechnet das wirklich aus, weil das Ziel bekannt ist — vier Formen statt aller Bilder der Welt. Deshalb braucht sie kein Training und läuft auf jedem Telefon.",
        "Der Regler »Prompt-Stärke« heißt bei Bildgeneratoren Guidance: Er bestimmt, wie streng sich das Modell an den Wunsch hält. Zu niedrig kommt irgendetwas heraus, zu hoch wird es überzeichnet — der beste Bereich liegt in der Mitte.",
      ],
      "10+": [
        "Der Rückweg ist ein gelerntes Umkehren der Kette: x_{t−1} = 1/√α·(x_t + (1−α)·∇log q(x_t)) + √β·z. Für eine bekannte Verteilung — wie unsere Punktwolke — lässt sich der Score exakt angeben, für Bilder muss ihn ein Netz schätzen.",
        "Classifier-Free Guidance interpoliert zwischen bedingtem und unbedingtem Score: s = s_uncond + w·(s_cond − s_uncond). Für w > 1 wird über den bedingten Score hinaus extrapoliert — das schärft die Übereinstimmung mit dem Prompt und erkauft sie mit Vielfalt und Artefakten.",
        "Genau diesen Bogen kannst du hier messen: Die Trefferquote steigt bis ungefähr w = 4 und fällt danach wieder. Deshalb steht die Guidance in echten Werkzeugen selten über 10.",
      ],
    },
  },

  attention: {
    titel: "Wie schafft ein Modell das, was unser Netz nicht kann?",
    stufen: {
      "5-7": [
        "Unser Wortnetz hat ein sehr kurzes Gedächtnis. Wenn »er« an der Reihe ist, weiß es nicht mehr, dass vorne im Satz ein Pokal stand.",
        "Große Sprachmodelle machen es anders: Bei jedem Wort schauen sie auf den ganzen Satz zurück und suchen sich aus, welche Wörter gerade wichtig sind. Das nennt man Aufmerksamkeit.",
        "Das ist wie beim Lesen: Du liest auch nicht nur das letzte Wort, sondern weißt noch, worum es ging.",
      ],
      "8+": [
        "Der Fachbegriff ist »Attention«. Für jedes Wort berechnet das Modell, wie stark es auf jedes frühere Wort achten soll — daraus entsteht ein Bild aus Bögen, wie du es hier siehst.",
        "Das Entscheidende: Diese Gewichte sind nicht fest, sondern hängen vom Satz ab. Bei »weil er zu groß ist« zeigt der dicke Bogen auf den Pokal, bei »zu klein« auf den Koffer — obwohl beide Sätze fast gleich sind.",
        "Deshalb heißt die wichtigste Bauform heutiger KI »Transformer«: Sie besteht im Kern aus vielen solchen Aufmerksamkeitsschichten übereinander.",
      ],
      "10+": [
        "Jedes Token wird auf drei Vektoren abgebildet: Query, Key und Value. Die Aufmerksamkeit eines Tokens auf ein anderes ist das Skalarprodukt aus seiner Query und dessen Key, normiert über Softmax; die Ausgabe ist die gewichtete Summe der Values.",
        "Ein Modell hat viele solcher »Köpfe« nebeneinander und Dutzende Schichten übereinander. Untersuchungen zeigen, dass sich einzelne Köpfe auf erkennbare Aufgaben spezialisieren — Bezüge von Pronomen, Satzgrenzen, Zahlwörter.",
        "Der Preis ist Rechenzeit: Aufmerksamkeit von jedem auf jeden wächst quadratisch mit der Textlänge. Deshalb ist das Kontextfenster begrenzt, und deshalb ist es ein eigenes Forschungsfeld, es zu vergrößern.",
      ],
    },
  },

  korpus: {
    titel: "Euer eigenes Modell",
    stufen: {
      "5-7": [
        "Jetzt schreibt ihr selbst den Text, aus dem gezählt wird. Jede und jeder gibt einen Satz ab.",
        "Danach spricht das Netz wie eure Klasse. Wenn viele über dasselbe schreiben, wird es darin sicher — und über alles andere weiß es nichts.",
        "Achte darauf, was mit einem Satz passiert, den nur eine Person geschrieben hat. Du wirst ihn fast wörtlich wiedersehen.",
      ],
      "8+": [
        "Was ihr hier zusammentragt, heißt Korpus: die Sammlung von Texten, aus der ein Modell lernt. Die Auswahl des Korpus ist eine der wichtigsten Entscheidungen beim Bau einer KI — und sie wird von Menschen getroffen.",
        "Mit 25 Sätzen seht ihr in klein, was bei großen Modellen in groß passiert: Was oft vorkommt, wird zur Normalität des Modells. Was fehlt, existiert für das Modell nicht.",
        "Probiert es aus: Schreibt alle über ein einziges Thema, und fragt das Netz danach etwas anderes. Es wird trotzdem über euer Thema reden.",
      ],
      "10+": [
        "Damit ist die Datenfrage konkret statt abstrakt: Wer den Korpus bestimmt, bestimmt das Modell. Bei großen Modellen entscheidet das eine Handvoll Firmen — welche Sprachen, welche Quellen, welche Stimmen enthalten sind und welche nicht.",
        "Eure Sammlung zeigt auch, warum das Filtern so heikel ist. Nehmt einen Satz heraus und zählt neu: Das Modell verändert sich sofort. Bei Web-Korpora treffen solche Filter Milliarden Texte, ohne dass jemand sie einzeln liest.",
        "Und noch etwas lässt sich hier prüfen: Zählt, wie oft ein seltener Satz wörtlich wieder auftaucht. Genau mit solchen Experimenten weist man großen Modellen nach, dass sie Trainingsdaten memoriert haben.",
      ],
    },
  },
};
