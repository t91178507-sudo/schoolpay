"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    country: "",
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!formData.acceptTerms) {
      setError("Please accept the Terms & Conditions");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email,
          password: formData.password,
          role: "Admin",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userName");
        localStorage.removeItem("businessName");
        localStorage.removeItem("businessType");
        localStorage.removeItem("businessLogo");
        router.push("/auth/login?registered=1");
      } else {
        setError(data.error || "Registration failed. Please try again.");
      }
    } catch {
      setError("Connection error. Please check your network.");
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
              ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¦
            </div>
            <span className="text-3xl font-bold tracking-tight">InvoiceHub</span>
          </div>
        </div>

        <div className="max-w-lg mt-20">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Set up billing that feels
            <span className="text-emerald-300"> organized from day one</span>
          </h1>

          <div className="bg-[#0E2E48] rounded-3xl p-8 mt-16 relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-slate-300 rounded-full"></div>
              <div>
                <p className="font-semibold">Samuel Okoye</p>
                <p className="text-sm text-emerald-300">Finance Lead, Oakline Studio</p>
              </div>
            </div>

            <p className="italic text-lg leading-relaxed">
              &ldquo;We went from scattered follow-ups to a clear invoice workflow the whole team could trust.&rdquo;
            </p>

            <div className="absolute bottom-6 right-8 text-6xl opacity-20">&quot;</div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Create your InvoiceHub account</h2>
              <p className="text-gray-600 mt-2 text-sm">
                Create your owner account. You will add your business details after login.
              </p>
            </div>


            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
                />
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
                />
              </div>

              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
              />

              <input
                type="text"
                name="country"
                placeholder="Country"
                value={formData.country}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-700"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 p-4 rounded-2xl text-center">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className="w-5 h-5 accent-sky-700"
                  required
                />
                <label className="text-sm text-gray-600">
                  Accept <span className="text-sky-800">Terms & Conditions</span> and{" "}
                  <span className="text-sky-800">Privacy Policy</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#123B5D] hover:bg-[#0E2E48] disabled:bg-sky-300 text-white font-semibold rounded-2xl text-lg transition-all"
              >
                {loading ? "Creating Account..." : "Create my account"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-8">
              Have an account?{" "}
              <Link href="/auth/login" className="text-sky-800 font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
