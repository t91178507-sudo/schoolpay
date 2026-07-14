import QRCode from "qrcode";
import { requireAccessContext } from "../../../../lib/accessControl";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    await requireAccessContext(req, db, {
      permission: "qr.generate",
    });
    const { searchParams } = new URL(req.url);
    const value = String(searchParams.get("value") || "").trim();

    if (!value) {
      return Response.json({ error: "QR value is required." }, { status: 400 });
    }

    const dataUrl = await QRCode.toDataURL(value, {
      width: 480,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    return Response.json({ dataUrl });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to generate QR code" },
      { status: error.status || 500 }
    );
  }
}
