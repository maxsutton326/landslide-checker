# Claude Code Prompts
## Landslide Data Quality Assessment System

### Instructions for Use
Each prompt below should be copied directly into a new Claude Code session. The prompts are self-contained and include all necessary context. Claude Code should write tests first, then implement the code, and iterate until all tests pass.

---

## Week 1: Foundation Setup

### Session 1.1: Environment & Test Data Setup

```
Create a new project for the Landslide Data Quality Assessment System. This system will evaluate the quality of landslide mapping data by comparing multiple image sources.

Project structure needed:
- src/ (source code)
  - data/ (data loading modules)
  - utils/ (utility functions)
  - viz/ (visualization components)
- tests/ (test files)
- data/ (sample data)
- config/ (configuration files)
- docs/ (documentation)

Create the following:

1. Project setup files:
   - package.json with dependencies: papaparse, js-yaml, proj4
   - .gitignore for node_modules, data files, and temporary files
   - README.md with project overview

2. Configuration system (src/config/config_loader.js):
   - Parse YAML configuration files
   - Validate required fields
   - Default values for optional fields
   - Export configuration object

3. Sample configuration (config/sample_config.yaml):
```yaml
project:
  name: "Test_Landslides"
  date: "2025-01-01"
  
data_sources:
  numpy_stack:
    file: "data/test_stack.npy"
    epsg: 32610
    origin: [500000, 4200000]
    pixel_size: 10
    before_index: 0
    after_index: 1
    
  shapefile:
    file: "data/landslides.shp"
    id_field: "FID"
    
  source_images:
    - file: "data/source1.tif"
      type: "after"
    - file: "data/source2.tif"
      type: "after"
      
  predictions:
    file: "data/predictions.npy"
    default_index: 1
    
display:
  context_buffer: 1.5
  min_window: 128
  max_window: 512
  
labels:
  - code: 0
    name: "Not Evaluated"
    color: "#808080"
  - code: 1
    name: "Correct Mapping"
    color: "#00FF00"
  - code: 2
    name: "Mapping Error"
    color: "#FF0000"
```

4. Test data generator (tests/generate_test_data.js):
   - Create mock 4D NumPy array (2×100×100×3) with random values 0-1
   - Generate 10 polygon geometries
   - Create sample GeoTIFF metadata
   - Save as test files

5. Tests for configuration system (tests/test_config.js):
   - Test valid configuration loading
   - Test missing required fields
   - Test invalid data types
   - Test default value application

Write comprehensive tests FIRST, then implement the code. Ensure all tests pass.
Use modern JavaScript (ES6+) with modules. Add JSDoc comments for all functions.
```

---

### Session 1.2: Data Loading Pipeline

```
Continue the Landslide Data Quality Assessment System. Create data loading modules for all input types.

Context: We have a 4D NumPy array (time × rows × columns × bands), shapefiles with landslide polygons, GeoTIFF source images, and 3D prediction arrays.

Create the following modules:

1. NumPy array loader (src/data/numpy_loader.js):
   - Read binary .npy files (implement NPY format parser)
   - Parse header to get shape and dtype
   - Validate dimensions (4D array expected)
   - Validate data range (0.0 to 1.0 for float32)
   - Return structured object with data and metadata
   
   NPY format specification:
   - Magic string: \x93NUMPY
   - Version: major, minor bytes
   - Header length (little-endian uint16)
   - Header dictionary with 'descr', 'fortran_order', 'shape'
   - Data in specified dtype

2. Shapefile loader (src/data/shapefile_loader.js):
   - Use shapefile.js library to read .shp files
   - Extract polygon geometries
   - Read projection from .prj file
   - Extract attributes including ID field
   - Convert to GeoJSON format internally
   - Return array of feature objects

3. GeoTIFF loader (src/data/geotiff_loader.js):
   - Use geotiff.js library to read TIFF files
   - Extract image data as typed arrays
   - Read georeferencing (origin, pixel size, projection)
   - Handle multi-band images
   - Normalize to 0-1 range if needed
   - Return object with image data and spatial reference

4. Prediction array loader (src/data/prediction_loader.js):
   - Read 3D NumPy arrays (time × rows × columns)
   - Validate dimensions match main data
   - Validate probability range (0.0 to 1.0)
   - Return structured object

5. Data validator (src/data/validator.js):
   - Check projection consistency across all datasets
   - Verify spatial alignment
   - Validate array dimensions compatibility
   - Generate validation report
   - Throw errors for critical mismatches

6. Integration module (src/data/data_manager.js):
   - Load all data sources from configuration
   - Run validation checks
   - Cache loaded data
   - Provide unified access interface
   - Handle missing optional data gracefully

Tests needed (tests/test_data_loading.js):
- Test each loader with valid data
- Test each loader with invalid data
- Test projection mismatch detection
- Test dimension validation
- Test missing file handling
- Test data manager integration

Install additional dependencies:
- shapefile (for shapefile reading)
- geotiff (for GeoTIFF reading)

Write tests FIRST. Implement robust error handling. All tests must pass.
Include progress callbacks for large file loading.
```

---

### Session 1.3: Coordinate System & Display Logic

```
Continue the Landslide Data Quality Assessment System. Implement coordinate transformation and display window calculation.

Context: We have loaded 4D arrays, shapefiles, and GeoTIFFs. Now we need to handle coordinate transformations and calculate display windows for each landslide.

Create these modules:

1. Coordinate transformer (src/utils/coordinates.js):
   - Convert pixel indices to geographic coordinates
   - Convert geographic coordinates to pixel indices
   - Handle different projections using proj4
   - Support affine transformations
   
   Functions needed:
   - pixelToGeo(row, col, origin, pixelSize, epsg)
   - geoToPixel(x, y, origin, pixelSize, epsg)
   - transformBounds(bounds, fromEpsg, toEpsg)
   - createTransform(origin, pixelSize, rotation=0)

2. Display window calculator (src/utils/window_calculator.js):
   - Extract polygon bounding box
   - Apply context buffer (multiply bounds by factor)
   - Enforce min/max window constraints
   - Center window on polygon centroid
   - Return window specification object
   
   Window specification:
   {
     centerX: geographic coordinate,
     centerY: geographic coordinate,
     width: display width in pixels,
     height: display height in pixels,
     pixelSize: computed pixel size,
     bounds: {minX, minY, maxX, maxY} in geo coords
   }

3. Image cropping utilities (src/utils/image_cropper.js):
   - Extract subset from 4D NumPy array
   - Extract subset from GeoTIFF
   - Extract subset from prediction array
   - Handle out-of-bounds with padding
   - Resample if needed for display
   
   Functions:
   - cropArray4D(array, rowStart, rowEnd, colStart, colEnd, timeIndex)
   - cropGeoTiff(tiffData, bounds, targetSize)
   - cropPredictions(array, rowStart, rowEnd, colStart, colEnd)
   - padArray(array, padWidth, padValue)

4. Spatial index builder (src/utils/spatial_index.js):
   - Build R-tree index for polygons
   - Support spatial queries
   - Find polygons by ID
   - Get polygon by index
   - Calculate total bounds
   
   Use rbush library for R-tree implementation

5. Data synchronization (src/utils/synchronizer.js):
   - Verify all data sources cover same area
   - Check resolution compatibility
   - Align data to common grid if needed
   - Generate alignment report
   - Cache transformation parameters

Tests needed (tests/test_coordinates.js, tests/test_windows.js):
- Test coordinate transformations (forward and inverse)
- Test window calculation with various polygon sizes
- Test image cropping with edge cases
- Test padding for out-of-bounds
- Test spatial index queries
- Test data synchronization

Sample test data needed:
- Create 3 test polygons (small, medium, large)
- Create test arrays with known patterns
- Test with different projections

Dependencies to add:
- proj4 (coordinate transformations)
- rbush (spatial indexing)

Write comprehensive tests FIRST. Handle edge cases like polygons at image boundaries.
All coordinate math should be precise to at least 6 decimal places.
```

---

### Session 1.4: Basic Visualization

```
Continue the Landslide Data Quality Assessment System. Create the basic single-panel visualization.

Context: We have data loading and coordinate systems working. Now create a web interface to display landslides.

Create these files:

1. Main HTML file (index.html):
```html
<!DOCTYPE html>
<html>
<head>
    <title>Landslide Data Quality Assessment</title>
    <link rel="stylesheet" href="src/viz/styles.css">
</head>
<body>
    <div id="app">
        <div id="header">
            <h1>Landslide Quality Assessment</h1>
            <div id="status"></div>
        </div>
        <div id="viewer-container">
            <canvas id="main-canvas"></canvas>
            <div id="controls">
                <button id="zoom-in">+</button>
                <button id="zoom-out">-</button>
                <button id="reset-view">Reset</button>
            </div>
        </div>
        <div id="info-panel">
            <div id="coordinates"></div>
            <div id="landslide-info"></div>
        </div>
    </div>
    <script type="module" src="src/viz/app.js"></script>
</body>
</html>
```

2. Canvas renderer (src/viz/canvas_renderer.js):
   - Convert NumPy array to ImageData
   - Handle RGB float to uint8 conversion
   - Draw image on canvas
   - Support zoom and pan
   - Maintain aspect ratio
   
   Class: CanvasRenderer
   - constructor(canvasElement)
   - renderArray(array, bounds)
   - renderPolygon(geometry, style)
   - setView(centerX, centerY, zoom)
   - clear()

3. Polygon renderer (src/viz/polygon_renderer.js):
   - Convert GeoJSON to canvas paths
   - Apply semi-transparent fill
   - Add stroke for visibility
   - Support highlighting
   - Handle complex polygons
   
   Functions:
   - drawPolygon(ctx, coordinates, transform, style)
   - polygonToPath(coordinates, transform)
   - applyStyle(ctx, style)

4. View controller (src/viz/view_controller.js):
   - Handle mouse events for pan
   - Handle wheel events for zoom
   - Track view state
   - Emit view change events
   - Constrain to valid bounds
   
   Class: ViewController
   - constructor(canvas, initialBounds)
   - enablePan()
   - enableZoom()
   - getTransform()
   - setConstraints(minZoom, maxZoom, bounds)

5. Main application (src/viz/app.js):
   - Load configuration
   - Initialize data manager
   - Create renderer
   - Load first landslide
   - Wire up controls
   - Display coordinates on hover
   
   Application flow:
   1. Load config
   2. Load data
   3. Get first landslide
   4. Calculate window
   5. Crop data
   6. Render image
   7. Overlay polygon
   8. Setup interactions

6. Styles (src/viz/styles.css):
   - Clean, professional layout
   - Dark theme for better image viewing
   - Responsive design
   - Clear visual hierarchy

Tests needed (tests/test_visualization.js):
- Test array to ImageData conversion
- Test polygon rendering
- Test view transformations
- Test zoom/pan constraints
- Test event handlers

Create test utilities:
- Mock canvas context
- Test image patterns
- Synthetic polygons

Performance requirements:
- Render at 30+ FPS during pan/zoom
- Handle images up to 512×512 pixels
- Smooth interactions

Write tests for critical rendering functions.
Implement proper error handling for missing data.
Add loading states and error messages to UI.
```

---

## Week 2: Multi-Panel Development

### Session 2.1: Panel Layout Architecture

```
Continue the Landslide Data Quality Assessment System. Extend to multi-panel synchronized display.

Context: We have a working single-panel viewer. Now create a 5-panel synchronized display system.

Refactor and create:

1. Panel class (src/viz/panel.js):
   - Encapsulate single panel functionality
   - Support different data types
   - Maintain own canvas element
   - Sync with other panels
   
   Class: Panel
   - constructor(container, type, label)
   - setData(data, metadata)
   - setView(transform)
   - getView()
   - render()
   - clear()
   - on(event, callback)
   - Types: 'source', 'planet', 'prediction'

2. Panel manager (src/viz/panel_manager.js):
   - Coordinate multiple panels
   - Broadcast view changes
   - Manage data distribution
   - Handle synchronized updates
   
   Class: PanelManager
   - constructor()
   - addPanel(panel)
   - setMasterPanel(panel)
   - broadcastView(transform)
   - updateAll(landslideData)
   - setTimeIndex(index)

3. Updated HTML layout (index.html):
```html
<div id="panel-grid">
    <div class="panel" id="source-1">
        <div class="panel-header">Source Image 1</div>
        <canvas></canvas>
    </div>
    <div class="panel" id="source-2">
        <div class="panel-header">Source Image 2</div>
        <canvas></canvas>
    </div>
    <div class="panel" id="planet-before">
        <div class="panel-header">Planet Before</div>
        <canvas></canvas>
    </div>
    <div class="panel" id="planet-after">
        <div class="panel-header">Planet After</div>
        <canvas></canvas>
    </div>
    <div class="panel" id="prediction">
        <div class="panel-header">Prediction</div>
        <canvas></canvas>
    </div>
</div>
```

4. Synchronization controller (src/viz/sync_controller.js):
   - Detect user interactions on any panel
   - Calculate relative transforms
   - Apply to all panels
   - Debounce rapid updates
   - Maintain smooth performance
   
   Class: SyncController
   - constructor(panels)
   - enableSync()
   - disableSync()
   - setLeadPanel(panel)
   - getSyncState()

5. Layout manager (src/viz/layout_manager.js):
   - Handle responsive grid layout
   - Resize panels appropriately
   - Maintain aspect ratios
   - Support fullscreen mode
   - Handle panel visibility
   
   Functions:
   - createGrid(container, rows, cols)
   - resizePanels()
   - toggleFullscreen(panel)
   - optimizeLayout(screenSize)

6. Enhanced styles (src/viz/styles.css):
   - Grid layout with flexbox/grid
   - Panel borders and headers
   - Hover effects
   - Active panel indication
   - Responsive breakpoints

Tests needed (tests/test_panels.js):
- Test panel creation and data setting
- Test view synchronization
- Test panel manager coordination
- Test layout responsiveness
- Test event propagation

Performance requirements:
- Synchronize 5 panels at 30+ FPS
- Smooth zoom/pan across all panels
- Efficient memory usage
- No lag in interactions

Implement panel-specific features:
- Prediction panel: show heatmap colors
- Source panels: handle missing data
- Planet panels: temporal indication

All panels must stay perfectly synchronized during interactions.
```

---

### Session 2.2: Data-Panel Integration

```
Continue the Landslide Data Quality Assessment System. Connect data sources to panels and add temporal controls.

Context: We have a 5-panel layout with synchronization. Now connect each panel to its data source and add controls.

Create these components:

1. Data router (src/data/data_router.js):
   - Map panels to data sources
   - Handle data transformations
   - Cache processed data
   - Manage temporal indices
   
   Class: DataRouter
   - constructor(dataManager, config)
   - assignDataToPanel(panel, dataType)
   - getDataForPanel(panelId, timeIndex)
   - updateTimeIndex(index)
   - clearCache()

2. Dynamic scaler (src/viz/dynamic_scaler.js):
   - Calculate optimal display size
   - Based on polygon size
   - Apply context buffer
   - Respect min/max constraints
   
   Functions:
   - calculateDisplayWindow(polygon, config)
   - getOptimalPixelSize(bounds, targetPixels)
   - applyConstraints(window, config)

3. Temporal navigator (src/viz/temporal_navigator.js):
   - Create time slider UI
   - Show current index
   - Update relevant panels
   - Display timestamps
   
   Class: TemporalNavigator
   - constructor(container, timeSteps)
   - onChange(callback)
   - setIndex(index)
   - next()
   - previous()
   - play(fps)

4. Threshold controller (src/viz/threshold_controller.js):
   - Create threshold slider
   - Range 0.0 to 1.0
   - Apply to predictions
   - Show current value
   - Real-time updates
   
   Class: ThresholdController
   - constructor(container, initialValue)
   - onChange(callback)
   - getValue()
   - setValue(value)

5. Enhanced prediction renderer (src/viz/prediction_renderer.js):
   - Apply color mapping to probabilities
   - Use threshold for display
   - Create heatmap visualization
   - Support different color schemes
   
   Functions:
   - renderPrediction(ctx, data, threshold, colormap)
   - createColormap(name) // 'viridis', 'plasma', 'hot'
   - applyThreshold(value, threshold)

6. Data preprocessor (src/data/preprocessor.js):
   - Normalize data for display
   - Handle different data ranges
   - Apply corrections if needed
   - Generate histograms for adjustment
   
   Functions:
   - normalizeArray(array, percentiles)
   - enhanceContrast(array, method)
   - computeHistogram(array, bins)

7. Updated app controller (src/viz/app.js):
   - Wire up all components
   - Handle data flow
   - Manage state
   - Update UI elements
   
   Application state:
   {
     currentLandslide: index,
     timeIndex: number,
     threshold: float,
     zoom: float,
     center: {x, y}
   }

UI elements to add (update index.html):
```html
<div id="temporal-controls">
    <label>Time: <span id="time-label"></span></label>
    <input type="range" id="time-slider" min="0" max="1" value="1">
    <button id="play-button">▶</button>
</div>
<div id="threshold-controls">
    <label>Threshold: <span id="threshold-label">0.5</span></label>
    <input type="range" id="threshold-slider" min="0" max="1" step="0.01" value="0.5">
</div>
```

Tests needed (tests/test_data_integration.js):
- Test data routing to correct panels
- Test temporal navigation
- Test threshold application
- Test dynamic scaling
- Test state management

Performance optimization:
- Cache scaled images
- Debounce slider updates
- Use requestAnimationFrame
- Optimize redraw regions

Ensure all panels update smoothly when controls change.
Maintain 30+ FPS during slider manipulation.
```

---

### Session 2.3: Navigation System

```
Continue the Landslide Data Quality Assessment System. Implement navigation between landslides.

Context: We have panels displaying data with temporal controls. Now add navigation between different landslides.

Create navigation components:

1. Landslide navigator (src/viz/landslide_navigator.js):
   - Track current landslide index
   - Load previous/next
   - Handle first/last cases
   - Emit change events
   - Preload adjacent landslides
   
   Class: LandslideNavigator
   - constructor(landslides, dataManager)
   - getCurrent()
   - next()
   - previous()
   - goTo(index)
   - goToId(id)
   - preloadAdjacent()
   - getTotalCount()
   - getCurrentIndex()

2. Progress tracker (src/viz/progress_tracker.js):
   - Show current position
   - Display total count
   - Visual progress bar
   - Track labeled vs unlabeled
   - Calculate completion percentage
   
   Class: ProgressTracker
   - constructor(container, total)
   - update(current, labeled)
   - getStats()
   - reset()

3. Quick jump interface (src/viz/quick_jump.js):
   - Search by landslide ID
   - Autocomplete suggestions
   - Recent history
   - Bookmarks support
   
   Class: QuickJump
   - constructor(container, landslides)
   - onSelect(callback)
   - addToHistory(id)
   - showSuggestions(query)

4. Keyboard handler (src/viz/keyboard_handler.js):
   - Map keys to actions
   - Show help overlay
   - Customizable bindings
   - Prevent conflicts
   
   Default bindings:
   - Arrow keys: navigate
   - Space: play/pause time
   - Numbers 1-6: quick labels
   - H: show help
   - J: jump to ID
   - R: reset view
   - F: fullscreen

5. Transition effects (src/viz/transitions.js):
   - Smooth transitions between landslides
   - Fade effects
   - Loading indicators
   - Progress animations
   
   Functions:
   - fadeTransition(fromCanvas, toCanvas, duration)
   - showLoading(panel)
   - hideLoading(panel)

6. Navigation state manager (src/state/navigation_state.js):
   - Track navigation history
   - Support undo/redo
   - Save position on refresh
   - Restore last position
   
   Class: NavigationState
   - constructor()
   - pushState(landslideId)
   - canUndo()
   - undo()
   - redo()
   - saveToSession()
   - restoreFromSession()

7. Performance optimizer (src/utils/performance.js):
   - Implement virtual scrolling
   - Lazy load images
   - Cache recent views
   - Dispose unused data
   - Monitor memory usage
   
   Class: PerformanceMonitor
   - trackMemory()
   - trackFPS()
   - suggestOptimizations()
   - clearCache()

Updated UI elements (index.html):
```html
<div id="navigation-bar">
    <button id="first-btn">⏮</button>
    <button id="prev-btn">◀</button>
    <span id="current-position">1 / 100</span>
    <button id="next-btn">▶</button>
    <button id="last-btn">⏭</button>
    <input type="text" id="jump-input" placeholder="Jump to ID...">
    <div id="progress-bar">
        <div id="progress-fill"></div>
    </div>
</div>
<div id="help-overlay" class="hidden">
    <h3>Keyboard Shortcuts</h3>
    <dl id="shortcuts-list"></dl>
</div>
```

Tests needed (tests/test_navigation.js):
- Test navigation boundaries
- Test jump to specific ID
- Test keyboard shortcuts
- Test history management
- Test preloading
- Test memory management

Features to implement:
- Smooth scrolling between landslides
- Breadcrumb trail
- Filter by label status
- Sort options

Ensure navigation is responsive (<100ms transition).
Preload next/previous for instant switching.
```

---

## Week 3: Labeling Implementation

### Session 3.1: Label Interface Design

```
Continue the Landslide Data Quality Assessment System. Create the labeling interface.

Context: We have navigation and display working. Now add the ability to label each landslide.

Create labeling components:

1. Label panel (src/viz/label_panel.js):
   - Radio button group for labels
   - Confidence selector
   - Notes textarea
   - Visual feedback
   - Keyboard shortcuts
   
   Class: LabelPanel
   - constructor(container, labelConfig)
   - getValue()
   - setValue(labelCode)
   - getConfidence()
   - getNotes()
   - clear()
   - onChange(callback)
   - enableKeyboardShortcuts()

HTML structure:
```html
<div id="label-panel">
    <h3>Classification</h3>
    <div id="label-options">
        <!-- Generated from config -->
    </div>
    <div id="confidence-selector">
        <label>Confidence:</label>
        <select id="confidence">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
        </select>
    </div>
    <div id="notes-section">
        <label>Notes:</label>
        <textarea id="notes" rows="3"></textarea>
    </div>
    <div id="label-actions">
        <button id="clear-label">Clear</button>
        <button id="apply-label">Apply</button>
    </div>
</div>
```

2. Label manager (src/data/label_manager.js):
   - Store labels in memory
   - Map to landslide IDs
   - Track modifications
   - Support undo/redo
   - Calculate statistics
   
   Class: LabelManager
   - constructor()
   - setLabel(landslideId, label, confidence, notes)
   - getLabel(landslideId)
   - removeLabel(landslideId)
   - getAllLabels()
   - getStatistics()
   - undo()
   - redo()
   - hasUnsavedChanges()

3. Label validator (src/data/label_validator.js):
   - Check required fields
   - Validate label codes
   - Ensure consistency
   - Generate warnings
   
   Functions:
   - validateLabel(label)
   - checkCompleteness(labels, landslides)
   - findInconsistencies(labels)
   - generateReport(labels)

4. Visual feedback system (src/viz/feedback.js):
   - Color code by label
   - Show label status in UI
   - Flash on save
   - Highlight unlabeled
   - Show validation errors
   
   Functions:
   - showSuccess(message)
   - showError(message)
   - showWarning(message)
   - highlightElement(element)
   - updateLabelIndicator(status)

5. Auto-save mechanism (src/data/autosave.js):
   - Save labels periodically
   - Save on navigation
   - Recover from crash
   - Show save status
   
   Class: AutoSave
   - constructor(labelManager, interval)
   - start()
   - stop()
   - saveNow()
   - recover()
   - onSave(callback)

6. Bulk operations (src/data/bulk_operations.js):
   - Apply label to multiple
   - Copy label forward
   - Clear range
   - Batch update
   
   Functions:
   - applyToRange(startId, endId, label)
   - copyPrevious()
   - clearAll()
   - applyToFiltered(filter, label)

7. Keyboard shortcuts for labeling:
   - Number keys 1-6 for quick labels
   - Enter to apply and next
   - Backspace to clear
   - Tab to cycle confidence
   - Ctrl+Z/Y for undo/redo

Tests needed (tests/test_labeling.js):
- Test label storage and retrieval
- Test undo/redo functionality
- Test validation rules
- Test auto-save
- Test keyboard shortcuts
- Test bulk operations

Style updates (src/viz/styles.css):
- Label panel styling
- Color coding system
- Active state indication
- Validation error styles
- Save status indicator

Ensure labels persist across sessions.
Provide clear visual feedback for all actions.
Make labeling efficient with keyboard shortcuts.
```

---

### Session 3.2: Label Persistence

```
Continue the Landslide Data Quality Assessment System. Implement label persistence and progress tracking.

Context: We have the label interface. Now add persistence, progress tracking, and session management.

Create persistence components:

1. Storage adapter (src/data/storage_adapter.js):
   - Abstract storage interface
   - Support different backends
   - Handle serialization
   - Manage versioning
   
   Class: StorageAdapter
   - save(key, data)
   - load(key)
   - delete(key)
   - exists(key)
   - list()
   
   Implementations:
   - MemoryStorage (for current session)
   - IndexedDBStorage (for browser persistence)
   - FileStorage (for export/import)

2. Session manager (src/data/session_manager.js):
   - Create new sessions
   - Load existing sessions
   - Track session metadata
   - Handle multiple sessions
   
   Class: SessionManager
   - constructor(storageAdapter)
   - createSession(name, metadata)
   - loadSession(sessionId)
   - listSessions()
   - deleteSession(sessionId)
   - getCurrentSession()
   - switchSession(sessionId)

Session structure:
```javascript
{
  id: 'uuid',
  name: 'Session Name',
  created: Date,
  modified: Date,
  landslideCount: number,
  labelsCount: number,
  labels: Map,
  config: Object,
  statistics: Object
}
```

3. Progress calculator (src/data/progress_calculator.js):
   - Track completion percentage
   - Calculate time estimates
   - Generate statistics
   - Identify gaps
   
   Class: ProgressCalculator
   - constructor(totalLandslides)
   - update(labeledCount)
   - getPercentComplete()
   - getTimeEstimate(ratePerHour)
   - getStatistics()
   - findUnlabeled()

4. Statistics dashboard (src/viz/statistics_dashboard.js):
   - Show label distribution
   - Display progress charts
   - Time tracking
   - Productivity metrics
   
   Class: StatisticsDashboard
   - constructor(container)
   - update(statistics)
   - showCharts()
   - exportReport()

HTML for statistics:
```html
<div id="statistics-panel">
    <h3>Progress Statistics</h3>
    <div id="progress-summary">
        <div class="stat-item">
            <span class="stat-label">Completed:</span>
            <span class="stat-value" id="completed-count">0/0</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Percentage:</span>
            <span class="stat-value" id="completion-percent">0%</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Time Elapsed:</span>
            <span class="stat-value" id="time-elapsed">00:00</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Rate:</span>
            <span class="stat-value" id="labeling-rate">0/hr</span>
        </div>
    </div>
    <div id="label-distribution">
        <canvas id="distribution-chart"></canvas>
    </div>
</div>
```

5. Recovery system (src/data/recovery.js):
   - Detect incomplete sessions
   - Offer recovery options
   - Merge conflicts
   - Backup before recovery
   
   Class: RecoveryManager
   - checkForRecovery()
   - recoverSession(sessionId)
   - mergeLabels(existing, recovered)
   - createBackup()

6. Activity logger (src/data/activity_logger.js):
   - Track user actions
   - Record timestamps
   - Calculate metrics
   - Export activity log
   
   Class: ActivityLogger
   - logAction(action, details)
   - getActivity(timeRange)
   - calculateMetrics()
   - exportLog()

7. Progress visualization (src/viz/progress_viz.js):
   - Progress bar with segments
   - Pie chart for labels
   - Timeline view
   - Heatmap of activity
   
   Functions:
   - renderProgressBar(container, progress)
   - renderPieChart(container, distribution)
   - renderTimeline(container, activity)
   - renderHeatmap(container, density)

Tests needed (tests/test_persistence.js):
- Test storage adapters
- Test session creation/loading
- Test recovery scenarios
- Test statistics calculation
- Test activity logging
- Test progress tracking

Performance considerations:
- Batch storage operations
- Compress large datasets
- Limit history size
- Optimize queries

Implement automatic recovery on page reload.
Show clear progress indicators at all times.
Allow export of partial results.
```

---

### Session 3.3: Export Functionality

```
Continue the Landslide Data Quality Assessment System. Implement comprehensive export functionality.

Context: We have labels stored and tracked. Now create export system for results.

Create export components:

1. Export manager (src/data/export_manager.js):
   - Generate CSV output
   - Support multiple formats
   - Include metadata
   - Handle large datasets
   
   Class: ExportManager
   - constructor(labelManager, config)
   - exportCSV(options)
   - exportJSON(options)
   - exportGeoJSON(options)
   - generateReport(format)

CSV format:
```csv
landslide_id,label_code,label_name,confidence,notes,timestamp,user,time_indices_examined,polygon_area,centroid_x,centroid_y
LS_001,1,Correct Mapping,high,"Clear scarp visible",2025-01-15T10:30:00,user1,"0,1",1250.5,500123.4,4200567.8
```

2. Export dialog (src/viz/export_dialog.js):
   - Format selection
   - Filter options
   - Preview generation
   - Download trigger
   
   Class: ExportDialog
   - constructor(container)
   - show()
   - hide()
   - onExport(callback)
   - updatePreview(data)

HTML for export dialog:
```html
<div id="export-dialog" class="modal">
    <div class="modal-content">
        <h2>Export Labels</h2>
        <div id="export-options">
            <label>Format:
                <select id="export-format">
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="geojson">GeoJSON</option>
                </select>
            </label>
            <label>Include:
                <input type="checkbox" id="include-unlabeled"> Unlabeled
                <input type="checkbox" id="include-metadata" checked> Metadata
                <input type="checkbox" id="include-geometry"> Geometry
            </label>
            <label>Filter by label:
                <select id="label-filter">
                    <option value="all">All</option>
                    <!-- Dynamic options -->
                </select>
            </label>
        </div>
        <div id="export-preview">
            <h3>Preview</h3>
            <pre id="preview-content"></pre>
        </div>
        <div class="modal-actions">
            <button id="cancel-export">Cancel</button>
            <button id="confirm-export">Export</button>
        </div>
    </div>
</div>
```

3. Data formatter (src/data/formatters.js):
   - Format for different outputs
   - Handle special characters
   - Apply transformations
   - Validate output
   
   Functions:
   - formatCSV(data, options)
   - formatJSON(data, pretty)
   - formatGeoJSON(data, includeProperties)
   - escapeCSV(value)
   - validateFormat(data, format)

4. Filter system (src/data/filters.js):
   - Filter by label
   - Filter by confidence
   - Filter by date range
   - Complex queries
   
   Class: FilterManager
   - addFilter(type, condition)
   - removeFilter(id)
   - applyFilters(data)
   - getActiveFilters()
   - saveFilterSet(name)

5. Batch exporter (src/data/batch_exporter.js):
   - Handle large datasets
   - Progress indication
   - Chunked processing
   - Memory efficient
   
   Class: BatchExporter
   - constructor(chunkSize)
   - exportLarge(data, format, onProgress)
   - cancel()
   - pause()
   - resume()

6. Report generator (src/data/report_generator.js):
   - Summary statistics
   - Quality metrics
   - Formatted document
   - Charts and graphs
   
   Class: ReportGenerator
   - generateSummary(labels, landslides)
   - generateQualityReport(labels)
   - generateActivityReport(logs)
   - exportPDF(report)

7. Import functionality (src/data/import_manager.js):
   - Import previous exports
   - Validate format
   - Merge with existing
   - Handle conflicts
   
   Class: ImportManager
   - importCSV(file)
   - importJSON(file)
   - validateImport(data)
   - mergeLabels(imported, existing)
   - resolveConflicts(conflicts)

Tests needed (tests/test_export.js):
- Test CSV generation with escaping
- Test JSON formatting
- Test GeoJSON structure
- Test filter application
- Test large dataset export
- Test import validation
- Test merge conflicts

Performance requirements:
- Export 1000+ labels in <1 second
- Handle special characters correctly
- Maintain precision for coordinates
- Compress large exports

Add download progress for large exports.
Validate all exports can be re-imported.
Include session metadata in exports.
```

---

## Week 4: Production Readiness

### Session 4.1: Large Dataset Testing

```
Continue the Landslide Data Quality Assessment System. Optimize for large datasets and production use.

Context: System works for small datasets. Now optimize for 1000+ landslides.

Create optimization components:

1. Virtualized list (src/viz/virtual_list.js):
   - Render only visible items
   - Handle large lists efficiently
   - Smooth scrolling
   - Dynamic height calculation
   
   Class: VirtualList
   - constructor(container, items, rowHeight)
   - renderVisible()
   - scrollTo(index)
   - update(items)
   - onSelect(callback)

2. Data chunking system (src/data/chunk_loader.js):
   - Load data in chunks
   - Progressive loading
   - Background prefetch
   - Memory management
   
   Class: ChunkLoader
   - constructor(dataSource, chunkSize)
   - loadChunk(index)
   - prefetchNext()
   - clearCache()
   - getMemoryUsage()

3. Image tile cache (src/viz/tile_cache.js):
   - Cache rendered tiles
   - LRU eviction policy
   - Size limits
   - Persistence option
   
   Class: TileCache
   - constructor(maxSize)
   - get(key)
   - set(key, data)
   - clear()
   - getSize()
   - evictOldest()

4. Performance profiler (src/utils/profiler.js):
   - Measure operations
   - Identify bottlenecks
   - Generate reports
   - Suggest optimizations
   
   Class: Profiler
   - start(operation)
   - end(operation)
   - measure(fn)
   - getReport()
   - findBottlenecks()

5. Memory monitor (src/utils/memory_monitor.js):
   - Track memory usage
   - Detect leaks
   - Trigger cleanup
   - Alert on threshold
   
   Class: MemoryMonitor
   - constructor(threshold)
   - startMonitoring()
   - getUsage()
   - onThreshold(callback)
   - forceCleanup()

6. Lazy loading system (src/data/lazy_loader.js):
   - Load on demand
   - Placeholder content
   - Priority queue
   - Cancel unnecessary loads
   
   Class: LazyLoader
   - constructor()
   - register(item, loader)
   - load(item, priority)
   - cancelPending()
   - preload(items)

7. Web Worker integration (src/workers/data_worker.js):
   - Offload heavy processing
   - Parallel operations
   - Message passing
   - Error handling
   
   Worker tasks:
   - Image processing
   - Data transformation
   - Statistics calculation
   - Export generation

Main thread interface:
```javascript
class WorkerManager {
    constructor() {
        this.worker = new Worker('data_worker.js');
    }
    
    process(data, operation) {
        return new Promise((resolve, reject) => {
            this.worker.postMessage({data, operation});
            this.worker.onmessage = (e) => resolve(e.data);
            this.worker.onerror = reject;
        });
    }
}
```

8. Stress test suite (tests/stress_test.js):
   - Load 1000+ landslides
   - Rapid navigation
   - Memory limits
   - Concurrent operations
   - Export large datasets
   
   Tests:
   - testLargeDatasetLoad()
   - testRapidNavigation()
   - testMemoryLimit()
   - testConcurrentLabeling()
   - testLargeExport()

9. Performance optimizations:
   - Use requestIdleCallback for non-critical tasks
   - Implement debouncing for frequent updates
   - Use CSS transforms for animations
   - Minimize reflows and repaints
   - Optimize Canvas operations

Configuration for production (config/production.yaml):
```yaml
performance:
  chunk_size: 50
  cache_size: 100
  prefetch_count: 3
  max_memory: 512  # MB
  worker_threads: 4
  
optimizations:
  use_workers: true
  lazy_load: true
  virtual_scroll: true
  compression: true
```

Tests needed (tests/test_performance.js):
- Benchmark all operations
- Memory leak detection
- Load test scenarios
- Worker communication
- Cache effectiveness

Performance targets:
- Initial load: <3 seconds
- Navigation: <100ms
- Label save: <50ms
- Export 1000 items: <2 seconds
- Memory usage: <512MB

Implement graceful degradation for older browsers.
Show performance metrics in development mode.
Add option to disable optimizations for debugging.
```

---

### Session 4.2: Error Handling & Validation

```
Continue the Landslide Data Quality Assessment System. Implement comprehensive error handling and validation.

Context: System needs robust error handling for production use.

Create error handling components:

1. Error boundary system (src/errors/error_boundary.js):
   - Catch all errors
   - Graceful fallbacks
   - Error reporting
   - Recovery options
   
   Class: ErrorBoundary
   - constructor(fallbackUI)
   - catch(error, context)
   - report(error)
   - recover()
   - showFallback()

2. Validation framework (src/validation/validator.js):
   - Input validation
   - Data integrity checks
   - Configuration validation
   - Runtime assertions
   
   Class: Validator
   - validateConfig(config)
   - validateData(data, schema)
   - validateLabel(label)
   - assert(condition, message)

3. Error logger (src/errors/error_logger.js):
   - Structured logging
   - Error categorization
   - Stack trace capture
   - Remote reporting option
   
   Class: ErrorLogger
   - log(level, message, context)
   - logError(error, context)
   - getErrors(filter)
   - clearLogs()
   - exportLogs()

4. User notification system (src/viz/notifications.js):
   - Toast notifications
   - Error dialogs
   - Warning banners
   - Success messages
   
   Class: NotificationManager
   - show(type, message, options)
   - showError(error)
   - showWarning(message)
   - showSuccess(message)
   - clear()

5. Data integrity checker (src/data/integrity_checker.js):
   - Verify data consistency
   - Check references
   - Validate relationships
   - Repair if possible
   
   Class: IntegrityChecker
   - checkDataIntegrity(data)
   - validateReferences(labels, landslides)
   - findOrphans()
   - repairData(issues)

6. Fallback handlers (src/errors/fallbacks.js):
   - Missing data fallbacks
   - Network error handling
   - Browser compatibility
   - Degraded mode operation
   
   Functions:
   - handleMissingData(type)
   - handleNetworkError(error)
   - checkBrowserSupport()
   - enableDegradedMode()

7. Recovery mechanisms (src/errors/recovery.js):
   - Auto-recovery attempts
   - Manual recovery options
   - State restoration
   - Data backup
   
   Class: RecoveryManager
   - attemptAutoRecovery(error)
   - offerManualRecovery()
   - restoreState(backup)
   - createBackup()

Error types to handle:
- Data loading failures
- Invalid configurations
- Memory exhaustion
- Browser incompatibility
- Corrupted data
- Network timeouts
- Worker crashes

User-facing error messages:
```javascript
const ERROR_MESSAGES = {
    DATA_LOAD_FAILED: "Unable to load data. Please check your files and try again.",
    INVALID_CONFIG: "Configuration file is invalid. Please verify the format.",
    MEMORY_LIMIT: "Memory limit reached. Try working with smaller datasets.",
    BROWSER_COMPAT: "Your browser doesn't support required features.",
    CORRUPT_DATA: "Data appears corrupted. Attempting recovery...",
    NETWORK_ERROR: "Network error occurred. Please check your connection.",
    WORKER_CRASH: "Background process failed. Restarting..."
};
```

Tests needed (tests/test_errors.js):
- Test error catching
- Test validation rules
- Test recovery mechanisms
- Test fallback behavior
- Test error logging
- Test user notifications

Implement graceful degradation for all features.
Never show technical errors to users.
Always provide actionable recovery options.
Log all errors for debugging.
```

---

### Session 4.3: Final Integration & Documentation

```
Complete the Landslide Data Quality Assessment System. Final integration, testing, and documentation.

Context: All components built. Now integrate, test comprehensively, and document.

Final integration tasks:

1. Complete application (src/app.js):
   - Wire all components together
   - Initialize in correct order
   - Handle configuration
   - Setup error boundaries
   
   Application initialization:
   ```javascript
   class Application {
       async initialize() {
           try {
               this.config = await ConfigLoader.load('config.yaml');
               this.validateEnvironment();
               this.setupErrorHandling();
               this.initializeData();
               this.createUI();
               this.bindEvents();
               this.restoreSession();
               this.checkForUpdates();
           } catch (error) {
               this.handleInitError(error);
           }
       }
   }
   ```

2. End-to-end test suite (tests/e2e_tests.js):
   - Complete workflow tests
   - User journey scenarios
   - Edge case handling
   - Performance under load
   
   Test scenarios:
   - New user first session
   - Returning user with saved work
   - Large dataset processing
   - Export and re-import
   - Error recovery
   - Multi-session management

3. API documentation (docs/api.md):
   - All public methods
   - Configuration options
   - Event system
   - Extension points
   
   Format:
   ```markdown
   ## Class: LabelManager
   
   ### Methods
   
   #### setLabel(landslideId, label, confidence, notes)
   Sets a label for a landslide.
   
   **Parameters:**
   - `landslideId` (string): Unique identifier
   - `label` (number): Label code from config
   - `confidence` (string): 'high'|'medium'|'low'
   - `notes` (string): Optional notes
   
   **Returns:** void
   
   **Example:**
   \`\`\`javascript
   labelManager.setLabel('LS_001', 1, 'high', 'Clear scarp');
   \`\`\`
   ```

4. User manual (docs/user_manual.md):
   - Getting started guide
   - Feature walkthrough
   - Best practices
   - Troubleshooting
   - FAQ

5. Deployment guide (docs/deployment.md):
   - System requirements
   - Installation steps
   - Configuration guide
   - Performance tuning
   - Maintenance tasks

6. Developer documentation (docs/developer.md):
   - Architecture overview
   - Component descriptions
   - Extension guide
   - Testing strategy
   - Contributing guidelines

7. Configuration examples (config/examples/):
   - Different projection systems
   - Various label schemes
   - Performance profiles
   - Multi-language support

8. Sample datasets (data/samples/):
   - Small test set (10 landslides)
   - Medium test set (100 landslides)
   - Stress test set (1000+ landslides)
   - Edge case examples

9. Build system (build/):
   - Webpack configuration
   - Production build
   - Development server
   - Hot reload setup
   - Bundle optimization

10. Package scripts (package.json):
```json
{
  "scripts": {
    "start": "webpack serve --mode development",
    "build": "webpack --mode production",
    "test": "jest",
    "test:e2e": "jest --config=jest.e2e.config.js",
    "test:stress": "node tests/stress_test.js",
    "lint": "eslint src/",
    "docs": "jsdoc -c jsdoc.config.json",
    "analyze": "webpack-bundle-analyzer"
  }
}
```

11. CI/CD configuration (.github/workflows/ci.yml):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run build
```

12. Final checklist:
   - [ ] All tests passing
   - [ ] Documentation complete
   - [ ] Performance targets met
   - [ ] Error handling comprehensive
   - [ ] Export/import working
   - [ ] Large datasets handled
   - [ ] Browser compatibility verified
   - [ ] Build optimized
   - [ ] Code linted
   - [ ] Security reviewed

Create a demo video showing:
- Loading data
- Navigating landslides
- Applying labels
- Using temporal controls
- Exporting results

Final deliverables:
- Production build
- Complete documentation
- Test results
- Performance report
- Deployment package
```

---

## Testing Strategy for All Sessions

Each session should include this test-driven approach:

```
For every coding session, follow this pattern:

1. Write tests FIRST:
   - Unit tests for individual functions
   - Integration tests for components
   - Edge case tests
   - Error condition tests

2. Run tests to see them fail

3. Implement minimal code to pass tests

4. Refactor for clarity and performance

5. Run all tests to ensure nothing broke

6. Add more tests for discovered edge cases

7. Document all public APIs

8. Commit with descriptive message

Test coverage requirements:
- Minimum 80% code coverage
- All critical paths tested
- All error conditions handled
- Performance benchmarks met

Use this test template:
```javascript
describe('ComponentName', () => {
    beforeEach(() => {
        // Setup
    });
    
    afterEach(() => {
        // Cleanup
    });
    
    it('should perform expected behavior', () => {
        // Arrange
        const input = ...;
        
        // Act
        const result = component.method(input);
        
        // Assert
        expect(result).toBe(expected);
    });
    
    it('should handle error conditions', () => {
        // Test error cases
    });
});
```

Remember: No code is complete until:
1. Tests pass
2. Documentation written
3. Error handling added
4. Performance verified
5. Code reviewed
```