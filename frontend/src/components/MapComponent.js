import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const MapComponent = ({ 
  pickupLocation, 
  destinationLocation, 
  driverLocation,
  onMapClick,
  onRouteCalculated,
  className = ''
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const pickupMarker = useRef(null);
  const destinationMarker = useRef(null);
  const driverMarker = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [2.3522, 48.8566], // Paris
      zoom: 12
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add route source and layer
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      // Route line glow effect (background)
      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#facc15',
          'line-width': 12,
          'line-opacity': 0.3,
          'line-blur': 3
        }
      });

      // Main route line
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#facc15',
          'line-width': 5,
          'line-opacity': 0.9
        }
      });

      // Animated dashes
      map.current.addLayer({
        id: 'route-dashes',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
          'line-dasharray': [2, 4]
        }
      });
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Handle map click
    map.current.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Fetch and draw route
  const fetchRoute = useCallback(async (start, end) => {
    if (!map.current || !mapLoaded) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?` +
        `geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates;

        // Update the route source
        map.current.getSource('route').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates
          }
        });

        // Calculate duration and distance
        const durationMinutes = Math.round(route.duration / 60);
        const distanceKm = (route.distance / 1000).toFixed(1);

        // Callback with route info
        if (onRouteCalculated) {
          onRouteCalculated({
            duration: durationMinutes,
            distance: distanceKm,
            coordinates: coordinates
          });
        }

        // Fit bounds to show entire route
        const bounds = new mapboxgl.LngLatBounds();
        coordinates.forEach(coord => bounds.extend(coord));
        map.current.fitBounds(bounds, { padding: 80 });
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  }, [mapLoaded, onRouteCalculated]);

  // Update pickup marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (pickupLocation?.lat && pickupLocation?.lng) {
      if (pickupMarker.current) {
        pickupMarker.current.setLngLat([pickupLocation.lng, pickupLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'pickup-marker';
        el.innerHTML = `
          <div style="
            width: 28px;
            height: 28px;
            background: #22c55e;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
        `;
        pickupMarker.current = new mapboxgl.Marker(el)
          .setLngLat([pickupLocation.lng, pickupLocation.lat])
          .addTo(map.current);
      }
    }
  }, [pickupLocation, mapLoaded]);

  // Update destination marker and fetch route
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (destinationLocation?.lat && destinationLocation?.lng) {
      if (destinationMarker.current) {
        destinationMarker.current.setLngLat([destinationLocation.lng, destinationLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'destination-marker';
        el.innerHTML = `
          <div style="
            width: 28px;
            height: 28px;
            background: #facc15;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#000">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            </svg>
          </div>
        `;
        destinationMarker.current = new mapboxgl.Marker(el)
          .setLngLat([destinationLocation.lng, destinationLocation.lat])
          .addTo(map.current);
      }

      // Fetch route when both markers are set
      if (pickupLocation?.lat && pickupLocation?.lng) {
        fetchRoute(pickupLocation, destinationLocation);
      }
    } else {
      // Clear route if no destination
      if (map.current.getSource('route')) {
        map.current.getSource('route').setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
      }
    }
  }, [destinationLocation, pickupLocation, mapLoaded, fetchRoute]);

  // Update driver marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (driverLocation?.lat && driverLocation?.lng) {
      if (driverMarker.current) {
        driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = `
          <div style="
            width: 44px;
            height: 44px;
            background: #3b82f6;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s ease-in-out infinite;
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.1); }
            }
          </style>
        `;
        driverMarker.current = new mapboxgl.Marker(el)
          .setLngLat([driverLocation.lng, driverLocation.lat])
          .addTo(map.current);
      }
    }
  }, [driverLocation, mapLoaded]);

  return (
    <div 
      ref={mapContainer} 
      className={`w-full h-full ${className}`}
      style={{ minHeight: '300px' }}
    />
  );
};

export default MapComponent;
