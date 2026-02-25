import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const MapComponent = ({ 
  pickupLocation, 
  destinationLocation, 
  driverLocation,
  onMapClick,
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
            width: 24px;
            height: 24px;
            background: #22c55e;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          "></div>
        `;
        pickupMarker.current = new mapboxgl.Marker(el)
          .setLngLat([pickupLocation.lng, pickupLocation.lat])
          .addTo(map.current);
      }
    }
  }, [pickupLocation, mapLoaded]);

  // Update destination marker
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
            width: 24px;
            height: 24px;
            background: #facc15;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          "></div>
        `;
        destinationMarker.current = new mapboxgl.Marker(el)
          .setLngLat([destinationLocation.lng, destinationLocation.lat])
          .addTo(map.current);
      }

      // Fit bounds to show both markers
      if (pickupLocation?.lat && pickupLocation?.lng) {
        const bounds = new mapboxgl.LngLatBounds()
          .extend([pickupLocation.lng, pickupLocation.lat])
          .extend([destinationLocation.lng, destinationLocation.lat]);
        
        map.current.fitBounds(bounds, { padding: 80 });
      }
    }
  }, [destinationLocation, pickupLocation, mapLoaded]);

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
            width: 40px;
            height: 40px;
            background: #3b82f6;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
          </div>
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
