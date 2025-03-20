import { format, isBefore, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { 
  Fixture, 
  FormattedFixturesResponse,
  FormattedCountry,
  FormattedLeague,
  FormattedMatch,
  FixtureStatusShort
} from '@outscore/shared-types';

export const TODAY_UPDATE_INTERVAL = 20; // 20 seconds for today/live (increased from 15)

export const FUTURE_TTL = (date: string, fixtures: Fixture[]): number => {
  // Find the earliest and latest match timestamps for the day
  const timestamps = fixtures.map(f => f.fixture.timestamp);
  const earliestMatch = Math.min(...timestamps);
  const latestMatch = Math.max(...timestamps);
  
  // Calculate TTL based on the earliest match that hasn't started yet
  const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
  
  if (now < earliestMatch) {
    // If all matches haven't started, TTL until the first match
    return Math.max(earliestMatch - now, 60);
  } else if (now < latestMatch) {
    // If some matches are ongoing, TTL until the last match
    return Math.max(latestMatch - now, 60);
  } else {
    // All matches have started, use minimum TTL
    return TODAY_UPDATE_INTERVAL;
  }
};

export const isToday = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const today = format(utcNow, 'yyyy-MM-dd');
  return date === today;
};

export const isFuture = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  return targetDate > utcNow;
};

export const isPast = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  return targetDate < utcNow;
};

export const isWithinDisplayRange = (date: string): boolean => {
  const now = new Date();
  const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const targetDate = new Date(date);
  
  // Calculate dates 2 days before and 2 days after today
  const twoDaysBefore = new Date(utcNow);
  twoDaysBefore.setDate(utcNow.getDate() - 2);
  
  const twoDaysAfter = new Date(utcNow);
  twoDaysAfter.setDate(utcNow.getDate() + 2);
  
  // Check if targetDate is within this range (inclusive)
  return targetDate >= twoDaysBefore && targetDate <= twoDaysAfter;
};

export const formatFixtures = (fixtures: Fixture[], timezone: string = 'UTC'): FormattedFixturesResponse => {
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

    // Create a formatted match object according to the shared type
    const formattedMatch: FormattedMatch = {
      id: fixture.fixture.id,
      date: format(matchDate, 'yyyy-MM-dd'),
      time: localTime,
      timestamp: fixture.fixture.timestamp,
      timezone: fixture.fixture.timezone,
      status: {
        long: fixture.fixture.status.long,
        short: fixture.fixture.status.short as FixtureStatusShort,
        elapsed: fixture.fixture.status.elapsed,
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
      score: {
        fulltime: {
          home: fixture.score.fulltime.home,
          away: fixture.score.fulltime.away,
        },
        penalty: {
          home: fixture.score.penalty.home,
          away: fixture.score.penalty.away,
        }
      },
      goals: {
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

  return countries;
};