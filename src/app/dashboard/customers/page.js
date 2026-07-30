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
import { getCustomerLabels } from "../../../lib/businessLabels";
import { useBusinessSession } from "../../../lib/clientSession";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getInvoicePaidAmount(invoice) {
  return Number(invoice.paidAmount || invoice.amountPaid || 0);
}

function getInvoiceBalance(invoice) {
  const amount = Number(invoice.amount || 0);
  const balanceDue = Number(invoice.balanceDue || 0);
  if (balanceDue > 0) return balanceDue;
  return Math.max(amount - getInvoicePaidAmount(invoice), 0);
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name) {
  const colors = [
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getBalanceStatus(customer) {
  if (customer.amountPending === 0) return "settled";
  if (customer.amountPaid > 0) return "partial";
  return "pending";
}

function BalanceStatusBadge({ status }) {
  const config = {
    settled: {
      label: "Fully paid",
      className:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-500/20",
    },
    partial: {
      label: "Partially paid",
      className:
        "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-500/20",
    },
    pending: {
      label: "Pending",
      className:
        "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-500/20",
    },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export default function CustomersOverview() {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [filterForm, setFilterForm] = useState({
    search: "",
    category: "all",
    balanceStatus: "all",
  });
  const [filters, setFilters] = useState({
    search: "",
    category: "all",
    balanceStatus: "all",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersRes, invoicesRes] = await Promise.all([
          authFetch("/api/customers"),
          authFetch("/api/invoices"),
        ]);

        const customersData = customersRes.ok ? await customersRes.json() : [];
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : [];

        setCustomers(Array.isArray(customersData) ? customersData : []);
        setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      } catch (err) {
        console.error(err);
        setError(`Failed to load ${customerLabels.plural}`);
      } finally {
        setLoading(false);
      }
    };

    const initialLoad = setTimeout(loadData, 0);
    return () => clearTimeout(initialLoad);
  }, [customerLabels.plural]);

  const customerRows = useMemo(() => {
    return customers
      .map((customer) => {
        const customerInvoices = invoices.filter(
          (inv) =>
            (customer.token && inv.customerToken === customer.token) ||
            (!customer.token &&
              (inv.customer || inv.customerName || inv.student) === customer.name)
        );

        const totalAmount = customerInvoices.reduce(
          (sum, inv) => sum + Number(inv.amount || 0),
          0
        );

        const amountPaid = customerInvoices.reduce(
          (sum, inv) => sum + getInvoicePaidAmount(inv),
          0
        );
        const amountPending = customerInvoices.reduce(
          (sum, inv) => sum + getInvoiceBalance(inv),
          0
        );

        return {
          ...customer,
          invoiceCount: customerInvoices.length,
          totalAmount,
          amountPaid,
          amountPending,
          invoices: customerInvoices.sort(
            (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
          ),
        };
      })
      .sort((a, b) => {
        if (b.amountPending !== a.amountPending) {
          return b.amountPending - a.amountPending;
        }
        return a.name.localeCompare(b.name);
      });
  }, [customers, invoices]);

  const totalReceivables = customerRows.reduce(
    (sum, customer) => sum + Number(customer.totalAmount || 0),
    0
  );
  const totalPending = customerRows.reduce(
    (sum, customer) => sum + Number(customer.amountPending || 0),
    0
  );
  const totalPaid = customerRows.reduce(
    (sum, customer) => sum + Number(customer.amountPaid || 0),
    0
  );

  const customerCategoryOptions = Array.from(
    new Set(customerRows.map((customer) => customer.category || "Uncategorized"))
  ).sort((a, b) => a.localeCompare(b));

  const filteredCustomerRows = customerRows.filter((customer) => {
    const normalizedQuery = filters.search.trim().toLowerCase();
    const customerCategory = customer.category || "Uncategorized";
    const balanceStatus = getBalanceStatus(customer);

    const matchesCategory =
      filters.category === "all" || customerCategory === filters.category;
    const matchesBalanceStatus =
      filters.balanceStatus === "all" || balanceStatus === filters.balanceStatus;

    if (!normalizedQuery) {
      return matchesCategory && matchesBalanceStatus;
    }

    const matchesSearch = [
      customer.name,
      customer.phone,
      customer.email,
      customer.category,
      customer.token,
      customer.invoiceCount,
      customer.totalAmount,
      customer.amountPaid,
      customer.amountPending,
    ]
      .filter((value) => value !== undefined && value !== null)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));

    return matchesCategory && matchesBalanceStatus && matchesSearch;
  });

  const customersMatchingFilters = customerRows.filter((customer) => {
    const customerCategory = customer.category || "Uncategorized";
    const balanceStatus = getBalanceStatus(customer);

    return (
      (filters.category === "all" || customerCategory === filters.category) &&
      (filters.balanceStatus === "all" || balanceStatus === filters.balanceStatus)
    );
  });

  const applyFilters = () => setFilters(filterForm);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading customers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/30 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{error}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Something went wrong while loading your data.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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
        title={`${customerLabels.singularTitle} overview`}
        description={`See each ${customerLabels.singular}'s invoice count, paid totals, and what is still outstanding.`}
      />

      <StatGrid className="xl:!grid-cols-4">
        <StatCard
          label={`Active ${customerLabels.plural}`}
          value={customersMatchingFilters.length}
          tone="blue"
        />
        <StatCard
          label="Total invoiced"
          value={formatCurrency(totalReceivables)}
          tone="slate"
        />
        <StatCard
          label="Total collected"
          value={formatCurrency(totalPaid)}
          tone="emerald"
        />
        <StatCard
          label="Still pending"
          value={formatCurrency(totalPending)}
          tone="orange"
        />
      </StatGrid>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {customerLabels.pluralTitle}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {filteredCustomerRows.length} of {customerRows.length} shown
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SelectField
                value={filterForm.category}
                onChange={(event) =>
                  setFilterForm((current) => ({ ...current, category: event.target.value }))
                }
                className="min-w-[140px]"
              >
                <option value="all">All categories</option>
                {customerCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectField>
              <SelectField
                value={filterForm.balanceStatus}
                onChange={(event) =>
                  setFilterForm((current) => ({ ...current, balanceStatus: event.target.value }))
                }
                className="min-w-[140px]"
              >
                <option value="all">All balances</option>
                <option value="pending">Pending only</option>
                <option value="partial">Partially paid</option>
                <option value="settled">Fully paid</option>
              </SelectField>
              <div className="relative">
                <InputField
                  type="search"
                  value={filterForm.search}
                  onChange={(event) =>
                    setFilterForm((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder={`Search ${customerLabels.plural}...`}
                  className="min-w-[220px]"
                />
              </div>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {filteredCustomerRows.length === 0 ? (
          <div className="px-6 py-16">
            <EmptyState
              title={
                customerRows.length === 0
                  ? `No ${customerLabels.plural} found`
                  : `No matching ${customerLabels.plural}`
              }
              description={
                customerRows.length === 0
                  ? `Add a ${customerLabels.singular} first, then invoice activity will appear here.`
                  : "Try adjusting your filters or search terms."
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 lg:hidden">
              {filteredCustomerRows.map((customer) => {
                const status = getBalanceStatus(customer);
                const paidPercent =
                  customer.totalAmount > 0
                    ? Math.round((customer.amountPaid / customer.totalAmount) * 100)
                    : 0;

                return (
                  <div key={customer._id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(
                          customer.name
                        )}`}
                      >
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {customer.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {customer.phone || "No phone"}
                            </p>
                          </div>
                          <BalanceStatusBadge status={status} />
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Invoices
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                              {customer.invoiceCount}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Paid
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-emerald-600">
                              {formatCurrency(customer.amountPaid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Pending
                            </p>
                            <p className="mt-0.5 text-sm font-semibold text-orange-600">
                              {formatCurrency(customer.amountPending)}
                            </p>
                          </div>
                        </div>

                        {customer.totalAmount > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400">
                                {paidPercent}% collected
                              </span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                of {formatCurrency(customer.totalAmount)}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${paidPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex items-center justify-between">
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                            {customer.category || "Uncategorized"}
                          </span>
                          <button
                            onClick={() => setHistoryCustomer(customer)}
                            className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View history →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {customerLabels.singularTitle}
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Invoices
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paid
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pending
                    </th>
                    <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Progress
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCustomerRows.map((customer) => {
                    const status = getBalanceStatus(customer);
                    const paidPercent =
                      customer.totalAmount > 0
                        ? Math.round((customer.amountPaid / customer.totalAmount) * 100)
                        : 0;

                    return (
                      <tr
                        key={customer._id}
                        className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-950/40"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(
                                customer.name
                              )}`}
                            >
                              {getInitials(customer.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {customer.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {customer.phone || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                            {customer.category || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {customer.invoiceCount}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(customer.totalAmount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(customer.amountPaid)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                            {formatCurrency(customer.amountPending)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full max-w-[140px]">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 dark:text-slate-400">{paidPercent}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${paidPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <BalanceStatusBadge status={status} />
                            <button
                              onClick={() => setHistoryCustomer(customer)}
                              className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                              title="View payment history"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
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

      {/* History Modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-8 py-6 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(
                    historyCustomer.name
                  )}`}
                >
                  {getInitials(historyCustomer.name)}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {historyCustomer.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>{historyCustomer.phone || "No phone"}</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>{historyCustomer.invoiceCount} invoice{historyCustomer.invoiceCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setHistoryCustomer(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Modal Stats */}
            <div className="grid grid-cols-3 gap-px border-b border-slate-100 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
              <div className="bg-white p-4 text-center dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(historyCustomer.totalAmount)}</p>
              </div>
              <div className="bg-white p-4 text-center dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paid</p>
                <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(historyCustomer.amountPaid)}</p>
              </div>
              <div className="bg-white p-4 text-center dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending</p>
                <p className="mt-1 text-lg font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(historyCustomer.amountPending)}</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {historyCustomer.invoices.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800">
                    <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">No invoices yet</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Payment history will appear here once invoices are generated.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyCustomer.invoices.map((invoice) => {
                    const balance = getInvoiceBalance(invoice);
                    const paidAmount = getInvoicePaidAmount(invoice);
                    const isPaid = invoice.status === "Paid" || balance === 0;

                    return (
                      <div
                        key={invoice._id}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {invoice.description || invoice.category || "Invoice"}
                            </p>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                isPaid
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-300"
                                  : "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-950/30 dark:text-orange-300"
                              }`}
                            >
                              {invoice.status || "Unpaid"}
                            </span>
                          </div>
                          <p className="mt-1 font-mono text-xs text-slate-400">
                            {invoice.invoiceNumber || "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(invoice.paidAt || invoice.date)}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(invoice.amount)}
                          </p>
                          <div className="flex items-center gap-3 text-xs">
                            {paidAmount > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Paid {formatCurrency(paidAmount)}
                              </span>
                            )}
                            {balance > 0 && (
                              <span className="text-orange-600 dark:text-orange-400">
                                Bal {formatCurrency(balance)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}