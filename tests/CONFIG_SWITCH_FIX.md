# Config Switch Display Update Fix

## Problem

After selecting a different config from the dropdown:
1. The config would update ✓
2. New images would be requested ✓
3. **But the display would NOT update** ✗

## Root Cause Analysis

The `init()` method was being called multiple times:
1. First call on page load
2. Second call when switching configs

Each call to `init()` would call `setupPanels()` and `setupControls()`, which would:

### setupPanels() Issue
- Create a **NEW** `PanelManager` instance every time
- Create **NEW** `Panel` instances every time
- These new panels would try to attach to the same DOM elements
- The old panels still existed but were orphaned
- The new panels were created but improperly initialized

### setupControls() Issue
- Add duplicate event listeners to buttons every time
- Create new `LabelPanel` instances repeatedly
- Memory leaks from orphaned event handlers

## The Fix

Applied the **singleton pattern** to components that should only be created once:

### 1. setupPanels() - src/viz/app_multi.js:366-416

```javascript
setupPanels() {
  // Only create panels once
  if (!this.panelManager) {
    console.log('Creating panels for the first time');

    // Create panel manager and panels
    this.panelManager = new PanelManager();
    // ... create panels, sync controller, etc.
  } else {
    console.log('Panels already exist, reusing them');
    // Just clear existing panels
    this.panelManager.getAllPanels().forEach(panel => {
      panel.clear();
    });
  }
}
```

### 2. setupControls() - src/viz/app_multi.js:524-558

```javascript
// Initialize Label Panel (only once)
if (!this.labelPanel) {
  const labelPanelContainer = document.getElementById('label-panel-container');
  if (labelPanelContainer) {
    this.labelPanel = new LabelPanel(labelPanelContainer, {
      labels: this.config.labels || [...]
    }, this.interfaceMode);

    this.labelPanel.onApply((state) => {
      this.saveLabelToServer(state);
    });

    this.labelPanel.enableKeyboardShortcuts();
  }
}

// Setup interface mode toggle button (only add listener once)
if (!this.controlsSetup) {
  const toggleModeBtn = document.getElementById('toggle-interface-mode');
  if (toggleModeBtn) {
    toggleModeBtn.addEventListener('click', () => {
      this.toggleInterfaceMode();
    });
  }
  this.controlsSetup = true;
}
```

### 3. setupConfigSelector() - src/viz/app_multi.js:152-173

Already fixed in previous iteration:

```javascript
setupConfigSelector(initialPath = null) {
  const configSelectorContainer = document.getElementById('config-selector-container');
  if (!configSelectorContainer) return;

  // Only create configSelector once
  if (!this.configSelector) {
    this.configSelector = new ConfigSelector(configSelectorContainer, initialPath);

    this.configSelector.onChange(async ({ path }) => {
      if (path && path !== this.currentConfigPath) {
        await this.switchConfig(path);
      }
    });
  } else {
    // Just update the current config path if selector already exists
    if (initialPath) {
      this.configSelector.setCurrentConfig(initialPath);
    }
  }
}
```

## How It Works Now

1. **First init()**: Creates all components (panelManager, panels, labelPanel, configSelector)
2. **Config switch**: Calls `switchConfig()` which:
   - Cleans up navigators and handlers
   - Clears panel contents
   - Calls `init()` again
3. **Second init()**:
   - Reuses existing panelManager and panels ✓
   - Reuses existing labelPanel ✓
   - Reuses existing configSelector ✓
   - Only creates new data-dependent components (DataManager, GridNavigator)
4. **Display updates correctly** because panels are reused, not recreated ✓

## Testing

To verify the fix works:

1. Open the application: `http://localhost:3000/`
2. Open browser console (F12)
3. Select a different config from the dropdown
4. You should see in console:
   ```
   Switching config from data/porgera/porgera.json to data/lombok/lombok.json
   loading config
   Panels already exist, reusing them
   Config switched successfully to: data/lombok/lombok.json
   ```
5. The display should update with images from the new dataset ✓

## Components Now Using Singleton Pattern

✓ `ConfigSelector` - Created once, reused
✓ `PanelManager` - Created once, panels cleared and reused
✓ `Panel` instances - Created once, cleared and reused
✓ `SyncController` - Created once, reused
✓ `LabelPanel` - Created once, reused
✓ Event listeners on DOM buttons - Added once only

## Components That Are Recreated (Correctly)

These need to be recreated when config changes:

- `DataManager` - Different data sources per config
- `GridNavigator` - Different polygons and grid per config
- `KeyboardHandler` - Needs fresh bindings
- `ProgressTracker` - Different total tiles per config
- `ClassCounter` - Different label categories per config

## Summary

The fix ensures that DOM-related components (panels, selectors, label UI) are created only once and reused, while data-dependent components are properly recreated with new config data. This prevents the display update issue and eliminates memory leaks from duplicate event listeners.
