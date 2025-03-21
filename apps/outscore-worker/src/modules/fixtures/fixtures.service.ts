import { format } from 'date-fns';
import { Fixture, FormattedFixturesResponse } from '@outscore/shared-types';
import { getFootballApiFixtures } from '../../pkg/util/football-api';
import { formatFixtures } from './utils';
import { getFixturesFromStorage, cacheFixtures } from './cache.service';
import { createR2CacheProvider } from '../cache';

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
        await cacheFixtures(
          format(new Date(), 'yyyy-MM-dd'), 
          fixtures, 
          env, 
          ctx, 
          true, 
          true
        );
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
      await cacheFixtures(
        queryDate, 
        fixtures, 
        env, 
        ctx, 
        false, 
        forceR2Update
      );
    }
    
    return {
      data: formatFixtures(fixtures, timezone),
      source
    };
  }
};