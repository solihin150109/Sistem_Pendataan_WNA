// client/src/services/GoogleMapsService.ts
export interface MapOptions {
  center: { lat: number; lng: number };
  zoom: number;
}

export interface MarkerOptions {
  position: { lat: number; lng: number };
  title: string;
  icon?: string;
}

class GoogleMapsService {
  private mapInstance: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private geocoder: google.maps.Geocoder | null = null;
  private isAPILoaded = false;
  private loadPromise: Promise<void> | null = null;

  // Load Google Maps API
  loadAPI(apiKey: string): Promise<void> {
    if (this.isAPILoaded) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.google && window.google.maps) {
        this.isAPILoaded = true;
        this.geocoder = new google.maps.Geocoder();
        resolve();
        return;
      }

      // Create script element
      const script = document.createElement('script');
      const callbackName = 'initGoogleMaps_' + Date.now();
      
      (window as any)[callbackName] = () => {
        delete (window as any)[callbackName];
        this.isAPILoaded = true;
        this.geocoder = new google.maps.Geocoder();
        resolve();
      };

      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onerror = (error) => {
        delete (window as any)[callbackName];
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }

  // Initialize map
  initMap(container: HTMLElement, center: { lat: number; lng: number }, zoom: number): google.maps.Map | null {
    if (!window.google || !window.google.maps) {
      console.error('Google Maps not loaded');
      return null;
    }

    this.mapInstance = new google.maps.Map(container, {
      center,
      zoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: true,
      fullscreenControl: true,
    });

    return this.mapInstance;
  }

  // Get current position
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
              const result = await this.geocodeLatLng(lat, lng);
              address = result;
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
              message = 'Akses lokasi ditolak';
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
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  // Geocode lat/lng to address
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

  // Add marker
  addMarker(position: { lat: number; lng: number }, title: string, iconUrl?: string): google.maps.Marker | null {
    if (!this.mapInstance || !window.google) return null;

    const marker = new google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
      animation: google.maps.Animation.DROP,
    });

    this.markers.push(marker);
    return marker;
  }

  // Add marker with info window
  addMarkerWithInfoWindow(
    position: { lat: number; lng: number },
    title: string,
    content: string,
    markerColor?: string
  ): google.maps.Marker | null {
    if (!this.mapInstance || !window.google) return null;

    // Create custom icon based on color
    let iconUrl: string | undefined;
    if (markerColor) {
      const pinColor = this.getPinColor(markerColor);
      iconUrl = `http://maps.google.com/mapfiles/ms/icons/${pinColor}.png`;
    }

    const marker = new google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
      animation: google.maps.Animation.DROP,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: content,
      maxWidth: 300,
    });

    marker.addListener('click', () => {
      infoWindow.open(this.mapInstance, marker);
    });

    this.markers.push(marker);
    return marker;
  }

  // Get pin color
  private getPinColor(color: string): string {
    const colors: Record<string, string> = {
      blue: 'blue',
      green: 'green',
      yellow: 'yellow',
      red: 'red',
      purple: 'purple',
      orange: 'orange',
    };
    return colors[color.toLowerCase()] || 'red';
  }

  // Clear all markers
  clearMarkers(): void {
    this.markers.forEach(marker => {
      marker.setMap(null);
    });
    this.markers = [];
  }

  // Set center
  setCenter(lat: number, lng: number, zoom?: number): void {
    if (this.mapInstance) {
      this.mapInstance.setCenter({ lat, lng });
      if (zoom) {
        this.mapInstance.setZoom(zoom);
      }
    }
  }

  // Fit bounds to markers
  fitBounds(points: { lat: number; lng: number }[]): void {
    if (!this.mapInstance || !window.google || points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => {
      bounds.extend(point);
    });
    this.mapInstance.fitBounds(bounds);
  }

  // Destroy map
  destroyMap(): void {
    this.clearMarkers();
    if (this.infoWindow) {
      this.infoWindow.close();
      this.infoWindow = null;
    }
    if (this.mapInstance) {
      this.mapInstance = null;
    }
  }

  // Get map instance
  getMap(): google.maps.Map | null {
    return this.mapInstance;
  }

  // Check if API is loaded
  isLoaded(): boolean {
    return this.isAPILoaded;
  }
}

export const GoogleMapsService = new GoogleMapsService();