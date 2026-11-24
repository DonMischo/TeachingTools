## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules (since 2026-11-24, on demand only):
- Use the graph only when the user asks for it (e.g. »frag den Graphen«, `/graphify`). Otherwise work with Read, Grep and Glob as usual, and ignore hook hints that suggest a graph query.
- When asked, query with exact symbol or file names (`graphify query "Walze DrehZaehlwerk Rechenblatt"`), not with prose sentences. The start node is matched by label, and ambiguous names such as `walze()` (four functions) otherwise pick an unrelated one. `graphify explain "<Symbol>"` and `graphify path "<A>" "<B>"` work the same way.
- No graph query is needed for files you just wrote or already know. Read or grep them directly.
- Do not run `graphify update .` by hand. It takes about 3 minutes, and the git hook rebuilds the graph in the background after every commit.
- `.graphifyignore` keeps data, assets and vendor files (frontend/public, data, presentations, package lists) out of the graph.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review.
- graphify-out/ is gitignored and local to each machine. On a fresh clone, run `graphify update .` once to build it.
- Subagents do not use the graph unless the user asked for it.
