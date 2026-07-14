import { clearAdminAuthCookie } from "../../../../../lib/adminAuth";

export async function POST() {
  return Response.json(
    { success: true },
    {
      headers: {
        "Set-Cookie": clearAdminAuthCookie(),
      },
    }
  );
}
