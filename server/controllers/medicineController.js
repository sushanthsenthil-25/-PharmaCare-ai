import Medicine from '../models/Medicine.js';
import { getExpiryStatus } from '../utils/expiry.js';

// @desc    Get all medicines with search, filter, pagination, sorting
// @route   GET /api/medicines
// @access  Public
export const getMedicines = async (req, res, next) => {
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
      limit = 20,
    } = req.query;

    const query = {};

    // Search filter across name, genericName, scientificName, composition, brand
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { genericName: regex },
        { scientificName: regex },
        { brand: regex },
        { composition: regex },
        { category: regex },
      ];
    }

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

    // Expiry status filter (e.g. valid vs expired)
    if (expiryStatus === 'EXPIRED') {
      query.expiryDate = { $lt: new Date() };
    } else if (expiryStatus === 'VALID') {
      query.expiryDate = { $gte: new Date() };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [total, medicines] = await Promise.all([
      Medicine.countDocuments(query),
      Medicine.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    // Format with expiry status and computed attributes
    const formatted = medicines.map((m) => {
      const status = getExpiryStatus(m.expiryDate);
      return {
        ...m,
        id: m._id.toString(),
        expiryStatus: status,
        isExpired: status === 'EXPIRED',
      };
    });

    res.json({
      success: true,
      count: formatted.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      medicines: formatted,
      items: formatted, // For compatibility
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search medicines dedicated endpoint
// @route   GET /api/medicines/search
// @access  Public
export const searchMedicines = async (req, res, next) => {
  try {
    const { q, query: searchQuery, limit = 10 } = req.query;
    const term = q || searchQuery || '';

    if (!term.trim()) {
      return res.json({ success: true, count: 0, medicines: [] });
    }

    const regex = new RegExp(term.trim(), 'i');
    const medicines = await Medicine.find({
      $or: [
        { name: regex },
        { genericName: regex },
        { scientificName: regex },
        { brand: regex },
        { composition: regex },
      ],
    })
      .limit(Number(limit))
      .lean();

    const formatted = medicines.map((m) => ({
      ...m,
      id: m._id.toString(),
      expiryStatus: getExpiryStatus(m.expiryDate),
    }));

    res.json({
      success: true,
      count: formatted.length,
      medicines: formatted,
      items: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get medicine by ID
// @route   GET /api/medicines/:id
// @access  Public
export const getMedicineById = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id).lean();

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found with ID ' + req.params.id,
      });
    }

    const expiryStatus = getExpiryStatus(medicine.expiryDate);

    res.json({
      success: true,
      medicine: {
        ...medicine,
        id: medicine._id.toString(),
        expiryStatus,
        isExpired: expiryStatus === 'EXPIRED',
      },
    });
  } catch (error) {
    next(error);
  }
};
