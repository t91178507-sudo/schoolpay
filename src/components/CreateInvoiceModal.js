"use client";

import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import { generateInvoiceToken } from "../lib/invoiceUtils";
import { useToast } from "./AppFeedback";

export default function CreateInvoiceModal({ isOpen, onClose, onInvoiceAdded }) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    customer: "",
    phone: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({
      customer: "",
      phone: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer || !formData.phone || !formData.amount || !formData.description) {
      toast("warning", "Customer name, phone number, amount, and description are required");
      return;
    }

    setLoading(true);

    try {
      const token = generateInvoiceToken("inv");
      const amount = Number(formData.amount);
      const description = formData.description.trim();
      const invoicePayload = {
        customer: formData.customer.trim(),
        customerName: formData.customer.trim(),
        phone: formData.phone.trim(),
        description,
        items: [
          {
            id: "item-1",
            description,
            quantity: 1,
            unitPrice: amount,
            lineTotal: amount,
          },
        ],
        subtotal: amount,
        amount,
        dueDate: formData.date,
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Create New Invoice</h2>
          <p className="text-gray-500 mt-1 dark:text-slate-400">Generate an invoice for a customer</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
              Customer Name
            </label>
            <input
              type="text"
              name="customer"
              value={formData.customer}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="08012345678"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
                Amount (NGN)
              </label>
              <input
                type="number"
                name="amount"
                min="1"
                value={formData.amount}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="45000"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={3}
              className="w-full resize-y rounded-2xl border border-gray-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="What this invoice is for"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
              Due Date
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              {loading ? "Creating Invoice..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


