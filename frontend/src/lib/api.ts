export type ClassOut = {
  id: number;
  code: string;
  display_name: string;
  symbol_emoji: string | null;
  symbol_image: string | null;
  total_points: number;
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

function authHeader(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("hp_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(init?.headers ?? {}) },
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

export const api = {
  classes: {
    list: () => apiFetch<ClassOut[]>("classes"),
    updateSymbolEmoji: (id: number, emoji: string | null) =>
      apiFetch<ClassOut>(`classes/${id}/symbol`, { method: "PATCH", body: JSON.stringify({ symbol_emoji: emoji }) }),
    uploadSymbolImage: (id: number, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/classes/${id}/symbol/image`, {
        method: "POST",
        headers: authHeader(),
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
        headers: authHeader(),
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
        headers: authHeader(),
        body: fd,
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<HausOut>;
      });
    },
    setMembers: (id: number, class_ids: number[]) =>
      apiFetch<HausOut>(`haeuser/${id}/members`, { method: "PUT", body: JSON.stringify({ class_ids }) }),
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
      apiFetch<{ awarded: { participant: WettkampfParticipant; stage: WettkampfStageIn | null; points: number }[] }>(
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
      apiFetch<{ awarded: { participant: WettkampfParticipant; stage: WettkampfStageIn | null; points: number }[] }>(
        "wettkampf/" + id + "/finish", { method: "POST", body: JSON.stringify({ manual_points: manualPoints }) }
      ),
    autoPair: (id: number, group: string | null) =>
      apiFetch<WettkampfOut & { created: number }>("wettkampf/" + id + "/auto-pair", {
        method: "POST", body: JSON.stringify({ group }),
      }),
  },
};
