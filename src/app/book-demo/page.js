"use client";

import Link from "next/link";
import { useState } from "react";

const businessTypes = [
  "School",
  "Retail",
  "Professional Service",
  "Healthcare",
  "Real Estate",
  "Distribution",
  "Hospitality",
  "Other",
];

const teamSizes = ["1-5", "6-20", "21-50", "51-100", "100+"];

const demoPoints = [
  "See invoice creation, reminders, and payment tracking in one live workflow",
  "Review how schools, service teams, and merchants can organize billing records",
  "Understand how your payment provider and WhatsApp flow fit into the platform",
];

export default function BookDemoPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    businessName: "",
    businessType: "",
    teamSize: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not submit your demo request.");
        return;
      }

      setSuccess("Demo request sent. We will reach out to you shortly.");
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        businessName: "",
        businessType: "",
        teamSize: "",
        message: "",
      });
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.92)_55%,rgba(6,78,59,0.82)_100%)]" />
        <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-6 lg:px-10">
          <header className="rounded-[1.75rem] border border-white/10 bg-slate-950/75 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-base font-bold text-white shadow-lg shadow-emerald-950/30">
                  I
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-5 text-white">InvoiceHub</p>
                  <p className="hidden text-xs leading-5 text-slate-300 sm:block">
                    Invoicing and collections software
                  </p>
                </div>
              </Link>

              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Back home
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400"
                >
                  Start free
                </Link>
              </div>
            </div>
          </header>

          <div className="grid gap-8 py-10 lg:grid-cols-[0.94fr_1.06fr] lg:items-start lg:py-16">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Book a demo
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                See how InvoiceHub can fit your billing workflow before you roll it out.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">
                Tell us a bit about your business and what you want to improve.
                We&apos;ll use that to shape a focused walkthrough of invoicing,
                payment collection, reminders, and tracking.
              </p>

              <div className="mt-8 rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  What the demo covers
                </p>
                <div className="mt-5 space-y-4">
                  {demoPoints.map((point) => (
                    <div key={point} className="flex gap-3">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300" />
                      <p className="text-sm leading-7 text-slate-200">{point}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Typical fit</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Schools, merchants, service businesses, and admin teams
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-400">Response</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Demo requests are saved for follow-up
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-white">Request your demo</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Share your details and we&apos;ll capture the request for follow-up.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Full name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Work email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Phone number
                    </label>
                    <input
                      type="text"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                      placeholder="e.g. 2348012345678"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Business name
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                      placeholder="Your business name"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Business type
                    </label>
                    <select
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                    >
                      <option value="">Select type</option>
                      {businessTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      Team size
                    </label>
                    <select
                      name="teamSize"
                      value={formData.teamSize}
                      onChange={handleChange}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                    >
                      <option value="">Select team size</option>
                      {teamSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    What would you like to see?
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3.5 text-white outline-none transition focus:border-emerald-400"
                    placeholder="Tell us about your billing workflow, pain points, or the use case you want covered."
                  />
                </div>

                {error ? (
                  <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                ) : null}

                {success ? (
                  <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                    {success}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-400/70"
                >
                  {loading ? "Sending request..." : "Book demo"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
