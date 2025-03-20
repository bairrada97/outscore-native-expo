import { format, differenceInDays } from 'date-fns';
import { Fixture, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtures } from '../../pkg/util/football-api';
import {
  TODAY_UPDATE_INTERVAL,
  FUTURE_TTL,
  isToday,
  isFuture,
  isPast,
  formatFixtures,
} from './utils';

// Keys for different storage types
const getR2Key = (date: string, live?: boolean): string => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const isPastDate = isPast(date);
  const prefix = isPastDate ? 'historical' : (isToday(date) ? 'today' : 'future');
  return `${prefix}/fixtures-${date}${live ? '-live' : ''}.json`;
};

// Track last update time for today's data to prevent excessive API calls
let lastTodayUpdateTimestamp = 0;
let lastR2UpdateTimestamp = 0; // Separate tracking for R2 updates

// Reset update time when the worker has been idle
let lastAccessTime = 0;
const MAX_IDLE_TIME = 60000; // 60 seconds max idle time

// Store the current date to detect day changes
let currentDateString = format(new Date(), 'yyyy-MM-dd');

// Store environment reference for migrations
let envRef: any = null;

// Force refresh data from API every N seconds for today's data
const FORCE_REFRESH_INTERVAL = 15; // 15 seconds forced refresh

// Store environment reference
function storeEnvReference(env: any) {
  if (env && env.MATCH_DATA) {
    envRef = env;
  }
}

// Handle date transitions
const handleDateTransition = async (oldDate: string, newDate: string) => {
  try {
    console.log(`🔄 Handling date transition from ${oldDate} to ${newDate}`);
    
    if (!envRef) {
      console.error('❌ Environment reference not available for migration');
      return;
    }
    
    // Calculate yesterday and tomorrow
    const oldDateObj = new Date(oldDate);
    const newDateObj = new Date(newDate);
    
    const yesterdayObj = new Date(newDateObj);
    yesterdayObj.setUTCDate(newDateObj.getUTCDate() - 1);
    const yesterdayStr = format(yesterdayObj, 'yyyy-MM-dd');
    
    const tomorrowObj = new Date(newDateObj);
    tomorrowObj.setUTCDate(newDateObj.getUTCDate() + 1);
    const tomorrowStr = format(tomorrowObj, 'yyyy-MM-dd');
    
    console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
    
    // Perform necessary migrations based on the date change
    // 1. Move previous day's data to historical if it exists
    const oldDataExists = await checkIfDataExists(oldDate, envRef);
    if (oldDataExists) {
      console.log(`📦 Moving previous day (${oldDate}) to historical folder`);
      await migrateFixturesToHistorical(oldDate, envRef);
    }
    
    // 2. Check if tomorrow's data exists and move it to today
    const tomorrowDataExists = await checkIfDataExists(tomorrowStr, envRef, 'future');
    if (tomorrowDataExists) {
      console.log(`📦 Moving future data (${tomorrowStr}) to today folder`);
      await migrateFixturesToToday(tomorrowStr, envRef);
    }
    
    console.log('✅ Date transition handling completed');
  } catch (err) {
    console.error('❌ Error during date transition:', err instanceof Error ? err.message : String(err));
  }
};

// Check if data exists in a specific folder
const checkIfDataExists = async (date: string, env: any, folder: 'today' | 'historical' | 'future' = 'today'): Promise<boolean> => {
  try {
    const key = `${folder}/${date}.json`;
    const data = await env.FIXTURES_BUCKET.get(key);
    return data !== null;
  } catch (err) {
    console.error(`❌ Error checking if data exists for ${date} in ${folder}:`, 
      err instanceof Error ? err.message : String(err));
    return false;
  }
};

// Migrate fixtures from today to historical
const migrateFixturesToHistorical = async (date: string, env: any): Promise<void> => {
  try {
    const sourceKey = `today/${date}.json`;
    const targetKey = `historical/${date}.json`;
    
    // Get data from source
    const data = await env.FIXTURES_BUCKET.get(sourceKey);
    if (!data) {
      console.log(`⚠️ No data found for ${sourceKey}, skipping migration`);
      return;
    }
    
    // Put data to target
    await env.FIXTURES_BUCKET.put(targetKey, data);
    console.log(`✅ Migrated ${sourceKey} to ${targetKey}`);
    
    // Delete source
    await env.FIXTURES_BUCKET.delete(sourceKey);
    console.log(`🗑️ Deleted ${sourceKey} after migration`);
  } catch (err) {
    console.error('❌ Error migrating fixtures to historical:', 
      err instanceof Error ? err.message : String(err));
  }
};

// Migrate fixtures from future to today
const migrateFixturesToToday = async (date: string, env: any): Promise<void> => {
  try {
    const sourceKey = `future/${date}.json`;
    const targetKey = `today/${date}.json`;
    
    // Get data from source
    const data = await env.FIXTURES_BUCKET.get(sourceKey);
    if (!data) {
      console.log(`⚠️ No data found for ${sourceKey}, skipping migration`);
      return;
    }
    
    // Put data to target
    await env.FIXTURES_BUCKET.put(targetKey, data);
    console.log(`✅ Migrated ${sourceKey} to ${targetKey}`);
    
    // Delete source
    await env.FIXTURES_BUCKET.delete(sourceKey);
    console.log(`🗑️ Deleted ${sourceKey} after migration`);
  } catch (err) {
    console.error('❌ Error migrating fixtures to today:', 
      err instanceof Error ? err.message : String(err));
  }
};

// Function to check if we've crossed to a new day
const checkTimestampReset = () => {
  const now = new Date();
  const nowDateString = format(now, 'yyyy-MM-dd');
  
  // Check if we've crossed to a new day
  if (nowDateString !== currentDateString) {
    console.log(`📆 Date transition detected: ${currentDateString} → ${nowDateString}`);
    
    // Update the current date
    const previousDate = currentDateString;
    currentDateString = nowDateString;
    
    // Force data refresh due to date change
    lastTodayUpdateTimestamp = 0;
    lastR2UpdateTimestamp = 0;
    
    // Handle the date transition immediately (but don't block)
    handleDateTransition(previousDate, nowDateString);
  }
};

// Check if a date is today in UTC
function isDateToday(dateStr: string): boolean {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcToday = format(utcNow, 'yyyy-MM-dd');
  return dateStr === utcToday;
}

const cacheFixtures = async (
  date: string, 
  fixtures: Fixture[], 
  env: any, 
  ctx: any, 
  live?: boolean,
  forceR2Update = false // Parameter to force R2 update
): Promise<void> => {
  // Check and potentially reset timestamps
  checkTimestampReset();
  
  // Store environment reference for migrations
  storeEnvReference(env);
  
  console.log(`📝 Starting cache operation for ${live ? 'live matches' : 'all matches'} on ${date}`);
  const startTime = performance.now();
  
  // Create UTC date objects
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const utcToday = format(utcNow, 'yyyy-MM-dd');
  
  // Calculate yesterday and tomorrow in UTC
  const utcYesterday = new Date(utcNow);
  utcYesterday.setDate(utcNow.getDate() - 1);
  const yesterdayStr = format(utcYesterday, 'yyyy-MM-dd');
  
  const utcTomorrow = new Date(utcNow);
  utcTomorrow.setDate(utcNow.getDate() + 1);
  const tomorrowStr = format(utcTomorrow, 'yyyy-MM-dd');
  
  console.log(`⏰ UTC dates: Yesterday=${yesterdayStr}, Today=${utcToday}, Tomorrow=${tomorrowStr}, Requested=${date}`);
  
  const isDateInThreeDayWindow = date === yesterdayStr || date === utcToday || date === tomorrowStr;
  const isLive = !!live;
  const isTodayData = date === utcToday;
  
  // Update last update timestamp for today's data
  if (isTodayData) {
    const previousUpdateTime = lastTodayUpdateTimestamp;
    lastTodayUpdateTimestamp = Date.now();
    console.log(`⏱️ Setting last update timestamp for today's data: ${new Date(lastTodayUpdateTimestamp).toISOString()}`);
    if (previousUpdateTime > 0) {
      console.log(`⏱️ Previous update was ${(lastTodayUpdateTimestamp - previousUpdateTime) / 1000}s ago`);
    }
    
    // For today's data, always force R2 update
    forceR2Update = true;
    lastR2UpdateTimestamp = Date.now();
    console.log(`⏱️ R2 last update time set to: ${new Date(lastR2UpdateTimestamp).toISOString()}`);
  }
  
  // Determine TTL based on date and live status
  let ttl;
  if (isLive || isDateInThreeDayWindow) {
    ttl = TODAY_UPDATE_INTERVAL; // 20 seconds for live/yesterday/today/tomorrow
    console.log(`⏱️ Using short TTL (${ttl}s) for data in 3-day window or live data`);
    if (isTodayData) {
      console.log(`🔔 IMPORTANT: Today's data with ${ttl}s TTL - next refresh at ${new Date(Date.now() + ttl * 1000).toISOString()}`);
    }
  } else {
    // For other dates, use a longer TTL
    ttl = 3600; // 1 hour for dates outside the 3-day window
    console.log(`⏱️ Using standard TTL (${ttl}s) for dates outside 3-day window`);
  }
  
  console.log(`⏱️ Cache TTL set to ${ttl} seconds`);

  try {
    // Prepare the data
    const jsonData = JSON.stringify(fixtures);
    const dataSize = new TextEncoder().encode(jsonData).length;
    console.log(`📊 Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB, ${fixtures.length} fixtures`);
    
    // Always store in R2 for today's data to ensure freshness
    if (isTodayData || isLive || forceR2Update) {
      const r2Key = getR2Key(date, live);
      console.log(`💾 Storing in R2 with key: ${r2Key} (forced update: ${forceR2Update})`);
      
      try {
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
        
        await env.MATCH_DATA.put(r2Key, jsonData, { httpMetadata: metadata });
        console.log(`✅ Successfully stored in R2 at ${new Date().toISOString()}`);
        lastR2UpdateTimestamp = Date.now();
      } catch (r2Error) {
        console.error(`❌ Error storing in R2:`, r2Error);
      }
    } else if (!isTodayData && !isLive) {
      // For non-today data, still store in R2 but not as urgently
      const r2Key = getR2Key(date, live);
      console.log(`💾 Storing historical/future data in R2 with key: ${r2Key}`);
      
      try {
        // Store fixtures in R2 with metadata
        const metadata = {
          contentType: 'application/json',
          customMetadata: {
            updatedAt: new Date().toISOString(),
            ttl: ttl.toString(),
            isToday: 'false',
            isLive: 'false',
            fixturesCount: fixtures.length.toString(),
            inThreeDayWindow: isDateInThreeDayWindow ? 'true' : 'false'
          }
        };
        
        await env.MATCH_DATA.put(r2Key, jsonData, { httpMetadata: metadata });
        console.log(`✅ Successfully stored historical/future data in R2`);
      } catch (r2Error) {
        console.error(`❌ Error storing historical/future data in R2:`, r2Error);
      }
    }
    
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ Successfully cached ${fixtures.length} fixtures in ${duration}ms`);
    
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error during caching after ${duration}ms:`, error);
    throw error;
  }
};

const getFixturesFromStorage = async (
  date: string, 
  env: any,
  live?: boolean
): Promise<{ fixtures: Fixture[] | null; source: string; forceRefresh?: boolean }> => {
  // Check and potentially reset timestamps
  checkTimestampReset();
  
  // Store environment reference for migrations
  storeEnvReference(env);
  
  console.log(`🔍 Retrieving fixtures for ${date}${live ? ' (live)' : ''}`);
  const startTime = performance.now();
  
  try {
    // Create UTC date objects
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const utcToday = format(utcNow, 'yyyy-MM-dd');
    
    // Calculate yesterday and tomorrow in UTC
    const utcYesterday = new Date(utcNow);
    utcYesterday.setDate(utcNow.getDate() - 1);
    const yesterdayStr = format(utcYesterday, 'yyyy-MM-dd');
    
    const utcTomorrow = new Date(utcNow);
    utcTomorrow.setDate(utcNow.getDate() + 1);
    const tomorrowStr = format(utcTomorrow, 'yyyy-MM-dd');
    
    console.log(`⏰ UTC dates: Yesterday=${yesterdayStr}, Today=${utcToday}, Tomorrow=${tomorrowStr}, Requested=${date}`);
    
    const isDateInThreeDayWindow = date === yesterdayStr || date === utcToday || date === tomorrowStr;
    const isLive = !!live;
    const isTodayOrLive = date === utcToday || isLive;
    
    console.log(`🔍 Date is ${isDateInThreeDayWindow ? 'within' : 'outside'} the 3-day window (yesterday/today/tomorrow)`);
    console.log(`🔍 Request is ${isTodayOrLive ? 'for today or live data' : 'not for today'}`);
    
    // For today's data, check if we need a forced refresh
    let forceRefresh = false;
    
    if (isTodayOrLive) {
      const currentTime = Date.now();
      const timeSinceLastR2Update = currentTime - lastR2UpdateTimestamp;
      console.log(`⏱️ Time since last R2 update: ${Math.floor(timeSinceLastR2Update / 1000)}s`);
      
      // Force API refresh if:
      // 1. We've never updated (lastR2UpdateTimestamp is 0)
      // 2. It's been more than FORCE_REFRESH_INTERVAL since last update
      forceRefresh = (lastR2UpdateTimestamp === 0) || 
                    (timeSinceLastR2Update > FORCE_REFRESH_INTERVAL * 1000);
      
      if (forceRefresh) {
        if (lastR2UpdateTimestamp === 0) {
          console.log(`⚠️ FORCING REFRESH: No previous R2 update detected`);
        } else {
          console.log(`⚠️ FORCING REFRESH: It's been more than ${FORCE_REFRESH_INTERVAL}s since last R2 update`);
        }
        return { fixtures: null, source: 'None', forceRefresh: true };
      }
      
      // For today's data, check if we need to update based on the last update timestamp
      // This ensures we don't hit the API too frequently
      const timeSinceLastUpdate = currentTime - lastTodayUpdateTimestamp;
      console.log(`⏱️ Time since last today's data update: ${Math.floor(timeSinceLastUpdate / 1000)}s`);
      
      // If we've updated within the TTL period, prefer R2 for today's data
      const shouldPreferR2 = lastTodayUpdateTimestamp > 0 && 
                              timeSinceLastUpdate < TODAY_UPDATE_INTERVAL * 1000;
      
      console.log(`⏱️ Should prefer R2 for today's data? ${shouldPreferR2 ? 'Yes' : 'No'}`);
    }
    
    // Check R2 directly
    console.log('🔍 Checking R2...');
    
    // Check R2 for all dates
    const r2Key = getR2Key(date, live);
    console.log(`🔍 Checking R2 with key: ${r2Key}`);
    
    const r2Object = await env.MATCH_DATA.get(r2Key);
    if (r2Object) {
      const data = await r2Object.text();
      const fixtures = JSON.parse(data);
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`✨ Retrieved ${fixtures.length} fixtures from R2 in ${duration}ms`);
      
      // For today's data and live data, check when R2 was last modified
      let isR2Stale = false;
      let r2AgeSeconds = 0;
      let reason = '';
      
      if (r2Object.httpMetadata?.lastModified) {
        const r2Age = Date.now() - r2Object.httpMetadata.lastModified.getTime();
        r2AgeSeconds = Math.floor(r2Age / 1000);
        console.log(`ℹ️ R2 data age: ${r2AgeSeconds} seconds`);
        
        // For today's data, check if R2 data is "stale" but still usable
        if (isTodayOrLive) {
          // Data is stale if it's older than our R2 refresh interval,
          // but we'll still use it unless it's critically stale
          isR2Stale = r2AgeSeconds > FORCE_REFRESH_INTERVAL;
          
          if (isR2Stale) {
            console.log(`ℹ️ R2 data is stale (${r2AgeSeconds}s > ${FORCE_REFRESH_INTERVAL}s)`);
            reason = 'age';
          }
          
          // Check if we've had a recent update from another instance 
          const recentUpdate = lastTodayUpdateTimestamp > 0 && 
                              (Date.now() - lastTodayUpdateTimestamp < TODAY_UPDATE_INTERVAL * 1000);
          
          // If R2 data is critically stale AND we haven't updated recently, force refresh from API
          // Critical staleness is 3x our normal refresh interval
          if (r2AgeSeconds > FORCE_REFRESH_INTERVAL * 3 && !recentUpdate) {
            console.log(`⚠️ R2 data is critically stale (${r2AgeSeconds}s > ${FORCE_REFRESH_INTERVAL * 3}s) and no recent update detected`);
            return { fixtures: null, source: 'None', forceRefresh: true };
          }
        }
      }
      
      return { 
        fixtures, 
        source: 'R2',
        forceRefresh: isR2Stale && isTodayOrLive // Only force refresh for stale today's data
      };
    }
    
    console.log('❌ No fixtures found in storage');
    return { fixtures: null, source: 'None', forceRefresh: true };
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error retrieving from storage after ${duration}ms:`, error);
    return { fixtures: null, source: 'Error' };
  }
};

const getLiveFixtures = async (
  timezone: string, 
  env: any, 
  ctx: any
): Promise<FormattedFixturesResponse> => {
  console.log('\n🔴 Getting live matches, timezone:', timezone);
  const startTime = performance.now();
  
  try {
    let fixtures: Fixture[];
    let source: string = 'API';
    
    // Check cache for live matches
    console.log('🔄 Checking cache for live matches...');
    const today = format(new Date(), 'yyyy-MM-dd');
    const { fixtures: cached, source: cacheSource, forceRefresh } = await getFixturesFromStorage(today, env, true);
    
    if (cached && !forceRefresh) {
      source = cacheSource;
      fixtures = cached;
      console.log(`✅ Using ${fixtures.length} live matches from ${source}`);
    } else {
      console.log('🌐 Fetching live matches from API...');
      const apiStartTime = performance.now();
      
      // Call the football API
      const response = await getFootballApiFixtures(today, 'live', env.FOOTBALL_API_URL, env.RAPIDAPI_KEY);
      
      const apiDuration = (performance.now() - apiStartTime).toFixed(2);
      fixtures = response.response;
      console.log(`✅ Received ${fixtures.length} live matches from API in ${apiDuration}ms`);
      
      // Cache live matches
      console.log('💾 Caching live matches...');
      await cacheFixtures(today, fixtures, env, ctx, true);
    }

    const totalDuration = (performance.now() - startTime).toFixed(2);
    console.log(`🎯 Data source used: ${source} (total request time: ${totalDuration}ms)`);
    return formatFixtures(fixtures, timezone);
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error getting live matches after ${duration}ms:`, error);
    throw error;
  }
};

const getDateFixtures = async (
  date: string, 
  timezone: string, 
  env: any, 
  ctx: any
): Promise<FormattedFixturesResponse> => {
  console.log('\n📅 Getting fixtures for date:', date, 'timezone:', timezone);
  const startTime = performance.now();

  try {
    let fixtures: Fixture[];
    let source: string = 'API';
    
    // Check storage first
    console.log('🔄 Checking storage...');
    const { fixtures: cachedFixtures, source: storageSource, forceRefresh } = await getFixturesFromStorage(date, env, false);
    
    if (cachedFixtures && !forceRefresh) {
      source = storageSource;
      fixtures = cachedFixtures;
      console.log(`✅ Using ${fixtures.length} fixtures from ${source}`);
    } else {
      console.log('🌐 Fetching fixtures from API...');
      const apiStartTime = performance.now();
      
      // Call the football API
      const response = await getFootballApiFixtures(date, undefined, env.FOOTBALL_API_URL, env.RAPIDAPI_KEY);
      
      const apiDuration = (performance.now() - apiStartTime).toFixed(2);
      fixtures = response.response;
      console.log(`✅ Received ${fixtures.length} fixtures from API in ${apiDuration}ms`);
      
      // Cache fixtures
      console.log('💾 Caching fixtures...');
      // For today's data, force an R2 update
      const forceR2Update = date === format(new Date(), 'yyyy-MM-dd');
      await cacheFixtures(date, fixtures, env, ctx, false, forceR2Update);
    }

    const totalDuration = (performance.now() - startTime).toFixed(2);
    console.log(`🎯 Data source used: ${source} (total request time: ${totalDuration}ms)`);
    return formatFixtures(fixtures, timezone);
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error in getFixtures after ${duration}ms:`, { error, date, timezone });
    throw error;
  }
};

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
      
      // Get live fixtures
      const { fixtures: cached, source: cacheSource, forceRefresh } = await getFixturesFromStorage(
        format(new Date(), 'yyyy-MM-dd'), 
        env, 
        true
      );
      
      if (cached && !forceRefresh) {
        source = cacheSource;
        fixtures = cached;
        console.log(`✅ Using ${fixtures.length} live matches from ${source}`);
      } else {
        // Fetch from API and cache
        console.log('🌐 Fetching live fixtures directly from API...');
        const response = await getFootballApiFixtures(
          format(new Date(), 'yyyy-MM-dd'), 
          'live', 
          env.FOOTBALL_API_URL, 
          env.RAPIDAPI_KEY
        );
        fixtures = response.response;
        source = 'API';
        console.log(`✅ Received ${fixtures.length} live matches from API`);
        
        // Cache the fixtures
        console.log('💾 Caching live fixtures...');
        await cacheFixtures(format(new Date(), 'yyyy-MM-dd'), fixtures, env, ctx, true, true);
      }
      
      return {
        data: formatFixtures(fixtures, timezone),
        source
      };
    }

    const queryDate = date || format(new Date(), 'yyyy-MM-dd');
    let source = 'API';
    let fixtures: Fixture[];
    
    // Get fixtures for specific date
    const { fixtures: cachedFixtures, source: storageSource, forceRefresh } = await getFixturesFromStorage(
      queryDate, 
      env, 
      false
    );
    
    if (cachedFixtures && !forceRefresh) {
      source = storageSource;
      fixtures = cachedFixtures;
      console.log(`✅ Using ${fixtures.length} fixtures from ${source}`);
    } else {
      // Fetch from API and cache
      console.log('🌐 Fetching fixtures directly from API...');
      const response = await getFootballApiFixtures(
        queryDate, 
        undefined, 
        env.FOOTBALL_API_URL, 
        env.RAPIDAPI_KEY
      );
      fixtures = response.response;
      source = 'API';
      console.log(`✅ Received ${fixtures.length} fixtures from API`);
      
      // Cache the fixtures with forced R2 update for today's data
      console.log('💾 Caching fixtures...');
      const forceR2Update = queryDate === format(new Date(), 'yyyy-MM-dd');
      await cacheFixtures(queryDate, fixtures, env, ctx, false, forceR2Update);
    }
    
    return {
      data: formatFixtures(fixtures, timezone),
      source
    };
  }
};