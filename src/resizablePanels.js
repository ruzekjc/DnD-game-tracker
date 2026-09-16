// src/resizablePanels.js

/**
 * Lets the DM drag the boundaries between panels instead of living with a
 * fixed layout — different tables use this tool differently (some lean
 * heavily on the shop/enemy panel, others barely touch it), so the split
 * shouldn't be one-size-fits-all. Sizes persist per-browser via
 * localStorage; this is a UI preference, not game data, so it deliberately
 * doesn't go through the file-based data layer.
 */

const STORAGE_KEY_SIDEBAR = 'dnd-tracker:sidebar-width';
const STORAGE_KEY_BOTTOM = 'dnd-tracker:bottom-height';

const MIN_SIDEBAR = 260;
const MAX_SIDEBAR = 700;
const MIN_BOTTOM = 160;
const MAX_BOTTOM = 640;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function initResizablePanels() {
  const layout = document.querySelector('.app-layout');
  const vResizer = document.getElementById('resizer-vertical');
  const hResizer = document.getElementById('resizer-horizontal');
  if (!layout) return;

  const savedSidebar = localStorage.getItem(STORAGE_KEY_SIDEBAR);
  const savedBottom = localStorage.getItem(STORAGE_KEY_BOTTOM);
  if (savedSidebar) layout.style.setProperty('--sidebar-width', `${savedSidebar}px`);
  if (savedBottom) layout.style.setProperty('--bottom-height', `${savedBottom}px`);

  if (vResizer) {
    vResizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      let lastWidth = null;

      function onMove(moveEvent) {
        const rect = layout.getBoundingClientRect();
        lastWidth = clamp(rect.right - moveEvent.clientX, MIN_SIDEBAR, MAX_SIDEBAR);
        layout.style.setProperty('--sidebar-width', `${lastWidth}px`);
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (lastWidth !== null) localStorage.setItem(STORAGE_KEY_SIDEBAR, String(lastWidth));
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  if (hResizer) {
    hResizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      let lastHeight = null;

      function onMove(moveEvent) {
        const rect = layout.getBoundingClientRect();
        lastHeight = clamp(rect.bottom - moveEvent.clientY, MIN_BOTTOM, MAX_BOTTOM);
        layout.style.setProperty('--bottom-height', `${lastHeight}px`);
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (lastHeight !== null) localStorage.setItem(STORAGE_KEY_BOTTOM, String(lastHeight));
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
}
