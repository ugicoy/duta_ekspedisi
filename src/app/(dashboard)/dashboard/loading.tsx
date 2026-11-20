export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Bar progres tipis di atas */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-1/2 rounded-full bg-blue-500" />
      </div>

      {/* Skeleton Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-slate-800" />
          <div className="h-4 w-80 rounded-md bg-slate-800/70" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-slate-800" />
      </div>

      {/* Skeleton Kartu Statistik */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <div className="h-3.5 w-24 rounded bg-slate-800" />
            <div className="mt-3 h-7 w-32 rounded-lg bg-slate-800" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-800/70" />
          </div>
        ))}
      </div>

      {/* Skeleton Tabel / Konten Utama */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-5 w-44 rounded bg-slate-800" />
          <div className="h-9 w-52 rounded-xl bg-slate-800" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-11 w-full rounded-xl bg-slate-800/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
