import { Fixture } from '@outscore/shared-types';
import { createR2CacheProvider, createCacheService } from '../cache';

// Store fixtures in cache
export const cacheFixtures = async (
  date: string, 
  fixtures: Fixture[], 
  env: any, 
  ctx: any, 
  live?: boolean,
  forceUpdate = false,
  providedCacheService?: ReturnType<typeof createCacheService>
): Promise<void> => {
  // Use provided cache service or create a new one
  const cacheService = providedCacheService || createCacheService(createR2CacheProvider(env.FOOTBALL_CACHE));
  
  console.log(`📝 Starting cache operation for ${live ? 'live matches' : 'all matches'} on ${date}`);
  
  // Normalize live flag
  const isLive = !!live;
  
  try {
    // Cache using our service
    await cacheService.setCache(
      date,
      'fixtures',
      fixtures,
      env,
      isLive,
      forceUpdate
    );
    
    console.log(`✅ Successfully cached ${fixtures.length} fixtures`);
    
  } catch (error) {
    console.error(`❌ Error during caching:`, error);
    throw error;
  }
};

// Get fixtures from storage using the cache service
export const getFixturesFromStorage = async (
  date: string, 
  env: any,
  live?: boolean,
  providedCacheService?: ReturnType<typeof createCacheService>
): Promise<{ fixtures: Fixture[] | null; source: string; forceRefresh?: boolean }> => {
  // Use provided cache service or create a new one
  const cacheService = providedCacheService || createCacheService(createR2CacheProvider(env.FOOTBALL_CACHE));
  
  console.log(`🔍 Retrieving fixtures for ${date}${live ? ' (live)' : ''}`);
  
  // Get data from cache
  const result = await cacheService.getCache<Fixture[]>(
    date,
    'fixtures',
    env,
    !!live
  );
  
  // Return results
  return {
    fixtures: result.data,
    source: result.source === 'Cache' ? 'R2' : result.source,
    forceRefresh: result.forceRefresh
  };
};

