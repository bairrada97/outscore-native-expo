import { format } from 'date-fns';
import { CacheProvider } from './provider.interface';
import { CacheConfig, CacheLocation, CacheResult, CacheStrategy } from './types';

// Cache service state (in-memory)
let lastUpdateTimestamp = 0;
let currentDateString = format(new Date(), 'yyyy-MM-dd');

// Force refresh interval (seconds)
const FORCE_REFRESH_INTERVAL = 15;

/**
 * Gets the appropriate cache key for the data
 */
export const getCacheKey = (
  prefix: CacheLocation, 
  resourceType: string, 
  date: string, 
  additionalTag?: string
): string => {
  const tag = additionalTag ? `-${additionalTag}` : '';
  return `${prefix}/${resourceType}-${date}${tag}.json`;
};

/**
 * Creates a cache service with the given provider
 */
export const createCacheService = <T>(provider: CacheProvider<T>) => {
  /**
   * Reset timestamp if date has changed
   */
  const checkTimestampReset = async (env: any): Promise<boolean> => {
    const now = new Date();
    const nowDateString = format(now, 'yyyy-MM-dd');
    
    // Check if we've crossed to a new day
    if (nowDateString !== currentDateString) {
      console.log(`📆 Date transition detected: ${currentDateString} → ${nowDateString}`);
      
      // Update the current date
      const previousDate = currentDateString;
      currentDateString = nowDateString;
      
      // Reset timestamps
      lastUpdateTimestamp = 0;
      
      // Handle date transitions (moved historical data, etc.)
      await handleDateTransition(previousDate, nowDateString, env);
      
      return true;
    }
    
    return false;
  };
  
  /**
   * Handle data migrations when date changes
   */
  const handleDateTransition = async (oldDate: string, newDate: string, env: any): Promise<void> => {
    try {
      console.log(`🔄 Handling date transition from ${oldDate} to ${newDate}`);
      
      // Calculate yesterday and tomorrow
      const yesterdayObj = new Date(newDate);
      yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1);
      const yesterdayStr = format(yesterdayObj, 'yyyy-MM-dd');
      
      const tomorrowObj = new Date(newDate);
      tomorrowObj.setUTCDate(tomorrowObj.getUTCDate() + 1);
      const tomorrowStr = format(tomorrowObj, 'yyyy-MM-dd');
      
      console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
      
      // Move previous day's data to historical if it exists
      const oldFixturesKey = getCacheKey(CacheLocation.TODAY, 'fixtures', oldDate);
      const oldExists = await provider.exists(oldFixturesKey);
      
      if (oldExists) {
        console.log(`📦 Moving previous day (${oldDate}) to historical folder`);
        const newKey = getCacheKey(CacheLocation.HISTORICAL, 'fixtures', oldDate);
        await provider.move(oldFixturesKey, newKey);
      }
      
      // Check if tomorrow's data exists and move it to today
      const tomorrowFixturesKey = getCacheKey(CacheLocation.FUTURE, 'fixtures', tomorrowStr);
      const tomorrowExists = await provider.exists(tomorrowFixturesKey);
      
      if (tomorrowExists) {
        console.log(`📦 Moving future data (${tomorrowStr}) to today folder`);
        const newTodayKey = getCacheKey(CacheLocation.TODAY, 'fixtures', tomorrowStr);
        await provider.move(tomorrowFixturesKey, newTodayKey);
      }
      
      console.log('✅ Date transition handling completed');
    } catch (err) {
      console.error('❌ Error during date transition:', err instanceof Error ? err.message : String(err));
    }
  };
  
  /**
   * Determines which cache location should be used for the given date
   */
  const getCacheLocation = (date: string): CacheLocation => {
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = format(utcNow, 'yyyy-MM-dd');
    
    if (date === today) {
      return CacheLocation.TODAY;
    }
    
    const targetDate = new Date(date);
    if (targetDate < utcNow) {
      return CacheLocation.HISTORICAL;
    }
    
    return CacheLocation.FUTURE;
  };
  
  /**
   * Determines the cache strategy based on date and resource
   */
  const getCacheStrategy = (
    date: string, 
    resourceType: string, 
    isLive: boolean
  ): { strategy: CacheStrategy; ttl: number } => {
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = format(utcNow, 'yyyy-MM-dd');
    
    // For live data, always use frequent refresh
    if (isLive) {
      return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: FORCE_REFRESH_INTERVAL };
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
      return { strategy: CacheStrategy.FREQUENT_REFRESH, ttl: FORCE_REFRESH_INTERVAL };
    }
    
    // For historical data, use long-term caching
    const targetDate = new Date(date);
    if (targetDate < utcNow) {
      return { strategy: CacheStrategy.LONG_TERM, ttl: 3600 }; // 1 hour
    }
    
    // For future data, use standard caching
    return { strategy: CacheStrategy.STANDARD, ttl: 3600 }; // 1 hour
  };
  
  /**
   * Store data in cache with appropriate strategy
   */
  const setCache = async (
    date: string,
    resourceType: string,
    data: T,
    env: any,
    isLive: boolean = false,
    forceUpdate: boolean = false
  ): Promise<boolean> => {
    // Update reset check
    await checkTimestampReset(env);
    
    const startTime = performance.now();
    console.log(`📝 Starting cache operation for ${isLive ? 'live ' : ''}${resourceType} on ${date}`);
    
    // Determine cache location and strategy
    const location = getCacheLocation(date);
    const { strategy, ttl } = getCacheStrategy(date, resourceType, isLive);
    
    // Create cache key
    const key = getCacheKey(location, resourceType, date, isLive ? 'live' : undefined);
    
    // Update timestamp for frequent refresh items
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      lastUpdateTimestamp = Date.now();
      console.log(`⏱️ Setting last update timestamp: ${new Date(lastUpdateTimestamp).toISOString()}`);
    }
    
    // Prepare metadata
    const metadata: Record<string, string> = {
      resourceType,
      date,
      location,
      strategy,
      isLive: isLive ? 'true' : 'false',
      forceUpdate: forceUpdate ? 'true' : 'false'
    };
    
    // Cache with config
    const config: CacheConfig = {
      ttl,
      metadata
    };
    
    const success = await provider.set(key, data, config);
    
    const duration = (performance.now() - startTime).toFixed(2);
    if (success) {
      console.log(`✅ Successfully cached ${resourceType} in ${duration}ms with TTL ${ttl}s`);
    } else {
      console.error(`❌ Failed to cache ${resourceType} after ${duration}ms`);
    }
    
    return success;
  };
  
  /**
   * Retrieve data from cache with appropriate strategy
   */
  const getCache = async <R>(
    date: string,
    resourceType: string,
    env: any,
    isLive: boolean = false
  ): Promise<CacheResult<R>> => {
    // Update reset check
    await checkTimestampReset(env);
    
    const startTime = performance.now();
    console.log(`🔍 Retrieving ${isLive ? 'live ' : ''}${resourceType} for ${date}`);
    
    // Determine cache location and strategy
    const location = getCacheLocation(date);
    const { strategy, ttl } = getCacheStrategy(date, resourceType, isLive);
    
    // Create cache key
    const key = getCacheKey(location, resourceType, date, isLive ? 'live' : undefined);
    
    // For frequent refresh, check if we need to force refresh
    if (strategy === CacheStrategy.FREQUENT_REFRESH) {
      const currentTime = Date.now();
      const timeSinceLastUpdate = currentTime - lastUpdateTimestamp;
      console.log(`⏱️ Time since last update: ${Math.floor(timeSinceLastUpdate / 1000)}s`);
      
      // Force API refresh if:
      // 1. We've never updated (lastUpdateTimestamp is 0)
      // 2. It's been more than FORCE_REFRESH_INTERVAL since last update
      const forceRefresh = (lastUpdateTimestamp === 0) || 
                  (timeSinceLastUpdate > FORCE_REFRESH_INTERVAL * 1000);
      
      if (forceRefresh) {
        if (lastUpdateTimestamp === 0) {
          console.log(`⚠️ FORCING REFRESH: No previous update detected`);
        } else {
          console.log(`⚠️ FORCING REFRESH: It's been more than ${FORCE_REFRESH_INTERVAL}s since last update`);
        }
        return { data: null, source: 'None', forceRefresh: true };
      }
    }
    
    // Get from cache
    const result = await provider.get(key);
    const duration = (performance.now() - startTime).toFixed(2);
    
    if (result.data) {
      console.log(`✅ Successfully retrieved ${resourceType} from cache in ${duration}ms`);
      return { 
        data: result.data as unknown as R, 
        source: 'Cache',
        meta: result.meta || undefined
      };
    }
    
    console.log(`❓ No cached data found for ${resourceType} on ${date} (${duration}ms)`);
    return { data: null, source: 'None' };
  };
  
  return {
    setCache,
    getCache,
    getCacheKey,
    getCacheLocation,
    getCacheStrategy,
    checkTimestampReset,
    handleDateTransition
  };
};