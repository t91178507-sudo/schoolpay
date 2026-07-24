import type { Metadata } from "next";
import "./globals.css";
import { AppFeedbackProvider } from "../components/AppFeedback";
export const metadata: Metadata = {
  title: "InvoiceHub",
  description:
    "InvoiceHub is invoicing and payment-tracking software for businesses that bill customers and monitor collections.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AppFeedbackProvider>{children}</AppFeedbackProvider></body>
    </html>
  );
}


