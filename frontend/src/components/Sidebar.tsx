"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ClassOut, TransactionOut, StudentGroupOut, GroupType } from "@/lib/api";
import { useSelectedClass } from "@/contexts/SelectedClassContext";
import { NavIcon } from "@/components/icons/NavIcon";
import { AppLogo } from "@/components/AppLogo";
import { useSidebarPanel } from "@/contexts/SidebarPanelContext";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { useAvailability } from "@/hooks/useAvailability";

const NAV_MAIN: { tab: string; label: string; href: string }[] = [
  { tab: "home",           label: "Hauspokal",         href: "/" },
  { tab: "games",          label: "Spiele",            href: "/games" },
  { tab: "tools",          label: "Tools",             href: "/tools" },
  { tab: "klassen",        label: "Klassenverwaltung", href: "/klassen" },
  { tab: "kalender",       label: "Kalender",          href: "/kalender" },
  { tab: "fragmente",      label: "Fragmente",         href: "/fragmente" },
];

const QUICK = [5, 10, 25, 50, 100];

const POINTS_GUIDE = [
  { pts: 5,   label: "Gutes Verhalten",         detail: "Ein Schüler verhält sich besonders vorbildlich." },
  { pts: 10,  label: "Starke Antwort / Frage",  detail: "Außergewöhnliche Antwort oder Frage im Unterricht." },
  { pts: 25,  label: "Besonderes Engagement",   detail: "Eigene Initiative, Präsentation oder Hilfsbereitschaft." },
  { pts: 50,  label: "Herausragende Leistung",  detail: "Hervorragendes Ergebnis bei einer Aufgabe oder einem Test." },
  { pts: 100, label: "Ganze Klasse – Verhalten",detail: "Die gesamte Klasse zeigt vorbildliches Verhalten (≈ 10× Einzelpunkt)." },
  { pts: 250, label: "Ganze Klasse – Teamarbeit",detail: "Außergewöhnliche Zusammenarbeit oder Klassensieg bei einer Aktivität." },
  { pts: 500, label: "Turnier- / Wettbewerbssieg", detail: "Klasse gewinnt ein schulweites Turnier oder einen Wettbewerb." },
];

const GROUP_TABS: { type: GroupType; label: string; icon: string }[] = [
  { type: "kurs", label: "Kurse", icon: "📘" },
  { type: "wahlpflicht", label: "Wahlpflicht", icon: "🎨" },
  { type: "ab_gruppe", label: "Gruppen", icon: "🔀" },
];

function GroupAwardSection({ type, label, icon }: { type: GroupType; label: string; icon: string }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [amt, setAmt] = useState("");
  const qc = useQueryClient();

  const { data: groups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", type],
    queryFn: () => api.groups.list({ group_type: type }),
    enabled: open,
    staleTime: 15_000,
  });

  const awardMut = useMutation({
    mutationFn: ({ id, points }: { id: number; points: number }) => api.groups.award(id, points),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setActiveId(null);
      setAmt("");
    },
  });

  return (
    <div className="border-t border-[var(--border)]">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">
        {icon} {label} {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul className="divide-y divide-[var(--border)]">
          {groups.length === 0 ? (
            <li className="px-4 py-2 text-xs text-[var(--text-muted)]">Keine {label}.</li>
          ) : groups.map(g => (
            <li key={g.id} className="px-4 py-2">
              <button
                onClick={() => { setActiveId(activeId === g.id ? null : g.id); setAmt(""); }}
                className="w-full flex items-center justify-between text-sm"
              >
                <span>{g.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{g.member_ids.length} Sch. · {g.member_class_ids.length} Kl.</span>
              </button>
              {activeId === g.id && (
                <div className="flex items-center gap-1 mt-2">
                  {QUICK.map(q => (
                    <button key={q} onClick={() => setAmt(String(q))}
                      className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)]">+{q}</button>
                  ))}
                  <input
                    type="number"
                    value={amt}
                    onChange={e => setAmt(e.target.value)}
                    placeholder="Pkt"
                    className="input text-xs py-1 w-16"
                  />
                  <button
                    disabled={!amt || parseInt(amt) === 0 || awardMut.isPending}
                    onClick={() => awardMut.mutate({ id: g.id, points: parseInt(amt) })}
                    className="btn-primary text-xs py-1 px-2 disabled:opacity-40"
                  >✓</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassIcon({ cls, size }: { cls: ClassOut; size: string }) {
  if (cls.symbol_image) {
    return (
      <img
        src={cls.symbol_image}
        alt={cls.code}
        style={{ width: size, height: size, objectFit: "contain", borderRadius: 4 }}
      />
    );
  }
  return <span style={{ fontSize: size, lineHeight: 1 }}>{cls.symbol_emoji ?? "📚"}</span>;
}

export function Sidebar({ iconOnly = false }: { iconOnly?: boolean }) {
  const { auth, login, logout: authLogout } = useAuth();
  const { selectedClass, setSelectedClass } = useSelectedClass();
  const pathname = usePathname();
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const { setPanelOpen } = useSidebarPanel();
  const [pointsOpen, setPointsOpen] = useState(false);
  useEffect(() => { setPanelOpen(pointsOpen); }, [pointsOpen, setPanelOpen]);
  const [amt, setAmt] = useState("");
  const [reason, setReason] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [classesOpen, setClassesOpen] = useState(true);
  const [awardTarget, setAwardTarget] = useState<{ groupId: number; name: string } | null>(null);

  const qc = useQueryClient();

  const canAwardPoints = auth?.role === "teacher" || auth?.role === "admin";

  // A student sees the Klassenverwaltung icon only if they're a granted
  // Klassensprecher (limited Dienste/Sitzplan edit for their class).
  const { data: myMgmt } = useQuery<{ class_id: number | null }>({
    queryKey: ["my-management"],
    queryFn: api.classes.myManagement,
    enabled: auth?.role === "student",
    staleTime: 60_000,
  });
  const canSeeKlassen = auth?.role === "teacher" || auth?.role === "admin" || myMgmt?.class_id != null;

  // The admin icon shows for real admins and for teachers granted any admin feature.
  const { isAdmin, hasAny: hasAdminFeature } = useAdminAccess();
  const canSeeAdmin = isAdmin || hasAdminFeature;
  const { can: canUse, ready: availReady } = useAvailability();

  const { data: classes = [] } = useQuery<ClassOut[]>({
    queryKey: ["classes"],
    queryFn: api.classes.list,
    enabled: pointsOpen,
    staleTime: 30_000,
  });

  // Auto-open points panel when a class is selected from the klassen page
  useEffect(() => {
    if (selectedClass) {
      setPointsOpen(true);
      setLoginOpen(false);
      setAmt("");
      setReason("");
      setShowLog(false);
      setShowGuide(false);
      setAwardTarget(null);
    }
  }, [selectedClass?.id]);

  const { data: abGroups = [] } = useQuery<StudentGroupOut[]>({
    queryKey: ["groups", "ab_gruppe", selectedClass?.id],
    queryFn: () => api.groups.list({ group_type: "ab_gruppe", class_id: selectedClass!.id }),
    enabled: pointsOpen && !!selectedClass,
    staleTime: 15_000,
  });

  const txMut = useMutation({
    mutationFn: (v: { class_id: number; points: number }) =>
      api.transactions.create({ teacher_id: auth!.teacher!.id, reason, ...v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haeuser"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      setAmt("");
      setReason("");
    },
  });

  const groupAwardMut = useMutation({
    mutationFn: (v: { id: number; points: number }) => api.groups.award(v.id, v.points, reason || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["haeuser"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      setAmt("");
      setReason("");
    },
  });

  const { data: txLog = [] } = useQuery<TransactionOut[]>({
    queryKey: ["tx-log", selectedClass?.id],
    queryFn: () => api.transactions.list(selectedClass!.id),
    enabled: showLog && !!selectedClass,
    staleTime: 10_000,
  });

  const deleteTxMut = useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tx-log", selectedClass?.id] });
      qc.invalidateQueries({ queryKey: ["haeuser"] });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });

  function award(classId: number, points: number) {
    if (!auth) return;
    if (awardTarget) {
      groupAwardMut.mutate({ id: awardTarget.groupId, points });
    } else {
      txMut.mutate({ class_id: classId, points });
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    try {
      await login(username, password);
      setLoginOpen(false);
    } catch {
      setLoginError("Login fehlgeschlagen");
    }
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function closeAll() { setPointsOpen(false); setLoginOpen(false); }

  const iconStrip = (
    <div className="flex flex-col items-center w-12 py-2 bg-[var(--surface)] border-r border-[var(--border)] shrink-0 z-30 relative">
      {/* Logo */}
      <div className="flex items-center justify-center w-10 h-10 mb-1 overflow-hidden">
        <AppLogo />
      </div>
      <div className="w-7 h-px bg-[var(--border)] mb-1" />

      <div className="flex flex-col items-center gap-1">
        {NAV_MAIN
          .filter(({ tab }) => {
            // Tools stays teacher/admin-only; Klassenverwaltung also shows for a
            // granted Klassensprecher (canSeeKlassen).
            if (tab === "tools" && auth?.role === "student") return false;
            if (tab === "klassen" && !canSeeKlassen) return false;
            // Fragmente respects tool availability; shown optimistically until resolved.
            if (tab === "fragmente" && availReady && !canUse("fragmente", "use")) return false;
            return true;
          })
          .map(({ tab, label, href }) => (
          <Link key={tab} href={href} title={label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
              ${isActive(href)
                ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
            <NavIcon name={tab as any} />
          </Link>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1 mb-1">
        {/* Admin — real admins, plus teachers granted any admin feature */}
        {canSeeAdmin && (
          <Link href="/admin" title="Admin"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
              ${isActive("/admin")
                ? "bg-[var(--accent)] text-[var(--accent-text,#111)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
            <NavIcon name="admin" />
          </Link>
        )}
        {/* Login / user */}
        <button
          suppressHydrationWarning
          title={auth ? (auth.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name}` : auth.student ? `${auth.student.vorname} ${auth.student.nachname}` : "Eingeloggt") : "Login"}
          onClick={() => { const next = !loginOpen; closeAll(); setLoginOpen(next); }}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
            ${loginOpen ? "bg-[var(--accent)] text-[var(--accent-text,#111)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
          <NavIcon name={auth ? "user" : "login"} />
        </button>
      </div>
    </div>
  );

  const pointsFlyout = pointsOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => { setPointsOpen(false); setSelectedClass(null); }} />
      <aside className="fixed top-0 left-12 h-full w-72 z-50 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0">
          <span className="text-sm font-semibold flex-1" style={{ color: "var(--accent)" }}>
            ⭐ {selectedClass ? selectedClass.code : "Punkte vergeben"}
          </span>
          <button
            onClick={() => setShowGuide(v => !v)}
            title="Punkte-Leitfaden"
            className="w-6 h-6 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-bold flex items-center justify-center"
          >?</button>
          <button onClick={() => { setPointsOpen(false); setSelectedClass(null); setShowGuide(false); }}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
        </div>

        {!canAwardPoints ? (
          <div className="flex-1 flex items-center justify-center p-6 text-sm text-[var(--text-muted)] text-center">
            {auth ? "Keine Berechtigung zum Punkte vergeben." : "Bitte zuerst einloggen, um Punkte zu vergeben."}
          </div>
        ) : selectedClass ? (
          /* ── Selected class detail + award form ── */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Class header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
              <ClassIcon cls={selectedClass} size="3rem" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{selectedClass.code}</span>
                  <button
                    onClick={() => setShowLog(v => !v)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${showLog ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"}`}
                    title="Punkte-Log anzeigen"
                  >📋</button>
                </div>
                {selectedClass.class_name && (
                  <div className="text-xs text-[var(--text-muted)]">„{selectedClass.class_name}"</div>
                )}
                <div className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                  {selectedClass.total_points} Punkte
                </div>
              </div>
              <button
                onClick={() => setSelectedClass(null)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1 rounded border border-[var(--border)]"
                title="Auswahl aufheben"
              >✕</button>
            </div>

            {/* Award form */}
            <div className="flex flex-col gap-3 px-4 py-4">
              {abGroups.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)] mr-0.5">Ziel:</span>
                  <button onClick={() => setAwardTarget(null)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      !awardTarget ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                    }`}>Alle</button>
                  {abGroups.map(g => (
                    <button key={g.id} onClick={() => setAwardTarget({ groupId: g.id, name: g.name })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        awardTarget?.groupId === g.id ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-transparent" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                      }`}>{g.name}</button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-5 gap-1">
                  {QUICK.map(q => (
                    <button key={q} onClick={() => setAmt(String(q))}
                      className={`py-2 text-xs rounded-lg border transition-colors font-medium ${
                        amt === String(q)
                          ? "bg-[var(--accent)] text-[var(--accent-text,#111)] border-[var(--accent)]"
                          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                      }`}>
                      +{q}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder="Andere Punktzahl…"
                  value={amt}
                  onChange={e => setAmt(e.target.value)}
                  className="input text-sm py-2"
                />
              </div>
              <input
                className="input text-sm py-2"
                placeholder="Grund (optional)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <button
                disabled={!amt || parseInt(amt) === 0 || txMut.isPending || groupAwardMut.isPending}
                onClick={() => award(selectedClass.id, parseInt(amt))}
                className="btn-primary text-sm py-2 disabled:opacity-40"
              >
                {(txMut.isPending || groupAwardMut.isPending) ? "…" : `+${amt || "?"} Punkte für ${awardTarget ? `Gruppe ${awardTarget.name}` : selectedClass.code}`}
              </button>
            </div>

            {/* Quick-switch: other classes */}
            {classes.length > 1 && (
              <div className="border-t border-[var(--border)] mt-auto">
                <p className="text-xs text-[var(--text-muted)] px-4 pt-3 pb-1">Andere Klassen</p>
                <ul className="divide-y divide-[var(--border)]">
                  {[...classes]
                    .filter(c => c.id !== selectedClass.id)
                    .sort((a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code))
                    .map(cls => (
                      <li key={cls.id}>
                        <button
                          onClick={() => { setSelectedClass(cls); setAmt(""); setReason(""); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] transition-colors text-left"
                        >
                          <ClassIcon cls={cls} size="1.25rem" />
                          <span className="flex-1 text-sm font-medium truncate">
                            {cls.code}
                            {cls.class_name && <span className="ml-1 text-[var(--text-muted)] font-normal">„{cls.class_name}"</span>}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{cls.total_points} Pkt</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          /* ── No class selected: class list ── */
          <div className="flex-1 overflow-y-auto">
            <button onClick={() => setClassesOpen(v => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors">
              🏫 Klassen {classesOpen ? "▲" : "▼"}
            </button>
            {classesOpen && (
              classes.length === 0 ? (
                <p className="px-4 pb-3 text-sm text-[var(--text-muted)]">Keine Klassen vorhanden.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {[...classes].sort((a, b) => b.total_points - a.total_points || a.code.localeCompare(b.code)).map(cls => (
                    <li key={cls.id}>
                      <button
                        onClick={() => setSelectedClass(cls)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors text-left"
                      >
                        <ClassIcon cls={cls} size="1.25rem" />
                        <span className="flex-1 font-semibold text-sm truncate">
                          {cls.code}
                          {cls.class_name && <span className="ml-1 text-[var(--text-muted)] font-normal">„{cls.class_name}"</span>}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{cls.total_points} Pkt</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            )}
            {GROUP_TABS.map(t => (
              <GroupAwardSection key={t.type} type={t.type} label={t.label} icon={t.icon} />
            ))}
          </div>
        )}
      </aside>

      {/* Transaction log modal */}
      {showLog && selectedClass && (
        <>
          <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={() => setShowLog(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]" style={{ zIndex: 70 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <span className="font-semibold text-sm">📋 Punkte-Log · {selectedClass.code}</span>
              <span className="text-xs text-[var(--text-muted)] mr-auto ml-3">{selectedClass.total_points} Pkt gesamt</span>
              <button onClick={() => setShowLog(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1">
              {txLog.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)] px-4 py-6 text-center">Keine Einträge.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left text-xs text-[var(--text-muted)] font-semibold px-4 py-2 w-16">Pkt</th>
                      <th className="text-left text-xs text-[var(--text-muted)] font-semibold px-2 py-2">Notiz</th>
                      {auth?.role === "admin" && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {txLog.map(tx => (
                      <tr key={tx.id} className="group hover:bg-[var(--surface-hover)]">
                        <td className={`px-4 py-2 font-bold tabular-nums text-sm w-16 ${tx.points >= 0 ? "text-green-500" : "text-red-400"}`}>
                          {tx.points >= 0 ? "+" : ""}{tx.points}
                        </td>
                        <td className="px-2 py-2 min-w-0">
                          {tx.reason && <div className="font-medium leading-snug text-xs">{tx.reason}</div>}
                          <div className="text-xs text-[var(--text-muted)]">
                            {tx.teacher_name} · {new Date(tx.ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </div>
                        </td>
                        {auth?.role === "admin" && (
                          <td className="pr-3 py-2">
                            <button
                              onClick={() => deleteTxMut.mutate(tx.id)}
                              disabled={deleteTxMut.isPending}
                              className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 px-1 py-0.5 rounded border border-red-400/40 transition-opacity"
                              title="Eintrag löschen"
                            >✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Points guide modal */}
      {showGuide && (
        <>
          <div className="fixed inset-0 bg-black/40" style={{ zIndex: 60 }} onClick={() => setShowGuide(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 max-w-[calc(100vw-2rem)] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]" style={{ zIndex: 70 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <span className="font-semibold text-sm">💡 Leitfaden: Punkte vergeben</span>
              <button onClick={() => setShowGuide(false)} className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              <p className="text-xs text-[var(--text-muted)] mb-1">
                Richtwerte – passe sie nach deinem Ermessen an. Gilt etwas für die ganze Klasse, nimm etwa <strong>den 10-fachen Wert</strong>.
              </p>
              {POINTS_GUIDE.map(g => (
                <button
                  key={g.pts}
                  onClick={() => { setAmt(String(g.pts)); setReason(g.label); setShowGuide(false); }}
                  className="text-left flex items-start gap-3 p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors group"
                >
                  <span className="font-bold text-[var(--accent)] tabular-nums w-12 shrink-0 text-sm pt-0.5">+{g.pts}</span>
                  <div>
                    <div className="font-semibold text-sm group-hover:text-[var(--accent)] transition-colors">{g.label}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">{g.detail}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );

  const loginFlyout = loginOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setLoginOpen(false)} />
      <aside className="fixed top-0 left-12 h-full w-64 z-50 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-muted)]">
            {auth ? (auth.teacher ? `${auth.teacher.first_name} ${auth.teacher.last_name}` : auth.student ? `${auth.student.vorname} ${auth.student.nachname}` : "Eingeloggt") : "Login"}
          </span>
          <button onClick={() => setLoginOpen(false)} className="text-[var(--text-muted)] hover:text-white text-lg leading-none">×</button>
        </div>
        <div className="flex flex-col gap-4 p-4">
          {!auth ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <input className="input" placeholder="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className="input" type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} />
              {loginError && <p className="text-red-400 text-xs">{loginError}</p>}
              <button type="submit" className="btn-primary">Einloggen</button>
            </form>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">
                  {auth.teacher
                    ? `${auth.teacher.first_name} ${auth.teacher.last_name}`
                    : auth.student
                    ? `${auth.student.vorname} ${auth.student.nachname}`
                    : ""}
                </p>
                <p className="text-xs text-[var(--text-muted)] capitalize">{auth.role}</p>
              </div>
              <hr className="border-[var(--border)]" />
              {auth.teacher?.klasse_id != null && (
                <Link
                  href="/klasse/verfuegbarkeit"
                  onClick={() => setLoginOpen(false)}
                  className="btn-secondary text-sm text-center"
                >
                  🧩 Verfügbarkeit ({auth.teacher.klasse})
                </Link>
              )}
              <button onClick={() => { authLogout(); setLoginOpen(false); }} className="btn-secondary text-sm">Logout</button>
            </>
          )}
        </div>
      </aside>
    </>
  );

  return (
    <>
      {iconStrip}
      {pointsFlyout}
      {loginFlyout}
    </>
  );
}
