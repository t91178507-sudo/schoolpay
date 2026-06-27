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
      <div className="hidden lg:flex w-1/2 bg-[#123B5D] text-white relative overflow-hidden flex-col justify-center p-12">
        <div className="absolute top-10 left-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-bold">
              ₦
            </div>
            <span className="text-3xl font-bold tracking-tight">InvoiceHub</span>
          </div>
        </div>

        <div className="max-w-lg mt-20">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Keep invoices moving with
            <span className="text-emerald-300"> faster collections</span>
          </h1>

          <div className="bg-[#0E2E48] rounded-3xl p-8 mt-16 relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-slate-300 rounded-full"></div>
              <div>
                <p className="font-semibold">Amina Yusuf</p>
                <p className="text-sm text-emerald-300">Operations Lead, Northfield Supply</p>
              </div>
            </div>

            <p className="italic text-lg leading-relaxed">
              &ldquo;InvoiceHub gave our team one place to send invoices, follow payments, and stay on top of every account.&rdquo;
            </p>

            <div className="absolute bottom-6 right-8 text-6xl opacity-20">&quot;</div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-96 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900">Log in to InvoiceHub</h2>
              <p className="text-gray-600 mt-2 text-sm">
                Enter your email and password to access your invoice workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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

            <div className="text-center mt-8 text-sm text-gray-600">
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
