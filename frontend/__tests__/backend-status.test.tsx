import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { checkBackendHealth } from "@/lib/api";
import { BackendStatusProvider } from "@/components/BackendStatusProvider";
import { BackendStatus } from "@/components/BackendStatus";

describe("checkBackendHealth", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  it("returns online when /api/health returns 200 and valid JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        service: "ClipFetch",
        dependencies: { fastapi: true, yt_dlp: true, ffmpeg: true },
      }),
    }) as jest.Mock;

    const result = await checkBackendHealth();
    expect(result.isOnline).toBe(true);
    expect(result.status).toBe("online");
    expect(result.data?.service).toBe("ClipFetch");
  });

  it("returns online even when individual dependencies are false (e.g. ffmpeg false)", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        service: "ClipFetch",
        dependencies: { fastapi: true, yt_dlp: false, ffmpeg: false },
      }),
    }) as jest.Mock;

    const result = await checkBackendHealth();
    expect(result.isOnline).toBe(true);
    expect(result.status).toBe("online");
  });

  it("returns offline when /api/health returns a 500 error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ detail: "Internal Server Error" }),
    }) as jest.Mock;

    const result = await checkBackendHealth();
    expect(result.isOnline).toBe(false);
    expect(result.status).toBe("offline");
    expect(result.error).toContain("500");
  });

  it("returns offline when fetch throws a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Failed to fetch")) as jest.Mock;

    const result = await checkBackendHealth();
    expect(result.isOnline).toBe(false);
    expect(result.status).toBe("offline");
    expect(result.error).toBe("Unable to reach backend server.");
  });

  it("returns offline when NEXT_PUBLIC_API_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    const result = await checkBackendHealth();
    expect(result.isOnline).toBe(false);
    expect(result.status).toBe("offline");
    expect(result.error).toContain("NEXT_PUBLIC_API_URL is missing");
  });
});

describe("BackendStatus Component with BackendStatusProvider", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
    jest.clearAllMocks();
  });

  it("renders checking state initially and transitions to online", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        service: "ClipFetch",
      }),
    }) as jest.Mock;

    render(
      <BackendStatusProvider>
        <BackendStatus />
      </BackendStatusProvider>
    );

    // Initial checking state is displayed
    expect(screen.getByRole("status")).toHaveTextContent(/checking/i);

    // Transitions to online after health check resolves
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/online/i);
    });

    // Retry button is NOT present when online
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("renders offline state with Retry button when health check fails", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Connection refused")) as jest.Mock;

    render(
      <BackendStatusProvider>
        <BackendStatus />
      </BackendStatusProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it("clicking Retry immediately triggers a new health check", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Server down"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", service: "ClipFetch" }),
      });
    }) as jest.Mock;

    render(
      <BackendStatusProvider>
        <BackendStatus />
      </BackendStatusProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    });

    const retryButton = screen.getByRole("button", { name: /retry/i });

    await act(async () => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/online/i);
    });

    expect(callCount).toBe(2);
  });
});

