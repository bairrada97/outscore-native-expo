import { format } from 'date-fns';
import { Fixture, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtures } from '../../pkg/util/football-api';
import { formatFixtures } from './utils';
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
  }): Promise<{ data: FormattedFixturesResponse; source: string }> {
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
      
      return {
        data: formatFixtures(fixtures, timezone),
        source
      };
    }

    // Important: For regular fixtures, ensure we're handling the date properly
    
    // Preserve user's requested date exactly as specified (or get today's UTC date if not provided)
    const requestedDate = normalizeToUtcDate(date);
    
    // Get current UTC date for internal reference only (don't change the requested date)
    const currentUtcDate = normalizeToUtcDate();
    
    console.log(`📆 Request for fixtures: requested date=${requestedDate}, current UTC date=${currentUtcDate}, difference=${requestedDate > currentUtcDate ? 'future' : (requestedDate < currentUtcDate ? 'past' : 'today')}`);
    
    let source = 'API';
    let fixtures: Fixture[];
    
    // Directly get the correct cache location based on UTC time
    let cacheLocationOverride: 'today' | 'historical' | 'future';
    
    if (requestedDate > currentUtcDate) {
      cacheLocationOverride = 'future';
      console.log(`🚨 [ROOT FIX] Using future location for ${requestedDate} as it's after UTC today (${currentUtcDate})`);
    } else if (requestedDate < currentUtcDate) {
      cacheLocationOverride = 'historical';
      console.log(`🚨 [ROOT FIX] Using historical location for ${requestedDate} as it's before UTC today (${currentUtcDate})`);
    } else {
      cacheLocationOverride = 'today';
      console.log(`🚨 [ROOT FIX] Using today location for ${requestedDate} as it matches UTC today (${currentUtcDate})`);
    }
    
    // Get fixtures for specific date
    const { fixtures: cachedFixtures, source: storageSource, forceRefresh } = await getFixturesFromStorage({
      date: requestedDate, // Use normalized date for consistent R2 bucket access
      env,
      live: false,
      locationOverride: cacheLocationOverride // Pass explicit location
    });
    
    if (cachedFixtures && !forceRefresh) {
      source = storageSource;
      fixtures = cachedFixtures;
      console.log(`✅ Using ${fixtures.length} fixtures from ${source}`);
    } else {
      // Fetch from API and cache
      console.log('🌐 Fetching fixtures directly from API...');
      const response = await getFootballApiFixtures(
        requestedDate, // Use normalized date for consistent API calls
        undefined, 
        env.FOOTBALL_API_URL, 
        env.RAPIDAPI_KEY
      );
      fixtures = response.response;
      source = 'API';
      console.log(`✅ Received ${fixtures.length} fixtures from API`);
      
      // Cache the fixtures with forced R2 update for today's data
      console.log('💾 Caching fixtures...');
      const isUtcToday = requestedDate === currentUtcDate;
      
      // Pass explicit location override
      await cacheFixtures({
        date: requestedDate, // Use normalized date for consistent R2 bucket access
        fixtures,
        env,
        ctx,
        live: false,
        forceUpdate: isUtcToday,
        locationOverride: cacheLocationOverride
      });
    }
    
    return {
      data: formatFixtures(fixtures, timezone),
      source
    };
  }
};