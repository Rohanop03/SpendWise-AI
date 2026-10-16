import { Dialog as RadixDialog } from 'radix-ui';

import Icon from './Icon.jsx';
import { useReturnFocus } from './useReturnFocus.js';
import { Pill } from './Pill.jsx';

/**
 * Glass dialog. `variant="sheet"` docks to the right on desktop and becomes a bottom
 * sheet on phones; `variant="center"` is a centred card that also becomes a bottom sheet
 * on phones.
 */
export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  title,
  variant = 'center',
  wide = false,
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const position =
    variant === 'sheet'
      ? 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[2rem] md:inset-y-3 md:right-3 md:left-auto md:bottom-auto md:max-h-none md:w-[min(34rem,calc(100vw-1.5rem))] md:rounded-[2rem]'
      : `inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[2rem] md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[88dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem] ${
          wide ? 'md:w-[min(40rem,calc(100vw-2rem))]' : 'md:w-[min(30rem,calc(100vw-2rem))]'
        }`;

  return (
    <RadixDialog.Root onOpenChange={onOpenChange} open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-[60] bg-[rgb(12_12_14/28%)]" />
        <RadixDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className={`dialog-content glass glass-solid fixed z-[61] flex flex-col overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7 ${position}`}
        >
          <header className="mb-5 flex items-start justify-between gap-4">
            <hgroup className="min-w-0">
              <RadixDialog.Title className="text-xl sm:text-2xl">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-2 text-sm leading-6 text-(--graphite)">
                  {description}
                </RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
              )}
            </hgroup>
            <RadixDialog.Close asChild>
              <button
                aria-label="Close dialog"
                className="pill neu-press size-10 shrink-0 !p-0"
                type="button"
              >
                <Icon className="size-4" name="close" />
              </button>
            </RadixDialog.Close>
          </header>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Confirmation dialog that states the consequence in plain words. The confirm action is
 * an ink pill; cancel is raised.
 */
export function ConfirmDialog({
  busy = false,
  busyLabel,
  cancelLabel = 'Cancel',
  children,
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}) {
  return (
    <Dialog description={description} onOpenChange={onOpenChange} open={open} title={title}>
      {children}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Pill disabled={busy} onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Pill>
        <Pill disabled={busy} onClick={onConfirm} variant="ink">
          {busy ? busyLabel || `${confirmLabel}…` : confirmLabel}
        </Pill>
      </div>
    </Dialog>
  );
}
