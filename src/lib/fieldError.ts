import { toast } from "sonner";

export function showFieldError(message: string, fieldId: string) {
  const returnFocus = () => document.getElementById(fieldId)?.focus();
  toast.error(message, { onDismiss: returnFocus });
  queueMicrotask(returnFocus);
}
