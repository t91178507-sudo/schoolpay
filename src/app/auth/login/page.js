"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { emitSessionChange } from "../../../lib/clientSession";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
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
        localStorage.setItem("authToken", data.token || "");
        localStorage.setItem("userName", data.user?.fullName || "");
        localStorage.setItem("businessName", data.user?.businessName || "");
        localStorage.setItem("businessType", data.user?.businessType || "");
        localStorage.setItem("businessLogo", data.user?.businessLogo || "");
        emitSessionChange();

        setTimeout(() => router.replace("/dashboard"), 200);
      } else {
        setError(data.message || "Invalid credentials");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 bg-[#123B5D] text-white relative overflow-hidden flex-col p-10 xl:p-12">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-85">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-bold">
              ₦
            </div>
            <span className="text-3xl font-bold tracking-tight">InvoiceHub</span>
          </Link>
        </div>

        <div className="relative z-10 flex flex-1 items-center">
          <div className="max-w-xl">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-5">
            Send invoices and collect payments
            <span className="text-emerald-300"> with confidence</span>
          </h1>

          <p className="max-w-xl text-base xl:text-lg leading-7 text-sky-100">
            Connect your preferred payment provider, generate invoices,
            receive customer payments directly, and track every confirmation
            from one secure workspace.
          </p>

          <div className="bg-[#0E2E48] rounded-3xl p-6 mt-8 relative border border-white/10 shadow-2xl">
            <div className="flex items-start gap-5 mb-5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/15 text-sm font-bold tracking-wide text-emerald-200">
                NGN
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-6 text-white">
                  Payment-ready invoicing
                </p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-sky-100">
                  Connect your business payment account and start receiving customer
                  payments directly into your business account.
                </p>
              </div>
            </div>

            <div className="grid gap-2.5 text-sm text-sky-50">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Payment setup</span>
                <span className="font-semibold text-emerald-300">Your provider</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Payment tracking</span>
                <span className="font-semibold text-emerald-300">Automatic status updates</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                <span>Customer receipts</span>
                <span className="font-semibold text-emerald-300">WhatsApp-ready</span>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-sky-100">
              Your customers get a simple payment experience, while your team
              keeps clear records of invoices, payments, and outstanding balances.
            </p>
          </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-96 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
      </div>

      <div className="flex-1 flex items-center justify-center px-5 py-8 bg-gray-50">
        <div className="w-full max-w-lg">
          <div className="overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/70">
            <div className="px-8 pt-10 pb-7 text-center sm:px-10">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900">
                Log in to InvoiceHub
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-gray-600">
                Enter your email and password to access your invoice workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-8 pb-8 sm:px-10">
              {registered && (
                <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                  Account created successfully. Please log in to continue.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-sm text-center bg-red-50 py-3 rounded-2xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#123B5D] hover:bg-[#0E2E48] disabled:bg-sky-300 text-white font-semibold rounded-2xl text-lg transition-all duration-200"
              >
                {loading ? "Signing in..." : "Log in"}
              </button>
            </form>

            <div className="border-t border-slate-100 px-8 py-6 text-center text-sm text-gray-600 sm:px-10">
              Don&apos;t have an account?{" "}
              <Link
                href="/auth/register"
                className="text-sky-800 font-medium hover:underline"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
