"use client";

import { useState } from "react";
import { authFetch } from "../lib/authFetch";
import { getCustomerLabels } from "../lib/businessLabels";
import { useBusinessSession } from "../lib/clientSession";
import { generateInvoiceToken } from "../lib/invoiceUtils";

export default function AddCustomerModal({ 
  isOpen, 
  onClose, 
  onCustomerAdded,
  defaultCategory = "" 
}) {
  const session = useBusinessSession();
  const customerLabels = getCustomerLabels(session.businessType);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    category: defaultCategory,
    location: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.category) {
      alert("Please fill all required fields");
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

      alert(`${customerLabels.singularTitle} added under ${formData.category}!`);

      setFormData({
        name: "",
        phone: "",
        email: "",
        category: defaultCategory,
        location: "",
      });
    } catch (error) {
      console.error(error);
      alert(`Failed to add ${customerLabels.singular}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-8 py-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900">Add New {customerLabels.singularTitle}</h2>
          <p className="text-gray-500 mt-1">
            {defaultCategory ? `Adding to category: ${defaultCategory}` : `Enter the ${customerLabels.singular}'s details`}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{customerLabels.singularTitle} Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="08012345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={`${customerLabels.singular}@example.com`} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Retail, VIP Clients, Real Estate, or your own category"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location / Address (Optional)</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Lagos, Nigeria" />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3.5 text-gray-700 font-medium border border-gray-300 rounded-2xl hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-2xl transition">
              {submitting ? "Creating..." : `Add ${customerLabels.singularTitle}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
