import { getCurrentSession } from "@/lib/auth-guard";
import DashboardShell from "./shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  return <DashboardShell user={session}>{children}</DashboardShell>;
}
