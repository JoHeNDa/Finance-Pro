export const roundToTwo = (num) => {
  return Math.round((num || 0) * 100) / 100;
};