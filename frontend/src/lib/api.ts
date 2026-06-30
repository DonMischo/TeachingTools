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
  questions: BarometerQuestionOut[];
};

export type BarometerSessionSummary = {
  id: number;
  code: string;
  title: string;
  status: string;
  question_count: number;
  created_at: string;
};

export type BarometerQuestionIn = {
  text: string;
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
};

export type TeacherOut = {
  id: number;
  first_name: string;
  last_name: string;
  active: boolean;
  role: string;
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

export type BingoOut = {
  id: number; code: string; title: string;
  grid_size: number; status: string; total_pairs: number; created_at: string;
};

export type BingoCardOut = {
  id: number; grid_size: number;
  cells: { pair_index: number; answer: string }[];
  marked_positions: number[]; has_bingo: boolean;
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
    createSession: (quizId: number, class_id: number, max_points: number) =>
      apiFetch<SessionOut>(`capuths/${quizId}/sessions`, {
        method: "POST",
        body: JSON.stringify({ class_id, max_points }),
      }),
    getSession: (code: string) => apiFetch<SessionOut>(`sessions/${code}`),
    listSessions: (quizId: number) =>
      apiFetch<{ join_code: string; status: string; class_id: number; participant_count: number; points_awarded: number | null; started_at: string | null; finished_at: string | null }[]>(`capuths/${quizId}/sessions`),
    resetSession: (code: string) =>
      apiFetch<{ join_code: string; status: string }>(`sessions/${code}/reset`, { method: "POST" }),
    joinSession: (code: string, name: string, avatar: string = "cat") =>
      apiFetch<{ participant_id: number; name: string }>(`sessions/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ name, avatar }),
      }),
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
  barometer: {
    list: () => apiFetch<BarometerSessionSummary[]>("barometer"),
    create: (body: { title: string; questions: BarometerQuestionIn[] }) =>
      apiFetch<BarometerSessionOut>("barometer", { method: "POST", body: JSON.stringify(body) }),
    get: (code: string) => apiFetch<BarometerSessionOut>(`barometer/${code}`),
    delete: (code: string) => apiFetch<void>(`barometer/${code}`, { method: "DELETE" }),
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
    list: () => apiFetch<AuctionOut[]>("auction"),
    create: (body: { title: string; description?: string | null; prize_description?: string | null }) =>
      apiFetch<AuctionOut>("auction", { method: "POST", body: JSON.stringify(body) }),
    delete: (code: string) => apiFetch<void>(`auction/${code}`, { method: "DELETE" }),
  },
  bingo: {
    list: () => apiFetch<BingoOut[]>("bingo"),
    create: (body: { title: string; grid_size: number; pairs: { caller: string; answer: string }[] }) =>
      apiFetch<{ id: number; code: string }>("bingo", { method: "POST", body: JSON.stringify(body) }),
    delete: (code: string) => apiFetch<void>(`bingo/${code}`, { method: "DELETE" }),
    getOrCreateCard: (code: string, student_id: number) =>
      apiFetch<BingoCardOut>(`bingo/${code}/card?student_id=${student_id}`, { method: "POST" }),
  },
  apiFetch,
};
