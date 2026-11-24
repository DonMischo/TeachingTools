## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules (relaxed 2026-11-24 — use the graph where it helps, not by rote):
- Use `graphify query` for orientation in an area you do not know yet. Query with exact symbol or file names (`graphify query "Walze DrehZaehlwerk Rechenblatt"`), not with prose sentences. The start node is matched by label, and ambiguous names such as `walze()` (four functions) otherwise pick an unrelated one. `graphify explain "<Symbol>"` and `graphify path "<A>" "<B>"` work the same way.
- No graph query is needed for files you just wrote or already know. Read or grep them directly.
- Do not run `graphify update .` by hand. It takes about 3 minutes, and the git hook rebuilds the graph in the background after every commit.
- `.graphifyignore` keeps data, assets and vendor files (frontend/public, data, presentations, package lists) out of the graph.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review.
- graphify-out/ is gitignored and local to each machine. On a fresh clone, run `graphify update .` once to build it.
- Subagents that explore code get the same guidance: query by symbol names, optional.
