import HealthProduct from '../models/HealthProduct.js';

// @desc    Get all health products
// @route   GET /api/health-products
// @access  Public
export const getHealthProducts = async (req, res, next) => {
  try {
    const { search, category, brand, page = 1, limit = 50 } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { brand: regex },
        { description: regex },
        { category: regex },
      ];
    }

    if (category && category !== 'All') {
      query.category = new RegExp(category.trim(), 'i');
    }

    if (brand) {
      query.brand = new RegExp(brand.trim(), 'i');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [total, products] = await Promise.all([
      HealthProduct.countDocuments(query),
      HealthProduct.find(query).skip(skip).limit(limitNum).lean(),
    ]);

    const formatted = products.map((p) => ({
      ...p,
      id: p._id.toString(),
    }));

    res.json({
      success: true,
      count: formatted.length,
      total,
      products: formatted,
      items: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get health product by ID
// @route   GET /api/health-products/:id
// @access  Public
export const getHealthProductById = async (req, res, next) => {
  try {
    const product = await HealthProduct.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Health product not found with ID ' + req.params.id,
      });
    }

    res.json({
      success: true,
      product: {
        ...product,
        id: product._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
