export type ItemStatus =
  | 'unchanged'
  | 'added'
  | 'modified'
  | 'removed'
  | 'deferred'
  | 'swapped';

export type ItemType = 'original' | 'requested';

export type ItemPriority = 'high' | 'medium' | 'low';

export type NegotiationStrategy = 'accept_changes' | 'scope_swap' | 'phase_2';

export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';

export type NegotiationAction = 'include' | 'exclude' | 'swap' | 'defer';

export interface WorkItem {
  id: string;
  projectId?: string;
  originalItemId: string | null; // null = pekerjaan baru; string = terhubung ke baseline item
  name: string;
  description: string;
  quantity: number;
  estimatedHours: number;
  revisionLimit: number;
  priority: ItemPriority;
  category: string;
  itemType: ItemType;
  status: ItemStatus;
  sortOrder?: number;
}

export interface Project {
  id: string;
  userId?: string | null;
  name: string;
  clientName: string;
  category: string;
  description: string;
  startDate: string; // YYYY-MM-DD
  initialDeadline: string; // YYYY-MM-DD
  initialPrice: number; // Integer IDR
  hourlyRate: number; // Integer IDR
  productiveHoursPerDay: number;
  workingDays: number[]; // 1=Senin .. 7=Minggu (ISO weekday) atau 0=Minggu .. 6=Sabtu; standar ISO: 1..5 Senin-Jumat
  holidays: string[]; // YYYY-MM-DD[]
  currency: 'IDR';
  status: ProjectStatus;
  originalItems: WorkItem[];
  requestedItems: WorkItem[];
  negotiationStrategy: NegotiationStrategy;
  swappedOutItemIds: string[]; // ID baseline item yang ditukar pada Scope Swap
  deferredRequestIds: string[]; // ID requested item yang ditunda ke Phase 2
  excludedRequestIds: string[]; // ID requested item yang ditolak/belum disepakati
  negotiationNotes?: string;
  isDemo?: boolean;
  updatedAt?: string;
}

export interface AnalyzedItemComparison {
  item: WorkItem;
  baselineItem: WorkItem | null;
  detectedStatus: ItemStatus;
  baselineHours: number;
  requestedHours: number;
  deltaHours: number;
  deltaCost: number;
  changesSummary: string[];
}

export interface ScopeAnalysisResult {
  originalCount: number;
  requestedCount: number;
  unchangedCount: number;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
  deferredCount: number;
  swappedCount: number;
  originalHours: number;
  rawAdditionalHours: number; // Semua perubahan sebelum negosiasi
  acceptedAdditionalHours: number; // Perubahan yang disepakati aktif
  totalActiveHours: number;
  hasScopeCreep: boolean;
  creepPercentage: number;
  comparisons: AnalyzedItemComparison[];
  baselineComparisons: AnalyzedItemComparison[];
}

export interface CostBreakdownItem {
  itemId: string;
  name: string;
  status: ItemStatus;
  deltaHours: number;
  deltaCost: number;
}

export interface CostCalculationResult {
  initialPrice: number;
  hourlyRate: number;
  additionalHours: number;
  additionalCost: number;
  revisedPrice: number;
  breakdown: CostBreakdownItem[];
}

export interface DeadlineCalculationResult {
  startDate: string;
  originalDeadline: string;
  additionalHours: number;
  productiveHoursPerDay: number;
  additionalWorkingDays: number;
  calendarDaysAdded: number;
  revisedDeadline: string;
  totalEstimatedHours: number;
  totalEstimatedWorkingDays: number;
}

export interface NegotiationSimulationResult {
  strategy: NegotiationStrategy;
  strategyLabel: string;
  summary: string;
  activeItemsCount: number;
  totalHoursNow: number;
  additionalHoursNow: number;
  additionalCostNow: number;
  revisedPrice: number;
  additionalWorkingDays: number;
  revisedDeadline: string;
  swappedOutItems: WorkItem[];
  swappedOutHours: number;
  incomingSwapHours: number;
  netSwapDeltaHours: number;
  phase2Items: WorkItem[];
  phase2Hours: number;
  phase2EstimatedCost: number;
  excludedItems: WorkItem[];
  itemActions: Array<{ scopeItemId: string; action: NegotiationAction }>;
}

export interface GeneratedMessages {
  whatsapp: string;
  emailSubject: string;
  emailBody: string;
}

export interface ProjectReportSnapshot {
  id: string;
  projectId: string;
  negotiationId: string | null;
  reportTitle: string;
  generatedAt: string;
  reportData: {
    project: Pick<
      Project,
      | 'id'
      | 'name'
      | 'clientName'
      | 'category'
      | 'startDate'
      | 'initialDeadline'
      | 'initialPrice'
      | 'hourlyRate'
      | 'productiveHoursPerDay'
    >;
    analysis: ScopeAnalysisResult;
    cost: CostCalculationResult;
    deadline: DeadlineCalculationResult;
    negotiation: NegotiationSimulationResult;
    messages: GeneratedMessages;
  };
}

export type UserRole = 'admin' | 'user';

export type RealtimeConnectionStatus =
  | 'unconfigured'
  | 'offline'
  | 'connecting'
  | 'connected'
  | 'error';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminProjectSummary extends Project {
  ownerName?: string;
  ownerEmail?: string;
  scopeItemsCount: number;
}
