# Config Selector Testing Instructions

## Problem That Was Fixed

The `onChange` callback was not firing when selecting a config from the dropdown because:

1. When `switchConfig()` was called, it called `init()` again
2. `init()` called `setupConfigSelector()`, which created a **NEW** ConfigSelector instance
3. The onChange listener was attached to the **old** instance, not the new one
4. Therefore, changing the dropdown value would emit events that nobody was listening to

## The Fix

Modified `setupConfigSelector()` to only create the ConfigSelector instance once:

```javascript
if (!this.configSelector) {
  // Create new instance and attach listener
  this.configSelector = new ConfigSelector(configSelectorContainer, initialPath);
  this.configSelector.onChange(async ({ path }) => {
    // ... handle change
  });
} else {
  // Just update the path on existing instance
  if (initialPath) {
    this.configSelector.setCurrentConfig(initialPath);
  }
}
```

## How to Test

### Prerequisites
1. Server must be restarted for the `/api/configs` endpoint to be available:
   ```bash
   # Stop the server (Ctrl+C)
   python3 server.py
   ```

2. Ensure you have config files in the data directory:
   - `data/lombok/lombok.json`
   - `data/porgera/porgera.json`

### Test Steps

1. **Open the application**: Navigate to `http://localhost:3000/`

2. **Check the dropdown is visible**:
   - You should see a "Location:" dropdown in the header
   - It should populate with "Lombok" and "Porgera" options

3. **Open browser console** (F12 or Cmd+Opt+I):
   - This will show debug logs from the ConfigSelector

4. **Select a different config**:
   - Click the dropdown
   - Select a different location (e.g., if currently on Porgera, select Lombok)

5. **Verify console output**:
   You should see logs like:
   ```
   ConfigSelector: select changed to "data/lombok/lombok.json", current="data/porgera/porgera.json"
   ConfigSelector: calling selectConfig()
   ConfigSelector: emitting 'change' event. path="data/lombok/lombok.json", previousPath="data/porgera/porgera.json"
   ConfigSelector: listener count for 'change' event: 1
   Config selector onChange fired: data/lombok/lombok.json
   Switching config from data/porgera/porgera.json to data/lombok/lombok.json
   loading config
   Config switched successfully to: data/lombok/lombok.json
   ```

6. **Verify application reloads**:
   - Status should show "Switching configuration..."
   - Then "Loading configuration..."
   - Then "Loading data..."
   - Application should reload with the new dataset
   - The tile counter and info panel should update

### Automated Test

You can also run the automated test:

1. Navigate to `http://localhost:3000/tests/config_selector.test.html`
2. Click "Run Test 3" to test the onChange event
3. Click "Initialize Manual Test" for interactive testing with event logging

## Expected Behavior

- **Before the fix**: Selecting a config did nothing, no console logs, app didn't reload
- **After the fix**: Selecting a config triggers reload, console shows debug logs, app switches to new dataset

## Debugging

If the onChange callback still doesn't fire:

1. Check console for errors
2. Verify listener count in console logs (should be 1)
3. Check that the ConfigSelector instance persists:
   ```javascript
   // In browser console:
   window.landslideApp.configSelector
   // Should return the ConfigSelector instance
   ```
4. Verify that configs are loading:
   ```bash
   curl http://localhost:3000/api/configs
   # Should return JSON with lombok and porgera configs
   ```
