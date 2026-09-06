import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NoiseRemoverWorkspace } from "@/components/tools/NoiseRemoverWorkspace";

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => "blob:http://localhost/mock-blob-url");
global.URL.revokeObjectURL = jest.fn();

// Mock HTMLMediaElement play and pause
window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();

describe("NoiseRemoverWorkspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
  });

  it("renders upload area with format badges", () => {
    render(<NoiseRemoverWorkspace />);
    expect(screen.getByText(/upload audio or video to clean/i)).toBeInTheDocument();
    expect(screen.getByText(/mp3 · wav · m4a · aac · flac · ogg/i)).toBeInTheDocument();
    expect(screen.getByText(/mp4 · mov · webm · mkv/i)).toBeInTheDocument();
  });

  it("shows file details and modes when an audio file is uploaded", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        duration: 3.5,
        size: 512000,
        has_video: false,
        sample_rate: 44100,
        channels: 2,
        waveform: Array(100).fill(0.4),
        suggested_mode: "auto",
        filename: "podcast_recording.wav",
      }),
    }) as jest.Mock;

    render(<NoiseRemoverWorkspace />);
    const file = new File(["dummy-audio"], "podcast_recording.wav", { type: "audio/wav" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("podcast_recording.wav")).toBeInTheDocument();
    });

    expect(screen.getByText(/noise reduction mode/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /balanced/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /strong/i })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove background noise now/i })).toBeInTheDocument();
  });

  it("adjusts strength when switching noise reduction modes", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        duration: 2.0,
        size: 256000,
        has_video: false,
        waveform: Array(100).fill(0.3),
      }),
    }) as jest.Mock;

    render(<NoiseRemoverWorkspace />);
    const file = new File(["dummy-audio"], "voice.mp3", { type: "audio/mpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("voice.mp3")).toBeInTheDocument();
    });

    const strongModeBtn = screen.getByRole("button", { name: /strong/i });
    fireEvent.click(strongModeBtn);

    const slider = screen.getByRole("slider") as HTMLInputElement;
    expect(slider.value).toBe("85");
  });

  it("toggles advanced settings accordion", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        duration: 2.0,
        size: 256000,
        has_video: false,
        waveform: Array(100).fill(0.3),
      }),
    }) as jest.Mock;

    render(<NoiseRemoverWorkspace />);
    const file = new File(["dummy-audio"], "voice.mp3", { type: "audio/mpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("voice.mp3")).toBeInTheDocument();
    });

    const advancedBtn = screen.getByRole("button", { name: /advanced audio tuning/i });
    fireEvent.click(advancedBtn);

    expect(screen.getByText(/electrical hum removal/i)).toBeInTheDocument();
    expect(screen.getByText(/low-frequency rumble cleanup/i)).toBeInTheDocument();
    expect(screen.getByText(/safe loudness normalization/i)).toBeInTheDocument();
  });

  it("processes audio and displays before/after playback and download button", async () => {
    // 1st call for analyze
    const analyzeResponse = {
      ok: true,
      json: async () => ({
        duration: 3.0,
        size: 500000,
        has_video: false,
        waveform: Array(100).fill(0.5),
      }),
    };

    // 2nd call for process
    const mockHeaders = new Headers({
      "content-type": "audio/mpeg",
      "content-disposition": 'attachment; filename="interview_cleaned.mp3"',
      "x-filename": "interview_cleaned.mp3",
      "x-cleaned-peaks": JSON.stringify(Array(100).fill(0.2)),
    });
    const mockBlob = new Blob(["cleaned-audio"], { type: "audio/mpeg" });

    const processResponse = {
      ok: true,
      headers: mockHeaders,
      blob: async () => mockBlob,
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(analyzeResponse)
      .mockResolvedValueOnce(processResponse) as jest.Mock;

    render(<NoiseRemoverWorkspace />);
    const file = new File(["dummy-audio"], "interview.mp3", { type: "audio/mpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("interview.mp3")).toBeInTheDocument();
    });

    const processBtn = screen.getByRole("button", { name: /remove background noise now/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText(/noise successfully removed/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /download cleaned file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /toggle a\/b/i })).toBeInTheDocument();
  });

  it("resets back to upload dropzone when clicking replace file", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        duration: 1.0,
        size: 100000,
        has_video: false,
        waveform: Array(100).fill(0.2),
      }),
    }) as jest.Mock;

    render(<NoiseRemoverWorkspace />);
    const file = new File(["dummy-audio"], "test.mp3", { type: "audio/mpeg" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("test.mp3")).toBeInTheDocument();
    });

    const replaceBtn = screen.getByRole("button", { name: /replace file/i });
    fireEvent.click(replaceBtn);

    expect(screen.getByText(/upload audio or video to clean/i)).toBeInTheDocument();
  });
});

