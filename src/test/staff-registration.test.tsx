import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import StaffRegistration from "@/pages/StaffRegistration";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("staff invitation activation", () => {
  it("keeps the activate button disabled while the invitation session is still loading, instead of assuming no session", () => {
    // Regression test: this page used to check supabase.auth.getUser() once on
    // mount, before the invite link's session had necessarily finished being
    // established, and never re-checked — so a slow session left the button
    // permanently stuck on "open this page using the link in your invitation
    // email" even though the link was correct. It must now wait for the
    // shared auth context to finish loading before deciding there's no session.
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <MemoryRouter initialEntries={["/staff-register?invitation=abc&code=123456"]}>
        <StaffRegistration />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /checking your invitation/i })).toBeDisabled();
    expect(screen.queryByText(/open this page using the link/i)).not.toBeInTheDocument();
  });

  it("enables the activate button once the invitation session resolves", () => {
    mockUseAuth.mockReturnValue({ user: { email: "staff@example.com" }, loading: false });
    render(
      <MemoryRouter initialEntries={["/staff-register?invitation=abc&code=123456"]}>
        <StaffRegistration />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: /^activate staff account$/i })).toBeEnabled();
    expect(screen.getByText("staff@example.com")).toBeInTheDocument();
  });

  it("only shows the missing-invitation warning once loading has actually finished", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/staff-register"]}>
        <StaffRegistration />
      </MemoryRouter>
    );

    expect(screen.getByText(/open this page using the link/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activate staff account$/i })).toBeDisabled();
  });
});
