export default function ConfirmArchiveModal({
  isSubmitting,
  isOpen,
  onClose,
  onConfirm,
  subscription,
}) {
  if (!isOpen || !subscription) {
    return null;
  }

  return (
    <div
      aria-labelledby="archive-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-white" id="archive-modal-title">
          Archive {subscription.serviceName}?
        </h3>
        <p className="mt-3 text-sm text-slate-300">
          This will move <strong className="text-white">{subscription.serviceName}</strong> to your
          archived list. It will not appear in active spending calculations or renewal reminders,
          but your subscription history will remain safely preserved.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          You can restore archived subscriptions at any time.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={onConfirm}
            type="button"
          >
            {isSubmitting ? 'Archiving…' : 'Archive Subscription'}
          </button>
        </div>
      </div>
    </div>
  );
}
