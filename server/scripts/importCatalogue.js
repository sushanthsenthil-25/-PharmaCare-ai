import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CSV_FILE_PATH = path.resolve(__dirname, '../../data/indian_medicine_data.csv');

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

function parseCsvLine(line) {
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
  return values;
}

export async function importCatalogue() {
  console.log('[Import] Connecting to MongoDB...');
  await connectDB();
  const db = mongoose.connection.db;
  const col = db.collection('medicine_catalogue');

  if (!fs.existsSync(CSV_FILE_PATH)) {
    throw new Error(`CSV file not found at ${CSV_FILE_PATH}`);
  }

  console.log('[Import] Reading CSV file:', CSV_FILE_PATH);
  const content = fs.readFileSync(CSV_FILE_PATH, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing headers.');
  }

  const header = parseCsvLine(lines[0]);
  console.log('[Import] CSV Headers:', header);

  const bulkOps = [];
  let validCount = 0;
  let malformedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    const source_id = String(row.id || i).trim();
    const name = String(row.name || '').trim();

    if (!name || !source_id) {
      malformedCount++;
      continue;
    }

    const comp = [row.short_composition1, row.short_composition2].filter(Boolean).map((c) => c.trim());
    const rawPrice = parseFloat(String(row['price(₹)'] || '').replace(/,/g, ''));
    const price_inr = !isNaN(rawPrice) && rawPrice >= 0 ? rawPrice : null;
    const dosageForm = detectDosageForm(name, row.pack_size_label);

    const doc = {
      source_id,
      name,
      name_normalized: name.toLowerCase(),
      manufacturer_name: row.manufacturer_name ? String(row.manufacturer_name).trim() : null,
      medicine_type: row.type || 'allopathy',
      pack_size_label: row.pack_size_label ? String(row.pack_size_label).trim() : null,
      dosage_form: dosageForm,
      composition: comp,
      price_inr,
      is_discontinued: String(row.Is_discontinued || '').toUpperCase() === 'TRUE',
      source: 'junioralive/Indian-Medicine-Dataset',
      data_quality: {
        source_verified: true,
        price_missing: price_inr === null,
      },
      updated_at: new Date(),
    };

    bulkOps.push({
      updateOne: {
        filter: { source_id },
        update: { $set: doc },
        upsert: true,
      },
    });

    validCount++;
  }

  console.log(`[Import] Parsed ${validCount} valid records (${malformedCount} malformed/skipped). Writing to MongoDB in batches...`);

  const BATCH_SIZE = 1000;
  for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
    const batch = bulkOps.slice(i, i + BATCH_SIZE);
    await col.bulkWrite(batch, { ordered: false });
    console.log(`[Import] Processed ${Math.min(i + BATCH_SIZE, bulkOps.length)} / ${bulkOps.length} records...`);
  }

  console.log('[Import] Creating indexes on medicine_catalogue collection...');
  await col.createIndex({ source_id: 1 }, { unique: true });
  await col.createIndex({ name_normalized: 1 });
  await col.createIndex({ dosage_form: 1 });
  await col.createIndex({ manufacturer_name: 1 });
  await col.createIndex({ price_inr: 1 });
  await col.createIndex(
    {
      name: 'text',
      composition: 'text',
      manufacturer_name: 'text',
    },
    {
      weights: { name: 10, composition: 5, manufacturer_name: 2 },
      name: 'catalogue_text_search',
    }
  );

  const totalInDb = await col.countDocuments({});
  console.log(`[Import Completed] Total records in medicine_catalogue: ${totalInDb}`);
  return totalInDb;
}

if (process.argv[1] && process.argv[1].endsWith('importCatalogue.js')) {
  importCatalogue()
    .then((count) => {
      console.log(`[Success] Verified ${count} records loaded.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Error] Import failed:', err);
      process.exit(1);
    });
}
