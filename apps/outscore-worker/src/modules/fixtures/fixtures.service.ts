import { format } from 'date-fns';
import { Fixture, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtures } from '../../pkg/util/football-api';
import { formatFixtures, filterFixturesByTimezone } from './utils';
import { getFixturesFromStorage, cacheFixtures } from './cache.service';
import { createR2CacheProvider } from '../cache';
import { getUtcDateInfo } from './date.utils';

/**
 * If no date is provided, returns the current UTC date
 * Otherwise, returns the original date string without modification
 * This ensures we respect the user's requested date
 */
const normalizeToUtcDate = (dateStr?: string): string => {
  if (!dateStr) {
    // Get current UTC date if no date provided
    const now = new Date();
    // Create a UTC date with time set to 00:00:00
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return format(utcNow, 'yyyy-MM-dd');
  }
  
  // If a date string is provided, use it directly without any conversion
  // This preserves the user's requested date exactly as specified
  return dateStr.trim();
};

/**
 * Fixtures Service
 * Main entry point for retrieving and managing football fixtures
 */
export const fixturesService = {
  async getFixtures({ 
    date, 
    timezone = "UTC",
    live,
    env,
    ctx
  }: { 
    date?: string; 
    timezone: string;
    live?: 'all';
    env: any;
    ctx: any;
  }): Promise<{ data: FormattedFixturesResponse; source: string; originalMatchCount: number }> {
    if (live === 'all') {
      let source = 'API';
      let fixtures: Fixture[];
      
      // Get current UTC date for internal tracking, but use requested date for API
      const utcDate = normalizeToUtcDate();
      const currentUtcDateInfo = getUtcDateInfo({ date: utcDate });
      
      // CRITICAL: Always use 'today' location for live fixtures
      const liveLocationOverride = 'today';
      console.log(`🚨 [LIVE FIX] Always using today location for live fixtures regardless of date`);
      
      // Get live fixtures - use utcToday for caching location
      const { fixtures: cached, source: cacheSource, forceRefresh } = await getFixturesFromStorage({
        date: currentUtcDateInfo.utcToday, // Always use current UTC date for live fixtures
        env,
        live: true,
        locationOverride: liveLocationOverride
      });
      
      if (cached && !forceRefresh) {
        source = cacheSource;
        fixtures = cached;
        console.log(`✅ Using ${fixtures.length} live matches from ${source}`);
      } else {
        // Fetch from API and cache
        console.log('🌐 Fetching live fixtures directly from API...');
        const response = await getFootballApiFixtures(
          utcDate, // For live fixtures, we use the current UTC date for the API
          'live', 
          env.FOOTBALL_API_URL, 
          env.RAPIDAPI_KEY
        );
        fixtures = response.response;
        source = 'API';
        console.log(`✅ Received ${fixtures.length} live matches from API`);
        
        // Cache the fixtures
        console.log('💾 Caching live fixtures...');
        await cacheFixtures({
          date: currentUtcDateInfo.utcToday, // FIXED: Use current UTC date not user-provided date
          fixtures,
          env,
          ctx,
          live: true,
          forceUpdate: true,
          locationOverride: liveLocationOverride
        });
      }
      
      // Save original count before filtering
      const originalMatchCount = fixtures.length;
      
      // Apply timezone filtering if not UTC
      if (timezone !== 'UTC') {
        // For live fixtures, use the current UTC date for filtering
        fixtures = filterFixturesByTimezone(fixtures, utcDate, timezone);
      }
      
      return {
        data: formatFixtures(fixtures, timezone),
        source,
        originalMatchCount
      };
    }

    // Important: For regular fixtures, ensure we're handling the date properly
    
    // Preserve user's requested date exactly as specified (or get today's UTC date if not provided)
    const requestedDate = normalizeToUtcDate(date);
    
    // Get current UTC date for internal reference only (don't change the requested date)
    const currentUtcDate = normalizeToUtcDate();
    
    console.log(`📆 Request for fixtures: requested date=${requestedDate}, current UTC date=${currentUtcDate}, difference=${requestedDate > currentUtcDate ? 'future' : (requestedDate < currentUtcDate ? 'past' : 'today')}`);
    
    // For non-UTC timezones, we may need to fetch adjacent dates to ensure we get all matches
    // that fall on the requested date in the user's timezone
    const needsAdjacentDates = timezone !== 'UTC';
    let allFixtures: Fixture[] = [];
    let primarySource = 'API';
    
    // Helper function to get the day before or after a date
    const getAdjacentDate = (date: string, offsetDays: number): string => {
      const dateObj = new Date(date);
      dateObj.setDate(dateObj.getDate() + offsetDays);
      return format(dateObj, 'yyyy-MM-dd');
    };
    
    // Dates to fetch - for UTC we only need the requested date,
    // for other timezones we need to fetch adjacent dates as well
    const datesToFetch = needsAdjacentDates 
      ? [
          getAdjacentDate(requestedDate, -1), // Day before
          requestedDate,                      // Requested date
          getAdjacentDate(requestedDate, 1)   // Day after
        ]
      : [requestedDate];
    
    console.log(`🗓️ Will fetch fixtures for these UTC dates: ${datesToFetch.join(', ')}`);
    
    // Fetch fixtures for each date
    for (const fetchDate of datesToFetch) {
      // Determine cache location based on relation to current UTC date
      let cacheLocationOverride: 'today' | 'historical' | 'future';
      
      if (fetchDate > currentUtcDate) {
        cacheLocationOverride = 'future';
      } else if (fetchDate < currentUtcDate) {
        cacheLocationOverride = 'historical';
      } else {
        cacheLocationOverride = 'today';
      }
      
      console.log(`🔍 Fetching fixtures for UTC date ${fetchDate} (${cacheLocationOverride})`);
      
      // Get fixtures for this date
      const { fixtures: dateFixtures, source: dateSource, forceRefresh } = await getFixturesFromStorage({
        date: fetchDate,
        env,
        live: false,
        locationOverride: cacheLocationOverride
      });
      
      if (dateFixtures && !forceRefresh) {
        // If the main date's source is API but an adjacent date comes from cache,
        // we still consider the overall source as API for consistency
        if (fetchDate === requestedDate) {
          primarySource = dateSource;
        }
        allFixtures = [...allFixtures, ...dateFixtures];
        console.log(`✅ Added ${dateFixtures.length} fixtures from ${dateSource} for date ${fetchDate}`);
      } else {
        // Fetch from API and cache
        console.log(`🌐 Fetching fixtures for ${fetchDate} directly from API...`);
        const response = await getFootballApiFixtures(
          fetchDate,
          undefined, 
          env.FOOTBALL_API_URL, 
          env.RAPIDAPI_KEY
        );
        
        const apiFixtures = response.response;
        if (fetchDate === requestedDate) {
          primarySource = 'API';
        }
        
        allFixtures = [...allFixtures, ...apiFixtures];
        console.log(`✅ Added ${apiFixtures.length} fixtures from API for date ${fetchDate}`);
        
        // Cache the fixtures
        console.log(`💾 Caching fixtures for ${fetchDate}...`);
        const isUtcToday = fetchDate === currentUtcDate;
        
        await cacheFixtures({
          date: fetchDate,
          fixtures: apiFixtures,
          env,
          ctx,
          live: false,
          forceUpdate: isUtcToday,
          locationOverride: cacheLocationOverride
        });
      }
    }
    
    // Save original count before filtering
    const originalMatchCount = allFixtures.length;
    console.log(`📊 Total fixtures across all fetched dates: ${originalMatchCount}`);
    
    // Now filter to only show fixtures that occur on the requested date in the user's timezone
    if (timezone !== 'UTC') {
      console.log(`🌐 Applying timezone-specific filtering for ${timezone}`);
      allFixtures = filterFixturesByTimezone(allFixtures, requestedDate, timezone);
    }
    
    return {
      data: formatFixtures(allFixtures, timezone),
      source: primarySource,
      originalMatchCount
    };
  }
};