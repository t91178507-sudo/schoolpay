"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiMessageCircle, FiTrash2 } from "react-icons/fi";
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
function normalizePhoneForWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";

  // Nigerian local format: 08012345678 -> 2348012345678
  if (digits.startsWith("0")) {
    return `234${digits.slice(1)}`;
  }

  // Already international without +
  if (digits.startsWith("234")) {
    return digits;
  }

  // If user saved 10 digit Nigerian number like 8012345678
  if (digits.length === 10) {
    return `234${digits}`;
  }

  return digits;
}

function getInvoicePaymentUrl(invoice, origin) {
  if (invoice.paymentUrl) return invoice.paymentUrl;
  if (invoice.paymentLink) return invoice.paymentLink;
  if (invoice.checkoutUrl) return invoice.checkoutUrl;

  if (invoice.token) {
    return `${origin}/pay/${invoice.token}`;
  }

  return origin;
}

function buildWhatsAppInvoiceMessage(invoice, origin, customerLabel = "Customer") {
  const customerName =
    invoice.customer ||
    invoice.customerName ||
    invoice.student ||
    customerLabel;

  const amount = Number(getOutstandingAmount(invoice) || invoice.amount || 0).toLocaleString();
  const invoiceNumber = invoice.invoiceNumber || "-";
  const description = invoice.description || invoice.category || invoice.class || "Invoice payment";
  const paymentUrl = getInvoicePaymentUrl(invoice, origin);

  return [
    `Hello ${customerName},`,
    "",
    `Your invoice is ready for payment.`,
    "",
    `Invoice: ${invoiceNumber}`,
    `Description: ${description}`,
    `Amount Due: N${amount}`,
    "",
    `Pay here: ${paymentUrl}`,
    "",
    "Thank you.",
  ].join("\n");
}

function openBrowserWhatsApp(invoice, origin, customerLabel, notify) {
  const phone = normalizePhoneForWhatsApp(invoice.phone);

  if (!phone) {
    notify?.("error", "No valid WhatsApp phone number.");
    return false;
  }

  const message = buildWhatsAppInvoiceMessage(invoice, origin, customerLabel);
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  openExternalTab(whatsappUrl, notify);

  return true;
}

function openExternalTab(url, notify) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened) {
    notify?.(
      "error",
      "Your browser blocked the WhatsApp tab. Please allow pop-ups for InvoiceHub and try again."
    );
    return false;
  }

  return true;
}

export default function Invoices() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [invoices, setInvoices] = useState([]);
  const [recurringInvoices, setRecurringInvoices] = useState([]);
  const [activePage, setActivePage] = useState("invoices");
  const [invoiceFilterForm, setInvoiceFilterForm] = useState({
    search: "",
    category: "all",
    provider: "all",
    status: "all",
    notification: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [invoiceFilters, setInvoiceFilters] = useState({
    search: "",
    category: "all",
    provider: "all",
    status: "all",
    notification: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [recurringSearch, setRecurringSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ tone: "", text: "" });
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringLoaded, setRecurringLoaded] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [runningRecurring, setRunningRecurring] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    description: "",
    amount: "",
    frequency: "monthly",
    nextRunAt: new Date().toISOString().slice(0, 10),
  });

  const loadInvoices = useCallback(async () => {
    try {
      const invoiceRes = await authFetch("/api/invoices");
      const data = invoiceRes.ok ? await invoiceRes.json() : [];
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecurringInvoices = useCallback(async () => {
    setRecurringLoading(true);

    try {
      const recurringRes = await authFetch("/api/recurring-invoices");
      const recurringData = recurringRes.ok ? await recurringRes.json() : [];
      setRecurringInvoices(Array.isArray(recurringData) ? recurringData : []);
      setRecurringLoaded(true);
    } catch {
      setRecurringInvoices([]);
    } finally {
      setRecurringLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (activePage === "recurring" && !recurringLoaded && !recurringLoading) {
      loadRecurringInvoices();
    }
  }, [activePage, recurringLoaded, recurringLoading, loadRecurringInvoices]);

  const showNotice = useCallback((tone, text) => {
    setNotice({ tone, text });
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
      loadInvoices();
    } catch {
      loadInvoices();
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
    showNotice("error", "No phone number.");
    return;
  }

  if (!invoice.token && !invoice.paymentUrl && !invoice.paymentLink && !invoice.checkoutUrl) {
    showNotice("error", "This invoice does not have a payment link yet.");
    return;
  }

  const origin = window.location.origin;

  try {
    const res = await authFetch("/api/notifications/whatsapp/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: String(invoice._id),
        origin,
      }),
    });

    const data = await res.json().catch(() => ({}));

    /*
      If backend returns a fallbackUrl, open WhatsApp browser immediately.
      This covers cases where the WhatsApp bridge/provider is unavailable.
    */
    if (data?.delivery?.fallbackUrl) {
      openExternalTab(data.delivery.fallbackUrl, showNotice);
      showNotice("info", "WhatsApp Web was unavailable, so the message was opened in a browser tab.");

      return;
    }

    /*
      If backend failed, automatically fall back to browser WhatsApp.
    */
    if (!res.ok) {
      openBrowserWhatsApp(invoice, origin, customerLabels.singularTitle, showNotice);
      return;
    }

    /*
      If backend succeeded but did not actually send through provider,
      still fall back to browser WhatsApp where possible.
    */
    const deliveryStatus = String(
      data?.delivery?.status ||
        data?.delivery?.notificationStatus ||
        data?.status ||
        ""
    ).toLowerCase();

    const bridgeWorked =
      data?.delivery?.sent === true ||
      data?.delivery?.provider === "whatsappWeb" ||
      ["sent", "delivered", "success", "prepared"].includes(deliveryStatus);

    if (!bridgeWorked) {
      openBrowserWhatsApp(invoice, origin, customerLabels.singularTitle, showNotice);
      return;
    }

    showNotice("success", "Sent.");
  } catch {
    /*
      Network/server error: automatically open browser WhatsApp.
    */
    openBrowserWhatsApp(invoice, origin, customerLabels.singularTitle, showNotice);
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
            openExternalTab(delivery.fallbackUrl);
          }
        });
      }

      alert(
        `Reminders processed: ${data.processedCount}\nSent through WhatsApp provider: ${data.sentCount}\nOpened in WhatsApp manually: ${data.fallbackCount}\nSkipped: ${data.skippedCount}\nCooldown skipped: ${data.cooldownSkippedCount || 0}\nDaily cap skipped: ${data.cappedSkippedCount || 0}`
      );

      loadInvoices();
    } catch (error) {
      alert(error.message || "Unable to send reminders");
    } finally {
      setSendingReminders(false);
    }
  };

  const updateRecurringForm = (field, value) => {
    setRecurringForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateInvoiceFilterForm = (field, value) => {
    setInvoiceFilterForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const applyInvoiceFilters = () => {
    setInvoiceFilters(invoiceFilterForm);
  };

  const resetInvoiceFilters = () => {
    const defaults = {
      search: "",
      category: "all",
      provider: "all",
      status: "all",
      notification: "all",
      dateFrom: "",
      dateTo: "",
    };

    setInvoiceFilterForm(defaults);
    setInvoiceFilters(defaults);
  };

  const createRecurringInvoice = async (event) => {
    event.preventDefault();
    setSavingRecurring(true);

    try {
      const res = await authFetch("/api/recurring-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recurringForm),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to create recurring invoice");
      }

      setRecurringForm({
        customerName: "",
        phone: "",
        email: "",
        description: "",
        amount: "",
        frequency: "monthly",
        nextRunAt: new Date().toISOString().slice(0, 10),
      });
      setShowRecurringForm(false);
      await Promise.all([loadInvoices(), loadRecurringInvoices()]);
    } catch (error) {
      alert(error.message || "Unable to create recurring invoice");
    } finally {
      setSavingRecurring(false);
    }
  };

  const runDueRecurringInvoices = async () => {
    setRunningRecurring(true);

    try {
      const res = await authFetch("/api/recurring-invoices/run", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to run recurring invoices");
      }

      alert(
        `Recurring invoices processed: ${data.processedCount}\nGenerated: ${data.generatedCount}\nSkipped: ${data.skippedCount}`
      );
      await Promise.all([loadInvoices(), loadRecurringInvoices()]);
    } catch (error) {
      alert(error.message || "Unable to run recurring invoices");
    } finally {
      setRunningRecurring(false);
    }
  };

  const toggleRecurringInvoice = async (schedule) => {
    try {
      const res = await authFetch("/api/recurring-invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schedule._id,
          active: schedule.active === false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to update recurring invoice");
      }

      loadRecurringInvoices();
    } catch (error) {
      alert(error.message || "Unable to update recurring invoice");
    }
  };

  const deleteRecurringInvoice = async (schedule) => {
    if (!confirm("Delete this recurring invoice schedule?")) return;

    try {
      const res = await authFetch(`/api/recurring-invoices/${schedule._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to delete recurring invoice");
      }

      loadRecurringInvoices();
    } catch (error) {
      alert(error.message || "Unable to delete recurring invoice");
    }
  };

  const searchMatches = (values, query) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;

    return values
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  };

  const actionableInvoices = invoices.filter((invoice) => getOutstandingAmount(invoice) > 0);
  const invoiceCategoryOptions = Array.from(
    new Set(
      actionableInvoices.map((invoice) => invoice.category || invoice.class || "Uncategorized")
    )
  ).sort((a, b) => a.localeCompare(b));
  const invoiceProviderOptions = Array.from(
    new Set(
      actionableInvoices
        .map((invoice) => invoice.paymentProvider || invoice.pendingPaymentProvider || "Not started")
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const invoiceStatusOptions = Array.from(
    new Set(actionableInvoices.map((invoice) => invoice.status || "Unpaid").filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const notificationStatusOptions = Array.from(
    new Set(
      actionableInvoices
        .map((invoice) => normalizeNotificationStatus(invoice.customerNotificationStatus))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const filteredActionableInvoices = actionableInvoices.filter((invoice) => {
    const invoiceCategory = invoice.category || invoice.class || "Uncategorized";
    const paymentProvider =
      invoice.paymentProvider || invoice.pendingPaymentProvider || "Not started";
    const invoiceStatus = invoice.status || "Unpaid";
    const notificationStatus = normalizeNotificationStatus(invoice.customerNotificationStatus);
    const invoiceDate = invoice.date ? new Date(invoice.date) : null;
    const dateFrom = invoiceFilters.dateFrom ? new Date(`${invoiceFilters.dateFrom}T00:00:00`) : null;
    const dateTo = invoiceFilters.dateTo ? new Date(`${invoiceFilters.dateTo}T23:59:59`) : null;
    const matchesCategory =
      invoiceFilters.category === "all" || invoiceCategory === invoiceFilters.category;
    const matchesProvider =
      invoiceFilters.provider === "all" || paymentProvider === invoiceFilters.provider;
    const matchesStatus =
      invoiceFilters.status === "all" || invoiceStatus === invoiceFilters.status;
    const matchesNotification =
      invoiceFilters.notification === "all" ||
      notificationStatus === invoiceFilters.notification;
    const matchesDateFrom = !dateFrom || !invoiceDate || invoiceDate >= dateFrom;
    const matchesDateTo = !dateTo || !invoiceDate || invoiceDate <= dateTo;

    return (
      matchesCategory &&
      matchesProvider &&
      matchesStatus &&
      matchesNotification &&
      matchesDateFrom &&
      matchesDateTo &&
      searchMatches(
      [
        invoice.customer,
        invoice.customerName,
        invoice.student,
        invoice.invoiceNumber,
        invoice.description,
        invoice.category,
        invoice.class,
        invoice.phone,
        invoice.status,
        invoice.paymentProvider,
        invoice.pendingPaymentProvider,
        normalizeNotificationStatus(invoice.customerNotificationStatus),
        getOutstandingAmount(invoice),
      ],
      invoiceFilters.search
    )
    );
  });
  const filteredRecurringInvoices = recurringInvoices.filter((schedule) =>
    searchMatches(
      [
        schedule.customerName,
        schedule.customer,
        schedule.description,
        schedule.phone,
        schedule.email,
        schedule.frequency,
        schedule.active === false ? "paused" : "active",
        schedule.amount,
        schedule.generatedCount,
        normalizeNotificationStatus(schedule.lastNotification?.status),
      ],
      recurringSearch
    )
  );
  const totalAmount = actionableInvoices.reduce(
    (sum, invoice) => sum + Number(getOutstandingAmount(invoice) || 0),
    0
  );
  const unpaidCount = actionableInvoices.length;
  const activeRecurringCount = recurringInvoices.filter(
    (schedule) => schedule.active !== false
  ).length;
  const recurringTotalAmount = recurringInvoices.reduce(
    (sum, schedule) => sum + Number(schedule.amount || 0),
    0
  );
  const dueRecurringCount = recurringInvoices.filter((schedule) => {
    if (schedule.active === false || !schedule.nextRunAt) return false;
    return new Date(schedule.nextRunAt) <= new Date();
  }).length;

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
          activePage === "invoices" ? (
            <button
              type="button"
              onClick={sendBulkReminders}
              disabled={sendingReminders || actionableInvoices.length === 0}
              className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20BA5C] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {sendingReminders ? "Sending reminders..." : "Remind all unpaid"}
            </button>
          ) : null
        }
      />

      {notice.text ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : notice.tone === "info"
                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActivePage("invoices")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activePage === "invoices"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Invoices
        </button>
        <button
          type="button"
          onClick={() => setActivePage("recurring")}
          className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            activePage === "recurring"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          Recurring invoices
        </button>
      </div>

      <div className="max-w-8xl">
        {activePage === "invoices" ? (
          <Toolbar>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
              <SelectField
                value={invoiceFilterForm.category}
                onChange={(event) => updateInvoiceFilterForm("category", event.target.value)}
                className="min-w-0"
              >
                <option value="all">All categories</option>
                {invoiceCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={invoiceFilterForm.provider}
                onChange={(event) => updateInvoiceFilterForm("provider", event.target.value)}
                className="min-w-0"
              >
                <option value="all">All gateways</option>
                {invoiceProviderOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </SelectField>
              <InputField
                type="date"
                value={invoiceFilterForm.dateFrom}
                onChange={(event) => updateInvoiceFilterForm("dateFrom", event.target.value)}
                className="min-w-0 w-full"
              />
              <InputField
                type="date"
                value={invoiceFilterForm.dateTo}
                onChange={(event) => updateInvoiceFilterForm("dateTo", event.target.value)}
                className="min-w-0 w-full"
              />
              <SelectField
                value={invoiceFilterForm.status}
                onChange={(event) => updateInvoiceFilterForm("status", event.target.value)}
                className="min-w-0"
              >
                <option value="all">All statuses</option>
                {invoiceStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={invoiceFilterForm.notification}
                onChange={(event) => updateInvoiceFilterForm("notification", event.target.value)}
                className="min-w-0"
              >
                <option value="all">All notifications</option>
                {notificationStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </SelectField>
              <div className="grid min-w-0 gap-3 2xl:grid-cols-1">
                <InputField
                  type="search"
                  value={invoiceFilterForm.search}
                  onChange={(event) => updateInvoiceFilterForm("search", event.target.value)}
                  placeholder="Search invoice, customer, phone"
                  className="w-full min-w-0"
                />
                <button
                  type="button"
                  onClick={applyInvoiceFilters}
                  className="rounded-xl bg-[#4B93C8] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#3D82B7]"
                >
                  Filter
                </button>
              </div>
            </div>
          </Toolbar>
        ) : (
          <>
            <label htmlFor="recurring-search" className="sr-only">
              Search recurring invoices
            </label>
            <input
              id="recurring-search"
              type="search"
              value={recurringSearch}
              onChange={(event) => setRecurringSearch(event.target.value)}
              placeholder="Search recurring invoices"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-800"
            />
          </>
        )}
      </div>

      <StatGrid className={activePage === "invoices" ? "xl:!grid-cols-3" : ""}>
        {activePage === "invoices" ? (
          <>
            <StatCard label="Total invoices" value={actionableInvoices.length} tone="slate" />
            <StatCard label="Total amount" value={`N${totalAmount.toLocaleString()}`} tone="blue" />
            <StatCard label="Unpaid" value={unpaidCount} tone="orange" />
          </>
        ) : (
          <>
            <StatCard label="Total schedules" value={recurringInvoices.length} tone="slate" />
            <StatCard label="Scheduled amount" value={`N${recurringTotalAmount.toLocaleString()}`} tone="blue" />
            <StatCard label="Active" value={activeRecurringCount} tone="emerald" />
            <StatCard label="Due now" value={dueRecurringCount} tone="orange" />
          </>
        )}
      </StatGrid>

      {activePage === "recurring" && (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Recurring invoices
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create schedules that automatically generate unpaid invoices on the next due date.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowRecurringForm(true)}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Create recurring invoice
              </button>
              <button
                type="button"
                onClick={runDueRecurringInvoices}
                disabled={runningRecurring}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {runningRecurring ? "Running..." : "Run due now"}
              </button>
            </div>
          </div>
          <SurfaceCard className="overflow-hidden">
            {recurringLoading ? (
              <div className="flex min-h-[14rem] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-r-transparent"></div>
              </div>
            ) : filteredRecurringInvoices.length === 0 ? (
              <EmptyState
                title={recurringInvoices.length === 0 ? "No recurring invoices found" : "No matching recurring invoices"}
                description={
                  recurringInvoices.length === 0
                    ? "Create a recurring invoice schedule to generate invoices automatically."
                    : "Try another name, phone number, description, or status."
                }
              />
            ) : (
              <>
                <div className="divide-y divide-slate-200 lg:hidden">
                  {filteredRecurringInvoices.map((schedule) => (
                    <div key={schedule._id} className="space-y-3 p-3.5 sm:p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            {schedule.customerName || schedule.customer || customerLabels.singularTitle}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Next: {formatDateTime(schedule.nextRunAt)}
                          </p>
                        </div>
                        <StatusBadge tone={schedule.active === false ? "slate" : "green"}>
                          {schedule.active === false ? "Paused" : "Active"}
                        </StatusBadge>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Details
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {schedule.description || "-"}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Phone: {schedule.phone || "-"}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Frequency: {schedule.frequency || "monthly"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Schedule
                          </p>
                          <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            N{Number(schedule.amount || 0).toLocaleString()}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Generated: {schedule.generatedCount || 0}
                          </p>
                          <StatusBadge tone={getNotificationTone(schedule.lastNotification?.status)}>
                            {normalizeNotificationStatus(schedule.lastNotification?.status)}
                          </StatusBadge>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleRecurringInvoice(schedule)}
                          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {schedule.active === false ? "Resume" : "Pause"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRecurringInvoice(schedule)}
                          className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                        <th className="w-[24%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          Schedule
                        </th>
                        <th className="w-[28%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          Details
                        </th>
                        <th className="w-[16%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          Amount
                        </th>
                        <th className="w-[16%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                          Notification
                        </th>
                        <th className="w-[16%] px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRecurringInvoices.map((schedule) => (
                        <tr key={schedule._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {schedule.customerName || schedule.customer || customerLabels.singularTitle}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {schedule.frequency || "monthly"}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Next: {formatDateTime(schedule.nextRunAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-2">
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {schedule.description || "-"}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Phone: {schedule.phone || "-"}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                Generated: {schedule.generatedCount || 0}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="space-y-2">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                N{Number(schedule.amount || 0).toLocaleString()}
                              </p>
                              <StatusBadge tone={schedule.active === false ? "slate" : "green"}>
                                {schedule.active === false ? "Paused" : "Active"}
                              </StatusBadge>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StatusBadge tone={getNotificationTone(schedule.lastNotification?.status)}>
                              {normalizeNotificationStatus(schedule.lastNotification?.status)}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="ml-auto flex max-w-[12rem] flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => toggleRecurringInvoice(schedule)}
                                className="whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                {schedule.active === false ? "Resume" : "Pause"}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRecurringInvoice(schedule)}
                                className="whitespace-nowrap rounded-xl bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SurfaceCard>
        </>
      )}

      {activePage === "recurring_legacy" && (
      <SurfaceCard className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Recurring invoices
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Create schedules that automatically generate unpaid invoices on the next due date.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowRecurringForm(true)}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Create recurring invoice
            </button>
            <button
              type="button"
              onClick={runDueRecurringInvoices}
              disabled={runningRecurring}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {runningRecurring ? "Running..." : "Run due now"}
            </button>
          </div>
        </div>

        {recurringInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No recurring invoice schedules yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recurringInvoices.map((schedule) => (
              <div
                key={schedule._id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {schedule.customerName || schedule.customer}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {schedule.description} · N{Number(schedule.amount || 0).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      {schedule.frequency || "monthly"} · next {formatDateTime(schedule.nextRunAt)}
                    </p>
                  </div>
                  <StatusBadge tone={schedule.active === false ? "slate" : "green"}>
                    {schedule.active === false ? "Paused" : "Active"}
                  </StatusBadge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRecurringInvoice(schedule)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {schedule.active === false ? "Resume" : "Pause"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRecurringInvoice(schedule)}
                    className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
      )}

      {activePage === "invoices" && (
      <SurfaceCard className="overflow-hidden">
        {filteredActionableInvoices.length === 0 ? (
          <EmptyState
            title={actionableInvoices.length === 0 ? "No open invoices found" : "No matching invoices"}
            description={
              actionableInvoices.length === 0
                ? "Only unpaid or partially paid invoices are shown here."
                : "Try another name, phone number, invoice number, description, or status."
            }
          />
        ) : (
          <>
            <div className="divide-y divide-slate-200 lg:hidden">
              {filteredActionableInvoices.map((invoice) => {
                const customerName =
                  invoice.customer || invoice.customerName || invoice.student || customerLabels.singularTitle;
                const invoiceCategory = invoice.category || invoice.class || "Uncategorized";

                return (
                  <div key={invoice._id} className="space-y-3 p-3.5 sm:p-4">
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-slate-900 dark:text-slate-100">{customerName}</p>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {invoice.invoiceNumber || "-"}
                      </p>
                      <StatusBadge tone="slate">{invoiceCategory}</StatusBadge>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(invoice.date)}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
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
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
                        >
                          <FiCheckCircle className="h-4 w-4" />
                          Mark paid
                        </button>
                      ) : null}
                      <button
                        onClick={() => shareWhatsApp(invoice)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#20BA5C]"
                      >
                        <FiMessageCircle className="h-4 w-4" />
                        Share on WhatsApp
                      </button>
                      <button
                        onClick={() => deleteInvoice(invoice._id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                      >
                        <FiTrash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1180px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Invoice No
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Customer
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Description
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Gateway
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Notification
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredActionableInvoices.map((invoice) => {
                  const customerName =
                    invoice.customer || invoice.customerName || invoice.student || customerLabels.singularTitle;
                  const invoiceCategory = invoice.category || invoice.class || "Uncategorized";

                  return (
                    <tr key={invoice._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/60">
                      <td className="px-5 py-3.5 align-top">
                        <p className="font-mono text-xs text-slate-900 dark:text-slate-100">
                          {invoice.invoiceNumber || "-"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {formatDateTime(invoice.date)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {customerName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{invoice.phone || "-"}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-1">
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {invoice.description || invoice.category || invoice.class || "-"}
                          </p>
                          <StatusBadge tone="slate">{invoiceCategory}</StatusBadge>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {invoice.paymentProvider ||
                            invoice.pendingPaymentProvider ||
                            "Not started"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          N{Number(getOutstandingAmount(invoice) || 0).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <StatusBadge tone={invoice.status === "Paid" ? "green" : "orange"}>
                          {invoice.status || "Unpaid"}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <StatusBadge tone={getNotificationTone(invoice.customerNotificationStatus)}>
                          {normalizeNotificationStatus(invoice.customerNotificationStatus)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 align-top">
                        <div className="ml-auto flex justify-end gap-2">
                          {invoice.status !== "Paid" && (
                            <button
                              onClick={() => markPaid(invoice._id)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-green-700"
                              title="Mark paid"
                            >
                              <FiCheckCircle className="h-3.5 w-3.5" />
                              <span>Paid</span>
                            </button>
                          )}
                          <button
                            onClick={() => shareWhatsApp(invoice)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#20BA5C]"
                            title="Share on WhatsApp"
                          >
                            <FiMessageCircle className="h-3.5 w-3.5" />
                            <span>Share</span>
                          </button>
                          <button
                            onClick={() => deleteInvoice(invoice._id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700"
                            title="Delete invoice"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
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
      )}

      {showRecurringForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Create recurring invoice
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Set the customer, amount, frequency, and next generation date.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecurringForm(false)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={createRecurringInvoice} className="grid gap-4 p-6 sm:grid-cols-2">
              <input
                type="text"
                value={recurringForm.customerName}
                onChange={(event) => updateRecurringForm("customerName", event.target.value)}
                placeholder={`${customerLabels.singularTitle} name`}
                required
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                type="tel"
                value={recurringForm.phone}
                onChange={(event) => updateRecurringForm("phone", event.target.value)}
                placeholder="Phone number"
                required
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                type="text"
                value={recurringForm.description}
                onChange={(event) => updateRecurringForm("description", event.target.value)}
                placeholder="Description"
                required
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:col-span-2"
              />
              <input
                type="number"
                min="1"
                value={recurringForm.amount}
                onChange={(event) => updateRecurringForm("amount", event.target.value)}
                placeholder="Amount"
                required
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <select
                value={recurringForm.frequency}
                onChange={(event) => updateRecurringForm("frequency", event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
              <input
                type="date"
                value={recurringForm.nextRunAt}
                onChange={(event) => updateRecurringForm("nextRunAt", event.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <input
                type="email"
                value={recurringForm.email}
                onChange={(event) => updateRecurringForm("email", event.target.value)}
                placeholder="Email address (optional)"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <div className="flex gap-3 pt-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowRecurringForm(false)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecurring}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingRecurring ? "Creating..." : "Create schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageShell>
  );
}


