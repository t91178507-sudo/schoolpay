"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiBriefcase, FiUpload } from "react-icons/fi";
import { authFetch } from "../../../lib/authFetch";
import { emitSessionChange, useBusinessSession } from "../../../lib/clientSession";

const BUSINESS_TYPES = [
  "Sole Proprietorship",
  "Partnership",
  "Registered Company",
  "School / Educational Institution",
  "Professional Practice",
  "Nonprofit / NGO",
  "Religious Organization",
  "Other",
];

const INDUSTRIES = [
  "Education",
  "Healthcare",
  "Retail & Supermarkets",
  "Professional Services",
  "Hospitality",
  "Manufacturing",
  "Logistics & Transportation",
  "Other",
];

export default function BusinessSetupPage() {
  const router = useRouter();
  const session = useBusinessSession();
  const [form, setForm] = useState({
    name: "",
    type: "",
    industry: "",
    email: session.userEmail || "",
    phone: session.userPhone || "",
    address: "",
    website: "",
    logo: "",
  });
  const [logoName, setLogoName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Logo must be a JPG or PNG file no larger than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, logo: String(reader.result || "") }));
      setLogoName(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await authFetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create business.");

      localStorage.setItem("businessName", data.business?.name || form.name);
      localStorage.setItem("businessType", data.business?.type || form.type);
      localStorage.setItem("businessLogo", data.business?.logo || form.logo);
      localStorage.setItem("hasBusiness", "true");
      localStorage.setItem(
        "businessVerificationStatus",
        data.business?.verificationStatus || "pending_verification"
      );
      localStorage.setItem("businessVerified", "false");
      emitSessionChange();
      router.replace("/dashboard/verification?created=1");
    } catch (submitError) {
      setError(submitError.message || "Unable to create business.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <p className="text-sm font-semibold text-blue-700">Business setup</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Create your business</h1>
        <p className="mt-2 text-sm text-slate-600">
          Add the business customers will see on invoices and payment pages.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-4 border-b border-slate-100 pb-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FiBriefcase className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Business information</h2>
            <p className="text-sm text-slate-500">Fields marked required must be completed.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business Name" required>
            <input name="name" value={form.name} onChange={update} required className="form-input" />
          </Field>
          <Field label="Business Type" required>
            <select name="type" value={form.type} onChange={update} required className="form-input">
              <option value="">Select business type</option>
              {BUSINESS_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Industry" required>
            <select name="industry" value={form.industry} onChange={update} required className="form-input">
              <option value="">Select industry</option>
              {INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Business Email" required>
            <input type="email" name="email" value={form.email} onChange={update} required className="form-input" />
          </Field>
          <Field label="Business Phone Number" required>
            <input type="tel" name="phone" value={form.phone} onChange={update} required className="form-input" />
          </Field>
          <Field label="Website" hint="Optional">
            <input type="url" name="website" value={form.website} onChange={update} placeholder="https://example.com" className="form-input" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Business Address" required>
              <textarea name="address" value={form.address} onChange={update} required rows={3} className="form-input resize-none" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-800">Business Logo <span className="font-normal text-slate-400">(Optional)</span></label>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50">
              <FiUpload />
              {logoName || "Choose JPG or PNG"}
              <input type="file" accept=".jpg,.jpeg,.png" onChange={handleLogo} className="sr-only" />
            </label>
          </div>
        </div>

        {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="mt-7 flex justify-end">
          <button disabled={saving} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">
            {saving ? "Creating..." : "Create Business"}
          </button>
        </div>
      </form>
      <style jsx global>{`
        .form-input { margin-top: 0.5rem; width: 100%; border-radius: 0.75rem; border: 1px solid #cbd5e1; padding: 0.75rem 0.875rem; color: #0f172a; outline: none; }
        .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12); }
      `}</style>
    </div>
  );
}

function Field({ label, required = false, hint = "", children }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label} {required ? <span className="text-red-500">*</span> : null}
      {hint ? <span className="font-normal text-slate-400"> ({hint})</span> : null}
      {children}
    </label>
  );
}
