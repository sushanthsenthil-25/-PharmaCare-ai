import Pharmacy from '../models/Pharmacy.js';
import Medicine from '../models/Medicine.js';

// Haversine formula to compute distance in kilometers between two lat/lng points
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place (e.g. 1.2 km)
}

// Known verified city localities as immediate fallback if external geocoding service is unavailable
const KNOWN_LOCALITIES = [
  { name: 'Indiranagar', address: 'Indiranagar, Bangalore 560038', pin: '560038', lat: 12.9784, lng: 77.6408 },
  { name: 'Koramangala', address: 'Koramangala 5th Block, Bangalore 560034', pin: '560034', lat: 12.9352, lng: 77.6245 },
  { name: 'MG Road', address: 'MG Road, Bangalore 560001', pin: '560001', lat: 12.9756, lng: 77.6066 },
  { name: 'HSR Layout', address: 'HSR Layout Sector 1, Bangalore 560102', pin: '560102', lat: 12.9121, lng: 77.6446 },
  { name: 'Whitefield', address: 'Whitefield Main Road, Bangalore 560066', pin: '560066', lat: 12.9698, lng: 77.7499 },
  { name: 'Jayanagar', address: 'Jayanagar 4th Block, Bangalore 560041', pin: '560041', lat: 12.9308, lng: 77.5838 },
  { name: 'Electronic City', address: 'Electronic City Phase 1, Bangalore 560100', pin: '560100', lat: 12.8399, lng: 77.6770 },
  { name: 'Malleshwaram', address: 'Malleshwaram, Bangalore 560003', pin: '560003', lat: 13.0031, lng: 77.5643 },
  { name: 'Hebbal', address: 'Hebbal, Bangalore 560024', pin: '560024', lat: 13.0358, lng: 77.5970 },
  { name: 'BTM Layout', address: 'BTM Layout 2nd Stage, Bangalore 560076', pin: '560076', lat: 12.9166, lng: 77.6101 },
  { name: 'Marathahalli', address: 'Marathahalli Bridge, Bangalore 560037', pin: '560037', lat: 12.9591, lng: 77.6974 },
];

// @desc    Get nearby pharmacies based on user latitude & longitude with strict radius filtering
// @route   GET /api/pharmacies/nearby
// @access  Public
export const getNearbyPharmacies = async (req, res, next) => {
  try {
    const rawLat = parseFloat(req.query.lat);
    const rawLng = parseFloat(req.query.lng);
    const isValidLat = !isNaN(rawLat) && rawLat >= -90 && rawLat <= 90;
    const isValidLng = !isNaN(rawLng) && rawLng >= -180 && rawLng <= 180;

    // Default to Indiranagar center if coordinates not provided or invalid
    const lat = isValidLat ? rawLat : 12.9784;
    const lng = isValidLng ? rawLng : 77.6408;

    // Default search radius is strictly 5 km (configurable up to 25 km max, min 0.5 km)
    const rawRadius = parseFloat(req.query.radius);
    const radiusKm = !isNaN(rawRadius) && rawRadius > 0 ? Math.min(25, Math.max(0.5, rawRadius)) : 5;

    let pharmacies = [];
    try {
      pharmacies = await Pharmacy.find({ isActive: true });
    } catch (dbErr) {
      console.warn('[Pharmacy Controller] DB error fetching pharmacies:', dbErr.message);
    }

    // Default fallback pharmacies if database has none
    if (!pharmacies || pharmacies.length === 0) {
      pharmacies = [
        {
          _id: 'pharma_indiranagar_01',
          businessName: 'PharmaCare Central Pharmacy',
          address: 'Indiranagar, Bangalore 560038',
          phone: '+91 98765 43210',
          latitude: 12.9784,
          longitude: 77.6408,
          openingTime: '08:00 AM',
          closingTime: '11:00 PM',
          isOpen: true,
          profilePhoto: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=500&auto=format&fit=crop&q=80',
        },
        {
          _id: 'pharma_koramangala_02',
          businessName: 'PharmaCare Mega Store',
          address: 'Koramangala 5th Block, Bangalore 560034',
          phone: '+91 98765 00000',
          latitude: 12.9352,
          longitude: 77.6245,
          openingTime: '07:30 AM',
          closingTime: '11:30 PM',
          isOpen: true,
          profilePhoto: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=500&auto=format&fit=crop&q=80',
        },
        {
          _id: 'pharma_mgroad_03',
          businessName: 'City Healthcare Pharmacy',
          address: 'MG Road, Bangalore 560001',
          phone: '+91 98765 11111',
          latitude: 12.9756,
          longitude: 77.6066,
          openingTime: '09:00 AM',
          closingTime: '10:00 PM',
          isOpen: true,
          profilePhoto: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=500&auto=format&fit=crop&q=80',
        },
      ];
    }

    // Filter ONLY pharmacies with valid coordinates (do not invent coordinates or show distant ones)
    const validPharmacies = pharmacies.filter((p) => {
      const pLat = typeof p.latitude === 'number' ? p.latitude : parseFloat(p.latitude);
      const pLng = typeof p.longitude === 'number' ? p.longitude : parseFloat(p.longitude);
      return !isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0;
    });

    // Compute Haversine distance, strictly filter by radius, and sort nearest first
    const enrichedPharmacies = validPharmacies
      .map((p) => {
        const pLat = typeof p.latitude === 'number' ? p.latitude : parseFloat(p.latitude);
        const pLng = typeof p.longitude === 'number' ? p.longitude : parseFloat(p.longitude);
        const dist = calculateHaversineDistance(lat, lng, pLat, pLng);
        const obj = p.toObject ? p.toObject() : { ...p };
        return {
          ...obj,
          id: obj._id,
          distanceKm: Number(dist.toFixed(1)),
          distanceText: `${dist.toFixed(1)} km`,
        };
      })
      .filter((p) => p.distanceKm <= radiusKm) // STRICT RADIUS ENFORCEMENT
      .sort((a, b) => a.distanceKm - b.distanceKm); // NEAREST FIRST

    res.json({
      success: true,
      count: enrichedPharmacies.length,
      radiusKm,
      userLocation: { lat, lng },
      pharmacies: enrichedPharmacies,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Geocoding location search for area, address, or PIN code
// @route   GET /api/pharmacies/geocode/search
// @access  Public
export const searchLocations = async (req, res, next) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 2) {
      return res.json({ success: true, results: KNOWN_LOCALITIES });
    }

    const lowerQuery = query.toLowerCase();

    // 1. Search known local landmarks / PIN codes first for speed
    const matchedKnown = KNOWN_LOCALITIES.filter(
      (loc) =>
        loc.name.toLowerCase().includes(lowerQuery) ||
        loc.address.toLowerCase().includes(lowerQuery) ||
        loc.pin.includes(lowerQuery)
    );

    // 2. Query OpenStreetMap Nominatim for real Indian geocoding if needed
    let osmResults = [];
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5`;
      const osmResponse = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'PharmaCareAI-LocationResolver/1.0 (healthcare@pharmacare.ai)',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (osmResponse.ok) {
        const data = await osmResponse.json();
        if (Array.isArray(data)) {
          osmResults = data.map((item) => ({
            name: item.name || item.display_name.split(',')[0],
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            pin: (item.display_name.match(/\b\d{6}\b/) || [''])[0],
          }));
        }
      }
    } catch (_) {
      // Gracefully fall back to local database / known matches
    }

    // Combine and deduplicate
    const combined = [...matchedKnown];
    osmResults.forEach((osm) => {
      const isDup = combined.some(
        (c) => Math.abs(c.lat - osm.lat) < 0.005 && Math.abs(c.lng - osm.lng) < 0.005
      );
      if (!isDup) combined.push(osm);
    });

    res.json({
      success: true,
      query,
      results: combined.slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reverse geocode latitude and longitude to address and locality
// @route   GET /api/pharmacies/geocode/reverse
// @access  Public
export const reverseGeocode = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_COORDINATES', message: 'Valid latitude and longitude are required.' },
      });
    }

    // Check closest known locality
    let closestKnown = null;
    let minDist = Infinity;
    for (const loc of KNOWN_LOCALITIES) {
      const d = calculateHaversineDistance(lat, lng, loc.lat, loc.lng);
      if (d < minDist) {
        minDist = d;
        closestKnown = loc;
      }
    }

    // If extremely close to known locality (< 1.5 km), return it immediately
    if (minDist <= 1.5 && closestKnown) {
      return res.json({
        success: true,
        address: closestKnown.address,
        locality: closestKnown.name,
        coordinates: { lat, lng },
        distanceToCenterKm: Number(minDist.toFixed(1)),
      });
    }

    // Attempt Nominatim reverse geocode
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`;
      const osmResponse = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'PharmaCareAI-LocationResolver/1.0 (healthcare@pharmacare.ai)',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (osmResponse.ok) {
        const data = await osmResponse.json();
        if (data && data.display_name) {
          const locality =
            data.address?.suburb ||
            data.address?.neighbourhood ||
            data.address?.city_district ||
            data.address?.city ||
            closestKnown?.name ||
            'Bangalore';

          return res.json({
            success: true,
            address: data.display_name,
            locality,
            coordinates: { lat, lng },
          });
        }
      }
    } catch (_) {
      // Fallback to closest known
    }

    res.json({
      success: true,
      address: closestKnown?.address || `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      locality: closestKnown?.name || 'Local Area',
      coordinates: { lat, lng },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pharmacy by ID
// @route   GET /api/pharmacies/:id
// @access  Public
export const getPharmacyById = async (req, res, next) => {
  try {
    let pharmacy = null;
    try {
      pharmacy = await Pharmacy.findById(req.params.id);
    } catch (_) {}

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Pharmacy not found' },
      });
    }

    res.json({
      success: true,
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available medicines for a pharmacy
// @route   GET /api/pharmacies/:id/medicines
// @access  Public
export const getPharmacyMedicines = async (req, res, next) => {
  try {
    let medicines = [];
    try {
      medicines = await Medicine.find({
        $or: [{ pharmacyId: req.params.id }, { pharmacyId: { $exists: false } }],
        stock: { $gt: 0 },
        expiryDate: { $gt: new Date() },
      });
    } catch (_) {}

    res.json({
      success: true,
      count: medicines.length,
      medicines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pharmacy reviews (Real DB reviews)
// @route   GET /api/pharmacies/:id/reviews
// @access  Public
export const getPharmacyReviews = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ReviewModel = (await import('../models/Review.js')).default;
    const reviews = await ReviewModel.find({ pharmacyId: id }).sort({ createdAt: -1 }).lean();

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
      : null;

    res.json({
      success: true,
      totalReviews,
      averageRating,
      reviews: reviews.map((r) => ({
        id: r._id.toString(),
        userName: r.userName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add review for a pharmacy (Authenticated)
// @route   POST /api/pharmacies/:id/reviews
// @access  Private
export const addPharmacyReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Rating must be an integer between 1 and 5' },
      });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Review comment is required' },
      });
    }

    const ReviewModel = (await import('../models/Review.js')).default;

    // Mask name for privacy (e.g. "Rahul S.")
    const rawName = req.user.name || 'Verified Patient';
    const parts = rawName.split(' ');
    const maskedName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];

    const review = await ReviewModel.findOneAndUpdate(
      { pharmacyId: id, userId: req.user._id },
      {
        userName: maskedName,
        rating: numRating,
        comment: comment.trim(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Review recorded successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};

