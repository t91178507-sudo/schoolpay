function buildCallbackHtml({ status, reference }) {
  const title = status ? `PayAza ${status}` : "PayAza callback received";
  const referenceLine = reference
    ? `<p style="color:#475569;margin:8px 0 0">Reference: ${reference}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:40px">
    <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
      <h1 style="margin:0;font-size:24px">${title}</h1>
      ${referenceLine}
      <p style="color:#475569;line-height:1.6">You can close this page and return to your invoice dashboard.</p>
      <a href="/dashboard/payments" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;border-radius:12px;padding:12px 16px">Open payment history</a>
    </main>
  </body>
</html>`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const status =
    url.searchParams.get("status") ||
    url.searchParams.get("paymentStatus") ||
    url.searchParams.get("transactionStatus") ||
    "";
  const reference =
    url.searchParams.get("reference") ||
    url.searchParams.get("paymentReference") ||
    url.searchParams.get("transactionReference") ||
    "";

  return new Response(buildCallbackHtml({ status, reference }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  return Response.json({
    success: true,
    message: "PayAza callback received",
    reference:
      body.reference ||
      body.paymentReference ||
      body.transactionReference ||
      body.data?.reference ||
      body.data?.paymentReference ||
      "",
  });
}
