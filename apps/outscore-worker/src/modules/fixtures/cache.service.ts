import { format } from 'date-fns';
import { Fixture } from '@outscore/shared-types';
import { createR2CacheProvider, TTL } from '../cache';
import { CacheConfig, CacheResult, CacheStrategy, StrategyResult } from '../cache/types';
import { CacheProvider} from '../cache/provider.interface';

// In-memory state for tracking updates (fixtures-specific)
let lastUpdateTimestamp = 0;
let currentDateString = format(new Date(), 'yyyy-MM-dd');

// Fixture-specific cache location prefixes 
export enum FixturesCacheLocation {
  TODAY = 'today',
  HISTORICAL = 'historical',
  FUTURE = 'future'
}

/**
 * Gets the appropriate cache key for fixtures data
 */
export const getFixturesCacheKey = ({
  prefix,
  date,
  isLive = false
}: {
  prefix: FixturesCacheLocation;
  date: string;
  isLive?: boolean;
}): string => {
  const tag = isLive ? '-live' : '';
  return `${prefix}/fixtures-${date}${tag}.json`;
};

/**
 * Determines which fixture-specific cache location should be used for the given date
 */
export const getFixturesCacheLocation = (date: string): FixturesCacheLocation => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = format(utcNow, 'yyyy-MM-dd');
  
  if (date === today) {
    return FixturesCacheLocation.TODAY;
  }
  
  const targetDate = new Date(date);
  if (targetDate < utcNow) {
    return FixturesCacheLocation.HISTORICAL;
  }
  
  return FixturesCacheLocation.FUTURE;
};

/**
 * Handle fixtures data migrations when date changes
 */
export const handleFixturesDateTransition = async <T>({
  oldDate,
  newDate,
  env,
  provider
}: {
  oldDate: string;
  newDate: string;
  env: any;
  provider: CacheProvider<T>;
}): Promise<void> => {
  try {
    console.log(`🔄 Handling fixtures date transition from ${oldDate} to ${newDate}`);
    
    // Calculate yesterday and tomorrow
    const yesterdayObj = new Date(newDate);
    yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1);
    const yesterdayStr = format(yesterdayObj, 'yyyy-MM-dd');
    
    const tomorrowObj = new Date(newDate);
    tomorrowObj.setUTCDate(tomorrowObj.getUTCDate() + 1);
    const tomorrowStr = format(tomorrowObj, 'yyyy-MM-dd');
    
    console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
    
    // Move previous day's data to historical if it exists
    const oldFixturesKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.TODAY, date: oldDate });
    const oldExists = await provider.exists(oldFixturesKey);
    
    if (oldExists) {
      console.log(`📦 Moving previous day (${oldDate}) to historical folder`);
      const newKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.HISTORICAL, date: oldDate });
      await provider.move(oldFixturesKey, newKey);
    }
    
    // Check if tomorrow's data exists and move it to today
    const tomorrowFixturesKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.FUTURE, date: tomorrowStr });
    const tomorrowExists = await provider.exists(tomorrowFixturesKey);
    
    if (tomorrowExists) {
      console.log(`📦 Moving future data (${tomorrowStr}) to today folder`);
      const newTodayKey = getFixturesCacheKey({ prefix: FixturesCacheLocation.TODAY, date: tomorrowStr });
      await provider.move(tomorrowFixturesKey, newTodayKey);
    }
    
    console.log('✅ Fixtures date transition handling completed');
  } catch (err) {
    console.error('❌ Error during fixtures date transition:', err instanceof Error ? err.message : String(err));
  }
};

/**
 * Fixture-specific cache strategy that decides caching behavior
 * based on date proximity and live status
 */
export const getFixturesCacheStrategy = ({
  date,
  isLive
}: {
  date: string;
  isLive: boolean;
}): StrategyResult => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = format(utcNow, 'yyyy-MM-dd');
  
  // For live data, always use frequent refresh
  if (isLive) {
    return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: TTL.SHORT };
  }
  
  // Calculate yesterday and tomorrow in UTC
  const utcYesterday = new Date(utcNow);
  utcYesterday.setDate(utcNow.getDate() - 1);
  const yesterdayStr = format(utcYesterday, 'yyyy-MM-dd');
  
  const utcTomorrow = new Date(utcNow);
  utcTomorrow.setDate(utcNow.getDate() + 1);
  const tomorrowStr = format(utcTomorrow, 'yyyy-MM-dd');
  
  // For today, yesterday, and tomorrow, use frequent refresh
  if (date === today || date === yesterdayStr || date === tomorrowStr) {
    return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: TTL.SHORT };
  }
  
  // For historical data, use long-term caching
  const targetDate = new Date(date);
  if (targetDate < utcNow) {
    return { strategy: CacheStrategy.LONG_TERM, ttl: TTL.STANDARD };
  }
  
  // For future data, use standard caching
  return { strategy: CacheStrategy.STANDARD, ttl: TTL.STANDARD };
};

/**
 * Check if the date has changed and handle transition if needed
 */
export const checkDateTransition = async ({
  env,
  provider
}: {
  env: any;
  provider: CacheProvider<any>;
}): Promise<void> => {
  const now = new Date();
  const nowDateString = format(now, 'yyyy-MM-dd');
  
  if (nowDateString !== currentDateString) {
    console.log(`📆 Date transition detected from ${currentDateString || 'initial'} to ${nowDateString}`);
    // Trigger date transition handling
    if (currentDateString) {
      try {
        // Use date transition handler from date utilities
        await handleFixturesDateTransition({ oldDate: currentDateString, newDate: nowDateString, env, provider });
      } catch (err) {
        console.error('❌ Error during fixtures date transition:', err);
      }
    }
    
    // Update current date
    currentDateString = nowDateString;
  }
};

/**
 * Cache fixtures for a specific date
 */
export const cacheFixtures = async ({
  date,
  fixtures,
  env,
  ctx,
  live = false,
  forceUpdate = false
}: {
  date: string;
  fixtures: Fixture[];
  env: any;
  ctx: any;
  live?: boolean;
  forceUpdate?: boolean;
}): Promise<boolean> => {
  // Create the cache provider
  const provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  
  // Normalize live flag
  const isLive = !!live;
  
  // Check for date transition
  await checkDateTransition({ env, provider });
  
  // Get the appropriate cache location prefix for this date
  const cacheLocation = getFixturesCacheLocation(date);
  
  // Get strategy and TTL
  const { strategy, ttl } = getFixturesCacheStrategy({ date, isLive });
  
  const startTime = performance.now();
  console.log(`📝 Starting fixtures cache operation for ${isLive ? 'live ' : ''}matches on ${date}`);
  
  try {
    // Create cache key
    const key = getFixturesCacheKey({ prefix: cacheLocation, date, isLive });
    
    // Update timestamp for frequent refresh items
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      lastUpdateTimestamp = Date.now();
      console.log(`⏱️ Setting last update timestamp: ${new Date(lastUpdateTimestamp).toISOString()}`);
    }
    
    // Prepare metadata
    const metadata: Record<string, string> = {
      date,
      location: cacheLocation,
      strategy,
      isLive: isLive ? 'true' : 'false',
      forceUpdate: forceUpdate ? 'true' : 'false'
    };
    
    // Cache with config
    const config: CacheConfig = {
      ttl,
      metadata
    };
    
    const success = await provider.set(key, fixtures, config);
    
    const duration = (performance.now() - startTime).toFixed(2);
    if (success) {
      console.log(`✅ Successfully cached ${fixtures.length} fixtures in ${duration}ms with TTL ${ttl}s`);
    } else {
      console.error(`❌ Failed to cache fixtures after ${duration}ms`);
    }
    
    return success;
  } catch (error) {
    console.error(`❌ Error during fixtures caching:`, error);
    throw error;
  }
};

// Get fixtures from storage
export const getFixturesFromStorage = async ({
  date,
  env,
  live = false
}: {
  date: string;
  env: any;
  live?: boolean;
}): Promise<{ fixtures: Fixture[] | null; source: string; forceRefresh?: boolean }> => {
  // Create the cache provider
  const provider = createR2CacheProvider(env.FOOTBALL_CACHE);
  
  // Normalize live flag
  const isLive = !!live;
  
  // Check for date transition
  await checkDateTransition({ env, provider });
  
  // Get the appropriate cache location prefix for this date
  const cacheLocation = getFixturesCacheLocation(date);
  
  // Get strategy and TTL
  const { strategy, ttl } = getFixturesCacheStrategy({ date, isLive });
  
  const startTime = performance.now();
  console.log(`🔍 Retrieving fixtures for ${date}${isLive ? ' (live)' : ''}`);
  
  try {
    // Create cache key
    const key = getFixturesCacheKey({ prefix: cacheLocation, date, isLive });
    
    // For frequent refresh, check if we need to force refresh
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTimestamp;
      console.log(`⏱️ Time since last update: ${Math.floor(timeSinceLastUpdate / 1000)}s`);
      
      // Force API refresh if:
      // 1. We've never updated (lastUpdateTimestamp is 0)
      // 2. It's been more than the TTL since last update
      const forceRefresh = (lastUpdateTimestamp === 0) || 
                  (timeSinceLastUpdate > ttl * 1000);
      
      if (forceRefresh) {
        if (lastUpdateTimestamp === 0) {
          console.log(`⚠️ FORCING REFRESH: No previous update detected`);
        } else {
          console.log(`⚠️ FORCING REFRESH: It's been more than ${ttl}s since last update`);
        }
        return { fixtures: null, source: 'None', forceRefresh: true };
      }
    }
    
    // Get from cache
    const result = await provider.get(key);
    const duration = (performance.now() - startTime).toFixed(2);
    
    if (result.data) {
      console.log(`✅ Successfully retrieved fixtures from cache in ${duration}ms`);
      return { 
        fixtures: result.data as unknown as Fixture[], 
        source: 'R2',
        forceRefresh: false
      };
    }
    
    console.log(`❓ No cached fixtures found for ${date} (${duration}ms)`);
    return { fixtures: null, source: 'None', forceRefresh: false };
  } catch (error) {
    console.error(`❌ Error retrieving fixtures:`, error);
    return { fixtures: null, source: 'Error', forceRefresh: true };
  }
};