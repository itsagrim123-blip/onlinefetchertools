import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BackgroundRemoverWorkspace } from '@/components/tools/BackgroundRemoverWorkspace';

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-blob-url');
global.URL.revokeObjectURL = jest.fn();

describe('BackgroundRemoverWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000';
  });

  it('renders upload area with format badges', () => {
    render(<BackgroundRemoverWorkspace />);
    expect(screen.getByText(/upload an image to remove its background/i)).toBeInTheDocument();
    expect(screen.getByText(/jpg · png · webp · heic/i)).toBeInTheDocument();
    expect(screen.getByText(/real ai segmentation/i)).toBeInTheDocument();
  });

  it('shows file details and remove background button when an image is selected', () => {
    render(<BackgroundRemoverWorkspace />);
    const file = new File(['dummy-image-bytes'], 'test-photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload image/i);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('test-photo.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove background/i })).toBeInTheDocument();
    expect(screen.getByText(/edge refinement/i)).toBeInTheDocument();
    expect(screen.getByText(/background fill/i)).toBeInTheDocument();
  });

  it('calls removeImageBackground and displays result with download button', async () => {
    const mockHeaders = new Headers({
      'content-type': 'image/png',
      'content-disposition': 'attachment; filename="test-photo-no-bg.png"',
      'x-filename': 'test-photo-no-bg.png',
      'x-image-width': '800',
      'x-image-height': '600',
    });

    const mockBlob = new Blob(['mock-png-output'], { type: 'image/png' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: mockHeaders,
      blob: async () => mockBlob,
    }) as jest.Mock;

    render(<BackgroundRemoverWorkspace />);
    const file = new File(['dummy-image-bytes'], 'test-photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload image/i);
    fireEvent.change(input, { target: { files: [file] } });

    const processBtn = screen.getByRole('button', { name: /remove background/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByText(/background removed successfully!/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /download png/i })).toBeInTheDocument();
    expect(screen.getByText(/test-photo-no-bg\.png/i)).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('displays error alert when API call fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Image dimensions exceed the maximum allowed limit' }),
    }) as jest.Mock;

    render(<BackgroundRemoverWorkspace />);
    const file = new File(['dummy-image-bytes'], 'oversized.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload image/i);
    fireEvent.change(input, { target: { files: [file] } });

    const processBtn = screen.getByRole('button', { name: /remove background/i });
    fireEvent.click(processBtn);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Image dimensions exceed the maximum allowed limit'
    );
  });

  it('resets back to upload dropzone when clicking choose another', () => {
    render(<BackgroundRemoverWorkspace />);
    const file = new File(['dummy-image-bytes'], 'test-photo.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload image/i);
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('test-photo.jpg')).toBeInTheDocument();

    const chooseAnotherBtn = screen.getByRole('button', { name: /choose another/i });
    fireEvent.click(chooseAnotherBtn);

    expect(screen.getByText(/upload an image to remove its background/i)).toBeInTheDocument();
  });
});

