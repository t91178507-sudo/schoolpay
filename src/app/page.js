import Image from "next/image";
import Link from "next/link";
import PublicLegalFooter from "../components/PublicLegalFooter";

const proofPoints = [
  { label: "Gateway options", value: "2" },
  { label: "Payment tracking", value: "Live" },
  { label: "Customer records", value: "1 hub" },
];

const workflow = [
  {
    title: "Create polished invoices",
    text: "Create professional invoices with clear line items, due dates, and payment instructions customers can act on quickly.",
  },
  {
    title: "Connect your payment provider",
    text: "Use your own business payment account so customer payments go through the provider configured for your business.",
  },
  {
    title: "Track every confirmation",
    text: "Share invoice links in seconds and stay on top of unpaid, partial, and confirmed payments without the usual back-and-forth.",
  },
];

const features = [
  "Connect your preferred payment provider from business settings",
  "Invoice links and QR payment pages customers can use quickly",
  "Payment tracking across unpaid, partial, and confirmed invoices",
  "WhatsApp-ready receipts and payment confirmations",
];

export default function Home() {
  return (
    <div className="bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <Image
          src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=1600&q=80"
          alt="Desk with laptop and financial documents"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-slate-950/78" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.88)_48%,rgba(6,78,59,0.72)_100%)]" />

        <div className="relative mx-auto flex min-h-[720px] max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-6 lg:min-h-[760px] lg:px-10">
          <header className="rounded-[1.75rem] border border-white/10 bg-slate-950/75 px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur-xl md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-base font-bold text-white shadow-lg shadow-emerald-950/30">
                    I
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-5 text-white">InvoiceHub</p>
                    <p className="hidden text-xs leading-5 text-slate-300 sm:block">Invoicing and collections software</p>
                  </div>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-3 lg:gap-7">
                <nav className="hidden flex-wrap items-center gap-5 text-sm font-medium text-slate-300 md:flex">
                  <a href="#workflow" className="transition hover:text-white">
                    Workflow
                  </a>
                  <a href="#platform" className="transition hover:text-white">
                    Platform
                  </a>
                  <a href="#results" className="transition hover:text-white">
                    Results
                  </a>
                </nav>

                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/auth/login"
                    className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400"
                  >
                    Start free
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center py-12 lg:py-16">
            <div className="grid gap-8 lg:grid-cols-[1.04fr_0.82fr] lg:items-center">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                  InvoiceHub
                </div>
                <h1 className="mt-5 max-w-4xl text-[3.1rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-[5.4rem]">
                  Send invoices and collect payments{" "}
                  <span className="text-emerald-300">with confidence.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                  Connect your preferred payment provider, generate invoices,
                  receive customer payments directly, and track every confirmation
                  from one secure workspace.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/auth/register"
                    className="rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-950/30 transition hover:bg-emerald-400"
                  >
                    Create your workspace
                  </Link>
                  <Link
                    href="/auth/login"
                    className="rounded-2xl border border-white/20 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Sign in
                  </Link>
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/15 text-sm font-bold tracking-wide text-emerald-200 shadow-inner">
                    NGN
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-bold leading-6 text-white">
                      Payment-ready invoicing
                    </p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-200">
                      Connect your business payment account and start receiving customer
                      payments directly into your business account.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-2.5 text-sm text-slate-100">
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3.5">
                    <span>Payment setup</span>
                    <span className="font-semibold text-emerald-300">Your provider</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3.5">
                    <span>Payment tracking</span>
                    <span className="font-semibold text-emerald-300">Automatic updates</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3.5">
                    <span>Customer receipts</span>
                    <span className="font-semibold text-emerald-300">WhatsApp-ready</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    Payment status
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[78%] rounded-full bg-emerald-400" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span>Invoices tracked</span>
                    <span className="font-semibold text-white">Live</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3 lg:mt-12">
              {proofPoints.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4 backdrop-blur-xl"
                >
                  <p className="text-2xl font-semibold text-white">{item.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="bg-white py-20 dark:bg-slate-950 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Workflow
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Built for businesses that invoice often and need sharper payment follow-through.
            </h2>
            <div className="mt-10 space-y-8">
              {workflow.map((item, index) => (
                <div key={item.title} className="flex gap-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-400">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl">
              <div className="border-b border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Collections snapshot</p>
                    <p className="mt-1 text-xl font-semibold">June billing cycle</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    84% paid
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Outstanding</p>
                    <p className="mt-2 text-3xl font-semibold">N 1.28M</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Invoices sent</p>
                    <p className="mt-2 text-3xl font-semibold">246</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Northfield Supply</span>
                    <span className="text-emerald-300">Paid</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[92%] rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Oakline Studio</span>
                    <span className="text-amber-300">Pending</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[58%] rounded-full bg-amber-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Prime Retail Group</span>
                    <span className="text-sky-300">Sent today</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[36%] rounded-full bg-sky-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-slate-50 py-20 dark:bg-slate-900 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Platform
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-slate-100">
              A cleaner billing workspace with payment collection built in.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
              InvoiceHub keeps the essentials close: customer lists, invoice
              generation, payment provider setup, payment visibility, and admin
              oversight without the clutter that usually slows teams down.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-base font-medium text-slate-900 dark:text-slate-100">{feature}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            InvoiceHub operates as software for invoice generation, payment-link presentation,
            and collection tracking. Customer payments are processed by the merchant&apos;s chosen
            payment provider, and the platform is not presented as a bank or fund-holding
            service.
          </div>
        </div>
      </section>

      <section id="results" className="bg-slate-950 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Results
            </p>
            <h2 className="mt-4 text-4xl font-semibold">
              Give customers a clear way to pay and your team a clear way to track it.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              When invoices are easy to send, easy to understand, and connected
              to the right payment provider, teams spend less time chasing and
              more time closing.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/register"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Start with InvoiceHub
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Open existing workspace
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            InvoiceHub helps businesses manage invoices, payment visibility, and collections follow-through.
          </p>
          <PublicLegalFooter />
        </div>
      </footer>
    </div>
  );
}
