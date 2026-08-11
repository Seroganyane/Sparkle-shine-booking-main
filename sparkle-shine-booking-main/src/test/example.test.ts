import { describe, it, expect } from "vitest";
import { supabase } from "@/integrations/supabase/client";

describe("auth password reset", () => {
  it("should send a reset email request for the provided address", async () => {
    const email = "user@example.com";
    const response = await supabase.auth.resetPasswordForEmail({
      email,
      redirectTo: "http://localhost:5173/auth",
    });

    expect(response.error).toBeNull();
    expect(response.data?.email).toBe(email);
  });
});
