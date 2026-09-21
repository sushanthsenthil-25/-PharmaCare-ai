import Medicine from '../models/Medicine.js';
import { EXACT_20_MEDICINES } from '../seed.js';
import { getExpiryStatus } from '../utils/expiry.js';

/**
 * Normalizes user queries for search:
 * - trims and lowercases
 * - strips punctuation and search filler words ("tell me about", "show me", "can you find", etc.)
 * - normalizes spoken numbers ("six fifty" -> "650")
 */
export function normalizeQuery(rawQuery) {
  if (!rawQuery) return '';
  let q = rawQuery.trim().toLowerCase();

  // Normalize spoken numbers
  q = q.replace(/\bsix fifty\b/gi, '650');
  q = q.replace(/\bfive hundred\b/gi, '500');
  q = q.replace(/\bforty\b/gi, '40');
  q = q.replace(/\btwenty\b/gi, '20');
  q = q.replace(/\bthirty\b/gi, '30');
  q = q.replace(/\bfifty\b/gi, '50');
  q = q.replace(/\bten\b/gi, '10');
  q = q.replace(/\bfive\b/gi, '5');
  q = q.replace(/\bfour\b/gi, '4');

  // Strip punctuation
  q = q.replace(/[?.!,;:'"()]/g, '');

  return q.trim();
}

/**
 * Extracts candidate medicine/brand name from conversational phrases:
 * e.g. "Tell me about Dolo" -> "Dolo"
 * "Show me paracetamol 650" -> "Paracetamol 650"
 * "Do you have Dolo 650?" -> "Dolo 650"
 * "What is Pantoprazole used for" -> "Pantoprazole"
 */
export function extractMedicineName(rawQuery) {
  if (!rawQuery) return '';
  let q = normalizeQuery(rawQuery);

  const prefixPatterns = [
    /^(?:hey\s+)?(?:jarvis\s*,?\s*)?/i,
    /^(?:can\s+you\s+(?:please\s+)?|could\s+you\s+(?:please\s+)?|please\s+)?/i,
    /^(?:tell\s+(?:me|us)?\s*(?:something\s+)?(?:about)?|explain\s+(?:to\s+(?:me|us)\s+)?(?:about)?|describe|talk\s+about)\s+/i,
    /^(?:what\s+(?:is|are|about)|whats\s+(?:about)?|how\s+about|know\s+about|learn\s+about)\s+/i,
    /^(?:i\s+(?:want|need)\s+(?:to\s+know\s+(?:about)?|to\s+buy|to\s+find|to\s+get|info\s+on|details\s+of)?)\s+/i,
    /^(?:give\s+(?:me|us)?\s*(?:some\s+)?(?:info|information|details)?\s*(?:about|on|of)?)\s+/i,
    /^(?:information\s+(?:about|on|of)|info\s+(?:about|on|of)|details\s+(?:about|on|of)|detail\s+(?:about|on|of))\s+/i,
    /^(?:show\s+(?:me|us)?|find\s+(?:me|us)?|buy|get|search\s+(?:for)?|lookup|look\s+for|check\s+(?:for)?)\s+/i,
    /^(?:do\s+you\s+have|do\s+we\s+have|is\s+there\s+any|are\s+there\s+any|is\s+there|got\s+any)\s+/i,
    /^(?:now\s+show\s+me|something\s+for|medicines?\s+for|tablets?\s+for|tablets?\s+of|capsules?\s+of|capsules?\s+for|syrup\s+for|syrup\s+of)\s+/i,
    /^(?:about|a|an|the)\s+/i,
  ];

  let changed = true;
  let passes = 0;
  while (changed && passes < 4) {
    const prev = q;
    for (const pattern of prefixPatterns) {
      q = q.replace(pattern, '').trim();
    }
    changed = prev !== q;
    passes++;
  }

  // Remove trailing inquiry phrases / generic words
  q = q.replace(/\s+(?:used for|uses|usage|indications?|price|cost|rate|pricing|available|in stock|stock|tablets?|capsules?|syrup|suspension|sachet|medicines?|drugs?|products?|please|thanks?|thank you|jarvis)$/i, '').trim();
  q = q.replace(/^(?:a|an|the|about)\s+/i, '').trim();

  return q;
}

/**
 * Searches MongoDB with prioritized relevance ranking:
 * 1. Exact Name match
 * 2. Exact Brand match
 * 3. Exact Alias match
 * 4. Exact Generic Name match
 * 5. Name starts with query
 * 6. Generic Name starts with query
 * 7. Brand starts with query
 * 8. Partial text match across name, brand, generic, active ingredient, aliases, description, uses
 */
export async function searchMedicinesRanked(rawQuery, options = {}) {
  const { limit = 10, maxPrice = null, category = null } = options;
  const cleanTerm = extractMedicineName(rawQuery) || normalizeQuery(rawQuery);

  if (!cleanTerm) {
    return [];
  }

  const termLower = cleanTerm.toLowerCase();
  const partialRegex = new RegExp(escapeRegex(termLower), 'i');

  try {
    // Build base filter
    const baseFilter = {};
    if (category && category !== 'All') {
      baseFilter.category = new RegExp(`^${category.trim()}$`, 'i');
    }
    if (maxPrice) {
      baseFilter.price = { $lte: Number(maxPrice) };
    }

    // Broad candidates matching across any relevant field
    const searchFilter = {
      ...baseFilter,
      $or: [
        { name: partialRegex },
        { genericName: partialRegex },
        { activeIngredient: partialRegex },
        { scientificName: partialRegex },
        { brand: partialRegex },
        { aliases: partialRegex },
        { searchKeywords: partialRegex },
        { category: partialRegex },
        { form: partialRegex },
        { strength: partialRegex },
        { description: partialRegex },
        { uses: partialRegex },
      ],
    };

    let candidates = await Medicine.find(searchFilter).lean().maxTimeMS(3000);

    // Fallback: If 0 candidates, search by individual extracted tokens (e.g. "dolo" in "tell about dolo")
    if (!candidates || candidates.length === 0) {
      const stopWords = new Set(['tell', 'about', 'show', 'find', 'have', 'need', 'want', 'what', 'with', 'from', 'this', 'that', 'product', 'medicine', 'medicines', 'tablet', 'tablets', 'capsule', 'capsules', 'please', 'gives', 'info', 'information', 'details', 'price', 'cost']);
      const tokens = (rawQuery.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 3 && !stopWords.has(w));

      if (tokens.length > 0) {
        const tokenOrClauses = tokens.flatMap((tok) => {
          const tokRegex = new RegExp(escapeRegex(tok), 'i');
          return [
            { name: tokRegex },
            { genericName: tokRegex },
            { activeIngredient: tokRegex },
            { brand: tokRegex },
            { aliases: tokRegex },
            { searchKeywords: tokRegex },
          ];
        });

        candidates = await Medicine.find({ ...baseFilter, $or: tokenOrClauses }).lean().maxTimeMS(3000);
      }
    }

    if (candidates && candidates.length > 0) {
      // Score and rank candidates
      const scored = candidates.map((m) => {
        let score = 0;
        const nameL = (m.name || '').toLowerCase();
        const genericL = (m.genericName || '').toLowerCase();
        const brandL = (m.brand || '').toLowerCase();
        const aliases = (m.aliases || []).map((a) => a.toLowerCase());
        const keywords = (m.searchKeywords || []).map((k) => k.toLowerCase());

        // 1. Exact Name (100 pts)
        if (nameL === termLower) score += 100;
        // 2. Exact Brand or Brand contains exact query word (80 pts)
        else if (brandL === termLower || brandL.includes(termLower)) score += 80;
        // 3. Exact Alias match (80 pts)
        else if (aliases.includes(termLower) || aliases.some((a) => a.includes(termLower))) score += 80;
        // 4. Exact Generic Name (70 pts)
        else if (genericL === termLower) score += 70;
        // 5. Name starts with (60 pts)
        else if (nameL.startsWith(termLower)) score += 60;
        // 6. Generic starts with (50 pts)
        else if (genericL.startsWith(termLower)) score += 50;
        // 7. Partial match in name (40 pts)
        else if (nameL.includes(termLower)) score += 40;
        // 8. Partial match in generic (30 pts)
        else if (genericL.includes(termLower)) score += 30;
        // 9. Match in uses or keywords (20 pts)
        else if (keywords.includes(termLower) || (m.uses && m.uses.some((u) => u.toLowerCase().includes(termLower)))) score += 20;
        // 10. Generic partial (10 pts)
        else score += 10;

        return { item: m, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const formatted = scored.slice(0, limit).map(({ item }) => formatMedicine(item));
      return formatted;
    }
  } catch (err) {
    console.warn('[searchMedicinesRanked] MongoDB query error:', err.message);
  }

  // Fallback to in-memory EXACT_20_MEDICINES with same ranking
  const fallbackScored = EXACT_20_MEDICINES.filter((m) => {
    const nameL = m.name.toLowerCase();
    const genericL = m.genericName.toLowerCase();
    const brandL = (m.brand || '').toLowerCase();
    const aliases = (m.aliases || []).map((a) => a.toLowerCase());
    const categoryL = m.category.toLowerCase();
    const uses = (m.uses || []).map((u) => u.toLowerCase());

    return (
      nameL.includes(termLower) ||
      genericL.includes(termLower) ||
      brandL.includes(termLower) ||
      aliases.some((a) => a.includes(termLower)) ||
      categoryL.includes(termLower) ||
      uses.some((u) => u.includes(termLower))
    );
  }).map((m) => {
    let score = 0;
    const nameL = m.name.toLowerCase();
    const brandL = (m.brand || '').toLowerCase();
    const aliases = (m.aliases || []).map((a) => a.toLowerCase());
    const genericL = m.genericName.toLowerCase();

    if (nameL === termLower) score += 100;
    else if (brandL.includes(termLower) || aliases.includes(termLower)) score += 80;
    else if (genericL === termLower) score += 70;
    else if (nameL.startsWith(termLower)) score += 60;
    else if (nameL.includes(termLower)) score += 40;
    else score += 20;

    return { item: m, score };
  });

  fallbackScored.sort((a, b) => b.score - a.score);

  return fallbackScored.slice(0, limit).map(({ item }, idx) => ({
    ...formatMedicine(item),
    id: `med_exact_${idx + 1}`,
    rawId: `med_exact_${idx + 1}`,
    _id: `med_exact_${idx + 1}`,
  }));
}

/**
 * Normalizes medicine document structure consistently
 */
export function formatMedicine(m) {
  const expiryStatus = getExpiryStatus(m.expiryDate);
  const id = m._id ? m._id.toString() : m.id || 'med_1';

  return {
    id,
    _id: id,
    rawId: id,
    name: m.name,
    genericName: m.genericName,
    activeIngredient: m.activeIngredient || m.genericName,
    scientificName: m.scientificName || '',
    brand: m.brand || 'PharmaCare Labs',
    aliases: m.aliases || [],
    category: m.category,
    strength: m.strength || '',
    form: m.form || 'Tablet',
    quantity: m.quantity || m.stock || 50,
    price: Number(m.price),
    originalPrice: Number(m.originalPrice || Math.round(m.price * 1.25)),
    discount: m.discount || '15% OFF',
    stock: Number(m.stock !== undefined ? m.stock : 50),
    manufacturer: m.manufacturer || 'PharmaCare Laboratories',
    batchNumber: m.batchNumber || 'PCM-2026',
    manufacturingDate: m.manufacturingDate,
    expiryDate: m.expiryDate,
    expiryStatus,
    isExpired: expiryStatus === 'EXPIRED',
    image: m.image || '',
    images: m.images && m.images.length > 0 ? m.images : [m.image || ''],
    description: m.description || '',
    status: m.status || (m.stock > 0 ? 'In Stock' : 'Out of Stock'),
    uses: m.uses || [],
    precautions: m.precautions || [],
    storageInstructions: m.storageInstructions || 'Store in a cool dry place.',
    rxRequired: Boolean(m.rxRequired),
    productType: 'Medicine',
  };
}

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export default {
  normalizeQuery,
  extractMedicineName,
  searchMedicinesRanked,
  formatMedicine,
};
