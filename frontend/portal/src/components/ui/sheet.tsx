// shadcn Sheet built on Radix Dialog: focus trap, Escape, trigger focus restoration.
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Sheet({
  trigger,
  children,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/40" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-1 text-lg font-semibold">
            Credit Risk
          </Dialog.Title>
          <Dialog.Description className="mb-8 text-sm text-slate-600">
            Local demonstration navigation
          </Dialog.Description>
          {children}
          <Dialog.Close
            aria-label="Close navigation"
            className="absolute right-3 top-4 rounded-lg p-2"
          >
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
