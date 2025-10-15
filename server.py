"""
Python Server for Landslide Data Quality Assessment

Handles large NumPy arrays efficiently using memory-mapped files.
Provides REST API endpoints for the browser application.
"""

import os
import sys
import json
import yaml
import numpy as np
import geopandas as gpd
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pyproj import Transformer
import mimetypes
from pathlib import Path
from rasterio.plot import reshape_as_image, reshape_as_raster

PORT = 3000
HOST = "localhost"

# Global data cache
data_cache = {
    "config": None,
    "numpy_stack": None,  # Will be memory-mapped
    "numpy_stack_mmap": None,  # Reference to keep mmap alive
    "shapefile": None,
    "predictions": None,
    "predictions_mmap": None,
    "labels": None,  # Ground truth labels
    "labels_mmap": None,
    "loaded": False,
    "config_path": None,
}

# MIME types
MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".geojson": "application/geo+json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
}


def load_config(config_path):
    """Load YAML configuration file"""
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def load_numpy_stack(file_path):
    """
    Load NumPy array using memory-mapped mode for large files

    This prevents loading the entire file into memory
    """
    print(f"Loading NumPy stack: {file_path}")

    # Use memory-mapped mode to handle large files
    # mode='r' means read-only, which is safe and efficient
    arr = np.load(file_path, mmap_mode="r")

    print(f"✓ NumPy stack loaded: {arr.shape} (memory-mapped)")
    return arr


def load_shapefile(file_path):
    """Load shapefile (GeoJSON or GeoPackage)"""
    print(f"Loading shapefile: {file_path}")

    if file_path.endswith(".geojson") or file_path.endswith(".json"):
        # Load GeoJSON
        gdf = gpd.read_file(file_path)
    elif file_path.endswith(".gpkg"):
        # Load GeoPackage
        gdf = gpd.read_file(file_path)
    elif file_path.endswith(".shp"):
        # Load Shapefile
        gdf = gpd.read_file(file_path)
    else:
        raise ValueError(f"Unsupported shapefile format: {file_path}")

    print(f"✓ Shapefile loaded: {len(gdf)} features")
    return gdf.explode()


def load_predictions(file_path):
    """Load predictions (NumPy or GeoTIFF)"""
    print(f"Loading predictions: {file_path}")

    if file_path.endswith(".npy"):
        # Use memory-mapped mode for large prediction files
        arr = np.load(file_path, mmap_mode="r")
        print(f"✓ Predictions loaded: {arr.shape} (memory-mapped)")
        return arr
    elif file_path.endswith(".tif") or file_path.endswith(".tiff"):
        # Load GeoTIFF using rasterio
        try:
            import rasterio

            with rasterio.open(file_path) as src:
                arr = src.read()  # This loads into memory, but can be optimized
            print(f"✓ Predictions loaded: {arr.shape}")
            arr = reshape_as_image(arr)
            return arr
        except ImportError:
            print("Warning: rasterio not installed, cannot load GeoTIFF predictions")
            return None
    else:
        raise ValueError(f"Unsupported prediction format: {file_path}")


def load_labels(file_path):
    """Load ground truth labels (NumPy or GeoTIFF)"""
    print(f"Loading labels: {file_path}")

    if file_path.endswith(".npy"):
        # Use memory-mapped mode for large label files
        arr = np.load(file_path, mmap_mode="r")
        print(f"✓ Labels loaded: {arr.shape} (memory-mapped)")
        if len(arr.shape) == 3:
            arr = np.expand_dims(arr, -1)
        return arr
    elif file_path.endswith(".tif") or file_path.endswith(".tiff"):
        # Load GeoTIFF using rasterio
        try:
            import rasterio

            with rasterio.open(file_path) as src:
                arr = src.read()  # Read all bands
            print(f"✓ Labels loaded: {arr.shape}")
            arr = reshape_as_image(arr)
            return arr
        except ImportError:
            print("Warning: rasterio not installed, cannot load GeoTIFF labels")
            return None
    else:
        raise ValueError(f"Unsupported label format: {file_path}")


def load_all_data(config_path="tests/test_configs/valid_config.yaml"):
    """Load all data sources"""
    if data_cache["loaded"] and data_cache["config_path"] == config_path:
        print("Data already loaded")
        return

    print("Loading all data sources...")

    try:
        # Load configuration
        data_cache["config"] = load_config(config_path)
        data_cache["config_path"] = config_path
        print("✓ Config loaded")

        # Load NumPy stack (memory-mapped)
        if "numpy_stack" in data_cache["config"].get("data_sources", {}):
            stack_config = data_cache["config"]["data_sources"]["numpy_stack"]
            stack_path = stack_config["file"]

            data_cache["numpy_stack"] = load_numpy_stack(stack_path)

        # Load shapefile
        if "shapefile" in data_cache["config"].get("data_sources", {}):
            shp_config = data_cache["config"]["data_sources"]["shapefile"]
            shp_path = shp_config["file"]

            data_cache["shapefile"] = load_shapefile(shp_path)

        # Load predictions
        if "predictions" in data_cache["config"].get("data_sources", {}):
            pred_config = data_cache["config"]["data_sources"]["predictions"]
            pred_path = pred_config["file"]

            if os.path.exists(pred_path):
                data_cache["predictions"] = load_predictions(pred_path)

        # Load labels (ground truth)
        if "labels" in data_cache["config"].get("data_sources", {}):
            label_config = data_cache["config"]["data_sources"]["labels"]
            label_path = label_config["file"]

            if os.path.exists(label_path):
                data_cache["labels"] = load_labels(label_path)

        data_cache["loaded"] = True
        print("✓ All data loaded successfully!")

    except Exception as e:
        print(f"Failed to load data: {e}")
        import traceback

        traceback.print_exc()
        raise


def gdf_to_geojson(gdf):
    """Convert GeoDataFrame to GeoJSON dict"""
    features = []

    for idx, row in gdf.iterrows():
        feature = {
            "type": "Feature",
            "id": int(row.get("fid", idx)) if "fid" in row else idx,
            "geometry": row["geometry"].__geo_interface__,
            "properties": {},
        }

        # Add all non-geometry properties
        for col in gdf.columns:
            if col != "geometry":
                val = row[col]
                # Convert numpy types to Python types
                if isinstance(val, (np.integer, np.floating)):
                    val = val.item()
                elif pd.isna(val):
                    val = None
                feature["properties"][col] = val

        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features,
        "projection": str(gdf.crs) if gdf.crs else None,
        "count": len(features),
        "bounds": {
            "minX": float(gdf.total_bounds[0]),
            "minY": float(gdf.total_bounds[1]),
            "maxX": float(gdf.total_bounds[2]),
            "maxY": float(gdf.total_bounds[3]),
        },
    }


class LandslideServerHandler(BaseHTTPRequestHandler):
    """HTTP request handler for Landslide API"""

    def log_message(self, format, *args):
        """Custom logging"""
        print(f"{self.command} {args[0]}")

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        parsed_url = urlparse(self.path)
        pathname = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        # Handle API requests
        if pathname.startswith("/api/"):
            self.handle_api_get(pathname, query_params)
        else:
            # Serve static files
            self.serve_static_file(pathname)

    def do_POST(self):
        """Handle POST requests"""
        parsed_url = urlparse(self.path)
        pathname = parsed_url.path

        if pathname.startswith("/api/"):
            self.handle_api_post(pathname)
        else:
            self.send_error(404)

    def handle_api_get(self, pathname, params):
        """Handle API GET requests"""
        try:
            # GET /api/config
            if pathname == "/api/config":
                config_path = params.get(
                    "path", ["tests/test_configs/valid_config.yaml"]
                )[0]
                load_all_data(config_path)

                self.send_json_response(data_cache["config"])
                return

            # GET /api/data/summary
            if pathname == "/api/data/summary":
                if not data_cache["loaded"]:
                    self.send_json_response(
                        {"error": "Data not loaded yet"}, status=500
                    )
                    return

                summary = {}

                if data_cache["numpy_stack"] is not None:
                    stack_config = data_cache["config"]["data_sources"]["numpy_stack"]
                    summary["numpy_stack"] = {
                        "shape": list(data_cache["numpy_stack"].shape),
                        "dtype": str(data_cache["numpy_stack"].dtype),
                        "epsg": stack_config.get("epsg"),
                        "origin": stack_config.get("origin"),
                        "pixelSize": stack_config.get("pixel_size"),
                    }

                if data_cache["shapefile"] is not None:
                    gdf = data_cache["shapefile"]
                    summary["shapefile"] = {
                        "count": len(gdf),
                        "projection": str(gdf.crs),
                        "bounds": {
                            "minX": float(gdf.total_bounds[0]),
                            "minY": float(gdf.total_bounds[1]),
                            "maxX": float(gdf.total_bounds[2]),
                            "maxY": float(gdf.total_bounds[3]),
                        },
                    }

                if data_cache["predictions"] is not None:
                    summary["predictions"] = {
                        "shape": list(data_cache["predictions"].shape),
                        "classes": (
                            data_cache["predictions"].shape[-1]
                            if len(data_cache["predictions"].shape) > 2
                            else 1
                        ),
                    }

                if data_cache["labels"] is not None:
                    summary["labels"] = {
                        "shape": list(data_cache["labels"].shape),
                        "dtype": str(data_cache["labels"].dtype),
                    }

                self.send_json_response(summary)
                return

            # GET /api/landslides
            if pathname == "/api/landslides":
                if data_cache["shapefile"] is None:
                    self.send_json_response(
                        {"error": "Shapefile not loaded"}, status=500
                    )
                    return

                geojson = gdf_to_geojson(data_cache["shapefile"])
                self.send_json_response(geojson)
                return

            # GET /api/image/slice, /api/predictions/slice, /api/labels/slice
            if (
                pathname == "/api/image/slice"
                or pathname == "/api/predictions/slice"
                or pathname == "/api/labels/slice"
            ):
                if pathname == "/api/image/slice":
                    array_to_load = "numpy_stack"
                elif pathname == "/api/labels/slice":
                    array_to_load = "labels"
                else:
                    array_to_load = "predictions"
                if data_cache[array_to_load] is None:
                    self.send_json_response(
                        {"error": f"{array_to_load} not loaded"}, status=500
                    )
                    return

                time_index = int(params.get("time", [0])[0])
                band_index = int(params.get("band", [0])[0])
                row_start = int(params.get("rowStart", [0])[0])
                row_end = int(params.get("rowEnd", [100])[0])
                col_start = int(params.get("colStart", [0])[0])
                col_end = int(params.get("colEnd", [100])[0])

                # Get array shape
                arr = data_cache[array_to_load]
                if len(arr.shape) == 4:
                    time_steps, rows, cols, bands = arr.shape
                elif len(arr.shape) == 3:
                    # Handle 3D array as single time step
                    rows, cols, bands = arr.shape
                    # band_index = 0
                    # Reshape conceptually (don't actually reshape in memory)
                else:
                    self.send_json_response(
                        {"error": f"Invalid array shape: {arr.shape}"}, status=500
                    )
                    return

                # Calculate output shape
                height = row_end - row_start
                width = col_end - col_start

                # Extract slice with bounds checking
                # Memory-mapped arrays allow efficient slicing without loading entire array
                slice_data = np.zeros((height, width), dtype=arr.dtype)

                # Calculate valid ranges
                valid_row_start = max(0, row_start)
                valid_row_end = min(rows, row_end)
                valid_col_start = max(0, col_start)
                valid_col_end = min(cols, col_end)

                if valid_row_start < valid_row_end and valid_col_start < valid_col_end:
                    # Extract valid portion (this reads only needed data from disk)
                    if len(arr.shape) == 4:
                        valid_data = arr[
                            time_index,
                            valid_row_start:valid_row_end,
                            valid_col_start:valid_col_end,
                            band_index,
                        ]
                    else:  # 3D array
                        # if time_index > 0:
                        #     self.send_json_response(
                        #         {
                        #             "error": f"Band index {band_index} out of range for 3D array"
                        #         },
                        #         status=400,
                        #     )
                        #     return
                        valid_data = arr[
                            valid_row_start:valid_row_end,
                            valid_col_start:valid_col_end,
                            band_index,
                        ]

                    # Place in output array
                    out_row_start = valid_row_start - row_start
                    out_row_end = out_row_start + (valid_row_end - valid_row_start)
                    out_col_start = valid_col_start - col_start
                    out_col_end = out_col_start + (valid_col_end - valid_col_start)

                    slice_data[out_row_start:out_row_end, out_col_start:out_col_end] = (
                        valid_data
                    )

                self.send_json_response(
                    {"data": slice_data.flatten().tolist(), "shape": [height, width]}
                )
                return

            # GET /api/predictions/slice
            if pathname == "/api/predictions/slice2":
                if data_cache["predictions"] is None:
                    self.send_json_response(
                        {"error": "Predictions not loaded"}, status=500
                    )
                    return

                class_index = int(params.get("class", [0])[0])
                row_start = int(params.get("rowStart", [0])[0])
                row_end = int(params.get("rowEnd", [100])[0])
                col_start = int(params.get("colStart", [0])[0])
                col_end = int(params.get("colEnd", [100])[0])

                arr = data_cache["predictions"]

                # Handle different array shapes
                if len(arr.shape) == 3:
                    time_bands, rows, cols = arr.shape
                elif len(arr.shape) == 2:
                    rows, cols = arr.shape
                    class_index = 0
                else:
                    self.send_json_response(
                        {"error": "Invalid predictions shape"}, status=500
                    )
                    return

                # Extract slice with memory-mapped efficiency
                height = row_end - row_start
                width = col_end - col_start
                slice_data = np.zeros((height, width), dtype=arr.dtype)

                valid_row_start = max(0, row_start)
                valid_row_end = min(rows, row_end)
                valid_col_start = max(0, col_start)
                valid_col_end = min(cols, col_end)

                if valid_row_start < valid_row_end and valid_col_start < valid_col_end:
                    if len(arr.shape) == 3:
                        valid_data = arr[
                            valid_row_start:valid_row_end,
                            valid_col_start:valid_col_end,
                            class_index,
                        ]
                    else:
                        valid_data = arr[
                            valid_row_start:valid_row_end, valid_col_start:valid_col_end
                        ]

                    out_row_start = valid_row_start - row_start
                    out_row_end = out_row_start + (valid_row_end - valid_row_start)
                    out_col_start = valid_col_start - col_start
                    out_col_end = out_col_start + (valid_col_end - valid_col_start)

                    slice_data[out_row_start:out_row_end, out_col_start:out_col_end] = (
                        valid_data
                    )

                self.send_json_response(
                    {"data": slice_data.flatten().tolist(), "shape": [height, width]}
                )
                return

            # GET /api/transform
            if pathname == "/api/transform":
                x = float(params.get("x", [0])[0])
                y = float(params.get("y", [0])[0])
                from_epsg = int(params.get("from", [4326])[0])
                to_epsg = int(params.get("to", [4326])[0])

                if from_epsg == to_epsg:
                    self.send_json_response({"x": x, "y": y})
                    return

                transformer = Transformer.from_crs(
                    f"EPSG:{from_epsg}", f"EPSG:{to_epsg}", always_xy=True
                )
                transformed_x, transformed_y = transformer.transform(x, y)

                self.send_json_response({"x": transformed_x, "y": transformed_y})
                return

            # GET /api/transform-bounds
            if pathname == "/api/transform-bounds":
                min_x = float(params.get("minX", [0])[0])
                min_y = float(params.get("minY", [0])[0])
                max_x = float(params.get("maxX", [0])[0])
                max_y = float(params.get("maxY", [0])[0])
                from_epsg = int(params.get("from", [4326])[0])
                to_epsg = int(params.get("to", [4326])[0])

                if from_epsg == to_epsg:
                    self.send_json_response(
                        {"minX": min_x, "minY": min_y, "maxX": max_x, "maxY": max_y}
                    )
                    return

                transformer = Transformer.from_crs(
                    f"EPSG:{from_epsg}", f"EPSG:{to_epsg}", always_xy=True
                )

                # Transform all four corners
                corners = [
                    (min_x, min_y),
                    (max_x, min_y),
                    (max_x, max_y),
                    (min_x, max_y),
                ]

                transformed_corners = [transformer.transform(x, y) for x, y in corners]

                xs = [x for x, y in transformed_corners]
                ys = [y for x, y in transformed_corners]

                self.send_json_response(
                    {"minX": min(xs), "maxX": max(xs), "minY": min(ys), "maxY": max(ys)}
                )
                return

            # Unknown endpoint
            self.send_error(404)

        except Exception as e:
            import traceback

            traceback.print_exc()
            self.send_json_response({"error": str(e)}, status=500)

    def handle_api_post(self, pathname):
        """Handle API POST requests"""
        try:
            # POST /api/label
            if pathname == "/api/label":
                content_length = int(self.headers["Content-Length"])
                body = self.rfile.read(content_length)
                label_data = json.loads(body)

                # Validate required fields
                if "id" not in label_data or label_data["id"] is None:
                    self.send_json_response(
                        {"error": "Feature ID is required"}, status=400
                    )
                    return

                if not data_cache["loaded"] or data_cache["shapefile"] is None:
                    self.send_json_response({"error": "Data not loaded"}, status=500)
                    return

                # Find feature
                gdf = data_cache["shapefile"]
                feature_id = label_data["id"]

                # Find by FID or index
                if "FID" in gdf.columns:
                    mask = gdf["FID"] == feature_id
                else:
                    mask = gdf.index == feature_id

                if not mask.any():
                    self.send_json_response(
                        {"error": f"Feature with ID {feature_id} not found"}, status=404
                    )
                    return

                # Update feature properties
                idx = gdf[mask].index[0]
                gdf.loc[idx, "label"] = label_data.get("label")
                gdf.loc[idx, "label_confidence"] = label_data.get("confidence")
                gdf.loc[idx, "label_notes"] = label_data.get("notes")
                gdf.loc[idx, "label_timestamp"] = label_data.get(
                    "timestamp", int(time.time() * 1000)
                )

                # Write back to file
                shp_path = data_cache["config"]["data_sources"]["shapefile"]["file"]

                if shp_path.endswith(".geojson") or shp_path.endswith(".json"):
                    # Save as GeoJSON
                    gdf.to_file(shp_path, driver="GeoJSON")
                elif shp_path.endswith(".gpkg"):
                    # Save as GeoPackage
                    gdf.to_file(shp_path, driver="GPKG")
                else:
                    # Save as Shapefile
                    gdf.to_file(shp_path)

                self.send_json_response(
                    {
                        "success": True,
                        "id": feature_id,
                        "label": label_data.get("label"),
                    }
                )
                return

            # Unknown endpoint
            self.send_error(404)

        except Exception as e:
            import traceback

            traceback.print_exc()
            self.send_json_response({"error": str(e)}, status=500)

    def serve_static_file(self, pathname):
        """Serve static files"""
        try:
            # Default to index.html
            if pathname == "/":
                pathname = "/index.html"

            filepath = "." + pathname

            if not os.path.exists(filepath):
                self.send_error(404)
                return

            if os.path.isdir(filepath):
                self.send_error(403)
                return

            # Determine MIME type
            ext = Path(filepath).suffix
            mime_type = MIME_TYPES.get(
                ext, mimetypes.guess_type(filepath)[0] or "application/octet-stream"
            )

            # Read and send file
            with open(filepath, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", len(content))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)

        except Exception as e:
            print(f"Error serving file: {e}")
            self.send_error(500)

    def send_json_response(self, data, status=200):
        """Send JSON response with CORS headers"""
        response = json.dumps(data, default=str)  # default=str handles numpy types

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response.encode("utf-8"))


def run_server():
    """Run the HTTP server"""
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, LandslideServerHandler)

    print(f"\nServer running at http://{HOST}:{PORT}/\n")
    print("API endpoints:")
    print("  - GET /api/config?path=tests/test_configs/valid_config.yaml")
    print("  - GET /api/data/summary")
    print("  - GET /api/landslides")
    print(
        "  - GET /api/image/slice?time=0&band=0&rowStart=0&rowEnd=100&colStart=0&colEnd=100"
    )
    print(
        "  - GET /api/predictions/slice?class=0&rowStart=0&rowEnd=100&colStart=0&colEnd=100"
    )
    print("  - GET /api/transform?x=500000&y=4200000&from=32610&to=4326")
    print(
        "  - GET /api/transform-bounds?minX=...&minY=...&maxX=...&maxY=...&from=32610&to=4326"
    )
    print("  - POST /api/label")
    print(f"\nBrowse to http://{HOST}:{PORT}/ to view the application\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()


if __name__ == "__main__":
    # Import pandas here to avoid import at module level
    import pandas as pd
    import time

    run_server()
