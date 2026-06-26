"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NAV: { tab: string; icon: string; label: string; href: string }[] = [
  { tab: "home",      icon: "🏠", label: "Hauspokal",   href: "/" },
  { tab: "caputh",    icon: "🎮", label: "Caputh",       href: "/capuths" },
  { tab: "wettkampf", icon: "🏆", label: "Wettkämpfe",  href: "/wettkampf" },
  { tab: "haeuser",   icon: "🏛️", label: "Häuser",       href: "/haeuser" },
];

export function Sidebar({ iconOnly = false }: { iconOnly?: boolean }) {
  const { auth, login, logout } = useAuth();
  const pathname = usePathname();
  const [loginOpen, setLoginOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

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

  const iconStrip = (
    <div className="flex flex-col items-center w-12 py-2 bg-[var(--surface)] border-r border-[var(--border)] shrink-0 z-30 relative">
      <div className="flex flex-col items-center gap-1">
        {NAV.map(({ tab, icon, label, href }) => (
          <Link key={tab} href={href} title={label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors
              ${isActive(href) ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
            {icon}
          </Link>
        ))}
      </div>
      <div className="mt-auto mb-1">
        <button
          suppressHydrationWarning
          title={auth ? `${auth.teacher.first_name} ${auth.teacher.last_name}` : "Login"}
          onClick={() => setLoginOpen(o => !o)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-colors
            ${loginOpen ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"}`}>
          {auth ? "👤" : "🔑"}
        </button>
      </div>
    </div>
  );

  const loginFlyout = loginOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setLoginOpen(false)} />
      <aside className="fixed top-0 left-12 h-full w-64 z-50 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="text-sm font-semibold text-[var(--text-muted)]">
            {auth ? `${auth.teacher.first_name} ${auth.teacher.last_name}` : "Login"}
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
                <p className="text-sm font-semibold">{auth.teacher.first_name} {auth.teacher.last_name}</p>
                <p className="text-xs text-[var(--text-muted)] capitalize">{auth.teacher.role}</p>
              </div>
              <hr className="border-[var(--border)]" />
              <button onClick={() => { logout(); setLoginOpen(false); }} className="btn-secondary text-sm">Logout</button>
            </>
          )}
        </div>
      </aside>
    </>
  );

  return (
    <>
      {iconStrip}
      {loginFlyout}
    </>
  );
}
