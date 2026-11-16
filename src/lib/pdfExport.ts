import { jsPDF } from 'jspdf';
import type {
  NegotiationSimulationResult,
  Project,
  ScopeAnalysisResult,
} from '../types';
import {
  STATUS_BADGE_MAP,
  STRATEGY_META,
  formatHours,
  formatIndonesianDate,
  formatRupiah,
} from './formatters';

export function exportScopeReportPdf(
  project: Project,
  analysis: ScopeAnalysisResult,
  simulation: NegotiationSimulationResult
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > 276) {
      doc.addPage();
      y = 18;
    }
  };

  // Header
  doc.setFillColor(124, 58, 237);
  doc.rect(margin, y, 4, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(30, 27, 46);
  doc.text('ScopeLens — Laporan Perubahan Ruang Lingkup', margin + 8, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(91, 86, 112);
  doc.text(
    `Ringkasan Perubahan Ruang Lingkup & Margin  |  Dicetak: ${formatIndonesianDate(new Date().toISOString().slice(0, 10))}`,
    margin + 8,
    y + 12
  );
  y += 22;

  // Project Metadata Card
  doc.setDrawColor(234, 230, 243);
  doc.setFillColor(250, 249, 246);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 46);
  doc.text(project.name, margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(91, 86, 112);
  doc.text(`Klien: ${project.clientName}  |  Kategori: ${project.category}`, margin + 5, y + 13);
  doc.text(
    `Mulai: ${formatIndonesianDate(project.startDate)}  |  Deadline Awal: ${formatIndonesianDate(project.initialDeadline)}  |  Tarif: ${formatRupiah(project.hourlyRate)}/jam`,
    margin + 5,
    y + 19
  );
  y += 33;

  // Financial & Timeline Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 27, 46);
  doc.text(`Ringkasan Dampak — Strategi: ${STRATEGY_META[simulation.strategy].shortLabel}`, margin, y);
  y += 5;

  const summaryRows = [
    ['Estimasi Awal', formatHours(analysis.originalHours), 'Harga Awal', formatRupiah(project.initialPrice)],
    [
      'Perubahan Jam Aktif',
      `${simulation.additionalHoursNow > 0 ? '+' : ''}${formatHours(simulation.additionalHoursNow)}`,
      'Biaya Tambahan',
      `${simulation.additionalCostNow > 0 ? '+' : ''}${formatRupiah(simulation.additionalCostNow)}`,
    ],
    [
      'Total Jam Terbaru',
      formatHours(simulation.totalHoursNow),
      'Harga Final',
      formatRupiah(simulation.revisedPrice),
    ],
    [
      'Tambahan Waktu',
      `+${simulation.additionalWorkingDays} hari kerja`,
      'Target Deadline Baru',
      formatIndonesianDate(simulation.revisedDeadline),
    ],
  ];

  doc.setFontSize(9.5);
  summaryRows.forEach((row) => {
    ensureSpace(8);
    doc.setDrawColor(234, 230, 243);
    doc.line(margin, y + 6, margin + contentWidth, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(91, 86, 112);
    doc.text(row[0], margin + 2, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 46);
    doc.text(row[1], margin + 45, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(91, 86, 112);
    doc.text(row[2], margin + 94, y + 4);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 46);
    doc.text(row[3], margin + 138, y + 4);
    y += 7.5;
  });

  y += 7;

  // Original Scope List
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`1. Kesepakatan Awal (${project.originalItems.length} item)`, margin, y);
  y += 6;

  doc.setFontSize(9.2);
  project.originalItems.forEach((item, idx) => {
    ensureSpace(8);
    const isSwapped =
      simulation.strategy === 'scope_swap' &&
      project.swappedOutItemIds.includes(item.id);
    const tag = isSwapped ? '[Ditukar]' : '[Sesuai Awal]';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 27, 46);
    doc.text(`${idx + 1}. ${item.name} ${tag}`, margin + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatHours(item.estimatedHours), pageWidth - margin - 2, y, { align: 'right' });
    y += 5.5;
  });

  y += 6;

  // Requested Changes List
  ensureSpace(16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`2. Permintaan Perubahan Klien (${analysis.comparisons.length} item)`, margin, y);
  y += 6;

  doc.setFontSize(9.2);
  if (analysis.comparisons.length === 0 && simulation.swappedOutItems.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(91, 86, 112);
    doc.text('Tidak ada permintaan perubahan tambahan.', margin + 2, y);
    y += 6;
  } else {
    const phase2Ids = new Set(simulation.phase2Items.map((i) => i.id));
    const excludedIds = new Set(simulation.excludedItems.map((i) => i.id));
    const swappedIds = new Set(simulation.swappedOutItems.map((i) => i.id));

    analysis.comparisons.forEach((comp, idx) => {
      ensureSpace(12);
      const isExcluded = excludedIds.has(comp.item.id);
      const isDeferredPhase2 = phase2Ids.has(comp.item.id);
      const isOverriddenBySwap =
        simulation.strategy === 'scope_swap' &&
        Boolean(comp.baselineItem && swappedIds.has(comp.baselineItem.id));

      const effectiveStatus = isDeferredPhase2 ? 'deferred' : comp.detectedStatus;
      const badge = isExcluded ? 'Diabaikan' : STATUS_BADGE_MAP[effectiveStatus].label;
      const effectiveDeltaHours =
        isExcluded || isDeferredPhase2 || isOverriddenBySwap ? 0 : comp.deltaHours;
      const effectiveDeltaCost =
        isExcluded || isDeferredPhase2 || isOverriddenBySwap ? 0 : comp.deltaCost;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 27, 46);
      doc.text(`${idx + 1}. ${comp.item.name} [${badge}]`, margin + 2, y);
      const sign = effectiveDeltaHours > 0 ? '+' : '';
      const costSign = effectiveDeltaCost > 0 ? '+' : '';
      doc.text(
        `${sign}${formatHours(effectiveDeltaHours)} (${costSign}${formatRupiah(effectiveDeltaCost)})`,
        pageWidth - margin - 2,
        y,
        { align: 'right' }
      );
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(91, 86, 112);
      const summaryText = isDeferredPhase2
        ? `Dialihkan ke Fase 2 (estimasi ${formatHours(comp.item.estimatedHours)} / ${formatRupiah(comp.deltaCost)})`
        : isExcluded
          ? 'Tidak dimasukkan ke kesepakatan fase ini'
          : isOverriddenBySwap
            ? 'Fitur awal ditukar keluar pada opsi Tukar Fitur'
            : comp.changesSummary.join(' • ');
      const detail = doc.splitTextToSize(summaryText, contentWidth - 6);
      doc.text(detail, margin + 5, y);
      y += detail.length * 4.2 + 2;
    });

    if (simulation.strategy === 'scope_swap') {
      simulation.swappedOutItems.forEach((orig) => {
        ensureSpace(10);
        const swapCost = -Math.round((Math.round(orig.estimatedHours * 1000) * Math.round(project.hourlyRate)) / 1000);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`• Ditukar keluar: ${orig.name} [Ditukar]`, margin + 2, y);
        doc.text(
          `-${formatHours(orig.estimatedHours)} (${formatRupiah(swapCost)})`,
          pageWidth - margin - 2,
          y,
          { align: 'right' }
        );
        y += 5.5;
      });
    }
  }

  y += 6;
  ensureSpace(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 27, 46);
  doc.text('Catatan Strategi Negosiasi', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(91, 86, 112);
  const summaryWrapped = doc.splitTextToSize(simulation.summary, contentWidth);
  doc.text(summaryWrapped, margin, y);

  const safeSlug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  doc.save(`scopelens-report-${safeSlug || 'project'}.pdf`);
}
