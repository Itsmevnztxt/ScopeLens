import { describe, expect, it } from 'vitest';
import { createDemoProject } from '../data/demoSeed';
import {
  analyzeProjectScope,
  calculateProjectCost,
  calculateRupiahFromHours,
  deduplicateWorkItems,
  generateNegotiationMessages,
  simulateNegotiation,
} from '../engine';
import type { Project, WorkItem } from '../types';

describe('Demo Scenario — Website Company Profile', () => {
  it('menghitung hasil demo persis sesuai spesifikasi tanpa angka hardcoded', () => {
    const demo = createDemoProject();
    const { analysis, active } = simulateNegotiation(demo, 'accept_changes');

    expect(analysis.originalCount).toBe(3);
    expect(analysis.addedCount).toBe(3);
    expect(analysis.originalHours).toBe(20);
    expect(analysis.rawAdditionalHours).toBe(12);
    expect(active.additionalHoursNow).toBe(12);
    expect(active.totalHoursNow).toBe(32);
    expect(active.additionalCostNow).toBe(900_000);
    expect(active.revisedPrice).toBe(2_400_000);
    expect(active.additionalWorkingDays).toBe(2);
    // Original deadline 2026-11-23 (Senin) + 2 hari kerja => Rabu 2026-11-25
    expect(active.revisedDeadline).toBe('2026-11-25');
  });

  it('menghasilkan pesan WhatsApp dan Email menggunakan data aktual demo', () => {
    const demo = createDemoProject();
    const { analysis, active } = simulateNegotiation(demo, 'accept_changes');
    const msgs = generateNegotiationMessages(demo, analysis, active);

    expect(msgs.whatsapp).toContain('Ardi Pratama (Kopi Senja Studio)');
    expect(msgs.whatsapp).toContain('Website Company Profile');
    expect(msgs.whatsapp).toContain('Dashboard Admin');
    expect(msgs.whatsapp).toContain('Rp900.000');
    expect(msgs.whatsapp).toContain('Rp2.400.000');
    expect(msgs.emailSubject).toContain('Website Company Profile');
    expect(msgs.emailBody).toContain('25 November 2026');
  });

  it('Scope Swap seimbang (Contact Form 4j + Responsive Design 8j = 12j) menghasilkan biaya tambahan Rp0 dan 0 hari tambahan', () => {
    const demo = createDemoProject();
    demo.negotiationStrategy = 'scope_swap';
    demo.swappedOutItemIds = ['orig-contact-form', 'orig-responsive-design'];

    const { analysis, active } = simulateNegotiation(demo, 'scope_swap');
    expect(active.swappedOutHours).toBe(12);
    expect(active.incomingSwapHours).toBe(12);
    expect(active.netSwapDeltaHours).toBe(0);
    expect(active.additionalHoursNow).toBe(0);
    expect(active.additionalCostNow).toBe(0);
    expect(active.revisedPrice).toBe(1_500_000);
    expect(active.additionalWorkingDays).toBe(0);
    expect(active.revisedDeadline).toBe('2026-11-23');
    expect(analysis.baselineComparisons.filter((b) => b.detectedStatus === 'swapped')).toHaveLength(2);

    const msgs = generateNegotiationMessages(demo, analysis, active);
    expect(msgs.whatsapp).toContain('Contact Form (4 jam)');
    expect(msgs.whatsapp).toContain('Responsive Design (8 jam)');
    expect(msgs.whatsapp).toContain('Rp0');
  });

  it('tidak menandai item awal sebagai ditukar saat strategi bukan scope_swap', () => {
    const demo = createDemoProject();
    demo.negotiationStrategy = 'accept_changes';
    demo.swappedOutItemIds = ['orig-contact-form', 'orig-responsive-design'];

    const { analysis, active } = simulateNegotiation(demo, 'accept_changes');
    expect(analysis.baselineComparisons.every((b) => b.detectedStatus === 'unchanged')).toBe(true);
    expect(active.additionalCostNow).toBe(900_000);
  });

  it('tidak menandai item awal sebagai ditukar bila item tersebut sudah dihapus (removed)', () => {
    const demo = createDemoProject();
    const contact = demo.originalItems[1];
    demo.negotiationStrategy = 'scope_swap';
    demo.swappedOutItemIds = [contact.id];
    demo.requestedItems = [
      ...demo.requestedItems,
      {
        ...contact,
        id: 'req-remove-contact',
        originalItemId: contact.id,
        itemType: 'requested',
        estimatedHours: 0,
        status: 'removed',
      },
    ];

    const { analysis, active } = simulateNegotiation(demo, 'scope_swap');
    const contactBaseline = analysis.baselineComparisons.find((b) => b.item.id === contact.id);
    expect(contactBaseline?.detectedStatus).toBe('removed');
    expect(active.swappedOutItems).toHaveLength(0);
    // 12 jam masuk - 4 jam dihapus = 8 jam tambahan (tidak terhitung ganda)
    expect(active.additionalHoursNow).toBe(8);
  });

  it('menandai item yang ditunda ke Fase 2 di pesan negosiasi saat strategi accept_changes', () => {
    const demo = createDemoProject();
    demo.deferredRequestIds = [demo.requestedItems[0].id];
    const { analysis, active } = simulateNegotiation(demo, 'accept_changes');
    const msgs = generateNegotiationMessages(demo, analysis, active);
    expect(msgs.whatsapp).toContain('Dashboard Admin (+5 jam) [Ditunda ke Fase 2]');
    expect(msgs.whatsapp).toContain('+7 jam');
  });
});

describe('Scope Analyzer — Perbandingan & Pencegahan Bug', () => {
  it('tidak menganggap item baru sebagai modifikasi meskipun namanya mirip', () => {
    const base = createDemoProject();
    const project: Project = {
      ...base,
      requestedItems: [
        {
          id: 'new-landing-clone',
          originalItemId: null, // null wajib dianggap added
          name: 'Landing Page',
          description: 'Halaman promo tambahan terpisah',
          quantity: 1,
          estimatedHours: 6,
          revisionLimit: 1,
          priority: 'medium',
          category: 'Frontend',
          itemType: 'requested',
          status: 'added',
        },
      ],
    };

    const res = analyzeProjectScope(project);
    expect(res.addedCount).toBe(1);
    expect(res.modifiedCount).toBe(0);
    expect(res.rawAdditionalHours).toBe(6);
  });

  it('mendeteksi modifikasi item baseline dan hanya menghitung selisih jam (bukan double counting)', () => {
    const base = createDemoProject();
    const origLanding = base.originalItems[0]; // 8 jam
    const modifiedLanding: WorkItem = {
      ...origLanding,
      id: 'req-mod-landing',
      originalItemId: origLanding.id,
      itemType: 'requested',
      estimatedHours: 12, // naik +4 jam dari 8 jam
      revisionLimit: 4,
      status: 'modified',
    };

    const project: Project = {
      ...base,
      requestedItems: [modifiedLanding],
    };

    const res = analyzeProjectScope(project);
    expect(res.modifiedCount).toBe(1);
    expect(res.addedCount).toBe(0);
    expect(res.originalHours).toBe(20);
    expect(res.rawAdditionalHours).toBe(4);
    expect(res.totalActiveHours).toBe(24);
  });

  it('mendeteksi penghapusan pekerjaan (removed) dan mengurangi beban jam aktif', () => {
    const base = createDemoProject();
    const origContact = base.originalItems[1]; // 4 jam
    const removedContact: WorkItem = {
      ...origContact,
      id: 'req-rem-contact',
      originalItemId: origContact.id,
      itemType: 'requested',
      estimatedHours: 0,
      status: 'removed',
    };

    const project: Project = {
      ...base,
      requestedItems: [removedContact],
    };

    const res = analyzeProjectScope(project);
    expect(res.removedCount).toBe(1);
    expect(res.rawAdditionalHours).toBe(-4);
    expect(res.totalActiveHours).toBe(16);
  });

  it('mencegah duplikasi item berdasarkan ID unik', () => {
    const base = createDemoProject();
    const dup = base.requestedItems[0];
    const deduped = deduplicateWorkItems([...base.requestedItems, dup]);
    expect(deduped).toHaveLength(3);

    const cost = calculateProjectCost({
      initialPrice: 1_500_000,
      hourlyRate: 75_000,
      breakdown: [
        { itemId: 'a', name: 'A', status: 'added', deltaHours: 5, deltaCost: 0 },
        { itemId: 'a', name: 'A', status: 'added', deltaHours: 5, deltaCost: 0 },
      ],
    });
    expect(cost.additionalHours).toBe(5);
    expect(cost.additionalCost).toBe(375_000);
  });

  it('menangani proyek kosong & task 0 jam tanpa NaN', () => {
    const emptyProj: Project = {
      ...createDemoProject(),
      initialPrice: 0,
      originalItems: [],
      requestedItems: [
        {
          id: 'zero-task',
          originalItemId: null,
          name: 'Konsultasi Awal',
          description: '',
          quantity: 1,
          estimatedHours: 0,
          revisionLimit: 0,
          priority: 'low',
          category: 'Meeting',
          itemType: 'requested',
          status: 'added',
        },
      ],
    };

    const { analysis, active } = simulateNegotiation(emptyProj);
    expect(Number.isNaN(analysis.creepPercentage)).toBe(false);
    expect(active.totalHoursNow).toBe(0);
    expect(active.additionalCostNow).toBe(0);
    expect(active.revisedPrice).toBe(0);
    expect(active.additionalWorkingDays).toBe(0);
  });

  it('menghindari floating-point drift pada operasi Rupiah', () => {
    const fee = calculateRupiahFromHours(0.1 + 0.2, 100_000);
    expect(fee).toBe(30_000);
  });

  it('tidak menghitung ganda unchangedCount ketika requestedItem identik dengan baseline', () => {
    const base = createDemoProject();
    const origLanding = base.originalItems[0];
    const project: Project = {
      ...base,
      requestedItems: [
        {
          ...origLanding,
          id: 'req-same-landing',
          originalItemId: origLanding.id,
          itemType: 'requested',
          status: 'unchanged',
        },
      ],
    };

    const res = analyzeProjectScope(project);
    expect(res.unchangedCount).toBe(3); // tepat 3 baseline item, bukan 4
    expect(res.hasScopeCreep).toBe(false);
    expect(res.rawAdditionalHours).toBe(0);
  });

  it('tidak menghitung ganda jika ada dua requestedItem mereferensikan originalItemId yang sama', () => {
    const base = createDemoProject();
    const origLanding = base.originalItems[0]; // 8 jam
    const project: Project = {
      ...base,
      requestedItems: [
        {
          ...origLanding,
          id: 'req-mod-1',
          originalItemId: origLanding.id,
          itemType: 'requested',
          estimatedHours: 10, // +2 jam
          status: 'modified',
        },
        {
          ...origLanding,
          id: 'req-mod-2-dup',
          originalItemId: origLanding.id,
          itemType: 'requested',
          estimatedHours: 14,
          status: 'modified',
        },
      ],
    };

    const res = analyzeProjectScope(project);
    expect(res.rawAdditionalHours).toBe(2);
    expect(res.totalActiveHours).toBe(22);
  });
});
