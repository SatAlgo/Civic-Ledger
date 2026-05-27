'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Department } from '@/lib/types';

/**
 * GitHub-style destructive confirmation modal.
 *
 * The user must type the department's code exactly before the Delete button
 * is enabled. Mis-clicks become impossible. Esc closes; the modal traps
 * focus on the input.
 *
 * Designed for irreversible operations only — don't use it for actions that
 * have an undo path.
 */

interface Props {
  dept: { _id: string; name: string; code: string; adminEmails?: string[] };
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function DeleteDepartmentModal({ dept, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the confirmation input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Esc to close (only when not busy)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const canDelete = typed.trim().toUpperCase() === dept.code.toUpperCase() && !busy;

  const handleConfirm = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      await onConfirm();
      // Parent closes us on success
    } catch {
      // Parent shows the toast; we just allow re-try
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={(e) => {
        // Click outside to close (when not busy)
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-paper border-2 border-signal-rust max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-ink/10">
          <div className="flex items-center gap-3">
            <AlertTriangle size={22} className="text-signal-rust shrink-0" />
            <div>
              <div className="plate text-signal-rust mb-1">Permanent delete</div>
              <h2 id="delete-modal-title" className="font-display text-xl leading-tight">
                Delete this department?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 hover:bg-ink/5 transition disabled:opacity-30"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="text-sm leading-relaxed text-ink/80">
            You are about to permanently delete{' '}
            <strong className="font-display">{dept.name}</strong>{' '}
            <span className="font-mono text-xs px-1.5 py-0.5 bg-ink text-paper">
              {dept.code}
            </span>
            .
          </div>

          <div className="text-sm bg-paper-warm border border-ink/15 p-3">
            <p className="font-medium mb-2">This will also delete:</p>
            <ul className="list-disc list-inside space-y-1 text-ink/80 text-[13px]">
              <li>All admin accounts tied to this department</li>
              <li>Their notifications and any routing rules pointing here</li>
            </ul>
            {dept.adminEmails && dept.adminEmails.length > 0 && (
              <p className="mt-3 text-xs text-ink/60">
                Email{dept.adminEmails.length > 1 ? 's' : ''} that will be freed up:{' '}
                <span className="font-mono">{dept.adminEmails.join(', ')}</span>
              </p>
            )}
          </div>

          <div>
            <label className="plate block mb-2">
              Type{' '}
              <span className="font-mono normal-case tracking-normal text-ink">
                {dept.code}
              </span>{' '}
              to confirm
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={busy}
              className="w-full bg-paper-warm border border-ink/25 px-3 py-2 text-sm font-mono focus:border-signal-rust focus:outline-none"
              placeholder={dept.code}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-ink/10 bg-paper-soft">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium border border-ink/25 hover:border-ink transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canDelete}
            className="px-4 py-2 text-sm font-medium bg-signal-rust text-paper border border-signal-rust hover:bg-ink hover:border-ink transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Deleting…
              </>
            ) : (
              'Delete permanently'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
