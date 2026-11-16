import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../data/demoSeed';
import {
  addWorkingDays,
  calculateDeadlineImpact,
  calculateProjectCost,
  simulateNegotiation,
} from '../engine';
import { sanitizeText } from '../lib/sanitize';
import { validateProject, validateWorkItem } from '../lib/validation';
import { buildReportSnapshotPayload } from '../services/reportService';

describe('Deadline Calculator — Hari Kerja, Akhir Pekan, dan Libur', () => {
  it('melewati akhir pekan (Sabtu & Minggu) saat menambah 2 hari kerja dari hari Jumat', () => {
    // 2026-11-20 adalah Jumat; +2 hari kerja => Senin (23) dan Selasa (24)
    const { targetDate, calendarDaysAdded } = addWorkingDays('2026-11-20', 2, [1, 2, 3, 4, 5]);
    expect(targetDate).toBe('2026-11-24');
    expect(calendarDaysAdded).toBe(4);
  });

  it('melewati tanggal hari libur yang dikonfigurasi pengguna', () => {
    // 2026-11-23 Senin ditandai libur, maka +2 hari kerja dari 2026-11-20 (Jumat) => Selasa 24 & Rabu 25
    const { targetDate } = addWorkingDays(
      '2026-11-20',
      2,
      [1, 2, 3, 4, 5],
      ['2026-11-23']
    );
    expect(targetDate).toBe('2026-11-25');
  });

  it('menolak deadline awal yang lebih awal dari tanggal mulai', () => {
    expect(() =>
      calculateDeadlineImpact({
        startDate: '2026-11-20',
        originalDeadline: '2026-11-18',
        originalHours: 10,
        additionalHours: 6,
        productiveHoursPerDay: 6,
        workingDays: [1, 2, 3, 4, 5],
      })
    ).toThrow();
  });
});

describe('Negotiation Engine — Accept Changes, Scope Swap, dan Phase 2', () => {
  it('Scope Swap menghitung selisih jujur bila pengganti lebih besar daripada yang ditukar', () => {
    const demo = createDemoProject();
    // Requested total = 12 jam. Tukar keluar Contact Form (4 jam) => selisih bersih +8 jam
    demo.swappedOutItemIds = ['orig-contact-form'];
    const { active } = simulateNegotiation(demo, 'scope_swap');

    expect(active.swappedOutHours).toBe(4);
    expect(active.incomingSwapHours).toBe(12);
    expect(active.netSwapDeltaHours).toBe(8);
    expect(active.additionalHoursNow).toBe(8);
    expect(active.additionalCostNow).toBe(600_000);
    expect(active.revisedPrice).toBe(2_100_000);
    expect(active.additionalWorkingDays).toBe(2); // ceil(8/6) = 2
  });

  it('Scope Swap menunjukkan pengurangan kapasitas/biaya bila item ditukar lebih besar dari pengganti', () => {
    const demo = createDemoProject();
    // Hanya ada 1 permintaan 3 jam, tetapi menukar keluar Landing Page 8 jam => net -5 jam
    demo.requestedItems = [demo.requestedItems[2]]; // Additional Pages (3 jam)
    demo.swappedOutItemIds = ['orig-landing-page']; // 8 jam
    const { active } = simulateNegotiation(demo, 'scope_swap');

    expect(active.netSwapDeltaHours).toBe(-5);
    expect(active.additionalCostNow).toBe(-375_000);
    expect(active.revisedPrice).toBe(1_125_000);
    expect(active.additionalWorkingDays).toBe(0);
  });

  it('Scope Swap tidak mengurangi jam ganda jika baseline yang ditukar juga punya requestedItem modifikasi/hapus', () => {
    const demo = createDemoProject();
    const origLanding = demo.originalItems[0]; // 8 jam
    demo.requestedItems = [
      ...demo.requestedItems, // 12 jam
      {
        ...origLanding,
        id: 'req-mod-landing',
        originalItemId: origLanding.id,
        itemType: 'requested',
        estimatedHours: 10, // +2 jam jika tidak ditukar
        status: 'modified',
      },
    ];
    demo.swappedOutItemIds = [origLanding.id]; // 8 jam ditukar keluar

    const { active } = simulateNegotiation(demo, 'scope_swap');
    // 12 jam baru - 8 jam ditukar = +4 jam (modifikasi +2 jam pada item yg ditukar diabaikan)
    expect(active.additionalHoursNow).toBe(4);
    expect(active.additionalCostNow).toBe(300_000);
  });

  it('Scope Swap dan Phase 2 tetap menyertakan aksi defer/exclude pada itemActions', () => {
    const demo = createDemoProject();
    demo.deferredRequestIds = [demo.requestedItems[0].id];
    demo.excludedRequestIds = [demo.requestedItems[1].id];

    const swapSim = simulateNegotiation(demo, 'scope_swap').active;
    expect(swapSim.itemActions).toContainEqual({
      scopeItemId: demo.requestedItems[0].id,
      action: 'defer',
    });
    expect(swapSim.itemActions).toContainEqual({
      scopeItemId: demo.requestedItems[1].id,
      action: 'exclude',
    });

    const phase2Sim = simulateNegotiation(demo, 'phase_2').active;
    expect(phase2Sim.itemActions).toContainEqual({
      scopeItemId: demo.requestedItems[1].id,
      action: 'exclude',
    });
  });

  it('Snapshot laporan konsisten dengan strategi negosiasi aktif (Phase 2 & Scope Swap)', () => {
    const demo = createDemoProject();
    demo.negotiationStrategy = 'phase_2';
    const snapshotPhase2 = buildReportSnapshotPayload(demo);
    expect(snapshotPhase2.reportData.cost.additionalCost).toBe(0);
    expect(snapshotPhase2.reportData.cost.revisedPrice).toBe(1_500_000);
    expect(snapshotPhase2.reportData.negotiation.revisedPrice).toBe(1_500_000);

    demo.negotiationStrategy = 'scope_swap';
    demo.swappedOutItemIds = ['orig-contact-form']; // 4h
    const snapshotSwap = buildReportSnapshotPayload(demo);
    expect(snapshotSwap.reportData.cost.additionalCost).toBe(600_000);
    expect(snapshotSwap.reportData.cost.revisedPrice).toBe(2_100_000);
  });

  it('Phase 2 menjaga harga & deadline Fase 1 serta menyimpan item tertunda di histori', () => {
    const demo = createDemoProject();
    const { active } = simulateNegotiation(demo, 'phase_2');

    expect(active.additionalHoursNow).toBe(0);
    expect(active.additionalCostNow).toBe(0);
    expect(active.revisedPrice).toBe(1_500_000);
    expect(active.revisedDeadline).toBe(demo.initialDeadline);
    expect(active.phase2Items).toHaveLength(3);
    expect(active.phase2Hours).toBe(12);
    expect(active.phase2EstimatedCost).toBe(900_000);
  });
});

describe('Validasi Input, Penolakan Harga/Jam Negatif, & Sanitasi XSS', () => {
  it('menolak tarif per jam negatif atau nol serta harga awal negatif', () => {
    expect(() =>
      calculateProjectCost({
        initialPrice: -1000,
        hourlyRate: 75000,
        breakdown: [],
      })
    ).toThrow();

    expect(() =>
      calculateProjectCost({
        initialPrice: 1_500_000,
        hourlyRate: -50_000,
        breakdown: [],
      })
    ).toThrow();

    const issues = validateProject({
      name: '',
      clientName: '',
      initialPrice: -500,
      hourlyRate: 0,
      productiveHoursPerDay: -2,
      startDate: '2026-11-20',
      initialDeadline: '2026-11-10',
      workingDays: [],
    });
    expect(issues.length).toBeGreaterThanOrEqual(5);
  });

  it('menolak item pekerjaan dengan jam negatif atau nama kosong', () => {
    const issues = validateWorkItem({
      name: '   ',
      estimatedHours: -3,
      quantity: 0,
      revisionLimit: -1,
    });
    expect(issues).toHaveLength(4);
  });

  it('membersihkan payload XSS dari input teks pengguna', () => {
    const dirty = '<script>alert("xss")</script><img src=x onerror=alert(1)>Dashboard Admin';
    const clean = sanitizeText(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onerror');
    expect(clean).toBe('Dashboard Admin');
  });
});
