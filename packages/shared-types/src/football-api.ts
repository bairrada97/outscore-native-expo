/**
 * API Response Types
 */

export interface Fixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: {
      id: number | null;
      name: string;
      city: string;
    };
    status: {
      long: string;
      short: FixtureStatusShort;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface FixturesResponse {
  get: string;
  parameters: Record<string, string>;
  errors: any[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: Fixture[];
}

/**
 * Formatted Response Types
 */

export interface FormattedMatch {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  status: {
    long: string;
    short: FixtureStatusShort; 
    elapsed: number | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  score: {
    fulltime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

export interface FormattedLeague {
  id: number;
  name: string;
  logo: string;
  matches: FormattedMatch[];
}

export interface FormattedCountry {
  name: string;
  flag: string | null;
  leagues: FormattedLeague[];
}

export type FormattedFixturesResponse = FormattedCountry[]; 

export type FixtureStatusShort =
	| 'CANC'
	| 'PST'
	| 'ABD'
	| 'WO'
	| 'FT'
	| 'HT'
	| 'INT'
	| 'PEN'
	| 'NS'
	| 'AET'
	| 'BT'
	| 'P'