"use client";

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
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getOutstandingAmount(invoice) {
  const amount = Number(invoice.amount || 0);
  const paidAmount = Number(invoice.paidAmount || 0);
  const balanceDue = Number(invoice.balanceDue || 0);

  if (balanceDue > 0) {
    return balanceDue;
  }

  if (paidAmount > 0) {
    return Math.max(amount - paidAmount, 0);
  }

  return amount;
}

function normalizeNotificationStatus(status) {
  return status === "pending-whatsapp" ? "prepared" : status || "draft";
}

function getNotificationTone(status) {
  const normalized = normalizeNotificationStatus(status);

  if (normalized === "prepared") return "green";
  if (normalized === "draft") return "blue";
  return "slate";
}

export default function Invoices() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminders, setSendingReminders] = useState(false);

  const loadData = async () => {
    try {
      const res = await authFetch("/api/invoices");
      const data = res.ok ? await res.json() : [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialLoad = setTimeout(loadData, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const markPaid = async (id) => {
    setInvoices((prev) =>
      prev.map((inv) => (String(inv._id) === String(id) ? { ...inv, status: "Paid" } : inv))
    );

    try {
      const res = await authFetch(`/api/invoices/${id}`, { method: "PUT" });
      if (!res.ok) {
        throw new Error("Update failed");
      }
      loadData();
    } catch {
      loadData();
    }
  };

  const deleteInvoice = async (id) => {
    if (!confirm("Delete this invoice?")) return;

    try {
      const res = await authFetch(`/api/invoices/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Delete failed");
        return;
      }

      setInvoices((prev) => prev.filter((invoice) => String(invoice._id) !== String(id)));
    } catch {
      alert("Error deleting invoice");
    }
  };

  const shareWhatsApp = async (invoice) => {
    if (!invoice.phone) {
      alert("No phone number");
      return;
    }

    if (!invoice.token) {
      alert("This invoice does not have a payment link yet");
      return;
    }

    try {
      const res = await authFetch("/api/notifications/whatsapp/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: String(invoice._id),
          origin: window.location.origin,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to prepare WhatsApp message");
      }

      if (data?.delivery?.fallbackUrl) {
        window.open(data.delivery.fallbackUrl, "_blank");
      } else {
        alert("Sent.");
      }
    } catch (error) {
      alert(error.message || "Unable to share invoice");
    }
  };

  const sendBulkReminders = async () => {
    if (actionableInvoices.length === 0) {
      alert("There are no unpaid invoices to remind.");
      return;
    }

    setSendingReminders(true);

    try {
      const res = await authFetch("/api/notifications/whatsapp/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: window.location.origin,
          force: true,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to send reminders");
      }

      if (Array.isArray(data.fallbackDeliveries)) {
        data.fallbackDeliveries.forEach((delivery) => {
          if (delivery.fallbackUrl) {
            window.open(delivery.fallbackUrl, "_blank");
          }
        });
      }

      alert(
        `Reminders processed: ${data.processedCount}\nSent through WhatsApp provider: ${data.sentCount}\nOpened in WhatsApp manually: ${data.fallbackCount}\nSkipped: ${data.skippedCount}\nCooldown skipped: ${data.cooldownSkippedCount || 0}\nDaily cap skipped: ${data.cappedSkippedCount || 0}`
      );

      loadData();
    } catch (error) {
      alert(error.message || "Unable to send reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  const actionableInvoices = invoices.filter((invoice) => getOutstandingAmount(invoice) > 0);
  const totalAmount = actionableInvoices.reduce(
    (sum, invoice) => sum + Number(getOutstandingAmount(invoice) || 0),
    0
  );
  const unpaidCount = actionableInvoices.length;
  const preparedNotifications = actionableInvoices.filter(
    (invoice) =>
      normalizeNotificationStatus(invoice.customerNotificationStatus) === "prepared"
  ).length;

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
        title="Invoices"
        description={`Manage invoices, payment readiness, and ${customerLabels.singular} sharing from one compact view.`}
        actions={
          <button
            type="button"
            onClick={sendBulkReminders}
            disabled={sendingReminders || actionableInvoices.length === 0}
            className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20BA5C] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {sendingReminders ? "Sending reminders..." : "Remind all unpaid"}
          </button>
        }
      />

      <StatGrid>
        <StatCard label="Total invoices" value={actionableInvoices.length} tone="slate" />
        <StatCard label="Total amount" value={`N${totalAmount.toLocaleString()}`} tone="blue" />
        <StatCard label="Unpaid" value={unpaidCount} tone="orange" />
        <StatCard label="Prepared receipts" value={preparedNotifications} tone="emerald" />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        {actionableInvoices.length === 0 ? (
          <EmptyState
            title="No open invoices found"
            description="Only unpaid or partially paid invoices are shown here."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 lg:hidden">
              {actionableInvoices.map((invoice) => {
                const customerName =
                  invoice.customer || invoice.customerName || invoice.student || customerLabels.singularTitle;

                return (
                  <div key={invoice._id} className="space-y-4 p-4 sm:p-5">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {invoice.invoiceNumber || "-"}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(invoice.date)}</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Details
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {invoice.description || invoice.category || invoice.class || "-"}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Phone: {invoice.phone || "-"}</p>
                        <p className="break-all font-mono text-xs text-slate-400 dark:text-slate-500">
                          {invoice.token ? `${invoice.token.substring(0, 14)}...` : "-"}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Payment
                        </p>
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          N{Number(getOutstandingAmount(invoice) || 0).toLocaleString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={invoice.status === "Paid" ? "green" : "orange"}>
                            {invoice.status || "Unpaid"}
                          </StatusBadge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {invoice.paymentProvider ||
                              invoice.pendingPaymentProvider ||
                              "Not started"}
                          </span>
                        </div>
                        <StatusBadge tone={getNotificationTone(invoice.customerNotificationStatus)}>
                          {normalizeNotificationStatus(invoice.customerNotificationStatus)}
                        </StatusBadge>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {invoice.status !== "Paid" ? (
                        <button
                          onClick={() => markPaid(invoice._id)}
                          className="rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                        >
                          Mark paid
                        </button>
                      ) : null}
                      <button
                        onClick={() => shareWhatsApp(invoice)}
                        className="rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#20BA5C]"
                      >
                        Share on WhatsApp
                      </button>
                      <button
                        onClick={() => deleteInvoice(invoice._id)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Invoice
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Notification
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {actionableInvoices.map((invoice) => {
                  const customerName =
                    invoice.customer || invoice.customerName || invoice.student || customerLabels.singularTitle;

                  return (
                    <tr key={invoice._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {invoice.invoiceNumber || "-"}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(invoice.date)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-2">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {invoice.description || invoice.category || invoice.class || "-"}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Phone: {invoice.phone || "-"}</p>
                          <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                            {invoice.token ? `${invoice.token.substring(0, 14)}...` : "-"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            N{Number(getOutstandingAmount(invoice) || 0).toLocaleString()}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={invoice.status === "Paid" ? "green" : "orange"}>
                              {invoice.status || "Unpaid"}
                            </StatusBadge>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {invoice.paymentProvider ||
                                invoice.pendingPaymentProvider ||
                                "Not started"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <StatusBadge tone={getNotificationTone(invoice.customerNotificationStatus)}>
                          {normalizeNotificationStatus(invoice.customerNotificationStatus)}
                        </StatusBadge>
                      </td>
                      <td className="px-6 py-5 align-top">
                        <div className="ml-auto flex max-w-[22rem] flex-wrap items-center justify-end gap-2">
                          {invoice.status !== "Paid" && (
                            <button
                              onClick={() => markPaid(invoice._id)}
                              className="whitespace-nowrap rounded-xl bg-green-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                            >
                              Mark paid
                            </button>
                          )}
                          <button
                            onClick={() => shareWhatsApp(invoice)}
                            className="whitespace-nowrap rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#20BA5C]"
                          >
                            Share on WhatsApp
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice._id)}
                            className="whitespace-nowrap rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
