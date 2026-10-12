import express from 'express';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

const router = express.Router();

function getCatalogueCollection() {
  const db = mongoose.connection.useDb('pharmacare_ai');
  return db.collection('medicine_catalogue');
}

function detectDosageForm(name, packLabel) {
  const text = `${name || ''} ${packLabel || ''}`.toLowerCase();
  if (text.includes('tablet') || text.includes('tab') || text.includes('strip')) {
    return 'Tablet';
  } else if (text.includes('capsule') || text.includes('cap')) {
    return 'Capsule';
  } else if (text.includes('syrup') || text.includes('suspension') || text.includes('liquid') || text.includes('solution') || text.includes('drop')) {
    return 'Syrup/Liquid';
  } else if (text.includes('injection') || text.includes('vial') || text.includes('ampoule') || text.includes('inj')) {
    return 'Injection';
  } else if (text.includes('gel') || text.includes('cream') || text.includes('ointment') || text.includes('lotion') || text.includes('topical')) {
    return 'Topical/Ointment';
  } else if (text.includes('inhaler') || text.includes('respules') || text.includes('spray')) {
    return 'Inhaler/Respiratory';
  } else if (text.includes('sachet') || text.includes('powder')) {
    return 'Powder/Sachet';
  } else if (text.includes('eye drop') || text.includes('ear drop') || text.includes('nasal drop')) {
    return 'Drops';
  }
  return 'Clinical Formulation';
}

function serializePrice(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val.toString) {
    const num = parseFloat(val.toString());
    return isNaN(num) ? null : num;
  }
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
}

function formatCatalogueItem(doc) {
  const comp = Array.isArray(doc.composition) ? doc.composition : (doc.composition ? [String(doc.composition)] : []);
  const dosageForm = detectDosageForm(doc.name, doc.pack_size_label);

  return {
    id: String(doc.source_id || doc._id),
    rawMongoId: String(doc._id),
    name: doc.name || '',
    manufacturer: doc.manufacturer_name || null,
    medicineType: doc.medicine_type || 'allopathy',
    packSize: doc.pack_size_label || null,
    dosageForm: dosageForm,
    composition: comp,
    priceINR: serializePrice(doc.price_inr),
    isDiscontinued: Boolean(doc.is_discontinued),
    source: doc.source || 'junioralive/Indian-Medicine-Dataset',
    sourceVerified: (doc.data_quality || {}).source_verified || false,
    priceMissing: (doc.data_quality || {}).price_missing || (doc.price_inr === null || doc.price_inr === undefined),
    isLiveInventory: false,
    catalogueType: 'National Medicine Database (11,621 Formulations)',
    imagePlaceholder: true,
    imagePlaceholderLabel: `Authentic Formulation (${dosageForm})`,
  };
}

const PROJECTION = {
  _id: 1,
  source_id: 1,
  name: 1,
  manufacturer_name: 1,
  medicine_type: 1,
  pack_size_label: 1,
  composition: 1,
  price_inr: 1,
  is_discontinued: 1,
  source: 1,
  data_quality: 1,
};

// @route   GET /api/v1/medicine-catalogue/search
// @desc    Search the 11,621 medicine catalogue
router.get('/search', async (req, res) => {
  try {
    const { q = '', page = 1, page_size = 20, sort_by = 'name' } = req.query;
    const queryText = String(q).trim();

    if (queryText.length < 2) {
      return res.status(422).json({
        detail: 'Enter at least 2 characters to search.',
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(page_size, 10) || 20));

    const col = getCatalogueCollection();
    const escaped = queryText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const searchFilter = {
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { name_normalized: { $regex: escaped, $options: 'i' } },
        { manufacturer_name: { $regex: escaped, $options: 'i' } },
        { composition: { $regex: escaped, $options: 'i' } },
      ],
    };

    const total = await col.countDocuments(searchFilter);

    const sortOptions = {};
    if (sort_by === 'price_asc') {
      sortOptions.price_inr = 1;
    } else if (sort_by === 'price_desc') {
      sortOptions.price_inr = -1;
    } else {
      sortOptions.name = 1;
    }

    const docs = await col
      .find(searchFilter, { projection: PROJECTION })
      .sort(sortOptions)
      .skip((pageNum - 1) * pageSizeNum)
      .limit(pageSizeNum)
      .toArray();

    const items = docs.map(formatCatalogueItem);

    return res.json({
      query: queryText,
      page: pageNum,
      pageSize: pageSizeNum,
      total,
      totalPages: Math.ceil(total / pageSizeNum) || 1,
      results: items,
    });
  } catch (err) {
    console.error('[MedicineCatalogue Search Error]:', err);
    return res.status(503).json({
      detail: 'Medicine catalogue is temporarily unavailable.',
    });
  }
});

// @route   GET /api/v1/medicine-catalogue/categories
// @desc    Get facets & summary for the 11,621 catalogue
router.get('/categories', async (req, res) => {
  try {
    const col = getCatalogueCollection();
    const total = await col.countDocuments({});

    const topMfgs = await col
      .aggregate([
        { $group: { _id: '$manufacturer_name', count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray();

    const manufacturers = topMfgs.map((m) => ({ name: m._id, count: m.count }));

    const dosageForms = [
      { id: 'All', label: 'All Formulations', count: total },
      { id: 'Tablet', label: 'Tablets & Strips', count: 8685 },
      { id: 'Syrup/Liquid', label: 'Syrups & Suspensions', count: 1592 },
      { id: 'Injection', label: 'Injections & Vials', count: 709 },
      { id: 'Topical/Ointment', label: 'Ointments & Creams', count: 444 },
      { id: 'Capsule', label: 'Capsules', count: 37 },
      { id: 'Inhaler/Respiratory', label: 'Inhalers & Sprays', count: 50 },
      { id: 'Powder/Sachet', label: 'Powders & Sachets', count: 10 },
    ];

    return res.json({
      totalMedicines: total,
      datasetName: 'Indian Medicine Dataset (junioralive)',
      dosageForms,
      topManufacturers: manufacturers,
    });
  } catch (err) {
    console.error('[MedicineCatalogue Categories Error]:', err);
    return res.status(503).json({
      detail: 'Catalogue facets temporarily unavailable.',
    });
  }
});

// @route   GET /api/v1/medicine-catalogue
// @desc    Browse & paginate the full 11,621 catalogue
router.get('/', async (req, res) => {
  try {
    const { page = 1, page_size = 20, dosage_form, manufacturer, sort_by = 'name' } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(50, Math.max(1, parseInt(page_size, 10) || 20));

    const col = getCatalogueCollection();
    const filterQuery = {};

    if (manufacturer) {
      const escaped = String(manufacturer).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filterQuery.manufacturer_name = { $regex: escaped, $options: 'i' };
    }

    if (dosage_form && dosage_form !== 'All') {
      const formRegexMap = {
        Tablet: '(tablet|tab|strip)',
        Capsule: '(capsule|cap)',
        'Syrup/Liquid': '(syrup|suspension|liquid|solution|drop)',
        Injection: '(injection|vial|ampoule|inj)',
        'Topical/Ointment': '(gel|cream|ointment|lotion|topical)',
        'Inhaler/Respiratory': '(inhaler|respules|spray)',
        'Powder/Sachet': '(sachet|powder)',
      };
      if (formRegexMap[dosage_form]) {
        filterQuery.$or = [
          { name: { $regex: formRegexMap[dosage_form], $options: 'i' } },
          { pack_size_label: { $regex: formRegexMap[dosage_form], $options: 'i' } },
        ];
      }
    }

    const total = await col.countDocuments(filterQuery);

    const sortOptions = {};
    if (sort_by === 'price_asc') {
      sortOptions.price_inr = 1;
    } else if (sort_by === 'price_desc') {
      sortOptions.price_inr = -1;
    } else {
      sortOptions.name = 1;
    }

    const docs = await col
      .find(filterQuery, { projection: PROJECTION })
      .sort(sortOptions)
      .skip((pageNum - 1) * pageSizeNum)
      .limit(pageSizeNum)
      .toArray();

    const items = docs.map(formatCatalogueItem);

    return res.json({
      page: pageNum,
      pageSize: pageSizeNum,
      total,
      totalPages: Math.ceil(total / pageSizeNum) || 1,
      results: items,
    });
  } catch (err) {
    console.error('[MedicineCatalogue List Error]:', err);
    return res.status(503).json({
      detail: 'Medicine catalogue is temporarily unavailable.',
    });
  }
});

// @route   GET /api/v1/medicine-catalogue/:id
// @desc    Get single catalogue medicine monograph
router.get('/:id', async (req, res) => {
  try {
    const itemId = String(req.params.id).trim();
    const col = getCatalogueCollection();

    let query = { source_id: itemId };
    if (ObjectId.isValid(itemId)) {
      query = { $or: [{ source_id: itemId }, { _id: new ObjectId(itemId) }] };
    }

    const doc = await col.findOne(query);
    if (!doc) {
      return res.status(404).json({
        detail: 'Catalogue medicine record not found.',
      });
    }

    const item = formatCatalogueItem(doc);

    // Cross-reference with live medicines for real pharmacy stock check
    try {
      const liveCol = mongoose.connection.useDb('pharmacare').collection('medicines');
      const escaped = doc.name.slice(0, 10).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const liveMatch = await liveCol.findOne({
        $or: [
          { name: { $regex: escaped, $options: 'i' } },
          { genericName: { $regex: escaped, $options: 'i' } },
        ],
      });
      if (liveMatch) {
        item.isLiveInventory = true;
        item.livePharmacyItem = {
          id: String(liveMatch._id),
          name: liveMatch.name,
          stock: liveMatch.stock || 0,
          price: liveMatch.price,
          batchNumber: liveMatch.batchNumber,
          expiryDate: liveMatch.expiryDate,
        };
      }
    } catch (_) {}

    return res.json(item);
  } catch (err) {
    console.error('[MedicineCatalogue Item Error]:', err);
    return res.status(503).json({
      detail: 'Error retrieving medicine details.',
    });
  }
});

export default router;
