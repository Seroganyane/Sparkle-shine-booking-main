import { toast } from "sonner";

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        firstName?: string;
        lastName?: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string; trxref?: string; status?: string; message?: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

export type PaystackGatewayResult = {
  status: "success" | "cancelled";
  reference?: string;
  message?: string;
};

const defaultCurrency = "ZAR";

export const openPaystackCheckout = async ({
  email,
  amount,
  label,
  reference,
  metadata,
}: {
  email: string;
  amount: number;
  label?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackGatewayResult> => {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  if (!publicKey) {
    toast.error("Paystack public key missing. Add VITE_PAYSTACK_PUBLIC_KEY to complete a live checkout.");
    return { status: "cancelled", message: "Paystack public key missing" };
  }

  if (!window.PaystackPop) {
    toast.error("Paystack script is not available yet. Please refresh the page.");
    return { status: "cancelled", message: "Paystack script missing" };
  }

  const resolvedReference = reference ?? `aquax-${Date.now()}-${Math.round(Math.random() * 10000)}`;

  return new Promise<PaystackGatewayResult>((resolve) => {
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email,
      amount: Math.round(amount * 100),
      currency: defaultCurrency,
      ref: resolvedReference,
      metadata: metadata ?? {},
      callback: (response) => {
        resolve({
          status: "success",
          reference: response.reference,
          message: response.message ?? "Payment successful",
        });
      },
      onClose: () => {
        resolve({ status: "cancelled", reference: resolvedReference, message: "Payment window closed" });
      },
    });

    if (label) {
      handler.openIframe();
    } else {
      handler.openIframe();
    }
  });
};
