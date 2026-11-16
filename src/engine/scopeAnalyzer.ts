import type {
  AnalyzedItemComparison,
  ItemStatus,
  Project,
  ScopeAnalysisResult,
  WorkItem,
} from '../types';
import { calculateRupiahFromHours, sumHoursExact } from './costCalculator';

/**
 * Deduplikasi array WorkItem berdasarkan ID unik agar tidak terjadi perhitungan ganda.
 */
export function deduplicateWorkItems(items: WorkItem[]): WorkItem[] {
  const seen = new Set<string>();
  const result: WorkItem[] = [];
  for (const item of items) {
    if (!item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push({
      ...item,
      estimatedHours:
        Number.isFinite(item.estimatedHours) && item.estimatedHours >= 0
          ? item.estimatedHours
          : 0,
      quantity:
        Number.isInteger(item.quantity) && item.quantity >= 1 ? item.quantity : 1,
      revisionLimit:
        Number.isInteger(item.revisionLimit) && item.revisionLimit >= 0
          ? item.revisionLimit
          : 0,
    });
  }
  return result;
}

function detectSpecChanges(baseline: WorkItem, requested: WorkItem): string[] {
  const changes: string[] = [];
  if (requested.estimatedHours !== baseline.estimatedHours) {
    const diff = requested.estimatedHours - baseline.estimatedHours;
    const sign = diff > 0 ? '+' : '';
    changes.push(`Jam: ${baseline.estimatedHours} → ${requested.estimatedHours} jam (${sign}${diff})`);
  }
  if (requested.quantity !== baseline.quantity) {
    changes.push(`Kuantitas: ${baseline.quantity} → ${requested.quantity}`);
  }
  if (requested.revisionLimit !== baseline.revisionLimit) {
    changes.push(`Batas revisi: ${baseline.revisionLimit}x → ${requested.revisionLimit}x`);
  }
  if (requested.description.trim() !== baseline.description.trim()) {
    changes.push('Spesifikasi diperbarui');
  }
  if (requested.name.trim() !== baseline.name.trim()) {
    changes.push(`Nama diubah dari "${baseline.name}"`);
  }
  return changes;
}

/**
 * Menganalisis perbedaan antara originalItems (baseline) dan requestedItems
 * tanpa membandingkan nama saja, tanpa double counting, dan menjaga baseline tetap utuh.
 */
export function analyzeProjectScope(project: Project): ScopeAnalysisResult {
  const originalItems = deduplicateWorkItems(project.originalItems);
  const requestedItems = deduplicateWorkItems(project.requestedItems);

  const baselineMap = new Map<string, WorkItem>();
  for (const orig of originalItems) {
    baselineMap.set(orig.id, orig);
  }

  const swappedSet = new Set(project.swappedOutItemIds ?? []);
  const deferredSet = new Set(project.deferredRequestIds ?? []);
  const excludedSet = new Set(project.excludedRequestIds ?? []);

  // Lacak baseline mana saja yang sudah diklaim oleh requestedItem agar tidak terjadi double counting
  const claimedBaselineIds = new Set<string>();
  const comparisons: AnalyzedItemComparison[] = [];

  for (const req of requestedItems) {
    const rawBaselineItem =
      req.originalItemId !== null ? (baselineMap.get(req.originalItemId) ?? null) : null;
    const isDuplicateBaselineClaim =
      rawBaselineItem !== null && claimedBaselineIds.has(rawBaselineItem.id);
    const baselineItem = isDuplicateBaselineClaim ? null : rawBaselineItem;

    if (baselineItem) {
      claimedBaselineIds.add(baselineItem.id);
    }

    let detectedStatus: ItemStatus;
    let deltaHours = 0;
    let changesSummary: string[] = [];

    if (isDuplicateBaselineClaim) {
      // Mencegah 1 item baseline dimodifikasi/dihapus ganda oleh 2 requestedItem berbeda
      detectedStatus = 'modified';
      deltaHours = 0;
      changesSummary = ['Referensi baseline ganda — delta diabaikan untuk cegah hitung ganda'];
    } else if (deferredSet.has(req.id) || req.status === 'deferred') {
      detectedStatus = 'deferred';
      // Item yang ditunda ke Fase 2 tidak menambah jam fase 1, tapi tetap tercatat nilai raw-nya
      deltaHours = baselineItem
        ? req.estimatedHours - baselineItem.estimatedHours
        : req.estimatedHours;
      changesSummary = ['Dijadwalkan ke Fase 2'];
    } else if (baselineItem === null) {
      // Aturan wajib: originalItemId === null selalu merupakan pekerjaan tambahan (added), tidak pernah dianggap modifikasi
      detectedStatus = 'added';
      deltaHours = req.estimatedHours;
      changesSummary = [`Fitur baru (+${req.estimatedHours} jam)`];
    } else if (req.status === 'removed') {
      detectedStatus = 'removed';
      deltaHours = -baselineItem.estimatedHours;
      changesSummary = [`Dihapus dari ruang lingkup (-${baselineItem.estimatedHours} jam)`];
    } else {
      changesSummary = detectSpecChanges(baselineItem, req);
      if (changesSummary.length > 0 || req.status === 'modified') {
        detectedStatus = 'modified';
        deltaHours = req.estimatedHours - baselineItem.estimatedHours;
        if (changesSummary.length === 0) {
          changesSummary = ['Ditandai sebagai modifikasi'];
        }
      } else {
        detectedStatus = 'unchanged';
        deltaHours = 0;
        changesSummary = ['Sesuai kesepakatan awal'];
      }
    }

    comparisons.push({
      item: req,
      baselineItem,
      detectedStatus,
      baselineHours: baselineItem ? baselineItem.estimatedHours : 0,
      requestedHours: req.estimatedHours,
      deltaHours,
      deltaCost: calculateRupiahFromHours(deltaHours, project.hourlyRate),
      changesSummary,
    });
  }

  // Status untuk setiap item baseline
  const isScopeSwapActive = project.negotiationStrategy === 'scope_swap';
  const baselineComparisons: AnalyzedItemComparison[] = originalItems.map((orig) => {
    const linkedReq = comparisons.find((c) => c.baselineItem?.id === orig.id);
    const isRemovedByRequest =
      linkedReq?.detectedStatus === 'removed' && !excludedSet.has(linkedReq.item.id);
    const isSwapped = isScopeSwapActive && swappedSet.has(orig.id) && !isRemovedByRequest;

    let detectedStatus: ItemStatus = 'unchanged';
    let deltaHours = 0;
    let changesSummary = ['Sesuai kesepakatan awal'];

    if (isSwapped) {
      detectedStatus = 'swapped';
      deltaHours = -orig.estimatedHours;
      changesSummary = [`Ditukar pada opsi Tukar Fitur (-${orig.estimatedHours} jam)`];
    } else if (linkedReq) {
      detectedStatus = linkedReq.detectedStatus;
      deltaHours = linkedReq.deltaHours;
      changesSummary = linkedReq.changesSummary;
    }

    return {
      item: orig,
      baselineItem: orig,
      detectedStatus,
      baselineHours: orig.estimatedHours,
      requestedHours: linkedReq ? linkedReq.requestedHours : orig.estimatedHours,
      deltaHours,
      deltaCost: calculateRupiahFromHours(deltaHours, project.hourlyRate),
      changesSummary,
    };
  });

  const originalHours = sumHoursExact(originalItems.map((i) => i.estimatedHours));

  // Hitung raw additional hours (semua request non-excluded/non-deferred sebelum negosiasi, atau seluruh tambahan terdeteksi)
  const rawDeltaList = comparisons
    .filter((c) => !excludedSet.has(c.item.id))
    .map((c) => c.deltaHours);
  const rawAdditionalHours = sumHoursExact(rawDeltaList);

  // Accepted additional hours berdasarkan item yang aktif dikerjakan pada fase saat ini
  const acceptedDeltaList = comparisons
    .filter(
      (c) =>
        c.detectedStatus !== 'deferred' &&
        !excludedSet.has(c.item.id)
    )
    .map((c) => c.deltaHours);
  const acceptedAdditionalHours = sumHoursExact(acceptedDeltaList);

  const unchangedBaselineCount = baselineComparisons.filter(
    (b) => b.detectedStatus === 'unchanged'
  ).length;

  const addedCount = comparisons.filter((c) => c.detectedStatus === 'added').length;
  const modifiedCount = comparisons.filter((c) => c.detectedStatus === 'modified').length;
  const removedCount = comparisons.filter((c) => c.detectedStatus === 'removed').length;
  const deferredCount = comparisons.filter((c) => c.detectedStatus === 'deferred').length;
  const swappedCount = baselineComparisons.filter((b) => b.detectedStatus === 'swapped').length;

  const totalActiveHours = Math.max(
    0,
    sumHoursExact([originalHours, acceptedAdditionalHours])
  );

  const hasScopeCreep =
    addedCount > 0 ||
    modifiedCount > 0 ||
    removedCount > 0 ||
    rawAdditionalHours !== 0;

  const creepPercentage =
    originalHours > 0
      ? Math.round((rawAdditionalHours / originalHours) * 1000) / 10
      : rawAdditionalHours > 0
        ? 100
        : 0;

  return {
    originalCount: originalItems.length,
    requestedCount: requestedItems.length,
    unchangedCount: unchangedBaselineCount,
    addedCount,
    modifiedCount,
    removedCount,
    deferredCount,
    swappedCount,
    originalHours,
    rawAdditionalHours,
    acceptedAdditionalHours,
    totalActiveHours,
    hasScopeCreep,
    creepPercentage,
    comparisons,
    baselineComparisons,
  };
}
