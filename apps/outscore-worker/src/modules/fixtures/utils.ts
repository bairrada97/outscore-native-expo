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

// Constants
export const TODAY_UPDATE_INTERVAL = 15;

// Date utility functions
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

// Format the fixtures data for client consumption
export const formatFixtures = (fixtures: Fixture[], timezone: string = 'UTC'): FormattedFixturesResponse => {
  const countries: FormattedCountry[] = [];
  
  fixtures.forEach((fixture) => {
    // Find country or create new one
    let country = countries.find(c => c.name === fixture.league.country);
    if (!country) {
      country = {
        name: fixture.league.country,
        flag: fixture.league.flag,
        leagues: []
      };
      countries.push(country);
    }
    
    // Find league or create new one
    let league = country.leagues.find(l => l.id === fixture.league.id);
    if (!league) {
      league = {
        id: fixture.league.id,
        name: fixture.league.name,
        logo: fixture.league.logo,
        matches: []
      };
      country.leagues.push(league);
    }
    
    // Format match time based on timezone
    const matchDateTime = new Date(fixture.fixture.date);
    let formattedTime;
    
    try {
      formattedTime = formatInTimeZone(
        matchDateTime, 
        timezone, 
        'HH:mm'
      );
    } catch (e) {
      // Fallback to UTC if timezone is invalid
      formattedTime = format(matchDateTime, 'HH:mm');
    }
    
    // Create formatted match
    const match: FormattedMatch = {
      id: fixture.fixture.id,
      date: format(matchDateTime, 'yyyy-MM-dd'),
      time: formattedTime,
      timestamp: Math.floor(matchDateTime.getTime() / 1000),
      timezone: fixture.fixture.timezone,
      status: {
        short: fixture.fixture.status.short as FixtureStatusShort,
        long: fixture.fixture.status.long,
        elapsed: fixture.fixture.status.elapsed
      },
      teams: {
        home: {
          id: fixture.teams.home.id,
          name: fixture.teams.home.name,
          logo: fixture.teams.home.logo,
          winner: fixture.teams.home.winner
        },
        away: {
          id: fixture.teams.away.id,
          name: fixture.teams.away.name,
          logo: fixture.teams.away.logo,
          winner: fixture.teams.away.winner
        }
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
        away: fixture.goals.away
      }
    };
    
    // Add match to league
    league.matches.push(match);
  });
  
  // Sort countries alphabetically
  countries.sort((a, b) => a.name.localeCompare(b.name));
  
  // For each country, sort leagues by name
  countries.forEach(country => {
    country.leagues.sort((a, b) => a.name.localeCompare(b.name));
    
    // For each league, sort matches by time
    country.leagues.forEach(league => {
      league.matches.sort((a, b) => a.timestamp - b.timestamp);
    });
  });
  
  return countries;
};