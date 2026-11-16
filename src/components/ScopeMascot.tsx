import React from 'react';
import lensyAlert from '../assets/mascot/30.png';
import lensyStrategist from '../assets/mascot/31.png';
import lensyCalm from '../assets/mascot/32.png';

export type MascotMood = 'calm' | 'alert' | 'strategist';

interface ScopeMascotProps {
  mood: MascotMood;
  message?: string;
  compact?: boolean;
  variant?: 'hero' | 'card';
}

const MOOD_META: Record<
  MascotMood,
  { label: string; bg: string; text: string; src: string; alt: string }
> = {
  calm: {
    label: 'Lensy • Ruang Lingkup Aman',
    bg: '#ECFDF5',
    text: '#047857',
    src: lensyCalm,
    alt: 'Maskot Lensy tersenyum ramah memantau ruang lingkup',
  },
  alert: {
    label: 'Lensy • Ada Perubahan Tambahan',
    bg: '#FFF1F2',
    text: '#BE123C',
    src: lensyAlert,
    alt: 'Maskot Lensy mengangkat kaca pembesar mendeteksi pekerjaan tambahan',
  },
  strategist: {
    label: 'Lensy • Siap Negosiasi',
    bg: '#F3EEFF',
    text: '#6D28D9',
    src: lensyStrategist,
    alt: 'Maskot Lensy mengacungkan jempol dengan papan strategi negosiasi',
  },
};

export const ScopeMascot: React.FC<ScopeMascotProps> = ({
  mood,
  message = '',
  compact = false,
  variant = 'hero',
}) => {
  const meta = MOOD_META[mood];

  const mascotImg = (
    <img
      src={meta.src}
      alt={meta.alt}
      className={
        variant === 'hero'
          ? 'w-44 h-44 sm:w-56 sm:h-56 object-contain drop-shadow-[0_18px_28px_rgba(46,16,101,0.28)] select-none studio-transition'
          : compact
            ? 'w-20 h-20 object-contain drop-shadow-[0_10px_16px_rgba(109,40,217,0.16)] select-none'
            : 'w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-[0_12px_20px_rgba(109,40,217,0.18)] select-none'
      }
    />
  );

  if (variant === 'hero') {
    return (
      <div className="relative flex items-center justify-center shrink-0 select-none">
        {mascotImg}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-[24px] bg-white p-4 sm:p-5 shadow-card studio-transition">
      <div className="shrink-0">{mascotImg}</div>
      <div className="flex-1 min-w-0">
        <span
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold mb-1.5"
          style={{ backgroundColor: meta.bg, color: meta.text }}
        >
          {meta.label}
        </span>
        {message && (
          <p className="text-sm leading-relaxed text-ink font-medium">{message}</p>
        )}
      </div>
    </div>
  );
};
