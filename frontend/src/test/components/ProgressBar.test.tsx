import { describe, it, expect } from 'vitest';
import { render, screen } from '../utils';
import ProgressBar from '../../components/common/ProgressBar';

describe('ProgressBar Component', () => {
  it('renders with default props', () => {
    render(<ProgressBar current={0} total={10} />);
    // Component shows "Step X of Y" text
    expect(screen.getByText(/Step 1 of 10/)).toBeInTheDocument();
  });

  it('shows correct progress percentage', () => {
    render(<ProgressBar current={5} total={10} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('shows 0% when current is 0', () => {
    render(<ProgressBar current={0} total={10} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% when current equals total', () => {
    render(<ProgressBar current={10} total={10} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles edge case when total is 0', () => {
    render(<ProgressBar current={0} total={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('displays step indicator when showSteps is true (default)', () => {
    render(<ProgressBar current={3} total={10} />);
    expect(screen.getByText(/Step 4 of 10/)).toBeInTheDocument();
  });

  it('hides step indicator when showSteps is false', () => {
    render(<ProgressBar current={3} total={10} showSteps={false} />);
    expect(screen.queryByText(/Step/)).not.toBeInTheDocument();
    expect(screen.queryByText('30%')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProgressBar current={5} total={10} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('shows current step number (1-indexed)', () => {
    render(<ProgressBar current={2} total={5} />);
    // current=2 means steps 0,1 are done, now on step 3 (index 2)
    expect(screen.getByText(/Step 3 of 5/)).toBeInTheDocument();
  });

  it('caps step display at total', () => {
    render(<ProgressBar current={10} total={5} />);
    // Should cap at total
    expect(screen.getByText(/Step 5 of 5/)).toBeInTheDocument();
  });

  it('renders step dots when showSteps is true', () => {
    const { container } = render(<ProgressBar current={2} total={5} />);
    // Should have 5 step dots
    const dots = container.querySelectorAll('.rounded-full.w-3.h-3');
    expect(dots.length).toBe(5);
  });

  it('applies completed style to passed steps', () => {
    const { container } = render(<ProgressBar current={2} total={5} />);
    const dots = container.querySelectorAll('.rounded-full.w-3.h-3');
    // First 2 dots (index 0, 1) should be green (completed)
    expect(dots[0]).toHaveClass('bg-green-500');
    expect(dots[1]).toHaveClass('bg-green-500');
  });

  it('applies current style to active step', () => {
    const { container } = render(<ProgressBar current={2} total={5} />);
    const dots = container.querySelectorAll('.rounded-full.w-3.h-3');
    // Third dot (index 2) should be indigo (current)
    expect(dots[2]).toHaveClass('bg-indigo-500');
  });

  it('applies pending style to future steps', () => {
    const { container } = render(<ProgressBar current={2} total={5} />);
    const dots = container.querySelectorAll('.rounded-full.w-3.h-3');
    // Last 2 dots (index 3, 4) should be gray (pending)
    expect(dots[3]).toHaveClass('bg-gray-300');
    expect(dots[4]).toHaveClass('bg-gray-300');
  });

  it('applies animation class when animated is true (default)', () => {
    const { container } = render(<ProgressBar current={5} total={10} />);
    const progressFill = container.querySelector('.progress-animated');
    expect(progressFill).toBeInTheDocument();
  });

  it('does not apply animation class when animated is false', () => {
    const { container } = render(
      <ProgressBar current={5} total={10} animated={false} />
    );
    const progressFill = container.querySelector('.progress-animated');
    expect(progressFill).not.toBeInTheDocument();
  });
});
