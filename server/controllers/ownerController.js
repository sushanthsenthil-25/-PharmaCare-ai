import Medicine from '../models/Medicine.js';
import Order from '../models/Order.js';
import Pharmacy from '../models/Pharmacy.js';
import User from '../models/User.js';

// Helper to get or create owner's pharmacy record
async function getOrCreatePharmacyForUser(userId) {
  let pharmacy = await Pharmacy.findOne({ ownerId: userId });
  if (!pharmacy) {
    const user = await User.findById(userId);
    pharmacy = await Pharmacy.create({
      businessName: user?.businessName || 'PharmaCare Central Pharmacy',
      ownerId: userId,
      ownerName: user?.name || 'Pharmacy Owner',
      email: user?.email || 'owner@pharmacare.ai',
      phone: user?.phone || '+91 98765 43210',
      address: user?.address || 'Indiranagar, Bangalore 560038',
      latitude: 12.9784,
      longitude: 77.6408,
      openingTime: '08:00 AM',
      closingTime: '11:00 PM',
      isOpen: true,
    });
  }
  return pharmacy;
}

// @desc    Get owner dashboard overview statistics and metrics from real DB data
// @route   GET /api/owner/dashboard
// @access  Private (Owner/Pharmacist)
export const getOwnerDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const pharmacy = await getOrCreatePharmacyForUser(userId);

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Run parallel MongoDB aggregation & counts
    const [
      totalMedicines,
      availableMedicines,
      lowStockMedicines,
      outOfStockMedicines,
      expiredMedicines,
      expiringSoonMedicines,
      totalOrders,
      pendingOrders,
      completedOrders,
      todaysOrders,
      recentOrders,
    ] = await Promise.all([
      Medicine.countDocuments({ $or: [{ pharmacyId: pharmacy._id }, { pharmacyId: { $exists: false } }] }),
      Medicine.countDocuments({ stock: { $gt: 0 }, expiryDate: { $gt: now } }),
      Medicine.countDocuments({ stock: { $gt: 0, $lte: 10 }, expiryDate: { $gt: now } }),
      Medicine.countDocuments({ stock: 0 }),
      Medicine.countDocuments({ expiryDate: { $lte: now } }),
      Medicine.countDocuments({ expiryDate: { $gt: now, $lte: thirtyDaysFromNow } }),
      Order.countDocuments({}),
      Order.countDocuments({ status: { $in: ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY'] } }),
      Order.countDocuments({ status: 'DELIVERED' }),
      Order.countDocuments({ createdAt: { $gte: startOfToday } }),
      Order.find({}).sort({ createdAt: -1 }).limit(5),
    ]);

    res.json({
      success: true,
      pharmacy,
      stats: {
        totalMedicines,
        availableMedicines,
        lowStockMedicines,
        outOfStockMedicines,
        expiredMedicines,
        expiringSoonMedicines,
        totalOrders,
        pendingOrders,
        completedOrders,
        todaysOrders,
      },
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get owner's medicine inventory list
// @route   GET /api/owner/medicines
// @access  Private (Owner/Pharmacist)
export const getOwnerMedicines = async (req, res, next) => {
  try {
    const medicines = await Medicine.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: medicines.length,
      medicines,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a new medicine record to MongoDB with strict validation
// @route   POST /api/owner/medicines
// @access  Private (Owner/Pharmacist)
export const createMedicine = async (req, res, next) => {
  try {
    const {
      name,
      genericName,
      activeIngredient,
      scientificName,
      brand,
      manufacturer,
      category,
      strength,
      form,
      price,
      originalPrice,
      discount,
      stock,
      batchNumber,
      manufacturingDate,
      expiryDate,
      description,
      rxRequired,
      image,
      uses,
      precautions,
      storageInstructions,
    } = req.body;

    // Backend Validation Rules:
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Medicine name is required.' } });
    }
    if (!genericName || !genericName.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Generic name is required.' } });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Category is required.' } });
    }
    if (!batchNumber || !batchNumber.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Batch number is required.' } });
    }
    if (price === undefined || price < 0 || isNaN(price)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid non-negative price is required.' } });
    }
    if (stock === undefined || stock < 0 || isNaN(stock)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid non-negative stock quantity is required.' } });
    }
    if (!expiryDate || isNaN(new Date(expiryDate).getTime())) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid expiry date is required.' } });
    }

    const pharmacy = await getOrCreatePharmacyForUser(req.user._id);

    const mfgDate = manufacturingDate ? new Date(manufacturingDate) : new Date();
    const expDate = new Date(expiryDate);

    if (expDate <= mfgDate) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Expiry date must be after manufacturing date.' } });
    }

    const status = stock === 0 ? 'Out of Stock' : stock <= 10 ? 'Low Stock' : 'In Stock';

    const newMedicine = await Medicine.create({
      name: name.trim(),
      genericName: genericName.trim(),
      activeIngredient: (activeIngredient || genericName).trim(),
      scientificName: (scientificName || '').trim(),
      brand: (brand || pharmacy.businessName).trim(),
      manufacturer: (manufacturer || 'PharmaCare Laboratories').trim(),
      category: category.trim(),
      strength: (strength || 'Standard').trim(),
      form: (form || 'Tablet').trim(),
      price: Number(price),
      originalPrice: Number(originalPrice || price),
      discount: discount || '0% OFF',
      stock: Number(stock),
      quantity: Number(stock),
      batchNumber: batchNumber.trim(),
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      description: (description || '').trim(),
      rxRequired: Boolean(rxRequired),
      image: image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
      images: [image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'],
      status,
      uses: Array.isArray(uses) ? uses : uses ? uses.split(',').map((u) => u.trim()) : [],
      precautions: Array.isArray(precautions) ? precautions : precautions ? precautions.split(',').map((p) => p.trim()) : [],
      storageInstructions: storageInstructions || 'Store in a cool dry place.',
      pharmacyId: pharmacy._id,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Medicine added to inventory successfully',
      medicine: newMedicine,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update existing medicine record
// @route   PUT /api/owner/medicines/:id
// @access  Private (Owner/Pharmacist)
export const updateMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Medicine not found' } });
    }

    const {
      name,
      genericName,
      category,
      strength,
      form,
      price,
      originalPrice,
      discount,
      stock,
      batchNumber,
      expiryDate,
      description,
      rxRequired,
      image,
    } = req.body;

    if (price !== undefined && (price < 0 || isNaN(price))) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative.' } });
    }
    if (stock !== undefined && (stock < 0 || isNaN(stock))) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Stock cannot be negative.' } });
    }

    if (name) medicine.name = name.trim();
    if (genericName) medicine.genericName = genericName.trim();
    if (category) medicine.category = category.trim();
    if (strength) medicine.strength = strength.trim();
    if (form) medicine.form = form.trim();
    if (price !== undefined) medicine.price = Number(price);
    if (originalPrice !== undefined) medicine.originalPrice = Number(originalPrice);
    if (discount) medicine.discount = discount;
    if (stock !== undefined) {
      medicine.stock = Number(stock);
      medicine.quantity = Number(stock);
      medicine.status = Number(stock) === 0 ? 'Out of Stock' : Number(stock) <= 10 ? 'Low Stock' : 'In Stock';
    }
    if (batchNumber) medicine.batchNumber = batchNumber.trim();
    if (expiryDate) medicine.expiryDate = new Date(expiryDate);
    if (description !== undefined) medicine.description = description.trim();
    if (rxRequired !== undefined) medicine.rxRequired = Boolean(rxRequired);
    if (image) {
      medicine.image = image;
      medicine.images = [image];
    }

    await medicine.save();

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      medicine,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update stock quantity directly ([ - ] Qty [ + ])
// @route   PATCH /api/owner/medicines/:id/stock
// @access  Private (Owner/Pharmacist)
export const updateStock = async (req, res, next) => {
  try {
    const { stock, delta } = req.body;
    const medicine = await Medicine.findById(req.params.id);

    if (!medicine) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Medicine not found' } });
    }

    let newStock = medicine.stock;
    if (stock !== undefined) {
      newStock = Number(stock);
    } else if (delta !== undefined) {
      newStock = medicine.stock + Number(delta);
    }

    if (newStock < 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Stock cannot be less than 0.' } });
    }

    medicine.stock = newStock;
    medicine.quantity = newStock;
    medicine.status = newStock === 0 ? 'Out of Stock' : newStock <= 10 ? 'Low Stock' : 'In Stock';
    await medicine.save();

    res.json({
      success: true,
      message: 'Stock updated successfully',
      stock: medicine.stock,
      medicine,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Deactivate medicine record
// @route   DELETE /api/owner/medicines/:id
// @access  Private (Owner/Pharmacist)
export const deleteMedicine = async (req, res, next) => {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Medicine not found' } });
    }

    await Medicine.deleteOne({ _id: req.params.id });

    res.json({
      success: true,
      message: 'Medicine removed from inventory',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get owner's pharmacy orders
// @route   GET /api/owner/orders
// @access  Private (Owner/Pharmacist)
export const getOwnerOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update order status (PLACED -> CONFIRMED -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED)
// @route   PATCH /api/owner/orders/:id/status
// @access  Private (Owner/Pharmacist)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNote } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const validStatuses = ['PLACED', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Invalid order status' } });
    }

    order.status = status;

    // Append to live tracking events
    if (trackingNote || status) {
      order.trackingEvents = order.trackingEvents || [];
      order.trackingEvents.push({
        status,
        timestamp: new Date().toISOString(),
        message: trackingNote || `Order status updated to ${status.replace(/_/g, ' ')}`,
      });
    }

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update owner's pharmacy profile & map location
// @route   PATCH /api/owner/pharmacy
// @access  Private (Owner/Pharmacist)
export const updatePharmacyProfile = async (req, res, next) => {
  try {
    const pharmacy = await getOrCreatePharmacyForUser(req.user._id);

    const { businessName, phone, address, latitude, longitude, openingTime, closingTime, isOpen } = req.body;

    if (businessName) pharmacy.businessName = businessName.trim();
    if (phone) pharmacy.phone = phone.trim();
    if (address) pharmacy.address = address.trim();
    if (latitude !== undefined) pharmacy.latitude = Number(latitude);
    if (longitude !== undefined) pharmacy.longitude = Number(longitude);
    if (openingTime) pharmacy.openingTime = openingTime;
    if (closingTime) pharmacy.closingTime = closingTime;
    if (isOpen !== undefined) pharmacy.isOpen = Boolean(isOpen);

    await pharmacy.save();

    // Sync business name on User record
    if (businessName) {
      await User.findByIdAndUpdate(req.user._id, { businessName: businessName.trim() });
    }

    res.json({
      success: true,
      message: 'Pharmacy details updated successfully',
      pharmacy,
    });
  } catch (error) {
    next(error);
  }
};
