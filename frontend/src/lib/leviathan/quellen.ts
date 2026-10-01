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

export type Thema = "macht" | "vertrauen" | "information" | "demografie" | "sozial" | "klima" | "technik" | "spiel";

export const THEMEN: Record<Thema, string> = {
  macht: "Demokratie, Populismus und Macht",
  vertrauen: "Vertrauen, Ungleichheit und Korruption",
  information: "Informationsraum und Desinformation",
  demografie: "Bevölkerung und Geburtenrate",
  sozial: "Soziales Leben und Wohlbefinden",
  klima: "Klima und Energie",
  technik: "Technik und Arbeit",
  spiel: "Grundlagen des Spiels",
};

/** Vollständige Literaturangaben; `url` zeigt auf den Aufsatz (DOI), wo es einen gibt. */
export const ZITATE: Record<string, { thema: Thema; art: string; zitat: string; url?: string; weitere?: { titel: string; url: string }[] }> = {
  funke2016: { thema: "macht", art: "Studie", url: "https://doi.org/10.1016/j.euroecorev.2016.03.006",
    zitat: "Funke, M., Schularick, M. & Trebesch, C. (2016). Going to extremes: Politics after financial crises, 1870–2014. European Economic Review 88, 227–260." },
  funke2023: { thema: "macht", art: "Studie", url: "https://doi.org/10.1257/aer.20202045",
    zitat: "Funke, M., Schularick, M. & Trebesch, C. (2023). Populist Leaders and the Economy. American Economic Review 113(12), 3249–3288." },
  algan2017: { thema: "macht", art: "Studie", url: "https://doi.org/10.1353/eca.2017.0015",
    zitat: "Algan, Y., Guriev, S., Papaioannou, E. & Passari, E. (2017). The European Trust Crisis and the Rise of Populism. Brookings Papers on Economic Activity 2017(2), 309–400." },
  acemoglu2019: { thema: "macht", art: "Studie", url: "https://doi.org/10.1086/700936",
    zitat: "Acemoglu, D., Naidu, S., Restrepo, P. & Robinson, J. A. (2019). Democracy Does Cause Growth. Journal of Political Economy 127(1), 47–100." },
  vdem2026: { thema: "macht", art: "Bericht",
    zitat: "V-Dem Institute (2026). Democracy Report 2026: Unraveling the Democratic Era? Universität Göteborg." },
  rothstein2005: { thema: "vertrauen", art: "Studie", url: "https://doi.org/10.1353/wp.2006.0022",
    zitat: "Rothstein, B. & Uslaner, E. M. (2005). All for All: Equality, Corruption, and Social Trust. World Politics 58(1), 41–72." },
  oecd2024: { thema: "vertrauen", art: "Bericht",
    zitat: "OECD (2024). OECD Survey on Drivers of Trust in Public Institutions – 2024 Results. OECD Publishing, Paris." },
  cpi2025: { thema: "vertrauen", art: "Index",
    zitat: "Transparency International (2026). Corruption Perceptions Index 2025. Berlin." },
  vosoughi2018: { thema: "information", art: "Studie", url: "https://doi.org/10.1126/science.aap9559",
    zitat: "Vosoughi, S., Roy, D. & Aral, S. (2018). The spread of true and false news online. Science 359(6380), 1146–1151." },
  roozenbeek2022: { thema: "information", art: "Studie", url: "https://doi.org/10.1126/sciadv.abo6254",
    zitat: "Roozenbeek, J., van der Linden, S., Goldberg, B., Rathje, S. & Lewandowsky, S. (2022). Psychological inoculation improves resilience against misinformation on social media. Science Advances 8(34), eabo6254." },
  mli2023: { thema: "information", art: "Index",
    zitat: "Open Society Institute – Sofia (2023). Media Literacy Index 2023. Sofia.",
    weitere: [{ titel: "Media Literacy Index 2026", url: "https://osis.bg/?p=5747&lang=en" }] },
  wef2025: { thema: "information", art: "Bericht",
    zitat: "World Economic Forum (2025). Global Risks Report 2025, 20. Ausgabe. Genf." },
  sozialeMedien: { thema: "information", art: "Debatte", url: "https://doi.org/10.1126/science.adr1730",
    zitat: "Science (2024). Unsettled science on social media. Science 384(6703), 1389. – dazu: Odgers, C. L. (2024). The great rewiring: is social media really behind an epidemic of teenage mental illness? Nature 628, 29–30.",
    weitere: [{ titel: "Odgers 2024 in Nature", url: "https://www.nature.com/articles/d41586-024-00902-2" }] },
  wpp2024: { thema: "demografie", art: "Bericht",
    zitat: "Vereinte Nationen, DESA Population Division (2024). World Population Prospects 2024: Summary of Results. New York." },
  lancet2024: { thema: "demografie", art: "Studie", url: "https://doi.org/10.1016/S0140-6736(24)00550-6",
    zitat: "GBD 2021 Fertility and Forecasting Collaborators (2024). Global fertility in 204 countries and territories, 1950–2021, with forecasts to 2100. The Lancet 403." },
  lutz2014: { thema: "demografie", art: "Übersicht",
    zitat: "Lutz, W., Butz, W. P. & KC, S. (Hrsg.) (2014). World Population and Human Capital in the Twenty-First Century. Oxford University Press. – Überblick: IZA World of Labor, Female education and its impact on fertility." },
  who2025: { thema: "sozial", art: "Bericht",
    zitat: "WHO Commission on Social Connection (2025). From loneliness to social connection: charting a path to healthier societies. Genf." },
  whr2025: { thema: "sozial", art: "Bericht",
    zitat: "Helliwell, J. F., Layard, R., Sachs, J. D. u. a. (Hrsg.) (2025). World Happiness Report 2025: Caring and Sharing. Wellbeing Research Centre, Universität Oxford.",
    weitere: [{ titel: "Gesamter Bericht", url: "https://www.worldhappiness.report/ed/2025/" }] },
  lancetCountdown2025: { thema: "klima", art: "Bericht", url: "https://doi.org/10.1016/S0140-6736(25)01919-1",
    zitat: "Romanello, M. u. a. (2025). The 2025 report of the Lancet Countdown on health and climate change. The Lancet." },
  armstrongMcKay2022: { thema: "klima", art: "Studie", url: "https://doi.org/10.1126/science.abn7950",
    zitat: "Armstrong McKay, D. I. u. a. (2022). Exceeding 1.5 °C global warming could trigger multiple climate tipping points. Science 377(6611), eabn7950." },
  way2022: { thema: "klima", art: "Studie", url: "https://doi.org/10.1016/j.joule.2022.08.009",
    zitat: "Way, R., Ives, M. C., Mealy, P. & Farmer, J. D. (2022). Empirically grounded technology forecasts and the energy transition. Joule 6(9), 2057–2082." },
  imf2024: { thema: "technik", art: "Bericht",
    zitat: "Cazzaniga, M. u. a. (2024). Gen-AI: Artificial Intelligence and the Future of Work. IMF Staff Discussion Note SDN/2024/001. Internationaler Währungsfonds." },
  korridor: { thema: "spiel", art: "Buch",
    zitat: "Acemoglu, D. & Robinson, J. A. (2019). The Narrow Corridor: States, Societies, and the Fate of Liberty. Penguin Press. (Deutsch: Gleichgewicht der Macht, S. Fischer 2019.)" },
  annahme: { thema: "spiel", art: "Annahme",
    zitat: "Vereinfachte Grundannahme des Spiels ohne eigene Einzelstudie." },
};

/** Hintergrund, der keine einzelne Regel trägt – oder bewusst nicht verwendet wird. */
export const HINTERGRUND: { titel: string; zitat: string; url?: string; hinweis: string }[] = [
  { titel: "Vorbild für die Spielidee", hinweis: "Nur die Idee des vernetzten Regierens; Regeln, Zahlen, Texte und Grafiken sind eigene.",
    zitat: "Vester, F. (1980/1984). Ökolopoly – ein kybernetisches Umweltspiel. Rechte heute bei Malik Management St. Gallen (als ecopolicy®).",
    url: "https://de.wikipedia.org/wiki/%C3%96kolopoly" },
  { titel: "Namensgeber", hinweis: "Das Bild vom Staat als »Leviathan«.",
    zitat: "Hobbes, T. (1651). Leviathan, or The Matter, Forme and Power of a Common-Wealth Ecclesiasticall and Civil. London. (gemeinfrei)",
    url: "https://www.gutenberg.org/ebooks/3207" },
  { titel: "Bewusst nicht verwendet", hinweis: "Die Studie zu Klimaschäden (−19 % Einkommen bis 2049) wurde im Dezember 2025 zurückgezogen. Klimaschäden gehen deshalb nur qualitativ ein.",
    zitat: "Kotz, M., Levermann, A. & Wenz, L. (2024). The economic commitment of climate change. Nature 628, 551–557. – zurückgezogen (Retraction Note, Nature 2025).",
    url: "https://doi.org/10.1038/s41586-025-09726-0" },
];
