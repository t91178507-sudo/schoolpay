"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  FiAlertTriangle,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { useConfirm } from "../../../components/AppFeedback";
import { PageHeader, PageShell, StatusBadge, SurfaceCard } from "../../../components/DashboardUI";
import { authFetch } from "../../../lib/authFetch";
import { isSchoolBusinessType } from "../../../lib/businessLabels";
import { useBusinessSession, useHydrated } from "../../../lib/clientSession";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getStatusTone(status) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "orange";
}

function formatStatus(status) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Awaiting review";
}

const QUEUES = [
  { key: "pending", label: "Awaiting review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function ReceiptValidationPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const session = useBusinessSession();
  const isHydrated = useHydrated();
  const isSchoolBusiness = isSchoolBusinessType(session.businessType);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeQueue, setActiveQueue] = useState("pending");
  const [search, setSearch] = useState("");
  const [activeReceipt, setActiveReceipt] = useState(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [rejecting, setRejecting] = useState(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [error, setError] = useState("");

  const loadReceipts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const res = await authFetch("/api/receipts", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || "Unable to load receipts");
      setReceipts(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load receipts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isHydrated) return undefined;
    if (!isSchoolBusiness) {
      router.replace("/dashboard");
      return undefined;
    }
    const initialLoad = setTimeout(() => loadReceipts(), 0);
    return () => clearTimeout(initialLoad);
  }, [isHydrated, isSchoolBusiness, router]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const completed = receipts.filter(
      (receipt) =>
        ["approved", "rejected"].includes(receipt.status) &&
        receipt.createdAt &&
        (receipt.approvedAt || receipt.rejectedAt)
    );
    const averageMs = completed.length
      ? completed.reduce((sum, receipt) => {
          const end = new Date(receipt.approvedAt || receipt.rejectedAt).getTime();
          const start = new Date(receipt.createdAt).getTime();
          return sum + Math.max(end - start, 0);
        }, 0) / completed.length
      : 0;

    return {
      pending: receipts.filter((receipt) => receipt.status === "pending").length,
      approved: receipts.filter((receipt) => receipt.status === "approved").length,
      rejected: receipts.filter((receipt) => receipt.status === "rejected").length,
      approvedToday: receipts.filter(
        (receipt) => receipt.status === "approved" && String(receipt.approvedAt || "").slice(0, 10) === today
      ).length,
      rejectedToday: receipts.filter(
        (receipt) => receipt.status === "rejected" && String(receipt.rejectedAt || "").slice(0, 10) === today
      ).length,
      averageValidation: averageMs > 0 ? `${Math.max(Math.round(averageMs / 60000), 1)} min` : "-",
    };
  }, [receipts]);

  const visibleReceipts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return receipts.filter((receipt) => {
      if (receipt.status !== activeQueue) return false;
      if (!query) return true;
      return [
        receipt.invoiceNumber,
        receipt.invoice?.invoiceNumber,
        receipt.customerName,
        receipt.transactionReference,
        receipt.extracted?.transactionReference,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [activeQueue, receipts, search]);

  const openReceipt = async (receipt) => {
    setError("");
    setActiveReceipt(receipt);
    setReceiptPreviewUrl("");

    try {
      const detailRes = await authFetch(`/api/receipts/${receipt._id}`, { cache: "no-store" });
      const detail = await detailRes.json().catch(() => ({}));
      if (detailRes.ok) {
        setActiveReceipt({ ...receipt, ...detail.receipt, invoice: detail.invoice || receipt.invoice });
      }

      const fileRes = await authFetch(`/api/receipts/${receipt._id}`, { method: "POST" });
      if (!fileRes.ok) {
        const fileError = await fileRes.json().catch(() => ({}));
        throw new Error(fileError.error || "Unable to load receipt preview");
      }
      setReceiptPreviewUrl(URL.createObjectURL(await fileRes.blob()));
    } catch (openError) {
      setActiveReceipt(null);
      setReceiptPreviewUrl("");
      setError(openError.message || "Unable to open receipt");
    }
  };

  const closeReceipt = () => {
    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptPreviewUrl("");
    setActiveReceipt(null);
  };

  const updateReceipt = async (receipt, action, reason = "") => {
    if (action === "approve") {
      const approved = await confirm({
        title: "Approve this payment?",
        message: `This will mark ${receipt.invoiceNumber || "the invoice"} as paid and notify the customer.`,
        confirmLabel: "Approve payment",
        tone: "warning",
      });
      if (!approved) return;
    }

    setBusy(`${receipt._id}-${action}`);
    setMessage("");
    setError("");

    try {
      const res = await authFetch(`/api/receipts/${receipt._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to update receipt");

      const notificationFailed = action === "reject" && !data.notification?.sent;
      setMessageTone(notificationFailed ? "warning" : "success");
      setMessage(
        action === "approve"
          ? "Payment approved. The invoice and payment records have been updated."
          : data.notification?.sent
            ? "Receipt rejected. The customer was informed on WhatsApp."
            : "Receipt rejected, but the WhatsApp notification could not be sent."
      );
      setRejecting(null);
      closeReceipt();
      await loadReceipts({ silent: true });
    } catch (updateError) {
      setError(updateError.message || "Unable to update receipt");
    } finally {
      setBusy("");
    }
  };

  if (!isHydrated || !isSchoolBusiness) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-r-transparent" />
      </div>
    );
  }

  const metrics = [
    { label: "Awaiting review", value: stats.pending, hint: "Requires a decision", icon: FiClock, tone: "amber" },
    { label: "Approved today", value: stats.approvedToday, hint: `${stats.approved} approved in total`, icon: FiCheckCircle, tone: "emerald" },
    { label: "Rejected today", value: stats.rejectedToday, hint: `${stats.rejected} rejected in total`, icon: FiXCircle, tone: "rose" },
    { label: "Average review time", value: stats.averageValidation, hint: "Across completed reviews", icon: FiFileText, tone: "blue" },
  ];

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Receipt validation"
        description="Review proof of bank transfer and make a clear payment decision."
        actions={
          <button
            type="button"
            onClick={() => loadReceipts({ silent: true })}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {message ? <FeedbackBanner tone={messageTone} message={message} /> : null}
      {error ? <FeedbackBanner tone="error" message={error} /> : null}

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1 dark:bg-slate-950">
              {QUEUES.map((queue) => {
                const count = stats[queue.key];
                return (
                  <button
                    key={queue.key}
                    type="button"
                    onClick={() => setActiveQueue(queue.key)}
                    className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                      activeQueue === queue.key
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {queue.label}
                    <span className={`rounded-full px-2 py-0.5 text-xs ${activeQueue === queue.key ? "bg-slate-100 dark:bg-slate-700" : "bg-white/70 dark:bg-slate-800"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="relative block w-full lg:max-w-xs">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoice or customer"
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="hidden border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 lg:grid lg:grid-cols-[1.15fr_1.15fr_.75fr_1fr_.65fr_.8fr_auto] lg:gap-5">
          <span>Invoice</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Submitted</span>
          <span>OCR</span>
          <span>Status</span>
          <span className="text-right">Action</span>
        </div>

        {loading ? (
          <ReceiptLoadingRows />
        ) : visibleReceipts.length ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleReceipts.map((receipt) => (
              <ReceiptRow key={receipt._id} receipt={receipt} onOpen={() => openReceipt(receipt)} />
            ))}
          </div>
        ) : (
          <QueueEmptyState queue={activeQueue} hasSearch={Boolean(search.trim())} />
        )}
      </SurfaceCard>

      {activeReceipt ? (
        <ReceiptDrawer
          receipt={activeReceipt}
          previewUrl={receiptPreviewUrl}
          onClose={closeReceipt}
          onApprove={() => updateReceipt(activeReceipt, "approve")}
          onReject={() => setRejecting(activeReceipt)}
          busy={busy}
        />
      ) : null}

      {rejecting ? (
        <RejectModal
          receipt={rejecting}
          onCancel={() => setRejecting(null)}
          onReject={(reason) => updateReceipt(rejecting, "reject", reason)}
          busy={busy}
        />
      ) : null}
    </PageShell>
  );
}

function MetricCard({ label, value, hint, icon: Icon, tone }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  };

  return (
    <div className="flex min-h-32 items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      </div>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="text-lg" />
      </span>
    </div>
  );
}

function FeedbackBanner({ tone, message }) {
  const isError = tone === "error";
  const isWarning = tone === "warning";
  const Icon = isError || isWarning ? FiAlertTriangle : FiCheckCircle;
  const classes = isError
    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    : isWarning
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
      : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <Icon className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ReceiptRow({ receipt, onOpen }) {
  const confidence = Number(receipt.extracted?.confidence || 0);
  return (
    <div className="grid gap-4 px-5 py-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 lg:grid-cols-[1.15fr_1.15fr_.75fr_1fr_.65fr_.8fr_auto] lg:items-center lg:gap-5">
      <div className="min-w-0">
        <p className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-white">{receipt.invoiceNumber || receipt.invoice?.invoiceNumber || "-"}</p>
        <p className="mt-1 text-xs text-slate-400">Receipt upload</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{receipt.customerName || "Unknown customer"}</p>
        <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{receipt.transactionReference || receipt.extracted?.transactionReference || "No transaction reference"}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{formatCurrency(receipt.amount)}</p>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(receipt.createdAt)}</p>
      <div>
        <span className={`text-sm font-semibold ${confidence >= 75 ? "text-emerald-600" : confidence > 0 ? "text-amber-600" : "text-slate-400"}`}>{confidence ? `${confidence}%` : "-"}</span>
      </div>
      <div><StatusBadge tone={getStatusTone(receipt.status)}>{formatStatus(receipt.status)}</StatusBadge></div>
      <div className="flex justify-start lg:justify-end">
        <button type="button" onClick={onOpen} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <FiEye />
          {receipt.status === "pending" ? "Review" : "View"}
        </button>
      </div>
    </div>
  );
}

function ReceiptLoadingRows() {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid animate-pulse gap-4 px-5 py-5 lg:grid-cols-[1.15fr_1.15fr_.75fr_1fr_.65fr_.8fr_auto] lg:gap-5">
          {[28, 36, 20, 32, 14, 24, 18].map((width, index) => (
            <span key={index} className="h-4 rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${width * 2}px`, maxWidth: "100%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function QueueEmptyState({ queue, hasSearch }) {
  const copy = hasSearch
    ? ["No matching receipts", "Try another invoice number, customer, or transaction reference."]
    : queue === "pending"
      ? ["Your review queue is clear", "New receipt uploads that require a decision will appear here."]
      : queue === "approved"
        ? ["No approved receipts", "Receipts you approve will remain available here for reference."]
        : ["No rejected receipts", "Receipts you reject will remain available here with their decision history."];
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><FiFileText className="text-xl" /></span>
      <p className="mt-4 font-semibold text-slate-900 dark:text-white">{copy[0]}</p>
      <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{copy[1]}</p>
    </div>
  );
}

function ReceiptDrawer({ receipt, previewUrl, onClose, onApprove, onReject, busy }) {
  const invoice = receipt.invoice || {};
  const extracted = receipt.extracted || {};
  const confidence = Number(extracted.confidence || 0);
  const canReview = receipt.status === "pending";

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Receipt review">
      <div className="mx-auto grid h-full max-w-7xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.8fr)]">
        <div className="flex min-h-80 items-center justify-center bg-slate-100 p-3 dark:bg-slate-950 sm:p-5">
          {previewUrl ? (
            receipt.fileType === "application/pdf" ? (
              <iframe title="Uploaded receipt" src={previewUrl} className="h-full min-h-[560px] w-full rounded-lg bg-white" />
            ) : (
              <Image src={previewUrl} alt="Uploaded receipt" width={1200} height={1600} unoptimized className="max-h-full w-auto rounded-lg object-contain shadow-sm" />
            )
          ) : (
            <div className="flex flex-col items-center gap-3 text-sm text-slate-500"><FiRefreshCw className="animate-spin text-xl" />Loading receipt preview</div>
          )}
        </div>

        <div className="flex min-h-0 flex-col border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase text-slate-500">Receipt review</p>
                <StatusBadge tone={getStatusTone(receipt.status)}>{formatStatus(receipt.status)}</StatusBadge>
              </div>
              <h2 className="mt-2 truncate text-xl font-semibold text-slate-950 dark:text-white">{receipt.invoiceNumber || invoice.invoiceNumber || "Receipt"}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Submitted {formatDate(receipt.createdAt)}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close receipt review" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"><FiX className="text-xl" /></button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">
            <InfoBlock title="Invoice" rows={[
              ["Invoice number", invoice.invoiceNumber || receipt.invoiceNumber || "-"],
              ["Customer", receipt.customerName || invoice.customer || invoice.customerName || "-"],
              ["Invoice amount", formatCurrency(invoice.amount || receipt.amount)],
              ["Invoice date", formatDate(invoice.date || invoice.createdAt)],
            ]} />

            <InfoBlock title="Extracted payment details" rows={[
              ["Amount", extracted.amount ? formatCurrency(extracted.amount) : "Not detected"],
              ["Transaction reference", receipt.transactionReference || extracted.transactionReference || "Not detected"],
              ["Payment date", receipt.paymentDate || extracted.transactionDate || "Not detected"],
              ["Payment time", receipt.paymentTime || extracted.transactionTime || "Not detected"],
              ["Sender", receipt.senderName || extracted.senderName || "Not detected"],
              ["Recipient", receipt.recipientName || extracted.recipientName || "Not detected"],
              ["Bank", extracted.bankName || "Not detected"],
            ]} />

            <section className="border-t border-slate-200 py-5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-950 dark:text-white">OCR validation</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Use this as guidance and confirm against the receipt.</p>
                </div>
                <span className={`text-lg font-semibold ${confidence >= 75 ? "text-emerald-600" : "text-amber-600"}`}>{confidence}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${confidence >= 75 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(Math.max(confidence, 0), 100)}%` }} />
              </div>
              <div className="mt-4 space-y-2">
                {(extracted.checks || []).length ? (extracted.checks || []).map((check) => (
                  <div key={check.label} className="flex items-start gap-2 text-sm">
                    {check.ok ? <FiCheckCircle className="mt-0.5 shrink-0 text-emerald-600" /> : <FiAlertTriangle className="mt-0.5 shrink-0 text-amber-600" />}
                    <span className="text-slate-700 dark:text-slate-300">{check.label}</span>
                  </div>
                )) : <p className="text-sm text-slate-500 dark:text-slate-400">No automated checks were returned.</p>}
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
            {canReview ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={onReject} disabled={!previewUrl || Boolean(busy)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"><FiXCircle />Reject</button>
                <button type="button" onClick={onApprove} disabled={!previewUrl || busy === `${receipt._id}-approve`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"><FiCheck />{busy === `${receipt._id}-approve` ? "Approving..." : "Approve payment"}</button>
              </div>
            ) : (
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">This receipt has already been {receipt.status}.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, rows }) {
  return (
    <section className="py-5 first:border-0 [&+section]:border-t [&+section]:border-slate-200 dark:[&+section]:border-slate-800">
      <h3 className="font-semibold text-slate-950 dark:text-white">{title}</h3>
      <dl className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-2.5 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="break-words text-right font-medium text-slate-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RejectModal({ receipt, onCancel, onReject, busy }) {
  const [reason, setReason] = useState("Incorrect amount");
  const [customReason, setCustomReason] = useState("");
  const reasons = ["Incorrect amount", "Receipt unreadable", "Payment not found", "Duplicate receipt", "Wrong invoice", "Other"];
  const rejectionReason = reason === "Other" ? customReason.trim() : reason;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4" role="dialog" aria-modal="true" aria-label="Reject receipt">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Reject receipt</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">The reason will be included in the customer&apos;s WhatsApp notification.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><FiX /></button>
        </div>
        <label className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300">Reason</label>
        <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {reason === "Other" ? (
          <div className="mt-4">
            <label htmlFor="custom-rejection-reason" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Details</label>
            <textarea id="custom-rejection-reason" value={customReason} onChange={(event) => setCustomReason(event.target.value)} rows={3} placeholder="Explain why this receipt could not be validated" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
          <button type="button" onClick={() => onReject(rejectionReason)} disabled={busy === `${receipt._id}-reject` || !rejectionReason} className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy === `${receipt._id}-reject` ? "Rejecting..." : "Reject and notify"}</button>
        </div>
      </div>
    </div>
  );
}