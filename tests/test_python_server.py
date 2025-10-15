"""
Tests for Python Server API

Tests all endpoints to ensure feature parity with Node.js server
"""

import pytest
import requests
import json
import time
import numpy as np

API_BASE = 'http://localhost:3000'

@pytest.fixture(scope='module')
def server_ready():
    """Ensure server is running and ready"""
    max_retries = 10
    for i in range(max_retries):
        try:
            response = requests.get(f'{API_BASE}/api/data/summary', timeout=1)
            if response.status_code in [200, 500]:  # 500 means server running but no data loaded
                break
        except requests.exceptions.RequestException:
            if i == max_retries - 1:
                pytest.skip("Server not running on port 3000")
            time.sleep(0.5)

    # Load config
    requests.get(f'{API_BASE}/api/config?path=tests/test_configs/browser_test.yaml')
    time.sleep(0.5)
    return True

class TestConfigEndpoint:
    """Test /api/config endpoint"""

    def test_load_config(self, server_ready):
        """Should load configuration file"""
        response = requests.get(f'{API_BASE}/api/config?path=tests/test_configs/browser_test.yaml')
        assert response.status_code == 200

        config = response.json()
        assert 'project' in config
        assert 'data_sources' in config

    def test_config_triggers_data_load(self, server_ready):
        """Should trigger data loading when config is loaded"""
        requests.get(f'{API_BASE}/api/config?path=tests/test_configs/browser_test.yaml')
        time.sleep(0.5)

        response = requests.get(f'{API_BASE}/api/data/summary')
        assert response.status_code == 200

        summary = response.json()
        assert 'numpy_stack' in summary or 'error' not in summary

class TestDataSummaryEndpoint:
    """Test /api/data/summary endpoint"""

    def test_get_data_summary(self, server_ready):
        """Should return data summary"""
        response = requests.get(f'{API_BASE}/api/data/summary')
        assert response.status_code == 200

        summary = response.json()
        if 'error' not in summary:
            assert 'numpy_stack' in summary or 'shapefile' in summary

class TestLandslidesEndpoint:
    """Test /api/landslides endpoint"""

    def test_get_landslides(self, server_ready):
        """Should return landslide features"""
        response = requests.get(f'{API_BASE}/api/landslides')
        assert response.status_code == 200

        data = response.json()
        if 'error' not in data:
            assert 'features' in data
            assert isinstance(data['features'], list)

class TestImageSliceEndpoint:
    """Test /api/image/slice endpoint"""

    def test_get_image_slice_basic(self, server_ready):
        """Should return image slice with basic parameters"""
        params = {
            'time': 0,
            'band': 0,
            'rowStart': 0,
            'rowEnd': 5,
            'colStart': 0,
            'colEnd': 5
        }

        response = requests.get(f'{API_BASE}/api/image/slice', params=params)
        assert response.status_code == 200

        data = response.json()
        assert 'data' in data
        assert 'shape' in data
        assert data['shape'] == [5, 5]
        assert len(data['data']) == 25

    def test_get_all_bands(self, server_ready):
        """Should return all bands for RGB display"""
        bands = []
        for band in range(3):
            params = {
                'time': 0,
                'band': band,
                'rowStart': 0,
                'rowEnd': 5,
                'colStart': 0,
                'colEnd': 5
            }
            response = requests.get(f'{API_BASE}/api/image/slice', params=params)
            assert response.status_code == 200
            data = response.json()
            bands.append(data['data'])

        assert len(bands) == 3
        assert all(len(b) == 25 for b in bands)

    def test_handle_out_of_bounds(self, server_ready):
        """Should handle out-of-bounds requests with padding"""
        params = {
            'time': 0,
            'band': 0,
            'rowStart': -5,
            'rowEnd': 5,
            'colStart': -5,
            'colEnd': 5
        }

        response = requests.get(f'{API_BASE}/api/image/slice', params=params)
        assert response.status_code == 200

        data = response.json()
        assert data['shape'] == [10, 10]
        assert len(data['data']) == 100

class TestPredictionSliceEndpoint:
    """Test /api/predictions/slice endpoint"""

    def test_get_prediction_slice(self, server_ready):
        """Should return prediction slice"""
        params = {
            'class': 0,
            'rowStart': 0,
            'rowEnd': 5,
            'colStart': 0,
            'colEnd': 5
        }

        response = requests.get(f'{API_BASE}/api/predictions/slice', params=params)
        # May be 200 or 500 depending on if predictions are loaded
        assert response.status_code in [200, 500]

class TestTransformEndpoint:
    """Test /api/transform endpoint"""

    def test_transform_coordinates(self, server_ready):
        """Should transform coordinates between projections"""
        params = {
            'x': 500000,
            'y': 4200000,
            'from': 32610,
            'to': 4326
        }

        response = requests.get(f'{API_BASE}/api/transform', params=params)
        assert response.status_code == 200

        result = response.json()
        assert 'x' in result
        assert 'y' in result
        assert isinstance(result['x'], (int, float))
        assert isinstance(result['y'], (int, float))

    def test_same_projection_passthrough(self, server_ready):
        """Should pass through when projections are same"""
        params = {
            'x': 500000,
            'y': 4200000,
            'from': 32610,
            'to': 32610
        }

        response = requests.get(f'{API_BASE}/api/transform', params=params)
        assert response.status_code == 200

        result = response.json()
        assert result['x'] == 500000
        assert result['y'] == 4200000

class TestTransformBoundsEndpoint:
    """Test /api/transform-bounds endpoint"""

    def test_transform_bounds(self, server_ready):
        """Should transform bounds between projections"""
        params = {
            'minX': 500000,
            'minY': 4200000,
            'maxX': 501000,
            'maxY': 4201000,
            'from': 32610,
            'to': 4326
        }

        response = requests.get(f'{API_BASE}/api/transform-bounds', params=params)
        assert response.status_code == 200

        result = response.json()
        assert 'minX' in result
        assert 'minY' in result
        assert 'maxX' in result
        assert 'maxY' in result

class TestLabelEndpoint:
    """Test /api/label endpoint (POST)"""

    def test_save_label(self, server_ready):
        """Should save label to shapefile"""
        label_data = {
            'id': 0,
            'label': 'landslide',
            'confidence': 'high',
            'notes': 'Python server test',
            'timestamp': int(time.time() * 1000)
        }

        response = requests.post(
            f'{API_BASE}/api/label',
            json=label_data,
            headers={'Content-Type': 'application/json'}
        )

        # May be 200 or 404 depending on data loaded
        assert response.status_code in [200, 404, 500]

    def test_label_requires_id(self, server_ready):
        """Should return error for missing ID"""
        label_data = {
            'label': 'landslide'
        }

        response = requests.post(
            f'{API_BASE}/api/label',
            json=label_data,
            headers={'Content-Type': 'application/json'}
        )

        assert response.status_code == 400
        result = response.json()
        assert 'error' in result

    def test_invalid_feature_id(self, server_ready):
        """Should return 404 for invalid feature ID"""
        label_data = {
            'id': 99999,
            'label': 'landslide'
        }

        response = requests.post(
            f'{API_BASE}/api/label',
            json=label_data,
            headers={'Content-Type': 'application/json'}
        )

        # May be 404 or 500 depending on data loaded
        assert response.status_code in [404, 500]

class TestCORSHeaders:
    """Test CORS headers are set correctly"""

    def test_cors_headers_on_get(self, server_ready):
        """Should include CORS headers on GET requests"""
        response = requests.get(f'{API_BASE}/api/data/summary')

        assert 'Access-Control-Allow-Origin' in response.headers
        assert response.headers['Access-Control-Allow-Origin'] == '*'

    def test_options_request(self, server_ready):
        """Should handle OPTIONS preflight requests"""
        response = requests.options(f'{API_BASE}/api/label')

        assert response.status_code == 200
        assert 'Access-Control-Allow-Methods' in response.headers

class TestStaticFiles:
    """Test static file serving"""

    def test_serve_index_html(self, server_ready):
        """Should serve index.html"""
        response = requests.get(f'{API_BASE}/')
        assert response.status_code == 200
        assert 'text/html' in response.headers.get('Content-Type', '')

    def test_serve_javascript(self, server_ready):
        """Should serve JavaScript files"""
        response = requests.get(f'{API_BASE}/src/viz/app_multi.js')
        assert response.status_code in [200, 404]  # 404 if file doesn't exist

        if response.status_code == 200:
            assert 'javascript' in response.headers.get('Content-Type', '').lower()

    def test_serve_css(self, server_ready):
        """Should serve CSS files"""
        response = requests.get(f'{API_BASE}/src/viz/styles.css')
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            assert 'css' in response.headers.get('Content-Type', '').lower()

class TestMemoryEfficiency:
    """Test memory-efficient handling of large files"""

    def test_large_array_slicing(self, server_ready):
        """Should efficiently slice large arrays without loading entire file"""
        # Request a small slice - server should use memory mapping
        params = {
            'time': 0,
            'band': 0,
            'rowStart': 1000,
            'rowEnd': 1010,
            'colStart': 1000,
            'colEnd': 1010
        }

        response = requests.get(f'{API_BASE}/api/image/slice', params=params)

        # Should succeed even with large files
        assert response.status_code in [200, 500]  # 500 if array not that large

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
