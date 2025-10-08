# Landslide Data Quality Assessment System

A comprehensive system for evaluating the quality of landslide mapping data by comparing multiple image sources and validating mapped features.

## Overview

This system enables quality assessment of landslide detection and mapping by:
- Loading multi-temporal satellite imagery and derivative data
- Comparing mapped landslide polygons against source imagery
- Validating machine learning predictions against ground truth
- Providing interactive visualization for quality control
- Tracking assessment results for reporting and analysis

## Features

- **Multi-source data integration**: NumPy arrays, shapefiles, GeoTIFFs, and predictions
- **Flexible configuration**: YAML-based configuration system with validation
- **Coordinate system support**: Automatic projection handling with proj4
- **Quality labels**: Customizable label codes for different assessment categories
- **Visualization**: Context-aware display with configurable buffer zones

## Project Structure

```
landslide-checker/
├── src/
│   ├── config/         # Configuration loading and validation
│   ├── data/           # Data loading modules
│   ├── utils/          # Utility functions
│   └── viz/            # Visualization components
├── tests/              # Test files
├── data/               # Sample data (not tracked)
├── config/             # Configuration files
└── docs/               # Documentation
```

## Installation

```bash
npm install
```

## Configuration

Create a configuration file based on `config/sample_config.yaml`:

```yaml
project:
  name: "My_Landslide_Project"
  date: "2025-01-01"

data_sources:
  numpy_stack:
    file: "data/imagery_stack.npy"
    epsg: 32610
    # ... additional settings
```

See `config/sample_config.yaml` for full configuration options.

## Quick Start

### 1. Generate Test Data

First, generate sample test data:

```bash
npm run generate-test-data
```

This creates:
- `data/test_stack.json` - Sample satellite imagery (2 time steps, 100×100 pixels, 3 bands)
- `data/landslides.geojson` - 10 sample landslide polygons
- `data/predictions.json` - Sample model predictions
- `data/source1_metadata.json` & `source2_metadata.json` - GeoTIFF metadata

### 2. Launch the Visualization Application

  How to Run:

  1. Start the Node.js server:
  ```
  npm run server
  ```
  1. Server runs on http://localhost:3000
  2. Access the application:
  Open http://localhost:3000/index.html in your browser

### 3. Using the Visualization

**Navigation:**
- **Arrow Keys** or **N/P** - Navigate between landslides
- **Mouse Wheel** - Zoom in/out
- **Click + Drag** - Pan the view
- **R** - Reset view to default
- **+/-** Buttons - Zoom controls

**Display:**
- Satellite imagery is shown in the background
- Landslide polygons are overlaid with semi-transparent fill
- Color indicates confidence: Green (high) → Red (low)
- Hover to see geographic coordinates
- Info panel shows landslide details

## Programmatic Usage

### Loading Configuration

```javascript
import { loadConfig } from './src/config/config_loader.js';

const config = await loadConfig('config/my_config.yaml');
```

### Loading and Processing Data

```javascript
import { DataManager } from './src/core/data_manager.js';
import { calculateDisplayWindow } from './src/utils/window_calculator.js';
import { cropArray4D } from './src/utils/image_cropper.js';

// Initialize data manager
const dataManager = new DataManager(config);
await dataManager.loadAll();

// Get a landslide polygon
const landslide = dataManager.shapefile.features[0];

// Calculate display window
const metadata = await dataManager.loadMetadata('source1');
const origin = [metadata.geoTransform[0], metadata.geoTransform[3]];
const pixelSize = metadata.geoTransform[1];

const displayWindow = calculateDisplayWindow(
  landslide,
  origin,
  pixelSize,
  { contextBuffer: 1.5, minWindowSize: 50 }
);

// Crop imagery for display
const croppedData = cropArray4D(
  dataManager.numpy_stack,
  [2, 100, 100, 3], // shape
  displayWindow.rowStart,
  displayWindow.rowEnd,
  displayWindow.colStart,
  displayWindow.colEnd,
  0 // time index
);
```

### Rendering with Canvas

```javascript
import { CanvasRenderer } from './src/viz/canvas_renderer.js';
import { ViewController } from './src/viz/view_controller.js';

const canvas = document.getElementById('main-canvas');
const renderer = new CanvasRenderer(canvas);
const viewController = new ViewController(canvas, displayWindow.geoBounds);

// Enable interactions
viewController.enablePan();
viewController.enableZoom();

// Render
const transform = viewController.getTransform();
renderer.renderArray(croppedData.data, croppedData.shape, displayWindow.geoBounds, transform);
renderer.renderPolygon(landslide.geometry, { fillColor: 'rgba(255, 255, 0, 0.3)' }, transform);
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- tests/test_config_loader.js
npm test -- tests/test_visualization.js

# Generate test data
npm run generate-test-data
```

## Dependencies

- **papaparse**: CSV parsing for tabular data
- **js-yaml**: YAML configuration file parsing
- **proj4**: Coordinate system transformations

## Data Requirements

### Input Data

1. **NumPy Stack**: Multi-dimensional array (time × height × width × bands)
2. **Shapefiles**: Landslide polygon geometries with attributes
3. **Source Images**: GeoTIFF files for visual assessment
4. **Predictions**: Model output arrays (optional)

### Configuration

All data sources are specified in the YAML configuration file with:
- File paths (relative to project root)
- Coordinate system (EPSG codes)
- Spatial reference information
- Display preferences

## Label System

Default quality assessment labels:
- **0**: Not Evaluated (Gray)
- **1**: Correct Mapping (Green)
- **2**: Mapping Error (Red)

Labels are fully customizable in the configuration file.

## License

MIT
