"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiCheck, FiChevronDown, FiEye, FiEyeOff } from "react-icons/fi";

const COUNTRIES = ["Nigeria"];

export default function Register() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    country: "Nigeria",
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!formData.acceptTerms) {
      setError("Please accept the Terms and Conditions and Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          email: formData.email.trim(),
          password: formData.password,
          country: formData.country,
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

  const inputClass =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15";

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:h-screen lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)] lg:overflow-hidden">
      <section className="relative hidden overflow-hidden bg-[#123B5D] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between" aria-label="About InvoiceHub">
        <Link href="/" className="inline-flex w-fit items-center gap-3" aria-label="InvoiceHub home">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold">N</span>
          <span className="text-2xl font-bold">InvoiceHub</span>
        </Link>

        <div className="max-w-xl py-10">
          <p className="text-sm font-semibold uppercase text-emerald-300">Built for clearer collections</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight xl:text-5xl">
            Manage invoices, payments, and customer follow-ups in one place.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-200">
            Keep a reliable view of what has been billed, what has been paid, and what still needs attention.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-slate-100">
            {[
              "Create and share professional invoices",
              "Track full and partial payments",
              "Send payment updates and reminders through WhatsApp",
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

        <p className="text-xs text-slate-300">InvoiceHub keeps your billing workflow organised from invoice to confirmation.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center overflow-y-auto px-4 py-8 sm:px-8 lg:min-h-0 lg:px-12">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold text-sky-800">Create account</p>
              <h2 className="mt-1 text-3xl font-bold text-slate-950">Start with InvoiceHub</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Create your owner account. You will add your business profile after signing in.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  First name
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Last name
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@business.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Country
                <span className="relative mt-2 block">
                  <select
                    name="country"
                    autoComplete="country-name"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-4 py-3 pr-11 text-sm text-slate-950 outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15"
                  >
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                </span>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PasswordField
                  label="Password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  visible={showPassword}
                  onToggle={() => setShowPassword((current) => !current)}
                  autoComplete="new-password"
                  inputClass={inputClass}
                />
                <PasswordField
                  label="Confirm password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((current) => !current)}
                  autoComplete="new-password"
                  inputClass={inputClass}
                />
              </div>
              <p className="-mt-2 text-xs text-slate-500">Use at least 8 characters.</p>

              {error ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 shrink-0 accent-sky-800"
                  required
                />
                <span>
                  I agree to the <Link href="/terms" className="font-medium text-sky-800 hover:underline">Terms and Conditions</Link> and <Link href="/privacy" className="font-medium text-sky-800 hover:underline">Privacy Policy</Link>.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#123B5D] px-5 text-sm font-semibold text-white transition hover:bg-[#0E2E48] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account? <Link href="/auth/login" className="font-semibold text-sky-800 hover:underline">Log in</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function PasswordField({ label, name, value, onChange, visible, onToggle, autoComplete, inputClass }) {
  return (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <span className="relative mt-2 block">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder="Enter password"
          minLength={8}
          required
          className={`${inputClass.replace("mt-2 ", "")} pr-11`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-900"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}