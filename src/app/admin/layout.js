"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  emitSessionChange,
  useAdminSession,
  useHydrated,
} from "../../lib/clientSession";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: "📊" },
  { name: "Businesses", href: "/admin/businesses", icon: "🏢" },
  { name: "Users", href: "/admin/users", icon: "👥" },
  { name: "Invoices", href: "/admin/invoices", icon: "📄" },
  { name: "Payments", href: "/admin/payments", icon: "💰" },
  { name: "Settings", href: "/admin/settings", icon: "⚙️" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { adminToken } = useAdminSession();
  const isLoginPage = pathname === "/admin/login";
  const isHydrated = useHydrated();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoginPage && !adminToken) {
      router.replace("/admin/login");
    }
  }, [adminToken, isHydrated, isLoginPage, router]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    emitSessionChange();
    router.replace("/admin/login");
  };

  if (isLoginPage) {
    return children;
  }

  if (!isHydrated || !adminToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-slate-950 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="font-bold text-lg text-white">BackOffice</h1>
          <p className="text-xs text-slate-500 mt-0.5">Platform Admin</p>
        </div>

        <nav className="p-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-1 transition-all text-sm ${
                  isActive
                    ? "bg-white text-slate-900 font-medium"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-red-400 hover:bg-red-950/50 transition-all text-sm"
          >
            <span className="text-lg">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
