import { format } from 'date-fns';
import { checkIfDataExists, migrateFixturesToHistorical, migrateFixturesToToday } from './storage.utils';

// Handle date transitions between days
export const handleDateTransition = async (oldDate: string, newDate: string, env: any): Promise<void> => {
  try {
    console.log(`🔄 Handling date transition from ${oldDate} to ${newDate}`);
    
    if (!env) {
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
    const oldDataExists = await checkIfDataExists(oldDate, env);
    if (oldDataExists) {
      console.log(`📦 Moving previous day (${oldDate}) to historical folder`);
      await migrateFixturesToHistorical(oldDate, env);
    }
    
    // 2. Check if tomorrow's data exists and move it to today
    const tomorrowDataExists = await checkIfDataExists(tomorrowStr, env, 'future');
    if (tomorrowDataExists) {
      console.log(`📦 Moving future data (${tomorrowStr}) to today folder`);
      await migrateFixturesToToday(tomorrowStr, env);
    }
    
    console.log('✅ Date transition handling completed');
  } catch (err) {
    console.error('❌ Error during date transition:', err instanceof Error ? err.message : String(err));
  }
};

// Check for date transitions by comparing current UTC date with data in the "today" folder
export const checkBucketDateTransition = async (env: any, lastTodayUpdateTimestamp: number, lastR2UpdateTimestamp: number, currentDateString: string): Promise<{
  lastTodayUpdateTimestamp: number;
  lastR2UpdateTimestamp: number;
  currentDateString: string;
  transitionDetected: boolean;
}> => {
  try {
    if (!env || !env.FOOTBALL_CACHE) {
      console.error('❌ Environment reference not available for bucket date check');
      return { lastTodayUpdateTimestamp, lastR2UpdateTimestamp, currentDateString, transitionDetected: false };
    }

    // Get current UTC date
    const now = new Date();
    const currentUtcDate = format(now, 'yyyy-MM-dd');
    console.log(`🔍 Checking bucket date transition. Current UTC date: ${currentUtcDate}`);

    // Try to list objects in the "today" folder
    try {
      const objects = await env.FOOTBALL_CACHE.list({ prefix: 'today/' });
      
      // Extract date from filenames (e.g., 'today/fixtures-2023-04-20.json')
      let bucketStoredDate = null;
      if (objects && objects.objects && objects.objects.length > 0) {
        for (const object of objects.objects) {
          const match = object.key.match(/today\/fixtures-(\d{4}-\d{2}-\d{2})(?:-live)?\.json/);
          if (match && match[1]) {
            bucketStoredDate = match[1];
            break;
          }
        }
      }
      
      // If we found a stored date and it doesn't match current date, trigger migration
      if (bucketStoredDate && bucketStoredDate !== currentUtcDate) {
        console.log(`📆 Date transition detected in bucket: ${bucketStoredDate} → ${currentUtcDate}`);
        
        // Update in-memory tracking to match reality
        const previousDate = bucketStoredDate;
        
        // Reset timestamps to force data refresh
        const newLastTodayUpdateTimestamp = 0;
        const newLastR2UpdateTimestamp = 0;
        
        // Handle the date transition
        await handleDateTransition(previousDate, currentUtcDate, env);
        
        return {
          lastTodayUpdateTimestamp: newLastTodayUpdateTimestamp,
          lastR2UpdateTimestamp: newLastR2UpdateTimestamp,
          currentDateString: currentUtcDate,
          transitionDetected: true
        };
      } else if (bucketStoredDate) {
        console.log(`✅ Bucket date check: Today's data is current (${bucketStoredDate})`);
      } else {
        console.log(`ℹ️ Bucket date check: No data found in today's folder`);
      }
    } catch (err) {
      console.error('❌ Error listing objects in bucket:', err instanceof Error ? err.message : String(err));
    }
    
    return { 
      lastTodayUpdateTimestamp, 
      lastR2UpdateTimestamp, 
      currentDateString, 
      transitionDetected: false 
    };
  } catch (err) {
    console.error('❌ Error during bucket date transition check:', err instanceof Error ? err.message : String(err));
    return { 
      lastTodayUpdateTimestamp, 
      lastR2UpdateTimestamp, 
      currentDateString, 
      transitionDetected: false 
    };
  }
};

// Function to check if we've crossed to a new day
export const checkTimestampReset = (
  currentDateString: string,
  lastTodayUpdateTimestamp: number, 
  lastR2UpdateTimestamp: number,
  env: any
): {
  currentDateString: string;
  lastTodayUpdateTimestamp: number;
  lastR2UpdateTimestamp: number;
  transitionDetected: boolean;
} => {
  const now = new Date();
  const nowDateString = format(now, 'yyyy-MM-dd');
  
  // Check if we've crossed to a new day
  if (nowDateString !== currentDateString) {
    console.log(`📆 Date transition detected: ${currentDateString} → ${nowDateString}`);
    
    // Update the current date
    const previousDate = currentDateString;
    
    // Force data refresh due to date change
    const newLastTodayUpdateTimestamp = 0;
    const newLastR2UpdateTimestamp = 0;
    
    // Handle the date transition immediately (but don't block)
    handleDateTransition(previousDate, nowDateString, env);
    
    return {
      currentDateString: nowDateString,
      lastTodayUpdateTimestamp: newLastTodayUpdateTimestamp,
      lastR2UpdateTimestamp: newLastR2UpdateTimestamp,
      transitionDetected: true
    };
  }
  
  return {
    currentDateString,
    lastTodayUpdateTimestamp,
    lastR2UpdateTimestamp,
    transitionDetected: false
  };
};

// Get UTC date information for the current request
export const getUtcDateInfo = (date: string): {
  utcToday: string;
  yesterdayStr: string;
  tomorrowStr: string;
  isDateInThreeDayWindow: boolean;
  isTodayData: boolean;
} => {
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
  
  const isDateInThreeDayWindow = date === yesterdayStr || date === utcToday || date === tomorrowStr;
  const isTodayData = date === utcToday;
  
  return {
    utcToday,
    yesterdayStr,
    tomorrowStr,
    isDateInThreeDayWindow,
    isTodayData
  };
}; 