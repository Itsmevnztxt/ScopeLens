import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarClock,
  Layers,
  Layout,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  STATUS_BADGE_MAP,
  formatCompactHours,
  formatCompactRupiah,
  formatHours,
} from '../lib/formatters';
import type {
  NegotiationSimulationResult,
  Project,
  ScopeAnalysisResult,
  WorkItem,
} from '../types';

interface ScopeWorkspaceProps {
  project: Project;
  analysis: ScopeAnalysisResult;
  simulation: NegotiationSimulationResult;
  baselineLocked: boolean;
  onToggleBaselineLock: () => void;
  onOpenAddModal: (type: 'original' | 'requested') => void;
  onOpenEditModal: (type: 'original' | 'requested', item: WorkItem) => void;
  onDeleteItem: (type: 'original' | 'requested', id: string) => void;
  onQuickUpdateHours: (type: 'original' | 'requested', id: string, hours: number) => void;
  onToggleDeferred: (id: string) => void;
  onToggleExcluded: (id: string) => void;
  onToggleSwapItem: (baselineItemId: string) => void;
}

const PASTEL_SQUIRCLES = [
  { bg: 'bg-[#EDE9FE]', text: 'text-[#7C3AED]', icon: Layout },
  { bg: 'bg-[#E0F2FE]', text: 'text-[#0284C7]', icon: MessageSquare },
  { bg: 'bg-[#DCFCE7]', text: 'text-[#059669]', icon: Smartphone },
  { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]', icon: Layers },
];

const QuickHoursInput: React.FC<{
  id: string;
  value: number;
  disabled?: boolean;
  onCommit: (hours: number) => void;
}> = ({ id, value, disabled = false, onCommit }) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      min={0}
      step="0.5"
      disabled={disabled}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw.trim() === '') return;
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) {
          onCommit(parsed);
        }
      }}
      onBlur={() => {
        const parsed = Number(draft);
        if (draft.trim() === '' || !Number.isFinite(parsed) || parsed < 0) {
          setDraft(String(value));
        } else {
          setDraft(String(parsed));
          onCommit(parsed);
        }
      }}
      className="w-16 rounded-xl bg-white border border-borderSoft px-2 py-1 font-numeric text-xs font-bold text-ink disabled:bg-subtle text-center"
    />
  );
};

export const ScopeWorkspace: React.FC<ScopeWorkspaceProps> = ({
  project,
  analysis,
  simulation,
  baselineLocked,
  onToggleBaselineLock,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteItem,
  onQuickUpdateHours,
  onToggleDeferred,
  onToggleExcluded,
  onToggleSwapItem,
}) => {
  const isScopeSwapActive = project.negotiationStrategy === 'scope_swap';

  return (
    <section
      aria-label="Perbandingan ruang lingkup awal dan permintaan terbaru"
      className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start"
    >
      {/* KOLOM KIRI: KESEPAKATAN AWAL */}
      <div className="rounded-[28px] bg-white p-5 sm:p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink">
              Kesepakatan Awal
            </h2>
            <p className="font-numeric text-xs font-semibold text-inkMuted mt-0.5">
              {formatHours(analysis.originalHours)} • {formatCompactRupiah(project.initialPrice)}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleBaselineLock}
              aria-pressed={baselineLocked}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold studio-transition min-h-[36px] ${
                baselineLocked
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {baselineLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Terkunci</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mode Ubah</span>
                </>
              )}
            </button>

            {!baselineLocked && (
              <button
                type="button"
                onClick={() => onOpenAddModal('original')}
                className="inline-flex items-center gap-1 rounded-full bg-lavenderTint px-3 py-1.5 text-xs font-bold text-violetDeep hover:bg-violet-200/70 studio-transition min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Tambah</span>
              </button>
            )}
          </div>
        </div>

        <ul className="space-y-2.5">
          {analysis.baselineComparisons.length === 0 ? (
            <li className="rounded-2xl bg-canvas p-6 text-center text-sm text-inkMuted">
              Belum ada item kesepakatan awal. Buka kunci untuk menambahkan ruang lingkup awal.
            </li>
          ) : (
            analysis.baselineComparisons.map((comp, idx) => {
              const badge = STATUS_BADGE_MAP[comp.detectedStatus];
              const isSwapped = comp.detectedStatus === 'swapped';
              const palette = PASTEL_SQUIRCLES[idx % PASTEL_SQUIRCLES.length];
              const Icon = palette.icon;

              return (
                <li
                  key={comp.item.id}
                  className={`rounded-2xl p-3.5 studio-transition ${
                    isSwapped ? 'bg-slate-50 opacity-75' : 'bg-canvas/75 hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Solid Pastel Squircle Icon */}
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        isSwapped ? 'bg-slate-200 text-slate-500' : `${palette.bg} ${palette.text}`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSwapped ? 'line-through text-inkMuted' : 'text-ink'
                          }`}
                        >
                          {comp.item.name}
                        </span>
                        <span className="font-numeric text-xs font-bold text-ink">
                          {formatCompactHours(comp.item.estimatedHours)}
                        </span>
                      </div>

                      {comp.item.description && (
                        <p className="text-xs text-inkMuted mt-0.5 line-clamp-2 leading-relaxed">
                          {comp.item.description}
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                            style={{ backgroundColor: badge.bg, color: badge.text }}
                          >
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-medium text-inkMuted">
                            {comp.item.category} • {comp.item.revisionLimit}x revisi
                          </span>
                        </div>

                        {isScopeSwapActive && comp.detectedStatus !== 'removed' && (
                          <button
                            type="button"
                            onClick={() => onToggleSwapItem(comp.item.id)}
                            aria-pressed={isSwapped}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold studio-transition min-h-[30px] ${
                              isSwapped
                                ? 'bg-violetPrimary text-white'
                                : 'bg-white text-violetDeep hover:bg-lavenderTint shadow-sm'
                            }`}
                          >
                            <ArrowLeftRight className="w-3 h-3" aria-hidden="true" />
                            <span>{isSwapped ? 'Batal Tukar' : 'Tukar Fitur'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {!baselineLocked && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenEditModal('original', comp.item)}
                          aria-label={`Ubah item awal ${comp.item.name}`}
                          className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-white min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteItem('original', comp.item.id)}
                          aria-label={`Hapus item awal ${comp.item.name}`}
                          className="rounded-xl p-2 text-inkMuted hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* KOLOM KANAN: PERMINTAAN TERBARU KLIEN */}
      <div className="rounded-[28px] bg-white p-5 sm:p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-ink">
              Permintaan Terbaru Klien
            </h2>
            <p className="font-numeric text-xs font-semibold text-inkMuted mt-0.5">
              {analysis.rawAdditionalHours >= 0 ? '+' : ''}
              {formatHours(analysis.rawAdditionalHours)} • {project.requestedItems.length} item
            </p>
          </div>

          <span className="inline-flex items-center rounded-full bg-[#FFF1F2] px-3 py-1 font-numeric text-[11px] font-bold text-[#BE123C]">
            {analysis.creepPercentage > 0 ? '+' : ''}
            {analysis.creepPercentage}% Beban Kerja Tambahan
          </span>
        </div>

        <ul className="space-y-2.5">
          {analysis.comparisons.length === 0 ? (
            <li className="rounded-2xl bg-canvas p-6 text-center text-sm text-inkMuted">
              Belum ada permintaan tambahan dari klien. Tekan <strong>+ Permintaan Baru</strong> jika ada perubahan di luar kesepakatan.
            </li>
          ) : (
            analysis.comparisons.map((comp) => {
              const isExcluded = project.excludedRequestIds.includes(comp.item.id);
              const isIndividuallyDeferred = comp.detectedStatus === 'deferred';
              const isPhase2ByStrategy =
                project.negotiationStrategy === 'phase_2' &&
                !isExcluded &&
                simulation.phase2Items.some((p) => p.id === comp.item.id);
              const isDeferred = isIndividuallyDeferred || isPhase2ByStrategy;
              const isOverriddenBySwap =
                isScopeSwapActive &&
                !isExcluded &&
                Boolean(
                  comp.baselineItem &&
                    simulation.swappedOutItems.some((s) => s.id === comp.baselineItem!.id)
                );
              const badge = STATUS_BADGE_MAP[isDeferred ? 'deferred' : comp.detectedStatus];
              const sign = comp.deltaHours > 0 ? '+' : '';

              return (
                <li
                  key={comp.item.id}
                  className={`rounded-2xl p-3.5 studio-transition ${
                    isExcluded || isOverriddenBySwap
                      ? 'bg-slate-50 opacity-75'
                      : isDeferred
                        ? 'bg-lavenderTint/60'
                        : 'bg-canvas/75 hover:bg-canvas'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Soft Coral / Status Pastel Squircle Icon */}
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        isExcluded || isOverriddenBySwap
                          ? 'bg-slate-200 text-slate-500'
                          : isDeferred
                            ? 'bg-[#EDE9FE] text-[#7C3AED]'
                            : 'bg-[#FFE4E6] text-[#E11D48]'
                      }`}
                    >
                      {isDeferred ? (
                        <CalendarClock className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <label className="inline-flex items-center gap-2 cursor-pointer min-w-0">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => onToggleExcluded(comp.item.id)}
                            aria-label={`Sertakan ${comp.item.name} dalam simulasi`}
                            className="h-4 w-4 rounded accent-violetPrimary shrink-0 cursor-pointer"
                          />
                          <span
                            className={`text-sm font-bold truncate ${
                              isExcluded || isOverriddenBySwap
                                ? 'line-through text-inkMuted'
                                : 'text-ink'
                            }`}
                          >
                            {comp.item.name}
                          </span>
                        </label>

                        <span
                          className={`font-numeric text-xs font-extrabold shrink-0 ${
                            isExcluded || isOverriddenBySwap
                              ? 'text-inkMuted line-through'
                              : isDeferred
                                ? 'text-violetDeep'
                                : comp.deltaCost > 0
                                  ? 'text-rose-600'
                                  : comp.deltaCost < 0
                                    ? 'text-emerald-600'
                                    : 'text-inkMuted'
                          }`}
                        >
                          {sign}
                          {formatCompactRupiah(comp.deltaCost)}
                        </span>
                      </div>

                      {comp.item.description && (
                        <p className="text-xs text-inkMuted mt-1 line-clamp-2 leading-relaxed">
                          {comp.item.description}
                        </p>
                      )}

                      {isOverriddenBySwap && (
                        <p className="text-[11px] font-semibold text-violetDeep mt-1">
                          Fitur awal ditukar keluar — tidak dihitung di Fase 1
                        </p>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: isExcluded ? '#F1F5F9' : badge.bg,
                              color: isExcluded ? '#475569' : badge.text,
                            }}
                          >
                            {isExcluded ? 'Diabaikan' : badge.label}
                          </span>

                          <label
                            htmlFor={`quick-hours-${comp.item.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-inkMuted"
                          >
                            <QuickHoursInput
                              id={`quick-hours-${comp.item.id}`}
                              value={comp.item.estimatedHours}
                              disabled={comp.detectedStatus === 'removed'}
                              onCommit={(val) =>
                                onQuickUpdateHours('requested', comp.item.id, val)
                              }
                            />
                            <span>jam</span>
                          </label>
                        </div>

                        <div className="flex items-center gap-1">
                          {isPhase2ByStrategy && !isIndividuallyDeferred ? (
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-violetDeep shadow-sm">
                              Masuk Fase 2
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggleDeferred(comp.item.id)}
                              aria-pressed={isIndividuallyDeferred}
                              className={`rounded-full px-3 py-1 text-[11px] font-bold studio-transition min-h-[30px] ${
                                isIndividuallyDeferred
                                  ? 'bg-violetPrimary text-white'
                                  : 'bg-white text-inkMuted hover:text-violetDeep shadow-sm'
                              }`}
                            >
                              {isIndividuallyDeferred ? 'Aktifkan Fase 1' : 'Tunda ke Fase 2'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenEditModal('requested', comp.item)}
                            aria-label={`Ubah permintaan ${comp.item.name}`}
                            className="rounded-xl p-1.5 text-inkMuted hover:text-ink hover:bg-white min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem('requested', comp.item.id)}
                            aria-label={`Hapus permintaan ${comp.item.name}`}
                            className="rounded-xl p-1.5 text-inkMuted hover:text-rose-600 hover:bg-rose-50 min-h-[32px] min-w-[32px] inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </section>
  );
};
