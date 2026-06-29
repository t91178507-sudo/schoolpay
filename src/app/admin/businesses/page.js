"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "../../../lib/adminFetch";

function formatMoney(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function StatusPill({ children, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  );
}

export default function AdminBusinesses() {
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);

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
        <h1 className="text-2xl font-semibold text-slate-900">Businesses</h1>
        <p className="mt-1 text-slate-500">
          {businesses.length} registered business{businesses.length !== 1 ? "es" : ""}, with payment and WhatsApp setup status
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Business</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Owner</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Payments</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">WhatsApp</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Invoices</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Collected</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Outstanding</th>
                <th className="px-6 py-4 text-left text-xs font-medium uppercase text-slate-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {businesses.map((biz) => (
                <tr key={biz._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-slate-900">{biz.businessName || "-"}</p>
                    <p className="mt-1 text-xs text-slate-400">{biz.businessType || "No type set"}</p>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-600">
                    {biz.fullName || "-"}<br />
                    <span className="text-xs text-slate-400">{biz.email}</span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-2">
                      <StatusPill tone={biz.monnifyConfigured ? "green" : "orange"}>
                        Monnify {biz.monnifyConfigured ? "ready" : "not ready"}
                      </StatusPill>
                      <p className="text-xs capitalize text-slate-500">
                        Default: {biz.defaultPaymentGateway || "monnify"} ({biz.monnifyEnvironment || "sandbox"})
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <div className="space-y-2">
                      <StatusPill tone={biz.whatsappWebEnabled ? "green" : "slate"}>
                        {biz.defaultWhatsAppProvider === "whatsappWeb" ? "Bridge" : biz.defaultWhatsAppProvider || "browser"}
                      </StatusPill>
                      <p className="max-w-[12rem] truncate text-xs text-slate-500">
                        {biz.whatsappWebSenderPhoneNumber || biz.whatsappWebSessionName || "No bridge session"}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top text-slate-600">
                    <p>{biz.invoiceCount} total</p>
                    <p className="text-xs text-slate-400">
                      {biz.paidInvoiceCount} paid, {biz.partialInvoiceCount} partial
                    </p>
                  </td>
                  <td className="px-6 py-4 align-top font-medium text-emerald-700">
                    {formatMoney(biz.collected)}
                  </td>
                  <td className="px-6 py-4 align-top font-medium text-slate-900">
                    {formatMoney(biz.outstanding)}
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-slate-500">
                    {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {businesses.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              No businesses registered yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
