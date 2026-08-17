/**
 * Formats a number as currency with commas for thousands separator
 * @param amount - The number to format
 * @param currency - The currency symbol (default: '$')
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currency?: string,
  decimals: number = 2
): string => {
  // Resolve currency symbol with robust fallbacks to avoid "undefined" in UI
  const userData = (!currency ? JSON.parse(localStorage.getItem('userData') || '{}') : undefined) as any;
  const currencySymbol =
    currency ??
    userData?.company_data?.currency_symbol ??
    userData?.company_data?.currency ??
    '$';

  const safeAmount = amount === null || amount === undefined || isNaN(Number(amount)) ? 0 : Number(amount);

  return `${currencySymbol}${safeAmount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/**
 * Formats a number with commas for thousands separator
 * @param number - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted number string
 */
export const formatNumber = (
  number: number,
  decimals: number = 0
): string => {
  if (isNaN(number)) {
    return '0';
  }
  
  return number.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Formats a number as a percentage
 * @param number - The number to format (0.1 = 10%)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  number: number,
  decimals: number = 1
): string => {
  if (isNaN(number)) {
    return '0%';
  }
  
  return `${(number * 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
};

/**
 * Formats file size in bytes to human readable format
 * @param bytes - The number of bytes
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Formats a large number with K, M, B suffixes
 * @param number - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string with suffix
 */
export const formatCompactNumber = (
  number: number,
  decimals: number = 1
): string => {
  if (isNaN(number)) {
    return '0';
  }
  
  if (number < 1000) {
    return number.toString();
  }
  
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const suffixNum = Math.floor(Math.log10(Math.abs(number)) / 3);
  const shortValue = (number / Math.pow(1000, suffixNum)).toFixed(decimals);
  
  return `${shortValue}${suffixes[suffixNum]}`;
};

export const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).replace(/ /g, '-');
  } catch {
    return 'N/A';
  }
};