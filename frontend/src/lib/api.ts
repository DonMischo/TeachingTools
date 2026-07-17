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
};

export type StudentOut = {
  id: number;
  nummer: number | null;
  nachname: string;
  vorname: string;
  klasse: string;
  class_id: number | null;
  jahrgang: number | null;
  geschlecht: string;
  geburtsdatum: string | null;
  username: string | null;
  active: boolean;
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

export type StudentPreviewResponse = {
  diff: StudentDiffRow[];
  extra_columns: string[];
  summary: { new: number; update: number; unchanged: number };
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
  type: "schreibraum" | "bingo" | "barometer" | "exit-ticket" | "classroom" | "caputh" | "zeitstrahl";
  ref_id: string | null;
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
  code?: string;
  hints?: string[];
  onFailReview?: string[];
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

export type ExitTicketSummary = {
  id: number; code: string; title: string; question: string;
  rating_enabled: boolean; status: string; response_count: number; created_at: string;
};

export const api = {
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
    joinSession: (code: string, name: string, avatar: string = "cat", team_id?: number | null) =>
      apiFetch<{ participant_id: number; name: string; avatar: string; team_id: number | null }>(`sessions/${code}/join`, {
        method: "POST",
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
    generateCredentials: () => apiFetch<StudentCredentialRow[]>("students/generate-credentials", { method: "POST" }),
    downloadCredentials: () => fetch("/api/students/credentials/download", { credentials: "include" }),
    preview: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/students/preview", { method: "POST", credentials: "include", body: fd })
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() as Promise<StudentPreviewResponse>; });
    },
    apply: (selected_keys: string[], csv_data: Record<string, Record<string, string>>) =>
      apiFetch<{ applied: number; errors: string[] }>("students/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_keys, csv_data }),
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
    award: (id: number, points: number, reason?: string) =>
      apiFetch<{ class_id: number; points: number }[]>(`groups/${id}/award`, {
        method: "POST",
        body: JSON.stringify({ points, reason }),
      }),
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
    attempts: {
      start: (code: string) => apiFetch<{ attempt: ExitGameAttemptSummary; exitgame_data: ExitGameData; variant_choices: Record<string, number> }>(
        `exitgame-sessions/${code}/attempts`, { method: "POST" },
      ),
      postEvent: (attemptId: number, slide_id: string, action: string, payload: Record<string, unknown> = {}) =>
        apiFetch<{ correct: boolean | null; adaptation: DdaAdaptation | null; attempt: ExitGameAttemptSummary }>(
          `exitgame-attempts/${attemptId}/events`,
          { method: "POST", body: JSON.stringify({ slide_id, action, payload }) },
        ),
      finish: (attemptId: number) =>
        apiFetch<{ attempt: ExitGameAttemptSummary; completion: { message?: string; code?: string } | null }>(
          `exitgame-attempts/${attemptId}/finish`, { method: "POST" },
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
  barometer: {
    list: () => apiFetch<BarometerSessionSummary[]>("barometer"),
    create: (body: { title: string; questions: BarometerQuestionIn[]; shared?: boolean }) =>
      apiFetch<BarometerSessionOut>("barometer", { method: "POST", body: JSON.stringify(body) }),
    update: (code: string, body: { title: string; questions: BarometerQuestionIn[]; shared?: boolean }) =>
      apiFetch<BarometerSessionOut>(`barometer/${code}`, { method: "PATCH", body: JSON.stringify(body) }),
    get: (code: string) => apiFetch<BarometerSessionOut>(`barometer/${code}`),
    delete: (code: string) => apiFetch<void>(`barometer/${code}`, { method: "DELETE" }),
    clone: (code: string) => apiFetch<BarometerSessionOut>(`barometer/${code}/clone`, { method: "POST" }),
  },
  schreibraum: {
    list: (created_by?: number) =>
      apiFetch<SchreibraumRoom[]>(`schreibraum/rooms${created_by != null ? `?created_by=${created_by}` : ""}`),
    getByCode: (code: string) => apiFetch<SchreibraumRoom>(`schreibraum/rooms/by-code/${code}`),
    create: (body: { title: string; mode?: string; is_permanent?: boolean }) =>
      apiFetch<SchreibraumRoom>("schreibraum/rooms", { method: "POST", body: JSON.stringify(body) }),
    patch: (id: string, body: { title?: string; mode?: string; is_permanent?: boolean }) =>
      apiFetch<SchreibraumRoom>(`schreibraum/rooms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<void>(`schreibraum/rooms/${id}`, { method: "DELETE" }),
    addAccess: (id: string, body: { student_id?: number; class_id?: number }) =>
      apiFetch<SchreibraumAccessGrant>(`schreibraum/rooms/${id}/access`, { method: "POST", body: JSON.stringify(body) }),
    removeAccess: (id: string, grantId: number) =>
      apiFetch<void>(`schreibraum/rooms/${id}/access/${grantId}`, { method: "DELETE" }),
    join: (id: string) =>
      apiFetch<SchreibraumParticipant>(`schreibraum/rooms/${id}/join`, { method: "POST" }),
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
