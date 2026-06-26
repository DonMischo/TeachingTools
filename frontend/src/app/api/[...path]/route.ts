import { NextRequest } from "next/server";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const { search } = req.nextUrl;
  const apiHost = process.env.API_HOST ?? "127.0.0.1";
  const apiPort = process.env.API_PORT ?? "8000";
  const target = `http://${apiHost}:${apiPort}/api/${path.join("/")}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    const ct = req.headers.get("content-type") ?? "";
    init.body = ct.includes("multipart/form-data") ? await req.formData() : req.body;
    (init as RequestInit & { duplex?: string }).duplex = "half";
  }

  try {
    return fetch(target, init);
  } catch {
    return new Response("Backend unavailable", { status: 503 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
