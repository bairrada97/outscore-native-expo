import { format } from 'date-fns';
import { Fixture } from '@outscore/shared-types';
import { TODAY_UPDATE_INTERVAL } from './utils';
import { cacheFixturesInR2, getR2Key } from './storage.utils';
import { getUtcDateInfo, checkTimestampReset, checkBucketDateTransition } from './date.utils';

// State management for cache service
let lastTodayUpdateTimestamp = 0;
let lastR2UpdateTimestamp = 0;
let currentDateString = format(new Date(), 'yyyy-MM-dd');

// Force refresh interval
const FORCE_REFRESH_INTERVAL = 15; // 15 seconds forced refresh

// Store fixtures in cache
export const cacheFixtures = async (
  date: string, 
  fixtures: Fixture[], 
  env: any, 
  ctx: any, 
  live?: boolean,
  forceR2Update = false // Parameter to force R2 update
): Promise<void> => {
  // Check and potentially reset timestamps
  const resetResult = checkTimestampReset(currentDateString, lastTodayUpdateTimestamp, lastR2UpdateTimestamp, env);
  currentDateString = resetResult.currentDateString;
  lastTodayUpdateTimestamp = resetResult.lastTodayUpdateTimestamp;
  lastR2UpdateTimestamp = resetResult.lastR2UpdateTimestamp;
  
  // Check for date transitions based on bucket data
  const bucketResult = await checkBucketDateTransition(env, lastTodayUpdateTimestamp, lastR2UpdateTimestamp, currentDateString);
  currentDateString = bucketResult.currentDateString;
  lastTodayUpdateTimestamp = bucketResult.lastTodayUpdateTimestamp;
  lastR2UpdateTimestamp = bucketResult.lastR2UpdateTimestamp;
  
  console.log(`📝 Starting cache operation for ${live ? 'live matches' : 'all matches'} on ${date}`);
  const startTime = performance.now();
  
  // Get date information
  const { utcToday, yesterdayStr, tomorrowStr, isDateInThreeDayWindow, isTodayData } = getUtcDateInfo(date);
  
  console.log(`⏰ UTC dates: Yesterday=${yesterdayStr}, Today=${utcToday}, Tomorrow=${tomorrowStr}, Requested=${date}`);
  
  const isLive = !!live;
  
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
    // Cache in R2 based on the data type
    if (isTodayData || isLive || forceR2Update) {
      // Store with forced update flag for today's data
      const success = await cacheFixturesInR2(
        date, 
        fixtures, 
        env, 
        isLive, 
        isTodayData, 
        isDateInThreeDayWindow, 
        ttl, 
        true
      );
      
      if (success) {
        lastR2UpdateTimestamp = Date.now();
      }
    } else if (!isTodayData && !isLive) {
      // For non-today data, no need to update last R2 timestamp
      await cacheFixturesInR2(
        date, 
        fixtures, 
        env, 
        isLive, 
        isTodayData, 
        isDateInThreeDayWindow, 
        ttl, 
        false
      );
    }
    
    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✅ Successfully cached ${fixtures.length} fixtures in ${duration}ms`);
    
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error during caching after ${duration}ms:`, error);
    throw error;
  }
};

// Get fixtures from storage
export const getFixturesFromStorage = async (
  date: string, 
  env: any,
  live?: boolean
): Promise<{ fixtures: Fixture[] | null; source: string; forceRefresh?: boolean }> => {
  // Check and potentially reset timestamps
  const resetResult = checkTimestampReset(currentDateString, lastTodayUpdateTimestamp, lastR2UpdateTimestamp, env);
  currentDateString = resetResult.currentDateString;
  lastTodayUpdateTimestamp = resetResult.lastTodayUpdateTimestamp;
  lastR2UpdateTimestamp = resetResult.lastR2UpdateTimestamp;
  
  // Check for date transitions based on bucket data
  const bucketResult = await checkBucketDateTransition(env, lastTodayUpdateTimestamp, lastR2UpdateTimestamp, currentDateString);
  currentDateString = bucketResult.currentDateString;
  lastTodayUpdateTimestamp = bucketResult.lastTodayUpdateTimestamp;
  lastR2UpdateTimestamp = bucketResult.lastR2UpdateTimestamp;
  
  console.log(`🔍 Retrieving fixtures for ${date}${live ? ' (live)' : ''}`);
  const startTime = performance.now();
  
  try {
    // Get date information
    const { utcToday, yesterdayStr, tomorrowStr, isDateInThreeDayWindow, isTodayData } = getUtcDateInfo(date);
    
    console.log(`⏰ UTC dates: Yesterday=${yesterdayStr}, Today=${utcToday}, Tomorrow=${tomorrowStr}, Requested=${date}`);
    
    const isLive = !!live;
    const isTodayOrLive = isTodayData || isLive;
    
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
      console.log(`✅ Successfully retrieved ${fixtures.length} fixtures from R2 in ${duration}ms`);
      return { fixtures, source: 'R2', forceRefresh };
    }
    
    return { fixtures: null, source: 'None', forceRefresh: false };
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error during retrieval after ${duration}ms:`, error);
    return { fixtures: null, source: 'None', forceRefresh: true };
  }
};

