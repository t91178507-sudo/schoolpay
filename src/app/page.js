import Image from "next/image";
import Link from "next/link";
import PublicLegalFooter from "../components/PublicLegalFooter";

const proofPoints = [
  { label: "Invoice workspace", value: "1 hub" },
  { label: "Payment visibility", value: "Live" },
  { label: "Collection follow-up", value: "Built in" },
];

const workflow = [
  {
    title: "Create and share invoices",
    text: "Generate polished invoices with clear descriptions, due dates, payment pages, and customer-ready sharing links.",
  },
  {
    title: "Connect your business payment setup",
    text: "Use your own configured payment provider so customer payments go to your business account, not to the platform.",
  },
  {
    title: "Track every payment and reminder",
    text: "Monitor unpaid, partial, and confirmed invoices, send reminders, and keep records without scattered chats and spreadsheets.",
  },
];

const features = [
  "Invoice links and QR payment pages customers can open quickly",
  "Payment tracking across unpaid, partial, and confirmed invoices",
  "WhatsApp-ready reminders, receipts, and confirmations",
  "Admin controls, customer records, and collection visibility in one place",
];

const audiences = [
  {
    title: "Schools and education teams",
    text: "Use InvoiceHub to organize students, categories, recurring billing, and payment visibility without chasing fees manually.",
  },
  {
    title: "Service businesses and merchants",
    text: "Manage customer billing, share payment-ready invoices, and follow outstanding balances from one cleaner workflow.",
  },
  {
    title: "Operations and finance teams",
    text: "Keep records organized, reduce manual follow-up, and see what has been sent, paid, pending, or overdue at a glance.",
  },
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
                  <a href="#problem" className="transition hover:text-white">
                    Problem
                  </a>
                  <a href="#audience" className="transition hover:text-white">
                    Who it's for
                  </a>
                  <a href="#how-it-works" className="transition hover:text-white">
                    How it works
                  </a>
                  <Link href="/book-demo" className="transition hover:text-white">
                    Book a demo
                  </Link>
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
                <h1 className="mt-5 max-w-4xl text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-[4.25rem] lg:text-[5.1rem]">
                  Send invoices, collect payments, and{" "}
                  <span className="text-emerald-300">follow up in one place.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                  The platform brings invoice creation, customer billing,
                  payment pages, reminders, and payment status tracking into one
                  secure workspace for schools, service teams, and growing businesses.
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
                  <Link
                    href="/book-demo"
                    className="rounded-2xl border border-emerald-300/35 px-6 py-3.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10"
                  >
                    Book a demo
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

      <section id="problem" className="bg-white py-20 dark:bg-slate-950 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              The problem
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Too many teams still manage invoices, reminders, and payment checks across chats, screenshots, and spreadsheets.
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-400">
              InvoiceHub solves the day-to-day billing problem: sending invoices
              quickly, giving customers a clear way to pay, and helping your team
              see what is still unpaid without guessing or chasing manually.
            </p>
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
                     <p className="mt-1 text-xl font-semibold">One workspace, clearer billing</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    Actionable
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Invoices to follow up</p>
                    <p className="mt-2 text-3xl font-semibold">24</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-sm text-slate-400">Payments confirmed</p>
                    <p className="mt-2 text-3xl font-semibold">186</p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Invoice sent</span>
                    <span className="text-emerald-300">Payment page opened</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[92%] rounded-full bg-emerald-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Reminder queued</span>
                    <span className="text-amber-300">Pending payment</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[58%] rounded-full bg-amber-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">Receipt prepared</span>
                    <span className="text-sky-300">Shared with customer</span>
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

      <section id="audience" className="bg-slate-50 py-20 dark:bg-slate-900 lg:py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Who it&apos;s for
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Built for teams that need better billing discipline without adding heavy finance software.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
              InvoiceHub is especially useful for businesses and institutions
              that send frequent invoices, follow up on unpaid balances, and need
              a simple way to keep customers or students organized.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {audiences.map((audience) => (
              <div
                key={audience.title}
                className="rounded-2xl border border-slate-200 bg-white px-6 py-6 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{audience.title}</p>
                <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-400">{audience.text}</p>
              </div>
            ))}
          </div>

          <div id="how-it-works" className="mt-16 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
              How it works
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-slate-950 dark:text-slate-100">
              Connect your setup, send invoices, and track what happens next.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
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

      <section id="book-demo" className="bg-slate-950 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 lg:flex-row lg:items-end lg:justify-between lg:px-10">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Book a demo
            </p>
            <h2 className="mt-4 text-4xl font-semibold">
              See how InvoiceHub fits your billing workflow before you roll it out.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              If you want to explore invoice creation, payment collection,
              student or customer organization, reminders, and dashboard tracking
              in one walkthrough, start with the platform and review the flow in context.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/book-demo"
              className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
            >
              Book a demo
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
