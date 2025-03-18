import { QueryClient } from '@tanstack/react-query';
import { fixturesByDateQuery, createQueryKey } from './fixture-by-date-query';
import { getFormattedDateRange } from '@/utils/date-utils';
import { getDeviceTimeZone } from '@/utils/store-user-timezone';
import { format, isSameDay } from 'date-fns';

/**
 * Prefetches fixture data for the date range (5 days)
 * 
 * @param queryClient The React Query client instance
 * @returns Promise resolving to true when complete (even on error)
 */
export const prefetchFixtureData = async (queryClient: QueryClient): Promise<boolean> => {
  try {
    // Always generate dates based on current date to ensure fresh date range
    // This ensures that when a new day comes, we properly shift the 5-day window
    const now = new Date();
    const formattedDates = getFormattedDateRange(now);
    
    // Get today's date for comparison - using fresh date object
    const today = now;
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Get user's timezone directly from their device using our utility
    const userTimezone = getDeviceTimeZone();
    
    console.log(`===== PREFETCH STARTED =====`);
    console.log(`Date: ${todayStr}, timezone: ${userTimezone}`);
    console.log(`Date range: ${formattedDates.join(', ')}`);
    
    let cachedDatesCount = 0;
    let freshFetchCount = 0;
    
    // Process each date
    const prefetchPromises = formattedDates.map(date => {
      const queryKey = createQueryKey(date, userTimezone);
      
      // Check if this is today's date
      const requestDate = new Date(date);
      const isToday = isSameDay(requestDate, today);
      
      // For today's matches, always force a fresh fetch to ensure current data
      if (isToday) {
        console.log(`${date}: Today's matches - forcing fresh fetch`);
        freshFetchCount++;
        
        // First remove any existing cached data for today
        queryClient.removeQueries({ queryKey });
        
        // Then fetch fresh data
        const query = fixturesByDateQuery({ 
          date,
          timezone: userTimezone
        });
        return queryClient.prefetchQuery(query);
      }
      
      // For other dates, check cache first
      const cachedData = queryClient.getQueryData(queryKey);
      
      if (cachedData) {
        console.log(`${date}: Using cached data`);
        cachedDatesCount++;
        return Promise.resolve();
      }
      
      // Query not in cache, prefetch it
      console.log(`${date}: Fetching new data`);
      freshFetchCount++;
      
      const query = fixturesByDateQuery({ 
        date,
        timezone: userTimezone
      });
      return queryClient.prefetchQuery(query);
    });
    
    // Wait for all prefetch operations to complete
    await Promise.all(prefetchPromises);
    
    console.log(`===== PREFETCH COMPLETE =====`);
    console.log(`From cache: ${cachedDatesCount} days, Fresh fetches: ${freshFetchCount} days`);
    return true;
  } catch (error) {
    console.error("Error prefetching fixture data:", error);
    return true; // Return true even on error so the app still loads
  }
};  