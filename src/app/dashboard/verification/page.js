"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheckCircle, FiClock, FiFileText, FiShield, FiUpload } from "react-icons/fi";
import { authFetch } from "../../../lib/authFetch";
import { emitSessionChange } from "../../../lib/clientSession";

const STATUS_VIEW = {
  pending_verification: { label: "Pending Verification", tone: "amber", detail: "Complete the requirements below and submit them for review." },
  under_review: { label: "Under Review", tone: "blue", detail: "InvoiceHub Admin is reviewing your business information." },
  verified: { label: "Verified Business", tone: "green", detail: "Your business can use all InvoiceHub features." },
  rejected: { label: "Rejected", tone: "red", detail: "Update the requested information and submit again." },
  suspended: { label: "Suspended", tone: "red", detail: "This business cannot use customer-facing features. Contact InvoiceHub support." },
};

export default function VerificationPage() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    bankAccountName: "",
    accountNumber: "",
    bankName: "",
    taxIdentificationNumber: "",
  });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/api/businesses/verification");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load verification.");
      setData(result);
      if (result.business) {
        localStorage.setItem("businessVerificationStatus", result.business.verificationStatus || "pending_verification");
        localStorage.setItem("businessVerified", String(result.business.isVerified === true));
        emitSessionChange();
      }
      const business = result.business || {};
      setForm({
        bankAccountName: business.bankAccountName || "",
        accountNumber: business.accountNumber || "",
        bankName: business.bankName || "",
        taxIdentificationNumber: business.taxIdentificationNumber || "",
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = new FormData();
      payload.set("intent", "submit");
      Object.entries(form).forEach(([key, value]) => payload.set(key, value));
      Object.entries(files).forEach(([key, value]) => value && payload.set(key, value));
      const response = await authFetch("/api/businesses/verification", { method: "POST", body: payload });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to submit verification.");
      setMessage(result.message);
      localStorage.setItem("businessVerificationStatus", result.verificationStatus);
      localStorage.setItem("businessVerified", String(result.verificationStatus === "verified"));
      emitSessionChange();
      await load();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex min-h-[24rem] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /></div>;
  if (!data?.business) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">Create your business profile before starting verification.</div>;

  const business = data.business;
  const status = STATUS_VIEW[business.verificationStatus] || STATUS_VIEW.pending_verification;
  const locked = ["under_review", "verified", "suspended"].includes(business.verificationStatus);
  const uploaded = new Map((business.documents || []).map((document) => [document.documentType, document]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-700">Business verification</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">{business.name}</h1>
          <p className="mt-2 text-sm text-slate-600">See what is required and track every review decision.</p>
        </div>
        <StatusBadge status={business.verificationStatus} label={status.label} />
      </div>

      <section className={`rounded-2xl border p-5 ${status.tone === "green" ? "border-emerald-200 bg-emerald-50" : status.tone === "red" ? "border-red-200 bg-red-50" : status.tone === "blue" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex gap-3">
          {business.isVerified ? <FiCheckCircle className="mt-0.5 h-6 w-6 text-emerald-700" /> : <FiShield className="mt-0.5 h-6 w-6 text-slate-700" />}
          <div>
            <h2 className="font-semibold text-slate-950">{status.label}</h2>
            <p className="mt-1 text-sm text-slate-700">{status.detail}</p>
            {!business.isVerified ? <p className="mt-2 text-sm text-slate-600">You can create customers and invoices now. Sending invoices, payment links, QR codes, WhatsApp messages, gateway connections, staff invitations, and public payments unlock after approval.</p> : null}
            {business.rejectionReason ? <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-red-700">Reason: {business.rejectionReason}</p> : null}
            {business.informationRequest?.requestedDocument ? <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm text-amber-900">Requested: <strong>{business.informationRequest.requestedDocument}</strong>. {business.informationRequest.reason}{business.informationRequest.deadline ? ` Upload by ${business.informationRequest.deadline}.` : ""}</p> : null}
          </div>
        </div>
      </section>

      {!business.isVerified && business.verificationStatus !== "suspended" ? (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-950">Verification documents</h2>
            <p className="mt-1 text-sm text-slate-500">PDF, JPG, or PNG. Maximum 10 MB per file.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <UploadField label="Valid Government ID" required current={uploaded.get("governmentId")} disabled={locked} onChange={(file) => setFiles((value) => ({ ...value, governmentId: file }))} />
            <UploadField label="CAC Certificate" required={data.requirements?.cacCertificateRequired} current={uploaded.get("cacCertificate")} disabled={locked} onChange={(file) => setFiles((value) => ({ ...value, cacCertificate: file }))} />
            <UploadField label="Proof of Business Address" current={uploaded.get("proofOfAddress")} disabled={locked} onChange={(file) => setFiles((value) => ({ ...value, proofOfAddress: file }))} />
          </div>

          <div className="my-7 border-t border-slate-100" />
          <h2 className="text-lg font-semibold text-slate-950">Business bank details</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Input label="Business Bank Account Name" name="bankAccountName" value={form.bankAccountName} setForm={setForm} disabled={locked} required />
            <Input label="Business Account Number" name="accountNumber" value={form.accountNumber} setForm={setForm} disabled={locked} required />
            <Input label="Bank Name" name="bankName" value={form.bankName} setForm={setForm} disabled={locked} required />
            <Input label="Tax Identification Number" name="taxIdentificationNumber" value={form.taxIdentificationNumber} setForm={setForm} disabled={locked} />
          </div>

          {message ? <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          <div className="mt-7 flex justify-end">
            <button disabled={locked || submitting} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {submitting ? "Submitting..." : business.verificationStatus === "rejected" ? "Resubmit Verification" : "Submit Verification"}
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-950">Verification timeline</h2>
        <div className="mt-5 space-y-4">
          {(business.verificationTimeline || []).slice().reverse().map((item, index) => (
            <div key={`${item.action}-${index}`} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><FiClock /></span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                <p className="text-sm text-slate-500">{item.note}</p>
                <p className="mt-1 text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}{item.actorName ? ` | ${item.actorName}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status, label }) {
  const classes = status === "verified" ? "bg-emerald-100 text-emerald-800" : status === "under_review" ? "bg-blue-100 text-blue-800" : ["rejected", "suspended"].includes(status) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${classes}`}>{label}</span>;
}

function UploadField({ label, required, current, disabled, onChange }) {
  return (
    <label className={`block rounded-xl border border-dashed p-4 ${current ? "border-emerald-300 bg-emerald-50" : "border-slate-300"}`}>
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FiFileText />{label}{required ? <span className="text-red-500">*</span> : <span className="font-normal text-slate-400">(Optional)</span>}</span>
      <span className="mt-2 block truncate text-xs text-slate-500">{current?.fileName || "No document uploaded"}</span>
      {!disabled ? <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-700"><FiUpload />Choose file</span> : null}
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={disabled} onChange={(event) => onChange(event.target.files?.[0] || null)} className="sr-only" />
    </label>
  );
}

function Input({ label, name, value, setForm, disabled, required }) {
  return (
    <label className="text-sm font-medium text-slate-800">{label}{required ? <span className="text-red-500"> *</span> : <span className="font-normal text-slate-400"> (Optional)</span>}
      <input name={name} value={value} disabled={disabled} required={required} onChange={(event) => setForm((form) => ({ ...form, [name]: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100" />
    </label>
  );
}

