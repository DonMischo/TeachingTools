import type {
  TimelineBoard, TimelineGameSpec, TimelineSetDetail, TimelineSetOut,
} from "@/components/timeline/types";

export type ClassOut = {
  id: number;
  code: string;
  display_name: string;
  class_name?: string | null;
  symbol_emoji: string | null;
  symbol_image: string | null;
  total_points: number;
  ksprecher_can_edit?: boolean;
};

export type StudentOut = {
  id: number;
  nummer: number | null;
  nachname: string;
  vorname: string;
  klasse: string;
  class_id: number | null;
  jahrgang: number | null;
  geschlecht: string | null;
  geburtsdatum: string | null;
  username: string | null;
  active: boolean;
  alias: string | null;
  nta: number[];
  has_credentials: boolean;
};

export type StudentCredentialRow = {
  id: number;
  nachname: string;
  vorname: string;
  klasse: string;
  username: string;
  password: string;
};

export type MeOut = {
  user_type: "teacher" | "student";
  teacher?: TeacherOut;
  student?: StudentOut;
};

export type StudentCardData = {
  id: number;
  nachname: string;
  vorname: string;
  klasse: string;
  username: string | null;
  fields: Record<string, string>;
};

export type StudentDiffRow = {
  key: string;
  action: "new" | "update" | "unchanged";
  csv_data: Record<string, string>;
  db_data: Record<string, string> | null;
  changed_fields: string[];
};

export type StudentAbsentRow = { id: number; nachname: string; vorname: string; klasse: string };
export type StudentCandidate = { id: number; nachname: string; vorname: string; klasse: string };
export type StudentFieldConflict = { field: string; db_val: string; csv_val: string };
export type StudentEnrichRow = {
  key: string;
  status: "matched" | "ambiguous" | "unmatched";
  csv_data: Record<string, string>;
  match: StudentCandidate | null;
  candidates: StudentCandidate[];
  extra_writes: Record<string, string>;
  conflicts: StudentFieldConflict[];
  outdated: boolean;
};

export type StudentPreviewResponse = {
  mode: "roster" | "enrichment";
  diff: StudentDiffRow[];
  absent: StudentAbsentRow[];
  enrich: StudentEnrichRow[];
  extra_columns: string[];
  names_swapped: boolean;
  summary: Record<string, number>;
};

export type StudentResolution = { key: string; student_id: number; take_fields: string[] };
export type StudentApplyBody = {
  mode: "roster" | "enrichment";
  selected_keys?: string[];
  csv_data?: Record<string, Record<string, string>>;
  delete_ids?: number[];
  resolutions?: StudentResolution[];
};

export type SportfestDiscipline = {
  id: string;
  name: string;
  enabled: boolean;
};

export type SportfestResult = {
  student_id: number;
  discipline_id: string;
  value: number | null;
  points: number | null;
};

export type AuswertungStudent = {
  rank: number;
  name: string | null;
  klasse: string;
  jahrgang: number | null;
  total_points: number;
};

export type AuswertungDisciplineEntry = {
  rank: number;
  name: string | null;
  klasse: string;
  discipline_id: string;
  value: number | null;
  points: number | null;
};

export type KlasseEntry = {
  klasse: string;
  jahrgang: number | null;
  class_id: number | null;
  participant_count: number;
  raw_total: number;
};

export type KlassePunkteEntry = KlasseEntry & {
  adjusted: number;
  awarded: number;
};

export type StudentRoleOut = {
  id: number;
  student_id: number;
  student_name: string;
  role_type: string;
  scope_id: number | null;
  assigned_by: number | null;
};

export type GroupType = "kurs" | "wahlpflicht" | "ab_gruppe";

export type StudentGroupOut = {
  id: number;
  group_type: GroupType;
  name: string;
  class_id: number | null;
  member_ids: number[];
  member_class_ids: number[];
};

export type GroupRosterEntry = {
  id: number;
  vorname: string;
  nachname: string;
  alias: string | null;
};

export type ClassChoreOut = {
  id: number;
  class_id: number;
  chore_name: string;
  enabled: boolean;
  student_id: number | null;
  student_name: string | null;
  assigned_at: string | null;
};

// {student_id: {chore_name: count}}
export type ClassChoreStats = Record<number, Record<string, number>>;

export type ClassTrackerOut = {
  id: number;
  class_id: number;
  name: string;
  checked_student_ids: number[];
};

export type BarometerQuestionOut = {
  id: number;
  order: number;
  text: string;
  scale_min: number;
  scale_max: number;
  scale_min_label: string | null;
  scale_max_label: string | null;
};

export type BarometerSessionOut = {
  id: number;
  code: string;
  title: string;
  status: string;
  current_question_idx: number;
  results_visible: boolean;
  shared: boolean;
  questions: BarometerQuestionOut[];
};

export type BarometerSessionSummary = {
  id: number;
  code: string;
  title: string;
  status: string;
  question_count: number;
  created_at: string;
  shared: boolean;
  created_by: number;
  created_by_name: string;
};

export type BarometerQuestionIn = {
  text: string;
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
};

export type TeacherAssignmentOut = {
  id: number;
  subject: string;
  class_id: number | null;
  class_code: string | null;
  group_id: number | null;
  group_name: string | null;
  group_type: "kurs" | "wahlpflicht" | null;
  label: string;
};

export type TeacherOut = {
  id: number;
  first_name: string;
  last_name: string;
  active: boolean;
  role: string;
  username: string | null;
  nummer: number | null;
  email: string | null;
  teacher_role: string | null;
  klasse: string | null;
  klasse_id: number | null;
  assignments: TeacherAssignmentOut[];
  korrektur: number;
  notiz: string | null;
  av_stunden: number | null;
  total_ws: number;
};

export type TeacherCredentialRow = {
  id: number;
  last_name: string;
  first_name: string;
  role: string;
  username: string;
  password: string | null;
};

export type WochenstundenOut = {
  subject: string;
  grade: number;
  hours: number;
};

export type CalendarEntryOut = {
  id: number;
  title: string;
  description: string | null;
  category: string;   // single-select audience tier: Kollegium/Primar/Sekundar/Schulgemeinschaft/Ferien
  start_date: string;  // "YYYY-MM-DD"
  end_date: string;
  all_day: boolean;
  start_time: string | null;  // "HH:MM"
  end_time: string | null;
  tags: string[];  // free-form, colorable descriptive labels
  created_by: number;
  creator_name: string;
};

export type CalendarTagOut = {
  name: string;
  color: string;
};

export type CalendarMeta = {
  categories: string[];
  tags: CalendarTagOut[];
  bundeslaender: Record<string, string>;
};

export type SchoolSettingsOut = {
  bundesland: string;
};

export type TeacherDiffRow = {
  key: string;
  action: "new" | "update" | "unchanged";
  csv_data: Record<string, string>;
  db_data: Record<string, string> | null;
  changed_fields: string[];
};

export type TeacherPreviewResponse = {
  diff: TeacherDiffRow[];
  summary: { new: number; update: number; unchanged: number };
};

export type TransactionOut = {
  id: number;
  ts: string;
  points: number;
  reason: string | null;
  class_code: string;
  teacher_name: string;
};

export type TokenOut = {
  access_token: string;
  token_type: string;
  teacher: TeacherOut;
};

// Active guest token for REST calls that can't take an explicit token argument
// (e.g. exitgame attempt events fired deep in child widgets). The play page sets
// it when an unauthenticated guest joins, and clears it otherwise.
let _activeGuestToken: string | null = null;
export function setActiveGuestToken(token: string | null) { _activeGuestToken = token; }
function guestAuthHeaders(): Record<string, string> | undefined {
  return _activeGuestToken ? { Authorization: `Bearer ${_activeGuestToken}` } : undefined;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid — clear stored credentials so the login panel appears
      if (typeof window !== "undefined") {
        localStorage.removeItem("hp_token");
        localStorage.removeItem("hp_teacher");
        window.dispatchEvent(new Event("hp:logout"));
      }
    }
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

// Fragment guest requests: authenticate with a collection-scoped Bearer token
// (guests have no cookie) and, unlike apiFetch, never clear the logged-in user's
// stored credentials on 401 — a guest's expired token must not log anyone out.
async function ffetch<T>(path: string, init?: RequestInit, guestToken?: string): Promise<T> {
  if (!guestToken) return apiFetch<T>(path, init);
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), Authorization: `Bearer ${guestToken}` },
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return res.json();
}

/** Per-collection guest token store (sessionStorage). Set after a QR/link join. */
export const fragmentGuest = {
  get: (collectionId: number): string | undefined =>
    (typeof window !== "undefined" ? sessionStorage.getItem(`hp_frag_guest_${collectionId}`) : null) ?? undefined,
  set: (collectionId: number, token: string) => {
    if (typeof window !== "undefined") sessionStorage.setItem(`hp_frag_guest_${collectionId}`, token);
  },
  clear: (collectionId: number) => {
    if (typeof window !== "undefined") sessionStorage.removeItem(`hp_frag_guest_${collectionId}`);
  },
};

export type WettkampfParticipant = {
  id: number;
  name: string;
  seed: number | null;
  group: string | null;
  gender: "m" | "f" | null;
  class_id: number | null;
  class_name: string | null;
};

export type WettkampfStageIn = {
  name: string;
  order: number;
  points: number;
};

export type WettkampfStage = WettkampfStageIn & { id: number };

export type WettkampfMatch = {
  id: number;
  round_number: number;
  match_number: number;
  stage_id: number | null;
  stage_name: string | null;
  p1: WettkampfParticipant | null;
  p2: WettkampfParticipant | null;
  winner_id: number | null;
  is_draw: boolean;
  score_p1: string | null;
  score_p2: string | null;
};

export type ParticipantStats = { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number };

export type WettkampfOut = {
  id: number;
  title: string;
  description: string | null;
  type: "knockout" | "round_robin" | "pairing";
  status: "draft" | "active" | "finished";
  max_points: number;
  trostpreis_points: number;
  rewarded_places: number | null;
  scoring_system: string;
  win_points: number;
  draw_points: number;
  loss_points: number;
  ranking_mode: RankingMode;
  created_at: string;
  stages: WettkampfStage[];
  participants: WettkampfParticipant[];
  matches?: WettkampfMatch[];
  stats?: Record<string, ParticipantStats>;
};

export type RankingMode =
  | "overall" | "per_group" | "both"
  | "gender" | "overall+gender"
  | "per_group+gender" | "per_group_merged" | "per_group_merged+gender";

export type WettkampfCreate = {
  title: string;
  description?: string;
  type: "knockout" | "round_robin" | "pairing";
  max_points: number;
  trostpreis_points: number;
  rewarded_places?: number | null;
  scoring_system?: string;
  win_points?: number;
  draw_points?: number;
  loss_points?: number;
  ranking_mode?: RankingMode;
  stages?: WettkampfStageIn[];
};

export type QuizAnswer = {
  id: number;
  order: number;
  text: string;
  correct: boolean | null;
};

export type QuizQuestion = {
  id: number;
  order: number;
  type: "single" | "multi" | "survey" | "true_false";
  question_text: string;
  image_path: string | null;
  time_limit: number | null;
  answers: QuizAnswer[];
};

export type QuizOut = {
  id: number;
  title: string;
  description: string | null;
  max_points: number;
  time_limit_default: number;
  randomize_answers: boolean;
  created_at: string;
  question_count: number;
  warning: string | null;
  quiz_type: string;
  tags: string[];
  grades: number[];
};

export type GruppenauswertungEntry = {
  class_id: number;
  class_name: string;
  sessions: number;
  teacher_counts: Record<string, number>;
  raw_avg: number | null;
  adjusted: number;
  rank: number;
  suspicious: boolean;
};

export type GruppenauswertungPreview = {
  quiz_type: string;
  entries: GruppenauswertungEntry[];
  excluded: { class_id: number; class_name: string; sessions: number; raw_avg: number | null }[];
};

export type QuizDetailOut = QuizOut & { questions: QuizQuestion[] };

export type SessionOut = {
  id: number;
  join_code: string;
  status: "waiting" | "active" | "finished";
  current_question_idx: number;
  quiz_id: number;
  class_id: number;
  points_awarded: number | null;
  participant_count: number;
  team_mode: boolean;
};

export type HausOut = {
  id: number;
  name: string;
  color: string;
  logo_path: string | null;
  class_ids: number[];
  total_points: number;
};

export type SchreibraumAccessGrant = {
  id: number;
  room_id: string;
  student_id?: number | null;
  class_id?: number | null;
  label: string;
};

export type SchreibraumRoom = {
  id: string;
  code: string;
  title: string;
  mode: string;
  is_permanent: boolean;
  allow_guests?: boolean;
  created_by: number;
  creator_name: string;
  created_at: string;
  access: SchreibraumAccessGrant[];
};

export type SchreibraumParticipant = {
  id: string;
  room_id: string;
  name: string;
  color: string;
  session_token: string;
  is_teacher: boolean;
  is_kicked: boolean;
  rejoin_allowed: boolean;
  joined_at: string;
};

export type SchreibraumActionLog = {
  id: string;
  room_id: string;
  participant_name: string;
  action: string;
  detail?: string | null;
  ts: string;
};

export type AuctionOut = {
  id: number; code: string; title: string;
  description: string | null; prize_description: string | null;
  status: string; created_at: string;
  winner_house_id: number | null; winning_bid: number | null;
};

export type AuctionSetOut = {
  id: number; title: string;
  description: string | null; prize_description: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Stundenplaner
// ---------------------------------------------------------------------------

export type ToolLink = {
  type: "schreibraum" | "bingo" | "barometer" | "exit-ticket" | "classroom" | "caputh" | "zeitstrahl" | "auction" | "exitgame" | "link";
  ref_id: string | null;
  // Only for type "link": an arbitrary external URL opened directly.
  url?: string | null;
  label: string;
};

export type Phase = {
  id?: string | null;
  name: string;
  dauer_min: number;
  inhalt: string;
  sozialform: string;
  methode: string;
  material: string;
  tool_link: ToolLink | null;
};

export type LessonPlanBody = {
  title: string;
  fach?: string;
  klasse?: string;
  datum?: string | null;
  dauer_min?: number;
  lernziele?: string[];
  phasen?: Phase[];
  hausaufgaben?: string;
  notizen?: string;
};

export type LessonPlanOut = LessonPlanBody & {
  id: number;
  created_at: string;
  updated_at: string;
  owner_id: number;
  owner_name: string;
  is_owner: boolean;
  shared_with: { teacher_id: number; name: string }[];
  // filled by API
  lernziele: string[];
  phasen: Phase[];
};

export type ToolRefItem = { ref_id: string | null; label: string };
export type ToolInfo = {
  type: string;
  label: string;
  requires_ref: boolean;
  uses_class: boolean;
  items: ToolRefItem[];
};
export type ToolRefs = ToolInfo[];
export type ToolLaunchResult = { host_url: string; join_url: string | null; code: string | null };

// ── Exitgame ────────────────────────────────────────────────────────────────

export type ExitGameOut = {
  id: number;
  title: string;
  description: string | null;
  subject: string;
  grade: string | null;
  tags: string[];
  slide_count: number;
  created_at: string;
};

export type ExitGameMedia = { kind: "image" | "html" | "video"; src: string; alt?: string; height?: number };
export type ExitGameAnswer = { text: string; correct?: boolean };
export type ExitGameTask = {
  kind: "single" | "multi" | "true_false" | "input" | "timeline";
  question?: string;
  answers?: ExitGameAnswer[];
  accept?: string[];
  // kind "timeline": the Zeitstrahl game spec (sort/spot), checked server-side.
  timeline?: TimelineGameSpec;
  // Awarded when this task is solved; the door's code is the section's
  // fragments in reading order.
  codeFragment?: string;
  easierAlternative?: ExitGameTask;
  // Pool of equivalent alternatives; the server assigns one per attempt
  // (variant_choices) and checks answers against the same one.
  variants?: Partial<ExitGameTask>[];
};
export type ExitGameSlide = {
  id: string;
  type: "explanation" | "example" | "task" | "door";
  title?: string;
  text?: string;
  media?: ExitGameMedia;
  task?: ExitGameTask;
  tasks?: ExitGameTask[];
  hints?: string[];
  onFailReview?: string[];
  // Shown to students whose DDA level asks for an extra example.
  extraExample?: string;
};

// One fragment slot of a door's code. `fragment` is filled in only once the
// student has earned it — the server withholds the rest.
export type ExitGameFragment = {
  door_id: string;
  slide_id: string;
  task_index: number;
  earned: boolean;
  fragment: string | null;
};
export type ExitGameStyle = {
  theme?: string;
  font?: string;
  customVars?: Record<string, string>;
};
export type ExitGameData = {
  title: string;
  subject: string;
  style?: ExitGameStyle;
  dda?: { enabled?: boolean; levels?: Record<string, unknown>[] };
  completion?: { message?: string; code?: string };
  slides: ExitGameSlide[];
};
export type ExitGameDetailOut = ExitGameOut & { data: ExitGameData };

export type ExitGameSessionOut = {
  id: number;
  join_code: string;
  status: "open" | "closed";
  exitgame_id: number;
  class_id: number;
  attempt_count: number;
  created_at: string;
  closed_at: string | null;
};

export type ExitGameAttemptSummary = {
  id: number;
  status: "in_progress" | "finished";
  current_slide_idx: number;
  solved_slide_ids: string[];
  errors_total: number;
  hints_total: number;
  easier_taken_total: number;
  elapsed_seconds: number;
  started_at: string;
  finished_at: string | null;
};

export type DdaAdaptation = {
  outputs: Record<string, number>;
  contentParams: Record<string, Record<string, unknown>>;
  frustrated: boolean;
  bored: boolean;
};

export type ExitGameReportRow = {
  attempt_id: number;
  student_id: number;
  student_name: string;
  student_class: string;
  status: string;
  slides_solved: number;
  slides_total: number;
  errors_total: number;
  hints_total: number;
  easier_taken_total: number;
  elapsed_seconds: number;
};
export type ExitGameReport = { session_code: string; exitgame_title: string; status: string; attempts: ExitGameReportRow[] };

export type ExitGameLogEvent = { slide_id: string; event_type: string; payload: Record<string, unknown>; created_at: string };
export type ExitGameAttemptLog = { attempt: ExitGameAttemptSummary; student_name: string; student_class: string; events: ExitGameLogEvent[] };

// ── Übungsseite (practice) ──────────────────────────────────────────────────

export type PracticeProgressOut = {
  difficulty: number;
  tasks_done: number;
  tasks_correct: number;
  streak_correct?: number;
};
export type PracticeTopicOut = {
  id: string;
  label: string;
  subject: string;
  description: string;
  grades: number[];
  progress: PracticeProgressOut | null;
};
export type PracticeTaskOut = {
  task_id: number;
  question: string;
  difficulty: number;
  hint: string | null;
  image_svg: string | null;
  // Interactive Zahlenstrahl board (sanitized, no solution values) — when
  // set, the Übungsseite renders a draggable number line instead of an input.
  board?: TimelineBoard | null;
  progress: PracticeProgressOut;
};
export type PracticeAnswerOut = {
  correct: boolean;
  solution: string | null;
  leveled: "up" | "down" | null;
  progress: PracticeProgressOut;
};

// ── Task generators (built-in + admin-registered) ──────────────────────────

export type GeneratorInfo = {
  id: string;
  label: string;
  subject: string;
  description: string;
  grades: number[];
  source: "built-in" | "custom";
};
export type GeneratorSampleTask = {
  question: string;
  accept: string[];
  solution: string | null;
  hint: string | null;
  image_svg: string | null;
  distractors: string[];
};

export type GeneratorLevel = {
  template: string;
  vars: Record<string, [number, number]>;
  answer_expr: string;
  hint?: string | null;
};
export type GeneratorDefOut = {
  id: number;
  slug: string;
  label: string;
  subject: string;
  description: string;
  levels: GeneratorLevel[];
  created_at: string;
};

export type LessonSessionOut = {
  id: number;
  plan_id: number;
  started_at: string;
  ended_at: string | null;
};

export type LessonMaterialOut = {
  id: number;
  plan_id: number;
  phase_id: string;
  original_filename: string;
  content_type: string;
  url: string;
  pdf_url: string | null;
  size_bytes: number;
  uploaded_at: string;
};

export type ClassShareOut = { class_id: number; code: string; display_name: string };

export type BingoOut = {
  id: number; code: string; title: string;
  subject: string | null; tags: string[]; description: string | null; max_points: number;
  grid_size: number; grid_cols: number; status: string; total_pairs: number; created_at: string;
  class_id: number | null;
};

export type BingoCardOut = {
  id: number; grid_size: number;
  cells: { pair_index: number; answer: string }[];
  marked_positions: number[]; has_bingo: boolean;
};

export type BingoSetOut = {
  id: number; title: string;
  subject: string | null; tags: string[]; description: string | null; max_points: number;
  grid_size: number; grid_cols: number; total_pairs: number; created_at: string;
};

export type LueckentextGap = {
  id: string;
  answer: string;
  type: "word_bank" | "free_type" | "multiple_choice";
  difficulty: "easy" | "medium" | "hard";
  hint: string | null;
  choices: string[] | null;
};

export type LueckentextSetOut = {
  id: number; title: string; description: string | null; tags: string[]; grades: number[];
  gap_count: number; created_by: number | null; created_by_student: number | null; created_at: string;
};

export type LueckentextSetDetail = LueckentextSetOut & {
  text: string; gaps: LueckentextGap[]; distractors: string[];
};

export type LueckentextBoardGap = {
  id: string;
  type: "word_bank" | "free_type" | "multiple_choice";
  difficulty: "easy" | "medium" | "hard";
  hint: string | null;
  choices: string[] | null;
};

export type LueckentextBoard = { text: string; gaps: LueckentextBoardGap[]; word_bank: string[] };

export type LueckentextGapReview = {
  gap_id: string;
  attempts: number;
  hints_used: number;
  revealed: boolean;
  match: string | null;
  solved: boolean;
  time_spent_seconds: number | null;
};

export type LueckentextReviewEntry = {
  pid: number;
  name: string;
  avatar: string;
  gaps: LueckentextGapReview[];
};

export type ExitTicketSummary = {
  id: number; code: string; title: string; question: string;
  rating_enabled: boolean; status: string; response_count: number; created_at: string;
};

// ── Sitzplan (seating plans) ─────────────────────────────────────────────────
export type SeatingItemKind = "table1" | "table2" | "teacher" | "chair" | "cabinet" | "board" | "smartboard" | "custom";

export type SeatSlot = { id: string; student_id: number | null; label: string | null; locked: boolean };

export type SeatingItem = {
  id: string;
  kind: SeatingItemKind;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;      // per-axis size multipliers (inventory/chairs; tables stay 1)
  scaleY: number;
  locked: boolean;
  label: string | null;
  seats: SeatSlot[];
};

export type SeatingPlanSummary = {
  id: number;
  class_id: number;
  name: string;
  orientation: "landscape" | "portrait";
};

export type SeatingPlanDetail = SeatingPlanSummary & { items: SeatingItem[] };

// ── Tool availability ──
export type ToolCapability = "use" | "host" | "create" | "upload";
export type AudienceKind = "teacher" | "student";

// Resolved caps for the current user: { slug: { capability: allowed } }.
export type AvailabilityMap = Record<string, Partial<Record<ToolCapability, boolean>>>;

export type CatalogCapability = {
  capability: ToolCapability;
  label: string;
  teacher_default: boolean;
  student_default: boolean;
};

export type CatalogToolOut = {
  slug: string;
  label: string;
  icon: string;
  surface: "games" | "tools";
  capabilities: CatalogCapability[];
};

export type AvailabilityOverride = {
  tool_slug: string;
  capability: ToolCapability;
  audience: AudienceKind;
  class_id: number | null;
  allowed: boolean;
};

// ── Admin feature grants ──
export type AdminAccessMe = { is_admin: boolean; features: string[] };
export type AdminFeatureOut = { slug: string; label: string; icon: string };
export type AdminTeacherRole = { id: number; name: string };
export type AdminFeatureGrant = {
  feature_slug: string;
  teacher_role_id: number | null;
  teacher_id: number | null;
};

// ── Fragments (TaskCards-style boards) ─────────────────────────────────────────
export type FragmentPermission = "read" | "contribute" | "manage";
export type FragmentGranteeType = "all_teachers" | "class" | "teacher";
export type FragmentGrant = {
  grantee_type: FragmentGranteeType;
  class_id: number | null;
  class_code: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  permission: FragmentPermission;
};
export type FragmentGrantIn = {
  grantee_type: FragmentGranteeType;
  class_id?: number | null;
  teacher_id?: number | null;
  permission: FragmentPermission;
};
export type FragmentCollectionOut = {
  id: number;
  name: string;
  description: string | null;
  subject: string | null;
  owner_teacher_id: number;
  owner_name: string | null;
  allow_guests: boolean;
  guest_code: string | null;
  guest_permission: "read" | "contribute";
  my_permission: FragmentPermission | "none";
  is_owner: boolean;
  grants: FragmentGrant[];
  fragment_count: number;
  research_count: number;
};
export type FragmentOut = {
  id: number;
  collection_id: number;
  tab: string;
  title: string | null;
  content: string | null;
  category: string | null;
  order_index: number;
  author_kind: string | null;
  author_id: number | null;
  author_name: string | null;
  can_edit: boolean;
};
export type ResearchMediaOut = { id: number; kind: "image" | "pdf"; path: string; order_index: number };
export type ResearchItemOut = {
  id: number;
  collection_id: number;
  tab: string;
  title: string | null;
  url: string | null;
  url_title: string | null;
  url_description: string | null;
  url_image: string | null;
  text_content: string | null;
  tags: string[];
  media: ResearchMediaOut[];
  author_kind: string | null;
  author_id: number | null;
  author_name: string | null;
  can_edit: boolean;
};
export type FragmentTabs = { builtin: string[]; custom: string[]; all: string[] };
export type FragmentGuestStatus = {
  allow_guests: boolean;
  collection_id?: number | null;
  collection_name?: string | null;
  permission?: "read" | "contribute" | null;
};

export type ToolSessionOut = { code: string; tool_slug: string; allow_guests: boolean };

export const api = {
  // QR/join-link guest access (see api/routers/guest.py)
  guest: {
    join: (code: string, tool: string, name: string) =>
      apiFetch<{ token: string; name: string }>("guest/join", {
        method: "POST", body: JSON.stringify({ code, tool, name }),
      }),
    status: (tool: string, code: string) =>
      apiFetch<{ allow_guests: boolean }>(`guest/status?tool=${encodeURIComponent(tool)}&code=${encodeURIComponent(code)}`),
    setAllowed: (tool: string, code: string, allow: boolean) =>
      apiFetch<{ allow_guests: boolean }>("guest/allow", {
        method: "PATCH", body: JSON.stringify({ tool, code, allow }),
      }),
  },

  // Beitritts-Sitzungen für zustandslose Werkzeuge (Abakus, Gleichungswaage)
  toolSessions: {
    /** Session der Lehrkraft für dieses Werkzeug — legt sie beim ersten Mal an. */
    create: (tool_slug: string) =>
      apiFetch<ToolSessionOut>("tool-sessions", { method: "POST", body: JSON.stringify({ tool_slug }) }),
    /** Öffentlich: der Beitritts-Screen liest das vor jedem Login. */
    get: (code: string) => apiFetch<ToolSessionOut>(`tool-sessions/${encodeURIComponent(code)}`),
  },

  // Fragments — TaskCards-style boards (see api/routers/fragments*.py)
  fragments: {
    listCollections: () => apiFetch<FragmentCollectionOut[]>("fragments/collections"),
    getCollection: (id: number, guestToken?: string) => ffetch<FragmentCollectionOut>(`fragments/collections/${id}`, undefined, guestToken),
    createCollection: (body: { name: string; description?: string | null; subject?: string | null; grants?: FragmentGrantIn[] }) =>
      apiFetch<FragmentCollectionOut>("fragments/collections", { method: "POST", body: JSON.stringify(body) }),
    updateCollection: (id: number, body: Partial<{ name: string; description: string | null; subject: string | null; allow_guests: boolean; guest_permission: "read" | "contribute" }>) =>
      apiFetch<FragmentCollectionOut>(`fragments/collections/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteCollection: (id: number) => apiFetch<void>(`fragments/collections/${id}`, { method: "DELETE" }),
    setGrants: (id: number, grants: FragmentGrantIn[]) =>
      apiFetch<FragmentCollectionOut>(`fragments/collections/${id}/grants`, { method: "PUT", body: JSON.stringify(grants) }),
    regenerateGuestCode: (id: number) =>
      apiFetch<FragmentCollectionOut>(`fragments/collections/${id}/guest-code`, { method: "POST" }),
    guestStatus: (code: string) =>
      apiFetch<FragmentGuestStatus>(`fragments/guest/status?code=${encodeURIComponent(code)}`),
    guestJoin: (code: string, name: string) =>
      apiFetch<{ token: string; name: string; collection_id: number; collection_name: string; permission: string }>("fragments/guest/join", {
        method: "POST", body: JSON.stringify({ code, name }),
      }),

    getTabs: (id: number, guestToken?: string) => ffetch<FragmentTabs>(`fragments/collections/${id}/tabs`, undefined, guestToken),
    setTabs: (id: number, custom_tabs: string[]) =>
      apiFetch<FragmentTabs>(`fragments/collections/${id}/tabs`, { method: "PATCH", body: JSON.stringify({ custom_tabs }) }),

    listFragments: (id: number, tab?: string, guestToken?: string) =>
      ffetch<FragmentOut[]>(`fragments/collections/${id}/fragments${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`, undefined, guestToken),
    createFragment: (id: number, body: Partial<{ tab: string; title: string | null; content: string | null; category: string | null; order_index: number }>, guestToken?: string) =>
      ffetch<FragmentOut>(`fragments/collections/${id}/fragments`, { method: "POST", body: JSON.stringify(body) }, guestToken),
    updateFragment: (fragmentId: number, body: Partial<{ tab: string; title: string | null; content: string | null; category: string | null; order_index: number }>) =>
      apiFetch<FragmentOut>(`fragments/items/${fragmentId}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteFragment: (fragmentId: number) => apiFetch<void>(`fragments/items/${fragmentId}`, { method: "DELETE" }),
    importFragments: (id: number, files: File[]) => {
      const fd = new FormData();
      files.forEach(f => fd.append("files", f));
      return fetch(`/api/fragments/collections/${id}/fragments/import`, { method: "POST", credentials: "include", body: fd })
        .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<{ created: number; skipped: number }>; });
    },

    listResearch: (id: number, guestToken?: string) => ffetch<ResearchItemOut[]>(`fragments/collections/${id}/research`, undefined, guestToken),
    createResearch: (id: number, body: Partial<{ tab: string; title: string | null; url: string | null; text_content: string | null; tags: string[] }>, guestToken?: string) =>
      ffetch<ResearchItemOut>(`fragments/collections/${id}/research`, { method: "POST", body: JSON.stringify(body) }, guestToken),
    updateResearch: (itemId: number, body: Partial<{ tab: string; title: string | null; url: string | null; text_content: string | null; tags: string[] }>) =>
      apiFetch<ResearchItemOut>(`fragments/research/${itemId}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteResearch: (itemId: number) => apiFetch<void>(`fragments/research/${itemId}`, { method: "DELETE" }),
    refetchUrl: (itemId: number) => apiFetch<ResearchItemOut>(`fragments/research/${itemId}/fetch-url`, { method: "POST" }),
    // Media upload accepts a logged-in user (edit-own) or a contribute-guest (add-only).
    uploadMedia: (itemId: number, file: File, guestToken?: string) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/fragments/research/${itemId}/media`, {
        method: "POST",
        ...(guestToken ? { headers: { Authorization: `Bearer ${guestToken}` } } : { credentials: "include" }),
        body: fd,
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<ResearchItemOut>; });
    },
    deleteMedia: (mediaId: number) => apiFetch<void>(`fragments/media/${mediaId}`, { method: "DELETE" }),
  },
  classes: {
    list: () => apiFetch<ClassOut[]>("classes"),
    updateSymbolEmoji: (id: number, emoji: string | null) =>
      apiFetch<ClassOut>(`classes/${id}/symbol`, { method: "PATCH", body: JSON.stringify({ symbol_emoji: emoji }) }),
    updateClassName: (id: number, class_name: string | null) =>
      apiFetch<ClassOut>(`classes/${id}/name`, { method: "PATCH", body: JSON.stringify({ class_name }) }),
    uploadSymbolImage: (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/classes/${id}/symbol/image`, {
        method: "POST",
        credentials: "include",
        body: fd,
      }).then((r) => r.json() as Promise<ClassOut>);
    },
    setKsprecherEdit: (id: number, enabled: boolean) =>
      apiFetch<ClassOut>(`classes/${id}/ksprecher-edit`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
    myManagement: () => apiFetch<{ class_id: number | null }>("classes/my-management"),
    roster: (id: number) => apiFetch<{ id: number; vorname: string; nachname: string; geschlecht: string | null; alias: string | null; nta: number[] }[]>(`classes/${id}/roster`),
  },
  teachers: {
    list: () => apiFetch<TeacherOut[]>("teachers"),
    setKlasse: (teacherId: number, klasse_id: number | null) =>
      apiFetch<TeacherOut>(`teachers/${teacherId}/klasse`, {
        method: "PATCH", body: JSON.stringify({ klasse_id }),
      }),
    addAssignment: (teacherId: number, body: { subject: string; class_id?: number | null; group_id?: number | null }) =>
      apiFetch<TeacherOut>(`teachers/${teacherId}/assignments`, {
        method: "POST", body: JSON.stringify(body),
      }),
    deleteAssignment: (assignmentId: number) =>
      apiFetch<void>(`teachers/assignments/${assignmentId}`, { method: "DELETE" }),
    setKorrektur: (teacherId: number, body: { korrektur: number; notiz?: string | null; av_stunden?: number; clear_av_stunden?: boolean }) =>
      apiFetch<TeacherOut>(`teachers/${teacherId}/korrektur`, {
        method: "PATCH", body: JSON.stringify(body),
      }),
    getWochenstunden: () => apiFetch<WochenstundenOut[]>("teachers/wochenstunden"),
    setWochenstunden: (rows: WochenstundenOut[]) =>
      apiFetch<WochenstundenOut[]>("teachers/wochenstunden", {
        method: "PUT", body: JSON.stringify(rows),
      }),
    preview: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/teachers/preview", { method: "POST", credentials: "include", body: fd })
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<TeacherPreviewResponse>; });
    },
    apply: (selected_keys: string[], csv_data: Record<string, Record<string, string>>) =>
      apiFetch<{ applied: number; errors: string[] }>("teachers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_keys, csv_data }),
      }),
    generateCredentials: () => apiFetch<TeacherCredentialRow[]>("teachers/generate-credentials", { method: "POST" }),
    downloadCredentials: () => fetch("/api/teachers/credentials/download", { credentials: "include" }),
    create: (body: { first_name: string; last_name: string; role: string; email?: string | null; teacher_role?: string | null }) =>
      apiFetch<TeacherCredentialRow>("teachers", { method: "POST", body: JSON.stringify(body) }),
    resetPassword: (teacherId: number) =>
      apiFetch<TeacherCredentialRow>(`teachers/${teacherId}/reset-password`, { method: "POST" }),
    setUsername: (teacherId: number, username: string) =>
      apiFetch<TeacherOut>(`teachers/${teacherId}/username`, { method: "PATCH", body: JSON.stringify({ username }) }),
    delete: (teacherId: number) =>
      apiFetch<void>(`teachers/${teacherId}`, { method: "DELETE" }),
  },
  transactions: {
    create: (data: { teacher_id: number; class_id: number; points: number; reason: string }) =>
      apiFetch<TransactionOut>("transactions", { method: "POST", body: JSON.stringify(data) }),
    list: (class_id?: number) =>
      apiFetch<TransactionOut[]>(`transactions${class_id != null ? `?class_id=${class_id}` : ""}`),
    delete: (id: number) => apiFetch<void>(`transactions/${id}`, { method: "DELETE" }),
  },
  capuths: {
    list: () => apiFetch<QuizOut[]>("capuths"),
    get: (id: number) => apiFetch<QuizDetailOut>(`capuths/${id}`),
    delete: (id: number) => apiFetch<void>(`capuths/${id}`, { method: "DELETE" }),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/capuths/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<QuizOut>;
      });
    },
    createSession: (quizId: number, class_id: number, max_points: number, team_mode?: boolean) =>
      apiFetch<SessionOut>(`capuths/${quizId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ class_id, max_points, team_mode: team_mode ?? false }),
      }),
    getSession: (code: string) => apiFetch<SessionOut>(`sessions/${code}`),
    listSessions: (quizId: number) =>
      apiFetch<{ join_code: string; status: string; class_id: number; participant_count: number; points_awarded: number | null; started_at: string | null; finished_at: string | null }[]>(`capuths/${quizId}/sessions`),
    resetSession: (code: string) =>
      apiFetch<{ join_code: string; status: string }>(`sessions/${code}/reset`, { method: "POST" }),
    deleteSession: (code: string) =>
      apiFetch<void>(`sessions/${code}`, { method: "DELETE" }),
    clearSessions: (quizId: number) =>
      apiFetch<void>(`capuths/${quizId}/sessions`, { method: "DELETE" }),
    joinSession: (code: string, name: string, avatar: string = "cat", team_id?: number | null, guestToken?: string | null) =>
      apiFetch<{ participant_id: number; name: string; avatar: string; team_id: number | null }>(`sessions/${code}/join`, {
        method: "POST",
        headers: guestToken ? { Authorization: `Bearer ${guestToken}` } : undefined,
        body: JSON.stringify({ name, avatar, team_id: team_id ?? null }),
      }),
    listTeams: (code: string) =>
      apiFetch<{ id: number; name: string; color: string | null }[]>(`sessions/${code}/teams`),
    createTeam: (code: string, name: string, color?: string) =>
      apiFetch<{ id: number; name: string; color: string | null }>(`sessions/${code}/teams`, {
        method: "POST",
        body: JSON.stringify({ name, color }),
      }),
    deleteTeam: (code: string, teamId: number) =>
      apiFetch<void>(`sessions/${code}/teams/${teamId}`, { method: "DELETE" }),
    gruppenauswertungPreview: (params: { quiz_type: string; min_sessions?: number; prior_strength?: number; tags?: string[] }) => {
      const q = new URLSearchParams({ quiz_type: params.quiz_type });
      if (params.min_sessions != null) q.set("min_sessions", String(params.min_sessions));
      if (params.prior_strength != null) q.set("prior_strength", String(params.prior_strength));
      if (params.tags?.length) q.set("tags", params.tags.join(","));
      return apiFetch<GruppenauswertungPreview>(`capuths/gruppenauswertung/preview?${q}`);
    },
    gruppenauswertungCommit: (body: { quiz_type: string; max_points: number; trostpreis_points: number; min_sessions: number; prior_strength: number; tags?: string[] }) =>
      apiFetch<{ awarded: (GruppenauswertungEntry & { points_awarded: number })[] }>("capuths/gruppenauswertung/commit", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  auth: {
    login: (username: string, password: string) =>
      apiFetch<TokenOut>("auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => apiFetch<void>("auth/logout", { method: "POST" }),
    me: () => apiFetch<MeOut>("auth/me"),
  },
  students: {
    list: (params?: { klasse?: string; jahrgang?: number }) => {
      const q = new URLSearchParams();
      if (params?.klasse) q.set("klasse", params.klasse);
      if (params?.jahrgang != null) q.set("jahrgang", String(params.jahrgang));
      return apiFetch<StudentOut[]>(`students${q.size ? "?" + q : ""}`);
    },
    import: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/students/import", { method: "POST", credentials: "include", body: fd })
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json(); });
    },
    generateCredentials: (body?: { username_field?: string | null; password_field?: string | null }) =>
      apiFetch<{ rows: StudentCredentialRow[]; errors: string[] }>("students/generate-credentials", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
      }),
    fieldKeys: () => apiFetch<string[]>("students/field-keys"),
    deleteField: (key: string) =>
      apiFetch<{ removed: number }>(`students/fields?key=${encodeURIComponent(key)}`, { method: "DELETE" }),
    downloadCredentials: () => fetch("/api/students/credentials/download", { credentials: "include" }),
    create: (body: { vorname: string; nachname: string; klasse: string; geschlecht: string }) =>
      apiFetch<StudentCredentialRow>("students", { method: "POST", body: JSON.stringify(body) }),
    resetPassword: (studentId: number) =>
      apiFetch<StudentCredentialRow>(`students/${studentId}/reset-password`, { method: "POST" }),
    updateProfile: (studentId: number, body: { alias: string | null; nta: number[] }) =>
      apiFetch<StudentOut>(`students/${studentId}/profile`, { method: "PATCH", body: JSON.stringify(body) }),
    setUsername: (studentId: number, username: string) =>
      apiFetch<StudentOut>(`students/${studentId}/username`, { method: "PATCH", body: JSON.stringify({ username }) }),
    delete: (studentId: number) =>
      apiFetch<void>(`students/${studentId}`, { method: "DELETE" }),
    preview: (file: File, mode: "roster" | "enrichment" = "roster", listYear = 0) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      fd.append("list_year", String(listYear));
      return fetch("/api/students/preview", { method: "POST", credentials: "include", body: fd })
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<StudentPreviewResponse>; });
    },
    apply: (body: StudentApplyBody) =>
      apiFetch<{ applied: number; deleted: number; errors: string[] }>("students/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    cardData: (klasse?: string) => {
      const q = klasse ? `?klasse=${encodeURIComponent(klasse)}` : "";
      return apiFetch<StudentCardData[]>(`students/card-data${q}`);
    },
  },
  sportfest: {
    disciplines: {
      list: () => apiFetch<SportfestDiscipline[]>("sportfest/disciplines"),
      setEnabled: (id: string, enabled: boolean) =>
        apiFetch<SportfestDiscipline>(`sportfest/disciplines/${id}/enabled?enabled=${enabled}`, { method: "PUT" }),
    },
    results: {
      list: (params?: { klasse?: string; jahrgang?: number }) => {
        const q = new URLSearchParams();
        if (params?.klasse) q.set("klasse", params.klasse);
        if (params?.jahrgang != null) q.set("jahrgang", String(params.jahrgang));
        return apiFetch<SportfestResult[]>(`sportfest/results${q.size ? "?" + q : ""}`);
      },
      upsert: (studentId: number, disciplineId: string, valueRaw: string) =>
        apiFetch<SportfestResult>(`sportfest/results/${studentId}/${disciplineId}`, {
          method: "PUT", body: JSON.stringify({ value_raw: valueRaw }),
        }),
      delete: (studentId: number, disciplineId: string) =>
        apiFetch<void>(`sportfest/results/${studentId}/${disciplineId}`, { method: "DELETE" }),
    },
    auswertung: {
      gesamt: (params?: { jahrgang?: number; geschlecht?: string }) => {
        const q = new URLSearchParams();
        if (params?.jahrgang != null) q.set("jahrgang", String(params.jahrgang));
        if (params?.geschlecht) q.set("geschlecht", params.geschlecht);
        return apiFetch<AuswertungStudent[]>(`sportfest/auswertung/gesamt${q.size ? "?" + q : ""}`);
      },
      disziplin: (params?: { overall?: boolean; jahrgang?: number }) => {
        const q = new URLSearchParams();
        if (params?.overall) q.set("overall", "true");
        if (params?.jahrgang != null) q.set("jahrgang", String(params.jahrgang));
        return apiFetch<AuswertungDisciplineEntry[]>(`sportfest/auswertung/disziplin${q.size ? "?" + q : ""}`);
      },
      klassen: () => apiFetch<KlasseEntry[]>("sportfest/auswertung/klassen"),
      klassenPunktePreview: (prior_strength?: number) => {
        const q = prior_strength != null ? `?prior_strength=${prior_strength}` : "";
        return apiFetch<KlassePunkteEntry[]>(`sportfest/auswertung/klassen-punkte/preview${q}`);
      },
      klassenPunkteCommit: (body: { prior_strength?: number; reason?: string }) =>
        apiFetch<KlassePunkteEntry[]>("sportfest/auswertung/klassen-punkte/commit", {
          method: "POST",
          body: JSON.stringify(body),
        }),
    },
  },
  setup: {
    status: () => apiFetch<{ needs_setup: boolean }>("setup/status"),
    createAdmin: (username: string, password: string) =>
      apiFetch<TokenOut>("setup/create-admin", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
  },
  haeuser: {
    list: () => apiFetch<HausOut[]>("haeuser"),
    create: (name: string, color: string) =>
      apiFetch<HausOut>("haeuser", { method: "POST", body: JSON.stringify({ name, color }) }),
    update: (id: number, name: string, color: string) =>
      apiFetch<HausOut>(`haeuser/${id}`, { method: "PUT", body: JSON.stringify({ name, color }) }),
    delete: (id: number) => apiFetch<void>(`haeuser/${id}`, { method: "DELETE" }),
    uploadLogo: (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/haeuser/${id}/logo`, {
        method: "POST",
        credentials: "include",
        body: fd,
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<HausOut>;
      });
    },
    setMembers: (id: number, class_ids: number[]) =>
      apiFetch<HausOut>(`haeuser/${id}/members`, { method: "PUT", body: JSON.stringify({ class_ids }) }),
  },
  roles: {
    list: (params?: { role_type?: string; scope_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.role_type) q.set("role_type", params.role_type);
      if (params?.scope_id != null) q.set("scope_id", String(params.scope_id));
      return apiFetch<StudentRoleOut[]>(`roles${q.size ? "?" + q : ""}`);
    },
    assign: (body: { student_id: number; role_type: string; scope_id?: number | null }) =>
      apiFetch<StudentRoleOut>("roles", { method: "POST", body: JSON.stringify(body) }),
    remove: (id: number) => apiFetch<void>(`roles/${id}`, { method: "DELETE" }),
    types: (class_id: number) => apiFetch<string[]>(`roles/types?class_id=${class_id}`),
    setTypes: (class_id: number, role_types: string[]) =>
      apiFetch<string[]>("roles/types", { method: "PUT", body: JSON.stringify({ class_id, role_types }) }),
  },
  groups: {
    list: (params?: { group_type?: GroupType; class_id?: number }) => {
      const q = new URLSearchParams();
      if (params?.group_type) q.set("group_type", params.group_type);
      if (params?.class_id != null) q.set("class_id", String(params.class_id));
      return apiFetch<StudentGroupOut[]>(`groups${q.size ? "?" + q : ""}`);
    },
    create: (body: { group_type: GroupType; name: string; class_id?: number | null }) =>
      apiFetch<StudentGroupOut>("groups", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`groups/${id}`, { method: "DELETE" }),
    addMember: (id: number, student_id: number) =>
      apiFetch<StudentGroupOut>(`groups/${id}/members`, { method: "POST", body: JSON.stringify({ student_id }) }),
    removeMember: (id: number, student_id: number) =>
      apiFetch<StudentGroupOut>(`groups/${id}/members/${student_id}`, { method: "DELETE" }),
    roster: (id: number) => apiFetch<GroupRosterEntry[]>(`groups/${id}/roster`),
    award: (id: number, points: number, reason?: string) =>
      apiFetch<{ class_id: number; points: number }[]>(`groups/${id}/award`, {
        method: "POST",
        body: JSON.stringify({ points, reason }),
      }),
  },
  availability: {
    me: () => apiFetch<AvailabilityMap>("availability/me"),
    catalog: () => apiFetch<CatalogToolOut[]>("availability/catalog"),
    overrides: (class_id?: number | null) => {
      const q = class_id != null ? `?class_id=${class_id}` : "";
      return apiFetch<AvailabilityOverride[]>(`availability/overrides${q}`);
    },
    setOverride: (body: AvailabilityOverride) =>
      apiFetch<AvailabilityOverride>("availability/override", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    clearOverride: (p: { tool_slug: string; capability: ToolCapability; audience: AudienceKind; class_id?: number | null }) => {
      const q = new URLSearchParams({ tool_slug: p.tool_slug, capability: p.capability, audience: p.audience });
      if (p.class_id != null) q.set("class_id", String(p.class_id));
      return apiFetch<void>(`availability/override?${q}`, { method: "DELETE" });
    },
  },
  adminAccess: {
    me: () => apiFetch<AdminAccessMe>("admin-access/me"),
    catalog: () => apiFetch<AdminFeatureOut[]>("admin-access/catalog"),
    teacherRoles: () => apiFetch<AdminTeacherRole[]>("admin-access/teacher-roles"),
    grants: () => apiFetch<AdminFeatureGrant[]>("admin-access/grants"),
    addGrant: (b: { feature_slug: string; teacher_role_id?: number | null; teacher_id?: number | null }) =>
      apiFetch<AdminFeatureGrant>("admin-access/grant", { method: "PUT", body: JSON.stringify(b) }),
    removeGrant: (b: { feature_slug: string; teacher_role_id?: number | null; teacher_id?: number | null }) => {
      const q = new URLSearchParams({ feature_slug: b.feature_slug });
      if (b.teacher_role_id != null) q.set("teacher_role_id", String(b.teacher_role_id));
      if (b.teacher_id != null) q.set("teacher_id", String(b.teacher_id));
      return apiFetch<void>(`admin-access/grant?${q}`, { method: "DELETE" });
    },
  },
  calendar: {
    meta: () => apiFetch<CalendarMeta>("calendar/meta"),
    list: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from_", params.from);
      if (params?.to) q.set("to", params.to);
      return apiFetch<CalendarEntryOut[]>(`calendar${q.size ? "?" + q : ""}`);
    },
    create: (body: { title: string; description?: string | null; category: string; start_date: string; end_date: string; all_day: boolean; start_time?: string | null; end_time?: string | null; tags: string[] }) =>
      apiFetch<CalendarEntryOut>("calendar", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: { title: string; description?: string | null; category: string; start_date: string; end_date: string; all_day: boolean; start_time?: string | null; end_time?: string | null; tags: string[] }) =>
      apiFetch<CalendarEntryOut>(`calendar/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`calendar/${id}`, { method: "DELETE" }),
    tags: {
      list: () => apiFetch<CalendarTagOut[]>("calendar/tags"),
      create: (name: string, color: string) =>
        apiFetch<CalendarTagOut>("calendar/tags", { method: "POST", body: JSON.stringify({ name, color }) }),
    },
    settings: {
      get: () => apiFetch<SchoolSettingsOut>("calendar/settings"),
      set: (bundesland: string) =>
        apiFetch<SchoolSettingsOut>("calendar/settings", { method: "PUT", body: JSON.stringify({ bundesland }) }),
    },
    fetchHolidays: (schoolYearStart: number) =>
      apiFetch<{ created: number; bundesland: string }>(`calendar/holidays/fetch?school_year_start=${schoolYearStart}`, { method: "POST" }),
    exportIcsUrl: (tags: string[], categories: string[]) => {
      const q = new URLSearchParams();
      if (tags.length) q.set("tags", tags.join(","));
      if (categories.length) q.set("categories", categories.join(","));
      return `/api/calendar/export.ics${q.size ? "?" + q : ""}`;
    },
    importIcs: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/calendar/import.ics", { method: "POST", credentials: "include", body: fd })
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<{ created: number; errors: string[] }>; });
    },
  },
  timelines: {
    list: () => apiFetch<TimelineSetOut[]>("timelines"),
    get: (id: number) => apiFetch<TimelineSetDetail>(`timelines/${id}`),
    create: (body: Record<string, unknown>) =>
      apiFetch<TimelineSetDetail>("timelines", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      apiFetch<TimelineSetDetail>(`timelines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`timelines/${id}`, { method: "DELETE" }),
    template: () => apiFetch<Record<string, unknown>>("timelines/template"),
    importExamples: () => apiFetch<TimelineSetOut[]>("timelines/examples", { method: "POST" }),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/timelines/upload", { method: "POST", credentials: "include", body: fd })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json() as Promise<TimelineSetDetail>;
        });
    },
  },
  lueckentexte: {
    list: () => apiFetch<LueckentextSetOut[]>("lueckentexte"),
    get: (id: number) => apiFetch<LueckentextSetDetail>(`lueckentexte/${id}`),
    create: (body: Record<string, unknown>) =>
      apiFetch<LueckentextSetDetail>("lueckentexte", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Record<string, unknown>) =>
      apiFetch<LueckentextSetDetail>(`lueckentexte/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`lueckentexte/${id}`, { method: "DELETE" }),
    template: () => apiFetch<Record<string, unknown>>("lueckentexte/template"),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/lueckentexte/upload", { method: "POST", credentials: "include", body: fd })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json() as Promise<LueckentextSetDetail>;
        });
    },
    createSession: (setId: number) =>
      apiFetch<{ id: number; join_code: string; status: string; lueckentext_id: number; lueckentext_title: string }>(
        `lueckentexte/${setId}/sessions`, { method: "POST" }),
    joinSession: (code: string, name: string, avatar: string, guestToken?: string | null) =>
      apiFetch<{ id: number; name: string; avatar: string }>(
        `lueckentexte/sessions/${code}/join`, {
          method: "POST",
          headers: guestToken ? { Authorization: `Bearer ${guestToken}` } : undefined,
          body: JSON.stringify({ name, avatar }),
        }),
    sessionState: (code: string) =>
      apiFetch<{ status: string; join_code: string; lueckentext_id: number; board: LueckentextBoard | null }>(`lueckentexte/sessions/${code}/state`),
    startSession: (code: string) =>
      apiFetch<{ id: number; join_code: string; status: string; lueckentext_id: number; lueckentext_title: string }>(
        `lueckentexte/sessions/${code}/start`, { method: "POST" }),
    finishSession: (code: string) =>
      apiFetch<{ id: number; join_code: string; status: string; lueckentext_id: number; lueckentext_title: string }>(
        `lueckentexte/sessions/${code}/finish`, { method: "POST" }),
    submitAttempt: (code: string, gapId: string, participantId: number, text: string) =>
      apiFetch<{ match: string; revealed: boolean; hint: string | null; attempts: number; solved: boolean }>(
        `lueckentexte/sessions/${code}/gaps/${gapId}/attempt`,
        { method: "POST", body: JSON.stringify({ participant_id: participantId, text }) }),
    review: (code: string) =>
      apiFetch<LueckentextReviewEntry[]>(`lueckentexte/sessions/${code}/review`),
  },
  exitgame: {
    list: () => apiFetch<ExitGameOut[]>("exitgames"),
    get: (id: number) => apiFetch<ExitGameDetailOut>(`exitgames/${id}`),
    template: () => apiFetch<Record<string, unknown>>("exitgames/template"),
    delete: (id: number) => apiFetch<void>(`exitgames/${id}`, { method: "DELETE" }),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/exitgames/upload", { method: "POST", credentials: "include", body: fd })
        .then(async (r) => {
          if (!r.ok) throw new Error(JSON.stringify(await r.json().catch(() => ({}))));
          return r.json() as Promise<ExitGameOut>;
        });
    },
    sessions: {
      create: (exitgameId: number, class_id: number) =>
        apiFetch<ExitGameSessionOut>(`exitgames/${exitgameId}/sessions`, { method: "POST", body: JSON.stringify({ class_id }) }),
      list: (exitgameId: number) => apiFetch<ExitGameSessionOut[]>(`exitgames/${exitgameId}/sessions`),
      get: (code: string) => apiFetch<ExitGameSessionOut>(`exitgame-sessions/${code}`),
      close: (code: string) => apiFetch<ExitGameSessionOut>(`exitgame-sessions/${code}/close`, { method: "POST" }),
      delete: (code: string) => apiFetch<void>(`exitgame-sessions/${code}`, { method: "DELETE" }),
      report: (code: string) => apiFetch<ExitGameReport>(`exitgame-sessions/${code}/report`),
      reportCsvUrl: (code: string) => `/api/exitgame-sessions/${code}/report?fmt=csv`,
    },
    // Guest players carry a Bearer token on every attempt call. Set once by the
    // play page (see setActiveGuestToken) so child widgets need no token prop.
    attempts: {
      start: (code: string) => apiFetch<{
        attempt: ExitGameAttemptSummary; exitgame_id: number; exitgame_data: ExitGameData;
        variant_choices: Record<string, number>;
        code_fragments: ExitGameFragment[]; adaptation: DdaAdaptation | null;
      }>(
        `exitgame-sessions/${code}/attempts`, { method: "POST", headers: guestAuthHeaders() },
      ),
      postEvent: (attemptId: number, slide_id: string, action: string, payload: Record<string, unknown> = {}) =>
        apiFetch<{
          correct: boolean | null; adaptation: DdaAdaptation | null; attempt: ExitGameAttemptSummary;
          code_fragments: ExitGameFragment[]; open_slides?: string[];
        }>(
          `exitgame-attempts/${attemptId}/events`,
          { method: "POST", headers: guestAuthHeaders(), body: JSON.stringify({ slide_id, action, payload }) },
        ),
      finish: (attemptId: number) =>
        apiFetch<{ attempt: ExitGameAttemptSummary; completion: { message?: string; code?: string } | null }>(
          `exitgame-attempts/${attemptId}/finish`, { method: "POST", headers: guestAuthHeaders() },
        ),
      log: (attemptId: number) => apiFetch<ExitGameAttemptLog>(`exitgame-attempts/${attemptId}/log`),
    },
  },
  practice: {
    topics: () => apiFetch<PracticeTopicOut[]>("practice/topics"),
    newTask: (topic: string) => apiFetch<PracticeTaskOut>(`practice/${topic}/task`, { method: "POST" }),
    answer: (taskId: number, answer: string) =>
      apiFetch<PracticeAnswerOut>(`practice/tasks/${taskId}/answer`, { method: "POST", body: JSON.stringify({ answer }) }),
  },
  generators: {
    list: () => apiFetch<GeneratorInfo[]>("generators"),
    sample: (id: string, difficulty = 3, count = 5) =>
      apiFetch<{ generator: string; difficulty: number; tasks: GeneratorSampleTask[] }>(
        `generators/${id}/sample?difficulty=${difficulty}&count=${count}`),
    adminList: () => apiFetch<GeneratorDefOut[]>("admin/generators"),
    create: (body: { slug: string; label: string; subject: string; description: string; levels: GeneratorLevel[] }) =>
      apiFetch<{ id: number; slug: string }>("admin/generators", { method: "POST", body: JSON.stringify(body) }),
    delete: (slug: string) => apiFetch<void>(`admin/generators/${slug}`, { method: "DELETE" }),
  },
  chores: {
    allNames: () => apiFetch<string[]>("chores/all-names"),
    stats: (class_id: number) => apiFetch<ClassChoreStats>(`chores/stats?class_id=${class_id}`),
    list: (class_id: number) => apiFetch<ClassChoreOut[]>(`chores?class_id=${class_id}`),
    upsert: (body: { class_id: number; chore_name: string; student_id?: number | null; enabled?: boolean }) =>
      apiFetch<ClassChoreOut>("chores", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`chores/${id}`, { method: "DELETE" }),
    clear: (class_id: number) => apiFetch<void>(`chores/clear?class_id=${class_id}`, { method: "POST" }),
    randomAssign: (class_id: number) => apiFetch<ClassChoreOut[]>(`chores/random?class_id=${class_id}`, { method: "POST" }),
  },
  trackers: {
    list: (class_id: number) => apiFetch<ClassTrackerOut[]>(`trackers?class_id=${class_id}`),
    create: (body: { class_id: number; name: string }) =>
      apiFetch<ClassTrackerOut>("trackers", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`trackers/${id}`, { method: "DELETE" }),
    toggle: (tracker_id: number, student_id: number) =>
      apiFetch<ClassTrackerOut>(`trackers/${tracker_id}/toggle?student_id=${student_id}`, { method: "POST" }),
  },
  seating: {
    list: (class_id: number) => apiFetch<SeatingPlanSummary[]>(`classes/${class_id}/seating`),
    create: (class_id: number, body: { name?: string; orientation?: "landscape" | "portrait" }) =>
      apiFetch<SeatingPlanDetail>(`classes/${class_id}/seating`, { method: "POST", body: JSON.stringify(body) }),
    get: (plan_id: number) => apiFetch<SeatingPlanDetail>(`seating/${plan_id}`),
    update: (plan_id: number, body: { name: string; orientation: "landscape" | "portrait"; items: SeatingItem[] }) =>
      apiFetch<SeatingPlanDetail>(`seating/${plan_id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (plan_id: number) => apiFetch<void>(`seating/${plan_id}`, { method: "DELETE" }),
    exportPdfUrl: (plan_id: number) => `/api/seating/${plan_id}/export.pdf`,
  },
  barometer: {
    list: () => apiFetch<BarometerSessionSummary[]>("barometer"),
    create: (body: { title: string; questions: BarometerQuestionIn[]; shared?: boolean }) =>
      apiFetch<BarometerSessionOut>("barometer", { method: "POST", body: JSON.stringify(body) }),
    update: (code: string, body: { title: string; questions: BarometerQuestionIn[]; shared?: boolean }) =>
      apiFetch<BarometerSessionOut>(`barometer/${code}`, { method: "PATCH", body: JSON.stringify(body) }),
    get: (code: string) => apiFetch<BarometerSessionOut>(`barometer/${code}`),
    delete: (code: string) => apiFetch<void>(`barometer/${code}`, { method: "DELETE" }),
    clone: (code: string) => apiFetch<BarometerSessionOut>(`barometer/${code}/clone`, { method: "POST" }),
    template: () => apiFetch<Record<string, unknown>>("barometer/template"),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/barometer/upload", { method: "POST", credentials: "include", body: fd })
        .then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json() as Promise<BarometerSessionOut>;
        });
    },
  },
  schreibraum: {
    list: (created_by?: number) =>
      apiFetch<SchreibraumRoom[]>(`schreibraum/rooms${created_by != null ? `?created_by=${created_by}` : ""}`),
    getByCode: (code: string, guestToken?: string | null) =>
      apiFetch<SchreibraumRoom>(`schreibraum/rooms/by-code/${code}`, guestToken ? { headers: { Authorization: `Bearer ${guestToken}` } } : undefined),
    create: (body: { title: string; mode?: string; is_permanent?: boolean }) =>
      apiFetch<SchreibraumRoom>("schreibraum/rooms", { method: "POST", body: JSON.stringify(body) }),
    patch: (id: string, body: { title?: string; mode?: string; is_permanent?: boolean }) =>
      apiFetch<SchreibraumRoom>(`schreibraum/rooms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<void>(`schreibraum/rooms/${id}`, { method: "DELETE" }),
    addAccess: (id: string, body: { student_id?: number; class_id?: number }) =>
      apiFetch<SchreibraumAccessGrant>(`schreibraum/rooms/${id}/access`, { method: "POST", body: JSON.stringify(body) }),
    removeAccess: (id: string, grantId: number) =>
      apiFetch<void>(`schreibraum/rooms/${id}/access/${grantId}`, { method: "DELETE" }),
    join: (id: string, guestToken?: string | null) =>
      apiFetch<SchreibraumParticipant>(`schreibraum/rooms/${id}/join`, {
        method: "POST",
        headers: guestToken ? { Authorization: `Bearer ${guestToken}` } : undefined,
      }),
    participants: (id: string) => apiFetch<SchreibraumParticipant[]>(`schreibraum/rooms/${id}/participants`),
    kick: (id: string, pid: string) =>
      apiFetch<void>(`schreibraum/rooms/${id}/participants/${pid}/kick`, { method: "POST" }),
    rejoinToggle: (id: string, pid: string) =>
      apiFetch<void>(`schreibraum/rooms/${id}/participants/${pid}/rejoin-toggle`, { method: "POST" }),
    log: (id: string) => apiFetch<SchreibraumActionLog[]>(`schreibraum/rooms/${id}/log`),
  },
  wettkampf: {
    list: () => apiFetch<WettkampfOut[]>("wettkampf"),
    get: (id: number) => apiFetch<WettkampfOut>("wettkampf/" + id),
    create: (body: WettkampfCreate) =>
      apiFetch<WettkampfOut>("wettkampf", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: Partial<WettkampfCreate>) =>
      apiFetch<WettkampfOut>("wettkampf/" + id, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>("wettkampf/" + id, { method: "DELETE" }),
    addParticipant: (id: number, p: { name: string; class_id?: number | null; seed?: number | null; gender?: "m" | "f" | null }) =>
      apiFetch<WettkampfParticipant>("wettkampf/" + id + "/participants", {
        method: "POST", body: JSON.stringify(p),
      }),
    removeParticipant: (id: number, pid: number) =>
      apiFetch<void>("wettkampf/" + id + "/participants/" + pid, { method: "DELETE" }),
    setStages: (id: number, stages: WettkampfStageIn[]) =>
      apiFetch<WettkampfOut>("wettkampf/" + id + "/stages", {
        method: "PUT", body: JSON.stringify({ stages }),
      }),
    suggestStages: (id: number) =>
      apiFetch<WettkampfStageIn[]>("wettkampf/" + id + "/suggest-stages"),
    suggestPlacements: (id: number, n: number) =>
      apiFetch<{ place: number; name: string; points: number }[]>(
        `wettkampf/${id}/suggest-placements?n=${n}`
      ),
    generate: (id: number) =>
      apiFetch<WettkampfOut>("wettkampf/" + id + "/generate", { method: "POST" }),
    setResult: (id: number, mid: number, body: { winner_id?: number; is_draw?: boolean; score_p1?: string; score_p2?: string }) =>
      apiFetch<WettkampfOut>("wettkampf/" + id + "/matches/" + mid + "/result", {
        method: "PUT", body: JSON.stringify(body),
      }),
    finish: (id: number) =>
      apiFetch<{ awarded: { participant: WettkampfParticipant; stage: WettkampfStageIn | null; points: number }[]; class_awarded?: { name: string; rank: number; stats: { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }; points: number }[] }>(
        "wettkampf/" + id + "/finish", { method: "POST" }
      ),
    deleteMatch: (id: number, mid: number) =>
      apiFetch<void>("wettkampf/" + id + "/matches/" + mid, { method: "DELETE" }),
    addMatch: (id: number, body: { round_number: number; p1_id: number; p2_id: number }) =>
      apiFetch<WettkampfOut>("wettkampf/" + id + "/matches", {
        method: "POST", body: JSON.stringify(body),
      }),
    updateParticipant: (id: number, pid: number, body: { group?: string | null; gender?: "m" | "f" | null }) =>
      apiFetch<WettkampfParticipant>("wettkampf/" + id + "/participants/" + pid, {
        method: "PATCH", body: JSON.stringify(body),
      }),
    results: (id: number) =>
      apiFetch<{ awarded: { participant: WettkampfParticipant; stage: WettkampfStageIn | null; points: number }[]; class_awarded: { name: string; rank: number; stats: { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }; points: number }[] }>(
        "wettkampf/" + id + "/results", { method: "GET" }
      ),
    finishWithPoints: (id: number, manualPoints: { participant_id: number; points: number }[]) =>
      apiFetch<{ awarded: { participant: WettkampfParticipant; stage: WettkampfStageIn | null; points: number }[]; class_awarded?: { name: string; rank: number; stats: { w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number }; points: number }[] }>(
        "wettkampf/" + id + "/finish", { method: "POST", body: JSON.stringify({ manual_points: manualPoints }) }
      ),
    autoPair: (id: number, group: string | null) =>
      apiFetch<WettkampfOut & { created: number }>("wettkampf/" + id + "/auto-pair", {
        method: "POST", body: JSON.stringify({ group }),
      }),
  },
  auction: {
    list: (set_id?: number) => apiFetch<AuctionOut[]>(`auction${set_id != null ? `?set_id=${set_id}` : ""}`),
    create: (body: { title: string; description?: string | null; prize_description?: string | null }) =>
      apiFetch<AuctionOut>("auction", { method: "POST", body: JSON.stringify(body) }),
    delete: (code: string) => apiFetch<void>(`auction/${code}`, { method: "DELETE" }),
    listSets: () => apiFetch<AuctionSetOut[]>("auction/sets"),
    startSet: (setId: number) =>
      apiFetch<AuctionOut>(`auction/sets/${setId}/sessions`, { method: "POST" }),
  },
  bingo: {
    list: (set_id?: number) => apiFetch<BingoOut[]>(`bingo${set_id != null ? `?set_id=${set_id}` : ""}`),
    create: (body: { title: string; subject?: string | null; tags?: string[]; description?: string | null; max_points?: number; grid_size: number; grid_cols?: number; pairs: { caller: string; answer: string }[] }) =>
      apiFetch<{ id: number; code: string }>("bingo", { method: "POST", body: JSON.stringify(body) }),
    // Create a reusable set without starting a session (student authoring path).
    createSet: (body: { title: string; subject?: string | null; tags?: string[]; description?: string | null; max_points?: number; grid_size: number; grid_cols?: number; pairs: { caller: string; answer: string }[] }) =>
      apiFetch<BingoSetOut>("bingo/sets", { method: "POST", body: JSON.stringify(body) }),
    delete: (code: string) => apiFetch<void>(`bingo/${code}`, { method: "DELETE" }),
    close: (code: string) => apiFetch<void>(`bingo/${code}/close`, { method: "POST" }),
    reset: (code: string) => apiFetch<void>(`bingo/${code}/reset`, { method: "POST" }),
    getOrCreateCard: (code: string) =>
      apiFetch<BingoCardOut>(`bingo/${code}/card`, { method: "POST" }),
    listSets: () => apiFetch<BingoSetOut[]>("bingo/sets"),
    startSet: (setId: number, class_id?: number | null) =>
      apiFetch<{ id: number; code: string; class_id: number | null }>(`bingo/sets/${setId}/sessions`, {
        method: "POST", body: JSON.stringify({ class_id: class_id ?? null }),
      }),
  },
  exitTicket: {
    list: () => apiFetch<ExitTicketSummary[]>("exit-ticket"),
    create: (body: { title: string; question: string; rating_enabled?: boolean }) =>
      apiFetch<{ id: number; code: string }>("exit-ticket", { method: "POST", body: JSON.stringify(body) }),
    clone: (code: string) =>
      apiFetch<{ id: number; code: string }>(`exit-ticket/${code}/clone`, { method: "POST" }),
    delete: (code: string) => apiFetch<void>(`exit-ticket/${code}`, { method: "DELETE" }),
  },
  stundenplaner: {
    list: () => apiFetch<{ own: LessonPlanOut[]; shared: LessonPlanOut[] }>("stundenplaner"),
    create: (body: LessonPlanBody) =>
      apiFetch<LessonPlanOut>("stundenplaner", { method: "POST", body: JSON.stringify(body) }),
    importJson: (raw: string) =>
      fetch("/api/stundenplaner/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: raw,
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<LessonPlanOut>;
      }),
    get: (id: number) => apiFetch<LessonPlanOut>(`stundenplaner/${id}`),
    update: (id: number, body: LessonPlanBody) =>
      apiFetch<LessonPlanOut>(`stundenplaner/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => apiFetch<void>(`stundenplaner/${id}`, { method: "DELETE" }),
    toolRefs: () => apiFetch<ToolRefs>("stundenplaner/tool-refs"),
    launchTool: (type: string, ref_id: string | null, klasse?: string | null) =>
      apiFetch<ToolLaunchResult>(`stundenplaner/tools/${type}/launch`, {
        method: "POST", body: JSON.stringify({ ref_id, klasse: klasse ?? null }),
      }),
    addShare: (id: number, teacher_id: number) =>
      apiFetch<{ teacher_id: number; name: string }>(`stundenplaner/${id}/shares`, {
        method: "POST", body: JSON.stringify({ teacher_id }),
      }),
    removeShare: (id: number, teacher_id: number) =>
      apiFetch<void>(`stundenplaner/${id}/shares/${teacher_id}`, { method: "DELETE" }),
    start: (id: number) =>
      apiFetch<LessonSessionOut>(`stundenplaner/${id}/start`, { method: "POST" }),
    end: (sessionId: number) =>
      apiFetch<void>(`stundenplaner/sessions/${sessionId}/end`, { method: "POST" }),
    active: () =>
      apiFetch<{ session: LessonSessionOut; plan: LessonPlanOut } | null>("stundenplaner/active"),
    materials: {
      list: (planId: number) => apiFetch<LessonMaterialOut[]>(`stundenplaner/${planId}/materials`),
      upload: (planId: number, phaseId: string, file: File) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("phase_id", phaseId);
        return fetch(`/api/stundenplaner/${planId}/materials`, {
          method: "POST",
          credentials: "include",
          body: fd,
        }).then(async (r) => {
          if (!r.ok) throw new Error(await r.text());
          return r.json() as Promise<LessonMaterialOut>;
        });
      },
      remove: (planId: number, materialId: number) =>
        apiFetch<void>(`stundenplaner/${planId}/materials/${materialId}`, { method: "DELETE" }),
    },
    classShares: {
      list: (planId: number) => apiFetch<ClassShareOut[]>(`stundenplaner/${planId}/class-shares`),
      add: (planId: number, class_id: number) =>
        apiFetch<ClassShareOut>(`stundenplaner/${planId}/class-shares`, {
          method: "POST", body: JSON.stringify({ class_id }),
        }),
      remove: (planId: number, class_id: number) =>
        apiFetch<void>(`stundenplaner/${planId}/class-shares/${class_id}`, { method: "DELETE" }),
    },
  },
  apiFetch,
};
