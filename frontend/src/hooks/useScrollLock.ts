import { useEffect } from 'react';

// Shared by every overlay: the page only unlocks when the last one closes.
let activeLocks = 0;
let previousStyles: { overflow: string; paddingRight: string } | null = null;

function lock() {
  if (activeLocks === 0) {
    const { style } = document.body;
    previousStyles = {
      overflow: style.overflow,
      paddingRight: style.paddingRight,
    };
    // Keep the layout from jumping when the scrollbar disappears.
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    style.overflow = 'hidden';
    if (scrollbarWidth > 0) style.paddingRight = `${scrollbarWidth}px`;
  }
  activeLocks++;
}

function unlock() {
  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0 && previousStyles) {
    document.body.style.overflow = previousStyles.overflow;
    document.body.style.paddingRight = previousStyles.paddingRight;
    previousStyles = null;
  }
}

/** Stops the page behind an overlay from scrolling while `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return unlock;
  }, [active]);
}
