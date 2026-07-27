"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center px-5 py-8 bg-gray-50">
        <div className="w-full max-w-lg">
          <div className="mb-6 text-center">
            <Link href="/" className="inline-flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50">
              <div className="relative h-12 w-12 rounded-3xl bg-slate-100 p-1 shadow-inner">
                <img src="/logo.svg" alt="InvoiceHub logo" className="h-12 w-12 object-contain" />
              </div>
              <span>InvoiceHub</span>
            </Link>
          </div>
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
                  Email
                </label>
                <input
                  type="text"
                  name="identifier"
                  value={formData.identifier}
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
                    placeholder="Enter your password"
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
