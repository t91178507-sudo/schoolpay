import Link from "next/link";

export default function PublicLegalFooter({ className = "" }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500 ${className}`.trim()}
    >
      <span>InvoiceHub is invoicing software.</span>
      <span className="hidden sm:inline">|</span>
      <Link href="/privacy" className="hover:text-slate-700">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-slate-700">
        Terms
      </Link>
    </div>
  );
}
