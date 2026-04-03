export function formatCurrency(amount) {
  // Ensure amount is rounded to 2 decimal places
  const roundedAmount = Math.round((amount || 0) * 100) / 100;
  return '£ ' + roundedAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}