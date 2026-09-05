import { useEffect, useRef } from 'react';

const dialogs: HTMLElement[] = [];
const background = new Map<HTMLElement, boolean>();

function syncBackground() {
  for (const [element, wasInert] of background) element.inert = wasInert;
  background.clear();
  let current = dialogs.at(-1);
  while (current?.parentElement) {
    for (const sibling of current.parentElement.children) {
      if (!(sibling instanceof HTMLElement) || sibling === current || /^(SCRIPT|STYLE)$/.test(sibling.tagName)) continue;
      background.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    current = current.parentElement;
    if (current === document.body) break;
  }
}

function focusable(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]')]
    .filter((element) => {
      if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden]')) return false;
      let current: HTMLElement | null = element;
      while (current && current !== dialog) {
        if (current.inert) return false;
        const style = window.getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (current.parentElement instanceof HTMLDetailsElement && !current.parentElement.open && current.tagName !== 'SUMMARY') return false;
        current = current.parentElement;
      }
      return true;
    });
}

/** Keeps nested modal focus and background interaction under one ownership stack. */
export function useModalDialog<T extends HTMLElement = HTMLElement>(onClose: () => void, closeDisabled = false) {
  const ref = useRef<T>(null);
  const options = useRef({ onClose, closeDisabled });
  options.current = { onClose, closeDisabled };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogs.push(dialog);
    syncBackground();
    const focusFirst = () => (focusable(dialog)[0] || dialog).focus({ preventScroll: true });
    focusFirst();

    const keydown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== dialog || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!options.current.closeDisabled) options.current.onClose();
      } else if (event.key === 'Tab') {
        const elements = focusable(dialog);
        const first = elements[0];
        const last = elements.at(-1);
        if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
        const active = document.activeElement;
        if (!dialog.contains(active) || (event.shiftKey ? active === first || active === dialog : active === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    const focusin = (event: FocusEvent) => {
      if (dialogs.at(-1) === dialog && event.target instanceof Node && !dialog.contains(event.target)) focusFirst();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', focusin);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('focusin', focusin);
      const wasTop = dialogs.at(-1) === dialog;
      dialogs.splice(dialogs.indexOf(dialog), 1);
      syncBackground();
      if (wasTop && previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    };
  }, []);

  return ref;
}
