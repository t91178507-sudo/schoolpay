"use client";

import { useRef, useState } from "react";
import {
  FiCalendar,
  FiFileText,
  FiPhone,
  FiPlus,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";
import { authFetch } from "../lib/authFetch";
import { generateInvoiceToken } from "../lib/invoiceUtils";
import { useToast } from "./AppFeedback";

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function createItem(index = 0) {
  return {
    id: `item-${Date.now()}-${index}`,
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

export default function CreateInvoiceModal({ isOpen, onClose, onInvoiceAdded }) {
  const toast = useToast();
  const dueDateRef = useRef(null);
  const [formData, setFormData] = useState({
    customer: "",
    phone: "",
    description: "",
    dueDate: getToday(),
  });
  const [items, setItems] = useState([createItem()]);
  const [loading, setLoading] = useState(false);

  const totalAmount = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);
    return sum + (Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0);
  }, 0);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const updateItem = (id, field, value) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((current) => [...current, createItem(current.length)]);
  };

  const removeItem = (id) => {
    setItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id)
    );
  };

  const resetForm = () => {
    setFormData({
      customer: "",
      phone: "",
      description: "",
      dueDate: getToday(),
    });
    setItems([createItem()]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedItems = items.map((item, index) => ({
      id: item.id || `item-${index + 1}`,
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.quantity) * Number(item.unitPrice),
    }));
    const hasInvalidItem = normalizedItems.some(
      (item) =>
        !item.description ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0
    );

    if (!formData.customer || !formData.phone || !formData.description || !formData.dueDate) {
      toast("warning", "Customer name, phone number, description, and due date are required");
      return;
    }

    if (hasInvalidItem || totalAmount <= 0) {
      toast("warning", "Complete each item and enter a valid quantity and unit price");
      return;
    }

    setLoading(true);

    try {
      const token = generateInvoiceToken("inv");
      const description = formData.description.trim();
      const invoicePayload = {
        customer: formData.customer.trim(),
        customerName: formData.customer.trim(),
        phone: formData.phone.trim(),
        description,
        items: normalizedItems,
        subtotal: totalAmount,
        amount: totalAmount,
        dueDate: formData.dueDate,
        date: new Date().toISOString(),
        status: "Unpaid",
        token,
        customerToken: token,
        businessName: localStorage.getItem("businessName") || "",
        businessLogo: localStorage.getItem("businessLogo") || "",
      };

      const res = await authFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoicePayload),
      });
      const invoiceData = await res.json().catch(() => ({}));

      if (!res.ok || !invoiceData.insertedId) {
        throw new Error(invoiceData.error || "Failed to create invoice");
      }

      let notificationWarning = "";

      try {
        const notificationRes = await authFetch("/api/notifications/whatsapp/invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: String(invoiceData.insertedId),
            origin: window.location.origin,
          }),
        });
        const notificationData = await notificationRes.json().catch(() => ({}));

        if (!notificationRes.ok) {
          notificationWarning =
            notificationData.error || "The WhatsApp message could not be sent.";
        } else if (notificationData?.delivery?.fallbackUrl) {
          const opened = window.open(
            notificationData.delivery.fallbackUrl,
            "_blank",
            "noopener,noreferrer"
          );

          if (!opened) {
            notificationWarning =
              "The invoice was created, but the browser blocked the WhatsApp window.";
          }
        } else if (notificationData?.delivery?.sent !== true) {
          notificationWarning = "The invoice was created, but WhatsApp did not confirm delivery.";
        }
      } catch {
        notificationWarning = "The invoice was created, but WhatsApp could not be reached.";
      }

      await onInvoiceAdded?.(invoiceData);
      onClose();
      resetForm();

      if (notificationWarning) {
        toast("warning", `${invoiceData.invoiceNumber}: ${notificationWarning}`);
      } else {
        toast("success", `${invoiceData.invoiceNumber} created and shared on WhatsApp.`);
      }
    } catch (error) {
      console.error(error);
      toast("error", error.message || "Unable to create invoice");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
  const labelClass =
    "text-sm font-medium text-slate-700 dark:text-slate-300";
  const iconFieldClass =
    "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
              Invoice setup
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
              Create invoice
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add customer details, line items, and a due date.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden rounded-lg border border-slate-200 bg-white px-4 py-2 text-right dark:border-slate-800 dark:bg-slate-900 sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Total
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-white">
                N{totalAmount.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close create invoice"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClass}>Customer name</span>
                  <span className="relative block">
                    <FiUser className={iconFieldClass} />
                    <input
                      type="text"
                      name="customer"
                      value={formData.customer}
                      onChange={handleChange}
                      required
                      className={`${inputClass} pl-10`}
                      placeholder="John Doe"
                    />
                  </span>
                </label>

                <label className="space-y-2">
                  <span className={labelClass}>Phone number</span>
                  <span className="relative block">
                    <FiPhone className={iconFieldClass} />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className={`${inputClass} pl-10`}
                      placeholder="08012345678"
                    />
                  </span>
                </label>
              </div>

              <label className="block space-y-2">
                <span className={labelClass}>Invoice description</span>
                <span className="relative block">
                  <FiFileText className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={3}
                    className={`${inputClass} resize-y pl-10`}
                    placeholder="What this invoice is for"
                  />
                </span>
              </label>
            </section>

            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/40" aria-labelledby="invoice-items-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 id="invoice-items-heading" className="text-sm font-semibold text-slate-950 dark:text-white">Line items</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add each charge that should appear on the invoice PDF.</p>
                </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FiPlus className="h-4 w-4" />
                Add item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <label className="col-span-12 space-y-1.5 md:col-span-6">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Item {index + 1}</span>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) => updateItem(item.id, "description", event.target.value)}
                        className={inputClass}
                        placeholder="Item description"
                        required
                      />
                    </label>
                    <label className="col-span-4 space-y-1.5 md:col-span-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Quantity</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
                        className={`${inputClass} px-3`}
                        required
                      />
                    </label>
                    <label className="col-span-8 space-y-1.5 md:col-span-4">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unit price (NGN)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => updateItem(item.id, "unitPrice", event.target.value)}
                          className={`${inputClass} min-w-0 px-3`}
                          placeholder="0"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35 dark:border-red-900/70 dark:hover:bg-red-950/40"
                          title="Remove item"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </label>
                    <div className="col-span-12 flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400">Line total</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">N{Number.isFinite(lineTotal) ? lineTotal.toLocaleString() : "0"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Invoice total</span>
              <span className="text-xl font-semibold text-slate-950 dark:text-white">N{totalAmount.toLocaleString()}</span>
            </div>
            </section>

            <label className="block space-y-2">
              <span className={labelClass}>Due date</span>
              <div className="relative">
                <input
                  ref={dueDateRef}
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  min={getToday()}
                  onChange={handleChange}
                  required
                  className={`${inputClass} pr-12 [&::-webkit-calendar-picker-indicator]:opacity-0`}
                />
                <button
                  type="button"
                  onClick={() => dueDateRef.current?.showPicker?.()}
                  className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  title="Open calendar"
                  aria-label="Open due date calendar"
                >
                  <FiCalendar className="h-5 w-5" />
                </button>
              </div>
            </label>
          </div>

          <div className="grid gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950 sm:max-w-xs">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Invoice total
              </p>
              <p className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-white">
                N{totalAmount.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {loading ? "Creating invoice..." : "Create invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
