"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

function formatCurrency(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString();
}

export default function AdminReconciliationWords() {
  const [pending, setPending] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyPhrase, setBusyPhrase] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadWords = useCallback(async () => {
    try {
      setError("");
      const res = await adminFetch("/api/admin/reconciliation-words", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to load reconciliation words");
      }

      setPending(Array.isArray(data.pending) ? data.pending : []);
      setReviewed(Array.isArray(data.reviewed) ? data.reviewed : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load reconciliation words");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadWords();
    }, 0);

    return () => clearTimeout(initialLoad);
  }, [loadWords]);

  const handleAction = async (phrase, action) => {
    setBusyPhrase(`${action}:${phrase}`);
    setMessage("");
    setError("");

    try {
      const res = await adminFetch("/api/admin/reconciliation-words", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phrase, action }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Unable to update reconciliation word");
      }

      if (action === "approve") {
        const processed = data.processed || {};
        setMessage(
          `${phrase} approved. Imported ${processed.imported || 0} pending credit${
            processed.imported === 1 ? "" : "s"
          }.`
        );
      } else {
        setMessage(`${phrase} rejected. ${data.rejectedCount || 0} pending credit(s) closed.`);
      }

      await loadWords();
    } catch (actionError) {
      setError(actionError.message || "Unable to update reconciliation word");
    } finally {
      setBusyPhrase("");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-slate-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Credit Words
        </h1>
        <p className="mt-1 text-slate-500">
          Validate new bank narration phrases before they are used for reconciliation.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Pending validation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Approving a phrase imports every pending credit waiting on that phrase.
          </p>
        </div>

        {pending.length ? (
          <div className="divide-y divide-slate-100">
            {pending.map((item) => (
              <div key={item.phraseNormalized} className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold uppercase text-slate-900">
                      {item.phrase}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.pendingCount} pending credit
                      {item.pendingCount === 1 ? "" : "s"} ·{" "}
                      {formatCurrency(item.totalAmount)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(item.phrase, "approve")}
                      disabled={Boolean(busyPhrase)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {busyPhrase === `approve:${item.phrase}` ? "Approving..." : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(item.phrase, "reject")}
                      disabled={Boolean(busyPhrase)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {busyPhrase === `reject:${item.phrase}` ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Amount</th>
                        <th className="px-4 py-3 text-left">Bank</th>
                        <th className="px-4 py-3 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {item.samples.map((sample) => (
                        <tr key={sample._id}>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(sample.date)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {formatCurrency(sample.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {sample.bankName || "-"}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {sample.remarks || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-slate-500">
            No pending credit words.
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">Reviewed words</h2>
        </div>

        {reviewed.length ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Phrase</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Reviewed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reviewed.map((item) => (
                <tr key={item._id || item.phraseNormalized}>
                  <td className="px-6 py-3 font-medium uppercase text-slate-900">
                    {item.phrase}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500">
                    {formatDate(item.reviewedAt || item.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-10 text-center text-slate-500">
            No reviewed words yet.
          </div>
        )}
      </div>
    </div>
  );
}
