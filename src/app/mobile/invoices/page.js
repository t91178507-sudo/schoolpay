"use client";

import { useEffect, useState } from "react";
import { FiFileText, FiPlus } from "react-icons/fi";
import { authFetch } from "../../../lib/authFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export default function MobileInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    description: "",
    amount: "",
  });

  const loadData = async () => {
    try {
      const [invoiceRes, customerRes] = await Promise.all([
        authFetch("/api/mobile/invoices"),
        authFetch("/api/mobile/customers"),
      ]);
      const invoiceData = await invoiceRes.json().catch(() => []);
      const customerData = await customerRes.json().catch(() => []);

      if (!invoiceRes.ok) {
        throw new Error(invoiceData.error || "Unable to load invoices");
      }

      if (!customerRes.ok) {
        throw new Error(customerData.error || "Unable to load customers");
      }

      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setCustomers(Array.isArray(customerData) ? customerData : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load invoices");
    }
  };

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      loadData();
    }, 0);

    return () => clearTimeout(loadTimer);
  }, []);

  const createInvoice = async () => {
    setSaving(true);
    setError("");

    try {
      const selectedCustomer = customers.find((customer) => customer._id === form.customerId);
      const res = await authFetch("/api/mobile/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          customerName:
            selectedCustomer?.name || selectedCustomer?.customerName || form.customerName,
          description: form.description,
          amount: Number(form.amount || 0),
          phone: selectedCustomer?.phone || "",
          email: selectedCustomer?.email || "",
          category: selectedCustomer?.category || "",
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to create invoice");
      }

      setForm({
        customerId: "",
        customerName: "",
        description: "",
        amount: "",
      });
      await loadData();
    } catch (createError) {
      setError(createError.message || "Unable to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-300">
            <FiPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">Create invoice</h2>
            <p className="mt-1 text-sm text-slate-400">Prepare a customer invoice from your phone.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={form.customerId}
            onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-blue-500"
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name || customer.customerName || customer.student}
              </option>
            ))}
          </select>
          <input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 sm:col-span-2"
          />
          <input
            type="number"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Amount"
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
          />
          <button
            onClick={createInvoice}
            disabled={saving}
            className="min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create invoice"}
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-2">
        {invoices.map((invoice) => (
          <div key={invoice._id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-slate-300">
                  <FiFileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{invoice.customer || invoice.customerName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{invoice.invoiceNumber}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                {invoice.status}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-400">{invoice.description || "-"}</p>
            <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-white">{formatCurrency(invoice.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
