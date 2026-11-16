import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  MessageSquare,
} from 'lucide-react';
import {
  STRATEGY_META,
  formatCompactHours,
  formatCompactRupiah,
  formatHours,
  formatIndonesianDate,
} from '../lib/formatters';
import type {
  GeneratedMessages,
  NegotiationSimulationResult,
  NegotiationStrategy,
  Project,
  ScopeAnalysisResult,
} from '../types';

interface RightNegotiationPanelProps {
  project: Project;
  analysis: ScopeAnalysisResult;
  activeStrategy: NegotiationStrategy;
  allStrategies: Record<NegotiationStrategy, NegotiationSimulationResult>;
  messages: GeneratedMessages;
  onSelectStrategy: (strategy: NegotiationStrategy) => void;
  onToggleSwapItem: (baselineItemId: string) => void;
}

const STRATEGIES: Array<{
  key: NegotiationStrategy;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'accept_changes', icon: CheckCircle2 },
  { key: 'scope_swap', icon: ArrowLeftRight },
  { key: 'phase_2', icon: CalendarClock },
];

export const RightNegotiationPanel: React.FC<RightNegotiationPanelProps> = ({
  project,
  analysis,
  activeStrategy,
  allStrategies,
  messages,
  onSelectStrategy,
  onToggleSwapItem,
}) => {
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const lastAnnouncementRef = useRef('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = allStrategies[activeStrategy];

  const activeContent =
    tab === 'whatsapp'
      ? messages.whatsapp
      : `Subjek: ${messages.emailSubject}\n\n${messages.emailBody}`;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const announceCopy = (ok: boolean) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyState(ok ? 'copied' : 'failed');
    let msg = ok ? 'Pesan tersalin' : 'Gagal menyalin pesan';
    if (msg === lastAnnouncementRef.current) {
      msg += '\u00A0';
    }
    lastAnnouncementRef.current = msg;
    setLiveAnnouncement(msg);
    copyTimerRef.current = setTimeout(() => {
      setCopyState('idle');
      setLiveAnnouncement('');
    }, 2200);
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(activeContent);
        announceCopy(true);
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      try {
        const field = document.createElement('textarea');
        field.value = activeContent;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
        document.body.append(field);
        field.select();
        const ok = document.execCommand('copy');
        field.remove();
        announceCopy(ok);
      } catch {
        announceCopy(false);
      }
    }
  };

  return (
    <aside
      id="strategi-negosiasi"
      aria-label="Strategi negosiasi dan pesan siap kirim"
      className="rounded-[28px] bg-white p-5 sm:p-6 shadow-card space-y-5 xl:sticky xl:top-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold text-ink">Strategi Negosiasi</h2>
        <p className="text-xs text-inkMuted mt-0.5 leading-relaxed">
          Pilih langkah yang paling pas untuk menjaga kesepakatan dan margin proyekmu.
        </p>
      </div>

      {/* 3 Pilihan Strategi Negosiasi */}
      <div className="space-y-2.5" role="radiogroup" aria-label="Pilih strategi negosiasi">
        {STRATEGIES.map(({ key, icon: Icon }) => {
          const sim = allStrategies[key];
          const meta = STRATEGY_META[key];
          const selected = activeStrategy === key;

          const quickMetrics =
            key === 'accept_changes'
              ? `${sim.additionalCostNow >= 0 ? formatCompactRupiah(sim.additionalCostNow, true) : formatCompactRupiah(sim.additionalCostNow)} • +${sim.additionalWorkingDays} hari kerja`
              : key === 'scope_swap'
                ? sim.swappedOutItems.length > 0
                  ? `${formatCompactRupiah(sim.additionalCostNow, true)} • ${sim.additionalWorkingDays > 0 ? `+${sim.additionalWorkingDays} hari kerja` : '0 hari tambahan'}`
                  : 'Pilih fitur awal untuk ditukar'
                : `${formatCompactRupiah(sim.revisedPrice)} Fase 1 • +${formatCompactHours(sim.phase2Hours)} Fase 2`;

          return (
            <div
              key={key}
              className={`rounded-2xl studio-transition ${
                selected
                  ? 'bg-lavenderTint ring-2 ring-violetPrimary/40'
                  : 'bg-canvas/75 hover:bg-canvas'
              }`}
            >
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelectStrategy(key)}
                className="w-full text-left p-3.5 rounded-2xl flex items-start gap-3"
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    selected
                      ? 'bg-violetPrimary text-white'
                      : 'bg-white text-violetDeep shadow-sm'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{meta.label}</span>
                    {selected && (
                      <span className="rounded-full bg-violetPrimary px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                        Aktif
                      </span>
                    )}
                  </span>
                  <span className="block font-numeric text-xs font-semibold text-violetDeep mt-0.5">
                    {quickMetrics}
                  </span>
                </span>
              </button>

              {/* Scope Swap Inline Checklist */}
              {selected && key === 'scope_swap' && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2">
                  <p className="text-[11px] font-bold text-inkMuted">
                    Centang fitur awal yang ingin ditukar keluar:
                  </p>
                  <div className="space-y-1.5">
                    {project.originalItems.map((orig) => {
                      const baseComp = analysis.baselineComparisons.find(
                        (b) => b.item.id === orig.id
                      );
                      const isRemoved = baseComp?.detectedStatus === 'removed';
                      const checked = !isRemoved && project.swappedOutItemIds.includes(orig.id);
                      return (
                        <label
                          key={orig.id}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 studio-transition min-h-[40px] ${
                            isRemoved
                              ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                              : checked
                                ? 'bg-white ring-1 ring-violetPrimary/50 cursor-pointer'
                                : 'bg-white/70 hover:bg-white cursor-pointer'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isRemoved}
                              onChange={() => onToggleSwapItem(orig.id)}
                              className="h-4 w-4 accent-violetPrimary shrink-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <span className="text-xs font-semibold text-ink truncate">
                              {orig.name}
                              {isRemoved ? ' (Sudah dihapus)' : ''}
                            </span>
                          </span>
                          <span className="font-numeric text-xs font-bold text-inkMuted shrink-0">
                            {formatCompactHours(orig.estimatedHours)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phase 2 Summary Pills */}
              {selected && key === 'phase_2' && active.phase2Items.length > 0 && (
                <div className="px-3.5 pb-3.5 pt-1 flex flex-wrap gap-1.5">
                  {active.phase2Items.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm"
                    >
                      <span>{item.name}</span>
                      <span className="font-numeric text-inkMuted">
                        ({formatCompactHours(item.estimatedHours)})
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ringkasan Singkat Strategi Aktif */}
      <div className="rounded-2xl bg-canvas p-3.5 space-y-1">
        <p className="text-xs font-semibold text-ink leading-relaxed">{active.summary}</p>
        <p className="font-numeric text-[11px] text-inkMuted">
          Target selesai: <strong className="text-ink">{formatIndonesianDate(active.revisedDeadline)}</strong> • Total{' '}
          <strong className="text-ink">{formatHours(active.totalHoursNow)}</strong>
        </p>
      </div>

      {/* Pratinjau Pesan WhatsApp / Email */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-ink">Pesan Siap Kirim</h3>
          <div
            role="tablist"
            aria-label="Pilih format pesan"
            className="inline-flex rounded-full bg-canvas p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'whatsapp'}
              onClick={() => setTab('whatsapp')}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold studio-transition ${
                tab === 'whatsapp'
                  ? 'bg-white text-violetDeep shadow-sm'
                  : 'text-inkMuted hover:text-ink'
              }`}
            >
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'email'}
              onClick={() => setTab('email')}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold studio-transition ${
                tab === 'email'
                  ? 'bg-white text-violetDeep shadow-sm'
                  : 'text-inkMuted hover:text-ink'
              }`}
            >
              <Mail className="w-3 h-3" aria-hidden="true" />
              <span>Email</span>
            </button>
          </div>
        </div>

        <div role="tabpanel" className="rounded-2xl bg-canvas p-4 max-h-72 overflow-y-auto">
          <pre
            id="negotiation-message-preview"
            className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink"
          >
            {activeContent}
          </pre>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span
            role="status"
            aria-live="polite"
            className={`text-xs font-semibold studio-transition ${
              copyState === 'idle'
                ? 'opacity-0'
                : copyState === 'copied'
                  ? 'opacity-100 text-emerald-700'
                  : 'opacity-100 text-rose-600'
            }`}
          >
            {liveAnnouncement}
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="cta-focal-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-card studio-transition min-h-[42px]"
          >
            {copyState === 'copied' ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Salin Pesan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
