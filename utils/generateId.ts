export const getKey = () => {
  const min = 100_000; // Minimum 6-digit number
  const max = 999_999; // Maximum 6-digit number
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
