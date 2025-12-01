// API endpoint is relative to the current page
const API = 'api';
let currentMode = 'timeline';
let currentSelection = null;
let modalData = null;
let allCommits = [];
let currentlyDisplayedCommitHash = null;
let sortState = {
  files: localStorage.getItem('sort_files') || 'recently_modified',
  automations: localStorage.getItem('sort_automations') || 'name_asc',
  scripts: localStorage.getItem('sort_scripts') || 'name_asc'
};

// Keyboard navigation state
let keyboardNav = {
  currentList: null,  // 'commits', 'files', 'automations', 'scripts'
  selectedIndex: -1,
  items: []
};


// Font management
let currentFont = localStorage.getItem('diffFont') || 'System';
const fontOptions = [
  { name: 'System', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
  { name: 'SF Pro', stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { name: 'Roboto', stack: 'Roboto, "Helvetica Neue", sans-serif' },
  { name: 'Segoe UI', stack: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { name: 'Ubuntu', stack: 'Ubuntu, "Segoe UI", sans-serif' },
  { name: 'Helvetica', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { name: 'Arial', stack: 'Arial, "Helvetica Neue", sans-serif' },
  { name: 'Inter', stack: 'Inter, system-ui, -apple-system, sans-serif' }
];

// Font size management
let currentFontSize = localStorage.getItem('diffFontSize') || '13px';
const fontSizeOptions = [
  { name: 'XS', size: '11px' },
  { name: 'S', size: '12px' },
  { name: 'M', size: '13px' },
  { name: 'L', size: '14px' },
  { name: 'XL', size: '16px' }
];

// Diff style management
let currentDiffStyle = localStorage.getItem('diffStyle') || 'style-2';
const diffStyleOptions = [
  { id: 'style-2', name: 'High Contrast', description: 'Bold and bright' },
  { id: 'style-1', name: 'GitHub Classic', description: 'Subtle, clean look' },
  { id: 'style-3', name: 'Modern Gradient', description: 'Contemporary gradients' },
  { id: 'style-4', name: 'Terminal', description: 'Matrix-style monospace' },
  { id: 'style-5', name: 'Neon', description: 'Futuristic accents' },
  { id: 'style-6', name: 'Pastel', description: 'Soft designer theme' },
  { id: 'style-7', name: 'Minimal Border', description: 'Ultra-clean borders' },
  { id: 'style-8', name: 'Split Highlight', description: 'Word-level emphasis' }
];

// Diff view format management
let diffViewFormat = localStorage.getItem('diffViewFormat') || 'split';

// Diff mode management - 'shifted' shows what each version changed, 'standard' is normal
let diffMode = localStorage.getItem('diffMode') || 'shifted';

// Localization
let translations = {};
let currentLanguage = 'en';

async function loadLanguage(lang = 'en') {
  try {
    const response = await fetch(`lang/${lang}.json`);
    if (response.ok) {
      translations = await response.json();
      currentLanguage = lang;
      updateStaticText();
    } else {
      console.error(`Failed to load language: ${lang}`);
    }
  } catch (error) {
    console.error('Error loading language:', error);
  }
}

function t(key, params = {}) {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && value[k]) {
      value = value[k];
    } else {
      return key; // Return key if translation missing
    }
  }

  if (typeof value !== 'string') return key;

  // Replace parameters
  Object.keys(params).forEach(param => {
    value = value.replace(`{${param}}`, params[param]);
  });

  return value;
}

function updateStaticText() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    const translation = t(key);
    if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
      element.placeholder = translation;
    } else {
      element.textContent = translation;
    }
  });

  // Update document title
  document.title = t('app.title');
}

// Load settings from server and localStorage on page load
async function loadSettings() {
  try {
    const response = await fetch(`${API}/runtime-settings`);
    if (response.ok) {
      const data = await response.json();
      const settings = data.settings;

      // Update UI with server settings
      if (settings) {
        // Debounce time
        document.getElementById('debounceTime').value = settings.debounceTime;
        localStorage.setItem('debounceTime', settings.debounceTime);

        // Debounce time unit
        document.getElementById('debounceTimeUnit').value = settings.debounceTimeUnit;
        localStorage.setItem('debounceTimeUnit', settings.debounceTimeUnit);

        // History retention
        document.getElementById('historyRetention').checked = settings.historyRetention;
        localStorage.setItem('historyRetention', settings.historyRetention);

        // Retention type (hardcoded to time now)
        localStorage.setItem('retentionType', 'time');

        // Retention value
        document.getElementById('retentionValue').value = settings.retentionValue;
        localStorage.setItem('retentionValue', settings.retentionValue);

        // Retention unit
        document.getElementById('retentionUnit').value = settings.retentionUnit;
        localStorage.setItem('retentionUnit', settings.retentionUnit);

        // Run cleanup on commit

      }
    }
  } catch (error) {
    console.error('Error loading settings from server:', error);
  }
}

// Load settings from localStorage on page load
window.addEventListener('DOMContentLoaded', async () => {
  // Load language first
  await loadLanguage('en');

  // Load dark mode setting
  // Load dark mode setting
  const darkMode = localStorage.getItem('darkMode');
  const themeLight = document.getElementById('themeLight');
  const themeDark = document.getElementById('themeDark');

  // Default to Dark Mode if not set (null) or explicitly true
  if (darkMode === 'false') {
    document.body.classList.remove('dark-mode');
    if (themeLight) themeLight.checked = true;
  } else {
    document.body.classList.add('dark-mode');
    if (themeDark) themeDark.checked = true;
  }

  // Load settings from server (overrides localStorage defaults)
  await loadSettings();

  // Initialize font
  applyFontToDiffs();
  updateFontButton();
  updateFontSizeButton();


  // Load other settings that are not in runtime settings


  const configFolderPath = localStorage.getItem('configFolderPath');
  if (configFolderPath) {
    document.getElementById('configFolderPath').value = configFolderPath;
  }

  // Initialize the UI state
  handleRetentionToggle();

  const historyRetentionCheckbox = document.getElementById('historyRetention');
  if (historyRetentionCheckbox) {
    historyRetentionCheckbox.addEventListener('change', handleRetentionToggle);
  }

  if (themeLight && themeDark) {
    if (document.body.classList.contains('dark-mode')) {
      themeDark.checked = true;
    } else {
      themeLight.checked = true;
    }
  }

  // Initialize Theme Colors
  const colorPalette = document.getElementById('colorPalette');
  const primaryColorInput = document.getElementById('picassoPrimaryColor');
  const secondaryColorInput = document.getElementById('picassoSecondaryColor');

  // Load saved colors or use defaults
  const savedPrimaryColor = localStorage.getItem('picassoPrimaryColor') || '#c4ba52';
  const savedSecondaryColor = localStorage.getItem('picassoSecondaryColor') || '#00abab';

  primaryColorInput.value = savedPrimaryColor;
  secondaryColorInput.value = savedSecondaryColor;

  // Always apply colors and show palette
  applyPicassoColors(savedPrimaryColor, savedSecondaryColor);
  if (colorPalette) {
    colorPalette.style.display = 'block';
  }

  // Initialize color palettes
  console.log('[App] Initializing color palettes...');
  initializeColorPalettes();
  updatePaletteSelection(savedPrimaryColor, savedSecondaryColor);

  // Add event listeners for color pickers
  primaryColorInput.addEventListener('input', function () {
    const primaryColor = this.value;
    const secondaryColor = secondaryColorInput.value;
    console.log('[Picasso] Primary changed:', primaryColor, 'Secondary is:', secondaryColor);
    localStorage.setItem('picassoPrimaryColor', primaryColor);
    applyPicassoColors(primaryColor, secondaryColor);
  });

  secondaryColorInput.addEventListener('input', function () {
    const primaryColor = primaryColorInput.value;
    const secondaryColor = this.value;
    console.log('[Picasso] Secondary changed:', secondaryColor, 'Primary is:', primaryColor);
    localStorage.setItem('picassoSecondaryColor', secondaryColor);
    applyPicassoColors(primaryColor, secondaryColor);
  });



  // Load diff view format setting (radio buttons)
  const diffViewSplit = document.getElementById('diffViewSplit');
  const diffViewUnified = document.getElementById('diffViewUnified');
  if (diffViewSplit && diffViewUnified) {
    if (diffViewFormat === 'split') {
      diffViewSplit.checked = true;
    } else {
      diffViewUnified.checked = true;
    }
  }

  // Load diff mode setting (checkbox toggle)
  const diffModeShifted = document.getElementById('diffModeShifted');
  if (diffModeShifted) {
    diffModeShifted.checked = (diffMode === 'shifted');
  }

  // Load diff style setting
  const diffStyleSelect = document.getElementById('diffStyle');
  if (diffStyleSelect) {
    diffStyleSelect.value = currentDiffStyle;
  }

  // Add keyboard navigation
  document.addEventListener('keydown', handleKeyboardNavigation);

  // Inject diff styling for rounded corners
  injectDiffStyle();
  injectDarkModeButtonStyles();
  injectLightModeButtonStyles();
  injectSelectedColorStyle();
  injectHoverStyles();

  // Initialize the view
  switchMode(currentMode);
});

function injectDiffStyle() {
  const styleId = 'diff-corner-style';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = `
        .diff-view-container,
        .unified-diff {
          border-radius: 8px;
          overflow: hidden;
        }
        
        /* Default: no rounded corners for inner elements */
        .diff-view-container > *,
        .unified-diff > * {
          border-radius: 0;
        }

        /* Round top corners of first element */
        .diff-view-container > :first-child,
        .unified-diff > :first-child {
          border-top-left-radius: 8px;
          border-top-right-radius: 8px;
        }

        /* Round bottom corners of last element */
        .diff-view-container > :last-child,
        .unified-diff > :last-child {
          border-bottom-left-radius: 8px;
          border-bottom-right-radius: 8px;
        }
      `;
}

function setTheme(theme) {
  const isDark = theme === 'dark';
  if (isDark) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
  }

  // Update button styles
  const darkModeStyle = document.getElementById('dark-mode-button-style');
  const lightModeStyle = document.getElementById('light-mode-button-style');
  const hoverStyle = document.getElementById('hover-style');

  if (darkModeStyle) darkModeStyle.remove();
  if (lightModeStyle) lightModeStyle.remove();
  if (hoverStyle) hoverStyle.remove();

  injectDarkModeButtonStyles();
  injectLightModeButtonStyles();
  injectHoverStyles();

  // Re-apply Picasso colors if needed (for dark mode overrides)
  const primaryColor = document.getElementById('picassoPrimaryColor').value;
  const secondaryColor = document.getElementById('picassoSecondaryColor').value;
  applyPicassoColors(primaryColor, secondaryColor);
}


function injectDarkModeButtonStyles() {
  const styleId = 'dark-mode-button-style';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = `
    body.dark-mode .file-history-actions .btn:not(:disabled) {
      background: #363636 !important;
      background-color: #363636 !important;
      color: #666666 !important;
    }
  `;
}

function injectLightModeButtonStyles() {
  const styleId = 'light-mode-button-style';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = `
    body:not(.dark-mode) .file-history-actions .btn:not(:disabled) {
      background: white !important;
      background-color: white !important;
      color: #CCCCCC !important;
    }
  `;
}

function injectSelectedColorStyle() {
  const styleId = 'selected-color-style';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = `
    .selected, .keyboard-selected {
      background-color: var(--accent-light) !important;
      color: var(--text-primary);
      border: 1px solid var(--accent-primary) !important;
    }
    .file-name {
      color: var(--text-primary);
    }
  `;
}

function injectHoverStyles() {
  const styleId = 'hover-style';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  const isDarkMode = document.body.classList.contains('dark-mode');
  const hoverColor = isDarkMode ? '#262626' : '#f9f9f9';

  styleElement.textContent = `
    .file:not(.selected):not(.keyboard-selected):hover,
    .commit:not(.selected):not(.keyboard-selected):hover {
      background-color: ${hoverColor} !important;
    }
  `;
}



function applyPicassoColors(primaryColor, secondaryColor) {
  // Debug logging
  console.log('[Picasso Mode] Applying colors:', { primaryColor, secondaryColor });

  // Update CSS variables for accent colors only (not text or borders)
  const root = document.documentElement;

  // Primary color = GREEN (success/restore buttons)
  root.style.setProperty('--success', primaryColor, 'important');
  root.style.setProperty('--success-hover', primaryColor, 'important');
  root.style.setProperty('--success-light', `${primaryColor}40`, 'important');

  // Secondary color = BLUE (accent buttons, toggles, links)
  root.style.setProperty('--accent-primary', secondaryColor, 'important');
  root.style.setProperty('--accent-hover', secondaryColor, 'important');
  root.style.setProperty('--accent-light', `${secondaryColor}40`, 'important');

  // Verify what was set
  console.log('[Picasso Mode] CSS Variables set:', {
    'accent-primary': getComputedStyle(root).getPropertyValue('--accent-primary'),
    'accent-hover': getComputedStyle(root).getPropertyValue('--accent-hover'),
    'success': getComputedStyle(root).getPropertyValue('--success'),
    'success-hover': getComputedStyle(root).getPropertyValue('--success-hover')
  });

  // Also update dark mode specific variables if dark mode is active
  if (document.body.classList.contains('dark-mode')) {
    const darkModeStyle = document.getElementById('picasso-dark-mode-override');
    if (!darkModeStyle) {
      const style = document.createElement('style');
      style.id = 'picasso-dark-mode-override';
      document.head.appendChild(style);
    }
    document.getElementById('picasso-dark-mode-override').textContent = `
      body.dark-mode {
        --accent-primary: ${secondaryColor} !important;
        --accent-hover: ${secondaryColor} !important;
        --accent-light: ${secondaryColor}40 !important;
        --success: ${primaryColor} !important;
        --success-hover: ${primaryColor} !important;
        --success-light: ${primaryColor}40 !important;
      }
    `;
  }
}

function resetToDefaultColors() {
  // Reset to default color values (only accent colors)
  const root = document.documentElement;
  root.style.removeProperty('--accent-primary');
  root.style.removeProperty('--accent-hover');
  root.style.removeProperty('--accent-light');
  root.style.removeProperty('--success');
  root.style.removeProperty('--success-hover');
  root.style.removeProperty('--success-light');

  // Remove dark mode override
  const darkModeStyle = document.getElementById('picasso-dark-mode-override');
  if (darkModeStyle) {
    darkModeStyle.remove();
  }

  // Remove light mode override
  const lightModeStyle = document.getElementById('picasso-light-mode-override');
  if (lightModeStyle) {
    lightModeStyle.remove();
  }
}

function resetPicassoColors() {
  // Reset color pickers to defaults
  const defaultPrimary = '#10b981';
  const defaultSecondary = '#3b82f6';

  document.getElementById('picassoPrimaryColor').value = defaultPrimary;
  document.getElementById('picassoSecondaryColor').value = defaultSecondary;

  localStorage.setItem('picassoPrimaryColor', defaultPrimary);
  localStorage.setItem('picassoSecondaryColor', defaultSecondary);

  applyPicassoColors(defaultPrimary, defaultSecondary);

  // Update palette selection visual state
  updatePaletteSelection(defaultPrimary, defaultSecondary);
}

const PICASSO_PALETTE = [
  { name: 'User 1', primary: '#c4ba52', secondary: '#00abab' },
  { name: 'User 2', primary: '#77bb41', secondary: '#006d8f' },
  { name: 'User 3', primary: '#539eaf', secondary: '#ffb43f' },
  { name: 'User 4', primary: '#10b981', secondary: '#3b82f6' },
  { name: 'Royal', primary: '#4A00E0', secondary: '#8E2DE2' },
  { name: 'Forest', primary: '#16A085', secondary: '#F39C12' },
  { name: 'Ocean', primary: '#2193b0', secondary: '#6dd5ed' }
];

function initializeColorPalettes() {
  const container = document.getElementById('combinedPaletteContainer');
  console.log('[App] initializeColorPalettes called. Container:', container);

  if (!container) {
    console.error('[App] Palette container not found!');
    return;
  }

  container.innerHTML = '';
  console.log('[App] Generating palette items. Count:', PICASSO_PALETTE.length);

  PICASSO_PALETTE.forEach(item => {
    const circle = document.createElement('div');
    circle.className = 'color-circle not-selected';
    // Only set the background gradient inline (dynamic content)
    // Let CSS handle all the circular styling
    // Use explicit color stops for crisp edge
    circle.style.backgroundImage = `linear-gradient(to bottom, ${item.primary} 0%, ${item.primary} 50%, ${item.secondary} 50%, ${item.secondary} 100%)`;
    circle.style.backgroundOrigin = 'border-box';
    circle.style.backgroundRepeat = 'no-repeat';
    circle.style.backgroundSize = '100% 100%';
    circle.dataset.primary = item.primary;
    circle.dataset.secondary = item.secondary;

    circle.onclick = () => {
      const primaryInput = document.getElementById('picassoPrimaryColor');
      const secondaryInput = document.getElementById('picassoSecondaryColor');

      primaryInput.value = item.primary;
      secondaryInput.value = item.secondary;

      // Trigger input events manually
      primaryInput.dispatchEvent(new Event('input'));
      secondaryInput.dispatchEvent(new Event('input'));

      // Update visual selection
      updatePaletteSelection(item.primary, item.secondary);
    };

    container.appendChild(circle);
  });
}

function updatePaletteSelection(primary, secondary) {
  const container = document.getElementById('combinedPaletteContainer');
  if (!container) return;

  // Normalize color for comparison (simple check)
  const normalizeColor = (c) => {
    const d = document.createElement('div');
    d.style.color = c;
    return d.style.color;
  };

  const targetPrimary = normalizeColor(primary);
  const targetSecondary = normalizeColor(secondary);

  Array.from(container.children).forEach(circle => {
    const circlePrimary = normalizeColor(circle.dataset.primary);
    const circleSecondary = normalizeColor(circle.dataset.secondary);

    if (circlePrimary === targetPrimary && circleSecondary === targetSecondary) {
      circle.classList.add('selected');
      circle.classList.remove('not-selected');
    } else {
      circle.classList.remove('selected');
      circle.classList.add('not-selected');
    }
  });
}

// Button position management functions
function updateConfirmRestoreButtonPosition() {
  const button = document.getElementById('floatingConfirmRestore');
  if (button) {
    button.style.bottom = buttonPosition.y + 'px';
    button.style.right = buttonPosition.x + 'px';
    button.style.left = 'auto'; // Reset left to ensure right positioning works
  }
}

function showFloatingConfirmRestoreButton() {
  const button = document.getElementById('floatingConfirmRestore');
  if (button) {
    button.style.display = 'block';
    updateConfirmRestoreButtonPosition();
  }
}

function hideFloatingConfirmRestoreButton() {
  const button = document.getElementById('floatingConfirmRestore');
  if (button) {
    button.style.display = 'none';
  }
}

function moveConfirmRestoreButton(direction) {
  const step = 10; // Move 10px per arrow click
  const maxOffset = 1000; // Maximum offset from edges

  switch (direction) {
    case 'up':
      buttonPosition.y = Math.max(5, buttonPosition.y - step);
      break;
    case 'down':
      buttonPosition.y = Math.min(maxOffset, buttonPosition.y + step);
      break;
    case 'left':
      buttonPosition.x = Math.min(maxOffset, buttonPosition.x + step);
      break;
    case 'right':
      buttonPosition.x = Math.max(5, buttonPosition.x - step);
      break;
  }

  // Save to localStorage
  localStorage.setItem('confirmRestoreBtnX', buttonPosition.x.toString());
  localStorage.setItem('confirmRestoreBtnY', buttonPosition.y.toString());

  // Update button position
  updateConfirmRestoreButtonPosition();

  // Show position info
  // showNotification(`Position: ${buttonPosition.x}px from right, ${buttonPosition.y}px from bottom`, 'success', 1000);
}

function createArrowControls() {
  const arrowControls = document.createElement('div');
  arrowControls.id = 'arrowControls';
  arrowControls.className = 'arrow-controls';
  arrowControls.innerHTML = `
  < div class="arrow-control-title" > Move Button</div >
        <div class="arrow-pad">
          <button class="arrow-btn arrow-up" onclick="moveConfirmRestoreButton('up')" title="Move Up">▲</button>
          <div class="arrow-middle-row">
            <button class="arrow-btn arrow-left" onclick="moveConfirmRestoreButton('left')" title="Move Left">◀</button>
            <button class="arrow-btn arrow-center" disabled>●</button>
            <button class="arrow-btn arrow-right" onclick="moveConfirmRestoreButton('right')" title="Move Right">▶</button>
          </div>
          <button class="arrow-btn arrow-down" onclick="moveConfirmRestoreButton('down')" title="Move Down">▼</button>
        </div>
        <div class="arrow-control-info">
          X: ${buttonPosition.x}px | Y: ${buttonPosition.y}px
        </div>
`;
  document.body.appendChild(arrowControls);
}

// Keyboard navigation functions

function handleKeyboardNavigation(event) {
  // Only handle arrow keys when not typing in an input
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  // Don't navigate if no items available
  if (keyboardNav.items.length === 0) {
    return;
  }

  let newIndex = keyboardNav.selectedIndex;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    // If no selection yet, start at 0, otherwise move down
    newIndex = keyboardNav.selectedIndex < 0 ? 0 : Math.min(keyboardNav.selectedIndex + 1, keyboardNav.items.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    // If no selection yet, start at last item, otherwise move up
    newIndex = keyboardNav.selectedIndex < 0 ? keyboardNav.items.length - 1 : Math.max(keyboardNav.selectedIndex - 1, 0);
  } else if (event.key === 'ArrowRight' && keyboardNav.currentList === 'files') {
    // Right arrow in Files tab - navigate into folder
    event.preventDefault();
    const selectedItem = keyboardNav.items[keyboardNav.selectedIndex];
    if (selectedItem && selectedItem.onclick) {
      const onclickStr = selectedItem.getAttribute('onclick');
      // Check if it's a folder (navigateToPath) vs file (showFileHistory)
      if (onclickStr && onclickStr.includes('navigateToPath')) {
        selectedItem.onclick();
      }
    }
    return;
  } else if (event.key === 'ArrowLeft' && keyboardNav.currentList === 'files') {
    // Left arrow in Files tab - go back up one level
    event.preventDefault();
    if (currentFilePath) {
      // Navigate to parent folder
      const parts = currentFilePath.split('/');
      parts.pop(); // Remove last part
      const parentPath = parts.join('/');
      navigateToPath(parentPath);
    }
    return;
  } else if (event.key === 'Enter' && keyboardNav.selectedIndex >= 0) {
    event.preventDefault();
    // Trigger click on the selected item
    const selectedItem = keyboardNav.items[keyboardNav.selectedIndex];
    if (selectedItem && selectedItem.onclick) {
      // In Files tab, don't navigate into folders with Enter - only show file history
      if (keyboardNav.currentList === 'files') {
        const onclickStr = selectedItem.getAttribute('onclick');
        // Only trigger onclick if it's NOT a folder navigation
        if (onclickStr && !onclickStr.includes('navigateToPath')) {
          selectedItem.onclick();
        }
      } else {
        // For other tabs, trigger onclick normally
        selectedItem.onclick();
      }
    }
    return;
  } else {
    return; // Not an arrow key or Enter
  }

  // Navigate and select the item
  // In Files tab, don't auto-trigger click to avoid auto-navigating into folders
  // In other tabs, trigger click to show content in right panel
  const shouldTriggerClick = keyboardNav.currentList !== 'files';
  selectListItem(newIndex, shouldTriggerClick);
}


function selectListItem(index, triggerClick = false) {
  // Clear previous selection
  if (keyboardNav.selectedIndex >= 0 && keyboardNav.items[keyboardNav.selectedIndex]) {
    keyboardNav.items[keyboardNav.selectedIndex].classList.remove('keyboard-selected');
    // Remove selected class if exists
    keyboardNav.items[keyboardNav.selectedIndex].classList.remove('selected');
  }

  // Update index
  keyboardNav.selectedIndex = index;

  // Apply new selection only if index is valid
  if (index >= 0 && keyboardNav.items[index]) {
    keyboardNav.items[index].classList.add('keyboard-selected');

    // Scroll into view
    keyboardNav.items[index].scrollIntoView({
      block: 'nearest',
      behavior: 'smooth'
    });

    // Trigger click if specified (for arrow key navigation)
    if (triggerClick && keyboardNav.items[index].onclick) {
      keyboardNav.items[index].onclick();
    }
  }
}

function updateKeyboardNavState(listType, items) {
  keyboardNav.currentList = listType;
  keyboardNav.items = items;
  keyboardNav.selectedIndex = -1; // Changed from 0 to -1

  // Remove automatic selection on first item
  // Only apply keyboard-selected class when user actually uses keyboard navigation
}

function clearKeyboardSelection() {
  keyboardNav.items.forEach(item => {
    item.classList.remove('keyboard-selected');
  });
  keyboardNav.selectedIndex = -1;
}

// Font management
function cycleFont() {
  const currentIndex = fontOptions.findIndex(f => f.name === currentFont);
  const nextIndex = (currentIndex + 1) % fontOptions.length;
  currentFont = fontOptions[nextIndex].name;
  localStorage.setItem('diffFont', currentFont);
  updateFontButton();
  applyFontToDiffs();
  // showNotification(`Font: ${currentFont} `, 'success', 1500);
}

function updateFontButton() {
  const button = document.getElementById('fontButton');
  if (button) {
    const currentIndex = fontOptions.findIndex(f => f.name === currentFont);
    const nextIndex = (currentIndex + 1) % fontOptions.length;
    const nextFont = fontOptions[nextIndex].name;
    button.innerHTML = `< span class="font-indicator" > ${currentFont}</span > `;
    button.title = `Current: ${currentFont} (Click to change to: ${nextFont})`;
  }
}

function applyFontToDiffs() {
  const selectedFont = fontOptions.find(f => f.name === currentFont);
  const selectedSize = fontSizeOptions.find(s => s.size === currentFontSize);
  if (selectedFont && selectedSize) {
    // Update all diff-related CSS classes
    const styleId = 'diff-font-style';
    let styleElement = document.getElementById(styleId);
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = `
  .diff - content,
          .diff - column.diff - content,
          .unified - diff.diff - content,
          .diff - view - container {
  font - family: ${selectedFont.stack} !important;
  font - size: ${selectedSize.size} !important;
}
`;
  }
}

// Font size management
function cycleFontSize() {
  const currentIndex = fontSizeOptions.findIndex(s => s.size === currentFontSize);
  const nextIndex = (currentIndex + 1) % fontSizeOptions.length;
  currentFontSize = fontSizeOptions[nextIndex].size;
  localStorage.setItem('diffFontSize', currentFontSize);
  updateFontSizeButton();
  applyFontToDiffs();
  // showNotification(`Font size: ${fontSizeOptions[nextIndex].name} `, 'success', 1500);
}

function updateFontSizeButton() {
  const button = document.getElementById('fontSizeButton');
  if (button) {
    const currentIndex = fontSizeOptions.findIndex(s => s.size === currentFontSize);
    const nextIndex = (currentIndex + 1) % fontSizeOptions.length;
    const nextSize = fontSizeOptions[nextIndex].name;
    button.innerHTML = `<span class="size-indicator">${fontSizeOptions[currentIndex].name}</span>`;
    button.title = `Current: ${fontSizeOptions[currentIndex].name} (Click to change to: ${nextSize})`;
  }
}

// Diff style management
function switchDiffStyle(styleId) {
  currentDiffStyle = styleId;
  localStorage.setItem('diffStyle', styleId);

  // Instantly update the visual style without re-rendering
  const diffShell = document.querySelector('.diff-viewer-shell');
  const bannersGrid = document.querySelector('.diff-banners-grid');

  if (diffShell) {
    // Remove all style classes
    diffStyleOptions.forEach(style => {
      diffShell.classList.remove(style.id);
      if (bannersGrid) {
        bannersGrid.classList.remove(style.id);
      }
    });
    // Add the new style class
    diffShell.classList.add(styleId);
    if (bannersGrid) {
      bannersGrid.classList.add(styleId);
    }
  }

  const styleName = diffStyleOptions.find(s => s.id === styleId)?.name || styleId;
  // showNotification(`Diff style: ${styleName}`, 'success', 1500);
}

function toggleDiffViewFormat(isSplit) {
  const newFormat = isSplit ? 'split' : 'unified';
  diffViewFormat = newFormat;
  localStorage.setItem('diffViewFormat', newFormat);
  // showNotification(`Diff view: ${isSplit ? 'Side-by-Side' : 'Unified'}`, 'success', 1500);

  // Re-render the currently displayed view
  refreshCurrentView();
}

function toggleDiffMode(isChecked) {
  const mode = isChecked ? 'shifted' : 'standard';
  diffMode = mode;
  localStorage.setItem('diffMode', mode);

  // Refresh the current view to apply new diff mode
  refreshCurrentView();
}

function refreshCurrentView() {
  if (!currentSelection) return;

  if (currentSelection.type === 'commit') {
    showCommit(currentSelection.hash);
  } else if (currentSelection.type === 'file') {
    if (currentFileHistory && currentFileHistory.length > 0) {
      displayFileHistory(currentSelection.file);
    } else {
      // No history or unchanged state - need to re-fetch to get content for unchanged view
      showFileHistory(currentSelection.file);
    }
  } else if (currentSelection.type === 'automation') {
    if (currentAutomationHistory && currentAutomationHistory.length > 0) {
      displayAutomationHistory();
    } else {
      showAutomationHistory(currentSelection.id);
    }
  } else if (currentSelection.type === 'script') {
    if (currentScriptHistory && currentScriptHistory.length > 0) {
      displayScriptHistory();
    } else {
      showScriptHistory(currentSelection.id);
    }
  }
}


// Settings modal functions
function openSettings() {
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    const configFolderPathSetting = document.getElementById('configFolderPath').closest('.setting');
    if (configFolderPathSetting) {
      settingsModal.querySelector('.modal-content').prepend(configFolderPathSetting);
    }
  }
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

async function saveSettings() {
  // Get settings values
  const darkMode = document.getElementById('themeDark').checked;
  const debounceTime = document.getElementById('debounceTime').value;
  const debounceTimeUnit = document.getElementById('debounceTimeUnit').value;
  const configFolderPath = document.getElementById('configFolderPath').value;
  const retentionType = 'time'; // Hardcoded as UI option removed
  const retentionValue = document.getElementById('retentionValue').value;
  const retentionUnit = document.getElementById('retentionUnit').value;
  const historyRetention = document.getElementById('historyRetention').checked;
  const diffViewSplit = document.getElementById('diffViewSplit').checked;
  const newDiffViewFormat = diffViewSplit ? 'split' : 'unified';
  const newDiffStyle = document.getElementById('diffStyle').value;

  // Save to localStorage
  localStorage.setItem('darkMode', darkMode);
  localStorage.setItem('debounceTime', debounceTime);
  localStorage.setItem('debounceTimeUnit', debounceTimeUnit);
  localStorage.setItem('configFolderPath', configFolderPath);
  localStorage.setItem('retentionType', retentionType);
  localStorage.setItem('retentionValue', retentionValue);
  localStorage.setItem('retentionUnit', retentionUnit);
  localStorage.setItem('historyRetention', historyRetention);
  localStorage.setItem('diffViewFormat', newDiffViewFormat);
  localStorage.setItem('diffStyle', newDiffStyle);

  // Update the global variables
  diffViewFormat = newDiffViewFormat;
  currentDiffStyle = newDiffStyle;

  // Save to server
  try {
    const response = await fetch(`${API}/runtime-settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        debounceTime,
        debounceTimeUnit,
        historyRetention,
        retentionType,
        retentionValue,
        retentionUnit
      })
    });

    if (response.ok) {
      console.log('Settings saved to server');
      // showNotification(t('app.settings_saved'), 'success', 1500);
    } else {
      console.error('Failed to save settings to server');
      showNotification(t('app.settings_save_error'), 'error', 3000);
    }
  } catch (error) {
    console.error('Error saving settings to server:', error);
    showNotification(t('app.settings_save_error_generic'), 'error', 3000);
  }

  // Re-render current view to apply changes immediately
  refreshCurrentView();

  // Settings saved - close modal
  closeSettings();

  // Update UI state based on new settings
  handleRetentionToggle();
}

function handleRetentionToggle() {
  const historyRetention = document.getElementById('historyRetention');
  const retentionOptions = document.getElementById('retentionOptions');

  if (historyRetention && retentionOptions) {
    retentionOptions.style.display = historyRetention.checked ? 'block' : 'none';
  }
}



function toggleDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const isDark = darkModeToggle.checked;

  if (isDark) {
    document.body.classList.add('dark-mode');
    localStorage.setItem('darkMode', 'true');
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('darkMode', 'false');
  }

  injectHoverStyles();
}

// Date grouping logic
function getDateBucket(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const commitDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (commitDate.getTime() === today.getTime()) {
    return t('date_buckets.today');
  } else if (commitDate.getTime() === yesterday.getTime()) {
    return t('date_buckets.yesterday');
  } else if (date > weekAgo) {
    return t('date_buckets.this_week');
  } else {
    return t('date_buckets.earlier');
  }
}

function groupCommitsByDate(commits) {
  const groups = {};

  commits.forEach(commit => {
    const bucket = getDateBucket(commit.date);
    if (!groups[bucket]) {
      groups[bucket] = [];
    }
    groups[bucket].push(commit);
  });

  return groups;
}

function formatDateDisplay(bucket) {
  if (bucket === t('date_buckets.today')) {
    return t('date_buckets.today');
  } else if (bucket === t('date_buckets.yesterday')) {
    return t('date_buckets.yesterday');
  } else if (bucket === t('date_buckets.this_week')) {
    return t('date_buckets.this_week');
  } else {
    return t('date_buckets.earlier');
  }
}

function formatDateForLabel(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// File path utilities

function parseFilePath(filePath) {
  const parts = filePath.split('/');
  const fileName = parts.pop();
  const directory = parts.join('/');
  return { fileName, directory, parts };
}

function createBreadcrumb(filePath) {
  const { fileName, directory, parts } = parseFilePath(filePath);

  if (!directory) {
    return `<span class="breadcrumb-current">${fileName}</span>`;
  }

  let html = '';

  // Add root config (or first part)
  html += `<span class="breadcrumb-item clickable" onclick="navigateToPath('')">${parts[0]}</span>`;

  // Add intermediate directories
  for (let i = 1; i < parts.length; i++) {
    const pathUpToHere = parts.slice(0, i + 1).join('/');
    html += `<span class="breadcrumb-separator">/</span>`;
    html += `<span class="breadcrumb-item clickable" onclick="navigateToPath('${pathUpToHere}')">${parts[i]}</span>`;
  }

  // Add file name
  html += `<span class="breadcrumb-separator">/</span>`;
  html += `<span class="breadcrumb-current">${fileName}</span>`;

  return html;
}

// Search functionality
let searchTimeout = null;

function handleSearch(event) {
  const query = event.target.value.toLowerCase();
  const clearBtn = document.getElementById('clearBtn');

  if (query) {
    clearBtn.style.display = 'block';
  } else {
    clearBtn.style.display = 'none';
  }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    if (currentMode === 'timeline') {
      await filterCommits(query);
    } else if (currentMode === 'files') {
      filterFiles(query);
    } else if (currentMode === 'automations') {
      filterAutomations(query);
    } else if (currentMode === 'scripts') {
      filterScripts(query);
    }
  }, 300);
}

async function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const searchInfo = document.getElementById('searchInfo');

  searchInput.value = '';
  clearBtn.style.display = 'none';
  searchInfo.textContent = '';

  if (currentMode === 'timeline') {
    await displayCommits(allCommits);
  } else if (currentMode === 'files') {
    displayFileList(allFiles);
  } else if (currentMode === 'automations') {
    displayAutomations(allAutomations);
  } else if (currentMode === 'scripts') {
    displayScripts(allScripts);
  }
}

async function filterCommits(query) {
  if (!query) {
    await displayCommits(allCommits);
    return;
  }

  const filtered = allCommits.filter(commit =>
    commit.message.toLowerCase().includes(query)
  );

  await displayCommits(filtered);
}

function filterFiles(query) {
  if (!query) {
    displayFileList(allFiles);
    return;
  }

  const filtered = allFiles.filter(fileObj => {
    // Handle both string paths (legacy) and object paths (new format)
    const filePath = typeof fileObj === 'string' ? fileObj : fileObj.path;
    return filePath.toLowerCase().includes(query);
  });

  displayFileList(filtered);
}

function filterAutomations(query) {
  if (!query) {
    displayAutomations(allAutomations);
    return;
  }

  const filtered = allAutomations.filter(auto =>
    auto.name.toLowerCase().includes(query) ||
    auto.file.toLowerCase().includes(query)
  );

  displayAutomations(filtered);
}

function filterScripts(query) {
  if (!query) {
    displayScripts(allScripts);
    return;
  }

  const filtered = allScripts.filter(script =>
    script.name.toLowerCase().includes(query) ||
    script.file.toLowerCase().includes(query)
  );

  displayScripts(filtered);
}

function navigateToPath(path) {
  // Navigate to a folder path
  if (!path) {
    // Go back to root
    currentFilePath = '';
    displayFileList(allFiles);
    return;
  }

  // Update current path and display
  currentFilePath = path;
  displayFileList(allFiles);
}

function handleSortChange(value) {
  sortState[currentMode] = value;
  localStorage.setItem(`sort_${currentMode}`, value);

  // Reload current view to apply sort
  if (currentMode === 'files') loadFiles();
  else if (currentMode === 'automations') loadAutomations();
  else if (currentMode === 'scripts') loadScripts();
}

function sortItems(items, sortType) {
  const sorted = [...items];


  switch (sortType) {
    case 'name_asc':
      return sorted.sort((a, b) => {
        const nameA = (a.name || a.path || '').replace(/^\.+/, ''); // Strip leading dots for sorting
        const nameB = (b.name || b.path || '').replace(/^\.+/, ''); // Strip leading dots for sorting
        return nameA.localeCompare(nameB);
      });
    case 'name_desc':
      return sorted.sort((a, b) => {
        const nameA = (a.name || a.path || '').replace(/^\.+/, ''); // Strip leading dots for sorting
        const nameB = (b.name || b.path || '').replace(/^\.+/, ''); // Strip leading dots for sorting
        return nameB.localeCompare(nameA);
      });
    case 'recently_modified':
      return sorted.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    default:
      return sorted;
  }
}

async function switchMode(mode) {
  currentMode = mode;
  currentSelection = null;

  // Hide the floating button when switching modes
  hideFloatingConfirmRestoreButton();

  // Update tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`${mode}Tab`).classList.add('active');

  // Update panel title and show/hide sort controls
  const leftPanelTitle = document.getElementById('leftPanelTitle');
  const leftPanelActions = document.getElementById('leftPanelActions');
  const sortSelect = document.getElementById('sortSelect');
  const rightPanelTitle = document.getElementById('rightPanelTitle');
  const rightPanelActions = document.getElementById('rightPanelActions');

  // Reset right panel actions
  rightPanelActions.innerHTML = '';

  // Show/hide sort controls based on mode
  if (['files', 'automations', 'scripts'].includes(mode)) {
    leftPanelActions.style.display = 'block';

    // Ensure valid sort state for this mode (prevent selecting removed option)
    if ((mode === 'automations' || mode === 'scripts') && sortState[mode] === 'recently_modified') {
      sortState[mode] = 'default';
      localStorage.setItem(`sort_${mode}`, 'default');
    }

    sortSelect.value = sortState[mode];
  } else {
    leftPanelActions.style.display = 'none';
  }

  // Update search bar visibility and placeholder
  const searchContainer = document.getElementById('timelineSearch');
  const searchInput = document.getElementById('searchInput');
  searchContainer.style.display = 'flex';

  if (mode === 'timeline') {
    leftPanelTitle.textContent = t('timeline.title');
    leftPanelTitle.setAttribute('data-i18n', 'timeline.title');
    searchInput.placeholder = t('timeline.search_placeholder');
    searchInput.setAttribute('data-i18n', 'timeline.search_placeholder');
    rightPanelTitle.textContent = t('timeline.files_in_commit');
    rightPanelTitle.setAttribute('data-i18n', 'timeline.files_in_commit');
    await loadTimeline();
  }

  // Handle sort options visibility
  let dateDescOption = sortSelect.querySelector('option[value="recently_modified"]');
  let defaultOption = sortSelect.querySelector('option[value="default"]');

  if (mode === 'automations' || mode === 'scripts') {
    // AUTOMATIONS / SCRIPTS MODE

    // 1. Remove "Recently Modified"
    if (dateDescOption) {
      dateDescOption.remove();
    }

    // 2. Ensure "Default" exists (add back if missing)
    if (!defaultOption) {
      const newOption = document.createElement('option');
      newOption.value = 'default';
      newOption.textContent = t('sort.default');
      newOption.setAttribute('data-i18n', 'sort.default');
      sortSelect.insertBefore(newOption, sortSelect.firstChild);
    }

    // 3. Validate current selection
    // Only force change if the current selection is invalid (recently_modified)
    // We respect 'default', 'name_asc', 'name_desc' if the user chose them
    if (sortSelect.value === 'recently_modified') {
      const newValue = 'name_asc';
      sortSelect.value = newValue;
      sortState[mode] = newValue;
      localStorage.setItem(`sort_${mode}`, newValue);
    }

  } else {
    // FILES MODE (and others)

    // 1. Remove "Default"
    if (defaultOption) {
      defaultOption.remove();
    }

    // 2. Ensure "Recently Modified" exists (add back if missing)
    if (!dateDescOption) {
      const newOption = document.createElement('option');
      newOption.value = 'recently_modified';
      newOption.textContent = t('sort.recently_modified');
      newOption.setAttribute('data-i18n', 'sort.recently_modified');
      sortSelect.appendChild(newOption);
    }

    // 3. Validate current selection
    // Only force change if the current selection is invalid (default)
    // We respect 'recently_modified', 'name_asc', 'name_desc' if the user chose them
    if (sortSelect.value === 'default') {
      const newValue = 'recently_modified';
      sortSelect.value = newValue;
      sortState[mode] = newValue;
      localStorage.setItem(`sort_${mode}`, newValue);
    }
  }

  if (mode === 'files') {
    leftPanelTitle.textContent = t('files.title');
    leftPanelTitle.setAttribute('data-i18n', 'files.title');
    searchInput.placeholder = t('files.search_placeholder');
    searchInput.setAttribute('data-i18n', 'files.search_placeholder');
    rightPanelTitle.textContent = t('files.file_history');
    rightPanelTitle.setAttribute('data-i18n', 'files.file_history');
    await loadFiles();
  } else if (mode === 'automations') {
    leftPanelTitle.textContent = t('automations.title');
    leftPanelTitle.setAttribute('data-i18n', 'automations.title');
    searchInput.placeholder = t('automations.search_placeholder');
    searchInput.setAttribute('data-i18n', 'automations.search_placeholder');
    rightPanelTitle.textContent = t('automations.automation_history');
    rightPanelTitle.setAttribute('data-i18n', 'automations.automation_history');
    await loadAutomations();
  } else if (mode === 'scripts') {
    leftPanelTitle.textContent = t('scripts.title');
    leftPanelTitle.setAttribute('data-i18n', 'scripts.title');
    searchInput.placeholder = t('scripts.search_placeholder');
    searchInput.setAttribute('data-i18n', 'scripts.search_placeholder');
    rightPanelTitle.textContent = t('scripts.script_history');
    rightPanelTitle.setAttribute('data-i18n', 'scripts.script_history');
    await loadScripts();
  }

  // Clear search input when switching modes
  searchInput.value = '';
  const clearBtn = document.getElementById('clearBtn');
  const searchInfo = document.getElementById('searchInfo');
  if (clearBtn) clearBtn.style.display = 'none';
  if (searchInfo) searchInfo.textContent = '';

  // Clear right panel
  let emptyTextKey = `${mode}.select_item`;
  if (mode === 'timeline') {
    emptyTextKey = 'timeline.select_version';
  }
  document.getElementById('rightPanel').innerHTML = `<div class="empty" data-i18n="${emptyTextKey}">${t(emptyTextKey)}</div>`;
  updateStaticText();
}

function refreshCurrent() {
  if (currentMode === 'timeline') {
    loadTimeline();
  } else if (currentMode === 'files') {
    loadFiles();
  } else if (currentMode === 'automations') {
    loadAutomations();
  } else if (currentMode === 'scripts') {
    loadScripts();
  }
}

async function loadTimeline() {
  try {
    const response = await fetch(`${API}/git/history`);
    const data = await response.json();

    if (data.success) {
      allCommits = data.log.all;
      await displayCommits(allCommits);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function hasActualChanges(commit) {
  // Check if commit is a "Startup backup" with 0 files
  if (commit.message.includes('Startup backup') && commit.message.includes('0 files')) {
    return false;
  }

  // Check for "Auto-save" pattern with no actual file changes
  // The API doesn't provide direct info about file changes, so we use heuristics
  // If it's an "Auto-save" commit, we consider it as having changes
  // unless it's specifically marked as having 0 files
  if (commit.message.startsWith('Auto-save:')) {
    return true; // Keep auto-save commits
  }

  // For other commits (restores, manual saves, etc.), assume they have changes
  return true;
}

async function displayCommits(commits) {
  // Get the showChangedOnly setting based on current tab
  // Timeline: false (show all commits), Other tabs: true (show only files with changes)
  const showChangedOnly = currentMode !== 'timeline';

  // Filter commits if the setting is enabled
  let filteredCommits = commits;
  if (showChangedOnly) {
    // Show loading indicator
    document.getElementById('leftPanel').innerHTML = `<div class="empty" data-i18n="timeline.filtering_commits">${t('timeline.filtering_commits')}</div>`;

    // Filter out commits that clearly have no changes
    filteredCommits = commits.filter(commit => {
      // Remove "Startup backup" commits with 0 files
      if (commit.message.includes('Startup backup') && commit.message.includes('0 files')) {
        return false;
      }
      // Keep all other commits (Auto-save, Restore, etc.)
      return true;
    });

    // Now check each commit for actual content changes
    // This is expensive but ensures we only show commits with real changes
    console.log('[Filter] Checking commits for actual changes...');
    const commitsWithChanges = [];

    for (const commit of filteredCommits) {
      try {
        // Fetch commit details to get the list of files
        const response = await fetch(`${API}/git/commit-details?commitHash=${commit.hash}`);
        const data = await response.json();

        if (data.success) {
          // Parse files from status
          const lines = data.status.split('\n').filter(line => line.trim());
          const files = lines.slice(1).map(line => {
            const parts = line.split('\t');
            return { status: parts[0], file: parts[1] };
          }).filter(f => f.file);

          if (files.length === 0) {
            // No files changed, skip this commit
            console.log(`[Filter] Skipping ${commit.hash.substring(0, 8)}: no files`);
            continue;
          }

          // Check if any file has actual content changes
          let hasActualChanges = false;
          for (const file of files.slice(0, 5)) { // Check up to 5 files to limit API calls
            try {
              // Get current file content
              const currentResponse = await fetch(`${API}/file-content?filePath=${encodeURIComponent(file.file)}`);
              const currentData = await currentResponse.json();
              const currentContent = currentData.success ? currentData.content : '';

              // Get commit version content
              const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file.file)}&commitHash=${commit.hash}`);
              const commitData = await commitResponse.json();
              const commitContent = commitData.success ? commitData.content : '';

              // Compare contents
              if (currentContent !== commitContent) {
                hasActualChanges = true;
                break;
              }
            } catch (e) {
              // If we can't check the file, include the commit
              hasActualChanges = true;
              break;
            }
          }

          if (hasActualChanges) {
            commitsWithChanges.push(commit);
            console.log(`[Filter] Keeping ${commit.hash.substring(0, 8)}: has changes`);
          } else {
            console.log(`[Filter] Skipping ${commit.hash.substring(0, 8)}: no actual changes`);
          }
        } else {
          // If we can't get commit details, include it
          commitsWithChanges.push(commit);
        }
      } catch (error) {
        console.error(`[Filter] Error checking commit ${commit.hash}:`, error);
        // If error, include the commit to be safe
        commitsWithChanges.push(commit);
      }
    }

    filteredCommits = commitsWithChanges;
    console.log(`[Filter] Filtered ${commits.length} commits down to ${filteredCommits.length} with changes`);
  }

  const groups = groupCommitsByDate(filteredCommits);

  const buckets = ['Today', 'Yesterday', 'This Week', 'Earlier'];
  let html = '';

  for (const bucket of buckets) {
    if (groups[bucket] && groups[bucket].length > 0) {
      html += `
            <div class="date-group">
              <div class="date-header" onclick="toggleDateGroup('${bucket}')" id="header-${bucket}">
                ${formatDateDisplay(bucket)} (${groups[bucket].length})
              </div>
              <div class="date-content" id="content-${bucket}">
          `;

      for (const commit of groups[bucket]) {
        const commitDate = new Date(commit.date);
        const timeString = commitDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        // Extract just the filename from the commit message
        let fileName = commit.message;

        // Try to extract filename from various commit message formats
        // Pattern 1: "file1.yaml, file2.yaml" (multiple files)
        if (commit.message.includes(',')) {
          // Keep the comma-separated list as-is
          fileName = commit.message;
        }
        // Pattern 2: "Auto-save: automations.yaml - timestamp"
        else if (commit.message.includes(' - ')) {
          const beforeDash = commit.message.split(' - ')[0];
          if (beforeDash.includes(':')) {
            fileName = beforeDash.split(':')[1].trim();
          } else {
            fileName = beforeDash;
          }
        }
        // Pattern 2: "Restore: filename.yaml to hash"
        else if (commit.message.startsWith('Restore: ') && commit.message.includes(' to ')) {
          const afterRestore = commit.message.substring('Restore: '.length);
          const beforeTo = afterRestore.split(' to ')[0];
          fileName = beforeTo.trim();
        }
        // Pattern 3: "Restore automation 'X' in filename.yaml to commit hash"
        else if (commit.message.includes(' in ')) {
          const match = commit.message.match(/ in ([^\s]+\.(yaml|yml|txt|json|py))/i);
          if (match) {
            fileName = match[1];
          }
        }
        // Pattern 4: "Merged history ISO_DATE"
        else if (commit.message.startsWith('Merged history ')) {
          const isoDate = commit.message.substring('Merged history '.length).trim();
          // User requested simple "Merged" text instead of full date
          fileName = 'Merged';
        }
        // Pattern 5: "Startup backup: timestamp (X files)"
        else if (commit.message.includes('(') && commit.message.includes(')')) {
          const match = commit.message.match(/\((\d+) files?\)/);
          if (match) {
            fileName = `${match[1]} files`;
          }
        }

        html += `
              <div class="commit" onclick="showCommit('${commit.hash}')" id="commit-${commit.hash}">
                <div class="commit-time">${timeString}</div>
                <div class="commit-file">${fileName}</div>
              </div>
            `;
      }

      html += `
              </div>
            </div>
          `;
    }
  }

  document.getElementById('leftPanel').innerHTML = html;
  document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('timeline.select_commit')}</div>`;
  document.getElementById('rightPanelActions').innerHTML = '';

  // Update keyboard navigation
  const commitItems = Array.from(document.querySelectorAll('.commit'));
  updateKeyboardNavState('commits', commitItems);

  // Hide the floating button when not viewing a diff
  hideFloatingConfirmRestoreButton();
}

function toggleDateGroup(bucket) {
  const header = document.getElementById(`header-${bucket}`);
  const content = document.getElementById(`content-${bucket}`);

  // Toggle class on parent group for spacing control
  if (header && header.parentElement) {
    header.parentElement.classList.toggle('collapsed');
  }

  header.classList.toggle('collapsed');
  content.classList.toggle('collapsed');
}

async function showCommit(hash) {
  document.querySelectorAll('.commit').forEach(c => c.classList.remove('selected'));
  const element = document.getElementById('commit-' + hash);
  if (element) {
    element.classList.add('selected');
    // Update keyboard navigation index to match clicked item
    const clickedIndex = keyboardNav.items.indexOf(element);
    if (clickedIndex !== -1) {
      keyboardNav.selectedIndex = clickedIndex;
    }
  }
  currentSelection = { type: 'commit', hash };
  currentlyDisplayedCommitHash = hash;

  try {
    // Fetch commit details to get the list of files
    const response = await fetch(`${API}/git/commit-details?commitHash=${hash}`);
    const data = await response.json();

    if (data.success) {
      // Get the actual diff for the commit
      const diffResponse = await fetch(`${API}/git/commit-diff?commitHash=${hash}`);
      const diffData = await diffResponse.json();

      // Set panel title
      const commit = allCommits.find(c => c.hash === hash);
      if (commit && commit.date) {
        document.getElementById('rightPanelTitle').textContent = formatDateForLabel(commit.date);
      } else {
        document.getElementById('rightPanelTitle').textContent = t('timeline.version_title', { hash: hash.substring(0, 8) });
      }

      // Clear actions initially, will be set by displayCommitDiff if there are changes
      document.getElementById('rightPanelActions').innerHTML = '';

      // Get commit date from allCommits
      const commitObj = allCommits.find(c => c.hash === hash);
      const commitDate = commitObj ? commitObj.date : null;

      if (diffData.success) {
        await displayCommitDiff(data.status, hash, diffData.diff, commitDate);
      } else {
        await displayCommitDiff(data.status, hash, t('diff.no_diff_available'), commitDate);
      }

      // Show the floating button when a diff is being viewed
      showFloatingConfirmRestoreButton();


    }
  } catch (error) {
    console.error('Error:', error);
  }
}

function displayFiles(status, hash) {
  const lines = status.split('\n').filter(line => line.trim());
  const files = lines.slice(1).map(line => {
    const parts = line.split('\t');
    return { status: parts[0], file: parts[1] };
  }).filter(f => f.file);

  // Set panel title and clear actions
  document.getElementById('rightPanelTitle').textContent = t('timeline.files_in_version');
  document.getElementById('rightPanelActions').innerHTML = '';

  if (files.length === 0) {
    document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('timeline.no_files_in_commit')}</div>`;
    return;
  }

  const html = files.map(file => `
        <div class="file">
          <div class="file-icon"></div>
          <div class="file-path">
            <div class="file-name">${file.file}</div>
            <div class="file-path-text">${file.status === 'A' ? t('file_status.added') : file.status === 'D' ? t('file_status.deleted') : t('file_status.modified')}</div>
          </div>
          <div>
            <button class="btn" onclick="viewDiff('${file.file}', '${hash}')">View</button>
            <button class="btn restore" onclick="restoreFile('${file.file}', '${hash}')" title="Restore this file to the version from this commit">Restore</button>
          </div>
        </div>
      `).join('');

  document.getElementById('rightPanel').innerHTML = html;
}


async function displayCommitDiff(status, hash, diff, commitDate = null) {
  // Parse files from status
  const lines = status.split('\n').filter(line => line.trim());
  let files = lines.slice(1).map(line => {
    const parts = line.split('\t');
    return { status: parts[0], file: parts[1] };
  }).filter(f => f.file);

  // Sort files alphabetically, ignoring leading dots (so .storage sorts as storage)
  files.sort((a, b) => {
    const nameA = a.file.replace(/^\./, '');
    const nameB = b.file.replace(/^\./, '');
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  // Tab-specific filter: Timeline shows all, others show only changed files
  const showChangedOnly = currentMode !== 'timeline';

  // Determine if we need to use shifted mode for Timeline
  let compareHash = hash; // Default: compare to the commit being viewed
  let isOldestCommit = false;

  if (diffMode === 'shifted') {
    // Find this commit's position in allCommits
    const commitIndex = allCommits.findIndex(c => c.hash === hash);
    isOldestCommit = commitIndex === allCommits.length - 1;

    if (!isOldestCommit && commitIndex !== -1) {
      // Get the next older commit hash
      compareHash = allCommits[commitIndex + 1].hash;
    }
  }

  // For each file, get current content and commit version, then compare
  let allDiffsHtml = '';
  let filesWithChanges = [];
  let filesWithoutChanges = [];

  for (const file of files) {
    try {
      // For oldest commit in shifted mode, don't try to fetch/compare - just show files
      if (diffMode === 'shifted' && isOldestCommit) {
        // Get commit version to display the file
        const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file.file)}&commitHash=${hash}`);
        const commitData = await commitResponse.json();
        let commitContent = commitData.success ? commitData.content : '';

        // Remove filename if present
        if (commitContent.startsWith(file.file)) {
          commitContent = commitContent.substring(commitContent.indexOf('\n') + 1);
        }

        const commitLines = commitContent.split(/\r\n?|\n/);
        filesWithoutChanges.push({ file, commitLines });
        continue;
      }

      // Get current file content
      const currentResponse = await fetch(`${API}/file-content?filePath=${encodeURIComponent(file.file)}`);
      const currentData = await currentResponse.json();
      let currentContent = currentData.success ? currentData.content : '';

      // Get commit version content (use compareHash which may be older commit in shifted mode)
      const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file.file)}&commitHash=${compareHash}`);
      const commitData = await commitResponse.json();
      let commitContent = commitData.success ? commitData.content : '';

      // Workaround: Remove filename from content if present (unexpected behavior from backend)
      const fileName = file.file;
      if (currentContent.startsWith(fileName)) {
        currentContent = currentContent.substring(currentContent.indexOf('\n') + 1);
      }
      if (commitContent.startsWith(fileName)) {
        commitContent = commitContent.substring(commitContent.indexOf('\n') + 1);
      }

      const currentLines = currentContent.split(/\r\n?|\n/);
      const commitLines = commitContent.split(/\r\n?|\n/);

      // Use the new generateDiff function for consistent rendering
      let rightLabel = `Version ${hash.substring(0, 8)}`;
      if (diffMode === 'shifted') {
        rightLabel = `Version ${compareHash.substring(0, 8)}`;
      }

      const diffHtml = generateDiff(currentContent, commitContent, {
        leftLabel: 'Current Version',
        rightLabel: rightLabel,
        bannerText: file.file,
        returnNullIfNoChanges: true,
        filePath: file.file
      });

      // If there's a diff, add it to the changes list
      // Note: generateDiff returns null if returnNullIfNoChanges is true and there are no changes
      if (diffHtml) {
        filesWithChanges.push({ file, diffHtml });
      } else {
        // No diff, but we'll show the full file content
        filesWithoutChanges.push({ file, commitLines });
      }
    } catch (error) {
      console.error(`Error comparing file ${file.file}:`, error);
      showNotification(`Error comparing file ${file.file}: ${error.message}`, 'error');
    }
  }

  // Determine if we need dropdowns (more than one file total)
  const totalFiles = filesWithChanges.length + filesWithoutChanges.length;
  const needsDropdown = totalFiles > 1;
  const shouldCollapse = totalFiles > 3;

  // Process files with changes
  for (const item of filesWithChanges) {
    if (needsDropdown) {
      const expandedClass = shouldCollapse ? '' : 'expanded';
      const displayStyle = shouldCollapse ? 'display: none' : 'display: block';

      allDiffsHtml += `
        <div class="file-diff-section">
          <div class="file-diff-header ${expandedClass}" onclick="toggleFileDiff(this)">
            <span class="file-name">${item.file.file}</span>
          </div>
          <div class="file-diff-content" style="${displayStyle}">
            <div class="diff-view-container">
              ${item.diffHtml}
            </div>
          </div>
        </div>`;
    } else {
      // Single file - no dropdown needed
      allDiffsHtml += `
        <div class="diff-view-container">
          ${item.diffHtml}
        </div>`;
    }
  }

  // Process files without changes (render them with dropdowns too if needed)
  for (const item of filesWithoutChanges) {
    const fullFileHtml = generateFullFileHTML(item.commitLines);
    if (needsDropdown) {
      const expandedClass = shouldCollapse ? '' : 'expanded';
      const displayStyle = shouldCollapse ? 'display: none' : 'display: block';

      allDiffsHtml += `
        <div class="file-diff-section">
          <div class="file-diff-header ${expandedClass}" onclick="toggleFileDiff(this)">
            <span class="file-name">${item.file.file}</span>
          </div>
          <div class="file-diff-content" style="${displayStyle}">
            <div class="diff-view-container">
              <div class="segmented-control" style="cursor: default; grid-template-columns: 1fr;">
                <div class="segmented-control-slider" style="width: calc(100% - 8px);"></div>
                <label style="cursor: default; color: var(--text-primary);">Current Version</label>
              </div>
              <div class="diff-viewer-shell ${currentDiffStyle}">
                <div class="diff-viewer-unified">
                  ${fullFileHtml}
                </div>
              </div>
            </div>
          </div>
        </div>`;
    } else {
      // Single file - no dropdown needed
      allDiffsHtml += `
        <div class="diff-view-container">
          <div class="segmented-control" style="cursor: default; grid-template-columns: 1fr;">
            <div class="segmented-control-slider" style="width: calc(100% - 8px);"></div>
            <label style="cursor: default; color: var(--text-primary);">Current Version</label>
          </div>
          <div class="diff-viewer-shell ${currentDiffStyle}">
            <div class="diff-viewer-unified">
              ${fullFileHtml}
            </div>
          </div>
        </div>`;
    }
  }

  // Create header with file list
  const changedFilesSummary = filesWithChanges.map(item => {
    const action = item.file.status === 'A' ? 'Added' : item.file.status === 'D' ? 'Deleted' : 'Modified';
    return `${item.file.file} (${action})`;
  });

  const unchangedFilesSummary = filesWithoutChanges.map(item => item.file.file);

  const fileSummary = [...changedFilesSummary, ...unchangedFilesSummary].join('<br>') || (showChangedOnly ? t('timeline.no_files_with_changes') : t('timeline.all_files'));

  // Show restore button if there are changes
  if (filesWithChanges.length > 0) {
    document.getElementById('rightPanelActions').innerHTML = `
      <button 
        id="restore-commit-btn"
        class="btn restore" 
        onmousedown="handleRestoreButtonDown('${hash}')"
        onmouseup="handleRestoreButtonUp('${hash}')"
        onmouseleave="handleRestoreButtonCancel()"
        ontouchstart="handleRestoreButtonDown('${hash}')"
        ontouchend="handleRestoreButtonUp('${hash}')"
        ontouchcancel="handleRestoreButtonCancel()">
        <span id="restore-btn-text">${t('timeline.restore_commit')}</span>
      </button>
    `;
  } else {
    document.getElementById('rightPanelActions').innerHTML = '';
  }

  // Build the HTML for the right panel
  const html = `
        <div class="commit-viewer">
          <div class="commit-viewer-header">
            <div class="commit-viewer-info">
              <div class="commit-files-summary">${fileSummary}</div>
            </div>
          </div>
          <div class="unified-diff">
            <div class="diff-content">
              ${allDiffsHtml || `<div class="empty">${t('timeline.no_files')}</div>`}
            </div>
          </div>
        </div>
      `;

  document.getElementById('rightPanel').innerHTML = html;
}


let currentFileHistory = []; // Store file history for time slider
let currentFileHistoryIndex = 0; // Current position in history

async function loadScripts() {
  const leftPanel = document.getElementById('leftPanel');
  leftPanel.innerHTML = `<div class="empty" data-i18n="app.loading">Loading...</div>`;

  try {
    const response = await fetch(`${API}/scripts`);
    const data = await response.json();

    if (data.success) {
      allScripts = data.scripts;
      const sortedScripts = sortItems(data.scripts, sortState.scripts);
      displayScripts(sortedScripts);
    } else {
      leftPanel.innerHTML = `<div class="error" data-i18n="scripts.error_loading">Error loading scripts: ${data.error}</div>`;
    }
  } catch (error) {
    leftPanel.innerHTML = `<div class="error" data-i18n="scripts.error_loading">Error loading scripts: ${error.message}</div>`;
  }
}

async function loadAutomations() {
  const leftPanel = document.getElementById('leftPanel');
  leftPanel.innerHTML = `<div class="empty" data-i18n="app.loading">Loading...</div>`;

  try {
    const response = await fetch(`${API}/automations`);
    const data = await response.json();

    if (data.success) {
      allAutomations = data.automations;
      const sortedAutomations = sortItems(data.automations, sortState.automations);
      displayAutomations(sortedAutomations);
    } else {
      leftPanel.innerHTML = `<div class="error" data-i18n="automations.error_loading">Error loading automations: ${data.error}</div>`;
    }
  } catch (error) {
    leftPanel.innerHTML = `<div class="error" data-i18n="automations.error_loading">Error loading automations: ${error.message}</div>`;
  }
}

async function loadFiles() {
  const leftPanel = document.getElementById('leftPanel');
  leftPanel.innerHTML = `<div class="empty" data-i18n="app.loading">Loading...</div>`;

  try {
    const response = await fetch(`${API}/files`);
    const data = await response.json();

    if (data.success) {
      allFiles = data.files;
      currentFilePath = ''; // Reset to root

      // Sort files
      const sortedFiles = sortItems(data.files.map(f => typeof f === 'string' ? { path: f, name: f } : { ...f, name: f.path }), sortState.files);
      displayFileList(sortedFiles);
    } else {
      leftPanel.innerHTML = `<div class="error" data-i18n="files.error_loading">Error loading files: ${data.error}</div>`;
    }
  } catch (error) {
    leftPanel.innerHTML = `<div class="error" data-i18n="files.error_loading">Error loading files: ${error.message}</div>`;
  }
}

function createFolderBreadcrumb(filePath) {
  const parts = filePath.split('/');
  let html = `<span class="breadcrumb-item clickable" onclick="navigateToPath('')">config</span>`;

  let path = '';
  for (let i = 0; i < parts.length; i++) {
    path += (i > 0 ? '/' : '') + parts[i];
    html += `<span class="breadcrumb-separator">/</span>`;
    if (i === parts.length - 1) {
      html += `<span class="breadcrumb-current">${parts[i]}</span>`;
    } else {
      html += `<span class="breadcrumb-item clickable" onclick="navigateToPath('${path}')">${parts[i]}</span>`;
    }
  }
  return html;
}

function displayFileList(files) {
  const items = [];
  const currentFolder = currentFilePath ? currentFilePath + '/' : '';

  const folderSet = new Set();

  files.forEach(fileObj => {
    // Handle both string paths (legacy/search) and object paths (new format)
    const filePath = typeof fileObj === 'string' ? fileObj : fileObj.path;

    if (filePath.startsWith(currentFolder)) {
      const relativePath = filePath.substring(currentFolder.length);
      const parts = relativePath.split('/');
      if (parts.length > 1) {
        // It's in a subfolder
        const folderName = parts[0];
        if (!folderSet.has(folderName)) {
          folderSet.add(folderName);
          items.push({
            name: folderName,
            type: 'folder',
            path: currentFolder + folderName
          });
        }
      } else {
        // It's a file in the current folder
        items.push({
          name: relativePath,
          type: 'file',
          path: filePath
        });
      }
    }
  });

  // Only sort if we are in a folder view where we mixed folders and files
  // Otherwise respect the order passed in (which is already sorted)
  // But we do want folders first usually?
  // For now, let's trust the passed order but maybe we should separate folders?
  // The user wants "Recently Modified", so if a file in a folder is modified, the folder should probably be up top?
  // Or just list them.
  // The original code sorted by name.
  // If we want to support "Recently Modified", we should probably NOT re-sort here.

  // However, we need to make sure folders don't get mixed weirdly if the input is sorted by date.
  // If sorted by date, a file might be newer than a folder (which doesn't really have a date here).
  // Let's just rely on the input order for now.


  let html = '';

  if (currentFilePath) {
    const breadcrumb = createFolderBreadcrumb(currentFilePath);
    html += `<div class="breadcrumb">${breadcrumb}</div>`;
  }

  items.forEach(item => {
    if (item.type === 'folder') {
      html += `
            <div class="file" onclick="navigateToPath('${item.path}')">
              <div class="file-icon"></div>
              <div class="file-path">
                <div class="file-name">${item.name}</div>
                <div class="file-path-text">Folder</div>
              </div>
              <div class="folder-chevron">›</div>
            </div>
          `;
    } else {
      const fileId = 'file-' + item.path.replace(/\//g, '-').replace(/\./g, '-');
      html += `
            <div class="file" onclick="showFileHistory('${item.path}')" id="${fileId}">
              <div class="file-icon"></div>
              <div class="file-path">
                <div class="file-name">${item.name}</div>
                <div class="file-path-text">${currentFilePath || 'config'}</div>
              </div>
            </div>
          `;
    }
  });

  if (!html && !currentFilePath) {
    html = `<div class="empty">${t('files.empty_state')}</div>`;
  } else if (!html && currentFilePath) {
    html += `<div class="empty">${t('files.empty_state')}</div>`;
  }


  document.getElementById('leftPanel').innerHTML = html;
  document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('files.select_file')}</div>`;
  document.getElementById('rightPanelActions').innerHTML = '';

  const fileItems = Array.from(document.querySelectorAll('.file'));
  updateKeyboardNavState('files', fileItems);

  hideFloatingConfirmRestoreButton();
}

async function showFileHistory(filePath) {
  document.querySelectorAll('.file').forEach(f => f.classList.remove('selected'));
  const fileId = 'file-' + filePath.replace(/\//g, '-').replace(/\./g, '-');
  const element = document.getElementById(fileId);
  if (element) {
    element.classList.add('selected');
    // Update keyboard navigation index to match clicked item
    const clickedIndex = keyboardNav.items.indexOf(element);
    if (clickedIndex !== -1) {
      keyboardNav.selectedIndex = clickedIndex;
    }
  }

  currentSelection = { type: 'file', file: filePath };
  // document.getElementById('rightPanel').innerHTML = '<div class="loading">Loading file history...</div>';

  try {
    // First get the current file content
    const currentContentResponse = await fetch(`${API}/file-content?filePath=${encodeURIComponent(filePath)}`);
    const currentContentData = await currentContentResponse.json();
    const currentContent = currentContentData.success ? currentContentData.content : '';

    // Get the file history
    const response = await fetch(`${API}/git/file-history?filePath=${encodeURIComponent(filePath)}`);
    const data = await response.json();

    if (data.success) {
      // Get all commits and filter to only those with actual visible changes from previous version
      const versionsWithChanges = [];
      const currentHash = data.currentHash;
      let lastKeptContent = null;

      // Process each version to check for actual content changes from the previous version
      for (let i = 0; i < data.log.all.length; i++) {
        const commit = data.log.all[i];

        // Get the commit version content
        try {
          const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(filePath)}&commitHash=${commit.hash}`);
          const commitData = await commitResponse.json();
          const commitContent = commitData.success ? commitData.content : '';

          // In shifted mode, include ALL versions since we compare between consecutive versions
          // In standard mode, filter out versions identical to current
          if (diffMode === 'shifted') {
            // Always include when in shifted mode
            commit.content = commitContent;
            versionsWithChanges.push(commit);
          } else {
            // Check if there are actual visible differences from the CURRENT version
            const diffVsCurrent = generateDiff(commitContent, currentContent, {
              returnNullIfNoChanges: true,
              filePath: filePath
            });

            if (diffVsCurrent === null) continue; // Skip if identical to live

            // Check against the last kept version to avoid consecutive duplicates
            if (lastKeptContent !== null) {
              const diffVsLast = generateDiff(commitContent, lastKeptContent, {
                returnNullIfNoChanges: true,
                filePath: filePath
              });
              if (diffVsLast === null) continue; // Skip if identical to the previously added history item
            }

            commit.content = commitContent;
            versionsWithChanges.push(commit);
            lastKeptContent = commitContent;
          }
        } catch (error) {
          console.error(`Error checking commit ${commit.hash}:`, error);
          // Include it if we can't check (fallback)
          versionsWithChanges.push(commit);
        }
      }

      currentFileHistory = versionsWithChanges;
      currentFileHistoryIndex = 0;

      if (currentFileHistory.length > 0) {
        displayFileHistory(filePath);
      } else {
        // No changes found - show current version with unchanged diff styling
        // Get the most recent commit (current hash) for display
        const mostRecentCommit = data.log.all.length > 0 ? data.log.all[0] : null;
        const unchangedHtml = renderUnchangedView(currentContent, {
          startLineNum: 1,
          commitDate: mostRecentCommit ? mostRecentCommit.date : null,
          commitHash: mostRecentCommit ? mostRecentCommit.hash : data.currentHash
        });
        document.getElementById('rightPanel').innerHTML = unchangedHtml;
        document.getElementById('rightPanelActions').innerHTML = '';
      }



    } else {
      document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('files.failed_to_load_history')}</div>`;
    }
  } catch (error) {
    console.error('Error:', error);
    document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('files.error_loading_history', { error: error.message })}</div>`;
  }
}

let allAutomations = [];
let allScripts = [];
let currentAutomationHistory = []; // Store automation history for time slider
let currentAutomationHistoryIndex = 0; // Current position in history
let currentScriptHistory = []; // Store script history for time slider
let currentScriptHistoryIndex = 0; // Current position in history



function displayAutomations(automations) {
  let html = '';

  if (automations.length === 0) {
    html = `<div class="empty">${t('automations.empty_state')}</div>`;
  } else {
    automations.forEach(auto => {
      const autoId = 'auto-' + auto.id.replace(/[:/]/g, '-');
      html += `
            <div class="file" onclick="showAutomationHistory('${auto.id}')" id="${autoId}">
              <div class="file-icon"></div>
              <div class="file-path">
                <div class="file-name">${auto.name}</div>
                <div class="file-path-text">${auto.file}</div>
              </div>
            </div>
          `;
    });
  }

  document.getElementById('leftPanel').innerHTML = html;
  document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('automations.select_automation')}</div>`;
  document.getElementById('rightPanelActions').innerHTML = '';

  // Update keyboard navigation
  const automationItems = Array.from(document.querySelectorAll('.file'));
  updateKeyboardNavState('automations', automationItems);

  // Hide the floating button when not viewing a diff
  hideFloatingConfirmRestoreButton();
}

async function showAutomationHistory(automationId) {
  document.querySelectorAll('.file').forEach(f => f.classList.remove('selected'));
  const autoId = 'auto-' + automationId.replace(/[:/]/g, '-');
  const element = document.getElementById(autoId);
  if (element) {
    element.classList.add('selected');
    // Update keyboard navigation index to match clicked item
    const clickedIndex = keyboardNav.items.indexOf(element);
    if (clickedIndex !== -1) {
      keyboardNav.selectedIndex = clickedIndex;
    }
  }

  currentSelection = { type: 'automation', id: automationId };

  try {
    const response = await fetch(`${API}/automation/${encodeURIComponent(automationId)}/history`);
    const data = await response.json();

    if (data.success && data.history.length > 0) {
      // Get the current automation content for comparison
      const auto = allAutomations.find(a => a.id === automationId);
      const currentContent = dumpYaml(auto.content);

      // Filter out versions that don't have any changes compared to the previous version
      const versionsWithChanges = [];
      let lastKeptContent = null;

      for (const commit of data.history) {
        const commitContent = dumpYaml(commit.automation);

        // In shifted mode, include ALL versions since we compare between consecutive versions
        // In standard mode, filter out versions identical to current
        if (diffMode === 'shifted') {
          // Always include when in shifted mode
          versionsWithChanges.push({
            ...commit,
            yamlContent: commitContent
          });
        } else {
          // Check if there are visible differences compared to the CURRENT version
          const diffVsCurrent = generateDiff(commitContent, currentContent, {
            returnNullIfNoChanges: true,
            filePath: auto.file
          });

          if (diffVsCurrent === null) continue; // Skip if identical to live

          // Check against the last kept version to avoid consecutive duplicates
          if (lastKeptContent !== null) {
            const diffVsLast = generateDiff(commitContent, lastKeptContent, {
              returnNullIfNoChanges: true,
              filePath: auto.file
            });
            if (diffVsLast === null) continue; // Skip if identical to the previously added history item
          }

          versionsWithChanges.push({
            ...commit,
            yamlContent: commitContent
          });
          lastKeptContent = commitContent;
        }
      }

      if (versionsWithChanges.length > 0) {
        // Store the filtered history
        currentAutomationHistory = versionsWithChanges;
        currentAutomationHistoryIndex = 0;

        // Set the panel title
        document.getElementById('rightPanelTitle').textContent = auto ? auto.name : 'Automation';

        document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreAutomationVersion('${automationId}')" title="This will overwrite the current automation with this version">Confirm Restore</button>`;

        // Display history with navigation
        displayAutomationHistory();


      } else {
        // No changes found - show current version with unchanged diff styling
        const auto = allAutomations.find(a => a.id === automationId);
        document.getElementById('rightPanelTitle').textContent = auto ? auto.name : 'Automation';
        document.getElementById('rightPanelActions').innerHTML = '';

        const yamlContent = dumpYaml(auto.content);
        const startLineNum = (auto && auto.line) ? auto.line : 1;

        // Get most recent commit from history for display
        const mostRecentCommit = data.history.length > 0 ? data.history[0] : null;

        const unchangedHtml = renderUnchangedView(yamlContent, {
          startLineNum: startLineNum,
          commitDate: mostRecentCommit ? mostRecentCommit.date : null,
          commitHash: mostRecentCommit ? mostRecentCommit.hash : null
        });

        document.getElementById('rightPanel').innerHTML = unchangedHtml;
      }
    } else {
      let debugHtml = '';
      if (data.debugMessages && data.debugMessages.length > 0) {
        debugHtml = `
              <div class="debug-info" style="margin-top: 20px; padding: 10px; background-color: #333; border-radius: 5px;">
                <h4>Debug Information:</h4>
                <ul style="list-style-type: none; padding: 0; font-size: 0.8em;">
                  ${data.debugMessages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
                </ul>
              </div>
            `;
      }
      document.getElementById('rightPanel').innerHTML = `
            <div class="empty">${t('history.no_changes')}</div>
            ${debugHtml}
          `;


    }
  } catch (error) {
    console.error('Error loading automation history:', error);
    let debugHtml = '';
    // If the error is from the fetch itself, data.debugMessages might not exist
    if (error.debugMessages && error.debugMessages.length > 0) {
      debugHtml = `
            <div class="debug-info" style="margin-top: 20px; padding: 10px; background-color: #333; border-radius: 5px;">
              <h4>Debug Information:</h4>
              <ul style="list-style-type: none; padding: 0; font-size: 0.8em;">
                ${error.debugMessages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
              </ul>
            </div>
          `;
    }
    document.getElementById('rightPanel').innerHTML = `
          <div class="empty">${t('history.error_loading', { error: error.message })}</div>
          ${debugHtml}
        `;


  }
}

function displayAutomationHistory() {
  if (currentAutomationHistory.length === 0) {
    document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('history.no_changes')}</div>`;
    return;
  }

  // Build the HTML for the right panel with navigation
  const html = `
        <div class="file-history-viewer">
          <div class="file-history-header">
            <div class="file-history-info">
              <div class="history-position" id="automationHistoryPosition">Version 1 of ${currentAutomationHistory.length}</div>
            </div>
            <div class="file-history-actions">
              <button class="btn" id="autoPrevBtn" onclick="navigateAutomationHistory(-1)" ${currentAutomationHistoryIndex === 0 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">◀</button>
              <button class="btn" id="autoNextBtn" onclick="navigateAutomationHistory(1)" ${currentAutomationHistoryIndex === currentAutomationHistory.length - 1 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">▶</button>
            </div>
          </div>
          <div class="diff-view-container" id="automationDiffContent"></div>
        </div>
      `;

  document.getElementById('rightPanel').innerHTML = html;

  // Show the floating button when viewing automation history
  showFloatingConfirmRestoreButton();

  // Load the initial version
  loadAutomationHistoryDiff();
}

async function loadAutomationHistoryDiff() {
  const currentCommit = currentAutomationHistory[currentAutomationHistoryIndex];

  // Update position indicator
  document.getElementById('automationHistoryPosition').textContent =
    `Version ${currentAutomationHistoryIndex + 1} of ${currentAutomationHistory.length} — ${formatDateForBanner(currentCommit.date)}`;

  // Update button states
  document.getElementById('autoPrevBtn').disabled = currentAutomationHistoryIndex === 0;
  document.getElementById('autoNextBtn').disabled = currentAutomationHistoryIndex === currentAutomationHistory.length - 1;

  const auto = allAutomations.find(a => a.id === currentSelection.id);
  if (!auto) return;

  const currentContent = dumpYaml(auto.content);
  let compareToContent = '';

  if (diffMode === 'shifted') {
    // Shifted mode: compare current to NEXT older version
    if (currentAutomationHistoryIndex === currentAutomationHistory.length - 1) {
      // Oldest version - no older version to compare to
      document.getElementById('automationDiffContent').innerHTML = `
        <div class="empty" style="padding: 40px; text-align: center;">
          <div style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">Oldest Version</div>
          <div style="font-size: 14px; color: var(--text-secondary);">No older version to compare current against</div>
        </div>
      `;
      document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreAutomationVersion('${auto.id}')" title="This will overwrite the current automation with this version">Confirm Restore</button>`;
      return;
    }

    const nextOlderCommit = currentAutomationHistory[currentAutomationHistoryIndex + 1];
    compareToContent = nextOlderCommit.yamlContent || dumpYaml(nextOlderCommit.automation);
  } else {
    // Standard mode: compare current to the version being viewed
    compareToContent = currentCommit.yamlContent || dumpYaml(currentCommit.automation);
  }

  const startLine = (auto && auto.line) ? (auto.line - 1) : 0;

  const diffHtml = renderDiff(compareToContent, currentContent, document.getElementById('automationDiffContent'), {
    leftLabel: 'Current Version',
    rightLabel: `Version ${currentCommit.hash.substring(0, 8)}`,
    startLineOffset: startLine,
    filePath: 'automations.yaml'
  });
}

function navigateAutomationHistory(direction) {
  const newIndex = currentAutomationHistoryIndex + direction;
  if (newIndex >= 0 && newIndex < currentAutomationHistory.length) {
    currentAutomationHistoryIndex = newIndex;
    loadAutomationHistoryDiff();
  }
}



function displayScripts(scripts) {
  let html = '';

  if (scripts.length === 0) {
    html = `<div class="empty">${t('scripts.empty_state')}</div>`;
  } else {
    scripts.forEach(script => {
      const scriptId = 'script-' + script.id.replace(/[:/]/g, '-');
      html += `
            <div class="file" onclick="showScriptHistory('${script.id}')" id="${scriptId}">
              <div class="file-icon"></div>
              <div class="file-path">
                <div class="file-name">${script.name}</div>
                <div class="file-path-text">${script.file}</div>
              </div>
            </div>
          `;
    });
  }

  document.getElementById('leftPanel').innerHTML = html;
  document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('scripts.select_script')}</div>`;
  document.getElementById('rightPanelActions').innerHTML = '';

  // Update keyboard navigation
  const scriptItems = Array.from(document.querySelectorAll('.file'));
  updateKeyboardNavState('scripts', scriptItems);

  // Hide the floating button when not viewing a diff
  hideFloatingConfirmRestoreButton();
}

async function showScriptHistory(scriptId) {
  document.querySelectorAll('.file').forEach(f => f.classList.remove('selected'));
  const scriptElId = 'script-' + scriptId.replace(/[:/]/g, '-');
  const element = document.getElementById(scriptElId);
  if (element) {
    element.classList.add('selected');
    // Update keyboard navigation index to match clicked item
    const clickedIndex = keyboardNav.items.indexOf(element);
    if (clickedIndex !== -1) {
      keyboardNav.selectedIndex = clickedIndex;
    }
  }

  currentSelection = { type: 'script', id: scriptId };

  try {
    const response = await fetch(`${API}/script/${encodeURIComponent(scriptId)}/history`);
    const data = await response.json();

    if (data.success && data.history.length > 0) {
      // Get the current script content for comparison
      const script = allScripts.find(s => s.id === scriptId);
      const currentContent = dumpYaml(script.content);

      // Filter out versions that don't have any changes compared to the previous version
      const versionsWithChanges = [];
      let lastKeptContent = null;

      for (const commit of data.history) {
        const commitContent = dumpYaml(commit.script);

        // In shifted mode, include ALL versions since we compare between consecutive versions
        // In standard mode, filter out versions identical to current
        if (diffMode === 'shifted') {
          // Always include when in shifted mode
          versionsWithChanges.push({
            ...commit,
            yamlContent: commitContent
          });
        } else {
          // Check if there are visible differences compared to the CURRENT version
          const diffVsCurrent = generateDiff(commitContent, currentContent, {
            returnNullIfNoChanges: true,
            filePath: script.file
          });

          if (diffVsCurrent === null) continue; // Skip if identical to live

          // Check against the last kept version to avoid consecutive duplicates
          if (lastKeptContent !== null) {
            const diffVsLast = generateDiff(commitContent, lastKeptContent, {
              returnNullIfNoChanges: true,
              filePath: script.file
            });
            if (diffVsLast === null) continue; // Skip if identical to the previously added history item
          }

          versionsWithChanges.push({
            ...commit,
            yamlContent: commitContent
          });
          lastKeptContent = commitContent;
        }
      }

      if (versionsWithChanges.length > 0) {
        // Store the filtered history
        currentScriptHistory = versionsWithChanges;
        currentScriptHistoryIndex = 0;

        // Set the panel title
        document.getElementById('rightPanelTitle').textContent = script ? script.name : 'Script';

        document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreScriptVersion('${scriptId}')" title="This will overwrite the current script with this version">Confirm Restore</button>`;

        // Display history with navigation
        displayScriptHistory();


      } else {
        // No changes found - show current version with unchanged diff styling
        const script = allScripts.find(s => s.id === scriptId);
        document.getElementById('rightPanelTitle').textContent = script ? script.name : 'Script';
        document.getElementById('rightPanelActions').innerHTML = '';

        const yamlContent = dumpYaml(script.content);
        const startLineNum = (script && script.line) ? script.line : 1;

        // Get most recent commit from history for display
        const mostRecentCommit = data.history.length > 0 ? data.history[0] : null;

        const unchangedHtml = renderUnchangedView(yamlContent, {
          startLineNum: startLineNum,
          commitDate: mostRecentCommit ? mostRecentCommit.date : null,
          commitHash: mostRecentCommit ? mostRecentCommit.hash : null
        });

        document.getElementById('rightPanel').innerHTML = unchangedHtml;
      }
    } else {
      let debugHtml = '';
      if (data.debugMessages && data.debugMessages.length > 0) {
        debugHtml = `
              <div class="debug-info" style="margin-top: 20px; padding: 10px; background-color: #333; border-radius: 5px;">
                <h4>Debug Information:</h4>
                <ul style="list-style-type: none; padding: 0; font-size: 0.8em;">
                  ${data.debugMessages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
                </ul>
              </div>
            `;
      }
      document.getElementById('rightPanel').innerHTML = `
            <div class="empty">${t('history.no_changes')}</div>
            ${debugHtml}
          `;


    }
  } catch (error) {
    console.error('Error loading script history:', error);
    let debugHtml = '';
    // If the error is from the fetch itself, data.debugMessages might not exist
    if (error.debugMessages && error.debugMessages.length > 0) {
      debugHtml = `
            <div class="debug-info" style="margin-top: 20px; padding: 10px; background-color: #333; border-radius: 5px;">
              <h4>Debug Information:</h4>
              <ul style="list-style-type: none; padding: 0; font-size: 0.8em;">
                ${error.debugMessages.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}
              </ul>
            </div>
          `;
    }
    document.getElementById('rightPanel').innerHTML = `
          <div class="empty">${t('history.error_loading', { error: error.message })}</div>
          ${debugHtml}
        `;


  }
}

function displayScriptHistory() {
  if (currentScriptHistory.length === 0) {
    document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('history.no_changes')}</div>`;
    return;
  }

  // Build the HTML for the right panel with navigation
  const html = `
        <div class="file-history-viewer">
          <div class="file-history-header">
            <div class="file-history-info">
              <div class="history-position" id="scriptHistoryPosition">Version 1 of ${currentScriptHistory.length}</div>
            </div>
            <div class="file-history-actions">
              <button class="btn" id="scriptPrevBtn" onclick="navigateScriptHistory(-1)" ${currentScriptHistoryIndex === 0 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">◀</button>
              <button class="btn" id="scriptNextBtn" onclick="navigateScriptHistory(1)" ${currentScriptHistoryIndex === currentScriptHistory.length - 1 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">▶</button>
            </div>
          </div>
          <div class="diff-view-container" id="scriptDiffContent"></div>
        </div>
      `;

  document.getElementById('rightPanel').innerHTML = html;

  // Show the floating button when viewing script history
  showFloatingConfirmRestoreButton();

  // Load the initial version
  loadScriptHistoryDiff();
}

async function loadScriptHistoryDiff() {
  const currentCommit = currentScriptHistory[currentScriptHistoryIndex];

  // Update position indicator
  document.getElementById('scriptHistoryPosition').textContent =
    `Version ${currentScriptHistoryIndex + 1} of ${currentScriptHistory.length} — ${formatDateForBanner(currentCommit.date)}`;

  // Update button states
  document.getElementById('scriptPrevBtn').disabled = currentScriptHistoryIndex === 0;
  document.getElementById('scriptNextBtn').disabled = currentScriptHistoryIndex === currentScriptHistory.length - 1;

  const script = allScripts.find(s => s.id === currentSelection.id);
  if (!script) return;

  const currentContent = dumpYaml(script.content);
  let compareToContent = '';

  if (diffMode === 'shifted') {
    // Shifted mode: compare current to NEXT older version
    if (currentScriptHistoryIndex === currentScriptHistory.length - 1) {
      // Oldest version - no older version to compare to
      document.getElementById('scriptDiffContent').innerHTML = `
        <div class="empty" style="padding: 40px; text-align: center;">
          <div style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">Oldest Version</div>
          <div style="font-size: 14px; color: var(--text-secondary);">No older version to compare current against</div>
        </div>
      `;
      document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreScriptVersion('${script.id}')" title="This will overwrite the current script with this version">Confirm Restore</button>`;
      return;
    }

    const nextOlderCommit = currentScriptHistory[currentScriptHistoryIndex + 1];
    compareToContent = nextOlderCommit.yamlContent || dumpYaml(nextOlderCommit.script);
  } else {
    // Standard mode: compare current to the version being viewed
    compareToContent = currentCommit.yamlContent || dumpYaml(currentCommit.script);
  }

  const startLine = (script && script.line) ? (script.line - 1) : 0;

  const diffHtml = renderDiff(compareToContent, currentContent, document.getElementById('scriptDiffContent'), {
    leftLabel: 'Current Version',
    rightLabel: `Version ${currentCommit.hash.substring(0, 8)}`,
    startLineOffset: startLine,
    filePath: 'scripts.yaml'
  });
}

function navigateScriptHistory(direction) {
  const newIndex = currentScriptHistoryIndex + direction;

  if (newIndex < 0 || newIndex >= currentScriptHistory.length) {
    return; // Out of bounds
  }

  currentScriptHistoryIndex = newIndex;
  loadScriptHistoryDiff();
}

// Helper function to dump YAML
function dumpYaml(obj) {
  if (typeof obj === 'string') return obj;
  try {
    // Use js-yaml to dump the object as YAML
    return jsyaml.dump(obj, {
      indent: 2,
      lineWidth: -1,  // Don't wrap lines
      noRefs: true,   // Don't use references
      sortKeys: false // Keep key order
    });
  } catch (error) {
    console.error('Error dumping YAML:', error);
    // Fallback to JSON if YAML dump fails
    return JSON.stringify(obj, null, 2);
  }
}

/**
 * Render unchanged content view (for files/automations/scripts with no history)
 * Uses the same format as timeline tab when showing unchanged files
 * @param {string} content - The content to display
 * @param {Object} options - Options for rendering
 * @param {number} options.startLineNum - Starting line number (default: 1)
 * @param {string} options.commitDate - Commit date (ISO format)
 * @param {string} options.commitHash - Commit hash
 * @returns {string} HTML string for the unchanged view
 */
function renderUnchangedView(content, options = {}) {
  const {
    startLineNum = 1,
    commitDate = null,
    commitHash = null
  } = options;

  // Split content into lines
  const lines = content.split(/\r\n?|\n/);

  // Use generateFullFileHTML to match timeline's unchanged file display
  let contentHtml = '';
  let lineNum = startLineNum - 1;

  lines.forEach(line => {
    lineNum++;
    contentHtml += `
      <div class="diff-line diff-line-context">
        <span class="diff-line-marker"> </span>
        <span class="diff-line-num">${lineNum}</span>
        <pre class="diff-line-text"><code>${escapeHtml(line) || '&nbsp;'}</code></pre>
      </div>
    `;
  });

  // Format commit date like "Nov 30, 2025 1:04 PM (2ec8a8d)"
  const formattedDate = commitDate ? formatDateForBanner(commitDate) : new Date().toLocaleDateString();
  const hashDisplay = commitHash ? ` (${commitHash.substring(0, 7)})` : '';

  // Wrap in file-history-viewer with header banner
  return `
    <div class="file-history-viewer">
      <div class="file-history-header">
        <div class="file-history-info">
          <div class="history-position">Version 1 of 1 — ${formattedDate}${hashDisplay}</div>
        </div>
      </div>
      <div class="diff-view-container">
        <div class="segmented-control" style="cursor: default; grid-template-columns: 1fr;">
          <div class="segmented-control-slider" style="width: calc(100% - 8px);"></div>
          <label style="cursor: default; color: var(--text-primary);">Current Version</label>
        </div>
        <div class="diff-viewer-shell ${currentDiffStyle}">
          <div class="diff-viewer-unified">
            ${contentHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}



function generateClippedDiffHTML(baseLines, compareLines, context = 3, startLineOffset = 0) {
  const maxLines = Math.max(baseLines.length, compareLines.length);
  let diffHtml = '';

  const changedIndices = [];
  for (let i = 0; i < maxLines; i++) {
    const baseLine = baseLines[i] || '';
    const compareLine = compareLines[i] || '';
    if (baseLine !== compareLine) {
      changedIndices.push(i);
    }
  }

  if (changedIndices.length === 0) {
    return '';
  }

  let lastShownLine = -1;
  let lineNum = 0;

  for (let i = 0; i < maxLines; i++) {
    const showLine = changedIndices.some(ci => Math.abs(i - ci) <= context);

    if (showLine) {
      if (i > lastShownLine + 1) {
        diffHtml += `<div class="diff-line unchanged"><span class="line-num"></span><span class="line-content">...</span></div>`;
      }

      const baseLine = baseLines[i] || '';
      const compareLine = compareLines[i] || '';
      const isChanged = baseLine !== compareLine;
      lineNum = i + 1 + startLineOffset;

      if (isChanged) {
        if (compareLine && !baseLine) {
          // Line added in compare version
          diffHtml += `<div class="diff-line added"><span class="line-num"> </span><span class="line-content">+ ${escapeHtml(compareLine) || '&nbsp;'}</span></div>`;
        } else if (baseLine && !compareLine) {
          // Line removed from base version
          diffHtml += `<div class="diff-line removed"><span class="line-num">${lineNum}</span><span class="line-content">- ${escapeHtml(baseLine) || '&nbsp;'}</span></div>`;
        } else {
          // Line changed
          diffHtml += `<div class="diff-line removed"><span class="line-num">${lineNum}</span><span class="line-content">- ${escapeHtml(baseLine) || '&nbsp;'}</span></div>`;
          diffHtml += `<div class="diff-line added"><span class="line-num">${lineNum}</span><span class="line-content">+ ${escapeHtml(compareLine) || '&nbsp;'}</span></div>`;
        }
      } else {
        // Line unchanged
        diffHtml += `<div class="diff-line unchanged"><span class="line-number">${lineNum}</span><span class="line-content">  ${escapeHtml(baseLine) || '&nbsp;'}</span></div>`;
      }
      lastShownLine = i;
    }
  }
  if (lastShownLine < maxLines - 1 && changedIndices.length > 0) {
    if (maxLines - 1 - lastShownLine > 1)
      diffHtml += `<div class="diff-line unchanged"><span class="line-num"></span><span class="line-content">...</span></div>`;
  }

  return diffHtml;
}


function generateFullFileHTML(lines) {
  let contentHtml = '';
  let lineNum = 0;
  lines.forEach(line => {
    lineNum++;
    contentHtml += `
      <div class="diff-line diff-line-context">
        <span class="diff-line-marker"> </span>
        <span class="diff-line-num">${lineNum}</span>
        <pre class="diff-line-text"><code>${escapeHtml(line) || '&nbsp;'}</code></pre>
      </div>
    `;
  });
  return contentHtml;
}

function displayFileHistory(filePath) {
  if (currentFileHistory.length === 0) {
    document.getElementById('rightPanel').innerHTML = `<div class="empty">${t('files.empty_state')}</div>`;
    return;
  }

  // Set the panel title
  document.getElementById('rightPanelTitle').textContent = filePath;
  // document.getElementById('itemsSubtitle').textContent = `History (${currentFileHistory.length} versions with changes)`;
  document.getElementById('rightPanelActions').innerHTML = '';

  // Build the HTML for the right panel with navigation
  const html = `
        <div class="file-history-viewer">
          <div class="file-history-header">
            <div class="file-history-info">
              <div class="history-position" id="historyPosition">Version 1 of ${currentFileHistory.length}</div>
            </div>
                                          <div class="file-history-actions">
                                            <button class="btn" id="prevBtn" onclick="navigateFileHistory(-1)" ${currentFileHistoryIndex === 0 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">◀</button>
                                            <button class="btn" id="nextBtn" onclick="navigateFileHistory(1)" ${currentFileHistoryIndex === currentFileHistory.length - 1 ? 'disabled' : ''} style="border: 1px solid var(--border-subtle); min-width: 36px; padding: 8px 12px;">▶</button>
                                          </div>          </div>
          <div class="diff-view-container" id="fileDiffContent"></div>
        </div>
      `;

  document.getElementById('rightPanel').innerHTML = html;

  // Show the floating button when viewing file history
  showFloatingConfirmRestoreButton();

  // Load the initial version
  loadFileHistoryDiff(filePath);
}

function formatDateForBanner(dateString) {
  const date = new Date(dateString);
  // Format: Nov 26, 2025 1:00 PM
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return `${datePart} ${timePart}`;
}

async function loadFileHistoryDiff(filePath) {
  const currentCommit = currentFileHistory[currentFileHistoryIndex];

  // Update position indicator
  document.getElementById('historyPosition').textContent =
    `Version ${currentFileHistoryIndex + 1} of ${currentFileHistory.length} — ${formatDateForBanner(currentCommit.date)}`;

  // Update button states
  document.getElementById('prevBtn').disabled = currentFileHistoryIndex === 0;
  document.getElementById('nextBtn').disabled = currentFileHistoryIndex === currentFileHistory.length - 1;

  // Get current file content
  const currentContentResponse = await fetch(`${API}/file-content?filePath=${encodeURIComponent(filePath)}`);
  const currentContentData = await currentContentResponse.json();
  const currentContent = currentContentData.success ? currentContentData.content : '';

  let compareToContent = '';

  if (diffMode === 'shifted') {
    // Shifted mode: compare current to NEXT older version (not the one being viewed)
    if (currentFileHistoryIndex === currentFileHistory.length - 1) {
      // This is the oldest version - no older version to compare to
      document.getElementById('fileDiffContent').innerHTML = `
        <div class="empty" style="padding: 40px; text-align: center;">
          <div style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px;">Oldest Version</div>
          <div style="font-size: 14px; color: var(--text-secondary);">No older version to compare current against</div>
        </div>
      `;
      document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreFileVersion('${filePath}')" title="This will overwrite the current file with this version">Confirm Restore</button>`;
      return;
    }

    // Get the NEXT older version (index + 1 because array is newest first)
    const nextOlderCommit = currentFileHistory[currentFileHistoryIndex + 1];
    const olderResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(filePath)}&commitHash=${nextOlderCommit.hash}`);
    const olderData = await olderResponse.json();
    compareToContent = olderData.success ? olderData.content : '';
  } else {
    // Standard mode: compare current to the version being viewed
    const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(filePath)}&commitHash=${currentCommit.hash}`);
    const commitData = await commitResponse.json();
    compareToContent = commitData.success ? commitData.content : '';
  }

  // Always: current on left, compareToContent on right
  const diffHtml = renderDiff(compareToContent, currentContent, document.getElementById('fileDiffContent'), {
    leftLabel: 'Current Version',
    rightLabel: `Version ${currentCommit.hash.substring(0, 8)}`,
    filePath: filePath
  });

  if (diffHtml) {
    document.getElementById('rightPanelActions').innerHTML = `<button class="btn restore" onclick="restoreFileVersion('${filePath}')" title="This will overwrite the current file with this version">Confirm Restore</button>`;
  } else {
    document.getElementById('rightPanelActions').innerHTML = '';
  }
}

function navigateFileHistory(direction) {
  const newIndex = currentFileHistoryIndex + direction;

  if (newIndex < 0 || newIndex >= currentFileHistory.length) {
    return; // Out of bounds
  }

  currentFileHistoryIndex = newIndex;
  const filePath = currentSelection.file;

  // Reload the diff for the new position
  loadFileHistoryDiff(filePath);
}

async function restoreFileVersion(filePath) {
  const currentCommit = currentFileHistory[currentFileHistoryIndex];
  const commitDate = new Date(currentCommit.date).toLocaleString();
  console.log(`[UI] User clicked restore for ${filePath} at commit ${currentCommit.hash.substring(0, 8)}`);

  // Restore directly without confirmation
  try {
    const response = await fetch(`${API}/restore-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, commitHash: currentCommit.hash })
    });
    const data = await response.json();

    if (data.success) {
      const key = data.reloaded ? 'timeline.single_file_restored_reloaded' : 'timeline.single_file_restored';
      const message = t(key).replace('{file}', filePath);

      // Check if it's a Lovelace file and offer restart
      if (filePath.includes('.storage/lovelace')) {
        showNotification(message, 'success', 8000, {
          label: 'Restart Home Assistant',
          callback: restartHomeAssistant
        });
      } else {
        showNotification(message, 'success');
      }

      // Reload the file history to show the new commit
      showFileHistory(filePath);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring file: ' + error.message, 'error');
  }
}

async function viewDiff(file, hash) {
  try {
    // Show loading state
    document.getElementById('modalTitle').textContent = 'Loading...';
    document.getElementById('diffModal').classList.add('active');

    // Get both the current file content and the commit version
    const [currentResponse, commitResponse, diffResponse] = await Promise.all([
      fetch(`${API}/files/content?path=${encodeURIComponent(file)}`),
      fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file)}&commitHash=${hash}`),
      fetch(`${API}/git/file-diff?filePath=${encodeURIComponent(file)}&commitHash=${hash}`)
    ]);

    const currentData = await currentResponse.json();
    const commitData = await commitResponse.json();
    const diffData = await diffResponse.json();

    if (commitData.success && currentData.success) {
      modalData = { file, hash, content: commitData.content };
      showModal(file, hash, commitData.content, currentData.content, diffData.diff);
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error loading file diff: ' + error.message, 'error');
  }
}

async function restoreAutomationVersion(automationId) {
  const auto = allAutomations.find(a => a.id === automationId);
  if (!auto) {
    showNotification('Automation not found', 'error');
    return;
  }

  try {
    // Get the commit hash from the current history position
    const currentCommit = currentAutomationHistory[currentAutomationHistoryIndex];
    const commitHash = currentCommit.hash;

    const response = await fetch(`${API}/automation/${encodeURIComponent(automationId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash })
    });
    const data = await response.json();

    if (data.success) {
      const key = data.reloaded ? 'automations.automation_restored_reloaded' : 'automations.automation_restored';
      const message = t(key).replace('{name}', auto.name);
      showNotification(message);
      // Reload automations
      loadAutomations();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring automation: ' + error.message, 'error');
  }
}

async function restoreScriptVersion(scriptId) {
  const script = allScripts.find(s => s.id === scriptId);
  if (!script) {
    showNotification('Script not found', 'error');
    return;
  }

  try {
    // Get the commit hash from the current history position
    const currentCommit = currentScriptHistory[currentScriptHistoryIndex];
    const commitHash = currentCommit.hash;

    const response = await fetch(`${API}/script/${encodeURIComponent(scriptId)}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash })
    });
    const data = await response.json();

    if (data.success) {
      const key = data.reloaded ? 'scripts.script_restored_reloaded' : 'scripts.script_restored';
      const message = t(key).replace('{name}', script.name);
      showNotification(message);
      // Reload scripts
      loadScripts();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring script: ' + error.message, 'error');
  }
}

function showModal(file, hash, commitContent, currentContent, diff) {
  document.getElementById('modalTitle').textContent = `Changes in ${file}`;
  document.getElementById('commitInfo').innerHTML =
    `<strong>Comparing:</strong> Commit ${hash.substring(0, 8)} (Left) vs Current Version (Right)`;

  renderDiff(commitContent, currentContent, diff, {
    leftLabel: `Version ${hash.substring(0, 8)}`,
    rightLabel: 'Current Version'
  });

  // Update the restore button to use the new confirmRestore function
  const restoreBtn = document.querySelector('#diffModal .btn-primary');
  if (restoreBtn) {
    restoreBtn.onclick = () => confirmRestore(file, hash);
  }
}


function renderDiff(commitContent, currentContent, diffText, options = {}) {
  const diffHtml = generateDiff(currentContent, commitContent, {
    leftLabel: options.leftLabel || 'Current Version',
    rightLabel: options.rightLabel || 'Backup Version',
    filePath: options.filePath || ''
  });

  // The new logic generates the entire HTML structure, so we need to inject it differently
  // We'll replace the entire diff-container content with the new structure
  const diffContainer = document.querySelector('.diff-container');
  diffContainer.innerHTML = diffHtml;
}

// Generate split diff with paired columns
function generateDiff(oldText, newText, options = {}) {
  const { leftLabel = 'Live version', rightLabel = 'Backup version', rightMeta = '', bannerText = '', returnNullIfNoChanges = false, startLineOffset = 0, filePath = '' } = options;

  // Ensure inputs are strings to prevent errors
  let safeOldText = typeof oldText === 'string' ? oldText : '';
  let safeNewText = typeof newText === 'string' ? newText : '';

  // Normalize YAML files to eliminate formatting differences
  const isYamlFile = filePath && /\.(yaml|yml)$/i.test(filePath);
  if (isYamlFile && typeof jsyaml !== 'undefined') {
    try {
      // Parse both versions
      const oldParsed = jsyaml.load(safeOldText);
      const newParsed = jsyaml.load(safeNewText);

      // Re-serialize with consistent formatting
      const yamlOptions = {
        indent: 2,
        lineWidth: -1,  // Don't wrap lines
        noRefs: true,   // Don't use references
        sortKeys: false // Keep original key order
      };

      safeOldText = jsyaml.dump(oldParsed, yamlOptions);
      safeNewText = jsyaml.dump(newParsed, yamlOptions);
    } catch (e) {
      // If YAML parsing fails, use original text
      console.warn('YAML parsing failed for diff normalization, using raw text:', e.message);
    }
  }

  // Store content for expand functionality AFTER normalization
  // Generate a unique ID for this diff context
  const diffId = `diff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  diffContexts[diffId] = safeOldText;

  // Calculate total lines for bottom expander
  const totalLines = safeOldText.split(/\r\n?|\n/).length + startLineOffset;

  const diff = Diff.diffLines(safeOldText, safeNewText);
  const MAX_CONTEXT_LINES = 3; // Reduced to 3 for tighter diffs (YAML normalization eliminates formatting noise)

  const diffLines = [];
  let oldLineNum = 1 + startLineOffset;
  let newLineNum = 1 + startLineOffset;

  diff.forEach(part => {
    let lines = part.value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') {
      lines.pop();
    }

    if (part.added) {
      lines.forEach(line => {
        diffLines.push({ type: 'added', text: line, oldLine: null, newLine: newLineNum });
        newLineNum++;
      });
    } else if (part.removed) {
      lines.forEach(line => {
        diffLines.push({ type: 'removed', text: line, oldLine: oldLineNum, newLine: null });
        oldLineNum++;
      });
    } else {
      lines.forEach(line => {
        diffLines.push({ type: 'context', text: line, oldLine: oldLineNum, newLine: newLineNum });
        oldLineNum++;
        newLineNum++;
      });
    }
  });

  const hunks = [];
  let index = 0;

  while (index < diffLines.length) {
    while (index < diffLines.length && diffLines[index].type === 'context') {
      index++;
    }

    if (index >= diffLines.length) break;

    let hunkStart = Math.max(0, index - MAX_CONTEXT_LINES);
    let hunkEnd = index;
    let postContextCount = 0;

    while (hunkEnd < diffLines.length) {
      const line = diffLines[hunkEnd];
      if (line.type === 'context') {
        postContextCount++;
        if (postContextCount > MAX_CONTEXT_LINES) {
          // Don't include this line - it should be part of separator/expander
          break;
        }
      } else {
        postContextCount = 0;
      }
      hunkEnd++;
    }

    const hunkLines = diffLines.slice(hunkStart, hunkEnd);
    const firstChangeIndex = hunkLines.findIndex(line => line.type !== 'context');

    const contextBefore = firstChangeIndex > 0 ? hunkLines.slice(0, firstChangeIndex) : [];
    const lines = firstChangeIndex >= 0 ? hunkLines.slice(firstChangeIndex) : hunkLines.slice();

    const oldLines = hunkLines.filter(line => line.oldLine !== null);
    const newLines = hunkLines.filter(line => line.newLine !== null);

    hunks.push({
      oldStart: oldLines.length ? oldLines[0].oldLine : (1 + startLineOffset),
      newStart: newLines.length ? newLines[0].newLine : (1 + startLineOffset),
      oldCount: oldLines.length,
      newCount: newLines.length,
      contextBefore,
      lines
    });

    index = hunkEnd;
  }

  if (!hunks.length) {
    if (returnNullIfNoChanges) return null;

    // Show the content as "Current Version" instead of empty state
    const lines = safeOldText.split(/\r\n?|\n/);
    const lineCount = lines.length;

    let contentHtml = '';
    for (let i = 0; i < lineCount; i++) {
      contentHtml += `
        <div class="diff-line diff-line-context">
          <span class="diff-line-marker"> </span>
          <span class="diff-line-num">${i + 1 + startLineOffset}</span>
          <pre class="diff-line-text"><code>${escapeHtml(lines[i])}</code></pre>
        </div>
      `;
    }

    return `
      <div class="segmented-control" style="cursor: default; grid-template-columns: 1fr;">
        <div class="segmented-control-slider" style="width: calc(100% - 8px);"></div>
        <label style="cursor: default; color: var(--text-primary);">Current Version</label>
      </div>
      <div class="diff-viewer-shell ${currentDiffStyle}">
        <div class="diff-viewer-unified">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  // Generate style switcher was removed - now in settings
  const styleSwitcherHtml = '';

  // Choose rendering based on user preference
  if (diffViewFormat === 'split') {
    return `
      ${styleSwitcherHtml}
      <div class="segmented-control" style="cursor: default;">
        <input type="radio" name="diffHeaderSplit" id="diffHeaderLeft" checked disabled>
        <label for="diffHeaderLeft" style="cursor: default;">${leftLabel}</label>
        <input type="radio" name="diffHeaderSplit" id="diffHeaderRight" disabled>
        <label for="diffHeaderRight" style="cursor: default;">${rightLabel}</label>
        <div class="segmented-control-slider"></div>
      </div>
      <div class="diff-viewer-shell ${currentDiffStyle}">
        <div class="diff-viewer-split">
          ${renderHunksWithSeparators(hunks, 'split', totalLines, diffId, startLineOffset)}
        </div>
      </div>
    `;
  } else {
    // Unified format (default)
    return `
      ${styleSwitcherHtml}
      <div class="diff-header-unified">
        <div class="diff-header-text">
          ${leftLabel} vs ${rightLabel}
        </div>
      </div>
      <div class="diff-viewer-shell ${currentDiffStyle}">
        <div class="diff-viewer-unified">
          ${renderHunksWithSeparators(hunks, 'unified', totalLines, diffId, startLineOffset)}
        </div>
      </div>
    `;
  }
}

// Helper function to render hunks with separators for gaps
function renderHunksWithSeparators(hunks, format = 'unified', totalLines = 0, diffId = null, startLineOffset = 0) {
  if (hunks.length === 0) return '';

  const parts = [];

  // Add top expander if the first hunk doesn't start at line 1 (plus offset)
  if (hunks.length > 0) {
    const firstHunk = hunks[0];
    // Use oldStart because that refers to the original file line numbers
    const effectiveStartLine = 1 + startLineOffset;
    if (firstHunk.oldStart > effectiveStartLine) {
      const lineCount = firstHunk.oldStart - effectiveStartLine;
      const expanderId = `expander-top-${diffId || Date.now()}`;

      parts.push(`
        <div class="diff-expand-separator" id="${expanderId}" onclick="expandDiffContext('${expanderId}', ${effectiveStartLine}, ${firstHunk.oldStart - 1}, '${diffId}', ${startLineOffset}, '${format}')">
          <span class="diff-expand-icon">⋯</span> Expand ${lineCount} line${lineCount !== 1 ? 's' : ''} above
        </div>
      `);
    }
  }

  for (let i = 0; i < hunks.length; i++) {
    const currentHunk = hunks[i];
    const previousHunk = i > 0 ? hunks[i - 1] : null;

    // Add expandable separator if there's a gap between hunks
    if (previousHunk) {
      const prevOldEnd = previousHunk.oldStart + previousHunk.oldCount;
      // const prevNewEnd = previousHunk.newStart + previousHunk.newCount;
      const currentOldStart = currentHunk.oldStart;
      // const currentNewStart = currentHunk.newStart;
      const gap = currentOldStart - prevOldEnd;

      // If gap is larger than 0 lines, add an expandable separator
      if (gap > 0) {
        const lineCount = gap;
        const expanderId = `expander-${i}-${diffId || Date.now()}`;

        parts.push(`
          <div class="diff-expand-separator" id="${expanderId}" onclick="expandDiffContext('${expanderId}', ${prevOldEnd}, ${currentOldStart - 1}, '${diffId}', ${startLineOffset}, '${format}')">
            <span class="diff-expand-icon">⋯</span> Expand ${lineCount} line${lineCount !== 1 ? 's' : ''}
          </div>
        `);
      }
    }

    // Render the hunk
    if (format === 'split') {
      parts.push(renderSplitHunk(currentHunk, i));
    } else {
      parts.push(renderUnifiedHunk(currentHunk, i));
    }
  }

  // Add bottom expander if the last hunk doesn't end at the last line
  if (hunks.length > 0 && totalLines > 0) {
    const lastHunk = hunks[hunks.length - 1];
    const lastHunkEnd = lastHunk.oldStart + lastHunk.oldCount; // The line AFTER the last line of the hunk

    console.log('[BottomExpander] Debug:', {
      lastHunkOldStart: lastHunk.oldStart,
      lastHunkOldCount: lastHunk.oldCount,
      lastHunkEnd,
      totalLines,
      shouldShow: lastHunkEnd <= totalLines,
      diffId,
      startLineOffset
    });

    // If the hunk ends before the total lines
    // Note: oldStart is 1-based. If oldStart=1, oldCount=1, lastHunkEnd=2.
    // If totalLines=2, we want lines 2 to 2. So if lastHunkEnd <= totalLines
    if (lastHunkEnd <= totalLines) {
      const lineCount = totalLines - lastHunkEnd + 1;
      const expanderId = `expander-bottom-${diffId || Date.now()}`;

      parts.push(`
        <div class="diff-expand-separator" id="${expanderId}" onclick="expandDiffContext('${expanderId}', ${lastHunkEnd}, ${totalLines}, '${diffId}', ${startLineOffset}, '${format}')">
          <span class="diff-expand-icon">⋯</span> Expand ${lineCount} line${lineCount !== 1 ? 's' : ''} below
        </div>
      `);
    }
  }

  return parts.join('');
}

function renderDiff(commitContent, currentContent, targetElement = null, options = {}) {
  // If targetElement is a string, query it
  let container = targetElement;
  if (typeof targetElement === 'string') {
    container = document.querySelector(targetElement);
  }

  // Default to .diff-container if no target provided (backward compatibility for Timeline)
  if (!container) {
    container = document.querySelector('.diff-container');
  }

  if (!container) {
    console.error('renderDiff: Target container not found');
    return;
  }

  const diffHtml = generateDiff(currentContent, commitContent, {
    leftLabel: options.leftLabel || 'Current Version',
    rightLabel: options.rightLabel || 'Backup Version',
    startLineOffset: options.startLineOffset || 0,
    filePath: options.filePath || ''
  });

  container.innerHTML = diffHtml;
  return diffHtml; // Return content for check if needed
}

function renderUnifiedHunk(hunk, index) {
  const completeLines = [...(hunk.contextBefore || []), ...hunk.lines];

  // Pre-process lines to add character highlighting
  let i = 0;
  while (i < completeLines.length) {
    // Look for a block of removed lines followed by added lines
    if (completeLines[i].type === 'removed') {
      const removedBlock = [];
      const addedBlock = [];
      let j = i;

      // Collect consecutive removed lines
      while (j < completeLines.length && completeLines[j].type === 'removed') {
        removedBlock.push(completeLines[j]);
        j++;
      }

      // Collect consecutive added lines immediately following
      while (j < completeLines.length && completeLines[j].type === 'added') {
        addedBlock.push(completeLines[j]);
        j++;
      }

      // If we have both removed and added lines, try to highlight them
      if (removedBlock.length > 0 && addedBlock.length > 0) {
        const maxCount = Math.max(removedBlock.length, addedBlock.length);

        for (let k = 0; k < maxCount; k++) {
          const removedLine = removedBlock[k];
          const addedLine = addedBlock[k];

          if (removedLine && addedLine) {
            // Both exist, so we can diff them
            const { leftHtml, rightHtml } = highlightWordDiffs(removedLine.text, addedLine.text);
            removedLine.htmlContent = leftHtml;
            addedLine.htmlContent = rightHtml;
          }
          // If one exists but not the other, no highlighting needed (it's a full line add/remove)
        }
      }

      // Advance outer loop
      i = j;
    } else {
      i++;
    }
  }

  const rowsHtml = completeLines.map(line => renderUnifiedLine(line)).join('');

  return `
    <div class="diff-hunk" id="diff-hunk-${index}">
      ${rowsHtml}
    </div>
  `;
}

function renderUnifiedLine(line) {
  // Use pre-calculated HTML content if available, otherwise escape text
  const content = line.htmlContent || escapeHtml(line.text);

  if (line.type === 'context') {
    return `
      <div class="diff-line diff-line-context">
        <span class="diff-line-marker"> </span>
        <span class="diff-line-num">${line.oldLine || line.newLine || ''}</span>
        <pre class="diff-line-text"><code>${content}</code></pre>
      </div>
    `;
  } else if (line.type === 'added') {
    return `
      <div class="diff-line diff-line-added">
        <span class="diff-line-marker">+</span>
        <span class="diff-line-num">${line.newLine || ''}</span>
        <pre class="diff-line-text"><code>${content}</code></pre>
      </div>
    `;
  } else if (line.type === 'removed') {
    return `
      <div class="diff-line diff-line-removed">
        <span class="diff-line-marker">-</span>
        <span class="diff-line-num">${line.oldLine || ''}</span>
        <pre class="diff-line-text"><code>${content}</code></pre>
      </div>
    `;
  }
  return '';
}

function renderSplitHunk(hunk, index) {
  const oldCount = hunk.oldCount || 1;
  const newCount = hunk.newCount || 1;
  const oldEnd = oldCount ? hunk.oldStart + oldCount - 1 : hunk.oldStart;
  const newEnd = newCount ? hunk.newStart + newCount - 1 : hunk.newStart;
  const summary = `Lines ${hunk.oldStart}${oldEnd !== hunk.oldStart ? `-${oldEnd}` : ''} → ${hunk.newStart}${newEnd !== hunk.newStart ? `-${newEnd}` : ''}`;
  const completeLines = [...(hunk.contextBefore || []), ...hunk.lines];
  const rowsHtml = renderSplitRows(completeLines);
  const contextLineCount = completeLines.filter(line => line.type === 'context').length;
  const hunkId = `diff-hunk-${index}`;
  const showLabel = 'Expand context';
  const hideLabel = 'Collapse context';

  // We're simplifying context toggling for now by always showing it expanded or just not hiding it
  // But we'll keep the structure ready
  const buttonHtml = '';
  const hunkClasses = 'diff-hunk';

  return `
    <div class="${hunkClasses}" id="${hunkId}">
      <div class="diff-hunk-content">
        ${rowsHtml}
      </div>
      <div class="diff-hunk-footer">
        <div class="diff-hunk-summary" style="display: none;">${summary}</div>
        ${buttonHtml}
      </div>
    </div>
  `;
}

function renderSplitRows(lines) {
  const rows = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.type === 'context') {
      rows.push(renderSplitRow(
        {
          type: 'context',
          text: line.text,
          lineNumber: line.oldLine,
          marker: ''
        },
        {
          type: 'context',
          text: line.text,
          lineNumber: line.newLine,
          marker: ''
        }
      ));
      index++;
      continue;
    }

    if (line.type === 'removed') {
      const removed = [];
      const added = [];

      while (index < lines.length && lines[index].type === 'removed') {
        removed.push(lines[index]);
        index++;
      }

      while (index < lines.length && lines[index].type === 'added') {
        added.push(lines[index]);
        index++;
      }

      const maxRows = Math.max(removed.length, added.length);
      for (let i = 0; i < maxRows; i++) {
        rows.push(renderSplitRow(
          removed[i]
            ? {
              type: 'removed',
              text: removed[i].text,
              lineNumber: removed[i].oldLine,
              marker: '-'
            }
            : {
              type: 'empty',
              text: '',
              lineNumber: null,
              marker: ''
            },
          added[i]
            ? {
              type: 'added',
              text: added[i].text,
              lineNumber: added[i].newLine,
              marker: '+'
            }
            : {
              type: 'empty',
              text: '',
              lineNumber: null,
              marker: ''
            }
        ));
      }

      continue;
    }

    if (line.type === 'added') {
      const added = [];

      while (index < lines.length && lines[index].type === 'added') {
        added.push(lines[index]);
        index++;
      }

      added.forEach(entry => {
        rows.push(renderSplitRow(
          {
            type: 'empty',
            text: '',
            lineNumber: null,
            marker: ''
          },
          {
            type: 'added',
            text: entry.text,
            lineNumber: entry.newLine,
            marker: '+'
          }
        ));
      });

      continue;
    }

    rows.push(renderSplitRow(
      {
        type: line.type,
        text: line.text,
        lineNumber: line.oldLine,
        marker: ' '
      },
      {
        type: line.type,
        text: line.text,
        lineNumber: line.newLine,
        marker: ' '
      }
    ));
    index++;
  }

  return rows.join('');
}

function renderSplitRow(left, right) {
  // Check if we have a modified line (both sides present and not context/empty)
  if (left.type === 'removed' && right.type === 'added') {
    const { leftHtml, rightHtml } = highlightWordDiffs(left.text, right.text);
    left.htmlContent = leftHtml;
    right.htmlContent = rightHtml;
  }

  return `
    <div class="diff-row ${left.type === 'context' && right.type === 'context' ? 'diff-row-context' : ''}">
      <div class="diff-cell diff-cell-left">
        ${renderLineContent(left, 'left')}
      </div>
      <div class="diff-cell diff-cell-right">
        ${renderLineContent(right, 'right')}
      </div>
    </div>
  `;
}

function highlightWordDiffs(oldText, newText) {
  // Use Diff.diffWords to find word-level differences
  const diff = Diff.diffWords(oldText, newText);
  let leftHtml = '';
  let rightHtml = '';

  diff.forEach(part => {
    const escapedValue = escapeHtml(part.value);
    if (part.added) {
      rightHtml += `<span class="diff-word-add">${escapedValue}</span>`;
    } else if (part.removed) {
      leftHtml += `<span class="diff-word-rem">${escapedValue}</span>`;
    } else {
      leftHtml += escapedValue;
      rightHtml += escapedValue;
    }
  });

  return { leftHtml, rightHtml };
}

function renderLineContent(line, position) {
  if (line.type === 'empty') {
    return '<div class="diff-line diff-line-empty"></div>';
  }

  const marker = line.marker || (line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ');
  const lineNum = line.lineNumber || '';
  const lineClass = `diff-line diff-line-${line.type}`;

  return `
    <div class="${lineClass} diff-line-${position}">
      <span class="diff-line-marker">${marker}</span>
      <span class="diff-line-num">${lineNum}</span>
      <pre class="diff-line-text"><code>${line.htmlContent || escapeHtml(line.text)}</code></pre>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Store original content for expand functionality
const diffContexts = {}; // Map of diffId -> oldText

function expandDiffContext(expanderId, startLine, endLine, diffId, offset = 0, format = 'unified') {
  const expander = document.getElementById(expanderId);
  if (!expander) return;

  // Retrieve content from the specific diff context
  const content = diffContexts[diffId];

  // If no stored content, can't expand
  if (!content) {
    expander.textContent = 'Content not available';
    return;
  }

  const lines = content.split(/\r\n?|\n/);
  // Adjust slicing for offset
  const startIndex = Math.max(0, startLine - 1 - offset);
  const endIndex = Math.max(0, endLine - offset);
  const contextLines = lines.slice(startIndex, endIndex);

  // Build HTML for context lines
  let contextHtml = '';
  for (let i = 0; i < contextLines.length; i++) {
    const lineNum = startLine + i;
    const lineText = contextLines[i];
    const escapedText = escapeHtml(lineText);

    if (format === 'split') {
      contextHtml += `
        <div class="diff-row diff-row-context">
          <div class="diff-cell diff-cell-left">
            <div class="diff-line diff-line-context diff-line-left">
              <span class="diff-line-marker"> </span>
              <span class="diff-line-num">${lineNum}</span>
              <pre class="diff-line-text"><code>${escapedText}</code></pre>
            </div>
          </div>
          <div class="diff-cell diff-cell-right">
            <div class="diff-line diff-line-context diff-line-right">
              <span class="diff-line-marker"> </span>
              <span class="diff-line-num">${lineNum}</span>
              <pre class="diff-line-text"><code>${escapedText}</code></pre>
            </div>
          </div>
        </div>
      `;
    } else {
      contextHtml += `
        <div class="diff-line diff-line-context">
          <span class="diff-line-marker"> </span>
          <span class="diff-line-num">${lineNum}</span>
          <pre class="diff-line-text"><code>${escapedText}</code></pre>
        </div>
      `;
    }
  }

  // Replace expander with context lines
  expander.outerHTML = contextHtml;
}

function closeModal() {
  document.getElementById('diffModal').classList.remove('active');
  modalData = null;
}

// Restore preview modal functions

function closeRestorePreview() {
  document.getElementById('restorePreviewModal').classList.remove('active');
  restorePreviewData = null;
}

function showNotification(message, type = 'success', duration = 3000, action = null) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  notification.appendChild(messageSpan);

  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'notification-action-btn';
    actionBtn.textContent = action.label;
    actionBtn.onclick = () => {
      action.callback();
      notification.remove();
    };
    notification.appendChild(actionBtn);

    // Extend duration if there's an action
    if (duration === 3000) duration = 8000;
  }

  // Add to page
  document.body.appendChild(notification);

  // Auto-remove after specified duration
  setTimeout(() => {
    notification.style.animation = 'notificationSlideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, duration);
}

async function restartHomeAssistant() {
  try {
    // Just fire off the request silently - we don't care about the response
    // Any response (success, 504, timeout, etc.) means the restart is happening
    fetch(`${API}/ha/restart`, { method: 'POST' }).catch(() => {
      // Ignore errors - they're expected during restart
    });
  } catch (error) {
    // This shouldn't happen, but log it just in case
    console.log('Restart initiated:', error);
  }
}

async function showRestorePreview(filePath, commitHash, commitDate) {
  console.log(`[UI] Loading restore preview for ${filePath} at commit ${commitHash.substring(0, 8)}`);

  try {
    // Show modal immediately with loading state
    document.getElementById('restorePreviewTitle').textContent = `Preview Restore: ${filePath}`;
    document.getElementById('restorePreviewInfo').innerHTML =
      `<strong>Restoring to:</strong> ${commitDate}<br>
           <strong>Commit:</strong> ${commitHash.substring(0, 8)}<br>
           <strong>Note:</strong> This will OVERWRITE the current file on disk<br>
           <div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">
             This view shows your current file compared to the selected version
           </div>`;

    document.getElementById('restoreDiffContent').innerHTML = '<div class="empty">Loading diff...</div>';
    document.getElementById('restorePreviewModal').classList.add('active');

    // Get both current file and commit version in parallel
    const [currentResponse, commitResponse] = await Promise.all([
      fetch(`${API}/file-content?filePath=${encodeURIComponent(filePath)}`),
      fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(filePath)}&commitHash=${commitHash}`)
    ]);

    const currentData = await currentResponse.json();
    const commitData = await commitResponse.json();

    if (!commitData.success) {
      showNotification('Error loading file version for preview', 'error');
      return;
    }

    // Render single-column diff
    const currentLines = currentData.success ? currentData.content.split(/\r\n?|\n/) : [];
    const commitLines = commitData.content.split(/\r\n?|\n/);
    const diffHtml = generateClippedDiffHTML(currentLines, commitLines, 3);


    document.getElementById('restoreDiffContent').innerHTML = diffHtml || '<div class="empty">File is empty</div>';

    // Store data for restore
    restorePreviewData = { filePath, commitHash };
    console.log(`[UI] Restore preview loaded successfully`);

  } catch (error) {
    console.error('Error loading restore preview:', error);
    showNotification('Error loading restore preview: ' + error.message, 'error');
    closeRestorePreview();
  }
}

async function showAutomationRestorePreview(automationId, commitHash, commitDate) {
  console.log(`[UI] Loading automation restore preview for ${automationId} at commit ${commitHash.substring(0, 8)}`);

  try {
    const auto = allAutomations.find(a => a.id === automationId);
    if (!auto) {
      showNotification('Automation not found', 'error');
      return;
    }

    // Show modal immediately with loading state
    document.getElementById('restorePreviewTitle').textContent = `Preview Restore: ${auto.name}`;
    document.getElementById('restorePreviewInfo').innerHTML =
      `<strong>Automation:</strong> ${auto.name}<br>
           <strong>Restoring to:</strong> ${commitDate}<br>
           <strong>Commit:</strong> ${commitHash.substring(0, 8)}<br>
           <strong>Note:</strong> This will OVERWRITE the current automation<br>
           <div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">
             This view shows your current automation compared to the selected version
           </div>`;

    document.getElementById('restoreDiffContent').innerHTML = '<div class="empty">Loading diff...</div>';
    document.getElementById('restorePreviewModal').classList.add('active');

    // Get the automation history and find the specific commit
    const response = await fetch(`${API}/automation/${encodeURIComponent(automationId)}/history`);
    const data = await response.json();

    if (!data.success) {
      showNotification('Error loading automation history for preview', 'error');
      return;
    }

    // Find the commit in history
    const commit = data.history.find(c => c.hash === commitHash);
    if (!commit) {
      showNotification('Commit not found in automation history', 'error');
      return;
    }

    // Get current and commit content
    const currentContent = dumpYaml(auto.content);
    const commitContent = dumpYaml(commit.automation);

    // Render single-column diff
    const currentLines = currentContent.split(/\r\n?|\n/);
    const commitLines = commitContent.split(/\r\n?|\n/);
    const diffHtml = generateClippedDiffHTML(currentLines, commitLines, 3);

    document.getElementById('restoreDiffContent').innerHTML = diffHtml || '<div class="empty">No changes</div>';

    // Store data for restore
    restorePreviewData = { automationId, commitHash };
    console.log(`[UI] Automation restore preview loaded successfully`);

  } catch (error) {
    console.error('Error loading automation restore preview:', error);
    showNotification('Error loading automation restore preview: ' + error.message, 'error');
    closeRestorePreview();
  }
}

async function showScriptRestorePreview(scriptId, commitHash, commitDate) {
  console.log(`[UI] Loading script restore preview for ${scriptId} at commit ${commitHash.substring(0, 8)}`);

  try {
    const script = allScripts.find(s => s.id === scriptId);
    if (!script) {
      showNotification('Script not found', 'error');
      return;
    }

    // Show modal immediately with loading state
    document.getElementById('restorePreviewTitle').textContent = `Preview Restore: ${script.name}`;
    document.getElementById('restorePreviewInfo').innerHTML =
      `<strong>Script:</strong> ${script.name}<br>
           <strong>Restoring to:</strong> ${commitDate}<br>
           <strong>Commit:</strong> ${commitHash.substring(0, 8)}<br>
           <strong>Note:</strong> This will OVERWRITE the current script<br>
           <div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">
             This view shows your current script compared to the selected version
           </div>`;

    document.getElementById('restoreDiffContent').innerHTML = '<div class="empty">Loading diff...</div>';
    document.getElementById('restorePreviewModal').classList.add('active');

    // Get the script history and find the specific commit
    const response = await fetch(`${API}/script/${encodeURIComponent(scriptId)}/history`);
    const data = await response.json();

    if (!data.success) {
      showNotification('Error loading script history for preview', 'error');
      return;
    }

    // Find the commit in history
    const commit = data.history.find(c => c.hash === commitHash);
    if (!commit) {
      showNotification('Commit not found in script history', 'error');
      return;
    }

    // Get current and commit content
    const currentContent = dumpYaml(script.content);
    const commitContent = dumpYaml(commit.script);

    // Render single-column diff
    const currentLines = currentContent.split(/\r\n?|\n/);
    const commitLines = commitContent.split(/\r\n?|\n/);
    const diffHtml = generateClippedDiffHTML(currentLines, commitLines, 3);

    document.getElementById('restoreDiffContent').innerHTML = diffHtml || '<div class="empty">No changes</div>';

    // Store data for restore
    restorePreviewData = { scriptId, commitHash };
    console.log(`[UI] Script restore preview loaded successfully`);

  } catch (error) {
    console.error('Error loading script restore preview:', error);
    showNotification('Error loading script restore preview: ' + error.message, 'error');
    closeRestorePreview();
  }
}

async function showCommitRestorePreview(commitHash, commitDate) {
  console.log(`[UI] Loading commit restore preview for ${commitHash.substring(0, 8)}`);

  try {
    // Get commit info
    const commit = allCommits.find(c => c.hash === commitHash);
    const commitMessage = commit ? commit.message : '';

    // If commitDate is not provided, try to get it from the commit object
    if (!commitDate && commit) {
      commitDate = new Date(commit.date).toLocaleString();
    }

    // Show modal immediately with loading state
    document.getElementById('restorePreviewTitle').textContent = `Preview Restore: Commit ${commitHash.substring(0, 8)}`;
    document.getElementById('restorePreviewInfo').innerHTML =
      `<strong>Restoring to:</strong> ${commitDate}<br>
           <strong>Commit:</strong> ${commitHash.substring(0, 8)}<br>
           <strong>Message:</strong> ${commitMessage}<br>
           <strong>Note:</strong> This will restore all files changed in this commit<br>
           <div style="margin-top: 8px; font-size: 12px; color: var(--text-tertiary);">
             This view shows the changes that will be applied to your files
           </div>`;

    document.getElementById('restoreDiffContent').innerHTML = '<div class="empty">Loading diff...</div>';
    document.getElementById('restorePreviewModal').classList.add('active');

    // First get the list of files in this commit
    const detailsResponse = await fetch(`${API}/git/commit-details?commitHash=${commitHash}`);
    const detailsData = await detailsResponse.json();

    if (!detailsData.success) {
      showNotification('Error loading commit details for preview', 'error');
      return;
    }

    // Parse files from status
    const lines = detailsData.status.split('\n').filter(line => line.trim());
    const files = lines.slice(1).map(line => {
      const parts = line.split('\t');
      return { status: parts[0], file: parts[1] };
    }).filter(f => f.file);

    // For each file, get current content and commit version, then compare
    let allDiffsHtml = '';

    for (const file of files) {
      try {
        // Get current file content
        const currentResponse = await fetch(`${API}/file-content?filePath=${encodeURIComponent(file.file)}`);
        const currentData = await currentResponse.json();
        const currentContent = currentData.success ? currentData.content : '';

        // Get commit version content
        const commitResponse = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file.file)}&commitHash=${commitHash}`);
        const commitData = await commitResponse.json();
        const commitContent = commitData.success ? commitData.content : '';

        // Compare them
        const currentLines = currentContent.split(/\r\n?|\n/);
        const commitLines = commitContent.split(/\r\n?|\n/);
        const diffHtml = generateClippedDiffHTML(currentLines, commitLines, 3);

        // Add file header if there's a diff
        if (diffHtml.trim()) {
          allDiffsHtml += `<div class="diff-view-container">
                <div style="color: var(--text-secondary); font-size: 12px; margin-bottom: 8px; font-weight: bold;">
                  ${file.file} (${file.status === 'A' ? 'Added' : file.status === 'D' ? 'Deleted' : 'Modified'})
                </div>
                ${diffHtml}
              </div>`;
        }
      } catch (error) {
        console.error(`Error comparing file ${file.file}:`, error);
      }
    }

    if (allDiffsHtml) {
      document.getElementById('restoreDiffContent').innerHTML = allDiffsHtml;
    } else {
      document.getElementById('restoreDiffContent').innerHTML = '<div class="empty">No changes detected</div>';
    }

    // Store data for restore
    restorePreviewData = { commitHash };
    console.log(`[UI] Commit restore preview loaded successfully`);

  } catch (error) {
    console.error('Error loading commit restore preview:', error);
    showNotification('Error loading commit restore preview: ' + error.message, 'error');
    closeRestorePreview();
  }
}

async function doRestore() {
  if (!restorePreviewData) {
    showNotification('No restore data available', 'error');
    return;
  }

  const { filePath, commitHash, automationId, scriptId } = restorePreviewData;

  try {
    console.log(`[UI] Confirming restore...`);

    if (filePath) {
      // Restore file
      const response = await fetch(`${API}/restore-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, commitHash })
      });
      const data = await response.json();

      if (data.success) {
        const key = data.reloaded ? 'timeline.single_file_restored_reloaded' : 'timeline.single_file_restored';
        const message = t(key).replace('{file}', filePath);

        // Check if it's a Lovelace file and offer restart
        if (filePath.includes('.storage/lovelace')) {
          showNotification(message, 'success', 8000, {
            label: 'Restart Home Assistant',
            callback: restartHomeAssistant
          });
        } else {
          showNotification(message, 'success');
        }

        closeRestorePreview();
        refreshCurrent();
      } else {
        showNotification('Error: ' + data.error, 'error');
      }
    } else if (commitHash && !automationId && !scriptId) {
      // Restore commit (no filePath means this is a commit restore from History tab)
      const response = await fetch(`${API}/restore-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitHash })
      });
      const data = await response.json();

      if (data.success) {
        // Build message based on what was reloaded
        const files = data.files || [];
        const fileNames = files.join(', ');

        let message;
        if (data.automationReloaded || data.scriptReloaded) {
          // Show "restored and reloaded" message like other tabs
          message = t('timeline.files_restored_and_reloaded', { files: fileNames });
        } else {
          // Simple restored message
          message = t('timeline.files_restored', { files: fileNames });
        }

        showNotification(message);
        closeRestorePreview();
        refreshCurrent();
      } else {
        showNotification('Error: ' + data.error, 'error');
      }
    } else if (automationId) {
      // Restore automation
      const response = await fetch(`${API}/automation/${encodeURIComponent(automationId)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitHash })
      });
      const data = await response.json();

      if (data.success) {
        const auto = allAutomations.find(a => a.id === automationId);
        const key = data.reloaded ? 'automations.automation_restored_reloaded' : 'automations.automation_restored';
        const message = t(key).replace('{name}', auto ? auto.name : automationId);
        showNotification(message);
        closeRestorePreview();
        loadAutomations();
      } else {
        showNotification('Error: ' + data.error, 'error');
      }
    } else if (scriptId) {
      // Restore script
      const response = await fetch(`${API}/script/${encodeURIComponent(scriptId)}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitHash })
      });
      const data = await response.json();

      if (data.success) {
        const script = allScripts.find(s => s.id === scriptId);
        const key = data.reloaded ? 'scripts.script_restored_reloaded' : 'scripts.script_restored';
        const message = t(key).replace('{name}', script ? script.name : scriptId);
        showNotification(message);
        closeRestorePreview();
        loadScripts();
      } else {
        showNotification('Error: ' + data.error, 'error');
      }
    } else {
      showNotification('Unknown restore type', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring: ' + error.message, 'error');
  }
}


async function confirmRestore(file, hash) {
  try {
    const response = await fetch(`${API}/restore-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: file,
        commitHash: hash
      })
    });

    const result = await response.json();

    if (result.success) {
      const key = result.reloaded ? 'timeline.single_file_restored_reloaded' : 'timeline.single_file_restored';
      const message = t(key).replace('{file}', file);

      // Check if it's a Lovelace file and offer restart
      if (file.includes('.storage/lovelace')) {
        showNotification(message, 'success', 8000, {
          label: 'Restart Home Assistant',
          callback: restartHomeAssistant
        });
      } else {
        showNotification(message, 'success');
      }

      closeModal();
      refreshCurrent();
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring file: ' + error.message, 'error');
  }
}

async function viewFileAtCommit(file, hash) {
  try {
    const response = await fetch(`${API}/git/file-at-commit?filePath=${encodeURIComponent(file)}&commitHash=${hash}`);
    const data = await response.json();

    if (data.success) {
      modalData = { file, hash, content: data.content };
      showModal(file, hash, data.content, '');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function restoreFile(file, hash) {
  try {
    const response = await fetch(`${API}/restore-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: file, commitHash: hash })
    });
    const data = await response.json();

    if (data.success) {
      const key = data.reloaded ? 'timeline.single_file_restored_reloaded' : 'timeline.single_file_restored';
      const message = t(key).replace('{file}', file);

      // Check if it's a Lovelace file and offer restart
      if (file.includes('.storage/lovelace')) {
        showNotification(message, 'success', 8000, {
          label: 'Restart Home Assistant',
          callback: restartHomeAssistant
        });
      } else {
        showNotification(message, 'success');
      }

      refreshCurrent();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring file: ' + error.message, 'error');
  }
}

async function restoreCommit(hash) {
  try {
    const response = await fetch(`${API}/restore-commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitHash: hash })
    });
    const data = await response.json();

    if (data.success) {
      let message = '';
      const isReloaded = data.automationReloaded || data.scriptReloaded;

      if (data.files && data.files.length === 1) {
        // Single file restored
        const filePath = data.files[0];
        // Use full path or relative path, not just filename to be more descriptive
        const key = isReloaded ? 'timeline.single_file_restored_reloaded' : 'timeline.single_file_restored';
        message = t(key).replace('{file}', filePath);

        // Check if it's a Lovelace file and offer restart
        if (filePath.includes('.storage/lovelace')) {
          showNotification(message, 'success', 8000, {
            label: 'Restart Home Assistant',
            callback: restartHomeAssistant
          });
          refreshCurrent();
          return; // Exit early since we handled notification
        }
      } else if (data.files && data.files.length > 1) {
        // Multiple files restored
        const key = isReloaded ? 'timeline.multiple_files_restored_reloaded' : 'timeline.multiple_files_restored';
        message = t(key).replace('{count}', data.files.length);

        // Check if any are Lovelace files
        const hasLovelace = data.files.some(f => f.includes('.storage/lovelace'));
        if (hasLovelace) {
          showNotification(message, 'success', 8000, {
            label: 'Restart Home Assistant',
            callback: restartHomeAssistant
          });
          refreshCurrent();
          return; // Exit early
        }
      } else {
        // Fallback
        message = data.message || t('timeline.commit_restored');
      }

      showNotification(message, 'success');
      refreshCurrent();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error restoring commit: ' + error.message, 'error');
  }
}

// Long-press handling for hard reset
let restorePressTimer = null;
let restorePressStage = 0; // 0=normal, 1=holding, 2=unlocked
let currentRestoreHash = null;

function handleRestoreButtonDown(hash) {
  currentRestoreHash = hash;
  restorePressStage = 1;

  const btn = document.getElementById('restore-commit-btn');
  if (!btn) return;

  // Start timer for 2 seconds - no visual feedback until unlock
  restorePressTimer = setTimeout(() => {
    restorePressStage = 2;
    btn.classList.add('unlocked');

    // Update button text
    const textEl = document.getElementById('restore-btn-text');
    if (textEl) {
      textEl.textContent = 'RESET ALL FILES';
    }

    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, 2000);
}

function handleRestoreButtonUp(hash) {
  clearTimeout(restorePressTimer);

  const btn = document.getElementById('restore-commit-btn');

  if (restorePressStage === 2) {
    // Unlocked! Show hard reset confirmation
    showHardResetConfirmation(hash);
  } else {
    // Normal click - restore just this commit's files
    restoreCommit(hash);
  }

  // Reset state
  resetRestoreButtonState();
}

function handleRestoreButtonCancel() {
  clearTimeout(restorePressTimer);
  resetRestoreButtonState();
}

function resetRestoreButtonState() {
  restorePressStage = 0;
  currentRestoreHash = null;

  const btn = document.getElementById('restore-commit-btn');
  if (btn) {
    btn.classList.remove('unlocked');
  }

  const textEl = document.getElementById('restore-btn-text');
  if (textEl && textEl.textContent === 'RESET ALL FILES') {
    textEl.textContent = t('timeline.restore_commit');
  }
}

function showHardResetConfirmation(hash) {
  // Find the commit info
  const commit = allCommits.find(c => c.hash === hash);

  let formattedDate = 'Unknown';
  if (commit) {
    const dateObj = new Date(commit.date);
    // Format: Nov 26 2025 7:30:51 AM (remove commas)
    const options = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    };
    formattedDate = dateObj.toLocaleString('en-US', options).replace(/,/g, '');
  }

  // Create minimal modal HTML
  const modalHTML = `
    <div class="modal-backdrop active" id="hard-reset-modal" onclick="if(event.target === this) closeHardResetModal()">
      <div class="modal-content hard-reset-dialog">
        <h3>Reset All Files?</h3>
        
        <p>This will reset all files back to ${formattedDate}.</p>
        
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeHardResetModal()">Cancel</button>
          <button class="btn btn-danger" onclick="confirmHardReset('${hash}')">Reset All Files</button>
        </div>
      </div>
    </div>
  `;

  // Add to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Focus cancel button by default
  setTimeout(() => {
    const cancelBtn = document.querySelector('#hard-reset-modal .btn-secondary');
    if (cancelBtn) cancelBtn.focus();
  }, 100);
}

function closeHardResetModal() {
  const modal = document.getElementById('hard-reset-modal');
  if (modal) {
    modal.remove();
  }
  resetRestoreButtonState();
}

async function confirmHardReset(hash) {
  closeHardResetModal();

  try {
    showNotification('Creating safety backup and resetting...', 'info', 5000);

    const response = await fetch(`${API}/git/hard-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitHash: hash,
        createBackup: true
      })
    });

    const data = await response.json();

    if (data.success) {
      const backupMsg = data.backupCommitHash
        ? ` Safety backup created at ${data.backupCommitHash.substring(0, 8)}.`
        : '';
      showNotification(
        `All files reset to commit ${hash.substring(0, 8)}.${backupMsg} Refreshing...`,
        'success',
        5000
      );

      // Refresh the view
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Hard reset error:', error);
    showNotification('Error performing hard reset: ' + error.message, 'error');
  }
}

// Toggle file diff section (for multi-file commits)
function toggleFileDiff(header) {
  const content = header.nextElementSibling;
  const isExpanded = header.classList.contains('expanded');

  if (isExpanded) {
    header.classList.remove('expanded');
    header.classList.add('collapsed');
    content.style.display = 'none';
  } else {
    header.classList.remove('collapsed');
    header.classList.add('expanded');
    content.style.display = 'block';
  }
}


// Load initial view
loadTimeline();

function stepInput(id, step) {
  const input = document.getElementById(id);
  if (input) {
    const val = parseInt(input.value) || 0;
    const min = parseInt(input.min) || 1;
    const newVal = val + step;
    if (newVal >= min) {
      input.value = newVal;
      // Trigger change event if needed
      input.dispatchEvent(new Event('change'));
    }
  }
}