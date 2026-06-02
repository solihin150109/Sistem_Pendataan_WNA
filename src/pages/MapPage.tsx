import { Search as SearchIcon, Globe, Navigation, Loader2, X, AlertCircle, MapPin } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { GoogleMapsService } from '../services/GoogleMapsService';

interface WNA {
  id: string;
  namaLengkap: string;
  noPaspor: string;
  negara: string;
  type: string;
  sponsor: string;
  alamat: string;
  domisili: string;
  latitude: number;
  longitude: number;
  status: string;
}

interface Region {
  id: string;
  name: string;
  displayName: string;
  coordinates?: [number, number][];
}

// GANTI DENGAN API KEY ASLI ANDA
const GOOGLE_MAPS_API_KEY = 'AIzaSyAG22bG2DtO7tDgeLCVao8XXDRrJ-_Buv8';

// Region boundaries data
const regionBoundaries: Record<string, any> = {
  'Kota Jambi': {
    features: [{
      geometry: {
        coordinates: [[[103.55, -1.65], [103.56, -1.66], [103.54, -1.67], [103.53, -1.65], [103.55, -1.65]]]
      },
      properties: { name: 'Kota Jambi' }
    }]
  },
  'Kab. Sarolangun': {
    features: [{
      geometry: {
        coordinates: [[[102.8, -2.3], [102.9, -2.35], [102.85, -2.4], [102.75, -2.35], [102.8, -2.3]]]
      },
      properties: { name: 'Kab. Sarolangun' }
    }]
  },
  'Kab. Muaro Jambi': {
    features: [{
      geometry: {
        coordinates: [[[103.6, -1.55], [103.7, -1.6], [103.65, -1.65], [103.55, -1.6], [103.6, -1.55]]]
      },
      properties: { name: 'Kab. Muaro Jambi' }
    }]
  },
  'Kab. Batang Hari': {
    features: [{
      geometry: {
        coordinates: [[[103.1, -1.9], [103.2, -1.95], [103.15, -2.0], [103.05, -1.95], [103.1, -1.9]]]
      },
      properties: { name: 'Kab. Batang Hari' }
    }]
  }
};

export default function MapPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [wnaData, setWnaData] = useState<WNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [boundsDrawn, setBoundsDrawn] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const dataFetched = useRef(false);
  const markersDrawn = useRef(false);
  const retryCount = useRef(0);

  // Fetch data WNA
  useEffect(() => {
    if (!dataFetched.current) {
      dataFetched.current = true;
      fetchWNAData();
    }
  }, []);

  const fetchWNAData = async () => {
    setLoading(true);
    try {
      const response = await api.getWNA({});
      if (response.success) {
        // Filter data with valid coordinates
        const dataWithCoords = response.data.filter((wna: WNA) => 
          wna.latitude && wna.longitude && 
          !isNaN(wna.latitude) && !isNaN(wna.longitude) &&
          wna.latitude >= -90 && wna.latitude <= 90 &&
          wna.longitude >= -180 && wna.longitude <= 180 &&
          wna.latitude !== 0 && wna.longitude !== 0
        );
        setWnaData(dataWithCoords);
        console.log(`✅ Loaded ${dataWithCoords.length} valid WNA data with coordinates`);
      }
    } catch (error) {
      console.error('Error fetching WNA:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Google Maps
  useEffect(() => {
    if (!isInitialized.current && !mapReady && retryCount.current < 3) {
      isInitialized.current = true;
      loadGoogleMaps();
    }
    
    return () => {
      if (isInitialized.current) {
        GoogleMapsService.destroyMap();
      }
    };
  }, [mapReady]);

  const loadGoogleMaps = async () => {
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setMapError("API Key Google Maps belum dikonfigurasi. Silakan hubungi administrator.");
      isInitialized.current = false;
      return;
    }

    try {
      console.log('Loading Google Maps with API Key...');
      await GoogleMapsService.loadAPI(GOOGLE_MAPS_API_KEY);
      console.log('Google Maps API loaded successfully');
      
      // Tunggu DOM benar-benar siap
      setTimeout(() => {
        initMap();
      }, 500);
    } catch (error) {
      console.error('Failed to load Google Maps:', error);
      setMapError("Gagal memuat Google Maps. Periksa koneksi internet atau API Key.");
      isInitialized.current = false;
      retryCount.current++;
    }
  };

  const initMap = () => {
    if (!mapRef.current) {
      console.error("Map container not found");
      setMapError("Container peta tidak ditemukan");
      return;
    }

    // Cek ukuran container
    const rect = mapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("Map container has zero size, retrying...");
      setTimeout(() => initMap(), 300);
      return;
    }

    if (!GoogleMapsService.isLoaded()) {
      console.error("Google Maps not available");
      setMapError("Google Maps tidak tersedia. Coba refresh halaman.");
      return;
    }

    try {
      const center = { lat: -1.65, lng: 103.2 };
      const map = GoogleMapsService.initMap(mapRef.current, center, 9);
      
      if (map) {
        setMapReady(true);
        setMapError(null);
        console.log("Map initialized successfully");
        
        // Draw boundaries setelah map siap
        setTimeout(() => {
          drawBoundaries();
        }, 500);
        
        // Draw markers setelah map siap
        setTimeout(() => {
          drawMarkers();
        }, 800);
      } else {
        setMapError("Gagal menginisialisasi peta");
      }
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError("Gagal menginisialisasi peta: " + (error as Error).message);
      isInitialized.current = false;
    }
  };

  const drawBoundaries = () => {
    if (!mapReady || boundsDrawn.current) return;
    
    try {
      const regionColors: Record<string, string> = {
        'Kota Jambi': '#ef4444',
        'Kab. Sarolangun': '#10b981',
        'Kab. Muaro Jambi': '#f59e0b',
        'Kab. Batang Hari': '#06b6d4'
      };
      
      Object.entries(regionBoundaries).forEach(([key, region]) => {
        const feature = region.features?.[0];
        const regionName = feature?.properties?.name || key;
        const coords = feature?.geometry?.coordinates;
        const color = regionColors[regionName] || '#22c55e';
        
        if (coords && coords[0] && coords[0].length > 0) {
          const path = coords[0].map((coord: [number, number]) => ({
            lat: coord[1],
            lng: coord[0]
          }));
          
          new google.maps.Polygon({
            paths: path,
            strokeColor: color,
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: 0.1,
            map: GoogleMapsService.getMap()
          });
        }
      });
      
      setBoundsDrawn(true);
      console.log("✅ Boundaries drawn");
    } catch (error) {
      console.error("Error drawing boundaries:", error);
    }
  };

  const drawMarkers = () => {
    if (!mapReady || markersDrawn.current) return;
    
    GoogleMapsService.clearMarkers();
    
    if (wnaData.length === 0) {
      console.log("No data to display");
      return;
    }
    
    const points: { lat: number; lng: number }[] = [];
    
    wnaData.forEach(wna => {
      let markerColor = 'blue';
      let typeName = 'VOA';
      
      switch (wna.type) {
        case 'VOA': markerColor = 'blue'; typeName = 'VOA'; break;
        case 'ITK': markerColor = 'green'; typeName = 'ITK'; break;
        case 'ITAS': markerColor = 'yellow'; typeName = 'ITAS'; break;
        case 'ITAP': markerColor = 'red'; typeName = 'ITAP'; break;
        default: markerColor = 'purple'; typeName = wna.type; break;
      }
      
      points.push({ lat: wna.latitude, lng: wna.longitude });
      
      const content = `
        <div style="padding: 12px; min-width: 240px; font-family: Arial, sans-serif;">
          <div style="border-bottom: 2px solid #${markerColor === 'blue' ? '3b82f6' : markerColor === 'green' ? '10b981' : markerColor === 'yellow' ? 'f59e0b' : 'ef4444'}; margin-bottom: 8px; padding-bottom: 6px;">
            <strong style="font-size: 14px;">${wna.namaLengkap}</strong>
            <span style="float: right; background: #${markerColor === 'blue' ? '3b82f6' : markerColor === 'green' ? '10b981' : markerColor === 'yellow' ? 'f59e0b' : 'ef4444'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 10px;">${typeName}</span>
          </div>
          <p style="margin: 6px 0;"><strong>Negara:</strong> ${wna.negara}</p>
          <p style="margin: 6px 0;"><strong>Paspor:</strong> ${wna.noPaspor}</p>
          <p style="margin: 6px 0;"><strong>Sponsor:</strong> ${wna.sponsor}</p>
          <p style="margin: 6px 0;"><strong>Domisili:</strong> ${wna.domisili}</p>
          <hr style="margin: 8px 0;">
          <a href="https://www.google.com/maps/dir/?api=1&destination=${wna.latitude},${wna.longitude}" target="_blank" rel="noopener noreferrer" style="color: #3b82f6; text-decoration: none;">🗺️ Buka Rute di Google Maps</a>
        </div>
      `;
      
      GoogleMapsService.addMarkerWithInfoWindow(
        { lat: wna.latitude, lng: wna.longitude },
        wna.namaLengkap,
        content,
        markerColor
      );
    });
    
    if (points.length > 0) {
      GoogleMapsService.fitBounds(points);
    }
    
    markersDrawn.current = true;
    console.log(`✅ ${wnaData.length} markers drawn`);
  };

  // Update markers when data or map ready changes
  useEffect(() => {
    if (mapReady && wnaData.length > 0 && !markersDrawn.current) {
      setTimeout(() => drawMarkers(), 500);
    }
  }, [mapReady, wnaData]);

  // Filter data untuk search
  const filteredWNA = wnaData.filter(wna => 
    wna.namaLengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wna.negara.toLowerCase().includes(searchTerm.toLowerCase()) ||
    wna.noPaspor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCurrentLocation = () => {
    if (!mapReady) {
      setLocationStatus("Peta belum siap");
      setTimeout(() => setLocationStatus(''), 3000);
      return;
    }
    
    setLocationStatus("Mendapatkan lokasi...");
    
    GoogleMapsService.getCurrentPosition()
      .then(({ lat, lng, address }) => {
        setLocationStatus("Lokasi ditemukan!");
        setTimeout(() => setLocationStatus(''), 2000);
        GoogleMapsService.setCenter(lat, lng, 15);
        
        // Tambah marker lokasi user
        GoogleMapsService.addMarker(
          { lat, lng },
          "Lokasi Anda",
          "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        );
      })
      .catch((error) => {
        setLocationStatus(error.message);
        setTimeout(() => setLocationStatus(''), 3000);
      });
  };

  const resetMapView = () => {
    if (!mapReady) return;
    if (wnaData.length > 0) {
      const points = wnaData.map(w => ({ lat: w.latitude, lng: w.longitude }));
      GoogleMapsService.fitBounds(points);
    } else {
      GoogleMapsService.setCenter(-1.65, 103.2, 9);
    }
  };

  const flyToLocation = (lat: number, lng: number) => {
    if (!mapReady) return;
    GoogleMapsService.setCenter(lat, lng, 16);
    setShowSearchPanel(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-blue mx-auto mb-4" />
          <p className="text-slate-500">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-3">
            <Globe className="h-6 w-6 text-primary-blue" />
            Geospatial Monitoring
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1">
            Wilayah Kerja Kantor Imigrasi Kelas I TPI Jambi
          </p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Cari nama, negara, paspor..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchPanel(e.target.value.length > 0);
              }}
              className="h-10 w-full md:w-80 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-primary-blue"
            />
          </div>
          
          <button
            onClick={getCurrentLocation}
            className="h-10 w-10 rounded-xl bg-primary-blue/10 text-primary-blue flex items-center justify-center hover:bg-primary-blue/20 transition-all"
            title="Lokasi saya"
          >
            <Navigation className="h-4 w-4" />
          </button>
          
          <button
            onClick={resetMapView}
            className="h-10 px-4 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all"
          >
            Reset Peta
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl border border-slate-200">
            <div className={`h-2 w-2 rounded-full ${!mapReady ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            <span className="text-[10px] font-bold">
              {!mapReady ? 'Memuat Peta...' : `${filteredWNA.length} Titik Aktif`}
            </span>
          </div>
        </div>
      </div>

      {locationStatus && (
        <div className="text-sm px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
          {locationStatus}
        </div>
      )}

      {mapError && (
        <div className="text-sm px-4 py-3 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{mapError}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 rounded-3xl overflow-hidden border border-slate-200 shadow-2xl relative bg-slate-100">
        <div 
          ref={mapRef} 
          className="w-full h-full" 
          style={{ minHeight: '500px', position: 'relative' }}
          id="google-map-container"
        />
        
        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-blue mx-auto mb-3" />
              <p className="text-sm text-slate-500">Memuat Google Maps...</p>
            </div>
          </div>
        )}
        
        {/* Search Panel */}
        {showSearchPanel && searchTerm && filteredWNA.length > 0 && (
          <div className="absolute top-4 left-4 z-20 bg-white rounded-2xl shadow-xl border w-80 max-h-96 overflow-auto">
            <div className="p-3 border-b bg-slate-50 flex justify-between items-center sticky top-0">
              <span className="text-xs font-bold">Hasil: {filteredWNA.length}</span>
              <button 
                onClick={() => setShowSearchPanel(false)}
                className="p-1 hover:bg-slate-200 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y">
              {filteredWNA.slice(0, 20).map((wna) => (
                <div 
                  key={wna.id} 
                  className="p-3 hover:bg-slate-50 cursor-pointer"
                  onClick={() => flyToLocation(wna.latitude, wna.longitude)}
                >
                  <div className="font-bold text-sm flex items-center justify-between">
                    {wna.namaLengkap}
                    <span className="text-xs text-slate-400">{wna.type}</span>
                  </div>
                  <div className="text-xs text-slate-500">{wna.negara} • {wna.noPaspor}</div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {wna.domisili}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute bottom-4 right-4 z-20 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200">
          <div className="text-xs font-bold mb-2">Legenda</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-xs">VOA</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-xs">ITK</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-xs">ITAS</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-xs">ITAP</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}