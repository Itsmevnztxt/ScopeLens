import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { isValidIsoDate, validateProject } from '../lib/validation';
import type { Project } from '../types';
import { NativeDialog } from './NativeDialog';

interface ProjectSettingsModalProps {
  open: boolean;
  project: Project;
  onClose: () => void;
  onSave: (patch: Partial<Project>) => void;
}

const WEEKDAYS: Array<{ iso: number; label: string }> = [
  { iso: 1, label: 'Sen' },
  { iso: 2, label: 'Sel' },
  { iso: 3, label: 'Rab' },
  { iso: 4, label: 'Kam' },
  { iso: 5, label: 'Jum' },
  { iso: 6, label: 'Sab' },
  { iso: 7, label: 'Min' },
];

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  open,
  project,
  onClose,
  onSave,
}) => {
  const titleId = useId();
  const [name, setName] = useState(project.name);
  const [clientName, setClientName] = useState(project.clientName);
  const [category, setCategory] = useState(project.category);
  const [initialPrice, setInitialPrice] = useState(String(project.initialPrice));
  const [hourlyRate, setHourlyRate] = useState(String(project.hourlyRate));
  const [productiveHours, setProductiveHours] = useState(String(project.productiveHoursPerDay));
  const [startDate, setStartDate] = useState(project.startDate);
  const [initialDeadline, setInitialDeadline] = useState(project.initialDeadline);
  const [workingDays, setWorkingDays] = useState<number[]>(project.workingDays);
  const [holidaysText, setHolidaysText] = useState(project.holidays.join(', '));
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setClientName(project.clientName);
    setCategory(project.category);
    setInitialPrice(String(project.initialPrice));
    setHourlyRate(String(project.hourlyRate));
    setProductiveHours(String(project.productiveHoursPerDay));
    setStartDate(project.startDate);
    setInitialDeadline(project.initialDeadline);
    setWorkingDays(project.workingDays);
    setHolidaysText(project.holidays.join(', '));
    setErrorText('');
  }, [open, project]);

  const toggleDay = (iso: number) => {
    setWorkingDays((prev) =>
      prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHolidays = holidaysText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const invalidHoliday = parsedHolidays.find((h) => !isValidIsoDate(h));
    if (invalidHoliday) {
      setErrorText(`Format tanggal libur tidak valid: "${invalidHoliday}". Gunakan YYYY-MM-DD.`);
      return;
    }

    const patch: Partial<Project> = {
      name: name.trim(),
      clientName: clientName.trim(),
      category: category.trim() || 'Web Development',
      initialPrice: Number(initialPrice),
      hourlyRate: Number(hourlyRate),
      productiveHoursPerDay: Number(productiveHours),
      startDate,
      initialDeadline,
      workingDays,
      holidays: parsedHolidays,
    };

    const issues = validateProject(patch);
    if (issues.length > 0) {
      setErrorText(issues[0].message);
      return;
    }

    onSave(patch);
    onClose();
  };

  return (
    <NativeDialog open={open} onClose={onClose} labelledBy={titleId}>
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-ink">
              Pengaturan Tarif &amp; Jadwal Proyek
            </h2>
            <p className="text-xs text-inkMuted mt-1">
              Seluruh kalkulasi biaya dan pergeseran deadline otomatis mengikuti parameter ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan proyek"
            className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-subtle min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="proj-name" className="block text-sm font-semibold text-ink mb-1">
                Nama Proyek
              </label>
              <input
                id="proj-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="proj-client" className="block text-sm font-semibold text-ink mb-1">
                Nama Klien
              </label>
              <input
                id="proj-client"
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="proj-price" className="block text-sm font-semibold text-ink mb-1">
                Harga Awal (Rp)
              </label>
              <input
                id="proj-price"
                type="number"
                min={0}
                step={50000}
                value={initialPrice}
                onChange={(e) => setInitialPrice(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="proj-rate" className="block text-sm font-semibold text-ink mb-1">
                Tarif / Jam (Rp)
              </label>
              <input
                id="proj-rate"
                type="number"
                min={1000}
                step={5000}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="proj-hours-day" className="block text-sm font-semibold text-ink mb-1">
                Jam Produktif / Hari
              </label>
              <input
                id="proj-hours-day"
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={productiveHours}
                onChange={(e) => setProductiveHours(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="proj-start" className="block text-sm font-semibold text-ink mb-1">
                Tanggal Mulai
              </label>
              <input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="proj-deadline" className="block text-sm font-semibold text-ink mb-1">
                Deadline Awal
              </label>
              <input
                id="proj-deadline"
                type="date"
                value={initialDeadline}
                onChange={(e) => setInitialDeadline(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold text-ink mb-2">Hari Kerja Aktif</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = workingDays.includes(day.iso);
                return (
                  <label
                    key={day.iso}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer studio-transition min-h-[40px] ${
                      active
                        ? 'border-violetPrimary bg-lavenderTint text-violetPrimary'
                        : 'border-borderSoft bg-canvas text-inkMuted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleDay(day.iso)}
                      className="sr-only"
                    />
                    <span>{day.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="proj-holidays" className="block text-sm font-semibold text-ink mb-1">
              Tanggal Libur Tambahan (Opsional, pisahkan dengan koma)
            </label>
            <input
              id="proj-holidays"
              type="text"
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder="2026-11-24, 2026-12-25"
              className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
            />
          </div>

          {errorText && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
              {errorText}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-borderSoft bg-surface px-4 py-2.5 text-sm font-semibold text-inkMuted hover:text-ink min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="cta-focal-gradient rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-card min-h-[44px]"
            >
              Terapkan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </NativeDialog>
  );
};
