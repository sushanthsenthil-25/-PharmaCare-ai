/**
 * Expiry Validation Utility for PharmaCare AI
 * Evaluates medicine expiry state against configurable warning threshold
 */

export const getExpiryStatus = (expiryDate, warningDays = null) => {
  if (!expiryDate) return 'VALID';

  const exp = new Date(expiryDate);
  const now = new Date();

  // If invalid date string, default to valid
  if (isNaN(exp.getTime())) return 'VALID';

  // Check if expired
  if (exp < now) {
    return 'EXPIRED';
  }

  const thresholdDays = warningDays !== null
    ? Number(warningDays)
    : Number(process.env.EXPIRY_WARNING_DAYS || 90);

  const diffTime = exp.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= thresholdDays) {
    return 'EXPIRES_SOON';
  }

  return 'VALID';
};

export const isMedicineExpired = (expiryDate) => {
  return getExpiryStatus(expiryDate) === 'EXPIRED';
};
