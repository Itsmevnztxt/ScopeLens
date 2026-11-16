import type {
  GeneratedMessages,
  NegotiationSimulationResult,
  Project,
  ScopeAnalysisResult,
} from '../types';
import {
  formatHours,
  formatIndonesianDate,
  formatRupiah,
} from '../lib/formatters';

export function generateNegotiationMessages(
  project: Project,
  analysis: ScopeAnalysisResult,
  simulation: NegotiationSimulationResult
): GeneratedMessages {
  const client = project.clientName.trim() || 'Bapak/Ibu';
  const projectName = project.name.trim() || 'Proyek';

  const requestedListLines = analysis.comparisons
    .filter((c) => !project.excludedRequestIds?.includes(c.item.id))
    .map((c, idx) => {
      const sign = c.deltaHours > 0 ? '+' : '';
      const deferredTag =
        simulation.strategy !== 'phase_2' && c.detectedStatus === 'deferred'
          ? ' [Ditunda ke Fase 2]'
          : '';
      return `${idx + 1}. ${c.item.name} (${sign}${formatHours(c.deltaHours)})${deferredTag}`;
    });

  const changesBlock =
    requestedListLines.length > 0
      ? requestedListLines.join('\n')
      : '- Belum ada perubahan di luar kesepakatan awal.';

  let strategyBodyWa = '';
  let strategyBodyEmail = '';
  let emailSubject = `Konfirmasi Penyesuaian Ruang Lingkup — ${projectName}`;

  if (simulation.strategy === 'accept_changes') {
    const costLabel =
      simulation.additionalCostNow > 0
        ? `+${formatRupiah(simulation.additionalCostNow)}`
        : formatRupiah(simulation.additionalCostNow);
    const hoursLabel =
      simulation.additionalHoursNow > 0
        ? `+${formatHours(simulation.additionalHoursNow)}`
        : formatHours(simulation.additionalHoursNow);
    const daysText =
      simulation.additionalWorkingDays > 0
        ? ` (+${simulation.additionalWorkingDays} hari kerja)`
        : ' (jadwal tetap)';

    strategyBodyWa = [
      `Dengan tetap menjaga kualitas pengerjaan, seluruh permintaan di atas dapat saya kerjakan pada fase saat ini dengan penyesuaian berikut:`,
      `• Estimasi tambahan waktu: *${hoursLabel}*${daysText}`,
      `• Penyesuaian biaya: *${costLabel}* (tarif ${formatRupiah(project.hourlyRate)}/jam)`,
      `• Total nilai proyek terbaru: *${formatRupiah(simulation.revisedPrice)}*`,
      `• Target selesai terbaru: *${formatIndonesianDate(simulation.revisedDeadline)}*`,
      ``,
      `Jika ${client} sepakat dengan penyesuaian ini, saya siap langsung lanjut ke tahap pengerjaan. Terima kasih!`,
    ].join('\n');

    strategyBodyEmail = [
      `Untuk mengakomodasi seluruh permintaan tambahan di atas pada fase berjalan, berikut ringkasan penyesuaian anggaran dan jadwal kerja:`,
      `- Tambahan jam kerja: ${hoursLabel}${daysText}`,
      `- Biaya tambahan: ${costLabel} (${formatRupiah(project.hourlyRate)}/jam)`,
      `- Total biaya proyek terbaru: ${formatRupiah(simulation.revisedPrice)}`,
      `- Target selesai terbaru: ${formatIndonesianDate(simulation.revisedDeadline)} (dari tenggat awal ${formatIndonesianDate(project.initialDeadline)})`,
      ``,
      `Mohon konfirmasi persetujuan dari ${client} agar penyesuaian ruang lingkup ini dapat segera saya kerjakan.`,
    ].join('\n');
  } else if (simulation.strategy === 'scope_swap') {
    const swappedNames =
      simulation.swappedOutItems.length > 0
        ? simulation.swappedOutItems.map((s) => `${s.name} (${formatHours(s.estimatedHours)})`).join(', ')
        : '(belum ada fitur awal yang dipilih untuk ditukar)';

    const deltaCostLine =
      simulation.additionalCostNow === 0
        ? `Rp0 (anggaran tetap ${formatRupiah(simulation.revisedPrice)})`
        : `${simulation.additionalCostNow > 0 ? '+' : ''}${formatRupiah(simulation.additionalCostNow)} → Total ${formatRupiah(simulation.revisedPrice)}`;

    const deadlineNote =
      simulation.additionalWorkingDays > 0
        ? `*${formatIndonesianDate(simulation.revisedDeadline)}* (+${simulation.additionalWorkingDays} hari kerja)`
        : `*${formatIndonesianDate(simulation.revisedDeadline)}* (tetap sesuai jadwal awal)`;

    emailSubject = `Opsi Tukar Fitur — ${projectName}`;

    strategyBodyWa = [
      `Agar anggaran dan tenggat waktu tetap terjaga, saya mengusulkan opsi *Tukar Fitur*:`,
      `• Fitur awal yang ditukar/ditunda: *${swappedNames}* (total ${formatHours(simulation.swappedOutHours)})`,
      `• Total jam permintaan baru: *${formatHours(simulation.incomingSwapHours)}*`,
      `• Selisih biaya: *${deltaCostLine}*`,
      `• Target selesai: ${deadlineNote}`,
      ``,
      `Bagaimana menurut ${client}? Jika opsi tukar fitur ini cocok, kita bisa langsung lanjut sesuai prioritas terbaru.`,
    ].join('\n');

    strategyBodyEmail = [
      `Agar anggaran dan jadwal Fase 1 tetap terkendali, saya mengusulkan skema Tukar Fitur dengan menukar pekerjaan awal berikut:`,
      `- Fitur awal yang dikeluarkan dari fase ini: ${swappedNames} (${formatHours(simulation.swappedOutHours)})`,
      `- Permintaan baru yang masuk: ${formatHours(simulation.incomingSwapHours)}`,
      `- Selisih jam bersih: ${simulation.netSwapDeltaHours > 0 ? '+' : ''}${formatHours(simulation.netSwapDeltaHours)}`,
      `- Penyesuaian nilai kontrak: ${deltaCostLine}`,
      `- Target selesai: ${simulation.additionalWorkingDays > 0 ? `${formatIndonesianDate(simulation.revisedDeadline)} (+${simulation.additionalWorkingDays} hari kerja)` : `${formatIndonesianDate(simulation.revisedDeadline)} (tetap sesuai jadwal awal)`}`,
      ``,
      `Silakan beri tahu apabila skema pertukaran fitur ini sudah sesuai dengan prioritas ${client}.`,
    ].join('\n');
  } else {
    emailSubject = `Penjadwalan Fitur Tambahan ke Fase 2 — ${projectName}`;
    const phase2Names =
      simulation.phase2Items.length > 0
        ? simulation.phase2Items.map((p) => `${p.name} (${formatHours(p.estimatedHours)})`).join(', ')
        : 'belum ada item Fase 2';

    strategyBodyWa = [
      `Supaya target peluncuran Fase 1 tetap tepat waktu pada *${formatIndonesianDate(simulation.revisedDeadline)}* dengan anggaran awal *${formatRupiah(simulation.revisedPrice)}*, saya mengusulkan agar fitur tambahan berikut kita jadwalkan ke *Fase 2*:`,
      `• Daftar Fase 2: ${phase2Names}`,
      `• Estimasi pekerjaan Fase 2: *${formatHours(simulation.phase2Hours)}* (${formatRupiah(simulation.phase2EstimatedCost)})`,
      ``,
      `Dengan cara ini, Fase 1 tetap selesai sesuai kontrak awal dan fitur baru dapat langsung kita siapkan di kontrak Fase 2. Bagaimana pendapat ${client}?`,
    ].join('\n');

    strategyBodyEmail = [
      `Untuk menjaga ketepatan waktu peluncuran Fase 1 pada ${formatIndonesianDate(simulation.revisedDeadline)} serta mempertahankan nilai kontrak awal sebesar ${formatRupiah(simulation.revisedPrice)}, saya merekomendasikan penjadwalan permintaan baru ke Fase 2:`,
      `- Pekerjaan yang dialihkan ke Fase 2: ${phase2Names}`,
      `- Total estimasi Fase 2: ${formatHours(simulation.phase2Hours)}`,
      `- Estimasi anggaran Fase 2: ${formatRupiah(simulation.phase2EstimatedCost)}`,
      ``,
      `Seluruh daftar permintaan tetap saya dokumentasikan agar dapat langsung dieksekusi setelah Fase 1 selesai. Mohon konfirmasi dari ${client}.`,
    ].join('\n');
  }

  const whatsapp = [
    `Halo ${client}, terima kasih atas masukan terbarunya untuk proyek *${projectName}*.`,
    ``,
    `Setelah saya cocokkan dengan kesepakatan awal (${formatHours(analysis.originalHours)} | ${formatRupiah(project.initialPrice)}), terdapat beberapa permintaan di luar ruang lingkup awal:`,
    changesBlock,
    ``,
    strategyBodyWa,
  ].join('\n');

  const emailBody = [
    `Halo ${client},`,
    ``,
    `Terima kasih atas arahan dan kebutuhan terbaru yang disampaikan untuk proyek ${projectName}.`,
    ``,
    `Berdasarkan ruang lingkup kesepakatan awal (${formatHours(analysis.originalHours)}, nilai kontrak ${formatRupiah(project.initialPrice)}, deadline ${formatIndonesianDate(project.initialDeadline)}), berikut rincian permintaan perubahan yang tercatat:`,
    changesBlock,
    ``,
    strategyBodyEmail,
    ``,
    `Hormat saya,`,
    `Tim Pelaksana Proyek ${projectName}`,
  ].join('\n');

  return {
    whatsapp,
    emailSubject,
    emailBody,
  };
}
