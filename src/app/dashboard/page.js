"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  SurfaceCard,
} from "../../components/DashboardUI";
import { authFetch } from "../../lib/authFetch";
import { useBusinessSession } from "../../lib/clientSession";

export default function Dashboard() {
  const session = useBusinessSession();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [customersRes, invoicesRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
        ]);

        const customers = customersRes.ok ? await customersRes.json() : [];
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];

        const totalRevenue = invoices
          .filter((invoice) => invoice.status === "Paid")
          .reduce((sum, inv) => sum + Number(inv.paidAmount || inv.amount || 0), 0);

        const paid = invoices.filter((inv) => inv.status === "Paid").length;
        const unpaid = invoices.length - paid;

        setStats({
          totalCustomers: customers.length,
          totalRevenue,
          paidInvoices: paid,
          unpaidInvoices: unpaid,
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedDate =
    currentTime?.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) || "";

  const formattedTime =
    currentTime?.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }) || "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={`Welcome, ${session.businessName || "Your Business"}`}
        description={currentTime ? `${formattedDate} | ${formattedTime}` : ""}
      />

      <StatGrid>
        <StatCard label="Total Customers" value={stats.totalCustomers} tone="blue" />
        <StatCard
          label="Collected Revenue"
          value={`N${stats.totalRevenue.toLocaleString()}`}
          tone="emerald"
        />
        <StatCard label="Paid Invoices" value={stats.paidInvoices} tone="emerald" />
        <StatCard label="Pending Invoices" value={stats.unpaidInvoices} tone="orange" />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceCard className="p-6 xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Collections snapshot</h2>
          <p className="mt-2 text-sm text-slate-500">
            InvoiceHub is now tracking invoices, QR payment sessions, and confirmation states in one workflow. Use the history pages to monitor payment completion and notification readiness.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="space-y-3 text-sm">
            <QuickLink href="/dashboard/invoices" label="Manage invoices" />
            <QuickLink href="/dashboard/payments" label="Open payment history" />
          </div>
        </SurfaceCard>
      </div>
    </PageShell>
  );
}

function QuickLink({ href, label }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span>{label}</span>
      <span className="text-slate-400">Open</span>
    </Link>
  );
}
