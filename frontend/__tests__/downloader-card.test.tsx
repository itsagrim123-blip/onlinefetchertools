import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DownloaderCard } from '@/components/DownloaderCard';

describe('DownloaderCard', () => {
  it('renders the URL input and analysis trigger', () => {
    render(<DownloaderCard />);
    expect(screen.getByLabelText(/video url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('shows a loading state when analysis starts', async () => {
    render(<DownloaderCard />);
    const input = screen.getByLabelText(/video url/i);
    const button = screen.getByRole('button', { name: /analyze/i });

    fireEvent.change(input, { target: { value: 'https://example.com/video' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
    });
  });

  it('shows the backend error instead of a generic fetch message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Video unavailable' }),
    }) as jest.Mock;

    render(<DownloaderCard />);
    fireEvent.change(screen.getByLabelText(/video url/i), { target: { value: 'https://youtu.be/abc123' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Video unavailable');
  });
});
