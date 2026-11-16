import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { createDemoProject } from '../data/demoSeed';
import { useScopeLensStore } from '../stores/useScopeLensStore';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let origInitAuth: (() => Promise<void>) | null = null;
let origSupabaseReady = false;

beforeEach(() => {
  window.localStorage.clear();
  const state = useScopeLensStore.getState();
  origInitAuth = state.initAuth;
  origSupabaseReady = state.supabaseReady;

  useScopeLensStore.setState({
    user: null,
    cloudProjects: [],
    reports: [],
    adminUsers: [],
    adminProjects: [],
    adminReportsCount: 0,
    hasLoadedCloudOnce: false,
    isLoadingCloud: false,
    cloudLoadError: null,
    supabaseReady: false,
    initAuth: async () => {},
  });
  useScopeLensStore.getState().resetDemo();
  useScopeLensStore.getState().clearToast();

  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
});

afterEach(() => {
  if (origInitAuth) {
    useScopeLensStore.setState({
      initAuth: origInitAuth,
      supabaseReady: origSupabaseReady,
    });
  }
});

async function enterLocalStudio(container: HTMLDivElement) {
  const openBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Buka Ruang Analisis')
  );
  expect(openBtn).toBeTruthy();
  await act(async () => {
    openBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ScopeLens Landing Page → Login → Dashboard & Empty State Flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('menampilkan Landing Page terlebih dahulu saat belum login (supabaseReady: true) dan membuka modal login saat CTA diklik', async () => {
    useScopeLensStore.setState({ supabaseReady: true, user: null });

    await act(async () => {
      root.render(<App />);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Pelindung Kesepakatan & Margin Freelance');
    expect(text).toContain('Masuk ke Dashboard');
    expect(text).toContain('Daftar Akun Baru');
    expect(text).toContain('Ilustrasi Simulasi ScopeLens');
    // Belum boleh langsung masuk dashboard sebelum login
    expect(text).not.toContain('Analisis Perubahan Ruang Lingkup');
    expect(text).not.toContain('Halo, Freelancer');

    const loginBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Masuk ke Dashboard')
    );
    expect(loginBtn).toBeTruthy();
    await act(async () => {
      loginBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialog = container.querySelector('dialog[open]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain('Akun Cloud ScopeLens');
  });

  it('setelah login dengan 0 proyek di Supabase, otomatis masuk ke Empty State Dashboard tanpa menampilkan data dummy lokal, lalu kembali ke Landing Page saat logout', async () => {
    useScopeLensStore.setState({
      supabaseReady: true,
      user: null,
      cloudProjects: [],
      hasLoadedCloudOnce: false,
    });

    await act(async () => {
      root.render(<App />);
    });

    // Simulasikan user selesai login dengan 0 proyek di PostgreSQL
    await act(async () => {
      useScopeLensStore.setState({
        user: {
          id: 'user-new-1',
          email: 'userbaru@scopelens.id',
          fullName: 'Nadia Putri',
          role: 'user',
        },
        cloudProjects: [],
        hasLoadedCloudOnce: true,
        isLoadingCloud: false,
      });
    });

    const mainText = container.querySelector('main')?.textContent ?? '';
    expect(mainText).toContain('Halo, Nadia');
    expect(mainText).toContain('Belum ada proyek tersimpan di akun Anda');
    expect(mainText).toContain('Buat Proyek Pertama');
    expect(mainText).toContain('Salin Contoh Proyek ke Akun');
    // Tidak boleh menampilkan metrik dummy Website Company Profile di workspace utama
    expect(mainText).not.toContain('Ardi Pratama (Kopi Senja Studio)');
    expect(mainText).not.toContain('Website Company Profile');
    expect(mainText).not.toContain('+Rp 900rb');

    // Simulasikan logout -> otomatis kembali ke Landing Page
    await act(async () => {
      await useScopeLensStore.getState().signOut();
    });

    const afterLogoutText = container.textContent ?? '';
    expect(afterLogoutText).toContain('Masuk ke Dashboard');
    expect(afterLogoutText).not.toContain('Belum ada proyek tersimpan di akun Anda');
  });

  it('menampilkan akses Panel Kontrol Admin & ringkasan sistem asli untuk Admin yang belum memiliki proyek pribadi', async () => {
    const sample = createDemoProject();
    useScopeLensStore.setState({
      supabaseReady: true,
      user: {
        id: 'admin-1',
        email: 'admin1@gmail.com',
        fullName: 'Admin Utama',
        role: 'admin',
      },
      cloudProjects: [],
      hasLoadedCloudOnce: true,
      isLoadingCloud: false,
      adminUsers: [
        { id: 'admin-1', email: 'admin1@gmail.com', fullName: 'Admin Utama', role: 'admin' },
        { id: 'u-2', email: 'klien@gmail.com', fullName: 'Dika User', role: 'user' },
      ],
      adminProjects: [
        {
          ...sample,
          id: '33333333-3333-4333-8333-333333333333',
          userId: 'u-2',
          name: 'Aplikasi Inventaris Gudang',
          clientName: 'PT Sinar Jaya',
          ownerName: 'Dika User',
          ownerEmail: 'klien@gmail.com',
          scopeItemsCount: 6,
          isDemo: false,
        },
      ],
      adminReportsCount: 2,
    });

    await act(async () => {
      root.render(<App />);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Panel Kontrol Admin');
    expect(text).toContain('Data Asli Platform di Database');
    expect(text).toContain('Aplikasi Inventaris Gudang');
    expect(text).toContain('PT Sinar Jaya');
  });

  it('menampilkan kartu error & tombol Coba Muat Ulang bila gagal memuat proyek dari Supabase (tidak salah tampilkan 0 proyek tersimpan)', async () => {
    useScopeLensStore.setState({
      supabaseReady: true,
      user: {
        id: 'user-err-1',
        email: 'user@scopelens.id',
        fullName: 'Raka User',
        role: 'user',
      },
      cloudProjects: [],
      hasLoadedCloudOnce: true,
      isLoadingCloud: false,
      cloudLoadError: 'Koneksi database terputus.',
    });

    await act(async () => {
      root.render(<App />);
    });

    const mainText = container.querySelector('main')?.textContent ?? '';
    expect(mainText).toContain('Gagal memuat proyek dari Supabase');
    expect(mainText).toContain('Koneksi database terputus.');
    expect(mainText).toContain('Coba Muat Ulang');
    expect(mainText).not.toContain('Belum ada proyek tersimpan di akun Anda');
  });

  it('bila user memiliki proyek tersimpan namun belum aktif di workspace, menampilkan pilihan proyek dan bukan 0 proyek tersimpan', async () => {
    const sample = createDemoProject();
    useScopeLensStore.setState({
      supabaseReady: true,
      user: {
        id: 'user-has-1',
        email: 'user@scopelens.id',
        fullName: 'Sinta User',
        role: 'user',
      },
      cloudProjects: [
        {
          ...sample,
          id: '55555555-5555-4555-8555-555555555555',
          userId: 'user-has-1',
          name: 'Sistem POS Restoran',
          isDemo: false,
        },
      ],
      hasLoadedCloudOnce: true,
      isLoadingCloud: false,
      cloudLoadError: null,
    });

    await act(async () => {
      root.render(<App />);
    });

    const mainText = container.querySelector('main')?.textContent ?? '';
    expect(mainText).toContain('Anda memiliki 1 proyek tersimpan');
    expect(mainText).toContain('Buka Sistem POS Restoran');
    expect(mainText).not.toContain('Belum ada proyek tersimpan di akun Anda');
  });

  it('menjaga ProjectListDrawer tetap terbuka dan menampilkan pesan error jika Salin ke Akun Saya gagal', async () => {
    const origCreateSample = useScopeLensStore.getState().createSampleCloudProject;
    useScopeLensStore.setState({
      supabaseReady: true,
      user: {
        id: 'user-drawer-1',
        email: 'user@scopelens.id',
        fullName: 'Dewi User',
        role: 'user',
      },
      cloudProjects: [],
      hasLoadedCloudOnce: true,
      isLoadingCloud: false,
      createSampleCloudProject: vi.fn().mockResolvedValue(false),
    });

    try {
      await act(async () => {
        root.render(<App />);
      });

      const createBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Buat Proyek Pertama')
      );
      expect(createBtn).toBeTruthy();

      await act(async () => {
        createBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const copySampleBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Salin ke Akun Saya')
      );
      expect(copySampleBtn).toBeTruthy();

      await act(async () => {
        copySampleBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      const dialog = container.querySelector('dialog[open]');
      expect(dialog).toBeTruthy();
      expect(dialog?.textContent).toContain('Gagal menyalin contoh proyek ke akun Anda');
    } finally {
      useScopeLensStore.setState({ createSampleCloudProject: origCreateSample });
    }
  });

  it('Landing Page tetap menampilkan ilustrasi bersih dan tidak membocorkan editan localStorage saat belum login dengan supabaseReady: true', async () => {
    useScopeLensStore.getState().updateProjectMeta({ name: 'Proyek Rahasia LocalStorage' });
    useScopeLensStore.setState({ supabaseReady: true, user: null });

    await act(async () => {
      root.render(<App />);
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Ilustrasi Simulasi ScopeLens');
    expect(text).toContain('Website Company Profile');
    expect(text).not.toContain('Proyek Rahasia LocalStorage');
  });
});

describe('ScopeLens Cozy Pastel Bento UI — Render & Interaksi Nyata', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('merender Cozy Pastel Bento dengan metrik akurat dan bebas kata Demo/slop', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    const text = container.textContent ?? '';
    expect(text).toContain('Halo, Freelancer');
    expect(text).toContain('Analisis Perubahan Ruang Lingkup');
    expect(text).toContain('Website Company Profile');
    expect(text).toContain('Ardi Pratama (Kopi Senja Studio)');
    expect(text).toContain('+Rp 900rb');
    expect(text).toContain('+2 Hari');
    expect(text).toContain('Rp 2,4jt');
    expect(text).toContain('+60% Beban Kerja Tambahan');
    expect(text).toContain('Sesuai Awal');
    expect(text).toContain('Permintaan Baru');
    expect(text).toContain('ScopeLens — Lindungi Kesepakatan & Margin Proyek Freelance');

    // Pastikan tidak ada istilah developer/demo yang tersisa di layar
    expect(text).not.toContain('Demo Mode');
    expect(text).not.toContain('Demo Client');
    expect(text).not.toContain('Reset Demo');
    expect(text).not.toContain('ISCOMFEST');
    expect(text).not.toContain('Creep Mentah');
    expect(text).not.toContain('UNCHANGED');
    expect(text).not.toContain('ADDITIONAL');
  });

  it('Scope Swap: menukar Contact Form (4j) + Responsive Design (8j) mengubah Dampak Biaya jadi Rp 0, Tambahan Waktu jadi 0 Hari, dan memperbarui pesan WhatsApp', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    const swapRadio = Array.from(container.querySelectorAll('button[role="radio"]')).find((b) =>
      b.textContent?.includes('Tukar Fitur')
    );
    expect(swapRadio).toBeTruthy();

    await act(async () => {
      swapRadio!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Centang Contact Form (4j) & Responsive Design (8j) di panel checklist Scope Swap
    const swapLabels = Array.from(
      container.querySelectorAll('#strategi-negosiasi label')
    );
    const contactLabel = swapLabels.find((l) => l.textContent?.includes('Contact Form'));
    const responsiveLabel = swapLabels.find((l) => l.textContent?.includes('Responsive Design'));

    expect(contactLabel).toBeTruthy();
    expect(responsiveLabel).toBeTruthy();

    const contactCheckbox = contactLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const responsiveCheckbox = responsiveLabel!.querySelector('input[type="checkbox"]') as HTMLInputElement;

    await act(async () => {
      contactCheckbox.click();
    });
    await act(async () => {
      responsiveCheckbox.click();
    });

    const costCard = container.querySelector('[data-testid="metric-cost-impact"]');
    const timeCard = container.querySelector('[data-testid="metric-time-impact"]');
    const totalCard = container.querySelector('[data-testid="metric-total-price"]');
    const msgPreview = container.querySelector('#negotiation-message-preview');

    expect(costCard?.textContent).toBe('Rp 0');
    expect(timeCard?.textContent).toBe('0 Hari');
    expect(totalCard?.textContent).toBe('Rp 1,5jt');
    expect(msgPreview?.textContent).toContain('Contact Form (4 jam)');
    expect(msgPreview?.textContent).toContain('Responsive Design (8 jam)');
    expect(msgPreview?.textContent).toContain('Rp0');
  });

  it('mengubah strategi ke Pindahkan ke Fase 2 menjaga harga Fase 1 tetap Rp 1,5jt dan target selesai 23 November 2026', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    const phase2Btn = Array.from(container.querySelectorAll('button[role="radio"]')).find((b) =>
      b.textContent?.includes('Pindahkan ke Fase 2')
    );
    expect(phase2Btn).toBeTruthy();

    await act(async () => {
      phase2Btn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const costCard = container.querySelector('[data-testid="metric-cost-impact"]');
    const timeCard = container.querySelector('[data-testid="metric-time-impact"]');
    const totalCard = container.querySelector('[data-testid="metric-total-price"]');

    expect(costCard?.textContent).toBe('Rp 0');
    expect(timeCard?.textContent).toBe('0 Hari');
    expect(totalCard?.textContent).toBe('Rp 1,5jt');
    expect(container.textContent).toContain('23 November 2026');
    expect(container.textContent).toContain('Masuk Fase 2');
  });

  it('menonaktifkan opsi tukar pada item awal yang sudah dihapus dan mendukung Salin Pesan ke clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const current = useScopeLensStore.getState().project;
    const contact = current.originalItems[1];
    useScopeLensStore.getState().addScopeItem('requested', {
      originalItemId: contact.id,
      name: contact.name,
      description: contact.description,
      quantity: 1,
      estimatedHours: 0,
      revisionLimit: 0,
      priority: 'medium',
      category: contact.category,
      status: 'removed',
    });

    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    const swapRadio = Array.from(container.querySelectorAll('button[role="radio"]')).find((b) =>
      b.textContent?.includes('Tukar Fitur')
    );
    await act(async () => {
      swapRadio!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const contactSwapLabel = Array.from(
      container.querySelectorAll('#strategi-negosiasi label')
    ).find((l) => l.textContent?.includes('Contact Form'));
    expect(contactSwapLabel?.textContent).toContain('(Sudah dihapus)');
    const contactCheckbox = contactSwapLabel?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(contactCheckbox.disabled).toBe(true);

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Salin Pesan')
    );
    expect(copyBtn).toBeTruthy();
    await act(async () => {
      copyBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Pesan tersalin');
  });

  it('menghapus centang permintaan aktif atau menunda ke Fase 2 langsung menghitung ulang metrik', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    // Uncheck Dashboard Admin (5j = Rp375rb) -> sisa 7j = +Rp525rb, total Rp2.025.000
    const adminCheckbox = container.querySelector(
      'input[type="checkbox"][aria-label*="Dashboard Admin"]'
    ) as HTMLInputElement;
    expect(adminCheckbox).toBeTruthy();
    expect(adminCheckbox.checked).toBe(true);

    await act(async () => {
      adminCheckbox.click();
    });

    const costCard = container.querySelector('[data-testid="metric-cost-impact"]');
    expect(costCard?.textContent).toBe('+Rp 525rb');
    expect(container.textContent).toContain('Rp2.025.000');
    expect(container.textContent).toContain('27j');

    // Re-check lalu test tombol cepat "Tunda ke Fase 2" pada item pertama
    await act(async () => {
      adminCheckbox.click();
    });
    expect(container.querySelector('[data-testid="metric-cost-impact"]')?.textContent).toBe('+Rp 900rb');

    const deferBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Tunda ke Fase 2')
    );
    expect(deferBtns.length).toBeGreaterThanOrEqual(1);

    await act(async () => {
      deferBtns[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="metric-cost-impact"]')?.textContent).toBe('+Rp 525rb');
  });

  it('dapat berpindah antara Workspace Analisis dan tampilan Beranda melalui SideRail', async () => {
    await act(async () => {
      root.render(<App />);
    });
    await enterLocalStudio(container);

    const homeBtn = container.querySelector('button[aria-label="Beranda & Ringkasan"]');
    expect(homeBtn).toBeTruthy();

    await act(async () => {
      homeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Buka Ruang Analisis');

    const backToStudioBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Buka Ruang Analisis')
    );
    await act(async () => {
      backToStudioBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Analisis Perubahan Ruang Lingkup');
  });
});
