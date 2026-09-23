import { describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("auth password reset", () => {
  it("submits the supplied email and redirect URL", async () => {
    const email = "user@example.com";
    const resetPasswordForEmail = vi
      .spyOn(supabase.auth, "resetPasswordForEmail")
      .mockResolvedValue({ data: {}, error: null });

    const response = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:5173/auth",
    });

    expect(resetPasswordForEmail).toHaveBeenCalledWith(email, {
      redirectTo: "http://localhost:5173/auth",
    });
    expect(response.error).toBeNull();
  });
});