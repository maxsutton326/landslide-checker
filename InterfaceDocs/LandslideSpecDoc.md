# Landslide Data Quality Assessment System
## Technical Specifications Document

### 1. Executive Summary

This document specifies a web-based interface for systematic quality assessment of landslide mapping data. The system will enable manual validation of mapped landslides against multiple image sources, classification of data quality issues, and generation of labeled datasets for model improvement.

### 2. System Overview

#### 2.1 Purpose
- Systematically evaluate landslide mapping quality
- Distinguish between mapping errors, resolution limitations, and model prediction errors
- Create labeled dataset for improving ML model performance
- Establish semi-automated workflow for future mapping efforts

#### 2.2 Core Functionality
- Display multiple synchronized image sources for each landslide
- Interactive labeling system for quality classification
- Iteration through entire landslide inventory
- Export of labeled classifications for downstream processing

### 3. Data Inputs

#### 3.1 Primary Data Sources

**NumPy Array Stack**
- **Structure:** 4D array with dimensions [time × rows × columns × bands]
- **Data Type:** Float32 (range 0.0-1.0)
- **Bands:** 3 (RGB)
- **Temporal:** 2+ time slices (before/after event)

**Vector Data**
- **Format:** Shapefile (.shp with associated files)
- **Content:** Mapped landslide polygons with unique IDs
- **Projection:** Must match raster data projection

**Source Images**
- **Format:** GeoTIFF
- **Content:** Original images used for manual mapping
- **Count:** 1-2 images per event (typically post-event)

**Prediction Array**
- **Structure:** 3D array [time × rows × columns]
- **Data Type:** Float32 (range 0.0-1.0)
- **Content:** Model prediction probabilities

#### 3.2 Configuration File (YAML)

```yaml
# Configuration for landslide quality assessment
project:
  name: "Event_Name"
  date: "YYYY-MM-DD"
  
data_sources:
  numpy_stack:
    file: "path/to/stack.npy"
    epsg: 32610  # UTM Zone 10N example
    origin: [x_min, y_max]  # Upper-left corner coordinates
    pixel_size: 10  # meters
    before_index: 0  # Temporal index for pre-event
    after_index: 1   # Temporal index for post-event
    
  shapefile:
    file: "path/to/landslides.shp"
    id_field: "FID"  # Field containing unique IDs
    
  source_images:
    - file: "path/to/source1.tif"
      type: "after"  # or "before"
    - file: "path/to/source2.tif"
      type: "after"
      
  predictions:
    file: "path/to/predictions.npy"
    default_index: 1  # Default temporal index to display
    
display:
  context_buffer: 1.5  # Multiplier for display extent beyond polygon
  min_window: 128  # Minimum display size in pixels
  max_window: 512  # Maximum display size in pixels
  
labels:
  - code: 0
    name: "Not Evaluated"
    color: "#808080"
  - code: 1
    name: "Correct Mapping"
    color: "#00FF00"
  - code: 2
    name: "Mapping Error - No Landslide"
    color: "#FF0000"
  - code: 3
    name: "Resolution Insufficient"
    color: "#FFA500"
  - code: 4
    name: "Model Correct - Mapping Missed"
    color: "#0000FF"
  - code: 5
    name: "Temporal False Positive"
    color: "#FF00FF"
  - code: 6
    name: "Ambiguous"
    color: "#FFFF00"
```

### 4. User Interface Design

#### 4.1 Layout Structure

```
+------------------------------------------------------------------+
|                    Landslide Quality Assessment                  |
+------------------------------------------------------------------+
| Progress: [████████░░░░░░] 145/350 | Current ID: LS_0145        |
+------------------------------------------------------------------+
|           |           |           |           |           |      |
|  Source   |  Source   |  Planet   |  Planet   |Prediction |Label |
|  Image 1  |  Image 2  |  Before   |   After   | Heat Map  |Panel |
|           |           |           |           |           |      |
| [Zoom-in] | [Zoom-in] | [Zoom-in] | [Zoom-in] | [Zoom-in] |      |
|           |           |           |           |           |      |
+------------------------------------------------------------------+
| Time Series Navigator: [1][2][3*][4][5] | Threshold: [0.5] ▼    |
+------------------------------------------------------------------+
| Navigation: [< Previous] [Next >] [Jump to ID: _____] [Save]    |
+------------------------------------------------------------------+
```

#### 4.2 Panel Details

**Image Panels (5 synchronized views)**
- Dynamic scaling based on landslide size
- Synchronized pan/zoom across all panels
- Polygon overlay with semi-transparent fill
- Coordinate display on hover
- Individual zoom controls for detailed inspection

**Label Panel**
- Radio buttons for classification selection
- Color-coded options matching configuration
- Notes field for additional observations
- Confidence selector (High/Medium/Low)

**Time Series Navigator**
- Slider or buttons for temporal navigation
- Applies to Planet and Prediction panels
- Highlights current temporal position

**Threshold Control**
- Adjustable threshold for prediction display
- Real-time update of prediction visualization
- Range: 0.0 to 1.0 with 0.01 increments

### 5. Functional Requirements

#### 5.1 Data Loading
- Load and validate all data sources on startup
- Verify projection consistency
- Build spatial index for efficient polygon access
- Pre-calculate display windows for each landslide

#### 5.2 Display Logic
- **Window Calculation:**
  ```python
  # Pseudocode for display window
  bbox = polygon.bounds  # Get polygon extent
  width = bbox.max_x - bbox.min_x
  height = bbox.max_y - bbox.min_y
  
  # Apply context buffer
  display_width = width * context_buffer
  display_height = height * context_buffer
  
  # Enforce min/max constraints
  display_size = max(min_window, min(max_window, max(display_width, display_height)))
  ```

- **Image Synchronization:**
  - All panels show same geographic extent
  - Maintain aspect ratio
  - Resample images to common resolution if needed

#### 5.3 Labeling Workflow
1. System loads first/next landslide
2. All panels update to show landslide extent
3. User examines all image sources
4. User navigates time series if needed
5. User selects appropriate label
6. System saves label and metadata
7. System advances to next landslide

#### 5.4 Data Export
- **Output Format:** CSV with columns:
  - Landslide ID
  - Label Code
  - Label Name
  - Confidence
  - Notes
  - Timestamp
  - User ID (if applicable)
  - Temporal indices examined

### 6. Technical Implementation

#### 6.1 Technology Stack
- **Frontend:** HTML5 + JavaScript (vanilla or React)
- **Visualization:** Canvas API or WebGL for performance
- **Libraries:**
  - OpenLayers or Leaflet for map interaction
  - Plotly or D3.js for data visualization
  - Papaparse for CSV handling

#### 6.2 Performance Considerations
- Lazy loading of image tiles
- Caching of processed display windows
- Progressive rendering for large datasets
- Web Workers for heavy computations

#### 6.3 Browser Storage
- Use in-memory JavaScript objects for state management
- No localStorage or sessionStorage (per system constraints)
- Optional server-side persistence for multi-session work

### 7. Validation Rules

#### 7.1 Data Validation
- All raster data must have same projection
- Polygon shapefile must contain valid geometries
- NumPy arrays must have expected dimensions
- Float values must be in 0-1 range

#### 7.2 Label Validation
- Each landslide must be labeled before proceeding
- Warning if attempting to skip unlabeled items
- Confirmation dialog for ambiguous classifications

### 8. Future Enhancements

#### 8.1 Phase 2 Features
- Batch labeling for similar landslides
- ML-assisted pre-classification
- Collaborative labeling with multiple users
- Integration with model retraining pipeline

#### 8.2 Phase 3 Features
- Polygon editing capabilities
- Automatic polygon generation from predictions
- Statistical analysis of label distributions
- Export to training dataset format

### 9. Testing Requirements

#### 9.1 Test Data
- Minimum 10 landslides for UI testing
- Mix of small, medium, large polygons
- Include edge cases (polygon at image boundary)

#### 9.2 Test Cases
- Load all data types successfully
- Navigate between landslides
- Apply all label types
- Export results correctly
- Handle missing data gracefully

### 10. Deployment Notes

#### 10.1 Development Environment
- Use test dataset with reduced size
- Mock data option for UI development
- Console logging for debugging

#### 10.2 Production Environment
- Optimize for datasets with 1000+ landslides
- Progress persistence for long sessions
- Backup of labeling progress

### Appendix A: Data Structure Examples

#### A.1 Sample Label Output
```csv
landslide_id,label_code,label_name,confidence,notes,timestamp,temporal_indices
LS_0001,1,"Correct Mapping",high,"Clear scarp visible",2025-10-01T14:30:00,"1"
LS_0002,3,"Resolution Insufficient",medium,"Shadowing obscures",2025-10-01T14:32:00,"1,2"
LS_0003,2,"Mapping Error - No Landslide",high,"Vegetation intact",2025-10-01T14:35:00,"0,1,2"
```

#### A.2 Expected NumPy Array Shape
```python
# Example for 2 time slices, 1000x1000 pixels, RGB
array_shape = (2, 1000, 1000, 3)
# dtype: float32
# values: 0.0 to 1.0
```

### Appendix B: Error Handling

| Error Type | Handling Strategy |
|------------|------------------|
| Missing file | Alert user, disable affected panel |
| Projection mismatch | Warn and attempt reprojection |
| Invalid polygon | Skip and log, continue to next |
| Memory overflow | Implement tile-based loading |
| Network failure | Cache progress locally |