"use client";

import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import { getCustomerLabels, isSchoolBusinessType } from "../lib/businessLabels";
import { useBusinessSession } from "../lib/clientSession";
import { generateInvoiceToken } from "../lib/invoiceUtils";
import { useToast } from "./AppFeedback";

export default function AddCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerAdded,
  defaultCategory = "" 
}) {
  const toast = useToast();
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const isSchoolBusiness = isSchoolBusinessType(session.businessType);
  const [formData, setFormData] = useState({
    name: "",
    guardianName: "",
    phone: "",
    email: "",
    category: defaultCategory,
    location: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const value = e.target.name === "name" ? e.target.value.toUpperCase() : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.category) {
      toast("warning", "Please fill all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const token = generateInvoiceToken("inv");

      const businessName =
        typeof window !== "undefined"
          ? localStorage.getItem("businessName") || ""
          : "";

      const customerData = {
        ...formData,
        businessName,
        token,
        paymentLink: `/pay/${token}`,
        createdAt: new Date().toISOString(),
      };

      const res = await authFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customerData),
      });

      if (!res.ok) throw new Error("Failed to create customer");

      const newCustomer = await res.json();

      onCustomerAdded?.(newCustomer);
      onClose();

      toast("success", `${customerLabels.singularTitle} added under ${formData.category}.`);

      setFormData({
        name: "",
        guardianName: "",
        phone: "",
        email: "",
        category: defaultCategory,
        location: "",
      });
    } catch (error) {
      console.error(error);
      toast("error", `Failed to add ${customerLabels.singular}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden dark:bg-slate-900">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-slate-800">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Add New {customerLabels.singularTitle}</h2>
          <p className="text-gray-500 mt-1 dark:text-slate-400">
            {defaultCategory ? `Adding to category: ${defaultCategory}` : `Enter the ${customerLabels.singular}'s details`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">{customerLabels.singularTitle} Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="John Doe" />
          </div>

          {isSchoolBusiness ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">
                Guardian Name
              </label>
              <input
                type="text"
                name="guardianName"
                value={formData.guardianName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Parent or guardian name"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="08012345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder={`${customerLabels.singular}@example.com`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder="e.g. Retail, VIP Clients, Real Estate, or your own category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-300">Location / Address (Optional)</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" placeholder="Lagos, Nigeria" />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:bg-slate-300">
              {submitting ? "Creating..." : `Add ${customerLabels.singularTitle}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


