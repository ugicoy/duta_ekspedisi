import { UserManager } from "@/modules/users/components/user-manager";
import { getUsersPageData } from "@/modules/users/user.queries";

export default async function UsersPage() {
  const data = await getUsersPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Manajemen User & Hak Akses
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola akun pengguna sistem, penugasan role RBAC, dan cakupan gudang
          operasional Bali ⇄ Surabaya.
        </p>
      </div>

      <UserManager data={data} />
    </div>
  );
}
