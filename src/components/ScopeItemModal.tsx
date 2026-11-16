import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import type { ItemPriority, ItemType, WorkItem } from '../types';
import { NativeDialog } from './NativeDialog';

interface ScopeItemModalProps {
  open: boolean;
  itemType: ItemType;
  editingItem: WorkItem | null;
  baselineItems: WorkItem[];
  onClose: () => void;
  onSubmit: (payload: Omit<WorkItem, 'id' | 'itemType'>) => void;
}

export const ScopeItemModal: React.FC<ScopeItemModalProps> = ({
  open,
  itemType,
  editingItem,
  baselineItems,
  onClose,
  onSubmit,
}) => {
  const titleId = useId();
  const nameId = useId();
  const descId = useId();
  const hoursId = useId();
  const qtyId = useId();
  const revId = useId();
  const linkId = useId();
  const catId = useId();
  const prioId = useId();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('4');
  const [quantity, setQuantity] = useState('1');
  const [revisionLimit, setRevisionLimit] = useState('2');
  const [category, setCategory] = useState('Feature');
  const [priority, setPriority] = useState<ItemPriority>('medium');
  const [originalItemId, setOriginalItemId] = useState<string>('');
  const [markRemoved, setMarkRemoved] = useState(false);

  const [touchedName, setTouchedName] = useState(false);
  const [touchedHours, setTouchedHours] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setName(editingItem.name);
      setDescription(editingItem.description);
      setEstimatedHours(String(editingItem.estimatedHours));
      setQuantity(String(editingItem.quantity));
      setRevisionLimit(String(editingItem.revisionLimit));
      setCategory(editingItem.category || 'Feature');
      setPriority(editingItem.priority);
      setOriginalItemId(editingItem.originalItemId ?? '');
      setMarkRemoved(editingItem.status === 'removed');
    } else {
      setName('');
      setDescription('');
      setEstimatedHours('4');
      setQuantity('1');
      setRevisionLimit('2');
      setCategory('Feature');
      setPriority('medium');
      setOriginalItemId('');
      setMarkRemoved(false);
    }
    setTouchedName(false);
    setTouchedHours(false);
    setErrorText('');
  }, [open, editingItem]);

  const parsedHours = Number(estimatedHours);
  const parsedQty = Number(quantity);
  const parsedRev = Number(revisionLimit);

  const nameInvalid = touchedName && name.trim().length === 0;
  const hoursInvalid =
    touchedHours && (!Number.isFinite(parsedHours) || parsedHours < 0);

  const handleLinkChange = (selectedId: string) => {
    setOriginalItemId(selectedId);
    if (!selectedId) {
      setMarkRemoved(false);
      return;
    }
    const base = baselineItems.find((b) => b.id === selectedId);
    if (base && !editingItem) {
      setName(base.name);
      setDescription(base.description);
      setEstimatedHours(String(base.estimatedHours));
      setQuantity(String(base.quantity));
      setRevisionLimit(String(base.revisionLimit));
      setCategory(base.category);
      setPriority(base.priority);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedName(true);
    setTouchedHours(true);

    if (name.trim().length === 0) {
      setErrorText('Nama pekerjaan wajib diisi.');
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours < 0) {
      setErrorText('Estimasi jam harus bernilai 0 atau lebih.');
      return;
    }
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      setErrorText('Kuantitas minimal 1.');
      return;
    }
    if (!Number.isInteger(parsedRev) || parsedRev < 0) {
      setErrorText('Batas revisi tidak boleh negatif.');
      return;
    }

    const linkedId = itemType === 'requested' && originalItemId ? originalItemId : null;
    const status =
      itemType === 'original'
        ? 'unchanged'
        : linkedId
          ? markRemoved
            ? 'removed'
            : 'modified'
          : 'added';

    onSubmit({
      originalItemId: linkedId,
      name: name.trim(),
      description: description.trim(),
      quantity: parsedQty,
      estimatedHours: markRemoved ? 0 : parsedHours,
      revisionLimit: parsedRev,
      priority,
      category: category.trim() || 'Feature',
      status,
    });
    onClose();
  };

  return (
    <NativeDialog open={open} onClose={onClose} labelledBy={titleId}>
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-ink">
              {editingItem
                ? `Ubah ${itemType === 'original' ? 'Item Kesepakatan Awal' : 'Permintaan Klien'}`
                : itemType === 'original'
                  ? 'Tambah Item Kesepakatan Awal'
                  : 'Tambah Permintaan Klien'}
            </h2>
            <p className="text-xs text-inkMuted mt-1">
              {itemType === 'original'
                ? 'Item ini masuk ke kesepakatan awal proyek.'
                : 'Biarkan relasi kosong untuk permintaan fitur baru, atau tautkan ke item awal jika ini revisi atau penghapusan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="rounded-xl p-2 text-inkMuted hover:text-ink hover:bg-subtle min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="space-y-4">
          {itemType === 'requested' && baselineItems.length > 0 && (
            <div>
              <label htmlFor={linkId} className="block text-sm font-semibold text-ink mb-1">
                Jenis Permintaan (Tautan Kesepakatan Awal)
              </label>
              <select
                id={linkId}
                name="originalItemId"
                value={originalItemId}
                onChange={(e) => handleLinkChange(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-canvas px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              >
                <option value="">Permintaan Baru di Luar Kesepakatan Awal</option>
                {baselineItems.map((b) => (
                  <option key={b.id} value={b.id}>
                    Ubah / Hapus dari Kesepakatan Awal: {b.name} ({b.estimatedHours} jam)
                  </option>
                ))}
              </select>
            </div>
          )}

          {itemType === 'requested' && originalItemId && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <input
                id="mark-removed-checkbox"
                type="checkbox"
                checked={markRemoved}
                onChange={(e) => setMarkRemoved(e.target.checked)}
                className="h-4 w-4 accent-violetPrimary"
              />
              <label htmlFor="mark-removed-checkbox" className="text-xs font-semibold text-amber-900">
                Tandai item awal ini sebagai dihapus dari lingkup pengerjaan
              </label>
            </div>
          )}

          <div>
            <label htmlFor={nameId} className="block text-sm font-semibold text-ink mb-1">
              Nama Pekerjaan <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <input
              id={nameId}
              name="itemName"
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorText) setErrorText('');
              }}
              onBlur={() => setTouchedName(true)}
              aria-invalid={nameInvalid ? 'true' : undefined}
              placeholder="Contoh: Dashboard Admin"
              className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
            />
            {nameInvalid && (
              <p className="text-xs font-medium text-rose-600 mt-1">
                Nama pekerjaan tidak boleh kosong.
              </p>
            )}
          </div>

          <div>
            <label htmlFor={descId} className="block text-sm font-semibold text-ink mb-1">
              Catatan / Spesifikasi Teknis
            </label>
            <textarea
              id={descId}
              name="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan rincian fitur atau perubahan spesifikasi yang diminta klien..."
              className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor={hoursId} className="block text-sm font-semibold text-ink mb-1">
                Total Estimasi Jam <span aria-hidden="true" className="text-rose-600">*</span>
              </label>
              <input
                id={hoursId}
                name="estimatedHours"
                type="number"
                min={0}
                step="0.5"
                disabled={markRemoved}
                value={markRemoved ? '0' : estimatedHours}
                onChange={(e) => {
                  setEstimatedHours(e.target.value);
                  if (errorText) setErrorText('');
                }}
                onBlur={() => setTouchedHours(true)}
                aria-invalid={hoursInvalid ? 'true' : undefined}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px] disabled:bg-subtle"
              />
            </div>

            <div>
              <label htmlFor={qtyId} className="block text-sm font-semibold text-ink mb-1">
                Kuantitas
              </label>
              <input
                id={qtyId}
                name="quantity"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor={revId} className="block text-sm font-semibold text-ink mb-1">
                Batas Revisi
              </label>
              <input
                id={revId}
                name="revisionLimit"
                type="number"
                min={0}
                step={1}
                value={revisionLimit}
                onChange={(e) => setRevisionLimit(e.target.value)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm font-numeric text-ink min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={catId} className="block text-sm font-semibold text-ink mb-1">
                Kategori
              </label>
              <input
                id={catId}
                name="category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Frontend, Backend, UI/UX..."
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor={prioId} className="block text-sm font-semibold text-ink mb-1">
                Prioritas
              </label>
              <select
                id={prioId}
                name="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ItemPriority)}
                className="w-full rounded-xl border border-borderSoft bg-surface px-3.5 py-2.5 text-sm text-ink min-h-[44px]"
              >
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>
            </div>
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
              className="rounded-xl border border-borderSoft bg-surface px-4 py-2.5 text-sm font-semibold text-inkMuted hover:text-ink hover:bg-subtle min-h-[44px]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="cta-focal-gradient rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-card min-h-[44px]"
            >
              {editingItem ? 'Simpan Perubahan' : 'Tambahkan Item'}
            </button>
          </div>
        </form>
      </div>
    </NativeDialog>
  );
};
