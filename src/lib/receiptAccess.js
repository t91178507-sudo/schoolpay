import { requireAccessContext } from "./accessControl";

export async function requireSchoolReceiptAccess(req, db, options = {}) {
  return requireAccessContext(req, db, options);
}
