"use client";

interface RouteVisualizerProps {
  direction: "SBY_TO_DPS" | "DPS_TO_SBY";
  onChangeDirection: (dir: "SBY_TO_DPS" | "DPS_TO_SBY") => void;
}

export function RouteVisualizer({
  direction,
  onChangeDirection,
}: RouteVisualizerProps) {
  const isSbyToDps = direction === "SBY_TO_DPS";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-800/50 bg-slate-900/80 p-5 shadow-2xl backdrop-blur">
      <style>{`
        @keyframes dashFlowForward {
          to {
            stroke-dashoffset: -36;
          }
        }
        @keyframes dashFlowReverse {
          to {
            stroke-dashoffset: 36;
          }
        }
        @keyframes ferryFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        @keyframes radarPulse {
          0% {
            transform: scale(0.85);
            opacity: 0.85;
          }
          100% {
            transform: scale(2.1);
            opacity: 0;
          }
        }
        .route-dash-forward {
          animation: dashFlowForward 1.4s linear infinite;
        }
        .route-dash-reverse {
          animation: dashFlowReverse 1.4s linear infinite;
        }
        .ferry-float {
          animation: ferryFloat 2.6s ease-in-out infinite;
        }
        .port-radar {
          transform-box: fill-box;
          transform-origin: center;
          animation: radarPulse 2.2s ease-out infinite;
        }
      `}</style>

      {/* Header Toggle Arah Rute */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-300">
            Live Corridor • Selat Bali Crossing
          </span>
        </div>

        <div className="inline-flex rounded-xl border border-slate-700/80 bg-slate-950 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => onChangeDirection("SBY_TO_DPS")}
            className={`rounded-lg px-2.5 py-1 font-semibold transition ${
              isSbyToDps
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Surabaya → Bali
          </button>
          <button
            type="button"
            onClick={() => onChangeDirection("DPS_TO_SBY")}
            className={`rounded-lg px-2.5 py-1 font-semibold transition ${
              !isSbyToDps
                ? "bg-amber-500 text-slate-950 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Bali → Surabaya
          </button>
        </div>
      </div>

      {/* Peta SVG Interaktif */}
      <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/90 p-3">
        <svg
          viewBox="0 0 560 210"
          className="h-auto w-full"
          role="img"
          aria-label="Animasi rute pengiriman kargo Surabaya - Ketapang - Gilimanuk - Denpasar Bali"
        >
          <defs>
            <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="routeGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          {/* Zona Selat Bali */}
          <rect
            x="235"
            y="14"
            width="95"
            height="182"
            rx="14"
            fill="url(#seaGrad)"
          />
          <text
            x="282"
            y="32"
            textAnchor="middle"
            className="fill-cyan-400/80 font-mono text-[9px] font-semibold uppercase tracking-widest"
          >
            Selat Bali
          </text>

          {/* Siluet Pulau Jawa Timur (kiri) & Pulau Bali (kanan) */}
          <path
            d="M 18 45 Q 110 30 228 65 L 222 175 Q 115 182 18 165 Z"
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth="1.5"
          />
          <path
            d="M 336 72 Q 430 48 542 82 L 535 168 Q 430 185 338 158 Z"
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth="1.5"
          />

          {/* Jalur Rute Utama (Dasar) */}
          <path
            d="M 62 96 Q 145 78 218 112 L 346 112 Q 425 95 498 124"
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Jalur Rute Animasi Bergerak */}
          <path
            d="M 62 96 Q 145 78 218 112 L 346 112 Q 425 95 498 124"
            fill="none"
            stroke="url(#routeGlow)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="10 8"
            className={isSbyToDps ? "route-dash-forward" : "route-dash-reverse"}
          />

          {/* Ikon Kapal Feri Bergerak di Selat Bali */}
          <g className="ferry-float">
            <rect
              x="253"
              y="95"
              width="58"
              height="22"
              rx="11"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />
            <text
              x="282"
              y="109"
              textAnchor="middle"
              className="fill-cyan-300 font-mono text-[9px] font-bold"
            >
              {isSbyToDps ? "⛴️ →" : "← ⛴️"}
            </text>
          </g>

          {/* Titik 1: Gudang Surabaya */}
          <g>
            <circle
              cx="62"
              cy="96"
              r="11"
              fill={isSbyToDps ? "#2563eb" : "#10b981"}
              fillOpacity="0.25"
              className="port-radar"
            />
            <circle
              cx="62"
              cy="96"
              r="7"
              fill={isSbyToDps ? "#3b82f6" : "#10b981"}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x="62"
              y="72"
              textAnchor="middle"
              className="fill-white text-[11px] font-bold"
            >
              SURABAYA
            </text>
            <text
              x="62"
              y="122"
              textAnchor="middle"
              className="fill-slate-400 font-mono text-[9px]"
            >
              {isSbyToDps ? "Gudang Asal" : "Gudang Tujuan"}
            </text>
          </g>

          {/* Titik 2: Pelabuhan Ketapang */}
          <g>
            <circle
              cx="218"
              cy="112"
              r="9"
              fill="#06b6d4"
              fillOpacity="0.3"
              className="port-radar"
            />
            <circle
              cx="218"
              cy="112"
              r="5.5"
              fill="#22d3ee"
              stroke="#083344"
              strokeWidth="1.5"
            />
            <text
              x="202"
              y="142"
              textAnchor="middle"
              className="fill-cyan-300 text-[10px] font-semibold"
            >
              Pel. Ketapang
            </text>
            <text
              x="202"
              y="154"
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[8px]"
            >
              Checkpoint Foto
            </text>
          </g>

          {/* Titik 3: Pelabuhan Gilimanuk */}
          <g>
            <circle
              cx="346"
              cy="112"
              r="9"
              fill="#f59e0b"
              fillOpacity="0.3"
              className="port-radar"
            />
            <circle
              cx="346"
              cy="112"
              r="5.5"
              fill="#fbbf24"
              stroke="#451a03"
              strokeWidth="1.5"
            />
            <text
              x="362"
              y="142"
              textAnchor="middle"
              className="fill-amber-300 text-[10px] font-semibold"
            >
              Pel. Gilimanuk
            </text>
            <text
              x="362"
              y="154"
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[8px]"
            >
              Checkpoint Foto
            </text>
          </g>

          {/* Titik 4: Gudang Bali (Denpasar) */}
          <g>
            <circle
              cx="498"
              cy="124"
              r="11"
              fill={!isSbyToDps ? "#2563eb" : "#10b981"}
              fillOpacity="0.25"
              className="port-radar"
            />
            <circle
              cx="498"
              cy="124"
              r="7"
              fill={!isSbyToDps ? "#3b82f6" : "#10b981"}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <text
              x="498"
              y="100"
              textAnchor="middle"
              className="fill-white text-[11px] font-bold"
            >
              BALI (DPS)
            </text>
            <text
              x="498"
              y="148"
              textAnchor="middle"
              className="fill-slate-400 font-mono text-[9px]"
            >
              {!isSbyToDps ? "Gudang Asal" : "Gudang Tujuan"}
            </text>
          </g>
        </svg>
      </div>

      {/* Ringkasan Koridor */}
      <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[10px] text-slate-400">Estimasi Tempuh</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-white">
            1 – 2 Hari
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[10px] text-slate-400">Bukti Transit</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-amber-300">
            Foto Pelabuhan
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
          <div className="text-[10px] text-slate-400">Jadwal Armada</div>
          <div className="mt-0.5 font-mono text-xs font-bold text-emerald-400">
            Berangkat Rutin
          </div>
        </div>
      </div>
    </div>
  );
}
