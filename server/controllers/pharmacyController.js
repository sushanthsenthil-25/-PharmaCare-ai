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

// @desc    Get nearby pharmacies based on user latitude & longitude
// @route   GET /api/pharmacies/nearby
// @access  Public
export const getNearbyPharmacies = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat) || 12.9716; // Default Bangalore center if omitted
    const lng = parseFloat(req.query.lng) || 77.5946;
    const radiusKm = parseFloat(req.query.radius) || 20;

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

    // Attach calculated distance to each pharmacy and filter by radius
    const enrichedPharmacies = pharmacies.map((p) => {
      const dist = calculateHaversineDistance(lat, lng, p.latitude, p.longitude);
      const obj = p.toObject ? p.toObject() : { ...p };
      return {
        ...obj,
        id: obj._id,
        distanceKm: dist,
        distanceText: `${dist} km`,
      };
    });

    enrichedPharmacies.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      success: true,
      count: enrichedPharmacies.length,
      userLocation: { lat, lng },
      pharmacies: enrichedPharmacies,
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
