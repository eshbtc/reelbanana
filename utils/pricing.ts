export const getImageCreditPriceUSD = (): number => {
  const v = (import.meta as any)?.env?.VITE_PRICE_PER_IMAGE_CREDIT_USD;
  const n = typeof v === 'string' ? parseFloat(v) : NaN;
  if (!isNaN(n) && n >= 0) return n;
  // Sensible demo default: $0.02 per image credit
  return 0.02;
};

export const formatUSD = (amount: number): string => {
  if (amount < 0.001) return '< $0.001';
  return `$${amount.toFixed(3)}`;
};

