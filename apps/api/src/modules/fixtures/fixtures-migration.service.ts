import { redis } from '../../pkg/util/redis';
import { format, subDays } from 'date-fns';
import { Fixture } from '../../pkg/types/football-api';
import { db, FIXTURES_TABLE } from '@outscore/db';

const CACHE_PREFIX = 'fixtures';

const getCacheKey = (date: string): string => {
  return `${CACHE_PREFIX}:${date}`; 
};

/**
 * Migrates fixtures from Redis to Supabase when they become historical
 * This should be called daily to migrate yesterday's matches
 */
export const migrateHistoricalFixtures = async () => {
  try {
    // Get yesterday's date
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const cacheKey = getCacheKey(yesterday);

    // Check if fixtures exist in Redis
    const cachedFixtures = await redis.get<string>(cacheKey);
    if (!cachedFixtures) {
      console.log('No fixtures found in Redis for:', yesterday);
      return;
    }

    const fixturesData = JSON.parse(cachedFixtures) as Fixture[];

    // Check if these fixtures are already in Supabase
    const { data: existingFixtures } = await db
      .from(FIXTURES_TABLE)
      .select('id')
      .eq('date', yesterday);

    if (existingFixtures && existingFixtures.length > 0) {
      console.log('Fixtures already exist in Supabase for:', yesterday);
      return;
    }

    // Transform fixtures for Supabase storage
    const fixturesForDb = fixturesData.map(fixture => ({
      id: fixture.fixture.id,
      date: yesterday,
      timezone: fixture.fixture.timezone,
      raw_data: fixture,
    }));

    // Insert into Supabase
    const { error } = await db
      .from(FIXTURES_TABLE)
      .insert(fixturesForDb);

    if (error) {
      throw error;
    }

    // Remove from Redis after successful migration
    await redis.del(cacheKey);

    console.log('Successfully migrated fixtures for:', yesterday);
  } catch (error) {
    console.error('Error migrating historical fixtures:', error);
    throw error;
  }
}; 