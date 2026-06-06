import React, { useEffect, useState } from 'react';
import { Headphones, X } from 'lucide-react';
import SupportChatPanel from './SupportChatPanel';

/**
 * Fixed bottom-right support chat launcher for native (Android/iOS) admin dashboard.
 */
export default function FloatingSupportChat({ apartmentId }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/25 ring-4 ring-white/90 active:scale-95 transition-transform"
          style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))', right: '1.25rem' }}
          aria-label="Open support chat"
          title="Support"
        >
          <Headphones size={26} strokeWidth={2.25} />
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/45"
            aria-label="Close support chat"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[88vh] flex-col rounded-t-2xl bg-white shadow-2xl animate-fadeIn"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Support chat"
          >
            <div className="flex shrink-0 items-center justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-5 top-1 z-10 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
              <SupportChatPanel
                variant="admin"
                apartmentId={apartmentId}
                floatingSheet
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
