import React, { useId } from 'react';
import {
  formatCompactHours,
  formatCompactRupiah,
  formatRupiah,
  formatShortDate,
} from '../lib/formatters';
import type { NegotiationSimulationResult, Project, ScopeAnalysisResult } from '../types';

interface MetricSparklineCardsProps {
  project: Project;
  analysis: ScopeAnalysisResult;
  simulation: NegotiationSimulationResult;
}

interface SparklineProps {
  points: number[];
  stroke: string;
  fill: string;
}

const MiniSparkline: React.FC<SparklineProps> = ({ points, stroke, fill }) => {
  const gradId = useId().replace(/:/g, '');
  const width = 92;
  const height = 44;
  const pad = 4;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const isFlat = max === min;
  const span = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = pad + (idx / Math.max(1, points.length - 1)) * (width - pad * 2);
    const y = isFlat
      ? height / 2
      : height - pad - ((val - min) / span) * (height - pad * 2);
    return { x, y };
  });

  // Smooth cubic bezier path
  let linePath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i];
    const next = coords[i + 1];
    const cx = (curr.x + next.x) / 2;
    linePath += ` C ${cx} ${curr.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
  }

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className="w-[70px] h-[36px] shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r="3.2"
        fill={stroke}
      />
    </svg>
  );
};

export const MetricSparklineCards: React.FC<MetricSparklineCardsProps> = ({
  project,
  analysis,
  simulation,
}) => {
  const costDelta = simulation.additionalCostNow;
  const costPositive = costDelta > 0;
  const costNegative = costDelta < 0;

  const costPoints =
    costDelta > 0
      ? [0, costDelta * 0.25, costDelta * 0.48, costDelta * 0.8, costDelta]
      : costDelta < 0
        ? [0, costDelta * 0.25, costDelta * 0.55, costDelta * 0.85, costDelta]
        : [2, 2.5, 2.2, 2.4, 2.3];

  const timeDays = simulation.additionalWorkingDays;
  const hoursDelta = simulation.totalHoursNow - analysis.originalHours;
  const timePoints =
    hoursDelta !== 0
      ? [
          analysis.originalHours,
          analysis.originalHours + hoursDelta * 0.28,
          analysis.originalHours + hoursDelta * 0.65,
          simulation.totalHoursNow,
        ]
      : [2, 2.3, 2.1, 2.2];

  const totalPoints =
    costDelta !== 0
      ? [
          project.initialPrice,
          project.initialPrice + Math.round(costDelta * 0.35),
          project.initialPrice + Math.round(costDelta * 0.72),
          simulation.revisedPrice,
        ]
      : [2, 2.2, 2.1, 2.2];

  return (
    <section
      aria-label="Ringkasan metrik dampak ruang lingkup"
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {/* Kartu 1: Dampak Biaya */}
      <div className="rounded-[24px] bg-white p-4 sm:p-5 shadow-card flex items-center justify-between gap-2 studio-transition hover:shadow-cardHover">
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-inkMuted">Dampak Biaya</span>
          <p
            data-testid="metric-cost-impact"
            className={`mt-1.5 font-numeric text-2xl font-extrabold tracking-tight ${
              costPositive
                ? 'text-rose-600'
                : costNegative
                  ? 'text-emerald-600'
                  : 'text-ink'
            }`}
          >
            {formatCompactRupiah(costDelta, true)}
          </p>
          <p className="mt-1 font-numeric text-[11px] font-medium text-inkMuted truncate">
            {costDelta === 0
              ? 'Sesuai anggaran awal'
              : `${costDelta > 0 ? '+' : ''}${formatRupiah(costDelta)}`}
          </p>
        </div>
        <MiniSparkline
          points={costPoints}
          stroke={costPositive ? '#F43F5E' : '#10B981'}
          fill={costPositive ? '#FB7185' : '#34D399'}
        />
      </div>

      {/* Kartu 2: Tambahan Waktu */}
      <div className="rounded-[24px] bg-white p-4 sm:p-5 shadow-card flex items-center justify-between gap-2 studio-transition hover:shadow-cardHover">
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-inkMuted">Tambahan Waktu</span>
          <p
            data-testid="metric-time-impact"
            className="mt-1.5 font-numeric text-2xl font-extrabold tracking-tight text-ink"
          >
            {timeDays > 0 ? `+${timeDays} Hari` : '0 Hari'}
          </p>
          <p className="mt-1 font-numeric text-[11px] font-medium text-inkMuted truncate">
            {formatCompactHours(analysis.originalHours)} → {formatCompactHours(simulation.totalHoursNow)} •{' '}
            {formatShortDate(simulation.revisedDeadline)}
          </p>
        </div>
        <MiniSparkline points={timePoints} stroke="#10B981" fill="#34D399" />
      </div>

      {/* Kartu 3: Estimasi Total */}
      <div className="rounded-[24px] bg-white p-4 sm:p-5 shadow-card flex items-center justify-between gap-2 studio-transition hover:shadow-cardHover">
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-inkMuted truncate">
            Estimasi Total (awal {formatCompactRupiah(project.initialPrice)})
          </span>
          <p
            data-testid="metric-total-price"
            className="mt-1.5 font-numeric text-2xl font-extrabold tracking-tight text-violetDeep"
          >
            {formatCompactRupiah(simulation.revisedPrice)}
          </p>
          <p className="mt-1 font-numeric text-[11px] font-medium text-inkMuted truncate">
            {formatRupiah(simulation.revisedPrice)}
          </p>
        </div>
        <MiniSparkline points={totalPoints} stroke="#8B5CF6" fill="#A78BFA" />
      </div>
    </section>
  );
};
