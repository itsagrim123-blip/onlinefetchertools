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
});
