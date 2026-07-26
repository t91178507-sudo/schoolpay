import { requireAccessContext } from "./accessControl";
import { isSchoolBusinessType } from "./businessLabels";

export async function requireSchoolReceiptAccess(req, db, options = {}) {
  const context = await requireAccessContext(req, db, options);
  const schoolBusiness = [
    context.primaryBusiness?.type,
    context.owner.businessType,
  ].some((businessType) => isSchoolBusinessType(businessType));

  if (!schoolBusiness) {
    const error = new Error("Receipt validation is available only for schools.");
    error.status = 403;
    throw error;
  }

  return context;
}
