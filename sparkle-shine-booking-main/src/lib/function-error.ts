type FunctionErrorBody = {
  error?: unknown;
  message?: unknown;
  msg?: unknown;
};

/** Extract the response sent by a Supabase Edge Function instead of showing the
 * generic "Edge Function returned a non-2xx status code" SDK message. */
export const getFunctionErrorMessage = async (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as FunctionErrorBody;
        const detail = body.error ?? body.message ?? body.msg;
        if (typeof detail === "string" && detail.trim()) return detail;
      } catch {
        try {
          const detail = await context.clone().text();
          if (detail.trim()) return detail;
        } catch {
          // Fall through to the SDK message below.
        }
      }
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
};
