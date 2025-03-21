import { format } from 'date-fns';
import { Fixture } from '@outscore/shared-types';
import { isToday, isPast, TODAY_UPDATE_INTERVAL } from './utils';

// Keys for different storage types
export const getR2Key = (date: string, live?: boolean): string => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const isPastDate = isPast(date);
  const prefix = isPastDate ? 'historical' : (isToday(date) ? 'today' : 'future');
  return `${prefix}/fixtures-${date}${live ? '-live' : ''}.json`;
};

// Check if data exists in a specific folder
export const checkIfDataExists = async (date: string, env: any, folder: 'today' | 'historical' | 'future' = 'today'): Promise<boolean> => {
  try {
    const key = `${folder}/fixtures-${date}.json`;
    const data = await env.FOOTBALL_CACHE.get(key);
    return data !== null;
  } catch (err) {
    console.error(`❌ Error checking if data exists for ${date} in ${folder}:`, 
      err instanceof Error ? err.message : String(err));
    return false;
  }
};
 
// Migrate fixtures from today to historical
export const migrateFixturesToHistorical = async (date: string, env: any): Promise<void> => {
  try {
    const sourceKey = `today/fixtures-${date}.json`;
    const targetKey = `historical/fixtures-${date}.json`;
    
    // Get data from source
    const data = await env.FOOTBALL_CACHE.get(sourceKey);
    if (!data) {
      console.log(`⚠️ No data found for ${sourceKey}, skipping migration`);
      return;
    }
    
    // Put data to target
    await env.FOOTBALL_CACHE.put(targetKey, data);
    console.log(`✅ Migrated ${sourceKey} to ${targetKey}`);
    
    // Delete source
    await env.FOOTBALL_CACHE.delete(sourceKey);
    console.log(`🗑️ Deleted ${sourceKey} after migration`);
  } catch (err) {
    console.error('❌ Error migrating fixtures to historical:', 
      err instanceof Error ? err.message : String(err));
  }
};

// Migrate fixtures from future to today
export const migrateFixturesToToday = async (date: string, env: any): Promise<void> => {
  try {
    const sourceKey = `future/fixtures-${date}.json`;
    const targetKey = `today/fixtures-${date}.json`;
    
    // Get data from source
    const data = await env.FOOTBALL_CACHE.get(sourceKey);
    if (!data) {
      console.log(`⚠️ No data found for ${sourceKey}, skipping migration`);
      return;
    }
    
    // Put data to target
    await env.FOOTBALL_CACHE.put(targetKey, data);
    console.log(`✅ Migrated ${sourceKey} to ${targetKey}`);
    
    // Delete source
    await env.FOOTBALL_CACHE.delete(sourceKey);
    console.log(`🗑️ Deleted ${sourceKey} after migration`);
  } catch (err) {
    console.error('❌ Error migrating fixtures to today:', 
      err instanceof Error ? err.message : String(err));
  }
};

// Cache fixtures in R2 storage
export const cacheFixturesInR2 = async (
  date: string,
  fixtures: Fixture[],
  env: any,
  isLive: boolean,
  isTodayData: boolean,
  isDateInThreeDayWindow: boolean,
  ttl: number,
  updateTimestamp: boolean = false
): Promise<boolean> => {
  try {
    // Prepare the data
    const jsonData = JSON.stringify(fixtures);
    const dataSize = new TextEncoder().encode(jsonData).length;
    console.log(`📊 Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB, ${fixtures.length} fixtures`);
    
    const r2Key = getR2Key(date, isLive);
    console.log(`💾 Storing in R2 with key: ${r2Key}`);
    
    // Store fixtures in R2 with metadata
    const metadata = {
      contentType: 'application/json',
      customMetadata: {
        updatedAt: new Date().toISOString(),
        ttl: ttl.toString(),
        isToday: isTodayData ? 'true' : 'false',
        isLive: isLive ? 'true' : 'false',
        fixturesCount: fixtures.length.toString(),
        inThreeDayWindow: isDateInThreeDayWindow ? 'true' : 'false'
      }
    };
    
    await env.FOOTBALL_CACHE.put(r2Key, jsonData, { httpMetadata: metadata });
    console.log(`✅ Successfully stored in R2 at ${new Date().toISOString()}`);
    return true;
  } catch (r2Error) {
    console.error(`❌ Error storing in R2:`, r2Error);
    return false;
  }
}; 