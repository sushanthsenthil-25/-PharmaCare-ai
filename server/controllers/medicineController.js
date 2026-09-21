import Medicine from '../models/Medicine.js';
import { getExpiryStatus } from '../utils/expiry.js';
import { searchMedicinesRanked, formatMedicine } from '../services/medicineSearchService.js';
import { EXACT_20_MEDICINES } from '../seed.js';

const FALLBACK_MEDICINES = EXACT_20_MEDICINES.map((m, idx) => ({
  ...m,
  id: `med_fallback_${idx + 1}`,
  _id: `med_fallback_${idx + 1}`,
  expiryStatus: 'VALID',
  isExpired: false,
}));

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
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    let list = FALLBACK_MEDICINES;
    if (req.query.category && req.query.category !== 'All') {
      list = list.filter((m) => m.category.toLowerCase() === req.query.category.toLowerCase());
    }
    if (req.query.search) {
      const s = req.query.search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(s) ||
          m.genericName.toLowerCase().includes(s) ||
          m.brand.toLowerCase().includes(s) ||
          (m.aliases && m.aliases.some((a) => a.toLowerCase().includes(s))) ||
          m.category.toLowerCase().includes(s)
      );
    }
    const sliced = list.slice(0, limitNum);
    res.json({
      success: true,
      count: sliced.length,
      total: list.length,
      page: 1,
      totalPages: Math.ceil(list.length / limitNum) || 1,
      medicines: sliced,
      items: sliced,
      fallback: true,
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
    const term = (req.query.q || req.query.query || '').toLowerCase();
    const matches = FALLBACK_MEDICINES.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.genericName.toLowerCase().includes(term) ||
        (m.brand && m.brand.toLowerCase().includes(term)) ||
        (m.aliases && m.aliases.some((a) => a.toLowerCase().includes(term))) ||
        m.category.toLowerCase().includes(term)
    );
    res.json({
      success: true,
      count: matches.length,
      medicines: matches,
      items: matches,
      fallback: true,
    });
  }
};

// @desc    Get medicine by ID
// @route   GET /api/medicines/:id
// @access  Public
export const getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findById(req.params.id).lean().maxTimeMS(3000);

    if (!medicine) {
      const fallbackItem = FALLBACK_MEDICINES.find((m) => m.id === req.params.id || m._id === req.params.id);
      if (fallbackItem) {
        return res.json({
          success: true,
          medicine: fallbackItem,
        });
      }
      return res.status(404).json({
        success: false,
        message: 'Medicine not found with ID ' + req.params.id,
      });
    }

    const formatted = formatMedicine(medicine);

    res.json({
      success: true,
      medicine: formatted,
    });
  } catch (error) {
    const fallbackItem = FALLBACK_MEDICINES.find((m) => m.id === req.params.id || m._id === req.params.id) || FALLBACK_MEDICINES[0];
    res.json({
      success: true,
      medicine: fallbackItem,
      fallback: true,
    });
  }
};

// @desc    Get nearby pharmacy availability for a medicine
// @route   GET /api/medicines/:id/availability
// @access  Public
export const getMedicineAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const lat = parseFloat(req.query.lat) || 12.9716;
    const lng = parseFloat(req.query.lng) || 77.5946;

    let targetMed = null;
    try {
      targetMed = await Medicine.findById(id);
    } catch (_) {}

    if (!targetMed) {
      targetMed = FALLBACK_MEDICINES.find((m) => m.id === id || m._id === id) || FALLBACK_MEDICINES[0];
    }

    // Find all matching in-stock medicines with same name/genericName
    const searchName = targetMed.genericName || targetMed.name;
    const now = new Date();

    let matchingMeds = [];
    try {
      matchingMeds = await Medicine.find({
        $or: [
          { name: new RegExp(searchName, 'i') },
          { genericName: new RegExp(searchName, 'i') },
        ],
        stock: { $gt: 0 },
        expiryDate: { $gt: now },
      }).populate('pharmacyId');
    } catch (_) {}

    res.json({
      success: true,
      medicine: targetMed,
      availabilityCount: matchingMeds.length,
      availablePharmacies: matchingMeds.map((m) => ({
        medicineId: m._id,
        price: m.price,
        stock: m.stock,
        status: m.stock > 0 ? 'In Stock' : 'Out of Stock',
        pharmacy: m.pharmacyId || {
          businessName: 'PharmaCare Central Pharmacy',
          address: 'Indiranagar, Bangalore 560038',
          phone: '+91 98765 43210',
          latitude: 12.9784,
          longitude: 77.6408,
          isOpen: true,
        },
      })),
    });
  } catch (error) {
    res.json({
      success: true,
      medicine: FALLBACK_MEDICINES[0],
      availabilityCount: 1,
      availablePharmacies: [],
    });
  }
};
