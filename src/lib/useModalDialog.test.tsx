import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useModalDialog } from './useModalDialog';

function Dialog({ onClose, busy = false }: { onClose(): void; busy?: boolean }) {
  const ref = useModalDialog<HTMLDivElement>(onClose, busy);
  return <div ref={ref} role="dialog" tabIndex={-1}><button onClick={onClose}>关闭</button><details><summary>高级</summary><input aria-label="隐藏输入" /></details><button>末项</button></div>;
}

describe('modal keyboard ownership', () => {
  it('moves focus inside, loops around hidden controls and restores the trigger', () => {
    function Harness() { const [open, setOpen] = useState(false); return <><button onClick={() => setOpen(true)}>打开</button>{open ? <Dialog onClose={() => setOpen(false)} /> : null}</>; }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '打开' });
    trigger.focus(); fireEvent.click(trigger);
    const first = screen.getByRole('button', { name: '关闭' });
    const last = screen.getByRole('button', { name: '末项' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('does not close a busy dialog or let Escape reach a parent modal', () => {
    const parentClose = vi.fn(); const childClose = vi.fn();
    const parent = render(<Dialog onClose={parentClose} />);
    const child = render(<Dialog onClose={childClose} busy />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(parentClose).not.toHaveBeenCalled(); expect(childClose).not.toHaveBeenCalled();
    child.unmount();
    expect(parent.container.querySelector('button')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(parentClose).toHaveBeenCalledOnce();
  });
});
