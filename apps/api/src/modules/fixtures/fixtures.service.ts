import { getFixtures as getFootballApiFixtures } from '../../pkg/util/football-api';
import { redis } from '../../pkg/util/redis';
import { db, FIXTURES_TABLE } from '@outscore/db';
import { 
  Fixture, 
  FormattedFixturesResponse,
  FormattedCountry,
  FormattedLeague,
  FormattedMatch 
} from '../../pkg/types/football-api';
import { format, isBefore, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const CACHE_PREFIX = 'fixtures';
const CHUNK_SIZE = 500;
const TODAY_UPDATE_INTERVAL = 15;  
const FUTURE_TTL = (date: string) => {
  const targetDate = new Date(date);
  const now = new Date(); 
  const ttl = Math.floor((targetDate.getTime() - now.getTime()) / 1000);
  return Math.max(ttl, 60); // Ensure minimum 60 seconds TTL
};

const getCacheKey = (date: string, chunk?: number, live?: boolean): string => {
  const base = `${CACHE_PREFIX}:${date}${live ? ':live' : ''}`;
  return chunk !== undefined ? `${base}:chunk:${chunk}` : base;
};

const getMetaKey = (date: string, live?: boolean): string => {
  return `${CACHE_PREFIX}:${date}${live ? ':live' : ''}:meta`;
};

const isToday = (date: string): boolean => {
  const today = format(new Date(), 'yyyy-MM-dd');
  return date === today;
};

const isFuture = (date: string): boolean => {
  const targetDate = new Date(date);
  const today = startOfDay(new Date());
  return targetDate > today;
};

const isPast = (date: string): boolean => {
  const targetDate = startOfDay(new Date(date));
  const today = startOfDay(new Date());
  return isBefore(targetDate, today);
};

const formatFixtures = (fixtures: Fixture[], timezone: string = 'UTC'): FormattedFixturesResponse => {
  // Create a map to efficiently group by country and league
  const countryMap = new Map<string, {
    name: string;
    flag: string | null;
    leagues: Map<number, FormattedLeague>;
  }>();

  // Process each fixture
  fixtures.forEach((fixture) => {
    const { league } = fixture;
    const countryName = league.country;

    // Get or create country entry
    let countryEntry = countryMap.get(countryName);
    if (!countryEntry) {
      countryEntry = {
        name: countryName,
        flag: league.flag,
        leagues: new Map(),
      };
      countryMap.set(countryName, countryEntry);
    }

    // Get or create league entry
    let leagueEntry = countryEntry.leagues.get(league.id);
    if (!leagueEntry) {
      leagueEntry = {
        id: league.id,
        name: league.name,
        logo: league.logo,
        matches: [],
      };
      countryEntry.leagues.set(league.id, leagueEntry);
    }

    // Convert UTC time to user's timezone
    const matchDate = new Date(fixture.fixture.date);
    const localTime = formatInTimeZone(matchDate, timezone, 'HH:mm');

    // Create a minimal match object with only essential data
    const formattedMatch = {
      id: fixture.fixture.id,
      date: format(matchDate, 'yyyy-MM-dd'),
      time: localTime,
      timestamp: fixture.fixture.timestamp,
      status: {
        long: fixture.fixture.status.long,
        short: fixture.fixture.status.short,
        elapsed: fixture.fixture.status.elapsed,
      },
      teams: {
        home: {
          id: fixture.teams.home.id,
          logo: fixture.teams.home.logo,
          name: fixture.teams.home.name,
          winner: fixture.teams.home.winner,
        },
        away: {
          id: fixture.teams.away.id,
          logo: fixture.teams.away.logo,
          name: fixture.teams.away.name,
          winner: fixture.teams.away.winner,
        },
      },
      score: {
        home: fixture.goals.home,
        away: fixture.goals.away,
      },
    };

    // Add match to league
    leagueEntry.matches.push(formattedMatch);
  });

  // Convert maps to arrays and sort
  const countries: FormattedCountry[] = Array.from(countryMap.entries())
    .map(([_, country]) => ({
      name: country.name,
      flag: country.flag,
      leagues: Array.from(country.leagues.values())
        .map(league => ({
          ...league,
          // Sort matches by time
          matches: league.matches.sort((a, b) => a.time.localeCompare(b.time)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { countries };
};

const cacheFixtures = async (date: string, fixtures: Fixture[], live?: boolean): Promise<void> => {
  console.log(`📝 Starting cache operation for ${live ? 'live matches' : 'all matches'} on ${date}`);
  const startTime = performance.now();
  const ttl = isToday(date) ? TODAY_UPDATE_INTERVAL : isFuture(date) ? FUTURE_TTL(date) : undefined;
  
  if (!ttl) {
    console.log('⏭️ Skipping cache - no TTL for past dates');
    return;
  }
  console.log(`⏱️ Cache TTL set to ${ttl} seconds`);

  try {
    // Store metadata
    const meta = {
      total: fixtures.length,
      chunks: Math.ceil(fixtures.length / CHUNK_SIZE),
      date,
      live: !!live
    };
    const cacheKey = getMetaKey(date, live);
    console.log(`📦 Storing metadata at ${cacheKey}:`, meta);
    const metaSize = Buffer.byteLength(JSON.stringify(meta), 'utf8');
    console.log(`📊 Metadata size: ${(metaSize / 1024).toFixed(2)} KB`);
    await redis.set(cacheKey, meta, { ex: ttl });

    let totalChunkSize = 0;
    // Store chunks
    for (let i = 0; i < meta.chunks; i++) {
      const start = i * CHUNK_SIZE;
      const chunk = fixtures.slice(start, start + CHUNK_SIZE);
      const minimalChunk = chunk.map(fixture => ({
        fixture: {
          id: fixture.fixture.id,
          date: fixture.fixture.date,
          timestamp: fixture.fixture.timestamp,
          timezone: fixture.fixture.timezone,
          status: fixture.fixture.status,
        },
        league: {
          id: fixture.league.id,
          name: fixture.league.name,
          country: fixture.league.country,
          flag: fixture.league.flag,
          logo: fixture.league.logo,
        },
        teams: fixture.teams,
        goals: fixture.goals,
        score: fixture.score,
      }));

      const chunkSize = Buffer.byteLength(JSON.stringify(minimalChunk), 'utf8');
      totalChunkSize += chunkSize;
      const chunkKey = getCacheKey(date, i, live);
      console.log(`💾 Storing ${live ? 'live matches' : 'matches'} chunk ${i} at ${chunkKey} (${(chunkSize / 1024).toFixed(2)} KB)`);
      await redis.set(chunkKey, minimalChunk, { ex: ttl });
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`📊 Total payload size: ${(totalChunkSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`✅ Successfully cached ${live ? 'live matches' : 'all matches'} in ${duration}ms`);

    // Verify cache was set correctly
    const verifyMeta = await redis.get(getMetaKey(date, live));
    if (verifyMeta) {
      console.log(`✅ Cache verification successful for ${live ? 'live matches' : 'all matches'}`);
    } else {
      console.log(`❌ Cache verification failed for ${live ? 'live matches' : 'all matches'} - metadata not found`);
    }
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error during ${live ? 'live matches' : 'all matches'} caching after ${duration}ms:`, error);
    throw error;
  }
};

const getFixturesFromCache = async (date: string, live?: boolean): Promise<Fixture[] | null> => {
  console.log('🔍 Attempting to retrieve fixtures from Redis for date:', date, live ? '(live matches)' : '');
  const startTime = performance.now();
  try {
    const meta = await redis.get(getMetaKey(date, live));
    if (!meta) {
      console.log('❌ No metadata found in Redis cache for key:', getMetaKey(date, live));
      return null;
    }

    const { chunks } = meta as { chunks: number };
    console.log(`📦 Found ${chunks} chunks in Redis cache`);
    const fixtures: Fixture[] = [];
    let totalSize = 0;

    for (let i = 0; i < chunks; i++) {
      const chunkKey = getCacheKey(date, i, live);
     
      const chunk = await redis.get(chunkKey);
      if (!chunk) {
        console.log(`❌ Missing chunk ${i} in Redis cache, invalidating cache`);
        return null;
      }
      
      const chunkSize = Buffer.byteLength(JSON.stringify(chunk), 'utf8');
      totalSize += chunkSize;
      console.log(`📥 Retrieved chunk ${i} (${(chunkSize / 1024).toFixed(2)} KB)`);
      fixtures.push(...(chunk as any[]));
    }

    const duration = (performance.now() - startTime).toFixed(2);
    console.log(`✨ Successfully retrieved ${fixtures.length} fixtures from Redis cache in ${duration}ms`);
    console.log(`📊 Total retrieved size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    return fixtures;
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error retrieving from cache after ${duration}ms:`, error);
    return null;
  }
};

const getFixturesFromSupabase = async (date: string): Promise<Fixture[]> => {
  console.log('🔍 Attempting to retrieve fixtures from Supabase for date:', date);
  const startTime = performance.now();
  try {
    const { data, error } = await db
      .from(FIXTURES_TABLE)
      .select('raw_data')
      .eq('date', date);

    const duration = (performance.now() - startTime).toFixed(2);

    if (error) {
      console.error(`❌ Error retrieving fixtures from Supabase after ${duration}ms:`, error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log(`❌ No fixtures found in Supabase (query took ${duration}ms)`);
      return [];
    }

    console.log(`✨ Successfully retrieved ${data.length} fixtures from Supabase in ${duration}ms`);
    return data.map(row => row.raw_data);
  } catch (error) {
    const duration = (performance.now() - startTime).toFixed(2);
    console.error(`❌ Error in Supabase query after ${duration}ms:`, error);
    throw error;
  }
};

const migrateFixturesIfNeeded = async (date: string): Promise<void> => {
  const cacheKey = getCacheKey(date);
  
  // Check if fixtures exist in Redis
  const cachedFixtures = await redis.get<string>(cacheKey);
  if (!cachedFixtures) {
    return;
  }

  const fixturesData = JSON.parse(cachedFixtures) as Fixture[];

  // Check if these fixtures are already in Supabase
  const { data: existingFixtures } = await db
    .from(FIXTURES_TABLE)
    .select('id')
    .eq('date', date);

  if (existingFixtures && existingFixtures.length > 0) {
    return;
  }

  // Transform fixtures for Supabase storage
  const fixturesForDb = fixturesData.map(fixture => ({
    id: fixture.fixture.id,
    date,
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
};

export const fixturesService = {
  async getFixtures({ 
    date, 
    timezone = "UTC",
    live,
  }: { 
    date?: string; 
    timezone: string;
    live?: 'all';
  }): Promise<FormattedFixturesResponse> {
    const startTime = performance.now();

    if (live === 'all') {
      console.log('\n🔴 Getting live matches, timezone:', timezone);
      try {
        let fixtures: Fixture[];
        let source: 'Redis' | 'API' = 'API';
        let fetchDuration: string;

        // Check Redis cache for live matches
        console.log('🔄 Checking Redis cache for live matches...');
        const today = format(new Date(), 'yyyy-MM-dd');
        const cached = await getFixturesFromCache(today, true);
        
        if (cached) {
          source = 'Redis';
          fetchDuration = (performance.now() - startTime).toFixed(2);
          fixtures = cached;
          console.log(`✅ Using ${fixtures.length} live matches from Redis cache (total time: ${fetchDuration}ms)`);
        } else {
          console.log('🌐 Fetching live matches from API...');
          const apiStartTime = performance.now();
          const response = await getFootballApiFixtures(today, 'live');
          const apiDuration = (performance.now() - startTime).toFixed(2);
          fixtures = response.response;
          console.log(`✅ Received ${fixtures.length} live matches from API in ${apiDuration}ms`);
          
          // Cache live matches
          console.log('💾 Caching live matches in Redis...');
          await cacheFixtures(today, fixtures, true);
        }

        const totalDuration = (performance.now() - startTime).toFixed(2);
        console.log(`🎯 Data source used: ${source} (total request time: ${totalDuration}ms)`);
        return formatFixtures(fixtures, timezone);
      } catch (error) {
        const duration = (performance.now() - startTime).toFixed(2);
        console.error(`❌ Error getting live matches after ${duration}ms:`, error);
        throw error;
      }
    }

    // Regular date-based fixtures flow
    const queryDate = date || format(new Date(), 'yyyy-MM-dd');
    console.log('\n📅 Getting fixtures for date:', queryDate, 'timezone:', timezone);

    try {
      let fixtures: Fixture[];
      let source: 'Supabase' | 'Redis' | 'API' = 'API';
      let fetchDuration: string;

      // For past dates, check Supabase first
      if (isPast(queryDate)) {
        console.log('📆 Date is in the past, checking Supabase first...');
        try {
          await migrateFixturesIfNeeded(queryDate);
          fixtures = await getFixturesFromSupabase(queryDate);
          if (fixtures.length > 0) {
            source = 'Supabase';
            fetchDuration = (performance.now() - startTime).toFixed(2);
            console.log(`✅ Using ${fixtures.length} fixtures from Supabase (total time: ${fetchDuration}ms)`);
            return formatFixtures(fixtures, timezone);
          }
          console.log('➡️ No fixtures in Supabase, will try Redis/API...');
        } catch (error) {
          console.error('❌ Error accessing Supabase:', error);
        }
      }

      // Check Redis cache for regular fixtures
      console.log('🔄 Checking Redis cache...');
      const cached = await getFixturesFromCache(queryDate, false);
      
      if (cached) {
        source = 'Redis';
        fetchDuration = (performance.now() - startTime).toFixed(2);
        fixtures = cached;
        console.log(`✅ Using ${fixtures.length} fixtures from Redis cache (total time: ${fetchDuration}ms)`);
      } else {
        console.log('🌐 Fetching fixtures from API...');
        const apiStartTime = performance.now();
        const response = await getFootballApiFixtures(queryDate);
        const apiDuration = (performance.now() - startTime).toFixed(2);
        fixtures = response.response;
        console.log(`✅ Received ${fixtures.length} fixtures from API in ${apiDuration}ms`);
        
        if (isPast(queryDate)) {
          console.log('💾 Storing past fixtures in Supabase...');
          
          // Check for existing fixtures first
          console.log('🔍 Checking for existing fixtures in Supabase...');
          const { data: existingFixtures } = await db
            .from(FIXTURES_TABLE)
            .select('id')
            .eq('date', queryDate);

          if (existingFixtures && existingFixtures.length > 0) {
            console.log(`⏩ Skipping insert - ${existingFixtures.length} fixtures already exist for this date`);
          } else {
            // For past dates, store directly in Supabase
            const fixturesForDb = fixtures.map(fixture => ({
              id: fixture.fixture.id,
              date: queryDate,
              timezone: fixture.fixture.timezone,
              raw_data: {
                fixture: {
                  id: fixture.fixture.id,
                  date: fixture.fixture.date,
                  timestamp: fixture.fixture.timestamp,
                  timezone: fixture.fixture.timezone,
                  status: fixture.fixture.status,
                },
                league: {
                  id: fixture.league.id,
                  name: fixture.league.name,
                  country: fixture.league.country,
                  flag: fixture.league.flag,
                  logo: fixture.league.logo,
                },
                teams: {
                  home: {
                    id: fixture.teams.home.id,
                    name: fixture.teams.home.name,
                    logo: fixture.teams.home.logo,
                    winner: fixture.teams.home.winner,
                  },
                  away: {
                    id: fixture.teams.away.id,
                    name: fixture.teams.away.name,
                    logo: fixture.teams.away.logo,
                    winner: fixture.teams.away.winner,
                  },
                },
                goals: fixture.goals,
                score: {
                  halftime: fixture.score.halftime,
                  fulltime: fixture.score.fulltime,
                },
              },
            }));
            
            try {
              const { data, error } = await db.from(FIXTURES_TABLE).insert(fixturesForDb);
              if (error) {
                console.error('❌ Error inserting fixtures into Supabase:', error);
                throw error;
              }
              console.log(`✅ Successfully stored ${fixturesForDb.length} fixtures in Supabase`);
            } catch (error) {
              console.error('❌ Failed to store fixtures in Supabase:', error);
              throw error;
            }
          }
        } else {
          console.log('💾 Caching fixtures in Redis...');
          await cacheFixtures(queryDate, fixtures, false);
        }
      }

      const totalDuration = (performance.now() - startTime).toFixed(2);
      console.log(`🎯 Data source used: ${source} (total request time: ${totalDuration}ms)`);
      return formatFixtures(fixtures, timezone);
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(2);
      console.error(`❌ Error in getFixtures after ${duration}ms:`, { error, date: queryDate, timezone });
      throw error;
    }
  },
}; 