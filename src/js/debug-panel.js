/**
 * @file
 * Debug Panel - Portable development tools overlay
 *
 * A standalone debug panel that can be dropped into any project.
 * Features: Grid overlay, breakpoint indicators, container debugger.
 *
 * Usage:
 *   import { init } from './debug-panel.js';
 *   init(); // or init('#custom-container')
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // The element to mount the debug panel on (appended as last child)
  ROOT_CONTAINER: 'Page',

  // Feature toggles - disable features not needed for your project
  FEATURES: {
    gridDebugger: true,       // Requires .grid-container/.grid-layout classes
    breakpointIndicator: true,
    containerDebugger: true,
  },

  // Storage keys for persisting toggle states
  STORAGE_KEYS: {
    grid: 'debugGridVisible',
    containers: 'debugContainersVisible',
    breakpoints: 'debugBreakpointsVisible',
  },

  // Breakpoints in rem (Tailwind defaults)
  BREAKPOINTS: [
    { name: 'sm', min: 40 },
    { name: 'md', min: 48 },
    { name: 'lg', min: 64 },
    { name: 'xl', min: 80 },
    { name: '2xl', min: 96 },
  ],
};

// =============================================================================
// STYLES
// =============================================================================

const STYLES = `
/* Debug panel popup */
.debug-panel-wrapper {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
  z-index: 9999;
}

#debug-panel-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: hsl(220 14% 10%);
  color: hsl(220 14% 90%);
  font-size: 0.75rem;
  font-family: ui-monospace, monospace;
  border: none;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px hsla(0, 0%, 0%, 0.3);
  opacity: 0.8;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

#debug-panel-btn:hover {
  opacity: 1;
}

#debug-popup {
  position: absolute;
  inset-block-end: calc(100% + 0.5rem);
  inset-inline-end: 0;
  min-inline-size: 12rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background-color: hsl(220 14% 10%);
  color: hsl(220 14% 90%);
  font-size: 0.75rem;
  font-family: ui-monospace, monospace;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px hsla(0, 0%, 0%, 0.3);
  opacity: 0;
  visibility: hidden;
  transform: translateY(0.5rem);
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
}

#debug-popup.is-open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.debug-popup-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.debug-popup-item label {
  cursor: pointer;
  user-select: none;
}

.debug-toggle {
  inline-size: 1rem;
  block-size: 1rem;
  accent-color: hsl(142 70% 50%);
  cursor: pointer;
}

@keyframes debug-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.debug-pulse-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  background: hsl(142 70% 50%);
  border-radius: 50%;
  animation: debug-pulse 2s infinite;
}

/* Container debugger - visualize overflow and layout */
.debugger *:not(.debug-panel-wrapper, .debug-panel-wrapper *) {
  --debugger-semi-transparent: hsla(330, 100%, 71%, 0.7);
  --debugger-transparent: hsla(330, 100%, 71%, 0.2);
  --debugger-text: rgb(0, 0, 0);
  background: var(--debugger-transparent) !important;
  background-color: var(--debugger-transparent) !important;
  color: var(--debugger-text) !important;
  outline: 2px solid oklch(69.71% 0.401 330.87);
}

/* Grid Lines Overlay */
#responsiveGridLines {
  position: absolute;
  inset: 0;
  block-size: 100%;
  inline-size: 100%;
  pointer-events: none;
  border-block: 1px dashed hsla(326, 100%, 73%, 0.5);
}

#responsiveGridLines .debug-grid-cell {
  display: block;
  width: 100%;
  background-color: hsla(326, 100%, 73%, 0.1);
  border-inline: 1px dashed hsla(326, 100%, 73%, 0.5);
  block-size: 100%;
}

/* Responsive column hiding via media queries (matches grid-layout.css breakpoints) */
@media (max-width: 39.9375rem) {
  #responsiveGridLines #cell-2,
  #responsiveGridLines #cell-3,
  #responsiveGridLines #cell-4,
  #responsiveGridLines #cell-5,
  #responsiveGridLines #cell-6,
  #responsiveGridLines #cell-7,
  #responsiveGridLines #cell-8,
  #responsiveGridLines #cell-9,
  #responsiveGridLines #cell-10,
  #responsiveGridLines #cell-11,
  #responsiveGridLines #cell-12 {
    display: none;
  }
}

@media (min-width: 40rem) and (max-width: 47.9375rem) {
  #responsiveGridLines #cell-5,
  #responsiveGridLines #cell-6,
  #responsiveGridLines #cell-7,
  #responsiveGridLines #cell-8,
  #responsiveGridLines #cell-9,
  #responsiveGridLines #cell-10,
  #responsiveGridLines #cell-11,
  #responsiveGridLines #cell-12 {
    display: none;
  }
}

@media (min-width: 48rem) and (max-width: 79.9375rem) {
  #responsiveGridLines #cell-9,
  #responsiveGridLines #cell-10,
  #responsiveGridLines #cell-11,
  #responsiveGridLines #cell-12 {
    display: none;
  }
}

#responsiveGridLines[data-visible="false"] {
  display: none;
}

#responsiveGridLines[data-visible="true"] {
  display: grid;
}

/* Breakpoint Indicators */
#twMediaQueries {
  --_breakpoint-sm: 40rem;
  --_breakpoint-md: 48rem;
  --_breakpoint-lg: 64rem;
  --_breakpoint-xl: 80rem;
  --_breakpoint-2xl: 96rem;

  --_label-sm: "sm";
  --_label-md: "md";
  --_label-lg: "lg";
  --_label-xl: "xl";
  --_label-2xl: "2xl";

  position: absolute;
  inset: 0;
  block-size: 100%;
  inline-size: 100%;
  pointer-events: none;
  container-type: inline-size;
  container-name: twMediaQueries;
}

#twMediaQueries #tw-sm,
#twMediaQueries #tw-md,
#twMediaQueries #tw-lg,
#twMediaQueries #tw-xl,
#twMediaQueries #tw-2xl {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  z-index: 101;
  pointer-events: none;
  margin-inline: auto;
  border-inline: 1px dashed rgb(136, 66, 211);
}

#twMediaQueries #tw-sm::after,
#twMediaQueries #tw-md::after,
#twMediaQueries #tw-lg::after,
#twMediaQueries #tw-xl::after,
#twMediaQueries #tw-2xl::after {
  position: absolute;
  inset-inline-start: 4px;
  font-size: 8px;
  font-weight: 400;
  font-family: monospace;
  padding: 0 7px;
  border-radius: 10px;
  background-color: rgb(136, 66, 211);
  color: rgb(250, 250, 250);
  z-index: 999999;
}

#twMediaQueries #tw-2xl {
  max-inline-size: var(--_breakpoint-2xl);
}
#twMediaQueries #tw-2xl::after {
  content: var(--_label-2xl);
  inset-block-start: 27vh;
}

#twMediaQueries #tw-xl {
  max-inline-size: var(--_breakpoint-xl);
}
#twMediaQueries #tw-xl::after {
  content: var(--_label-xl);
  inset-block-start: 29vh;
}

#twMediaQueries #tw-lg {
  max-inline-size: var(--_breakpoint-lg);
}
#twMediaQueries #tw-lg::after {
  content: var(--_label-lg);
  inset-block-start: 31vh;
}

#twMediaQueries #tw-md {
  max-inline-size: var(--_breakpoint-md);
}
#twMediaQueries #tw-md::after {
  content: var(--_label-md);
  inset-block-start: 33vh;
}

#twMediaQueries #tw-sm {
  max-inline-size: var(--_breakpoint-sm);
}
#twMediaQueries #tw-sm::after {
  content: var(--_label-sm);
  inset-block-start: 35vh;
}

#twBreakpointBadge {
  position: absolute;
  inset-block-start: 0.5rem;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  z-index: 999999999999;
  padding: 0.25rem 0.75rem;
  font-size: 0.625rem;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  background-color: rgb(136, 66, 211);
  color: rgb(250, 250, 250);
  border-radius: 0.5rem;
  pointer-events: none;
  letter-spacing: 0.025em;
}

#twMediaQueries[data-visible="false"] {
  display: none;
}

#twMediaQueries[data-visible="true"] {
  display: block;
}
`;

// =============================================================================
// HTML TEMPLATES
// =============================================================================

function buildPanelTemplate() {
  const { FEATURES } = CONFIG;

  const gridToggle = FEATURES.gridDebugger
    ? `<div class="debug-popup-item">
        <input type="checkbox" id="debug-grid-toggle" class="debug-toggle">
        <label for="debug-grid-toggle">Show Grid Lines</label>
      </div>`
    : '';

  const breakpointToggle = FEATURES.breakpointIndicator
    ? `<div class="debug-popup-item">
        <input type="checkbox" id="debug-breakpoints-toggle" class="debug-toggle">
        <label for="debug-breakpoints-toggle">Show Breakpoints</label>
      </div>`
    : '';

  const containerToggle = FEATURES.containerDebugger
    ? `<div class="debug-popup-item">
        <input type="checkbox" id="debug-containers-toggle" class="debug-toggle">
        <label for="debug-containers-toggle">Debug Containers</label>
      </div>`
    : '';

  return `
    <div class="debug-panel-wrapper">
      <div id="debug-popup">
        ${gridToggle}
        ${breakpointToggle}
        ${containerToggle}
      </div>
      <button id="debug-panel-btn" type="button">
        <span class="debug-pulse-dot"></span>
        <span>DEV MODE</span>
      </button>
    </div>
  `;
}

function buildGridLinesTemplate() {
  if (!CONFIG.FEATURES.gridDebugger) return '';

  const cells = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    return `<span id="cell-${num}" class="debug-grid-cell"></span>`;
  }).join('\n    ');

  return `
    <div id="responsiveGridLines" class="grid-container" data-visible="false">
      <div class="grid-container-main grid-layout">
        ${cells}
      </div>
    </div>
  `;
}

function buildBreakpointsTemplate() {
  if (!CONFIG.FEATURES.breakpointIndicator) return '';

  return `
    <div id="twMediaQueries" data-visible="false">
      <span id="twBreakpointBadge"></span>
      <span id="tw-2xl"></span>
      <span id="tw-xl"></span>
      <span id="tw-lg"></span>
      <span id="tw-md"></span>
      <span id="tw-sm"></span>
    </div>
  `;
}

// =============================================================================
// CORE LOGIC
// =============================================================================

function getStorageValue(key) {
  return sessionStorage.getItem(key) === 'true';
}

function setStorageValue(key, value) {
  sessionStorage.setItem(key, value ? 'true' : 'false');
}

function applyGridVisibility(visible) {
  const gridContainer = document.getElementById('responsiveGridLines');
  const checkbox = document.getElementById('debug-grid-toggle');
  if (gridContainer) {
    gridContainer.setAttribute('data-visible', visible ? 'true' : 'false');
  }
  if (checkbox) {
    checkbox.checked = visible;
  }
}

function applyContainersDebug(visible) {
  document.querySelector('.' + CONFIG.ROOT_CONTAINER)?.classList.toggle('debugger', visible);
  const checkbox = document.getElementById('debug-containers-toggle');
  if (checkbox) checkbox.checked = visible;
}

function applyBreakpointsVisibility(visible) {
  const mediaQueries = document.getElementById('twMediaQueries');
  const checkbox = document.getElementById('debug-breakpoints-toggle');
  if (mediaQueries) {
    mediaQueries.setAttribute('data-visible', visible ? 'true' : 'false');
  }
  if (checkbox) {
    checkbox.checked = visible;
  }
  if (visible) {
    updateCurrentBreakpoint();
  }
}

function getCurrentBreakpoint() {
  const container = document.getElementById('twMediaQueries');
  if (!container) return { name: 'sm', widthPx: 0, widthRem: '0' };

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const containerWidthPx = container.offsetWidth;
  const containerWidthRem = containerWidthPx / rootFontSize;

  // Show which breakpoint range we're in:
  // Below 40rem → "sm" (mobile base, heading toward sm)
  // 40-47.99rem → "md" (passed sm, heading toward md)
  // 48-63.99rem → "lg"
  // 64-79.99rem → "xl"
  // 80-95.99rem → "2xl"
  // 96rem+ → "2xl"
  const breakpoints = CONFIG.BREAKPOINTS;
  
  // Find the first breakpoint we haven't reached yet
  for (let i = 0; i < breakpoints.length; i++) {
    if (containerWidthRem < breakpoints[i].min) {
      return { name: breakpoints[i].name, widthPx: containerWidthPx, widthRem: containerWidthRem.toFixed(2) };
    }
  }
  // At or above the largest breakpoint
  return { name: '> 2xl', widthPx: containerWidthPx, widthRem: containerWidthRem.toFixed(2) };
}

function updateCurrentBreakpoint() {
  const badge = document.getElementById('twBreakpointBadge');
  if (!badge) return;

  const { name, widthPx, widthRem } = getCurrentBreakpoint();
  badge.textContent = `${name} (${widthRem}rem / ${widthPx}px)`;
}

let containerResizeObserver = null;

function setupContainerResizeObserver() {
  const container = document.getElementById('twMediaQueries');
  if (!container || containerResizeObserver) return;

  containerResizeObserver = new ResizeObserver(function () {
    if (getStorageValue(CONFIG.STORAGE_KEYS.breakpoints)) {
      updateCurrentBreakpoint();
    }
  });
  containerResizeObserver.observe(container);
}

function togglePopup() {
  const popup = document.getElementById('debug-popup');
  if (popup) {
    popup.classList.toggle('is-open');
  }
}

function setupEventListeners() {
  const { FEATURES, STORAGE_KEYS } = CONFIG;

  // Button click toggles popup
  const btn = document.getElementById('debug-panel-btn');
  if (btn) {
    btn.addEventListener('click', togglePopup);
  }

  // Grid toggle
  if (FEATURES.gridDebugger) {
    const gridCheckbox = document.getElementById('debug-grid-toggle');
    if (gridCheckbox) {
      gridCheckbox.addEventListener('change', function () {
        setStorageValue(STORAGE_KEYS.grid, this.checked);
        applyGridVisibility(this.checked);
      });
    }
  }

  // Containers toggle
  if (FEATURES.containerDebugger) {
    const containersCheckbox = document.getElementById('debug-containers-toggle');
    if (containersCheckbox) {
      containersCheckbox.addEventListener('change', function () {
        setStorageValue(STORAGE_KEYS.containers, this.checked);
        applyContainersDebug(this.checked);
      });
    }
  }

  // Breakpoints toggle
  if (FEATURES.breakpointIndicator) {
    const breakpointsCheckbox = document.getElementById('debug-breakpoints-toggle');
    if (breakpointsCheckbox) {
      breakpointsCheckbox.addEventListener('change', function () {
        setStorageValue(STORAGE_KEYS.breakpoints, this.checked);
        applyBreakpointsVisibility(this.checked);
      });
    }

    // Setup ResizeObserver for badge updates
    setupContainerResizeObserver();
  }
}

function applyInitialState() {
  const { FEATURES, STORAGE_KEYS } = CONFIG;

  if (FEATURES.gridDebugger) {
    applyGridVisibility(getStorageValue(STORAGE_KEYS.grid));
  }
  if (FEATURES.containerDebugger) {
    applyContainersDebug(getStorageValue(STORAGE_KEYS.containers));
  }
  if (FEATURES.breakpointIndicator) {
    applyBreakpointsVisibility(getStorageValue(STORAGE_KEYS.breakpoints));
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the debug panel
 * @param {string} targetSelector - CSS selector for the mount target (default: uses CONFIG.ROOT_CONTAINER)
 */
function init(targetSelector) {
  const selector = targetSelector || '.' + CONFIG.ROOT_CONTAINER;
  const target = document.querySelector(selector);

  if (!target) {
    console.warn(`[Debug Panel] Target element "${selector}" not found`);
    return;
  }

  // Ensure target has a positioning context for absolute overlays.
  // If position is 'static' (default), we set it to 'relative'.
  // If it's something else (absolute, fixed, sticky), it already works but may need manual review.
  const computedPosition = getComputedStyle(target).position;
  if (computedPosition === 'static') {
    target.style.position = 'relative';
    console.log(`[Debug Panel] Set position: relative on "${selector}"`);
  } else if (computedPosition !== 'relative') {
    // absolute, fixed, sticky - these work but might be intentional
    console.warn(
      `[Debug Panel] Target "${selector}" has position: ${computedPosition}. ` +
      `Overlays should work, but verify this is intentional.`
    );
  }

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);

  // Build and inject HTML
  const container = document.createElement('div');
  container.innerHTML = [
    buildPanelTemplate(),
    buildGridLinesTemplate(),
    buildBreakpointsTemplate(),
  ].join('');

  // Append all children to target
  while (container.firstChild) {
    target.appendChild(container.firstChild);
  }

  // Initialize state and listeners
  applyInitialState();
  setupEventListeners();

  console.log('[Debug Panel] Initialized');
}

export { init, CONFIG };
