export interface Fixture {
  id: number;
  date: string;
  timezone: string;
  raw_data: any; // Type this based on your football API response
  created_at: string;
}

export type FixtureInsert = Omit<Fixture, 'created_at'>;

// Table name constant for Supabase queries
export const FIXTURES_TABLE = 'fixtures' as const;   