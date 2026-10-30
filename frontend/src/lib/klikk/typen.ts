/**
 * Klikk — eine Schulwoche in einer Social-Media-App. Alle Typen des Spielstands.
 *
 * Der Stand ist reines JSON (localStorage), Zeiten sind Spielminuten des Tages.
 * Was die App »heimlich« mitschreibt, steht in `spur` und `verweil` — erst der
 * Datenspiegel am Ende zeigt es.
 */

export type Thema =
  | "fitness" | "beauty" | "gaming" | "tiere" | "musik" | "mode" | "essen" | "comedy" | "news" | "wissen" | "trend";

export type AppId = "klikk" | "chats" | "wetter" | "candy" | "sneakr" | "quiz" | "spiele";

export type Recht = "kontakte" | "standort" | "mikrofon" | "mitteilungen";

export type ChatId = "klasse" | "lea" | "mo" | "jonas" | "mama" | "yilmaz" | "klikkteam" | "gewinn" | "leon" | "verein" | "emma";

export type Phase = "start" | "onboarding" | "woche" | "nacht" | "jonas" | "spiegel";

export interface Wahl {
  id: string;
  optionen: { id: string; text: string }[];
  /** gewählte Option, »still« = ungewählt verfallen */
  gewaehlt?: string;
}

export interface Nachricht {
  id: string;
  von: string;
  text: string;
  tag: number;
  uhr: number;
  /** ein Bild als Beschreibung (Emoji + Text) */
  bild?: string;
  wahl?: Wahl;
  /** Systemzeile (»Jonas hat die Gruppe verlassen«) */
  system?: boolean;
}

export interface Push {
  id: string;
  app: AppId;
  chat?: ChatId;
  titel: string;
  text: string;
  tag: number;
  uhr: number;
}

/** Eine Zeile im heimlichen Protokoll — der »Beleg« für eine Erkenntnis im Datenspiegel. */
export interface Spur {
  tag: number;
  uhr: number;
  app: AppId;
  /** an wen es ging: Klikk selbst oder das Werbe-SDK in fremden Apps */
  an: "Klikk" | "AdKit";
  text: string;
}

export interface Stand {
  phase: Phase;
  tag: number;
  uhr: number;
  seed: number;

  // Anmeldung
  agbSekunden: number;
  rechte: Partial<Record<Recht, boolean>>;
  name: string;
  alterAngabe: number;
  alterEcht: number;

  // was die App zeigt
  follower: number;
  likes: number;
  streak: number;
  /** Tag, an dem zuletzt ein Snap an Lea ging */
  snapTag: number;
  abzeichen: string[];
  gepostet: number[];

  // was die App nicht zeigt
  schlaf: number[];
  hausaufgaben: boolean[];
  hausaufgabenStand: number;
  unterbrechungen: number;
  freunde: number;
  freundeTag: number;

  // Mitschrift
  verweil: Partial<Record<Thema, number>>;
  gelikt: Partial<Record<Thema, number>>;
  gesehen: string[];
  spur: Spur[];
  nachtOeffnungen: { tag: number; uhr: number }[];
  pushGesamt: number;
  pushGeoeffnet: number;
  appsGeoeffnet: Partial<Record<AppId, number>>;
  shopAngesehen: string[];
  quiz: Record<string, string>;
  candyRunden: number;
  werbung: { id: string; tag: number; uhr: number }[];
  /** angeklickte Werbung und wie weit es ging */
  werbungKlicks: { id: string; stufe: "seite" | "kasse" | "bestellt"; tag: number; uhr: number }[];
  /** gesehene Beiträge mit versteckter Werbung (Marke) */
  schleich: string[];
  /** Antworten auf Umfrage-Beiträge: Post-ID → Option */
  umfragen: Record<string, string>;
  /** laufende Freizeit-Aktivität (Lesen, Serie, Familie, Verein, Freunde) */
  aktivitaet: { art: "lesen" | "serie" | "familie" | "verein" | "freunde"; id: string; schritt: number; unterbrochen: number; start: number; gestoert: boolean } | null;
  /** erledigte Aktivitäten */
  freizeit: { art: string; id: string; tag: number; minuten: number; unterbrochen: number }[];
  verein: string | null;
  lesestand: Record<string, number>;
  serienstand: Record<string, number>;
  /** eigene Beiträge mit den Kommentaren darunter */
  eigenePosts: {
    id: string; art: "foto" | "video"; motiv?: string; trend?: string; fake?: boolean; tag: number; uhr: number;
    kommentare: { von: string; text: string; gemein: boolean; um: number; gemeldet?: boolean; status?: "beantwortet" | "geloescht" | "blockiert" | "gemeldet"; antwort?: string }[];
  }[];
  blockiert: string[];
  /** gesehene Beiträge aus der Klasse (Server-IDs) */
  klasseGesehen: number[];
  /** wer das Video gepostet hat, das Mo nachmacht */
  moKopieName?: string;
  moKopieTrend?: string;
  /** Faktencheck: Post-ID → Urteil und ob es stimmte; geteilte Nachrichten (geprüft oder nicht) */
  checks: Record<string, { urteil: "echt" | "fake"; richtig: boolean }>;
  geteilt: { id: string; geprueft: boolean; fake: boolean }[];
  /** Runden in »Klikk Games« */
  spielRunden: { spiel: string; punkte: number; tag: number; uhr: number }[];
  /** eigene Challenge-Videos */
  videos: { trend: string; fake: boolean; tag: number; aufrufe: number }[];

  // Geschichte
  erledigt: string[];
  chats: Record<ChatId, Nachricht[]>;
  ungelesen: Partial<Record<ChatId, number>>;
  /** Nachrichten-IDs, die gelesen wurden (Chat geöffnet, nachdem sie kamen) */
  gelesen: string[];
  pushes: Push[];
  flags: Record<string, boolean | number>;
  /** gemerkte Warnsignale: Signal-ID → wann bemerkt */
  bemerkt: Record<string, { tag: number; uhr: number }>;
  /** Morgenmeldung des aktuellen Tages */
  morgen: string[];
}
