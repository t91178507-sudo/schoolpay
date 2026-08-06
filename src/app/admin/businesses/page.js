"use client";

import { useEffect, useState } from "react";
import {
  AdminBadge,
  AdminHeader,
  AdminLoading,
  AdminMetric,
  AdminTable,
  AdminTd,
  AdminTh,
} from "../../../components/AdminUI";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function StatusPill({ children, tone = "slate" }) {
  return <AdminBadge tone={tone}>{children}</AdminBadge>;
}

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBusiness, setWalletBusiness] = useState(null);
  const [walletSummary, setWalletSummary] = useState(null);
  const [walletForm, setWalletForm] = useState({ type: "credit", units: "", reason: "" });
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await adminFetch("/api/admin/businesses");
        const data = res.ok ? await res.json() : [];
        setBusinesses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openWallet = async (business) => {
    setWalletBusiness(business);
    setWalletSummary(null);
    setWalletError("");
    setWalletForm({ type: "credit", units: "", reason: "" });
    setWalletLoading(true);

    try {
      const res = await adminFetch(`/api/admin/businesses/units?ownerId=${encodeURIComponent(business._id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load unit wallet");
      setWalletSummary(data);
    } catch (error) {
      setWalletError(error.message || "Unable to load unit wallet");
    } finally {
      setWalletLoading(false);
    }
  };

  const submitWalletAdjustment = async (event) => {
    event.preventDefault();
    if (!walletBusiness) return;
    setWalletLoading(true);
    setWalletError("");

    try {
      const res = await adminFetch("/api/admin/businesses/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: walletBusiness._id,
          businessName: walletBusiness.businessName,
          type: walletForm.type,
          units: walletForm.units,
          reason: walletForm.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to update units");
      setWalletSummary(data.summary);
      setWalletForm({ type: "credit", units: "", reason: "" });
      setBusinesses((current) =>
        current.map((business) =>
          business._id === walletBusiness._id
            ? { ...business, currentUnits: data.summary.currentUnits, lowUnits: data.summary.lowUnits }
            : business
        )
      );
    } catch (error) {
      setWalletError(error.message || "Unable to update units");
    } finally {
      setWalletLoading(false);
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  const lowUnitCount = businesses.filter((biz) => biz.lowUnits).length;
  const totalCollected = businesses.reduce((sum, biz) => sum + Number(biz.collected || 0), 0);
  const totalOutstanding = businesses.reduce((sum, biz) => sum + Number(biz.outstanding || 0), 0);

  return (
    <div className="space-y-6">
      <AdminHeader
        eyebrow="Business operations"
        title="Businesses"
        description={`${businesses.length} registered business${businesses.length !== 1 ? "es" : ""}, payment readiness, WhatsApp setup, and unit wallets.`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <AdminMetric label="Businesses" value={businesses.length} hint="Registered accounts" tone="blue" />
        <AdminMetric label="Collected" value={formatMoney(totalCollected)} hint="Across all businesses" tone="green" />
        <AdminMetric label="Outstanding" value={formatMoney(totalOutstanding)} hint="Open balances" tone="orange" />
        <AdminMetric label="Low units" value={lowUnitCount} hint="Need top-up attention" tone={lowUnitCount ? "red" : "green"} />
      </div>

      <AdminTable minWidth="1180px">
        <thead>
          <tr className="border-b border-slate-200">
            <AdminTh className="w-[19%]">Business</AdminTh>
            <AdminTh className="w-[18%]">Owner</AdminTh>
            <AdminTh className="w-[14%]">Payments</AdminTh>
            <AdminTh className="w-[14%]">WhatsApp</AdminTh>
            <AdminTh className="w-[11%]">Units</AdminTh>
            <AdminTh className="w-[10%]">Invoices</AdminTh>
            <AdminTh className="w-[8%] text-right">Collected</AdminTh>
            <AdminTh className="w-[8%] text-right">Outstanding</AdminTh>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
              {businesses.map((biz) => (
                <tr key={biz._id} className="hover:bg-slate-50">
                  <AdminTd>
                    <p className="font-medium text-slate-900">{biz.businessName || "-"}</p>
                    <p className="mt-1 text-xs text-slate-400">{biz.businessType || "No type set"}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Joined {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString() : "-"}
                    </p>
                  </AdminTd>
                  <AdminTd>
                    {biz.fullName || "-"}<br />
                    <span className="text-xs text-slate-400">{biz.email}</span>
                  </AdminTd>
                  <AdminTd>
                    <div className="space-y-2">
                      <StatusPill tone={biz.monnifyConfigured ? "green" : "orange"}>
                        Monnify {biz.monnifyConfigured ? "ready" : "not ready"}
                      </StatusPill>
                      <p className="text-xs capitalize text-slate-500">
                        Default: {biz.defaultPaymentGateway || "monnify"} ({biz.monnifyEnvironment || "sandbox"})
                      </p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <div className="space-y-2">
                      <StatusPill tone={biz.whatsappWebEnabled ? "green" : "slate"}>
                        {biz.defaultWhatsAppProvider === "whatsappWeb" ? "Bridge" : biz.defaultWhatsAppProvider || "browser"}
                      </StatusPill>
                      <p className="max-w-[12rem] truncate text-xs text-slate-500">
                        {biz.whatsappWebSenderPhoneNumber || biz.whatsappWebSessionName || "No bridge session"}
                      </p>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <button
                      type="button"
                      onClick={() => openWallet(biz)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        biz.lowUnits
                          ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {(biz.currentUnits || 0).toLocaleString()}
                    </button>
                  </AdminTd>
                  <AdminTd>
                    <p>{biz.invoiceCount} total</p>
                    <p className="text-xs text-slate-400">
                      {biz.paidInvoiceCount} paid, {biz.partialInvoiceCount} partial
                    </p>
                  </AdminTd>
                  <AdminTd className="text-right font-medium text-emerald-700">
                    {formatMoney(biz.collected)}
                  </AdminTd>
                  <AdminTd className="text-right font-medium text-slate-900">
                    {formatMoney(biz.outstanding)}
                  </AdminTd>
                </tr>
              ))}
            </tbody>
      </AdminTable>

      {businesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          No businesses registered yet.
        </div>
      ) : null}

      {walletBusiness ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Unit wallet</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">{walletBusiness.businessName || "Business"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setWalletBusiness(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-6">
              {walletError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{walletError}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Current units</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{(walletSummary?.currentUnits || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Used this month</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{(walletSummary?.usedThisMonth || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase text-slate-500">Low threshold</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{(walletSummary?.lowUnitThreshold || 0).toLocaleString()}</p>
                </div>
              </div>

              <form onSubmit={submitWalletAdjustment} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[140px_1fr_1.4fr_auto]">
                <select
                  value={walletForm.type}
                  onChange={(event) => setWalletForm((form) => ({ ...form, type: event.target.value }))}
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
                <input
                  type="number"
                  min="1"
                  value={walletForm.units}
                  onChange={(event) => setWalletForm((form) => ({ ...form, units: event.target.value }))}
                  placeholder="Units"
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                  required
                />
                <input
                  type="text"
                  value={walletForm.reason}
                  onChange={(event) => setWalletForm((form) => ({ ...form, reason: event.target.value }))}
                  placeholder="Reason"
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={walletLoading}
                  className="min-h-11 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {walletLoading ? "Saving..." : "Apply"}
                </button>
              </form>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Activity</th>
                      <th className="px-4 py-3 text-left">Units</th>
                      <th className="px-4 py-3 text-left">Balance</th>
                      <th className="px-4 py-3 text-left">Admin/User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(walletSummary?.transactions || []).map((transaction) => (
                      <tr key={transaction._id || `${transaction.createdAt}-${transaction.units}`}>
                        <td className="px-4 py-3 text-slate-500">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : "-"}</td>
                        <td className="px-4 py-3 text-slate-900">{transaction.reason || "Unit transaction"}</td>
                        <td className={transaction.type === "credit" ? "px-4 py-3 font-semibold text-emerald-700" : "px-4 py-3 font-semibold text-orange-700"}>
                          {transaction.type === "credit" ? "+" : "-"}{Number(transaction.units || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-900">{Number(transaction.balanceAfterTransaction || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-500">{transaction.createdBy || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!walletLoading && !(walletSummary?.transactions || []).length ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">No unit transactions yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
