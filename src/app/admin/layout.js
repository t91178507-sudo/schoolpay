"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiBriefcase,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import {
  emitSessionChange,
  useAdminSession,
  useHydrated,
} from "../../lib/clientSession";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;

const navItems = [
  { name: "Dashboard", href: "/admin", icon: FiGrid },
  { name: "Businesses", href: "/admin/businesses", icon: FiBriefcase },
  { name: "Verification", href: "/admin/verifications", icon: FiShield },
  { name: "Users", href: "/admin/users", icon: FiUsers },
  { name: "Invoices", href: "/admin/invoices", icon: FiFileText },
  { name: "Payments", href: "/admin/payments", icon: FiCreditCard },
  { name: "Credit Words", href: "/admin/reconciliation-words", icon: FiFileText },
  { name: "Settings", href: "/admin/settings", icon: FiSettings },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdminLoggedIn } = useAdminSession();
  const isLoginPage = pathname === "/admin/login";
  const isHydrated = useHydrated();

  const handleLogout = useCallback(() => {
    fetch("/api/admin/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    localStorage.removeItem("isAdminLoggedIn");
    emitSessionChange();
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoginPage && !isAdminLoggedIn) {
      router.replace("/admin/login");
    }
  }, [isAdminLoggedIn, isHydrated, isLoginPage, router]);

  useEffect(() => {
    if (!isHydrated || isLoginPage || !isAdminLoggedIn) {
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
  }, [isAdminLoggedIn, handleLogout, isHydrated, isLoginPage]);

  if (isLoginPage) {
    return children;
  }

  if (!isHydrated || !isAdminLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 p-6">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white">
              IH
            </span>
            <span>
              <span className="block text-lg font-bold text-white">InvoiceHub</span>
              <span className="text-xs font-medium text-slate-400">Platform administration</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    isActive ? "bg-blue-50 text-blue-700" : "bg-slate-900 text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-red-300 transition-all hover:bg-red-950/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-950/50">
              <FiLogOut className="h-4 w-4" />
            </span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-8 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Secure admin console
              </p>
              <p className="mt-1 text-sm font-medium text-slate-700">
                Manage platform operations, verification, billing, and message delivery.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Admin session active
            </span>
          </div>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
