import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, expect, it } from "vitest";
import { Login, ProtectedRoute } from "./main";

describe("authentication UI", () => {
  it("logs in through the development endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /modo desarrollo/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/auth/dev_login/"), expect.anything()));
  });

  it("shows loading before protected content", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    render(<MemoryRouter><ProtectedRoute><div>privado</div></ProtectedRoute></MemoryRouter>);
    expect(screen.getByText(/cargando dynamo/i)).toBeInTheDocument();
  });
});
