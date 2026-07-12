import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryPanel } from './HistoryPanel';

describe('HistoryPanel needs-review safety', () => {
  it('renders incomplete legacy records with fallbacks and disables unsafe deletion', () => {
    const incomplete = { id: 'incomplete-record', migrationState: 'needs-review' };
    const primitiveWrapper = { legacyValue: 123, migrationState: 'needs-review' };
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<HistoryPanel
      sessions={[incomplete, primitiveWrapper] as never}
      onClose={vi.fn()}
      onOpen={onOpen}
      onDelete={onDelete}
    />);

    expect(screen.getAllByText('旧记录（字段不完整）')).toHaveLength(2);
    expect(screen.getAllByText('需要人工复核')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^删除：/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /旧记录/ })[0]);
    expect(onOpen).toHaveBeenCalledWith(incomplete);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
