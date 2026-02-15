export const getRandomVariant = (variants) => {
  if (!variants || variants.length === 0) {
    return '';
  }
  const randomIndex = Math.floor(Math.random() * variants.length);
  return variants[randomIndex];
};