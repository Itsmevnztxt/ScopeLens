import React, { useEffect, useRef } from 'react';

interface NativeDialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * Wrapper komponen native <dialog> sesuai standar aksesibilitas modern:
 * - Memakai showModal() agar browser mengatur inert page, top layer, focus containment & Esc.
 * - Menyediakan fallback light-dismiss berbasis koordinat pointer untuk browser tanpa closedBy.
 */
export const NativeDialog: React.FC<NativeDialogProps> = ({
  open,
  onClose,
  labelledBy,
  wide = false,
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      pressedOutsideRef.current = isOutside(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutsideRef.current && isOutside(e)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('close', handleClose);
    const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
    if (!supportsClosedBy) {
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (!supportsClosedBy) {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      }
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      {...({ closedby: 'any' } as Record<string, string>)}
      className={`studio-dialog ${wide ? 'studio-dialog-wide' : ''}`}
    >
      {children}
    </dialog>
  );
};
