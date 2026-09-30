/**
 * Die Belege hinter den Spielregeln. Jede Regel und jedes Ereignis nennt einen
 * dieser Schlüssel; der »Warum?«-Knopf zeigt Befund und Link.
 * Ausführlich: docs/leviathan-recherche.md
 */
export interface Quelle {
  kurz: string;
  befund: string;
  url: string;
  /** Die Forschung ist sich hier nicht einig. */
  umstritten?: boolean;
}

export const QUELLEN: Record<string, Quelle> = {
  funke2016: {
    kurz: "Funke, Schularick & Trebesch 2016",
    befund: "Nach Finanzkrisen steigt der Stimmanteil der extremen Rechten im Schnitt um etwa 30 % – nach gewöhnlichen Rezessionen nicht.",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0014292116300587",
  },
  funke2023: {
    kurz: "Funke, Schularick & Trebesch 2023",
    befund: "15 Jahre nach dem Amtsantritt populistischer Regierungschefs liegt das BIP pro Kopf etwa 10 % unter der Vergleichsentwicklung.",
    url: "https://www.aeaweb.org/articles?id=10.1257%2Faer.20202045",
  },
  algan2017: {
    kurz: "Algan, Guriev, Papaioannou & Passari 2017",
    befund: "Steigende Arbeitslosigkeit senkt das Vertrauen in Regierung und Parlament und bringt Stimmen für Anti-Establishment-Parteien.",
    url: "https://www.brookings.edu/wp-content/uploads/2018/02/algantextfa17bpea.pdf",
  },
  acemoglu2019: {
    kurz: "Acemoglu, Naidu, Restrepo & Robinson 2019",
    befund: "Wird ein Land demokratisch, liegt sein BIP pro Kopf nach etwa 25 Jahren rund 20 % höher.",
    url: "https://www.nber.org/papers/w20004",
  },
  korridor: {
    kurz: "Acemoglu & Robinson 2019 (The Narrow Corridor)",
    befund: "Freiheit entsteht nur, wenn Staat und Gesellschaft gleich stark sind und sich gegenseitig in Schach halten – ein schmaler Korridor zwischen despotischem und abwesendem Staat.",
    url: "https://en.wikipedia.org/wiki/The_Narrow_Corridor",
  },
  vdem2026: {
    kurz: "V-Dem Democracy Report 2026",
    befund: "74 % der Menschen leben in Autokratien. Meinungs- und Pressefreiheit werden bei der Autokratisierung zuerst abgebaut.",
    url: "https://www.v-dem.net/documents/75/V-Dem_Institute_Democracy_Report_2026_lowres.pdf",
  },
  rothstein2005: {
    kurz: "Rothstein & Uslaner 2005",
    befund: "Wo die Ungleichheit hoch ist, ist das Vertrauen niedrig – und Korruption, Ungleichheit und Misstrauen verstärken sich gegenseitig. Allgemeine Sozialleistungen stärken Vertrauen.",
    url: "http://www.gvptsites.umd.edu/uslaner/rothsteinuslanerworldpolitics.pdf",
  },
  oecd2024: {
    kurz: "OECD Trust Survey 2024",
    befund: "44 % haben wenig oder kein Vertrauen in ihre Regierung, nur 39 % hohes oder mittleres.",
    url: "https://www.oecd.org/en/publications/oecd-survey-on-drivers-of-trust-in-public-institutions-2024-results_9a20554b-en.html",
  },
  cpi2025: {
    kurz: "Transparency International, CPI 2025",
    befund: "Der weltweite Durchschnitt liegt bei 42 von 100 Punkten; 122 von 182 Ländern liegen unter 50.",
    url: "https://www.transparency.org/en/cpi/2025",
  },
  vosoughi2018: {
    kurz: "Vosoughi, Roy & Aral 2018",
    befund: "Falschmeldungen werden 70 % häufiger geteilt als wahre und verbreiten sich schneller – getrieben von Menschen, nicht von Bots.",
    url: "https://www.science.org/doi/10.1126/science.aap9559",
  },
  roozenbeek2022: {
    kurz: "Roozenbeek, van der Linden u. a. 2022",
    befund: "Kurze Videos über Manipulationstricks (Prebunking) helfen, Falschmeldungen zu erkennen – auch im großen Feldversuch auf YouTube.",
    url: "https://www.science.org/doi/10.1126/sciadv.abo6254",
  },
  mli2023: {
    kurz: "Media Literacy Index (OSI Sofia) 2023",
    befund: "Am widerstandsfähigsten gegen Desinformation sind Länder mit guter Bildung, freier Presse und hohem Vertrauen (Finnland, Dänemark, Norwegen).",
    url: "https://osis.bg/?p=4450&lang=en",
  },
  wef2025: {
    kurz: "WEF Global Risks Report 2025",
    befund: "Fehl- und Desinformation gelten als größtes kurzfristiges Risiko – KI macht Fälschungen billig.",
    url: "https://www.weforum.org/publications/global-risks-report-2025/",
  },
  sozialeMedien: {
    kurz: "Haidt vs. Odgers; Nature 2024; Science 2024",
    befund: "Ob soziale Medien die psychischen Probleme Jugendlicher verursachen, ist nicht geklärt: Viele Befunde sind nur Zusammenhänge, die Wirkrichtung ist teils umgekehrt.",
    url: "https://www.nature.com/articles/d41586-024-00902-2",
    umstritten: true,
  },
  wpp2024: {
    kurz: "UN World Population Prospects 2024",
    befund: "Die Weltbevölkerung erreicht Mitte der 2080er etwa 10,3 Mrd. In Europa sind schon über 20 % älter als 65.",
    url: "https://population.un.org/wpp/",
  },
  lancet2024: {
    kurz: "GBD Fertility Collaborators 2024 (Lancet)",
    befund: "Bis 2100 liegen nur noch 6 von 204 Ländern über 2,1 Kindern je Frau – fast alle Länder schrumpfen ohne Zuwanderung.",
    url: "https://www.thelancet.com/journals/lancet/article/PIIS0140-6736(24)00550-6/fulltext",
  },
  lutz2014: {
    kurz: "Lutz 2014; IZA World of Labor",
    befund: "Bildung von Frauen ist der wichtigste Grund für sinkende Geburtenraten – grob 0,26 Kinder weniger je zusätzlichem Schuljahr.",
    url: "https://wol.iza.org/articles/female-education-and-its-impact-on-fertility/long",
  },
  who2025: {
    kurz: "WHO-Kommission für soziale Verbundenheit 2025",
    befund: "Jeder sechste Mensch ist einsam; Einsamkeit hängt mit etwa 871 000 Todesfällen im Jahr zusammen.",
    url: "https://who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death",
  },
  whr2025: {
    kurz: "World Happiness Report 2025",
    befund: "Gemeinsame Mahlzeiten und Vertrauen in die Freundlichkeit anderer sagen Wohlbefinden stark voraus – stärker als oft angenommen.",
    url: "https://www.worldhappiness.report/ed/2025/sharing-meals-with-others-how-sharing-meals-supports-happiness-and-social-connections/",
  },
  lancetCountdown2025: {
    kurz: "Lancet Countdown 2025",
    befund: "Hitze tötet etwa 546 000 Menschen im Jahr – 23 % mehr als in den 1990ern. Alte Menschen und Säuglinge trifft es am stärksten.",
    url: "https://lancetcountdown.org/2025-report/",
  },
  armstrongMcKay2022: {
    kurz: "Armstrong McKay u. a. 2022 (Science)",
    befund: "Schon bei heutiger Erwärmung können fünf Kipppunkte überschritten werden; jedes Zehntelgrad erhöht das Risiko. Überschritten heißt: nicht mehr umkehrbar.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36074831/",
  },
  way2022: {
    kurz: "Way, Ives, Mealy & Farmer 2022 (Joule)",
    befund: "Solar, Wind und Batterien werden mit jeder gebauten Anlage billiger (Lernkurve). Eine schnelle Energiewende ist wahrscheinlich billiger als fossiles Weitermachen.",
    url: "https://www.cell.com/joule/fulltext/S2542-4351(22)00410-X",
  },
  imf2024: {
    kurz: "IWF 2024: Gen-AI and the Future of Work",
    befund: "Rund 40 % der Jobs weltweit, 60 % in Industrieländern, sind von KI betroffen. Ohne Gegensteuern kann die Ungleichheit steigen.",
    url: "https://www.imf.org/-/media/files/publications/sdn/2024/english/sdnea2024001.pdf",
  },
  annahme: {
    kurz: "Spielannahme",
    befund: "Diese Regel ist eine vereinfachte Grundannahme des Spiels ohne eigene Einzelstudie.",
    url: "",
  },
};
