import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const RADIUS_OPTIONS = [1, 3, 5, 10];

export function NearbyPharmacyMap({ onSelectPharmacy, selectedMedicine }) {
  const {
    location: appLocation,
    userCoordinates,
    updateDeliveryLocation,
    setIsLocationModalOpen,
  } = useApp();

  // Selected search radius: Defaults strictly to 5 km as specified
  const [selectedRadius, setSelectedRadius] = useState(5);
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [medicineAvailability, setMedicineAvailability] = useState(null);
  const [searchingAvailability, setSearchingAvailability] = useState(false);

  // Effective coordinates from AppContext
  const currentCoords = userCoordinates || { lat: 12.9784, lng: 77.6408 };

  const fetchNearbyPharmacies = useCallback(async (lat, lng, radius) => {
    setLoading(true);
    setLocationError(null);
    try {
      const res = await api.pharmacies.getNearby({ lat, lng, radius });
      if (res?.pharmacies) {
        setPharmacies(res.pharmacies);
        if (res.pharmacies.length > 0) {
          setSelectedPharmacy((prev) => {
            const stillExists = res.pharmacies.find((p) => p._id === prev?._id || p.id === prev?.id);
            return stillExists || res.pharmacies[0];
          });
        } else {
          setSelectedPharmacy(null);
        }
      }
    } catch (err) {
      console.error('[Map Error] Failed to fetch nearby pharmacies:', err);
      setLocationError('Unable to load nearby pharmacy network.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when coordinates or radius change
  useEffect(() => {
    fetchNearbyPharmacies(currentCoords.lat, currentCoords.lng, selectedRadius);
  }, [currentCoords.lat, currentCoords.lng, selectedRadius, fetchNearbyPharmacies]);

  // Request browser user location ONLY upon explicit user click
  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const resolved = await api.pharmacies.reverseGeocode(coords.lat, coords.lng);
          const addressText = resolved?.address || `GPS Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
          updateDeliveryLocation(addressText, coords);
        } catch (_) {
          updateDeliveryLocation(`Location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`, coords);
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission was denied. Tap the address above to select your area manually.');
        } else {
          setLocationError('Could not determine exact GPS location. Please select your locality.');
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Fetch medicine availability across nearby pharmacies if selectedMedicine prop is passed
  useEffect(() => {
    if (selectedMedicine?.id || selectedMedicine?._id) {
      const medId = selectedMedicine.id || selectedMedicine._id;
      setSearchingAvailability(true);
      api.pharmacies
        .getAvailability(medId, currentCoords)
        .then((res) => {
          setMedicineAvailability(res);
        })
        .catch((err) => console.warn('Availability check error:', err))
        .finally(() => setSearchingAvailability(false));
    }
  }, [selectedMedicine, currentCoords]);

  return (
    <div className="flex flex-col gap-2.5 w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-3 shadow-sm">
      {/* Header & Location Selector */}
      <div className="flex items-center justify-between gap-2">
        <div 
          onClick={() => setIsLocationModalOpen(true)}
          className="flex items-center gap-2 cursor-pointer group min-w-0 flex-1"
          title="Click to change your delivery location"
        >
          <span className="material-symbols-outlined text-primary text-lg shrink-0 group-hover:scale-110 transition-transform">distance</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-xs text-on-surface">Nearby Verified Pharmacies</h3>
            <p className="text-[10px] text-on-surface-variant font-medium truncate group-hover:text-primary transition-colors flex items-center gap-1">
              <span>📍 {appLocation || 'Indiranagar, Bangalore 560038'}</span>
              <span className="material-symbols-outlined text-[13px] opacity-70">edit</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRequestLocation}
          disabled={isLocating}
          className="flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-all shrink-0 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-sm ${isLocating ? 'animate-spin' : ''}`}>
            {isLocating ? 'progress_activity' : 'my_location'}
          </span>
          <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
        </button>
      </div>

      {/* Configurable Radius Selector (1 km, 3 km, 5 km, 10 km) */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-outline-variant/10">
        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          Search Radius:
        </span>
        <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded-lg border border-outline-variant/15">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRadius(r)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                selectedRadius === r
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {r} km
            </button>
          ))}
        </div>
      </div>

      {/* Location Error Warning */}
      {locationError && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="material-symbols-outlined text-amber-600 text-sm shrink-0">info</span>
            <span className="text-[11px] truncate">{locationError}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="text-[10px] font-bold text-primary underline shrink-0"
          >
            Change Area
          </button>
        </div>
      )}

      {/* Map Display Frame */}
      <div className="relative w-full h-36 rounded-xl overflow-hidden border border-outline-variant/30 bg-slate-900 group">
        {/* OpenStreetMap Tile Background Frame */}
        <iframe
          title="Nearby Pharmacies Map"
          className="w-full h-full border-0 filter contrast-105 brightness-95"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${currentCoords.lng - 0.035}%2C${currentCoords.lat - 0.025}%2C${currentCoords.lng + 0.035}%2C${currentCoords.lat + 0.025}&layer=mapnik&marker=${currentCoords.lat}%2C${currentCoords.lng}`}
        />

        {/* Floating User Location Badge */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-surface/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-outline-variant/30 shadow-md text-[9px] font-bold text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>You are here</span>
        </div>

        {/* Pharmacy Count & Radius Floating Pill */}
        <div className="absolute top-2 right-2 z-10 bg-slate-900/90 text-white px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-bold shadow-md">
          {loading ? 'Searching...' : `${pharmacies.length} Stores within ${selectedRadius} km`}
        </div>
      </div>

      {/* Pharmacy Selection List */}
      <div className="flex flex-col gap-1.5 mt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Verified Partner Stores ({pharmacies.length})
          </span>
          <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
            Real GPS Haversine Distance
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-4 text-xs text-on-surface-variant gap-2">
            <span className="material-symbols-outlined animate-spin text-primary text-sm">progress_activity</span>
            Finding nearest verified pharmacies within {selectedRadius} km...
          </div>
        ) : pharmacies.length === 0 ? (
          <div className="p-4 text-center text-xs text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/15 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant/60">storefront</span>
            <div>
              <p className="font-bold text-on-surface">No pharmacies found within {selectedRadius} km</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Expand your search radius or choose another delivery locality.
              </p>
            </div>
            {selectedRadius < 10 && (
              <button
                type="button"
                onClick={() => setSelectedRadius(10)}
                className="mt-1 px-3 py-1 bg-primary text-on-primary text-[11px] font-bold rounded-lg hover:opacity-90 transition-all flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">zoom_out_map</span>
                Expand Radius to 10 km
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
            {pharmacies.map((pharmacy) => {
              const isSelected = selectedPharmacy?._id === pharmacy._id || selectedPharmacy?.id === pharmacy._id;
              return (
                <div
                  key={pharmacy._id || pharmacy.id}
                  onClick={() => {
                    setSelectedPharmacy(pharmacy);
                    if (onSelectPharmacy) onSelectPharmacy(pharmacy);
                  }}
                  className={`flex items-start justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 border-primary shadow-xs'
                      : 'bg-surface-container-low border-outline-variant/15 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <img
                      src={pharmacy.profilePhoto || 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=100&auto=format&fit=crop&q=80'}
                      alt={pharmacy.businessName}
                      className="w-10 h-10 rounded-lg object-cover border border-outline-variant/20 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-xs text-on-surface truncate">{pharmacy.businessName}</h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            pharmacy.isOpen ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600'
                          }`}
                        >
                          {pharmacy.isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant truncate max-w-[180px] mt-0.5">{pharmacy.address}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-semibold text-secondary">
                        <span className="font-bold text-primary">📍 {pharmacy.distanceText || `${pharmacy.distanceKm} km`}</span>
                        <span>•</span>
                        <span>⏰ {pharmacy.openingTime || '08:00 AM'} - {pharmacy.closingTime || '11:00 PM'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
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
        <div className="mt-1.5 p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs font-bold text-primary">
            <span className="truncate max-w-[200px]">Availability: {selectedMedicine.name}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">
              {searchingAvailability ? 'CHECKING...' : (medicineAvailability?.inStock !== false ? 'IN STOCK NEARBY' : 'LIMITED STOCK')}
            </span>
          </div>
          <p className="text-[11px] text-on-surface-variant font-medium">
            {medicineAvailability?.summary || `Available at ${pharmacies.length} nearby verified pharmacies starting from ₹${selectedMedicine.price}.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default NearbyPharmacyMap;
