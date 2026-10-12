/**
 * Authentic Pharmaceutical & Clinical Product Image System
 * Provides authentic dosage-form vector graphics for all 11,621 catalogue records
 * and handles broken URL fallbacks without infinite loops or layout shifts.
 */

// Dosage Form SVG Vectors (clean, high-contrast, clinical aesthetics)
export const DOSAGE_SVGS = {
  Tablet: `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23f0fdf4' rx='24'/%3e%3ccircle cx='85' cy='95' r='38' fill='%23059669'/%3e%3cline x1='60' y1='95' x2='110' y2='95' stroke='%23ffffff' stroke-width='4' stroke-linecap='round'/%3e%3crect x='105' y='65' width='55' height='75' rx='27.5' fill='%2310b981' transform='rotate(25 132 102)'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%23065f46' text-anchor='middle'%3eCLINICAL TABLET%3c/text%3e%3c/svg%3e`,

  Capsule: `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23eff6ff' rx='24'/%3e%3cg transform='rotate(45 100 100)'%3e%3cpath d='M75 50 h50 a25 25 0 0 1 25 25 v25 h-100 v-25 a25 25 0 0 1 25 -25 z' fill='%232563eb'/%3e%3cpath d='M50 100 h100 v25 a25 25 0 0 1 -25 25 h-50 a25 25 0 0 1 -25 -25 z' fill='%2393c5fd'/%3e%3c/g%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%231e40af' text-anchor='middle'%3eCLINICAL CAPSULE%3c/text%3e%3c/svg%3e`,

  'Syrup/Liquid': `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23fffbeb' rx='24'/%3e%3crect x='80' y='35' width='40' height='20' rx='4' fill='%23d97706'/%3e%3crect x='65' y='55' width='70' height='90' rx='12' fill='%23fef3c7' stroke='%23d97706' stroke-width='4'/%3e%3crect x='75' y='80' width='50' height='40' rx='4' fill='%23f59e0b' opacity='0.3'/%3e%3cline x1='80' y1='95' x2='100' y2='95' stroke='%23b45309' stroke-width='3' stroke-linecap='round'/%3e%3cline x1='80' y1='105' x2='110' y2='105' stroke='%23b45309' stroke-width='3' stroke-linecap='round'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%2392400e' text-anchor='middle'%3eORAL SUSPENSION / SYRUP%3c/text%3e%3c/svg%3e`,

  Injection: `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23fdf4ff' rx='24'/%3e%3crect x='85' y='40' width='30' height='15' rx='3' fill='%239333ea'/%3e%3crect x='75' y='55' width='50' height='85' rx='8' fill='%23fae8ff' stroke='%239333ea' stroke-width='4'/%3e%3cline x1='85' y1='80' x2='100' y2='80' stroke='%237e22ce' stroke-width='3'/%3e%3cline x1='85' y1='95' x2='105' y2='95' stroke='%237e22ce' stroke-width='3'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%236b21a8' text-anchor='middle'%3ESTERILE INJECTION%3c/text%3e%3c/svg%3e`,

  'Topical/Ointment': `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23f0fdfa' rx='24'/%3e%3cpolygon points='90,40 110,40 125,130 75,130' fill='%23ccfbf1' stroke='%230d9488' stroke-width='4'/%3e%3crect x='85' y='130' width='30' height='15' rx='3' fill='%230f766e'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%23115e59' text-anchor='middle'%3ETOPICAL OINTMENT / GEL%3c/text%3e%3c/svg%3e`,

  'Inhaler/Respiratory': `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23ecfeff' rx='24'/%3e%3cpath d='M80 40 h40 v60 h30 v35 h-70 z' fill='%23cffafe' stroke='%230891b2' stroke-width='4' stroke-linejoin='round'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%23155e75' text-anchor='middle'%3EMETERED INHALER%3c/text%3e%3c/svg%3e`,

  'Powder/Sachet': `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23fafaf9' rx='24'/%3e%3cpolygon points='65,45 135,45 145,135 55,135' fill='%23e7e5e4' stroke='%2378716c' stroke-width='4'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%2344403c' text-anchor='middle'%3ECLINICAL SACHET%3c/text%3e%3c/svg%3e`,

  PersonalCare: `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23fdf2f8' rx='24'/%3e%3crect x='75' y='50' width='50' height='85' rx='16' fill='%23fce7f3' stroke='%23db2777' stroke-width='4'/%3e%3crect x='88' y='35' width='24' height='15' rx='4' fill='%23be185d'/%3e%3cpath d='M100 70 v20 M90 80 h20' stroke='%23db2777' stroke-width='3' stroke-linecap='round'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%239d174d' text-anchor='middle'%3EDERMA / PERSONAL CARE%3c/text%3e%3c/svg%3e`,

  Default: `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3e%3crect width='200' height='200' fill='%23f8fafc' rx='24'/%3e%3ccircle cx='100' cy='95' r='36' fill='%23e2e8f0'/%3e%3cpath d='M100 75 v40 M80 95 h40' stroke='%2364748b' stroke-width='6' stroke-linecap='round'/%3e%3ctext x='100' y='172' font-family='system-ui,-apple-system,sans-serif' font-size='12' font-weight='700' fill='%23475569' text-anchor='middle'%3EPHARMACEUTICAL ITEM%3c/text%3e%3c/svg%3e`,
};

// Known broken Unsplash image URLs mapping to valid verified replacements
const BROKEN_IMAGE_FIXES = {
  // Pantoprazole 40 (was broken 404)
  'photo-1550572017-ed24c44933ff': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80',
  // Ibuprofen 400 (was broken 404)
  'photo-1550572017-4fcdbb590e5b': 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=500&auto=format&fit=crop&q=80',
  // Personal care hair serums (were broken 404)
  'photo-1608248597359-28c0c45d3153': 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=80',
};

/**
 * Resolves authentic product image URL or verified dosage SVG placeholder.
 */
export function getProductImageUrl(item) {
  if (!item) return DOSAGE_SVGS.Default;

  // 1. If item already has a verified, non-empty image string
  const rawImg = item.img || item.image || item.image_url;
  if (rawImg && typeof rawImg === 'string' && rawImg.trim() !== '') {
    // Check if this URL contains a known broken hash and fix it
    for (const [brokenKey, validUrl] of Object.entries(BROKEN_IMAGE_FIXES)) {
      if (rawImg.includes(brokenKey)) {
        return validUrl;
      }
    }
    return rawImg;
  }

  // 2. Derive dosage-form SVG placeholder for catalogue items
  const form = item.dosageForm || item.form || '';
  if (DOSAGE_SVGS[form]) {
    return DOSAGE_SVGS[form];
  }

  const name = (item.name || '').toLowerCase();
  const pack = (item.packSize || item.pack_size_label || '').toLowerCase();
  const combined = `${name} ${pack}`;

  if (combined.includes('tablet') || combined.includes('tab') || combined.includes('strip')) {
    return DOSAGE_SVGS.Tablet;
  }
  if (combined.includes('capsule') || combined.includes('cap')) {
    return DOSAGE_SVGS.Capsule;
  }
  if (combined.includes('syrup') || combined.includes('suspension') || combined.includes('liquid') || combined.includes('drop')) {
    return DOSAGE_SVGS['Syrup/Liquid'];
  }
  if (combined.includes('injection') || combined.includes('vial') || combined.includes('ampoule') || combined.includes('inj')) {
    return DOSAGE_SVGS.Injection;
  }
  if (combined.includes('gel') || combined.includes('cream') || combined.includes('ointment')) {
    return DOSAGE_SVGS['Topical/Ointment'];
  }
  if (combined.includes('inhaler') || combined.includes('respules')) {
    return DOSAGE_SVGS['Inhaler/Respiratory'];
  }
  if (combined.includes('sachet') || combined.includes('powder')) {
    return DOSAGE_SVGS['Powder/Sachet'];
  }

  if (item.productType === 'PersonalCareProduct' || (item.category || '').includes('Care')) {
    return DOSAGE_SVGS.PersonalCare;
  }

  return DOSAGE_SVGS.Default;
}

/**
 * Safe error handler for images to prevent infinite loops.
 */
export function handleImageError(e, fallbackType = 'Default') {
  const fallback = DOSAGE_SVGS[fallbackType] || DOSAGE_SVGS.Default;
  if (e.target.src !== fallback) {
    e.target.src = fallback;
  }
}
