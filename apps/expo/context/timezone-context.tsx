// contexts/TimeZoneContext.tsx

import { initializeTimeZone } from '@/utils/store-user-timezone';
import React, { createContext, useContext, useState, useEffect } from 'react';


// Define the context type
interface TimeZoneContextType {
  timeZone: string | null;
}

// Create the context
const TimeZoneContext = createContext<TimeZoneContextType | undefined>(undefined);

// Create the provider component
export const TimeZoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeZone, setTimeZone] = useState<string | null>(null);

  useEffect(() => {
    async function setupTimeZone() {
      const tz = await initializeTimeZone();
      setTimeZone(tz);
    }

    setupTimeZone();
  }, []);

  return (
    <TimeZoneContext.Provider value={{ timeZone }}>
      {children}
    </TimeZoneContext.Provider>
  );
};

// Create a custom hook for easy access
export function useTimeZone() {
  const context = useContext(TimeZoneContext);
  if (!context) {
    throw new Error('useTimeZone must be used within a TimeZoneProvider');
  }
  return context;
}
