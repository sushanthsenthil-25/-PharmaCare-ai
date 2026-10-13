import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import { getExpiryStatus } from '../utils/expiry.js';
import {
  searchMedicinesRanked,
  formatMedicine,
  findCatalogueMedicineById,
  findLivePharmacyStockForMedicine,
} from '../services/medicineSearchService.js';

// @desc    Get all medicines with search, filter, pagination, sorting
// @route   GET /api/medicines
// @access  Public
export const getMedicines = async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      inStock,
      expiryStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = req.query;

    // If search parameter is provided, use the ranked search service for prioritized relevancy
    if (search && search.trim()) {
      const results = await searchMedicinesRanked(search, {
        limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 50)),
        maxPrice: maxPrice ? Number(maxPrice) : null,
        category: category && category !== 'All' ? category : null,
      });

      return res.json({
        success: true,
        count: results.length,
        total: results.length,
        page: 1,
        totalPages: 1,
        medicines: results,
        items: results,
      });
    }

    const query = {};

    // Category filter
    if (category && category !== 'All') {
      query.category = new RegExp(`^${category.trim()}$`, 'i');
    }

    // Brand filter
    if (brand) {
      query.brand = new RegExp(brand.trim(), 'i');
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Stock availability filter
    if (inStock === 'true' || inStock === true) {
      query.stock = { $gt: 0 };
    }

    // Expiry status filter
    if (expiryStatus === 'EXPIRED') {
      query.expiryDate = { $lt: new Date() };
    } else if (expiryStatus === 'VALID') {
      query.expiryDate = { $gte: new Date() };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [total, medicines] = await Promise.all([
      Medicine.countDocuments(query).maxTimeMS(3000),
      Medicine.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .maxTimeMS(3000),
    ]);

    const formatted = medicines.map((m) => formatMedicine(m));

    res.json({
      success: true,
      count: formatted.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      medicines: formatted,
      items: formatted,
    });
  } catch (error) {
    console.error(`[Medicine catalogue] ${error.name || 'Error'}: ${error.message}`);
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Medicine catalogue is temporarily unavailable. Please try again shortly.',
      },
    });
  }
};

// @desc    Search medicines dedicated endpoint
// @route   GET /api/medicines/search
// @access  Public
export const searchMedicines = async (req, res) => {
  try {
    const { q, query: searchQuery, limit = 20 } = req.query;
    const term = q || searchQuery || '';

    if (!term.trim()) {
      return res.json({ success: true, count: 0, medicines: [], items: [] });
    }

    const results = await searchMedicinesRanked(term, { limit: Number(limit) });

    res.json({
      success: true,
      count: results.length,
      medicines: results,
      items: results,
    });
  } catch (error) {
    console.error(`[Medicine search] ${error.name || 'Error'}: ${error.message}`);
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Medicine search is temporarily unavailable. Please try again shortly.',
      },
    });
  }
};

// @desc    Get medicine by ID
// @route   GET /api/medicines/:id
// @access  Public
export const getMedicineById = async (req, res) => {
  try {
    const rawId = req.params.id;
    if (!rawId || !String(rawId).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Medicine ID is required',
      });
    }

    const id = String(rawId).trim();

    // 1. If valid 24-character hex ObjectId, check store Medicine first
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      const medicine = await Medicine.findById(id).lean().maxTimeMS(3000);
      if (medicine) {
        return res.json({
          success: true,
          medicine: formatMedicine(medicine),
        });
      }
    }

    // 2. If it's a catalogue ID (e.g. catalogue_6714, catalogue_9761, 6714) or not in store Medicine, check catalogue
    const catalogueMed = await findCatalogueMedicineById(id);
    if (catalogueMed) {
      // Cross-reference live pharmacy stock
      const liveStock = await findLivePharmacyStockForMedicine(catalogueMed);
      return res.json({
        success: true,
        medicine: {
          ...catalogueMed,
          livePharmacyItem: liveStock
            ? {
                id: liveStock._id.toString(),
                name: liveStock.name,
                stock: liveStock.stock,
                price: liveStock.price,
                batchNumber: liveStock.batchNumber,
                expiryDate: liveStock.expiryDate,
                pharmacy: liveStock.pharmacyId?.businessName || 'Partner Pharmacy',
              }
            : null,
          hasLocalStock: Boolean(liveStock && liveStock.stock > 0),
          stock: liveStock ? liveStock.stock : 0,
          isLiveInventory: Boolean(liveStock && liveStock.stock > 0),
          availabilityStatus: liveStock && liveStock.stock > 0 ? 'IN_STOCK' : 'UNVERIFIED',
        },
      });
    }

    // 3. Not found
    return res.status(404).json({
      success: false,
      message: `Medicine not found with ID ${id}`,
    });
  } catch (error) {
    console.error('[getMedicineById] Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve medicine details.',
    });
  }
};

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// @desc    Get nearby pharmacy availability for a medicine
// @route   GET /api/medicines/:id/availability
// @access  Public
export const getMedicineAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const lat = parseFloat(req.query.lat) || 12.9716;
    const lng = parseFloat(req.query.lng) || 77.5946;

    let targetMed = null;
    let searchName = '';

    // Check if valid ObjectId for store Medicine
    if (mongoose.Types.ObjectId.isValid(id) && String(id).length === 24) {
      targetMed = await Medicine.findById(id).populate('pharmacyId');
      if (targetMed) {
        searchName = targetMed.genericName || targetMed.name;
      }
    }

    // If not found in store Medicine, check medicine_catalogue
    if (!targetMed) {
      const catDoc = await findCatalogueMedicineById(id);
      if (catDoc) {
        targetMed = catDoc;
        searchName = catDoc.genericName || catDoc.name;
      }
    }

    if (!targetMed) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found with ID ' + id,
      });
    }

    // Find all matching in-stock medicines with same name/genericName
    const now = new Date();
    const nameKeywords = searchName.replace(/[^\w\s]/g, '').trim().split(/\s+/).filter((w) => w.length > 2);
    const regexList = nameKeywords.map((k) => new RegExp(k, 'i'));

    let matchingMeds = [];
    if (regexList.length > 0) {
      matchingMeds = await Medicine.find({
        $or: [
          { name: { $in: regexList } },
          { genericName: { $in: regexList } },
        ],
        stock: { $gt: 0 },
        expiryDate: { $gt: now },
      }).populate('pharmacyId');
    }

    // If targetMed itself is a live store medicine with pharmacyId, include it
    if (targetMed.pharmacyId && !matchingMeds.some((m) => m._id.toString() === targetMed._id.toString())) {
      matchingMeds.unshift(targetMed);
    }

    const availablePharmacies = matchingMeds.map((m) => {
      const pharma = m.pharmacyId || {};
      const pharmaLat = pharma.latitude || 12.9784;
      const pharmaLng = pharma.longitude || 77.6408;
      const dist = calculateHaversineDistance(lat, lng, pharmaLat, pharmaLng);

      return {
        medicineId: m._id,
        pharmacyId: pharma._id || pharma.id || 'pharma_indiranagar_01',
        pharmacyName: pharma.businessName || 'Verified Local Pharmacy',
        address: pharma.address || 'Certified Pharmacy Address',
        phone: pharma.phone || '+91 98765 43210',
        latitude: pharmaLat,
        longitude: pharmaLng,
        price: m.price,
        originalPrice: m.originalPrice || Math.round(m.price * 1.25),
        stock: m.stock,
        status: m.stock > 0 ? 'In Stock' : 'Out of Stock',
        distanceKm: dist,
        distanceText: `${dist} km`,
        lastUpdated: m.updatedAt || new Date().toISOString(),
        pharmacy: {
          id: pharma._id || pharma.id,
          businessName: pharma.businessName || 'Verified Local Pharmacy',
          address: pharma.address || 'Certified Pharmacy Address',
          phone: pharma.phone || '+91 98765 43210',
          latitude: pharmaLat,
          longitude: pharmaLng,
          openingTime: pharma.openingTime || '08:00 AM',
          closingTime: pharma.closingTime || '11:00 PM',
          isOpen: pharma.isOpen !== undefined ? pharma.isOpen : true,
          rating: pharma.rating || 4.8,
        },
      };
    });

    availablePharmacies.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({
      success: true,
      medicine: targetMed,
      availableCount: availablePharmacies.length,
      availabilityCount: availablePharmacies.length,
      pharmacies: availablePharmacies,
      availablePharmacies,
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Database query failed or database is unavailable.',
      },
    });
  }
};
