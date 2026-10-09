export const serviceIcon = (category) => {
  const normalizedCategory = String(category || '').toLowerCase();
  if (normalizedCategory.includes('groom')) return <i className="fa-solid fa-scissors text-sm" />;
  if (normalizedCategory.includes('hotel') || normalizedCategory.includes('suite')) {
    return <i className="fa-solid fa-hotel text-sm" />;
  }
  return <i className="fa-solid fa-bone text-sm" />;
};
