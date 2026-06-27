"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EmptyState,
  InputField,
  PageHeader,
  PageShell,
  SelectField,
  StatCard,
  StatGrid,
  StatusBadge,
  SurfaceCard,
  Toolbar,
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";

function getSourceLabel(entry) {
  if (entry.type === "quick-pay-session") return "QR Session";
  return entry.source === "qr" ? "QR Invoice" : "Invoice";
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "green";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";
  return "slate";
}

function getNotificationTone(status) {
  const normalized = String(
    status === "pending-whatsapp" ? "prepared" : status || ""
  ).toLowerCase();
  if (normalized === "prepared") return "green";
  if (normalized === "draft") return "blue";
  if (normalized === "unavailable") return "slate";
  return "slate";
}

function normalizeNotificationStatus(status) {
  return status === "pending-whatsapp" ? "prepared" : status || "draft";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function Payments() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const invoiceRes = await authFetch("/api/invoices");

        const invoiceData = invoiceRes.ok ? await invoiceRes.json() : [];

        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      } catch (error) {
        console.error("Failed to load payments", error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    const initialLoad = setTimeout(loadPayments, 0);
    return () => clearTimeout(initialLoad);
  }, []);

  const historyRows = useMemo(() => {
    const invoiceRows = invoices
      .filter((invoice) => String(invoice.status || "").toLowerCase() === "paid")
      .map((invoice) => {
      const source = invoice.quickPayProfileId ? "qr" : "invoice";
      const customerName =
        invoice.customer || invoice.customerName || invoice.student || "Customer";

      return {
        id: `invoice-${invoice._id}`,
        type: "invoice",
        source,
        customerName,
        description:
          invoice.description || invoice.category || invoice.class || "Invoice payment",
        amount: Number(invoice.paidAmount || invoice.amount || 0),
        status: "Paid",
        notificationStatus: normalizeNotificationStatus(invoice.customerNotificationStatus),
        provider:
          invoice.paymentProvider ||
          invoice.pendingPaymentProvider ||
          (source === "qr" ? "Monnify" : "Manual"),
        reference:
          invoice.paymentReference || invoice.pendingPaymentReference || invoice.invoiceNumber || "-",
        phone: invoice.phone || "",
        invoiceNumber: invoice.invoiceNumber || "-",
        token: invoice.token || "",
        happenedAt:
          invoice.paidAt ||
          invoice.paymentConfirmedAt ||
          invoice.pendingPaymentCreatedAt ||
          invoice.date ||
          invoice.createdAt,
      };
    });

    return [...invoiceRows].sort(
      (a, b) => new Date(b.happenedAt || 0) - new Date(a.happenedAt || 0)
    );
  }, [invoices]);

  const filteredRows = historyRows.filter((row) => {
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [
        row.customerName,
        row.description,
        row.reference,
        row.invoiceNumber,
        row.phone,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesSource = sourceFilter === "all" || row.source === sourceFilter;
    const matchesStatus =
      statusFilter === "all" || String(row.status || "").toLowerCase() === statusFilter;
    const matchesNotification =
      notificationFilter === "all" ||
      String(row.notificationStatus || "").toLowerCase() === notificationFilter;

    return matchesSearch && matchesSource && matchesStatus && matchesNotification;
  });

  const totalCollected = filteredRows
    .filter((row) => String(row.status || "").toLowerCase() === "paid")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pendingCount = filteredRows.filter(
    (row) => String(row.status || "").toLowerCase() === "pending"
  ).length;
  const preparedNotifications = filteredRows.filter(
    (row) => String(row.notificationStatus || "").toLowerCase() === "prepared"
  ).length;

  return (
    <PageShell>
      <PageHeader
        title="Payment history"
        description="Track invoice payments, QR sessions, confirmation status, and notification readiness from one view."
      />

      <StatGrid>
        <StatCard
          label="Collected"
          value={`N${totalCollected.toLocaleString()}`}
          tone="emerald"
        />
        <StatCard label="History rows" value={filteredRows.length} tone="slate" />
        <StatCard label="Pending items" value={pendingCount} tone="orange" />
        <StatCard
          label="Prepared receipts"
          value={preparedNotifications}
          tone="blue"
        />
      </StatGrid>

      <Toolbar>
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InputField
            type="text"
            placeholder="Search customer, phone, reference..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <SelectField
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">All sources</option>
            <option value="invoice">Invoice</option>
            <option value="qr">QR</option>
          </SelectField>
          <SelectField
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="unpaid">Unpaid</option>
            <option value="failed">Failed</option>
          </SelectField>
          <SelectField
            value={notificationFilter}
            onChange={(event) => setNotificationFilter(event.target.value)}
          >
            <option value="all">All notifications</option>
            <option value="prepared">Prepared</option>
            <option value="draft">Draft</option>
            <option value="unavailable">Unavailable</option>
          </SelectField>
        </div>
      </Toolbar>

      <SurfaceCard className="overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">Loading payment history...</div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No payment history matches these filters"
            description="Try clearing one or two filters to widen the view."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 lg:hidden">
              {filteredRows.map((row) => (
                <div key={row.id} className="space-y-4 p-4 sm:p-5">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{row.customerName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="slate">{getSourceLabel(row)}</StatusBadge>
                      {row.phone ? <span className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</span> : null}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Description
                      </p>
                      <p className="text-sm text-slate-800 dark:text-slate-300">{row.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Invoice: {row.invoiceNumber || "-"}</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        N{Number(row.amount || 0).toLocaleString()}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={getStatusTone(row.status)}>
                          {row.status || "Unknown"}
                        </StatusBadge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{row.provider || "-"}</span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(row.happenedAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={getNotificationTone(row.notificationStatus)}>
                      {row.notificationStatus || "-"}
                    </StatusBadge>
                    <p className="break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                      {row.reference || "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Notification
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reference
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{row.customerName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone="slate">{getSourceLabel(row)}</StatusBadge>
                          {row.phone ? <span className="text-xs text-slate-500 dark:text-slate-400">{row.phone}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-800 dark:text-slate-300">{row.description}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Invoice: {row.invoiceNumber || "-"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          N{Number(row.amount || 0).toLocaleString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={getStatusTone(row.status)}>
                            {row.status || "Unknown"}
                          </StatusBadge>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{row.provider || "-"}</span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(row.happenedAt)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <StatusBadge tone={getNotificationTone(row.notificationStatus)}>
                        {row.notificationStatus || "-"}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-5 align-top">
                      <p className="max-w-[14rem] break-all font-mono text-xs text-slate-500 dark:text-slate-400">
                        {row.reference || "-"}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </SurfaceCard>
    </PageShell>
  );
}
