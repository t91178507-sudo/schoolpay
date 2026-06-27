import Link from "next/link";

const sections = [
  {
    title: "What InvoiceHub is",
    body:
      "InvoiceHub is a software platform for invoice generation, customer billing workflows, payment-link presentation, and payment-status tracking. InvoiceHub is not a bank and does not hold customer funds on behalf of merchants.",
  },
  {
    title: "Information we process",
    body:
      "InvoiceHub may process business profile details, customer names, phone numbers, invoice descriptions, invoice amounts, payment references, and gateway configuration details supplied by the business using the platform.",
  },
  {
    title: "How payment data is handled",
    body:
      "Payments are processed by the merchant's configured payment service provider. InvoiceHub stores references, status updates, and operational metadata needed to show invoice and payment history inside the software.",
  },
  {
    title: "WhatsApp and notifications",
    body:
      "When a business uses WhatsApp sharing or receipt preparation, phone numbers and invoice details may be used to prepare payment or confirmation messages. Businesses are responsible for obtaining any customer-facing consent they need before sending operational messages.",
  },
  {
    title: "Security",
    body:
      "InvoiceHub uses server-side storage and additional safeguards for sensitive gateway credentials. No software system can promise absolute security, but the platform is designed to minimize exposure of confidential payment settings.",
  },
  {
    title: "Merchant responsibility",
    body:
      "Each business using InvoiceHub is responsible for its own customer relationships, tax treatment, refunds, compliance notices, and lawful use of any configured payment provider.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Privacy Notice
          </p>
          <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            InvoiceHub privacy notice
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            This page explains the software role InvoiceHub plays in billing and payment
            workflows. It is a product notice, not a substitute for legal advice specific to
            your business.
          </p>
        </div>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm leading-7 text-slate-600 sm:text-base">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          For live operations in Nigeria, businesses should maintain their own customer privacy
          wording, support contacts, refund handling process, and gateway onboarding records.
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="font-medium text-slate-700 hover:text-slate-900">
            Back to home
          </Link>
          <Link href="/terms" className="font-medium text-emerald-700 hover:text-emerald-800">
            Read terms
          </Link>
        </div>
      </div>
    </main>
  );
}
