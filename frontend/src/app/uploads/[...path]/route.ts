import { NextRequest } from "next/server";

const API_HOST = process.env.API_HOST ?? "127.0.0.1";
const API_PORT = process.env.API_PORT ?? "8000";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `http://${API_HOST}:${API_PORT}/uploads/${path.join("/")}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  try {
    return fetch(target, { method: req.method, headers });
  } catch {
    return new Response("Backend unavailable", { status: 503 });
  }
}

export const GET = handler;
export const HEAD = handler;
