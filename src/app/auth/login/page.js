"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FiCheck, FiEye, FiEyeOff } from "react-icons/fi";
import { emitSessionChange } from "../../../lib/clientSession";

export default function Login() {
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registered] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("registered") === "1"
  );

  const router = useRouter();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userName", data.user?.fullName || "");
        localStorage.setItem("userEmail", data.user?.email || "");
        localStorage.setItem("userPhone", data.user?.phoneNumber || "");
        localStorage.setItem("username", data.user?.username || "");
        localStorage.setItem("businessName", data.user?.businessName || "");
        localStorage.setItem("businessType", data.user?.businessType || "");
        localStorage.setItem("businessLogo", data.user?.businessLogo || "");
        localStorage.setItem("hasBusiness", String(data.user?.hasBusiness === true));
        localStorage.setItem("businessVerificationStatus", data.user?.businessVerificationStatus || "draft");
        localStorage.setItem("businessVerified", String(data.user?.businessVerified === true));
        localStorage.setItem("role", data.user?.role || "");
        localStorage.setItem("roleKey", data.user?.roleKey || "");
        localStorage.setItem("accountType", data.user?.accountType || "owner");
        localStorage.setItem("ownerId", data.user?.ownerId || "");
        localStorage.setItem(
          "assignedBusinesses",
          JSON.stringify(data.user?.assignedBusinesses || [])
        );
        localStorage.setItem(
          "assignedAllBusinesses",
          String(data.user?.assignedAllBusinesses === true)
        );
        localStorage.setItem(
          "permissions",
          JSON.stringify(data.user?.permissions || {})
        );
        emitSessionChange();

        const destination =
          data.user?.accountType === "staff"
            ? "/mobile"
            : data.user?.hasBusiness === false
              ? "/dashboard/business-setup"
              : "/dashboard";
        setTimeout(() => router.replace(destination), 200);
      } else {
        setError(data.error || data.message || "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)] lg:overflow-hidden">
      <section className="relative hidden overflow-hidden bg-[#123B5D] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between" aria-label="About InvoiceHub">
        <Link href="/" className="inline-flex w-fit items-center gap-3" aria-label="InvoiceHub home">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 p-1">
            <Image src="/logo.svg" alt="" width={40} height={32} className="h-8 w-10 object-contain" priority />
          </span>
          <span className="text-2xl font-bold">InvoiceHub</span>
        </Link>

        <div className="max-w-xl py-10">
          <p className="text-sm font-semibold uppercase text-emerald-300">Your collection workspace</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight xl:text-5xl">
            Return to a clear view of every invoice and payment.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">
            Continue tracking outstanding balances, recording payments, and keeping customer communication organised.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-slate-100">
            {[
              "Review unpaid and partially paid invoices",
              "Follow payment activity from one dashboard",
              "Send timely updates through your connected channels",
            ].map((benefit) => (
              <li key={benefit} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <FiCheck className="h-4 w-4" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-300">Secure access to your InvoiceHub business workspace.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center overflow-y-auto px-4 py-8 sm:px-8 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 inline-flex items-center gap-3 lg:hidden" aria-label="InvoiceHub home">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              <Image src="/logo.svg" alt="" width={36} height={30} className="h-7 w-9 object-contain" priority />
            </span>
            <span className="text-xl font-bold text-slate-950">InvoiceHub</span>
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold text-sky-800">Welcome back</p>
              <h2 className="mt-1 text-3xl font-bold text-slate-950">Log in to InvoiceHub</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Access your invoices, payments, and customer follow-ups.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {registered ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Account created successfully. Log in to continue.
                </p>
              ) : null}

              <label className="block text-sm font-medium text-slate-700">
                Email or username
                <input
                  type="text"
                  name="identifier"
                  value={formData.identifier}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
                  placeholder="name@business.com"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Password
                <span className="relative mt-2 block">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-900"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#123B5D] px-5 text-sm font-semibold text-white transition hover:bg-[#0E2E48] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              New to InvoiceHub? <Link href="/auth/register" className="font-semibold text-sky-800 hover:underline">Create an account</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
