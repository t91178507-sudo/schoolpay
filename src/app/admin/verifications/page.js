"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

const FILTERS = [
  ["pending_verification", "Pending"],
  ["under_review", "Under Review"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["suspended", "Suspended"],
];

const STATUS_CLASS = {
  pending_verification: "bg-amber-100 text-amber-800",
  under_review: "bg-blue-100 text-blue-800",
  verified: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-slate-200 text-slate-800",
};

export default function BusinessVerificationsPage() {
  const [businesses, setBusinesses] = useState([]);
  const [filter, setFilter] = useState("under_review");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState({
    reason: "",
    requestedDocument: "",
    deadline: "",
    adminComments: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch("/api/admin/verifications");
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error || "Unable to load verifications.");
      setBusinesses(Array.isArray(data) ? data : []);
      setSelected((current) =>
        current ? data.find((business) => business._id === current._id) || null : null
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map(([status]) => [
          status,
          businesses.filter((business) => business.verificationStatus === status).length,
        ])
      ),
    [businesses]
  );
  const visible = businesses.filter((business) => business.verificationStatus === filter);

  const act = async (action) => {
    setSaving(true);
    setError("");
    try {
      const response = await adminFetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: selected._id, action, ...decision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to record decision.");
      setDecision({ reason: "", requestedDocument: "", deadline: "", adminComments: "" });
      await load();
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Business Verification</h1>
        <p className="mt-1 text-sm text-slate-500">Review documents, record decisions, and track every verification status.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {FILTERS.map(([status, label]) => (
          <button key={status} onClick={() => setFilter(status)} className={`rounded-xl border p-4 text-left transition ${filter === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"}`}>
            <span className="text-xs font-medium uppercase">{label}</span>
            <span className="mt-2 block text-2xl font-semibold">{counts[status] || 0}</span>
          </button>
        ))}
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {["Business Name", "Owner Name", "Industry", "Phone Number", "Email", "Registration Date", "Verification Status", "Actions"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((business) => (
                <tr key={business._id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-950">{business.name}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{business.owner?.fullName || "-"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{business.industry || "-"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{business.owner?.phoneNumber || business.phone || "-"}</td>
                  <td className="px-4 py-4 text-sm text-slate-700">{business.owner?.email || business.email || "-"}</td>
                  <td className="px-4 py-4 text-sm text-slate-500">{business.createdAt ? new Date(business.createdAt).toLocaleDateString() : "-"}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[business.verificationStatus] || STATUS_CLASS.pending_verification}`}>{business.verificationStatusLabel}</span></td>
                  <td className="px-4 py-4"><button onClick={() => { setSelected(business); setError(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100">View Details</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && visible.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">No businesses in this queue.</div> : null}
        {loading ? <div className="py-14 text-center text-sm text-slate-500">Loading verifications...</div> : null}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/55" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Business Review</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Close</button>
            </div>

            <div className="space-y-6 p-6">
              <Section title="Business Information">
                <Details values={[
                  ["Business type", selected.type],
                  ["Industry", selected.industry],
                  ["Email", selected.email],
                  ["Phone", selected.phone],
                  ["Address", selected.address],
                  ["Website", selected.website || "-"],
                ]} />
              </Section>
              <Section title="Owner Details">
                <Details values={[["Owner", selected.owner?.fullName], ["Email", selected.owner?.email], ["Phone", selected.owner?.phoneNumber || selected.phone]]} />
              </Section>
              <Section title="Bank Details">
                <Details values={[["Account name", selected.bankAccountName], ["Account number", selected.accountNumber], ["Bank", selected.bankName], ["Tax ID", selected.taxIdentificationNumber || "-"]]} />
              </Section>
              <Section title="Uploaded Documents">
                <div className="space-y-2">
                  {(selected.documents || []).map((document) => (
                    <a key={document._id} href={`/api/admin/verifications/documents/${document._id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
                      <span>{document.fileName}</span><span>Review Document</span>
                    </a>
                  ))}
                  {!selected.documents?.length ? <p className="text-sm text-slate-500">No documents uploaded.</p> : null}
                </div>
              </Section>
              <Section title="Verification Timeline">
                <div className="space-y-3">
                  {(selected.verificationTimeline || []).slice().reverse().map((item, index) => (
                    <div key={`${item.action}-${index}`} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                      <p className="text-sm text-slate-500">{item.note}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""} | {item.actorName || "System"}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Admin Decision">
                <div className="space-y-3">
                  <textarea value={decision.adminComments} onChange={(event) => setDecision((value) => ({ ...value, adminComments: event.target.value }))} placeholder="Admin comments (optional)" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <textarea value={decision.reason} onChange={(event) => setDecision((value) => ({ ...value, reason: event.target.value }))} placeholder="Reason required for rejection, suspension, or information request" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={decision.requestedDocument} onChange={(event) => setDecision((value) => ({ ...value, requestedDocument: event.target.value }))} placeholder="Requested document" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    <input type="date" value={decision.deadline} onChange={(event) => setDecision((value) => ({ ...value, deadline: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  </div>
                  {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button disabled={saving} onClick={() => act("approve")} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">Approve Business</button>
                    <button disabled={saving} onClick={() => act("request_information")} className="rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">Request More Information</button>
                    <button disabled={saving} onClick={() => act("reject")} className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:text-slate-300">Reject Business</button>
                    <button disabled={saving} onClick={() => act("suspend")} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300">Suspend Business</button>
                  </div>
                </div>
              </Section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }) {
  return <section><h3 className="mb-3 text-sm font-semibold uppercase text-slate-500">{title}</h3><div className="rounded-xl border border-slate-200 p-4">{children}</div></section>;
}

function Details({ values }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || "-"}</dd></div>)}</dl>;
}
