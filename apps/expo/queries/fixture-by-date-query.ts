import { format, isSameDay, isAfter, isBefore } from 'date-fns'
import { FIFTEEN_SECONDS_CACHE, ONE_DAY_CACHE, ONE_MINUTE_CACHE } from '@/utils/constants'
import { getFixturesByDate } from './get-fixtures-by-date'
import { FormattedCountry } from '../../../packages/shared-types/dist';

// Define cache constants
const ONE_HOUR_CACHE = 60 * 60 * 1000; // 1 hour in milliseconds
const FIVE_MINUTES_CACHE = 5 * 60 * 1000; // 5 minutes in milliseconds
const THIRTY_SECONDS_CACHE = 30 * 1000; // 30 seconds

// Define the query parameters type
interface FixtureQueryParams {
	date: string;
	timezone?: string; 
}

// Create a key for the query that includes timezone
export const createQueryKey = (date: string, timezone?: string) => {
	return ['fixtures-by-date', date, timezone || 'UTC'];
};

export const fixturesByDateQuery = (args: FixtureQueryParams) => {
	const queryDate = args.date;
	const timezone = args.timezone || 'UTC';
	
	// Include timezone in query key to avoid duplicate caching
	const queryKey = createQueryKey(queryDate, timezone);
	
	const queryFn = async (): Promise<FormattedCountry[]> => {
		console.log(`Executing query for ${queryDate} in ${timezone} timezone`);
		return getFixturesByDate({
			date: queryDate,
			timezone: timezone
		});
	};
	
	// Determine staleTime and cache duration based on date type
	let staleTime = FIVE_MINUTES_CACHE; // Default for most dates
	let refetchInterval = undefined;
	let cacheTime = 24 * 60 * 60 * 1000; // 24 hours default cache time
	let refetchOnMount = false; // Default to false to reduce automatic refetches
	let refetchOnWindowFocus = false;
	
	// Get today's date for comparison
	const requestDate = new Date(queryDate);
	const today = new Date();
	
	if (isSameDay(requestDate, today)) {
		// Today's matches use very short cache time to get frequent updates
		staleTime = FIFTEEN_SECONDS_CACHE; // Use 15 seconds
		refetchInterval = FIFTEEN_SECONDS_CACHE; // Also refetch every 15 seconds
		cacheTime = THIRTY_SECONDS_CACHE; // Very short cache time for today
		refetchOnMount = true; // Always refetch today's matches
		refetchOnWindowFocus = true; // Always refetch on focus for today's matches
	} else if (isBefore(requestDate, today)) {
		// Past matches don't change, so longer cache
		staleTime = ONE_DAY_CACHE; // 24 hours stale time
		cacheTime = 7 * ONE_DAY_CACHE; // 7 days cache time
		// Don't refetch past matches
		refetchOnMount = false;
		refetchOnWindowFocus = false;
	} else {
		// Future matches occasionally update (lineup changes, etc)
		staleTime = ONE_HOUR_CACHE; // 1 hour
		cacheTime = 3 * ONE_DAY_CACHE; // 3 days cache time
		// Only refetch on mount for future matches
		refetchOnMount = true;
		refetchOnWindowFocus = false;
	}
	
	return { 
		queryKey, 
		queryFn, 
		staleTime,
		refetchInterval,
		// Configure cache time (how long React Query keeps the data)
		gcTime: cacheTime,
		// Only refetch when necessary based on date type
		refetchOnMount,
		refetchOnWindowFocus
	};
};