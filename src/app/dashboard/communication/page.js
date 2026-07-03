"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EmptyState,
  PageHeader,
  PageShell,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";

export default function CommunicationPage() {
  const [bridgeStatus, setBridgeStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [sendingBulk, setSendingBulk] = useState(false);
  const [message, setMessage] = useState("");
  const [messageContext, setMessageContext] = useState("");
  const [error, setError] = useState("");

  const connected = bridgeStatus?.bridgeReachable === true && bridgeStatus?.status?.status === "ready";
  const qrDataUrl = bridgeStatus?.status?.qrDataUrl || "";
  const connectedNumber = bridgeStatus?.status?.connectedNumber || "";
  const currentStatus = bridgeStatus?.status?.status || "unknown";
  const groupedCategories = customers.reduce((acc, customer) => {
    const category = customer.category || "Uncategorized";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const categories = Object.keys(groupedCategories).sort((a, b) => a.localeCompare(b));
  const selectedCategoryCount = bulkCategory ? groupedCategories[bulkCategory] || 0 : 0;

  const loadBridgeStatus = async () => {
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bridge/status");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to load WhatsApp status");
      }

      setBridgeStatus(data);
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (statusError) {
      setBridgeStatus({
        bridgeReachable: false,
        status: {
          status: "offline",
          connectedNumber: "",
          lastError: statusError.message || "Unable to load WhatsApp status",
        },
      });
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await authFetch("/api/customers");
      const data = res.ok ? await res.json() : [];
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadBridgeStatus();
      loadCustomers();
    }, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const sendTestMessage = async (event) => {
    event.preventDefault();
    setTesting(true);
    setMessage("");
    setMessageContext("test");
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to send test message");
      }

      setMessage("Test WhatsApp message sent.");
      setTestPhone("");
      loadBridgeStatus();
    } catch (testError) {
      setError(testError.message || "Unable to send test message");
    } finally {
      setTesting(false);
    }
  };

  const sendBulkMessage = async (event) => {
    event.preventDefault();
    setSendingBulk(true);
    setMessage("");
    setMessageContext("bulk");
    setError("");

    try {
      const res = await authFetch("/api/notifications/whatsapp/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: bulkCategory,
          message: bulkMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to send bulk message");
      }

      setMessage("Message sent.");
      loadBridgeStatus();
    } catch (bulkError) {
      setError(bulkError.message || "Unable to send bulk message");
    } finally {
      setSendingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Communication"
        description="Monitor WhatsApp delivery, reconnect the bridge, and send a test message."
        actions={
          <button
            type="button"
            onClick={loadBridgeStatus}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refresh status
          </button>
        }
      />

      <StatGrid className="xl:!grid-cols-3">
        <StatCard
          label="WhatsApp status"
          value={connected ? "Connected" : "Disconnected"}
          tone={connected ? "emerald" : "orange"}
        />
        <StatCard label="Connected number" value={connectedNumber || "-"} tone="slate" />
        <StatCard label="Recent activity" value={logs.length} tone="blue" />
      </StatGrid>

      <div className="grid gap-4 xl:grid-cols-3">
        <SurfaceCard className="p-6 xl:col-span-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                WhatsApp bridge
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={connected ? "green" : "orange"}>
                  {connected ? "Connected" : "Disconnected"}
                </StatusBadge>
                <span className="text-sm text-slate-500">Status: {currentStatus}</span>
              </div>
              {bridgeStatus?.status?.lastError ? (
                <p className="mt-3 break-all text-sm text-red-600">
                  {bridgeStatus.status.lastError}
                </p>
              ) : null}
            </div>

            <Link
              href="/dashboard/settings"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open settings
            </Link>
          </div>

          {!connected && qrDataUrl ? (
            <div className="mt-6 inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
              <Image
                src={qrDataUrl}
                alt="WhatsApp QR code"
                width={180}
                height={180}
                unoptimized
                className="h-44 w-44"
              />
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Send test message
          </h2>
          <form onSubmit={sendTestMessage} className="mt-4 space-y-3">
            <input
              type="tel"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              placeholder="2348012345678"
              required
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={testing}
              className="w-full rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20BA5C] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {testing ? "Sending..." : "Send test"}
            </button>
          </form>
          {message && messageContext === "test" ? (
            <p className="mt-3 text-sm text-emerald-700">{message}</p>
          ) : null}
          {error && messageContext === "test" ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Bulk category message
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a category and send one WhatsApp message to every saved phone number in that group.
          </p>
        </div>

        <form onSubmit={sendBulkMessage} className="mt-5 grid gap-4 lg:grid-cols-[16rem_1fr_auto] lg:items-start">
          <div>
            <label htmlFor="bulk-category" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Category
            </label>
            <select
              id="bulk-category"
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category} ({groupedCategories[category]})
                </option>
              ))}
            </select>
            {bulkCategory ? (
              <p className="mt-2 text-xs text-slate-500">
                {selectedCategoryCount} recipient{selectedCategoryCount === 1 ? "" : "s"} in this category.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="bulk-message" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Message
            </label>
            <textarea
              id="bulk-message"
              value={bulkMessage}
              onChange={(event) => setBulkMessage(event.target.value)}
              required
              rows={4}
              placeholder="Type the message to send..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={sendingBulk || !connected}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 lg:mt-7"
          >
            {sendingBulk ? "Sending..." : "Send bulk"}
          </button>
        </form>

        {message && messageContext === "bulk" ? (
          <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p>
        ) : null}
        {error && messageContext === "bulk" ? (
          <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        {logs.length === 0 ? (
          <EmptyState
            title="No recent communication activity"
            description="Sent WhatsApp messages will appear here when the bridge records activity."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log, index) => (
              <div key={`${log.createdAt || index}-${log.to || ""}`} className="p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {log.to || "Unknown recipient"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{log.preview || "-"}</p>
                  </div>
                  <StatusBadge tone={log.status === "sent" ? "green" : "orange"}>
                    {log.status || "pending"}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
