/**
 * Node.js Server for Landslide Data Quality Assessment
 *
 * Loads all data on the server side and provides API endpoints
 * for the browser to request individual images and data
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';
import yaml from 'js-yaml';

// Import Node.js loaders (with fs module)
import { loadNumpyArray, sliceArray } from './src/data/numpy_loader.js';
import { loadShapefile } from './src/data/shapefile_loader.js';
import { loadGeoTiff } from './src/data/geotiff_loader.js';
import { loadPredictions, extractClassProbabilities } from './src/data/prediction_loader.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define common projections
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');
proj4.defs('EPSG:32610', '+proj=utm +zone=10 +datum=WGS84 +units=m +no_defs');

const PORT = 3000;
const HOST = 'localhost';

// In-memory data cache
const dataCache = {
  config: null,
  numpyStack: null,
  shapefile: null,
  predictions: null,
  sourceImages: null,
  loaded: false
};

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.geojson': 'application/geo+json',
  '.npy': 'application/octet-stream',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

/**
 * Load all data sources into memory
 */
async function loadAllData(configPath = 'tests/test_configs/valid_config.yaml') {
  if (dataCache.loaded) {
    console.log('Data already loaded');
    return;
  }

  console.log('Loading all data sources...');

  try {
    // Load configuration
    const configContent = readFileSync(join(__dirname, configPath), 'utf8');
    dataCache.config = yaml.load(configContent);
    console.log('✓ Config loaded');

    // Load NumPy stack
    if (dataCache.config.data_sources?.numpy_stack) {
      const stackConfig = dataCache.config.data_sources.numpy_stack;
      const stackPath = join(__dirname, stackConfig.file);

      dataCache.numpyStack = await loadNumpyArray(stackPath, {
        expectedDimensions: 4,
        validateRange: true
      });

      // Add metadata
      dataCache.numpyStack.metadata.epsg = stackConfig.epsg;
      dataCache.numpyStack.metadata.origin = stackConfig.origin;
      dataCache.numpyStack.metadata.pixelSize = stackConfig.pixel_size;
      dataCache.numpyStack.metadata.beforeIndex = stackConfig.before_index;
      dataCache.numpyStack.metadata.afterIndex = stackConfig.after_index;

      console.log(`✓ NumPy stack loaded: ${dataCache.numpyStack.metadata.shape}`);
    }

    // Load shapefile
    if (dataCache.config.data_sources?.shapefile) {
      const shpConfig = dataCache.config.data_sources.shapefile;
      const shpPath = join(__dirname, shpConfig.file);

      dataCache.shapefile = await loadShapefile(shpPath, {
        idField: shpConfig.id_field
      });

      console.log(`✓ Shapefile loaded: ${dataCache.shapefile.count} features`);
    }

    // Load predictions
    if (dataCache.config.data_sources?.predictions) {
      const predConfig = dataCache.config.data_sources.predictions;
      const predPath = join(__dirname, predConfig.file);

      dataCache.predictions = await loadPredictions(predPath, {
        validateRange: true
      });

      console.log(`✓ Predictions loaded: ${dataCache.predictions.metadata.shape}`);
    }

    // Load source images metadata
    if (dataCache.config.data_sources?.source_images) {
      dataCache.sourceImages = [];

      for (const imgConfig of dataCache.config.data_sources.source_images) {
        const imgPath = join(__dirname, imgConfig.file);
        const imageData = await loadGeoTiff(imgPath, { metadataOnly: true });
        imageData.type = imgConfig.type;
        dataCache.sourceImages.push(imageData);
      }

      console.log(`✓ Source images metadata loaded: ${dataCache.sourceImages.length} images`);
    }

    dataCache.loaded = true;
    console.log('✓ All data loaded successfully!');

  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}

/**
 * Handle API requests
 */
async function handleAPI(req, res) {
  const urlObj = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = urlObj.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    // API: Load configuration
    if (pathname === '/api/config') {
      const configPath = urlObj.searchParams.get('path') || 'tests/test_configs/valid_config.yaml';

      // Load data if not already loaded
      if (!dataCache.loaded) {
        await loadAllData(configPath);
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify(dataCache.config));
      return true;
    }

    // API: Get data summary
    if (pathname === '/api/data/summary') {
      if (!dataCache.loaded) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'Data not loaded yet' }));
        return true;
      }

      const summary = {
        numpy_stack: {
          shape: dataCache.numpyStack.metadata.shape,
          dtype: dataCache.numpyStack.metadata.dtypeName,
          epsg: dataCache.numpyStack.metadata.epsg,
          origin: dataCache.numpyStack.metadata.origin,
          pixelSize: dataCache.numpyStack.metadata.pixelSize
        },
        shapefile: {
          count: dataCache.shapefile.count,
          projection: dataCache.shapefile.projection,
          bounds: dataCache.shapefile.bounds
        },
        predictions: dataCache.predictions ? {
          shape: dataCache.predictions.metadata.shape,
          classes: dataCache.predictions.metadata.classes
        } : null
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify(summary));
      return true;
    }

    // API: Get landslide features
    if (pathname === '/api/landslides') {
      if (!dataCache.loaded || !dataCache.shapefile) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'Shapefile not loaded' }));
        return true;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify({
        features: dataCache.shapefile.features,
        count: dataCache.shapefile.count,
        projection: dataCache.shapefile.projection
      }));
      return true;
    }

    // API: Get image slice
    if (pathname === '/api/image/slice') {
      if (!dataCache.loaded || !dataCache.numpyStack) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'NumPy stack not loaded' }));
        return true;
      }

      const timeIndex = parseInt(urlObj.searchParams.get('time') || '0');
      const bandIndex = parseInt(urlObj.searchParams.get('band') || '0');
      const rowStart = parseInt(urlObj.searchParams.get('rowStart'));
      const rowEnd = parseInt(urlObj.searchParams.get('rowEnd'));
      const colStart = parseInt(urlObj.searchParams.get('colStart'));
      const colEnd = parseInt(urlObj.searchParams.get('colEnd'));

      // Extract slice from 4D array
      const shape = dataCache.numpyStack.metadata.shape;
      const [timeSteps, rows, cols, bands] = shape;

      // Validate indices
      if (timeIndex < 0 || timeIndex >= timeSteps ||
          bandIndex < 0 || bandIndex >= bands) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'Invalid time or band index' }));
        return true;
      }

      // If window specified, extract window; otherwise get full slice
      let sliceData;
      if (!isNaN(rowStart) && !isNaN(rowEnd) && !isNaN(colStart) && !isNaN(colEnd)) {
        // Extract window
        sliceData = [];
        for (let r = rowStart; r < rowEnd; r++) {
          for (let c = colStart; c < colEnd; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              const idx = ((timeIndex * rows + r) * cols + c) * bands + bandIndex;
              sliceData.push(dataCache.numpyStack.data[idx]);
            } else {
              sliceData.push(0); // Padding
            }
          }
        }
      } else {
        // Get full slice for this time and band
        const result = sliceArray(
          dataCache.numpyStack.data,
          shape,
          { time: timeIndex, band: bandIndex }
        );
        sliceData = result.data;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify({
        data: sliceData,
        shape: !isNaN(rowStart) ? [rowEnd - rowStart, colEnd - colStart] : [rows, cols]
      }));
      return true;
    }

    // API: Get prediction slice
    if (pathname === '/api/predictions/slice') {
      if (!dataCache.loaded || !dataCache.predictions) {
        res.writeHead(503, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'Predictions not loaded' }));
        return true;
      }

      const classIndex = parseInt(urlObj.searchParams.get('class') || '0');
      const rowStart = parseInt(urlObj.searchParams.get('rowStart'));
      const rowEnd = parseInt(urlObj.searchParams.get('rowEnd'));
      const colStart = parseInt(urlObj.searchParams.get('colStart'));
      const colEnd = parseInt(urlObj.searchParams.get('colEnd'));

      const [rows, cols, classes] = dataCache.predictions.metadata.shape;

      if (classIndex < 0 || classIndex >= classes) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ error: 'Invalid class index' }));
        return true;
      }

      // Extract class probabilities
      const classProbabilities = extractClassProbabilities(
        dataCache.predictions.data,
        rows,
        cols,
        classes,
        classIndex
      );

      // If window specified, extract window
      let sliceData;
      if (!isNaN(rowStart) && !isNaN(rowEnd) && !isNaN(colStart) && !isNaN(colEnd)) {
        sliceData = [];
        for (let r = rowStart; r < rowEnd; r++) {
          for (let c = colStart; c < colEnd; c++) {
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              sliceData.push(classProbabilities[r * cols + c]);
            } else {
              sliceData.push(0);
            }
          }
        }
      } else {
        sliceData = classProbabilities;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify({
        data: sliceData,
        shape: !isNaN(rowStart) ? [rowEnd - rowStart, colEnd - colStart] : [rows, cols]
      }));
      return true;
    }

    // API: Transform coordinates
    if (pathname === '/api/transform') {
      const x = parseFloat(urlObj.searchParams.get('x'));
      const y = parseFloat(urlObj.searchParams.get('y'));
      const fromEpsg = parseInt(urlObj.searchParams.get('from'));
      const toEpsg = parseInt(urlObj.searchParams.get('to'));

      if (isNaN(x) || isNaN(y) || isNaN(fromEpsg) || isNaN(toEpsg)) {
        throw new Error('Invalid parameters');
      }

      const fromProj = `EPSG:${fromEpsg}`;
      const toProj = `EPSG:${toEpsg}`;

      const [tx, ty] = proj4(fromProj, toProj, [x, y]);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify({ x: tx, y: ty }));
      return true;
    }

    // API: Transform bounds
    if (pathname === '/api/transform-bounds') {
      const minX = parseFloat(urlObj.searchParams.get('minX'));
      const minY = parseFloat(urlObj.searchParams.get('minY'));
      const maxX = parseFloat(urlObj.searchParams.get('maxX'));
      const maxY = parseFloat(urlObj.searchParams.get('maxY'));
      const fromEpsg = parseInt(urlObj.searchParams.get('from'));
      const toEpsg = parseInt(urlObj.searchParams.get('to'));

      if (isNaN(minX) || isNaN(minY) || isNaN(maxX) || isNaN(maxY) ||
          isNaN(fromEpsg) || isNaN(toEpsg)) {
        throw new Error('Invalid parameters');
      }

      // If same projection, return as-is
      if (fromEpsg === toEpsg) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          ...corsHeaders
        });
        res.end(JSON.stringify({ minX, minY, maxX, maxY }));
        return true;
      }

      const fromProj = `EPSG:${fromEpsg}`;
      const toProj = `EPSG:${toEpsg}`;

      // Transform all four corners
      const corners = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY]
      ];

      const transformedCorners = corners.map(corner =>
        proj4(fromProj, toProj, corner)
      );

      // Find new bounds
      const xs = transformedCorners.map(c => c[0]);
      const ys = transformedCorners.map(c => c[1]);

      const result = {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      };

      res.writeHead(200, {
        'Content-Type': 'application/json',
        ...corsHeaders
      });
      res.end(JSON.stringify(result));
      return true;
    }

    // POST /api/label - Update landslide label
    if (pathname === '/api/label' && req.method === 'POST') {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const labelData = JSON.parse(body);

          // Validate required fields
          if (labelData.id === undefined || labelData.id === null) {
            res.writeHead(400, {
              'Content-Type': 'application/json',
              ...corsHeaders
            });
            res.end(JSON.stringify({ error: 'Feature ID is required' }));
            return;
          }

          if (!dataCache.loaded || !dataCache.shapefile) {
            res.writeHead(500, {
              'Content-Type': 'application/json',
              ...corsHeaders
            });
            res.end(JSON.stringify({ error: 'Data not loaded' }));
            return;
          }

          // Find the feature
          const feature = dataCache.shapefile.features.find(f => f.id === labelData.id);

          if (!feature) {
            res.writeHead(404, {
              'Content-Type': 'application/json',
              ...corsHeaders
            });
            res.end(JSON.stringify({ error: `Feature with ID ${labelData.id} not found` }));
            return;
          }

          // Update feature properties with label data
          if (!feature.properties) {
            feature.properties = {};
          }

          feature.properties.label = labelData.label;
          feature.properties.label_confidence = labelData.confidence || null;
          feature.properties.label_notes = labelData.notes || null;
          feature.properties.label_timestamp = labelData.timestamp || Date.now();

          // Write updated shapefile back to disk
          const shapefilePath = join(__dirname, dataCache.config.data_sources.shapefile.file);
          writeFileSync(shapefilePath, JSON.stringify(dataCache.shapefile, null, 2));

          res.writeHead(200, {
            'Content-Type': 'application/json',
            ...corsHeaders
          });
          res.end(JSON.stringify({
            success: true,
            id: labelData.id,
            label: labelData.label
          }));
        } catch (error) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            ...corsHeaders
          });
          res.end(JSON.stringify({ error: error.message }));
        }
      });

      return true;
    }

    return false;

  } catch (error) {
    res.writeHead(500, {
      'Content-Type': 'application/json',
      ...corsHeaders
    });
    res.end(JSON.stringify({ error: error.message }));
    return true;
  }
}

/**
 * Serve static files
 */
function serveFile(filepath, res) {
  try {
    if (!existsSync(filepath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const stat = statSync(filepath);
    if (stat.isDirectory()) {
      // Try to serve index.html from directory
      filepath = join(filepath, 'index.html');
      if (!existsSync(filepath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }
    }

    const ext = extname(filepath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const content = readFileSync(filepath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500 Internal Server Error: ${error.message}`);
  }
}

/**
 * Main request handler
 */
const server = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Handle API requests
  if (req.url.startsWith('/api/')) {
    if (await handleAPI(req, res)) {
      return;
    }
  }

  // Serve static files
  let filepath = req.url === '/' ? '/index.html' : req.url;

  // Remove query string
  const queryIndex = filepath.indexOf('?');
  if (queryIndex !== -1) {
    filepath = filepath.substring(0, queryIndex);
  }

  filepath = join(__dirname, filepath);
  serveFile(filepath, res);
});

server.listen(PORT, HOST, () => {
  console.log(`\nServer running at http://${HOST}:${PORT}/`);
  console.log(`\nAPI endpoints:`);
  console.log(`  - GET /api/config?path=tests/test_configs/valid_config.yaml`);
  console.log(`  - GET /api/data/summary`);
  console.log(`  - GET /api/landslides`);
  console.log(`  - GET /api/image/slice?time=0&band=0&rowStart=0&rowEnd=100&colStart=0&colEnd=100`);
  console.log(`  - GET /api/predictions/slice?class=0&rowStart=0&rowEnd=100&colStart=0&colEnd=100`);
  console.log(`  - GET /api/transform?x=500000&y=4200000&from=32610&to=4326`);
  console.log(`  - GET /api/transform-bounds?minX=...&minY=...&maxX=...&maxY=...&from=32610&to=4326`);
  console.log(`\nBrowse to http://${HOST}:${PORT}/ to view the application\n`);
});
