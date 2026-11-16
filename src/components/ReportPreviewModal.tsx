import React, { useId } from 'react';
import { Archive, Download, Printer, X } from 'lucide-react';
import {
  STATUS_BADGE_MAP,
  STRATEGY_META,
  formatHours,
  formatIndonesianDate,
  formatRupiah,
} from '../lib/formatters';
import type {
  NegotiationSimulationResult,
  Project,
  ProjectReportSnapshot,
  ScopeAnalysisResult,
} from '../types';
import { NativeDialog } from './NativeDialog';

interface ReportPreviewModalProps {
  open: boolean;
  project: Project;
  analysis: ScopeAnalysisResult;
  simulation: NegotiationSimulationResult;
  reports: ProjectReportSnapshot[];
  onClose: () => void;
  onExportPdf: () => void;
  onSaveSnapshot: () => void;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  open,
  project,
  analysis,
  simulation,
  reports,
  onClose,
  onExportPdf,
  onSaveSnapshot,
}) => {
  const titleId = useId();

  return (
    <NativeDialog open={open} onClose={onClose} labelledBy={titleId} wide>
      <div className="p-6 sm:p-8 space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-borderSoft pb-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-ink">
              Pratinjau Laporan Perubahan Ruang Lingkup (A4)
            </h2>
            <p className="text-xs text-inkMuted mt-0.5">
              Cetak langsung, unduh PDF A4, atau simpan arsip permanen agar riwayat tidak
              berubah saat proyek disunting lagi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSaveSnapshot}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-lavenderTint px-3.5 py-2 text-xs font-bold text-violetPrimary hover:bg-violet-200/70 min-h-[40px]"
            >
              <Archive className="w-4 h-4" aria-hidden="true" />
              <span>Simpan Snapshot</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-borderSoft bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:bg-subtle min-h-[40px]"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>Cetak A4</span>
            </button>

            <button
              type="button"
              onClick={onExportPdf}
              className="cta-focal-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-card min-h-[40px]"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau laporan"
              className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-subtle min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <article className="print-card rounded-2xl border border-borderSoft bg-white p-6 sm:p-8 space-y-6">
          <header className="border-b border-borderSoft pb-4 flex flex-wrap justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-violetDeep">
                ScopeLens • Ringkasan Perubahan Ruang Lingkup
              </p>
              <h3 className="text-2xl font-extrabold text-ink mt-1">{project.name}</h3>
              <p className="text-sm text-inkMuted mt-0.5">
                Klien: <strong className="text-ink">{project.clientName}</strong> • Kategori:{' '}
                {project.category}
              </p>
            </div>
            <div className="text-left sm:text-right font-numeric text-xs text-inkMuted space-y-1">
              <p>Mulai: {formatIndonesianDate(project.startDate)}</p>
              <p>Deadline Awal: {formatIndonesianDate(project.initialDeadline)}</p>
              <p>Tarif: {formatRupiah(project.hourlyRate)}/jam</p>
            </div>
          </header>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-borderSoft bg-canvas p-3">
              <span className="block text-[11px] font-semibold text-inkMuted">Harga Awal</span>
              <span className="font-numeric text-sm font-bold text-ink">
                {formatRupiah(project.initialPrice)}
              </span>
            </div>
            <div className="rounded-xl border border-borderSoft bg-canvas p-3">
              <span className="block text-[11px] font-semibold text-inkMuted">Biaya Tambahan</span>
              <span
                className={`font-numeric text-sm font-bold ${
                  simulation.additionalCostNow > 0
                    ? 'text-rose-700'
                    : simulation.additionalCostNow < 0
                      ? 'text-emerald-700'
                      : 'text-ink'
                }`}
              >
                {simulation.additionalCostNow > 0 ? '+' : ''}
                {formatRupiah(simulation.additionalCostNow)}
              </span>
            </div>
            <div className="rounded-xl border border-borderSoft bg-canvas p-3">
              <span className="block text-[11px] font-semibold text-inkMuted">Harga Final</span>
              <span className="font-numeric text-sm font-bold text-violetPrimary">
                {formatRupiah(simulation.revisedPrice)}
              </span>
            </div>
            <div className="rounded-xl border border-borderSoft bg-canvas p-3">
              <span className="block text-[11px] font-semibold text-inkMuted">Deadline Baru</span>
              <span className="font-numeric text-sm font-bold text-ink">
                {formatIndonesianDate(simulation.revisedDeadline)}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold text-ink mb-2">
              Rincian Perubahan Ruang Lingkup ({STRATEGY_META[simulation.strategy].shortLabel})
            </h4>
            <table className="w-full text-left border-collapse text-xs">
              <caption className="visually-hidden">
                Tabel perbandingan kesepakatan awal dan permintaan perubahan
              </caption>
              <thead>
                <tr className="border-b border-borderSoft text-inkMuted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Item Pekerjaan</th>
                  <th scope="col" className="py-2 px-3 font-semibold">Status</th>
                  <th scope="col" className="py-2 px-3 font-semibold text-right">Selisih Jam</th>
                  <th scope="col" className="py-2 pl-3 font-semibold text-right">Dampak Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSoft/70">
                {analysis.comparisons.map((comp) => {
                  const isExcluded = simulation.excludedItems.some((e) => e.id === comp.item.id);
                  const isDeferredPhase2 = simulation.phase2Items.some((p) => p.id === comp.item.id);
                  const isSwappedParent =
                    simulation.strategy === 'scope_swap' &&
                    Boolean(
                      comp.baselineItem &&
                        simulation.swappedOutItems.some((s) => s.id === comp.baselineItem!.id)
                    );
                  const effectiveStatus = isDeferredPhase2 ? 'deferred' : comp.detectedStatus;
                  const badge = STATUS_BADGE_MAP[effectiveStatus];
                  const effectiveDeltaHours =
                    isExcluded || isDeferredPhase2 || isSwappedParent ? 0 : comp.deltaHours;
                  const effectiveDeltaCost =
                    isExcluded || isDeferredPhase2 || isSwappedParent ? 0 : comp.deltaCost;
                  const sign = effectiveDeltaHours > 0 ? '+' : '';
                  const costSign = effectiveDeltaCost > 0 ? '+' : '';

                  return (
                    <tr key={comp.item.id}>
                      <td className="py-2.5 pr-3 font-semibold text-ink">
                        {comp.item.name}
                        {isDeferredPhase2 && (
                          <span className="block text-[11px] font-normal text-inkMuted">
                            Estimasi Fase 2: {formatHours(comp.item.estimatedHours)} (
                            {formatRupiah(comp.deltaCost)})
                          </span>
                        )}
                        {isExcluded && (
                          <span className="block text-[11px] font-normal text-inkMuted">
                            Tidak disertakan pada kesepakatan fase ini
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: isExcluded ? '#F1F5F9' : badge.bg,
                            color: isExcluded ? '#475569' : badge.text,
                            borderColor: isExcluded ? '#CBD5E1' : badge.border,
                          }}
                        >
                          {isExcluded ? 'Diabaikan' : badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-numeric">
                        {sign}
                        {formatHours(effectiveDeltaHours)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-numeric font-semibold">
                        {costSign}
                        {formatRupiah(effectiveDeltaCost)}
                      </td>
                    </tr>
                  );
                })}
                {simulation.strategy === 'scope_swap' &&
                  simulation.swappedOutItems.map((orig) => {
                    const swapCost = -Math.round(
                      (Math.round(orig.estimatedHours * 1000) * Math.round(project.hourlyRate)) /
                        1000
                    );
                    const swapBadge = STATUS_BADGE_MAP.swapped;
                    return (
                      <tr key={`swap-${orig.id}`} className="bg-slate-50/60">
                        <td className="py-2.5 pr-3 font-semibold text-slate-700">
                          Ditukar keluar: {orig.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: swapBadge.bg,
                              color: swapBadge.text,
                              borderColor: swapBadge.border,
                            }}
                          >
                            {swapBadge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-numeric text-emerald-700">
                          -{formatHours(orig.estimatedHours)}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-numeric font-semibold text-emerald-700">
                          {formatRupiah(swapCost)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </article>

        {/* Archived Snapshots */}
        {reports.length > 0 && (
          <div className="no-print space-y-2">
            <h3 className="text-sm font-bold text-ink">
              Riwayat Snapshot Tersimpan ({reports.length})
            </h3>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {reports.map((rep) => (
                <li
                  key={rep.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-borderSoft bg-canvas px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-bold text-ink">{rep.reportTitle}</span>
                    <span className="block text-inkMuted mt-0.5 font-numeric">
                      {new Date(rep.generatedAt).toLocaleString('id-ID')} • Harga:{' '}
                      {formatRupiah(rep.reportData.negotiation.revisedPrice)}
                    </span>
                  </div>
                  <span className="rounded-full bg-surface border border-borderSoft px-2.5 py-0.5 font-semibold text-inkMuted">
                    {STRATEGY_META[rep.reportData.negotiation.strategy].shortLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </NativeDialog>
  );
};
