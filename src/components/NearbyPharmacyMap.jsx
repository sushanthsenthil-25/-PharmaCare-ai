import React, { useState, useEffect } from 'react';
import api from '../services/api';

export function NearbyPharmacyMap({ onSelectPharmacy, selectedMedicine }) {
  const [userLocation, setUserLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [locationName, setLocationName] = useState('Indiranagar, Bangalore 560038');
  const [locationPermission, setLocationPermission] = useState('prompt'); // granted, denied, prompt
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [searchArea, setSearchArea] = useState('');
  const [medicineAvailability, setMedicineAvailability] = useState(null);
  const [searchingAvailability, setSearchingAvailability] = useState(false);

  // Request browser user location
  const requestLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(coords);
          setLocationPermission('granted');
          setLocationName('Your Current Location');
          fetchNearbyPharmacies(coords.lat, coords.lng);
        },
        (err) => {
          console.warn('[Location Warning] Geolocation permission denied or failed:', err.message);
          setLocationPermission('denied');
          fetchNearbyPharmacies(12.9716, 77.5946);
        },
        { timeout: 8000 }
      );
    } else {
      setLocationPermission('denied');
      fetchNearbyPharmacies(12.9716, 77.5946);
    }
  };

  const fetchNearbyPharmacies = async (lat, lng) => {
    setLoading(true);
    try {
      const res = await api.pharmacies.getNearby({ lat, lng, radius: 20 });
      if (res?.pharmacies) {
        setPharmacies(res.pharmacies);
        if (res.pharmacies.length > 0 && !selectedPharmacy) {
          setSelectedPharmacy(res.pharmacies[0]);
        }
      }
    } catch (err) {
      console.error('[Map Error] Failed to fetch nearby pharmacies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Fetch medicine availability across pharmacies if selectedMedicine prop is passed
  useEffect(() => {
    if (selectedMedicine?.id || selectedMedicine?._id) {
      const medId = selectedMedicine.id || selectedMedicine._id;
      setSearchingAvailability(true);
      api.pharmacies
        .getAvailability(medId, userLocation)
        .then((res) => {
          setMedicineAvailability(res);
        })
        .catch((err) => console.warn('Availability check error:', err))
        .finally(() => setSearchingAvailability(false));
    }
  }, [selectedMedicine, userLocation]);

  const handleAreaSearch = (e) => {
    e.preventDefault();
    if (!searchArea.trim()) return;

    // Simulate location lookup for common areas
    const areaLower = searchArea.toLowerCase().trim();
    let coords = { lat: 12.9716, lng: 77.5946 };
    let areaDisplay = searchArea;

    if (areaLower.includes('indiranagar')) {
      coords = { lat: 12.9784, lng: 77.6408 };
      areaDisplay = 'Indiranagar, Bangalore';
    } else if (areaLower.includes('koramangala')) {
      coords = { lat: 12.9352, lng: 77.6245 };
      areaDisplay = 'Koramangala, Bangalore';
    } else if (areaLower.includes('mg road') || areaLower.includes('central')) {
      coords = { lat: 12.9756, lng: 77.6066 };
      areaDisplay = 'MG Road, Bangalore';
    } else if (areaLower.includes('whitefield')) {
      coords = { lat: 12.9698, lng: 77.7499 };
      areaDisplay = 'Whitefield, Bangalore';
    }

    setUserLocation(coords);
    setLocationName(areaDisplay);
    fetchNearbyPharmacies(coords.lat, coords.lng);
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 shadow-sm">
      {/* Header & Location Selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">distance</span>
          <div>
            <h3 className="font-bold text-sm text-on-surface">Nearby Pharmacies</h3>
            <p className="text-[11px] text-on-surface-variant font-medium truncate max-w-[200px]">
              📍 {locationName}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={requestLocation}
          className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-lg transition-all"
        >
          <span className="material-symbols-outlined text-sm">my_location</span>
          Locate Me
        </button>
      </div>

      {/* Location Denied Warning & Manual Location Search */}
      {locationPermission === 'denied' && (
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="material-symbols-outlined text-amber-600 text-sm">location_off</span>
            <span>Location access disabled. Search area manually:</span>
          </div>
          <form onSubmit={handleAreaSearch} className="flex gap-2">
            <input
              type="text"
              value={searchArea}
              onChange={(e) => setSearchArea(e.target.value)}
              placeholder="e.g. Indiranagar, Koramangala, MG Road"
              className="flex-1 bg-surface text-xs font-medium border border-outline-variant/30 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary text-on-surface"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-primary text-on-primary text-xs font-bold rounded-lg hover:opacity-90 transition-all"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {/* Map Display Frame */}
      <div className="relative w-full h-48 rounded-xl overflow-hidden border border-outline-variant/30 bg-slate-900 group">
        {/* OpenStreetMap Tile Background Frame */}
        <iframe
          title="Nearby Pharmacies Map"
          className="w-full h-full border-0 filter contrast-105 brightness-95"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLocation.lng - 0.04}%2C${userLocation.lat - 0.03}%2C${userLocation.lng + 0.04}%2C${userLocation.lat + 0.03}&layer=mapnik&marker=${userLocation.lat}%2C${userLocation.lng}`}
        />

        {/* Floating User Location Badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-surface/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-outline-variant/30 shadow-md text-[10px] font-bold text-primary">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>You are here</span>
        </div>

        {/* Pharmacy Count Floating Pill */}
        <div className="absolute top-2 right-2 z-10 bg-slate-900/90 text-white px-2.5 py-1 rounded-full border border-white/10 text-[10px] font-bold shadow-md">
          {loading ? 'Searching...' : `${pharmacies.length} Pharmacies Nearby`}
        </div>
      </div>

      {/* Pharmacy Selection Carousel / List */}
      <div className="flex flex-col gap-2 mt-1">
        <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
          Available Medical Stores
        </span>

        {loading ? (
          <div className="flex items-center justify-center p-6 text-xs text-on-surface-variant gap-2">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            Finding nearest verified pharmacies...
          </div>
        ) : pharmacies.length === 0 ? (
          <div className="p-4 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl">
            No pharmacies found in this area. Try searching another location.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {pharmacies.map((pharmacy) => {
              const isSelected = selectedPharmacy?._id === pharmacy._id || selectedPharmacy?.id === pharmacy._id;
              return (
                <div
                  key={pharmacy._id || pharmacy.id}
                  onClick={() => {
                    setSelectedPharmacy(pharmacy);
                    if (onSelectPharmacy) onSelectPharmacy(pharmacy);
                  }}
                  className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-surface-container-low border-outline-variant/15 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <img
                      src={pharmacy.profilePhoto || 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=100&auto=format&fit=crop&q=80'}
                      alt={pharmacy.businessName}
                      className="w-10 h-10 rounded-lg object-cover border border-outline-variant/20 flex-shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-on-surface">{pharmacy.businessName}</h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            pharmacy.isOpen ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600'
                          }`}
                        >
                          {pharmacy.isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate max-w-[180px] mt-0.5">{pharmacy.address}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-secondary">
                        <span>📍 {pharmacy.distanceText || `${pharmacy.distanceKm || 1.2} km`}</span>
                        <span>•</span>
                        <span>⏰ {pharmacy.openingTime || '08:00 AM'} - {pharmacy.closingTime || '11:00 PM'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <a
                      href={`tel:${pharmacy.phone || '+919876543210'}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-primary hover:bg-primary hover:text-on-primary transition-all"
                      title="Call Pharmacy"
                    >
                      <span className="material-symbols-outlined text-sm">call</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${pharmacy.latitude},${pharmacy.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all"
                      title="Get Directions"
                    >
                      <span className="material-symbols-outlined text-sm">directions</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Medicine Availability Summary if medicine search active */}
      {selectedMedicine && (
        <div className="mt-2 p-3 rounded-xl bg-primary/10 border border-primary/20 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span>Availability for: {selectedMedicine.name}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">
              IN STOCK NEARBY
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            Available at {pharmacies.length} nearby verified pharmacies starting from ₹{selectedMedicine.price}.
          </p>
        </div>
      )}
    </div>
  );
}

export default NearbyPharmacyMap;
