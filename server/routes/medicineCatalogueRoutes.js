import express from 'express';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

const router = express.Router();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.resolve(__dirname, '../../data/indian_medicine_data.csv');

let _csvMemoryCache = null;
let _csvCacheTimestamp = null;

function loadCsvFallback() {
  if (_csvMemoryCache) {
    return _csvMemoryCache;
  }

  try {
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.warn('[MedicineCatalogue] CSV fallback file not found at:', CSV_FILE_PATH);
      return [];
    }

    const content = fs.readFileSync(CSV_FILE_PATH, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim());
    const records = [];

    // Parse CSV line by line handling quoted commas
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex parsing for CSV with quotes
      const values = [];
      let inQuotes = false;
      let currentVal = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      const row = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const source_id = String(row.id || i).trim();
      const name = String(row.name || '').trim();
      if (!name) continue;

      const comp = [row.short_composition1, row.short_composition2].filter(Boolean).map(c => c.trim());
      const rawPrice = parseFloat(String(row['price(₹)'] || '').replace(/,/g, ''));
      const price_inr = !isNaN(rawPrice) && rawPrice >= 0 ? rawPrice : null;

      records.push({
        source_id,
        _id: `csv_${source_id}`,
        name,
        name_normalized: name.toLowerCase(),
        manufacturer_name: row.manufacturer_name || null,
        medicine_type: row.type || 'allopathy',
        pack_size_label: row.pack_size_label || null,
        composition: comp,
        price_inr,
        is_discontinued: String(row.Is_discontinued || '').toUpperCase() === 'TRUE',
        source: 'in-memory-csv-fallback',
        data_quality: {
          source_verified: true,
          price_missing: price_inr === null,
        },
      });
    }

    _csvMemoryCache = records;
    _csvCacheTimestamp = new Date().toISOString();
    console.log(`[MedicineCatalogue] Parsed & cached ${_csvMemoryCache.length} records from local CSV file.`);
    return _csvMemoryCache;
  } catch (err) {
    console.error('[MedicineCatalogue] Failed to load CSV fallback:', err.message);
    return [];
  }
}

function getCatalogueCollection() {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }
  // Try pharmacare first, then pharmacare_ai
  const db = mongoose.connection.db || mongoose.connection.useDb('pharmacare');
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
  const dosageForm = doc.dosage_form || detectDosageForm(doc.name, doc.pack_size_label);

  return {
    id: String(doc.source_id || doc._id),
    rawMongoId: String(doc._id),
    name: doc.name || '',
    manufacturer: doc.manufacturer_name || null,
    medicineType: doc.medicine_type || 'allopathy',
    packSize: doc.pack_size_label || null,
    dosageForm: dosageForm,
    dosage_form: dosageForm,
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
  dosage_form: 1,
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

    // 1. Primary path: Query MongoDB if connected
    if (col) {
      try {
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
          source: 'mongodb',
        });
      } catch (dbErr) {
        console.warn('[MedicineCatalogue] Database search query failed, using CSV fallback:', dbErr.message);
      }
    }

    // 2. Resilient CSV-backed fallback (reports source and freshness clearly)
    const records = loadCsvFallback();
    const qLower = queryText.toLowerCase();
    const matched = records.filter(r => {
      return (
        r.name_normalized.includes(qLower) ||
        (r.manufacturer_name && r.manufacturer_name.toLowerCase().includes(qLower)) ||
        r.composition.some(c => c.toLowerCase().includes(qLower))
      );
    });

    if (sort_by === 'price_asc') {
      matched.sort((a, b) => (a.price_inr || 999999) - (b.price_inr || 999999));
    } else if (sort_by === 'price_desc') {
      matched.sort((a, b) => (b.price_inr || 0) - (a.price_inr || 0));
    } else {
      matched.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = matched.length;
    const paginated = matched.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);
    const items = paginated.map(formatCatalogueItem);

    return res.json({
      query: queryText,
      page: pageNum,
      pageSize: pageSizeNum,
      total,
      totalPages: Math.ceil(total / pageSizeNum) || 1,
      results: items,
      source: 'in-memory-csv-fallback',
      freshness: _csvCacheTimestamp,
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

    if (col) {
      try {
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
          source: 'mongodb',
        });
      } catch (dbErr) {
        console.warn('[MedicineCatalogue] Categories query failed on database, using CSV fallback:', dbErr.message);
      }
    }

    // Resilient CSV fallback when DB is disconnected
    const records = loadCsvFallback();
    const mfgCount = {};
    records.forEach((r) => {
      if (r.manufacturer_name) {
        mfgCount[r.manufacturer_name] = (mfgCount[r.manufacturer_name] || 0) + 1;
      }
    });

    const topMfgs = Object.entries(mfgCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const dosageForms = [
      { id: 'All', label: 'All Formulations', count: records.length },
      { id: 'Tablet', label: 'Tablets & Strips', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Tablet').length },
      { id: 'Syrup/Liquid', label: 'Syrups & Suspensions', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Syrup/Liquid').length },
      { id: 'Injection', label: 'Injections & Vials', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Injection').length },
      { id: 'Topical/Ointment', label: 'Ointments & Creams', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Topical/Ointment').length },
      { id: 'Capsule', label: 'Capsules', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Capsule').length },
      { id: 'Inhaler/Respiratory', label: 'Inhalers & Sprays', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Inhaler/Respiratory').length },
      { id: 'Powder/Sachet', label: 'Powders & Sachets', count: records.filter((r) => detectDosageForm(r.name, r.pack_size_label) === 'Powder/Sachet').length },
    ];

    return res.json({
      totalMedicines: records.length,
      datasetName: 'Indian Medicine Dataset (junioralive)',
      dosageForms,
      topManufacturers: topMfgs,
      source: 'in-memory-csv-fallback',
      freshness: _csvCacheTimestamp,
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
      const regexPart = formRegexMap[dosage_form];
      if (regexPart) {
        filterQuery.$or = [
          { dosage_form: dosage_form },
          { name: { $regex: regexPart, $options: 'i' } },
          { pack_size_label: { $regex: regexPart, $options: 'i' } },
        ];
      } else {
        filterQuery.dosage_form = dosage_form;
      }
    }

    if (col) {
      try {
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
          source: 'mongodb',
        });
      } catch (dbErr) {
        console.warn('[MedicineCatalogue] List query failed on database, using CSV fallback:', dbErr.message);
      }
    }

    // Resilient CSV-backed fallback for browsing
    const records = loadCsvFallback();
    let filtered = records;

    if (manufacturer) {
      const mLower = String(manufacturer).toLowerCase();
      filtered = filtered.filter(r => r.manufacturer_name && r.manufacturer_name.toLowerCase().includes(mLower));
    }

    if (dosage_form && dosage_form !== 'All') {
      filtered = filtered.filter(r => detectDosageForm(r.name, r.pack_size_label) === dosage_form);
    }

    if (sort_by === 'price_asc') {
      filtered.sort((a, b) => (a.price_inr || 999999) - (b.price_inr || 999999));
    } else if (sort_by === 'price_desc') {
      filtered.sort((a, b) => (b.price_inr || 0) - (a.price_inr || 0));
    } else {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    const total = filtered.length;
    const paginated = filtered.slice((pageNum - 1) * pageSizeNum, pageNum * pageSizeNum);
    const items = paginated.map(formatCatalogueItem);

    return res.json({
      page: pageNum,
      pageSize: pageSizeNum,
      total,
      totalPages: Math.ceil(total / pageSizeNum) || 1,
      results: items,
      source: 'in-memory-csv-fallback',
      freshness: _csvCacheTimestamp,
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

    if (col) {
      try {
        let query = { source_id: itemId };
        if (ObjectId.isValid(itemId)) {
          query = { $or: [{ source_id: itemId }, { _id: new ObjectId(itemId) }] };
        }

        const doc = await col.findOne(query);
        if (doc) {
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
        }
      } catch (dbErr) {
        console.warn('[MedicineCatalogue] DB findOne failed, falling back to CSV:', dbErr.message);
      }
    }

    // CSV fallback lookup by ID
    const records = loadCsvFallback();
    const matched = records.find(
      (r) => String(r.source_id) === itemId || String(r._id) === itemId || String(r._id) === `csv_${itemId}`
    );

    if (matched) {
      return res.json(formatCatalogueItem(matched));
    }

    return res.status(404).json({
      detail: 'Catalogue medicine record not found.',
    });
  } catch (err) {
    console.error('[MedicineCatalogue Item Error]:', err);
    return res.status(503).json({
      detail: 'Error retrieving medicine details.',
    });
  }
});

export default router;
