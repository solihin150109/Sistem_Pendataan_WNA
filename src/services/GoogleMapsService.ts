// client/src/services/GoogleMapsService.ts

declare global {
  interface Window {
    google: any;
    initGoogleMapsCallback: (() => void) | null;
  }
}

export interface MapOptions {
  center: { lat: number; lng: number };
  zoom: number;
}

class GoogleMapsServiceClass {
  private mapInstance: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private isAPILoaded = false;
  private loadPromise: Promise<void> | null = null;

  loadAPI(apiKey: string): Promise<void> {
    if (this.isAPILoaded) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.maps && window.google.maps.Map) {
        this.isAPILoaded = true;
        this.geocoder = new window.google.maps.Geocoder();
        resolve();
        return;
      }

      // Create callback
      const callbackName = 'initGoogleMaps_' + Date.now();
      window[callbackName] = () => {
        delete window[callbackName];
        this.isAPILoaded = true;
        this.geocoder = new window.google.maps.Geocoder();
        resolve();
      };

      // Load script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}&libraries=places,geometry`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window[callbackName];
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  initMap(container: HTMLElement, center: { lat: number; lng: number }, zoom: number): google.maps.Map | null {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded');
      return null;
    }

    this.mapInstance = new window.google.maps.Map(container, {
      center,
      zoom,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    return this.mapInstance;
  }

  getCurrentPosition(): Promise<{ lat: number; lng: number; address: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          let address = '';
          if (this.geocoder) {
            try {
              address = await this.geocodeLatLng(lat, lng);
            } catch (e) {
              console.error('Geocoding error:', e);
            }
          }
          
          resolve({ lat, lng, address });
        },
        (error) => {
          let message = 'Gagal mengambil lokasi';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Akses lokasi ditolak. Izinkan akses lokasi di browser Anda.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Informasi lokasi tidak tersedia';
              break;
            case error.TIMEOUT:
              message = 'Waktu pengambilan lokasi habis';
              break;
          }
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  geocodeLatLng(lat: number, lng: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.geocoder) {
        reject(new Error('Geocoder not available'));
        return;
      }

      const latlng = { lat, lng };
      this.geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          reject(new Error('Geocoder failed: ' + status));
        }
      });
    });
  }

  addMarker(position: { lat: number; lng: number }, title: string, iconUrl?: string): google.maps.Marker | null {
    if (!this.mapInstance || !window.google) return null;

    const marker = new window.google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
      animation: window.google.maps.Animation.DROP,
    });

    this.markers.push(marker);
    return marker;
  }

  addMarkerWithInfoWindow(
    position: { lat: number; lng: number },
    title: string,
    content: string,
    markerColor?: string
  ): google.maps.Marker | null {
    if (!this.mapInstance || !window.google) return null;

    // Custom icon based on color
    let iconUrl: string | undefined;
    if (markerColor) {
      const colorMap: Record<string, string> = {
        blue: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        green: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
        yellow: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
        red: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        purple: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png',
        orange: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
      };
      iconUrl = colorMap[markerColor.toLowerCase()] || colorMap.red;
    }

    const marker = new window.google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
      animation: window.google.maps.Animation.DROP,
    });

    const infoWindow = new window.google.maps.InfoWindow({
      content,
      maxWidth: 300,
    });

    marker.addListener('click', () => {
      infoWindow.open(this.mapInstance, marker);
    });

    this.markers.push(marker);
    return marker;
  }

  clearMarkers(): void {
    this.markers.forEach(marker => {
      marker.setMap(null);
    });
    this.markers = [];
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    if (this.mapInstance) {
      this.mapInstance.setCenter({ lat, lng });
      if (zoom) {
        this.mapInstance.setZoom(zoom);
      }
    }
  }

  fitBounds(points: { lat: number; lng: number }[]): void {
    if (!this.mapInstance || !window.google || points.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach(point => {
      bounds.extend(point);
    });
    this.mapInstance.fitBounds(bounds);
  }

  drawRegions(regions: any[]): void {
    if (!this.mapInstance || !window.google) return;

    const regionColors: Record<string, string> = {
      'Kota Jambi': '#ef4444',
      'Kab. Sarolangun': '#10b981',
      'Kab. Muaro Jambi': '#f59e0b',
      'Kab. Batang Hari': '#06b6d4'
    };

    regions.forEach(region => {
      if (region.coordinates && region.coordinates.length > 0) {
        const path = region.coordinates.map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0]
        }));

        const color = regionColors[region.name] || '#22c55e';

        new window.google.maps.Polygon({
          paths: path,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.1,
          map: this.mapInstance
        });
      }
    });
  }

  destroyMap(): void {
    this.clearMarkers();
    if (this.infoWindow) {
      this.infoWindow.close();
      this.infoWindow = null;
    }
    if (this.mapInstance) {
      this.mapInstance = null;
    }
    this.geocoder = null;
  }

  getMap(): google.maps.Map | null {
    return this.mapInstance;
  }

  isLoaded(): boolean {
    return this.isAPILoaded;
  }
}

export const GoogleMapsService = new GoogleMapsServiceClass();