import { format } from 'date-fns';
import { createR2CacheProvider, createCacheService } from '../cache';

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

// Handle date transitions between days
export const handleDateTransition = async (oldDate: string, newDate: string, env: any): Promise<void> => {
  try {
    console.log(`🔄 Handling date transition from ${oldDate} to ${newDate}`);
    
    if (!env) {
      console.error('❌ Environment reference not available for migration');
      return;
    }
    
    // Create providers
    const r2Provider = createR2CacheProvider(env.FOOTBALL_CACHE);
    const cacheService = createCacheService(r2Provider);
    
    // Calculate yesterday and tomorrow
    const yesterdayObj = new Date(newDate);
    yesterdayObj.setUTCDate(yesterdayObj.getUTCDate() - 1);
    const yesterdayStr = format(yesterdayObj, 'yyyy-MM-dd');
    
    const tomorrowObj = new Date(newDate);
    tomorrowObj.setUTCDate(tomorrowObj.getUTCDate() + 1);
    const tomorrowStr = format(tomorrowObj, 'yyyy-MM-dd');
    
    console.log(`📆 Date reference points: yesterday=${yesterdayStr}, today=${newDate}, tomorrow=${tomorrowStr}`);
    
    // Use the cache service to check for existing data and perform migrations
    await cacheService.handleDateTransition(oldDate, newDate, env);
    
    console.log('✅ Date transition handling completed');
  } catch (err) {
    console.error('❌ Error during date transition:', err instanceof Error ? err.message : String(err));
  }
}; 