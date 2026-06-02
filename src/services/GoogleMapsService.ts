// src/services/GoogleMapsService.ts
export class GoogleMapsService {
  private static instance: GoogleMapsService;
  private mapInstance: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private isLoaded = false;

  static getInstance(): GoogleMapsService {
    if (!GoogleMapsService.instance) {
      GoogleMapsService.instance = new GoogleMapsService();
    }
    return GoogleMapsService.instance;
  }

  loadAPI(apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        this.isLoaded = true;
        resolve();
        return;
      }

      const oldScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (oldScript) {
        oldScript.remove();
      }

      // Load dengan Geocoding dan Places
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&v=quarterly`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        const checkGoogle = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.Geocoder) {
            clearInterval(checkGoogle);
            this.isLoaded = true;
            resolve();
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkGoogle);
          if (!window.google || !window.google.maps) {
            reject(new Error('Google Maps timeout'));
          }
        }, 5000);
      };
      
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }

  initMap(element: HTMLElement, center: { lat: number; lng: number }, zoom: number = 12): google.maps.Map | null {
    if (!element || !window.google?.maps) return null;

    if (this.mapInstance) {
      return this.mapInstance;
    }

    try {
      this.mapInstance = new google.maps.Map(element, {
        center,
        zoom,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      return this.mapInstance;
    } catch (error) {
      console.error("Error creating map:", error);
      return null;
    }
  }

  addMarker(position: { lat: number; lng: number }, title: string, iconUrl?: string): google.maps.Marker | null {
    if (!this.mapInstance) return null;

    const marker = new google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
    });

    this.markers.push(marker);
    return marker;
  }

  addMarkerWithInfoWindow(
    position: { lat: number; lng: number },
    title: string,
    content: string,
    iconColor?: string
  ): google.maps.Marker | null {
    if (!this.mapInstance) return null;

    let iconUrl = iconColor ? `https://maps.google.com/mapfiles/ms/icons/${iconColor}-dot.png` : undefined;

    const marker = new google.maps.Marker({
      position,
      map: this.mapInstance,
      title,
      icon: iconUrl,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="padding: 12px; max-width: 280px;">${content}</div>`,
    });

    marker.addListener('click', () => {
      infoWindow.close();
      infoWindow.open(this.mapInstance!, marker);
    });

    this.markers.push(marker);
    return marker;
  }

  clearMarkers(): void {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
  }

  // Geocoding - mencari alamat ke koordinat (menggunakan Geocoder)
  async searchLocation(query: string): Promise<Array<{ lat: number; lng: number; address: string }>> {
    if (!window.google || !window.google.maps) {
      console.error("Google Maps not loaded");
      return [];
    }

    const geocoder = new google.maps.Geocoder();
    
    return new Promise((resolve) => {
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const locations = results.map(result => ({
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
            address: result.formatted_address,
          }));
          resolve(locations);
        } else {
          console.log("Geocoding status:", status);
          resolve([]);
        }
      });
    });
  }

  // Reverse geocoding - koordinat ke alamat
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!window.google || !window.google.maps) return `${lat}, ${lng}`;

    const geocoder = new google.maps.Geocoder();
    
    return new Promise((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address);
        } else {
          resolve(`${lat}, ${lng}`);
        }
      });
    });
  }

  getCurrentPosition(): Promise<{ lat: number; lng: number; address: string }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const address = await this.reverseGeocode(lat, lng);
          resolve({ lat, lng, address });
        },
        (error) => {
          let message = 'Gagal mendapatkan lokasi';
          if (error.code === 1) message = 'Akses lokasi ditolak';
          else if (error.code === 2) message = 'Posisi tidak tersedia';
          else if (error.code === 3) message = 'Waktu habis';
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  fitBounds(points: { lat: number; lng: number }[]): void {
    if (!this.mapInstance || points.length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => bounds.extend(point));
    this.mapInstance.fitBounds(bounds);
  }

  setCenter(lat: number, lng: number, zoom?: number): void {
    if (!this.mapInstance) return;
    this.mapInstance.setCenter({ lat, lng });
    if (zoom) this.mapInstance.setZoom(zoom);
  }

  destroyMap(): void {
    if (this.mapInstance) {
      this.clearMarkers();
      this.mapInstance = null;
    }
  }
}
