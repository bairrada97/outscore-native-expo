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
    // Get formatted dates for the range
    const formattedDates = getFormattedDateRange();
    
    // Get today's date for comparison
    const today = new Date();
    
    // Get user's timezone directly from their device using our utility
    const userTimezone = getDeviceTimeZone();
    
    console.log(`Prefetching ${formattedDates.length} dates with timezone:`, userTimezone);
    
    let cachedDatesCount = 0;
    let freshFetchCount = 0;
    
    // Process each date
    const prefetchPromises = formattedDates.map(date => {
      const queryKey = createQueryKey(date, userTimezone);
      
      // Check if this is today's date
      const requestDate = new Date(date);
      const isToday = isSameDay(requestDate, today);
      
      if (isToday) {
        // For today's matches, always force a fresh fetch and don't cache
        console.log(`Forcing fresh data fetch for today (${date})`);
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
        console.log(`Data for ${date} already in cache, skipping prefetch`);
        cachedDatesCount++;
        return Promise.resolve();
      }
      
      // Query not in cache, prefetch it
      console.log(`Prefetching data for ${date}`);
      freshFetchCount++;
      
      const query = fixturesByDateQuery({ 
        date,
        timezone: userTimezone
      });
      return queryClient.prefetchQuery(query);
    });
    
    // Wait for all prefetch operations to complete
    await Promise.all(prefetchPromises);
    
    console.log(`Prefetch complete: ${cachedDatesCount} dates from cache, ${freshFetchCount} dates freshly fetched`);
    return true;
  } catch (error) {
    console.error("Error prefetching fixture data:", error);
    return true; // Return true even on error so the app still loads
  }
}; 