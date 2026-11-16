import type {
  CostBreakdownItem,
  NegotiationAction,
  NegotiationSimulationResult,
  NegotiationStrategy,
  Project,
  ScopeAnalysisResult,
  WorkItem,
} from '../types';
import {
  calculateProjectCost,
  calculateRupiahFromHours,
  sumHoursExact,
} from './costCalculator';
import { calculateDeadlineImpact } from './deadlineCalculator';
import { analyzeProjectScope, deduplicateWorkItems } from './scopeAnalyzer';

function buildStrategySimulation(
  project: Project,
  analysis: ScopeAnalysisResult,
  strategy: NegotiationStrategy
): NegotiationSimulationResult {
  const originalItems = deduplicateWorkItems(project.originalItems);
  const requestedItems = deduplicateWorkItems(project.requestedItems);
  const excludedSet = new Set(project.excludedRequestIds ?? []);
  const deferredSet = new Set(project.deferredRequestIds ?? []);
  const swappedSet = new Set(project.swappedOutItemIds ?? []);

  const itemActions: Array<{ scopeItemId: string; action: NegotiationAction }> = [];

  if (strategy === 'accept_changes') {
    // Terima seluruh item requested yang tidak secara eksplisit di-exclude/defer oleh user
    const activeComparisons = analysis.comparisons.filter(
      (c) => !excludedSet.has(c.item.id) && c.detectedStatus !== 'deferred'
    );
    const deferredComparisons = analysis.comparisons.filter(
      (c) => c.detectedStatus === 'deferred'
    );
    const excludedItems = requestedItems.filter((r) => excludedSet.has(r.id));

    const breakdown: CostBreakdownItem[] = activeComparisons.map((c) => ({
      itemId: c.item.id,
      name: c.item.name,
      status: c.detectedStatus,
      deltaHours: c.deltaHours,
      deltaCost: c.deltaCost,
    }));

    const cost = calculateProjectCost({
      initialPrice: project.initialPrice,
      hourlyRate: project.hourlyRate,
      breakdown,
    });

    const deadline = calculateDeadlineImpact({
      startDate: project.startDate,
      originalDeadline: project.initialDeadline,
      originalHours: analysis.originalHours,
      additionalHours: cost.additionalHours,
      productiveHoursPerDay: project.productiveHoursPerDay,
      workingDays: project.workingDays,
      holidays: project.holidays,
    });

    for (const c of activeComparisons) {
      itemActions.push({ scopeItemId: c.item.id, action: 'include' });
    }
    for (const c of deferredComparisons) {
      itemActions.push({ scopeItemId: c.item.id, action: 'defer' });
    }
    for (const ex of excludedItems) {
      itemActions.push({ scopeItemId: ex.id, action: 'exclude' });
    }

    const phase2Items = deferredComparisons.map((c) => c.item);
    const phase2Hours = sumHoursExact(phase2Items.map((i) => i.estimatedHours));

    return {
      strategy: 'accept_changes',
      strategyLabel: 'Accept Changes',
      summary:
        cost.additionalHours > 0
          ? `Seluruh permintaan tambahan (${cost.additionalHours} jam) disepakati masuk ke fase saat ini dengan penyesuaian biaya dan deadline.`
          : 'Tidak ada penambahan jam di luar kesepakatan awal.',
      activeItemsCount: originalItems.length + activeComparisons.filter((c) => !c.baselineItem).length,
      totalHoursNow: sumHoursExact([analysis.originalHours, cost.additionalHours]),
      additionalHoursNow: cost.additionalHours,
      additionalCostNow: cost.additionalCost,
      revisedPrice: cost.revisedPrice,
      additionalWorkingDays: deadline.additionalWorkingDays,
      revisedDeadline: deadline.revisedDeadline,
      swappedOutItems: [],
      swappedOutHours: 0,
      incomingSwapHours: 0,
      netSwapDeltaHours: 0,
      phase2Items,
      phase2Hours,
      phase2EstimatedCost: calculateRupiahFromHours(phase2Hours, project.hourlyRate),
      excludedItems,
      itemActions,
    };
  }

  if (strategy === 'scope_swap') {
    const removedBaselineIds = new Set(
      analysis.comparisons
        .filter((c) => c.detectedStatus === 'removed' && c.baselineItem && !excludedSet.has(c.item.id))
        .map((c) => c.baselineItem!.id)
    );
    // Item baseline yang sudah dihapus via requestedItem 'removed' tidak boleh ditukar lagi agar tidak double-subtract
    const swappedOutItems = originalItems.filter(
      (orig) => swappedSet.has(orig.id) && !removedBaselineIds.has(orig.id)
    );
    const effectiveSwappedIds = new Set(swappedOutItems.map((i) => i.id));
    const swappedOutHours = sumHoursExact(swappedOutItems.map((i) => i.estimatedHours));

    const deferredComparisons = analysis.comparisons.filter(
      (c) => c.detectedStatus === 'deferred' && !excludedSet.has(c.item.id)
    );
    const excludedItems = requestedItems.filter((r) => excludedSet.has(r.id));

    // Jika suatu item baseline ditukar keluar, modifikasi pada item baseline tsb tidak ikut aktif di Fase 1
    const activeComparisons = analysis.comparisons.filter(
      (c) =>
        !excludedSet.has(c.item.id) &&
        c.detectedStatus !== 'deferred' &&
        !(c.baselineItem && effectiveSwappedIds.has(c.baselineItem.id))
    );
    const incomingSwapHours = sumHoursExact(activeComparisons.map((c) => c.deltaHours));

    // Selisih murni: pekerjaan baru masuk dikurangi pekerjaan baseline yang ditukar
    const netSwapDeltaHours = sumHoursExact([incomingSwapHours, -swappedOutHours]);

    const breakdown: CostBreakdownItem[] = [
      ...activeComparisons.map((c) => ({
        itemId: c.item.id,
        name: c.item.name,
        status: c.detectedStatus,
        deltaHours: c.deltaHours,
        deltaCost: c.deltaCost,
      })),
      ...swappedOutItems.map((orig) => ({
        itemId: `swap-${orig.id}`,
        name: `Ditukar: ${orig.name}`,
        status: 'swapped' as const,
        deltaHours: -orig.estimatedHours,
        deltaCost: calculateRupiahFromHours(-orig.estimatedHours, project.hourlyRate),
      })),
    ];

    const cost = calculateProjectCost({
      initialPrice: project.initialPrice,
      hourlyRate: project.hourlyRate,
      breakdown,
    });

    const deadline = calculateDeadlineImpact({
      startDate: project.startDate,
      originalDeadline: project.initialDeadline,
      originalHours: analysis.originalHours,
      additionalHours: cost.additionalHours,
      productiveHoursPerDay: project.productiveHoursPerDay,
      workingDays: project.workingDays,
      holidays: project.holidays,
    });

    for (const orig of swappedOutItems) {
      itemActions.push({ scopeItemId: orig.id, action: 'swap' });
    }
    for (const c of activeComparisons) {
      itemActions.push({ scopeItemId: c.item.id, action: 'include' });
    }
    for (const c of deferredComparisons) {
      itemActions.push({ scopeItemId: c.item.id, action: 'defer' });
    }
    for (const ex of excludedItems) {
      itemActions.push({ scopeItemId: ex.id, action: 'exclude' });
    }

    let summary: string;
    if (swappedOutItems.length === 0) {
      summary =
        'Pilih minimal satu fitur awal untuk ditukar dengan permintaan baru.';
    } else if (netSwapDeltaHours === 0) {
      summary = `Pertukaran seimbang (${swappedOutHours} jam ditukar ${incomingSwapHours} jam). Anggaran dan deadline tetap terjaga.`;
    } else if (netSwapDeltaHours > 0) {
      summary = `Pekerjaan pengganti lebih besar ${netSwapDeltaHours} jam dibanding fitur yang ditukar. Tetap ada selisih biaya dan waktu.`;
    } else {
      summary = `Fitur yang ditukar lebih besar ${Math.abs(netSwapDeltaHours)} jam dibanding penggantinya (hemat kapasitas/biaya).`;
    }

    const phase2Items = deferredComparisons.map((c) => c.item);
    const phase2Hours = sumHoursExact(phase2Items.map((i) => i.estimatedHours));

    return {
      strategy: 'scope_swap',
      strategyLabel: 'Scope Swap',
      summary,
      activeItemsCount:
        originalItems.length -
        swappedOutItems.length +
        activeComparisons.filter((c) => !c.baselineItem).length,
      totalHoursNow: Math.max(0, sumHoursExact([analysis.originalHours, cost.additionalHours])),
      additionalHoursNow: cost.additionalHours,
      additionalCostNow: cost.additionalCost,
      revisedPrice: cost.revisedPrice,
      additionalWorkingDays: deadline.additionalWorkingDays,
      revisedDeadline: deadline.revisedDeadline,
      swappedOutItems,
      swappedOutHours,
      incomingSwapHours,
      netSwapDeltaHours,
      phase2Items,
      phase2Hours,
      phase2EstimatedCost: calculateRupiahFromHours(phase2Hours, project.hourlyRate),
      excludedItems,
      itemActions,
    };
  }

  // Strategy: PHASE 2
  // Di mode Phase 2: seluruh item 'added' (dan item bertanda deferred) dipindahkan ke fase 2.
  // Histori item tidak dihapus, biaya Fase 1 tidak bertambah akibat pekerjaan yang ditunda.
  const phase2Comparisons = analysis.comparisons.filter(
    (c) =>
      !excludedSet.has(c.item.id) &&
      (c.detectedStatus === 'added' ||
        c.detectedStatus === 'deferred' ||
        deferredSet.has(c.item.id))
  );
  const phase2Ids = new Set(phase2Comparisons.map((c) => c.item.id));

  const keptPhase1Comparisons = analysis.comparisons.filter(
    (c) => !excludedSet.has(c.item.id) && !phase2Ids.has(c.item.id)
  );
  const excludedItems = requestedItems.filter((r) => excludedSet.has(r.id));

  const phase1Breakdown: CostBreakdownItem[] = keptPhase1Comparisons.map((c) => ({
    itemId: c.item.id,
    name: c.item.name,
    status: c.detectedStatus,
    deltaHours: c.deltaHours,
    deltaCost: c.deltaCost,
  }));

  const cost = calculateProjectCost({
    initialPrice: project.initialPrice,
    hourlyRate: project.hourlyRate,
    breakdown: phase1Breakdown,
  });

  const deadline = calculateDeadlineImpact({
    startDate: project.startDate,
    originalDeadline: project.initialDeadline,
    originalHours: analysis.originalHours,
    additionalHours: cost.additionalHours,
    productiveHoursPerDay: project.productiveHoursPerDay,
    workingDays: project.workingDays,
    holidays: project.holidays,
  });

  const phase2Items: WorkItem[] = phase2Comparisons.map((c) => c.item);
  const phase2Hours = sumHoursExact(phase2Items.map((i) => i.estimatedHours));
  const phase2EstimatedCost = calculateRupiahFromHours(phase2Hours, project.hourlyRate);

  for (const c of phase2Comparisons) {
    itemActions.push({ scopeItemId: c.item.id, action: 'defer' });
  }
  for (const c of keptPhase1Comparisons) {
    itemActions.push({ scopeItemId: c.item.id, action: 'include' });
  }
  for (const ex of excludedItems) {
    itemActions.push({ scopeItemId: ex.id, action: 'exclude' });
  }

  return {
    strategy: 'phase_2',
    strategyLabel: 'Phase 2',
    summary:
      phase2Items.length > 0
        ? `${phase2Items.length} pekerjaan tambahan (${phase2Hours} jam) dijadwalkan ke Fase 2 agar anggaran & deadline Fase 1 aman.`
        : 'Tidak ada item tambahan yang perlu ditunda ke Fase 2.',
    activeItemsCount: originalItems.length,
    totalHoursNow: sumHoursExact([analysis.originalHours, cost.additionalHours]),
    additionalHoursNow: cost.additionalHours,
    additionalCostNow: cost.additionalCost,
    revisedPrice: cost.revisedPrice,
    additionalWorkingDays: deadline.additionalWorkingDays,
    revisedDeadline: deadline.revisedDeadline,
    swappedOutItems: [],
    swappedOutHours: 0,
    incomingSwapHours: 0,
    netSwapDeltaHours: 0,
    phase2Items,
    phase2Hours,
    phase2EstimatedCost,
    excludedItems,
    itemActions,
  };
}

export function simulateNegotiation(
  project: Project,
  strategyOverride?: NegotiationStrategy
): {
  analysis: ScopeAnalysisResult;
  active: NegotiationSimulationResult;
  allStrategies: Record<NegotiationStrategy, NegotiationSimulationResult>;
} {
  const chosen = strategyOverride ?? project.negotiationStrategy ?? 'accept_changes';
  const analysis = analyzeProjectScope({ ...project, negotiationStrategy: chosen });
  const acceptChanges = buildStrategySimulation(project, analysis, 'accept_changes');
  const scopeSwap = buildStrategySimulation(project, analysis, 'scope_swap');
  const phase2 = buildStrategySimulation(project, analysis, 'phase_2');

  const allStrategies: Record<NegotiationStrategy, NegotiationSimulationResult> = {
    accept_changes: acceptChanges,
    scope_swap: scopeSwap,
    phase_2: phase2,
  };

  return {
    analysis,
    active: allStrategies[chosen],
    allStrategies,
  };
}
