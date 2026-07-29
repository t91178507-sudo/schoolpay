"use client";

import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
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
} from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

function getSourceLabel(entry) {
  if (entry.type === "quick-pay-session") return "QR Session";
  return entry.source === "qr" ? "QR Invoice" : "Invoice";
}

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") return "green";
  if (normalized === "partially paid" || normalized === "partial") return "blue";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";

  return "slate";
}

function normalizeNotificationStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (["sent", "prepared", "delivered", "success"].includes(normalized)) {
    return "sent";
  }

  if (["failed", "error", "unavailable"].includes(normalized)) {
    return "failed";
  }

  return "pending";
}

function resolveNotificationStatus(transaction = {}, invoice = {}) {
  const invoiceStatus =
    String(invoice.lastReminderOutcome || "").toLowerCase() === "sent"
      ? "sent"
      : invoice.customerNotificationStatus;

  if (normalizeNotificationStatus(invoiceStatus) === "sent") {
    return "sent";
  }

  return normalizeNotificationStatus(
    transaction.notificationStatus ||
      transaction.customerNotificationStatus ||
      invoiceStatus
  );
}

function getNotificationTone(status) {
  const normalized = normalizeNotificationStatus(status);

  if (normalized === "sent") return "green";
  if (normalized === "pending") return "orange";
  if (normalized === "failed") return "red";

  return "slate";
}

function formatNotificationStatus(status) {
  const normalized = normalizeNotificationStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function buildGeneratedTransactionId(seed = "", happenedAt = "", index = 0) {
  const normalizedDate = happenedAt
    ? formatDateInput(happenedAt).replaceAll("-", "")
    : "00000000";
  const normalizedSeed = String(seed || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `TXN-${normalizedDate}-${String(index + 1).padStart(2, "0")}${
    normalizedSeed || "AUTO"
  }`;
}

function normalizePaymentStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "paid") return "paid";
  if (normalized === "partially paid" || normalized === "partial") return "partial";

  return normalized;
}

function formatPaymentStatus(status) {
  const normalized = normalizePaymentStatus(status);

  if (normalized === "partial") return "Partially Paid";
  if (normalized === "paid") return "Paid";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";

  return String(status || "Unknown");
}

function escapeCsvValue(value) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function getTransactionAmount(transaction) {
  return Number(
    transaction.amount ||
      transaction.paidAmount ||
      transaction.amountPaid ||
      transaction.totalPaid ||
      transaction.value ||
      0
  );
}

function getTransactionReference(transaction, invoice) {
  return (
    transaction.reference ||
    transaction.paymentReference ||
    transaction.transactionReference ||
    transaction.transactionId ||
    transaction.gatewayReference ||
    transaction.providerReference ||
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    invoice.invoiceNumber ||
    "-"
  );
}

function getTransactionProvider(transaction, invoice, source) {
  return (
    transaction.provider ||
    transaction.paymentProvider ||
    transaction.gateway ||
    transaction.channel ||
    invoice.paymentProvider ||
    invoice.pendingPaymentProvider ||
    (source === "qr" ? "Monnify" : "Manual")
  );
}

function getTransactionDate(transaction, invoice) {
  return (
    transaction.paidAt ||
    transaction.paymentConfirmedAt ||
    transaction.confirmedAt ||
    transaction.completedAt ||
    transaction.createdAt ||
    transaction.date ||
    invoice.paidAt ||
    invoice.paymentConfirmedAt ||
    invoice.pendingPaymentCreatedAt ||
    invoice.date ||
    invoice.createdAt
  );
}

function getTransactionStatus(transaction, invoice) {
  return (
    transaction.status ||
    transaction.paymentStatus ||
    invoice.status ||
    "Paid"
  );
}

function getInvoiceTransactionList(invoice) {
  return [
    ...(Array.isArray(invoice.paymentTransactions)
      ? invoice.paymentTransactions
      : []),
    ...(Array.isArray(invoice.transactions) ? invoice.transactions : []),
    ...(Array.isArray(invoice.payments) ? invoice.payments : []),
    ...(Array.isArray(invoice.paymentHistory) ? invoice.paymentHistory : []),
  ];
}

export default function Payments() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  useEffect(() => {
    const applyCategoryFilter = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      setCategoryFilter(String(params.get("category") || "").trim());
      setStudentFilter(String(params.get("student") || "").trim());
    }, 0);

    return () => clearTimeout(applyCategoryFilter);
  }, []);

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
    const invoiceRows = invoices.flatMap((invoice) => {
      const invoiceStatus = String(invoice.status || "").toLowerCase();

      const isPaidInvoice = ["paid", "partially paid", "partial"].includes(
        invoiceStatus
      );

      if (!isPaidInvoice) {
        return [];
      }

      const source = invoice.quickPayProfileId ? "qr" : "invoice";

      const customerName =
        invoice.customer ||
        invoice.customerName ||
        invoice.student ||
        customerLabels.singularTitle;

      const baseRow = {
        invoiceId: invoice._id,
        type: "payment-transaction",
        source,
        sourceLabel: getSourceLabel({ type: "invoice", source }),
        customerName,
        category: String(invoice.category || "").trim(),
        description:
          invoice.description ||
          invoice.category ||
          invoice.class ||
          "Invoice payment",
        phone: invoice.phone || "",
        invoiceNumber: invoice.invoiceNumber || "-",
        token: invoice.token || "",
        balanceDue: Number(invoice.balanceDue || 0),
      };

      const transactionList = getInvoiceTransactionList(invoice);

      const validTransactions = transactionList.filter((transaction) => {
        return getTransactionAmount(transaction) > 0;
      });

      if (validTransactions.length > 0) {
        return validTransactions.map((transaction, index) => {
          const amount = getTransactionAmount(transaction);
          const reference = getTransactionReference(transaction, invoice);
          const provider = getTransactionProvider(transaction, invoice, source);
          const happenedAt = getTransactionDate(transaction, invoice);
          const transactionStatus = getTransactionStatus(transaction, invoice);

          return {
            ...baseRow,
            id: `payment-${invoice._id}-${reference}-${index}`,
            amount,
            status:
              normalizePaymentStatus(transactionStatus) === "partial"
                ? "Partially Paid"
                : transactionStatus,
            notificationStatus: resolveNotificationStatus(transaction, invoice),
            provider,
            reference,
            transactionId:
              transaction.transactionId ||
              buildGeneratedTransactionId(
                transaction.paymentReference ||
                  transaction.reference ||
                  reference ||
                  invoice.paymentReference ||
                  invoice.invoiceNumber ||
                  invoice._id,
                happenedAt,
                index
              ),
            happenedAt,
          };
        });
      }

      return [
        {
          ...baseRow,
          id: `invoice-${invoice._id}`,
          type: "invoice",
          amount: Number(
            invoice.paidAmount ||
              invoice.amountPaid ||
              invoice.amount ||
              0
          ),
          status:
            normalizePaymentStatus(invoice.status) === "partial"
              ? "Partially Paid"
              : invoice.status || "Paid",
          notificationStatus: resolveNotificationStatus({}, invoice),
          provider:
            invoice.paymentProvider ||
            invoice.pendingPaymentProvider ||
            (source === "qr" ? "Monnify" : "Manual"),
          reference:
            invoice.paymentReference ||
            invoice.pendingPaymentReference ||
            invoice.invoiceNumber ||
            "-",
          transactionId:
            buildGeneratedTransactionId(
              invoice.paymentReference ||
                invoice.pendingPaymentReference ||
                invoice.invoiceNumber ||
                invoice._id,
              invoice.paidAt ||
                invoice.paymentConfirmedAt ||
                invoice.pendingPaymentCreatedAt ||
                invoice.date ||
                invoice.createdAt,
              0
            ),
          happenedAt:
            invoice.paidAt ||
            invoice.paymentConfirmedAt ||
            invoice.pendingPaymentCreatedAt ||
            invoice.date ||
            invoice.createdAt,
        },
      ];
    });

    return invoiceRows.sort(
      (a, b) => new Date(b.happenedAt || 0) - new Date(a.happenedAt || 0)
    );
  }, [customerLabels.singularTitle, invoices]);

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
        row.transactionId,
        row.provider,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    const matchesStudent =
      !studentFilter ||
      String(row.customerName || "").trim().toLowerCase() === studentFilter.toLowerCase();

    const matchesCategory =
      !categoryFilter ||
      String(row.category || "").trim().toLowerCase() === categoryFilter.toLowerCase();

    const matchesSource = sourceFilter === "all" || row.source === sourceFilter;

    const matchesStatus =
      statusFilter === "all" ||
      normalizePaymentStatus(row.status) === statusFilter;

    const matchesNotification =
      notificationFilter === "all" ||
      String(row.notificationStatus || "").toLowerCase() === notificationFilter;

    const rowDate = row.happenedAt ? new Date(row.happenedAt) : null;

    const matchesStart =
      !startDate ||
      (rowDate && rowDate >= new Date(`${startDate}T00:00:00`));

    const matchesEnd =
      !endDate ||
      (rowDate && rowDate <= new Date(`${endDate}T23:59:59.999`));

    return (
      matchesSearch &&
      matchesStudent &&
      matchesCategory &&
      matchesSource &&
      matchesStatus &&
      matchesNotification &&
      matchesStart &&
      matchesEnd
    );
  });

  const totalCollected = filteredRows
    .filter((row) =>
      ["paid", "partial"].includes(normalizePaymentStatus(row.status))
    )
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const pendingCount = filteredRows.filter(
    (row) => String(row.status || "").toLowerCase() === "pending"
  ).length;

  const sentNotifications = filteredRows.filter(
    (row) => normalizeNotificationStatus(row.notificationStatus) === "sent"
  ).length;

  const latestPaymentDate = filteredRows[0]?.happenedAt
    ? formatDateInput(filteredRows[0].happenedAt)
    : "";

  const providerCount = new Set(
    filteredRows
      .map((row) => String(row.provider || "").trim())
      .filter(Boolean)
  ).size;

  const filterSummary = `${filteredRows.length} record${
    filteredRows.length === 1 ? "" : "s"
  } found`;

  const clearCategoryFilter = () => {
    setCategoryFilter("");
    setStudentFilter("");
    window.history.replaceState({}, "", "/dashboard/payments");
  };

  const exportPayments = () => {
    const headers = [
      "Transaction ID",
      customerLabels.singularTitle,
      "Phone",
      "Description",
      "Amount",
      "Status",
      "Provider",
      "Notification",
      "Reference",
      "Invoice Number",
      "Source",
      "Date",
    ];

    const rows = filteredRows.map((row) => [
      row.transactionId,
      row.customerName,
      row.phone,
      row.description,
      row.amount,
      formatPaymentStatus(row.status),
      row.provider,
      formatNotificationStatus(row.notificationStatus),
      row.reference,
      row.invoiceNumber,
      getSourceLabel(row),
      formatDateTime(row.happenedAt),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const rangeLabel = [startDate || "start", endDate || "end"].join("-to-");

    link.href = url;
    link.download = `payment-history-${rangeLabel}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <PageShell>
      <PageHeader
        title="Collections history"
        description="Review cleared transactions, invoice activity, notification outcomes, and collection records from one place."
        actions={
          <button
            type="button"
            onClick={exportPayments}
            disabled={filteredRows.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
          >
            Export CSV
          </button>
        }
      />

      {studentFilter || categoryFilter ? (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900 dark:bg-emerald-950/30">
          <div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              Payment history for {studentFilter || categoryFilter}
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              {studentFilter
                ? `Totals, transactions, and exports are limited to this student in ${categoryFilter || "their group"}.`
                : "Totals, transactions, and exports are currently limited to this student group."}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCategoryFilter}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900"
          >
            Show all payments
          </button>
        </div>
      ) : null}

      <StatGrid>
        <StatCard
          label="Collected"
          value={formatCurrency(totalCollected)}
          tone="emerald"
        />
        <StatCard
          label="Transactions"
          value={filteredRows.length}
          tone="slate"
        />
        <StatCard label="Providers" value={providerCount} tone="blue" />
        <StatCard
          label="WhatsApp sent"
          value={sentNotifications}
          tone="emerald"
        />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Collection filters
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Narrow the ledger by date, source, settlement state, notification state,
                and customer details.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                {filterSummary}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                {latestPaymentDate
                  ? `Latest: ${latestPaymentDate}`
                  : "No activity date yet"}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                Pending: {pendingCount}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-8">
            <InputField
              type="text"
              placeholder={`Search ${customerLabels.singular}, phone, reference, transaction ID...`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="2xl:col-span-2"
            />

            <InputField
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              aria-label="Start date"
            />

            <InputField
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              aria-label="End date"
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
              <option value="partial">Partially paid</option>
              <option value="pending">Pending</option>
              <option value="unpaid">Unpaid</option>
              <option value="failed">Failed</option>
            </SelectField>

            <SelectField
              value={notificationFilter}
              onChange={(event) => setNotificationFilter(event.target.value)}
              className="md:col-span-2 2xl:col-span-2"
            >
              <option value="all">All notifications</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </SelectField>

            <button
              type="button"
              onClick={exportPayments}
              disabled={filteredRows.length === 0}
              className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
            >
              Export
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSourceFilter("all");
                setStatusFilter("all");
                setNotificationFilter("all");
                setStartDate("");
                setEndDate("");
              }}
              className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/60 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Collection ledger
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                Payment transactions
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {filteredRows.length} record{filteredRows.length === 1 ? "" : "s"} visible
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Collected</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{formatCurrency(totalCollected)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notifications</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{sentNotifications}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Pending</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{pendingCount}</p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading collection records...
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No collection records match these filters"
            description="Clear one or more filters to widen the payment history."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="w-[18%] px-5 py-3.5">Transaction</th>
                    <th className="w-[18%] px-5 py-3.5">{customerLabels.singularTitle}</th>
                    <th className="w-[22%] px-5 py-3.5">Description</th>
                    <th className="w-[14%] px-5 py-3.5">Channel</th>
                    <th className="w-[10%] px-5 py-3.5 text-right">Amount</th>
                    <th className="w-[10%] px-5 py-3.5">Date</th>
                    <th className="w-[8%] px-5 py-3.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/50">
                      <td className="px-5 py-4 align-top">
                        <p className="truncate font-semibold text-slate-900 dark:text-white" title={row.transactionId}>
                          {row.transactionId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatPaymentStatus(row.status)} • {row.sourceLabel}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="truncate font-semibold text-slate-900 dark:text-white" title={row.customerName}>
                          {row.customerName}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                          {row.phone || "No phone"}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="truncate text-sm text-slate-700 dark:text-slate-200" title={row.description}>
                          {row.description || "Invoice payment"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Invoice {row.invoiceNumber || "-"}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {row.provider || row.sourceLabel || "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {row.notificationStatus ? formatNotificationStatus(row.notificationStatus) : "No status"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-right align-top">
                        <p className="whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(row.amount)}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {formatDateTime(row.happenedAt)}
                        </p>
                      </td>

                      <td className="px-5 py-4 align-top">
                        <button
                          type="button"
                          onClick={() => setSelectedTransaction(row)}
                          className="rounded-lg border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:border-slate-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredRows.length}</span> transaction{filteredRows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                >
                  Prev
                </button>
                <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-blue-600 px-3 text-xs font-semibold text-white">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SurfaceCard>

      {selectedTransaction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Payment details">
          <div className="flex max-h-[calc(100vh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900 sm:max-h-[calc(100vh-2rem)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Transaction record
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
                  Payment details
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {formatDateTime(selectedTransaction.happenedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                aria-label="Close payment details"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            <div className="grid border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-3">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:border-b-0 sm:border-r sm:px-6">
                <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Amount paid</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{formatCurrency(selectedTransaction.amount)}</p>
              </div>
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:border-b-0 sm:border-r sm:px-6">
                <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Payment status</p>
                <div className="mt-2"><StatusBadge tone={getStatusTone(selectedTransaction.status)}>{formatPaymentStatus(selectedTransaction.status)}</StatusBadge></div>
              </div>
              <div className="px-5 py-4 sm:px-6">
                <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Balance due</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-950 dark:text-white">{selectedTransaction.balanceDue ? formatCurrency(selectedTransaction.balanceDue) : "N0"}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6 sm:py-3">
              <div className="grid gap-x-10 sm:grid-cols-2">
                <section>
                  <h3 className="py-3 text-sm font-semibold text-slate-950 dark:text-white">Transaction</h3>
                  <dl className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {[
                      ["Transaction ID", selectedTransaction.transactionId],
                      ["Reference", selectedTransaction.reference || "-"],
                      ["Invoice number", selectedTransaction.invoiceNumber || "-"],
                      ["Provider", selectedTransaction.provider || selectedTransaction.sourceLabel || "-"],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 py-3 text-sm">
                        <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                        <dd className="break-all text-right font-medium text-slate-900 dark:text-slate-100" title={String(value)}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section>
                  <h3 className="py-3 text-sm font-semibold text-slate-950 dark:text-white">Customer and delivery</h3>
                  <dl className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {[
                      ["Customer", selectedTransaction.customerName],
                      ["Phone", selectedTransaction.phone || "-"],
                      ["Channel", selectedTransaction.sourceLabel || "-"],
                      ["Notification", formatNotificationStatus(selectedTransaction.notificationStatus)],
                    ].map(([label, value]) => (
                      <div key={label} className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 py-3 text-sm">
                        <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                        <dd className="break-words text-right font-medium capitalize text-slate-900 dark:text-slate-100">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-3 dark:border-slate-800 sm:px-6">
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
