# Landslide Data Quality Assessment - Architecture

## Overview

This application uses a **client-server architecture** where the Node.js server handles all heavy data loading and the browser requests data slices via API.

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│           Browser (Client)                  │
│  ┌───────────────────────────────────────┐  │
│  │  app_multi.js (Main Application)      │  │
│  │  - UI rendering                       │  │
│  │  - User interaction                   │  │
│  │  - Panel management                   │  │
│  └───────────────────────────────────────┘  │
│               │                              │
│               │ HTTP Requests                │
│               ▼                              │
│  ┌───────────────────────────────────────┐  │
│  │  data_manager.js (API Client)         │  │
│  │  - Fetches metadata                   │  │
│  │  - Requests image slices              │  │
│  │  - No direct file loading             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    │
                    │ REST API (JSON)
                    ▼
┌─────────────────────────────────────────────┐
│         Node.js Server (Backend)            │
│  ┌───────────────────────────────────────┐  │
│  │  server.js (API Endpoints)            │  │
│  │  - /api/config                        │  │
│  │  - /api/data/summary                  │  │
│  │  - /api/landslides                    │  │
│  │  - /api/image/slice                   │  │
│  │  - /api/predictions/slice             │  │
│  │  - /api/transform                     │  │
│  └───────────────────────────────────────┘  │
│               │                              │
│               │ Uses Node.js modules         │
│               ▼                              │
│  ┌───────────────────────────────────────┐  │
│  │  Data Loaders (Node.js only)          │  │
│  │  - numpy_loader.js (uses fs)          │  │
│  │  - shapefile_loader.js (uses fs)      │  │
│  │  - geotiff_loader.js (uses fs)        │  │
│  │  - prediction_loader.js (uses fs)     │  │
│  └───────────────────────────────────────┘  │
│               │                              │
│               ▼                              │
│  ┌───────────────────────────────────────┐  │
│  │  In-Memory Data Cache                 │  │
│  │  - NumPy arrays                       │  │
│  │  - Shapefile features                 │  │
│  │  - Predictions                        │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## File Structure

### Server-Side (Node.js)
- **server.js** - Main server, loads all data, provides API
- **src/data/*_loader.js** - Data loaders using Node.js `fs` module
- **src/data/data_manager_node.js** - Node.js data manager (unused by browser)
- **src/utils/coordinates_node.js** - Node.js coordinates with proj4 (unused by browser)

### Browser-Side (Client)
- **src/viz/app_multi.js** - Main application
- **src/data/data_manager.js** - API client (fetches from server)
- **src/utils/coordinates.js** - Browser coordinates (calls server API for projections)
- **src/viz/*.js** - Visualization components
- **index.html** - Entry point

## API Endpoints

### Configuration
- `GET /api/config?path=config.yaml`
  - Loads configuration and triggers server data loading
  - Returns: Full configuration object

### Data Summary
- `GET /api/data/summary`
  - Returns metadata for all loaded datasets
  - Response: `{ numpy_stack: {...}, shapefile: {...}, predictions: {...} }`

### Landslides
- `GET /api/landslides`
  - Returns all landslide polygon features
  - Response: `{ features: [...], count: N, projection: "EPSG:..." }`

### Image Slices
- `GET /api/image/slice?time=0&band=0&rowStart=0&rowEnd=10&colStart=0&colEnd=10`
  - Returns pixel data for requested window
  - Parameters:
    - `time`: Time index (0=before, 1=after)
    - `band`: Band index
    - `rowStart, rowEnd, colStart, colEnd`: Window bounds (optional)
  - Response: `{ data: [...], shape: [rows, cols] }`

### Prediction Slices
- `GET /api/predictions/slice?class=0&rowStart=0&rowEnd=10&colStart=0&colEnd=10`
  - Returns prediction probabilities for requested class
  - Parameters:
    - `class`: Class index
    - `rowStart, rowEnd, colStart, colEnd`: Window bounds (optional)
  - Response: `{ data: [...], shape: [rows, cols] }`

### Coordinate Transformations
- `GET /api/transform?x=500000&y=4200000&from=32610&to=4326`
  - Transforms a point between projections
  - Response: `{ x: ..., y: ... }`

- `GET /api/transform-bounds?minX=...&minY=...&maxX=...&maxY=...&from=32610&to=4326`
  - Transforms bounding box between projections
  - Response: `{ minX: ..., minY: ..., maxX: ..., maxY: ... }`

## Data Flow

### Startup Sequence
1. Server starts: `npm run server`
2. Browser requests: `http://localhost:3000/`
3. Browser loads `index.html` and `app_multi.js`
4. App requests `/api/config`
5. Server loads all data files into memory
6. Server returns config and data summary
7. Browser displays UI

### Navigation Flow
1. User selects landslide
2. App calculates display window from polygon bounds
3. App requests image slice via `/api/image/slice`
4. Server extracts pixels from cached data
5. Server returns only requested pixels
6. Browser renders pixels on canvas

## Benefits

✅ **Efficient** - Only requested pixels transferred, not entire files
✅ **Fast** - Server caches all data in memory
✅ **Clean** - No Node.js modules in browser
✅ **Scalable** - Can add caching, compression, etc. on server
✅ **Maintainable** - Clear separation of concerns

## Running the Application

### Development
```bash
# Start server (loads data)
npm run server

# Access application
http://localhost:3000/
```

### Testing
```bash
# Run Node.js tests (uses fs loaders)
npm test

# Test API endpoints
curl http://localhost:3000/api/data/summary
```

## Configuration

Edit `tests/test_configs/browser_test.yaml` to change data sources:

```yaml
data_sources:
  numpy_stack:
    file: tests/test_data/valid_4d_array.npy
    epsg: 32610
    origin: [500000, 4200000]
    pixel_size: 10

  shapefile:
    file: data/landslides.geojson
    id_field: FID

  predictions:
    file: tests/test_data/valid_3d_predictions.npy
```

## Notes

- Server must be running for browser to work
- Large datasets are loaded once on server startup
- Browser fetches only visible data on-demand
- All coordinate transformations use server API (proj4 on server)
