"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { emitSessionChange, useBusinessSession, useHydrated } from "../../lib/clientSession";

const navItems = [
  { href: "/mobile", label: "Home" },
  { href: "/mobile/payments", label: "Payments" },
  { href: "/mobile/invoices", label: "Invoices" },
  { href: "/mobile/qr", label: "QR Code" },
  { href: "/mobile/customers", label: "Customers" },
  { href: "/mobile/profile", label: "Profile" },
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
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {session.role || "Staff"}
            </p>
            <h1 className="text-lg font-semibold text-white">
              {session.businessName || "Business"}
            </h1>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="px-4 pb-28 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 py-2 backdrop-blur">
        <div className="grid grid-cols-6 gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-2xl px-2 py-3 text-center text-[11px] font-medium ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-400"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
