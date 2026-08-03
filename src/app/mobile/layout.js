"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FiCode,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import { emitSessionChange, useBusinessSession, useHydrated } from "../../lib/clientSession";

const navItems = [
  { href: "/mobile", label: "Home", icon: FiGrid },
  { href: "/mobile/payments", label: "Payments", icon: FiCreditCard },
  { href: "/mobile/invoices", label: "Invoices", icon: FiFileText },
  { href: "/mobile/qr", label: "QR", icon: FiCode },
  { href: "/mobile/customers", label: "Customers", icon: FiUsers },
  { href: "/mobile/profile", label: "Profile", icon: FiUser },
];

export default function MobileLayout({ children }) {
  const session = useBusinessSession();
  const isHydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!session.isLoggedIn) {
      router.replace("/auth/login");
      return;
    }

    if (session.accountType !== "staff") {
      router.replace("/dashboard");
    }
  }, [isHydrated, pathname, router, session.accountType, session.isLoggedIn]);

  const logout = () => {
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => {});
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPhone");
    localStorage.removeItem("username");
    localStorage.removeItem("businessName");
    localStorage.removeItem("businessType");
    localStorage.removeItem("businessLogo");
    localStorage.removeItem("role");
    localStorage.removeItem("roleKey");
    localStorage.removeItem("accountType");
    localStorage.removeItem("ownerId");
    localStorage.removeItem("assignedBusinesses");
    localStorage.removeItem("assignedAllBusinesses");
    localStorage.removeItem("permissions");
    emitSessionChange();
    router.replace("/auth/login");
  };

  if (!isHydrated || !session.isLoggedIn || session.accountType !== "staff") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
              {session.role || "Staff"}
            </p>
            <h1 className="mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
              {session.businessName || "Business"}
            </h1>
          </div>
          <button
            onClick={logout}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-900"
          >
            <FiLogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-3 pb-28 pt-4 sm:px-4 sm:pt-5">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/80 bg-slate-950/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-[74px] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-[10px] font-semibold transition ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
