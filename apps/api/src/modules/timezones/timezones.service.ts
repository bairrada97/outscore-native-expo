import timezones from './timezones.json';

// Get all available timezones
export const getTimezones = (): string[] => {
  return timezones;
};

// Validate if a timezone name is valid
export const isValidTimezone = (name: string): boolean => {
  return timezones.includes(name);
}; 