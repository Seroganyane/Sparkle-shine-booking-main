import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmployeeLogin from "@/pages/EmployeeLogin";
import { supabase } from "@/integrations/supabase/client";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isEmployee: false,
    signInAsEmployee: vi.fn(),
  }),
}));

describe("staff auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(supabase.auth, "signUp").mockResolvedValue({
      data: { user: { id: "staff-user-id" } as any, session: null },
      error: null,
    } as any);
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
        } as any;
      }
      if (table === "user_roles") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
        } as any;
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
      } as any;
    });
  });

  it("lets a staff member sign up with their personal details", async () => {
    render(
      <MemoryRouter>
        <EmployeeLogin />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /create one/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText(/^surname$/i), { target: { value: "Dlamini" } });
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText(/^number$/i), { target: { value: "+27123456789" } });
    fireEvent.change(screen.getByLabelText(/^id number$/i), { target: { value: "9901012345678" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "secure123" } });
    fireEvent.click(screen.getByRole("button", { name: /create staff account/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "jane@example.com",
          password: "secure123",
          options: expect.objectContaining({
            data: expect.objectContaining({
              role: "employee",
              full_name: "Jane Dlamini",
              surname: "Dlamini",
              phone: "+27123456789",
              id_number: "9901012345678",
            }),
          }),
        })
      );
    });
  });
});
