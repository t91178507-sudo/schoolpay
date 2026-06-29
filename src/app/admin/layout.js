"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  emitSessionChange,
  useAdminSession,
  useHydrated,
} from "../../lib/clientSession";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

const navItems = [
  { name: "Dashboard", href: "/admin", label: "OV" },
  { name: "Businesses", href: "/admin/businesses", label: "BIZ" },
  { name: "Users", href: "/admin/users", label: "USR" },
  { name: "Invoices", href: "/admin/invoices", label: "INV" },
  { name: "Payments", href: "/admin/payments", label: "PAY" },
  { name: "Settings", href: "/admin/settings", label: "SET" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { adminToken } = useAdminSession();
  const isLoginPage = pathname === "/admin/login";
  const isHydrated = useHydrated();

  const handleLogout = useCallback(() => {
    localStorage.removeItem("adminToken");
    emitSessionChange();
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoginPage && !adminToken) {
      router.replace("/admin/login");
    }
  }, [adminToken, isHydrated, isLoginPage, router]);

  useEffect(() => {
    if (!isHydrated || isLoginPage || !adminToken) {
      return;
    }

    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT_MS);
    };

    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [adminToken, handleLogout, isHydrated, isLoginPage]);

  if (isLoginPage) {
    return children;
  }

  if (!isHydrated || !adminToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="flex w-64 flex-col bg-slate-950">
        <div className="border-b border-slate-800 p-6">
          <h1 className="text-lg font-bold text-white">BackOffice</h1>
          <p className="mt-0.5 text-xs text-slate-500">Platform Admin</p>
        </div>

        <nav className="flex-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all ${
                  isActive
                    ? "bg-white font-medium text-slate-900"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="w-8 rounded-md bg-slate-900 px-1.5 py-1 text-center text-[10px] font-semibold text-slate-400">
                  {item.label}
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-red-400 transition-all hover:bg-red-950/50"
          >
            <span className="w-8 rounded-md bg-red-950/50 px-1.5 py-1 text-center text-[10px] font-semibold text-red-300">
              OUT
            </span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
