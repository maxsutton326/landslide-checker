/**
 * Create binary test data files for data loader testing
 * - NumPy .npy files (valid and invalid)
 * - Simple shapefile (using shapefile library)
 * - Mock GeoTIFF files
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_DATA_DIR = join(process.cwd(), 'tests', 'test_data');

// Ensure test data directory exists
try {
  mkdirSync(TEST_DATA_DIR, { recursive: true });
} catch (err) {
  // Directory already exists
}

/**
 * Create a valid NPY file with 4D array
 * @param {string} filename - Output filename
 * @param {Array} shape - Array shape [time, rows, cols, bands]
 * @param {string} dtype - Data type ('float32', 'float64', etc.)
 */
function createNpyFile(filename, shape, dtype = 'float32') {
  const filepath = join(TEST_DATA_DIR, filename);

  // NPY file format:
  // Magic string: \x93NUMPY
  // Version: 1.0 (major=1, minor=0)
  // Header length (uint16 little-endian)
  // Header dict (Python dict as string)
  // Data

  const magic = Buffer.from([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]); // \x93NUMPY
  const version = Buffer.from([0x01, 0x00]); // Version 1.0

  // Build header dictionary
  const fortranOrder = false;
  const dtypeStr = dtype === 'float32' ? '<f4' : dtype === 'float64' ? '<f8' : '<f4';

  const headerDict = `{'descr': '${dtypeStr}', 'fortran_order': ${fortranOrder ? 'True' : 'False'}, 'shape': (${shape.join(', ')}${shape.length === 1 ? ',' : ''}), }`;

  // Header must end with newline and be padded to 64-byte boundary
  let header = headerDict + '\n';
  const totalHeaderLen = magic.length + version.length + 2; // +2 for header length field
  const paddedLen = Math.ceil((totalHeaderLen + header.length) / 64) * 64;
  const paddingNeeded = paddedLen - totalHeaderLen - header.length;
  header = header + ' '.repeat(paddingNeeded);

  const headerLen = Buffer.alloc(2);
  headerLen.writeUInt16LE(header.length, 0);

  // Generate random data
  const totalElements = shape.reduce((a, b) => a * b, 1);
  let dataBuffer;

  if (dtype === 'float32') {
    dataBuffer = Buffer.alloc(totalElements * 4);
    for (let i = 0; i < totalElements; i++) {
      dataBuffer.writeFloatLE(Math.random(), i * 4);
    }
  } else if (dtype === 'float64') {
    dataBuffer = Buffer.alloc(totalElements * 8);
    for (let i = 0; i < totalElements; i++) {
      dataBuffer.writeDoubleLE(Math.random(), i * 8);
    }
  }

  // Combine all parts
  const npyFile = Buffer.concat([magic, version, headerLen, Buffer.from(header), dataBuffer]);
  writeFileSync(filepath, npyFile);

  return filepath;
}

/**
 * Create an invalid NPY file (bad magic string)
 */
function createInvalidNpyFile(filename) {
  const filepath = join(TEST_DATA_DIR, filename);
  const badMagic = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  writeFileSync(filepath, badMagic);
  return filepath;
}

/**
 * Create a simple shapefile using shapefile library
 * Note: This is a mock - in real testing, we'd use actual shapefile data
 */
function createTestShapefile() {
  // For now, we'll just document the expected format
  // The actual shapefile will be created by the geojson converter
  console.log('Note: Shapefile creation requires binary format.');
  console.log('Using GeoJSON format for testing instead.');
}

console.log('Creating binary test data files...\n');

// 1. Valid 4D NumPy array (2×10×10×3)
console.log('1. Creating valid 4D NumPy array (2×10×10×3)...');
const validNpy = createNpyFile('valid_4d_array.npy', [2, 10, 10, 3], 'float32');
console.log(`   ✓ Created: ${validNpy}`);

// 2. Valid 3D NumPy array for predictions (10×10×2)
console.log('2. Creating valid 3D NumPy array (10×10×2)...');
const validPredNpy = createNpyFile('valid_3d_predictions.npy', [10, 10, 2], 'float32');
console.log(`   ✓ Created: ${validPredNpy}`);

// 3. Invalid shape (2D instead of 4D)
console.log('3. Creating 2D NumPy array (invalid shape)...');
const invalid2D = createNpyFile('invalid_2d_array.npy', [10, 10], 'float32');
console.log(`   ✓ Created: ${invalid2D}`);

// 4. Invalid magic string
console.log('4. Creating invalid NPY file (bad magic)...');
const invalidMagic = createInvalidNpyFile('invalid_magic.npy');
console.log(`   ✓ Created: ${invalidMagic}`);

// 5. Large 4D array for performance testing
console.log('5. Creating large 4D NumPy array (2×100×100×3)...');
const largeNpy = createNpyFile('large_4d_array.npy', [2, 100, 100, 3], 'float32');
console.log(`   ✓ Created: ${largeNpy}`);

// 6. Different dtype (float64)
console.log('6. Creating 4D NumPy array with float64...');
const float64Npy = createNpyFile('float64_4d_array.npy', [2, 10, 10, 3], 'float64');
console.log(`   ✓ Created: ${float64Npy}`);

console.log('\n✅ Binary test data creation complete!');
console.log(`\nFiles created in: ${TEST_DATA_DIR}`);
