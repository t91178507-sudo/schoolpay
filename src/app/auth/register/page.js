"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Business Types (kept from your original)
const businessTypes = [
  "School",
  "Estate",
  "Hospital",
  "Distributor",
  "Fuel Supplier",
  "Professional Service",
];

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
    email: "",
    businessType: "",
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
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!formData.businessType) {
      setError("Please select a business type");
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
          businessName: formData.businessName,
          businessType: formData.businessType,
          role: "Admin",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("authToken", data.token || "");
        localStorage.setItem("userName", `${formData.firstName} ${formData.lastName}`);
        localStorage.setItem("businessName", formData.businessName);
        localStorage.setItem("businessType", formData.businessType);

        router.push("/dashboard");
      } else {
        setError(data.error || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Connection error. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex w-1/2 bg-[#4C1D95] text-white relative overflow-hidden flex-col justify-center p-12">
        <div className="absolute top-10 left-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-2xl font-bold">
              ₦
            </div>
            <span className="text-3xl font-bold tracking-tight">payaza</span>
          </div>
        </div>

        <div className="max-w-lg mt-20">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Experience <span className="text-green-400">smooth, easy</span> payments
          </h1>

          <div className="bg-[#3B1A7A] rounded-3xl p-8 mt-16 relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
              <div>
                <p className="font-semibold">Chidinma Obj</p>
                <p className="text-sm text-green-300">CEO, Stitches and Stride</p>
              </div>
            </div>
            
            <p className="italic text-lg leading-relaxed">
              "Payaza made it easy to manage transactions of my branches all around the globe"
            </p>

            <div className="absolute bottom-6 right-8 text-6xl opacity-20">“</div>
          </div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl shadow-xl p-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Get started with InvoiceHUB</h2>
              <p className="text-gray-600 mt-2 text-sm">
                Welcome to InvoiceHUB. Everything you need to manage invoices and payment collection is right here<br />
                continue with the following
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="First Name"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Last Name"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>
              </div>

              <input
                type="text"
                name="businessName"
                placeholder="Business Name"
                value={formData.businessName}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
              />

              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
              />

              <select
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="">Select Business Type</option>
                {businessTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="country"
                placeholder="Country"
                value={formData.country}
                onChange={handleChange}
                required
                className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? "🙈" : "👁️"}
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
                  className="w-full px-5 py-3.5 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
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
                  className="w-5 h-5 accent-purple-700"
                  required
                />
                <label className="text-sm text-gray-600">
                  Accept <span className="text-purple-700">Terms & Conditions</span> and{" "}
                  <span className="text-purple-700">Privacy Policy</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#6B21A8] hover:bg-[#5B1A8F] disabled:bg-purple-300 text-white font-semibold rounded-2xl text-lg transition-all"
              >
                {loading ? "Creating Account..." : "Create my account"}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600 mt-8">
              Have an account?{" "}
              <Link href="/login" className="text-purple-700 font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-500 mt-8">
            © 2026 Payaza Africa Limited is fully licensed by the Central Bank of Nigeria.
          </p>
        </div>
      </div>
    </div>
  );
}