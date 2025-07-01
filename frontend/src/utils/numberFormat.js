/**
 * Formats large numbers in a readable manner
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @param {boolean} showPlus - Whether to show plus sign for positive numbers (default: false)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 1, showPlus = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const num = Number(value);
  const absNum = Math.abs(num);
  
  // For very large numbers (1e9 and above), use scientific notation
  if (absNum >= 1e9) {
    const formatted = num.toExponential(decimals);
    return showPlus && num > 0 ? `+${formatted}` : formatted;
  }
  
  // For large numbers (1e6 and above), use M suffix
  if (absNum >= 1e6) {
    const formatted = (num / 1e6).toFixed(decimals);
    const cleanFormatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    return showPlus && num > 0 ? `+${cleanFormatted}M` : `${cleanFormatted}M`;
  }
  
  // For medium numbers (1e3 and above), use K suffix
  if (absNum >= 1e3) {
    const formatted = (num / 1e3).toFixed(decimals);
    const cleanFormatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    return showPlus && num > 0 ? `+${cleanFormatted}K` : `${cleanFormatted}K`;
  }
  
  // For smaller numbers, use regular formatting
  const formatted = num.toFixed(decimals);
  const cleanFormatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
  return showPlus && num > 0 ? `+${cleanFormatted}` : cleanFormatted;
};

/**
 * Formats currency values with proper formatting
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @param {boolean} showPlus - Whether to show plus sign for positive numbers (default: false)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, decimals = 2, showPlus = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }

  const num = Number(value);
  const absNum = Math.abs(num);
  
  // For very large numbers (1e9 and above), use scientific notation
  if (absNum >= 1e9) {
    const formatted = num.toExponential(decimals);
    return showPlus && num > 0 ? `+$${formatted}` : `$${formatted}`;
  }
  
  // For large numbers (1e6 and above), use M suffix
  if (absNum >= 1e6) {
    const formatted = (num / 1e6).toFixed(decimals);
    const cleanFormatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    return showPlus && num > 0 ? `+$${cleanFormatted}M` : `$${cleanFormatted}M`;
  }
  
  // For medium numbers (1e3 and above), use K suffix
  if (absNum >= 1e3) {
    const formatted = (num / 1e3).toFixed(decimals);
    const cleanFormatted = formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
    return showPlus && num > 0 ? `+$${cleanFormatted}K` : `$${cleanFormatted}K`;
  }
  
  // For smaller numbers, use regular currency formatting
  const formatted = num.toFixed(decimals);
  return showPlus && num > 0 ? `+$${formatted}` : `$${formatted}`;
};

/**
 * Formats numbers for display in tables and lists
 * @param {number} value - The number to format
 * @param {boolean} showPlus - Whether to show plus sign for positive numbers (default: false)
 * @returns {string} Formatted number string
 */
export const formatDisplayNumber = (value, showPlus = false) => {
  return formatNumber(value, 1, showPlus);
};

/**
 * Formats numbers for compact display (no decimals for whole numbers)
 * @param {number} value - The number to format
 * @param {boolean} showPlus - Whether to show plus sign for positive numbers (default: false)
 * @returns {string} Formatted number string
 */
export const formatCompactNumber = (value, showPlus = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const num = Number(value);
  const absNum = Math.abs(num);
  
  // For very large numbers (1e9 and above), use scientific notation
  if (absNum >= 1e9) {
    const formatted = num.toExponential(1);
    return showPlus && num > 0 ? `+${formatted}` : formatted;
  }
  
  // For large numbers (1e6 and above), use M suffix
  if (absNum >= 1e6) {
    const formatted = Math.round(num / 1e6);
    return showPlus && num > 0 ? `+${formatted}M` : `${formatted}M`;
  }
  
  // For medium numbers (1e3 and above), use K suffix
  if (absNum >= 1e3) {
    const formatted = Math.round(num / 1e3);
    return showPlus && num > 0 ? `+${formatted}K` : `${formatted}K`;
  }
  
  // For smaller numbers, use regular formatting
  const formatted = Math.round(num);
  return showPlus && num > 0 ? `+${formatted}` : formatted.toString();
}; 