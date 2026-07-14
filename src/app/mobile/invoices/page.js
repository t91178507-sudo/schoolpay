"use client";

import { useEffect, useState } from "react";
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
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-lg font-semibold text-white">Create Invoice</h2>
        <div className="mt-4 space-y-3">
          <select
            value={form.customerId}
            onChange={(event) => setForm((current) => ({ ...current, customerId: event.target.value }))}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
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
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          />
          <input
            type="number"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Amount"
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none"
          />
          <button
            onClick={createInvoice}
            disabled={saving}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
          >
            {saving ? "Creating..." : "Create Invoice"}
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="space-y-3">
        {invoices.map((invoice) => (
          <div key={invoice._id} className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{invoice.customer || invoice.customerName}</p>
                <p className="text-xs text-slate-500">{invoice.invoiceNumber}</p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {invoice.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{invoice.description || "-"}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-white">{formatCurrency(invoice.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
