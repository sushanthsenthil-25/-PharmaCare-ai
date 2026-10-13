import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import api from '../services/api';

const POPULAR_LOCALITIES = [
  { name: 'Indiranagar', address: 'Indiranagar, Bangalore 560038', pin: '560038', lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala', address: 'Koramangala 5th Block, Bangalore 560034', pin: '560034', lat: 12.9352, lng: 77.6245 },
  { name: 'MG Road', address: 'MG Road, Bangalore 560001', pin: '560001', lat: 12.9756, lng: 77.6066 },
  { name: 'HSR Layout', address: 'HSR Layout Sector 1, Bangalore 560102', pin: '560102', lat: 12.9121, lng: 77.6446 },
  { name: 'Whitefield', address: 'Whitefield Main Road, Bangalore 560066', pin: '560066', lat: 12.9698, lng: 77.7499 },
  { name: 'Jayanagar', address: 'Jayanagar 4th Block, Bangalore 560041', pin: '560041', lat: 12.9308, lng: 77.5838 },
  { name: 'Electronic City', address: 'Electronic City Phase 1, Bangalore 560100', pin: '560100', lat: 12.8399, lng: 77.6770 },
  { name: 'Malleshwaram', address: 'Malleshwaram, Bangalore 560003', pin: '560003', lat: 13.0031, lng: 77.5643 },
];

export const LocationPickerModal = () => {
  const {
    location,
    userCoordinates,
    updateDeliveryLocation,
    isLocationModalOpen,
    setIsLocationModalOpen,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(location || 'Indiranagar, Bangalore 560038');
  const [selectedCoords, setSelectedCoords] = useState(userCoordinates || { lat: 12.9784, lng: 77.6408 });
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchDebounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isLocationModalOpen) {
      setSelectedAddress(location);
      setSelectedCoords(userCoordinates);
      setGpsError(null);
      setSearchQuery('');
      setSearchResults([]);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isLocationModalOpen, location, userCoordinates]);

  // Handle dynamic geocoding search as user types
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setGpsError(null);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!val.trim() || val.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.pharmacies.geocodeSearch(val.trim());
        if (res?.results) {
          setSearchResults(res.results);
        }
      } catch (err) {
        console.warn('[Location Search Error]:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  // Browser Geolocation Triggered STRICTLY upon explicit user click
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser. Please enter your address manually.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lng: longitude };

        try {
          // Resolve coordinates into readable delivery address
          const resolved = await api.pharmacies.reverseGeocode(latitude, longitude);
          const addressText = resolved?.address || `Coordinates (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

          setSelectedAddress(addressText);
          setSelectedCoords(coords);
          updateDeliveryLocation(addressText, coords);
          setIsLocationModalOpen(false);
        } catch (err) {
          console.warn('[Reverse Geocode Error]:', err);
          const fallbackText = `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          setSelectedAddress(fallbackText);
          setSelectedCoords(coords);
          updateDeliveryLocation(fallbackText, coords);
          setIsLocationModalOpen(false);
        } finally {
          setIsDetectingGps(false);
        }
      },
      (error) => {
        setIsDetectingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Location permission denied. Please search or enter your delivery address below.');
        } else if (error.code === error.TIMEOUT) {
          setGpsError('Location detection timed out. Please enter your address manually.');
        } else {
          setGpsError('Unable to retrieve location. Please type your area or PIN code.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSelectLocality = (item) => {
    const coords = { lat: item.lat, lng: item.lng };
    setSelectedAddress(item.address || item.name);
    setSelectedCoords(coords);
    updateDeliveryLocation(item.address || item.name, coords);
    setIsLocationModalOpen(false);
  };

  const handleConfirmCustom = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      if (selectedAddress) {
        updateDeliveryLocation(selectedAddress, selectedCoords);
        setIsLocationModalOpen(false);
      }
      return;
    }

    // If searching returned at least one match, pick the top result
    if (searchResults.length > 0) {
      handleSelectLocality(searchResults[0]);
    } else {
      // Custom manual text entry
      updateDeliveryLocation(searchQuery.trim(), selectedCoords);
      setIsLocationModalOpen(false);
    }
  };

  if (!isLocationModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center px-0 sm:px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl border border-outline-variant/20 shadow-2xl p-4 sm:p-5 flex flex-col gap-3.5 max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-250">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/15">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">location_on</span>
            <div>
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">Select Delivery Location</h3>
              <p className="text-[11px] text-on-surface-variant">Find medicines and verified pharmacies near you</p>
            </div>
          </div>
          <button
            onClick={() => setIsLocationModalOpen(false)}
            className="w-7 h-7 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Browser Geolocation Button */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isDetectingGps}
          className="w-full py-2.5 px-3 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/25 text-primary text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isDetectingGps ? (
            <>
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span>Detecting GPS Location...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">my_location</span>
              <span>Use my current location</span>
            </>
          )}
        </button>

        {/* Permission Denied / Error Banner */}
        {gpsError && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">location_disabled</span>
            <div className="flex-1 text-[11px] leading-relaxed">
              <span>{gpsError}</span>
            </div>
          </div>
        )}

        {/* Search Field */}
        <form onSubmit={handleConfirmCustom} className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Enter Area, Landmark, or PIN Code
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleQueryChange}
              placeholder="e.g. Indiranagar, 560038, Koramangala..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-3 text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </form>

        {/* Search Results or Popular Localities */}
        <div className="flex flex-col gap-1 overflow-y-auto max-h-[36vh] pr-1">
          {isSearching ? (
            <div className="flex items-center justify-center p-4 text-xs text-on-surface-variant gap-2">
              <span className="material-symbols-outlined animate-spin text-primary text-sm">progress_activity</span>
              <span>Searching locations...</span>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Matching Localities</span>
              {searchResults.map((item, idx) => (
                <button
                  key={`${item.name}-${idx}`}
                  type="button"
                  onClick={() => handleSelectLocality(item)}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl text-left bg-surface-container-low hover:bg-surface-container border border-outline-variant/15 transition-all group"
                >
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">pin_drop</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">{item.address}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Popular Delivery Areas
                </span>
                <span className="text-[10px] text-primary font-semibold">Bangalore Network</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {POPULAR_LOCALITIES.map((loc) => {
                  const isCurrent = location.toLowerCase().includes(loc.name.toLowerCase());
                  return (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => handleSelectLocality(loc)}
                      className={`p-2 rounded-xl text-left border text-xs transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                          : 'bg-surface-container-low border-outline-variant/15 text-on-surface hover:border-primary/40'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-bold text-[11px] truncate">{loc.name}</div>
                        <div className="text-[9px] text-on-surface-variant font-mono">{loc.pin}</div>
                      </div>
                      {isCurrent && (
                        <span className="material-symbols-outlined text-primary text-[14px]">check_circle</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Current Active Location Indicator & Confirm Button */}
        <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-bold text-on-surface-variant uppercase">Current Delivery To:</span>
            <p className="text-xs font-bold text-primary truncate">📍 {selectedAddress || location}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              updateDeliveryLocation(selectedAddress || location, selectedCoords || userCoordinates);
              setIsLocationModalOpen(false);
            }}
            className="py-2 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all shrink-0"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
