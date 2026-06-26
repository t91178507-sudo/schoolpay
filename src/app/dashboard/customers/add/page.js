import { redirect } from "next/navigation";

export default function LegacyCustomerAddPage() {
  redirect("/dashboard/customers");
}
