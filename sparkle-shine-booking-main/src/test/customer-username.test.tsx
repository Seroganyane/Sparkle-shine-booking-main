import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "@/pages/Auth";
import { supabase } from "@/integrations/supabase/client";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAdmin: false, isEmployee: false, loading: false }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("customer username access", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigate.mockClear();
    sessionStorage.clear();
  });

  it("stores a chosen username when a customer registers", async () => {
    vi.spyOn(supabase, "rpc").mockResolvedValue({ data: true, error: null } as never);
    const signUp = vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
      data: { user: { id: "customer-id" }, session: null }, error: null,
    } as never);

    render(<MemoryRouter><Auth /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /no account.*sign up/i }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Jane Dlamini" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0712345678" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Jane_123" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure123" } });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => expect(signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "jane@example.com",
      options: expect.objectContaining({ data: expect.objectContaining({ username: "jane_123" }) }),
    })));
    expect(navigate).not.toHaveBeenCalledWith("/dashboard");
  });

  it("uses the username sign-in function and starts the returned session", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { accessToken: "access", refreshToken: "refresh" }, error: null,
    });
    vi.spyOn(supabase, "functions", "get").mockReturnValue({ invoke } as never);
    const setSession = vi.spyOn(supabase.auth, "setSession").mockResolvedValue({
      data: { user: { id: "customer-id" }, session: null }, error: null,
    } as never);
    vi.spyOn(supabase, "from").mockImplementation(() => ({
      select: () => ({ eq: async () => ({ data: [{ role: "user" }], error: null }) }),
    }) as never);

    render(<MemoryRouter><Auth /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Username or email address"), { target: { value: "jane_123" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure123" } });
    expect(screen.getByLabelText("Username or email address")).toHaveValue("jane_123");
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("username-signin", {
      body: { username: "jane_123", password: "secure123" },
    }));
    expect(setSession).toHaveBeenCalledWith({ access_token: "access", refresh_token: "refresh" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
  });
});
