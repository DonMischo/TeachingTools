import { api, ToolLink } from "@/lib/api";

/**
 * Launch a phase's tool_link: the backend tool registry
 * (api/tool_registry.py) creates a session/lobby where needed and returns
 * the host URL to open. All per-tool knowledge lives server-side — adding a
 * new tool requires no frontend change.
 */
export async function launchTool(link: ToolLink, klasse?: string | null): Promise<string> {
  // "link" is a plain external URL — open it directly, no session/registry.
  if (link.type === "link") {
    const url = link.url?.trim();
    if (!url) throw new Error("Kein Link hinterlegt");
    return url;
  }
  const result = await api.stundenplaner.launchTool(link.type, link.ref_id, klasse);
  return result.host_url;
}
