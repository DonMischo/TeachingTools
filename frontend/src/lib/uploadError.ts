// Upload validation errors, made readable.
//
// Every content upload (Caputh, Exitgame, Lückentext, Zeitstrahl, Umfrage)
// throws `new Error(<raw response body>)`. The body is one of:
//   {"detail": {"message": "...", "errors": ["slides[2]: 'id' fehlt", ...]}}  ← our validators
//   {"detail": "Ungültiges JSON: ..."}                                        ← plain HTTPException
//   {"detail": [{"loc": [...], "msg": "..."}, ...]}                           ← FastAPI/pydantic 422
// …or plain text when something upstream failed. This turns all of them into
// one shape the dialog can render.

export type UploadError = { message: string; errors: string[] };

type PydanticError = { loc?: unknown[]; msg?: string };

function pydanticLine(entry: unknown): string {
  if (typeof entry === "string") return entry;
  const e = entry as PydanticError;
  const where = Array.isArray(e.loc) ? e.loc.filter(p => p !== "body").join(" → ") : "";
  const msg = e.msg ?? JSON.stringify(entry);
  return where ? `${where}: ${msg}` : msg;
}

export function parseUploadError(err: unknown, fallback = "Upload fehlgeschlagen"): UploadError {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw.trim()) return { message: fallback, errors: [] };

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { message: raw, errors: [] };   // not JSON — show what we got
  }

  const detail = (body as { detail?: unknown })?.detail ?? body;

  if (typeof detail === "string") return { message: detail, errors: [] };
  if (Array.isArray(detail)) return { message: fallback, errors: detail.map(pydanticLine) };

  if (detail && typeof detail === "object") {
    const d = detail as { message?: string; errors?: unknown };
    const errors = Array.isArray(d.errors) ? d.errors.map(e => String(e)) : [];
    return { message: d.message ?? fallback, errors };
  }

  return { message: fallback, errors: [] };
}
