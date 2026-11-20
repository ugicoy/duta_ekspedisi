import { redirect } from "next/navigation";

export default function MasterTariffsRedirectPage() {
  redirect("/dashboard/tariffs");
}
