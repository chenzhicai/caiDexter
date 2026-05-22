/**
 * Utility functions for AKShare HK stock tools.
 */

/**
 * Normalize a Hong Kong stock ticker code to 5-digit format.
 * - "00700" → "00700"
 * - "700" → "00700"
 * - "00700.HK" → "00700"
 * - "9988" → "09988"
 */
export function normalizeHkCode(ticker: string): string {
  const code = ticker.trim().toUpperCase();
  // Remove .HK suffix
  if (code.endsWith('.HK')) {
    const num = code.replace('.HK', '');
    return num.padStart(5, '0');
  }
  // Pad to 5 digits
  if (/^\d{1,5}$/.test(code)) {
    return code.padStart(5, '0');
  }
  return code;
}

/**
 * Check if a ticker is a Hong Kong stock code.
 * HK stock codes are typically 1-5 digit numbers, optionally with .HK suffix.
 */
export function isHkTicker(ticker: string): boolean {
  const code = ticker.trim().toUpperCase();
  // Match .HK suffix
  if (/^\d{1,5}\.HK$/.test(code)) return true;
  // Match pure digit codes 1-5 digits (HK stocks)
  if (/^\d{1,5}$/.test(code)) {
    const num = parseInt(code, 10);
    // HK stock codes range: 00001 - 99999
    // But 6-digit codes are likely A-shares, so exclude those
    return num >= 1 && num <= 99999;
  }
  return false;
}
