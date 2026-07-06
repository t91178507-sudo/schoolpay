"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  SurfaceCard,
} from "../../components/DashboardUI";
import { authFetch } from "../../lib/authFetch";
import { getCustomerLabels } from "../../lib/businessLabels";
import { useBusinessSession } from "../../lib/clientSession";

export default function Dashboard() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    expectedRevenue: 0,
    totalRevenue: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState({
    connected: false,
    label: "Disconnected",
    number: "",
    status: "",
    qrConnectUrl: "",
    qrDataUrl: "",
    lastError: "",
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [customersRes, invoicesRes, whatsAppRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
          authFetch("/api/notifications/whatsapp/bridge/status").catch(() => null),
        ]);

        const customers = customersRes.ok ? await customersRes.json() : [];
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];
        const whatsAppData = whatsAppRes?.ok ? await whatsAppRes.json() : null;
        const bridgeStatus = whatsAppData?.status || {};
        const connected = whatsAppData?.bridgeReachable === true && bridgeStatus.status === "ready";

        const expectedRevenue = invoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const totalRevenue = invoices
          .filter((invoice) => invoice.status === "Paid")
          .reduce((sum, inv) => sum + Number(inv.paidAmount || inv.amount || 0), 0);

        const paid = invoices.filter((inv) => inv.status === "Paid").length;
        const unpaid = invoices.length - paid;

        setStats({
          totalCustomers: customers.length,
          expectedRevenue,
          totalRevenue,
          paidInvoices: paid,
          unpaidInvoices: unpaid,
        });
        setWhatsAppStatus({
          connected,
          label: connected ? "Connected" : "Disconnected",
          number: connected ? bridgeStatus.connectedNumber || "" : "",
          status: bridgeStatus.status || "",
          qrConnectUrl: bridgeStatus.qrConnectUrl || "",
          qrDataUrl: bridgeStatus.qrDataUrl || "",
          lastError: bridgeStatus.lastError || "",
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
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
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
        <StatCard label={`Total ${customerLabels.pluralTitle}`} value={stats.totalCustomers} tone="blue" />
        <StatCard
          label="Expected Revenue"
          value={`N${stats.expectedRevenue.toLocaleString()}`}
          tone="violet"
        />
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Collections snapshot</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            InvoiceHub is now tracking invoices, QR payment sessions, and confirmation states in one workflow. Use the history pages to monitor payment completion and notification readiness.
          </p>
          {!whatsAppStatus.connected ? (
            <div className="mt-5">
              {whatsAppStatus.qrDataUrl ? (
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                  <Image
                    src={whatsAppStatus.qrDataUrl}
                    alt="WhatsApp QR code"
                    width={160}
                    height={160}
                    unoptimized
                    className="h-40 w-40"
                  />
                </div>
              ) : (
                <Link
                  href="/dashboard/settings"
                  className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  Open WhatsApp settings
                </Link>
              )}
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                WhatsApp connection
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    whatsAppStatus.connected
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {whatsAppStatus.label}
                </span>
                {whatsAppStatus.number ? (
                  <span className="text-xs text-slate-500">{whatsAppStatus.number}</span>
                ) : null}
              </div>
              {!whatsAppStatus.connected && whatsAppStatus.status ? (
                <p className="mt-2 text-xs text-slate-500">
                  Bridge status: {whatsAppStatus.status}
                </p>
              ) : null}
            </div>
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
