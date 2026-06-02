// client/src/services/GoogleMapsService.ts

export class GoogleMapsServiceClass {
  private mapInstance: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
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
      if (window.google && window.google.maps) {
        this.isAPILoaded = true;
        this.geocoder = new google.maps.Geocoder();
        resolve();
        return;
      }

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
      script.onerror = () => {
        delete (window as any)[callbackName];
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

  getCurrentPosition(): Promise<{ lat: number; lng: number; address: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
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
          if (error.code === 1) message = 'Akses lokasi ditolak';
          if (error.code === 2) message = 'Informasi lokasi tidak tersedia';
          if (error.code === 3) message = 'Waktu pengambilan lokasi habis';
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  geocodeLatLng(lat: number, lng: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.geocoder) {
        reject(new Error('Geocoder not available'));
        return;
      }

      this.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
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

  addMarkerWithInfoWindow(
    position: { lat: number; lng: number },
    title: string,
    content: string,
    markerColor?: string
  ): google.maps.Marker | null {
    if (!this.mapInstance || !window.google) return null;

    let iconUrl: string | undefined;
    if (markerColor) {
      const colors: Record<string, string> = {
        blue: 'blue', green: 'green', yellow: 'yellow',
        red: 'red', purple: 'purple', orange: 'orange'
      };
      const color = colors[markerColor.toLowerCase()] || 'red';
      iconUrl = `http://maps.google.com/mapfiles/ms/icons/${color}.png`;
    }

    const marker = new google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
      animation: google.maps.Animation.DROP,
    });

    const infoWindow = new google.maps.InfoWindow({ content, maxWidth: 300 });
    marker.addListener('click', () => infoWindow.open(this.mapInstance, marker));
    this.markers.push(marker);
    return marker;
  }

  clearMarkers(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    if (this.mapInstance) {
      this.mapInstance.setCenter({ lat, lng });
      if (zoom) this.mapInstance.setZoom(zoom);
    }
  }

  fitBounds(points: { lat: number; lng: number }[]): void {
    if (!this.mapInstance || !window.google || points.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    this.mapInstance.fitBounds(bounds);
  }

  destroyMap(): void {
    this.clearMarkers();
    if (this.mapInstance) {
      this.mapInstance = null;
    }
  }

  getMap(): google.maps.Map | null {
    return this.mapInstance;
  }

  isLoaded(): boolean {
    return this.isAPILoaded;
  }
}

export const GoogleMapsService = new GoogleMapsServiceClass();  