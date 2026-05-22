import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ServiceCard } from '../ServiceCard';
import { FileText } from 'lucide-react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ServiceCard', () => {
  const defaultProps = {
    id: 'test-service',
    title: 'Test Service',
    description: 'This is a test service',
    icon: FileText,
    category: 'fiscal' as const,
    route: '/test',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText('Test Service')).toBeInTheDocument();
    expect(screen.getByText('This is a test service')).toBeInTheDocument();
  });

  it('navigates on click', () => {
    render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith('/test');
  });

  it('shows badge when provided', () => {
    render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} badge="New" />
      </BrowserRouter>
    );

    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('disables when status is disabled', () => {
    render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} status="disabled" />
      </BrowserRouter>
    );

    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card).toHaveAttribute('tabindex', '-1');

    fireEvent.click(card);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('displays metrics when provided', () => {
    const metrics = [
      { label: 'Total', value: '100' },
      { label: 'Growth', value: '+12%', trend: 'up' as const, trendValue: '+12%' },
    ];

    render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} metrics={metrics} />
      </BrowserRouter>
    );

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Growth')).toBeInTheDocument();
  });

  it('renders warning status correctly', () => {
    const { container } = render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} status="warning" />
      </BrowserRouter>
    );

    const card = container.querySelector('[role="button"]');
    expect(card).toHaveClass('border-yellow-300');
  });

  it('renders error status correctly', () => {
    const { container } = render(
      <BrowserRouter>
        <ServiceCard {...defaultProps} status="error" />
      </BrowserRouter>
    );

    const card = container.querySelector('[role="button"]');
    expect(card).toHaveClass('border-red-300');
  });
});
