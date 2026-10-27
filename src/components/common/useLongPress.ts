import { useRef, type MouseEvent } from 'react';

const LONG_PRESS_MS = 500;

/**
 * Handlers for a 500 ms long-press (touch or mouse). Right-click does the same. The click
 * that ends a long-press is swallowed, so it does not also tap.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fired = useRef(false);
  const cancel = () => clearTimeout(timer.current);

  return {
    onPointerDown: () => {
      fired.current = false;
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel, // fires when the touch turns into a scroll
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
