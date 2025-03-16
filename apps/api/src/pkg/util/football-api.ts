import { FixturesResponse } from '../types/football-api';

if (!process.env.RAPIDAPI_KEY) {
  throw new Error('RAPIDAPI_KEY is not defined');
}

const API_BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3';
const DAILY_LIMIT = 75000;
const RATE_LIMIT_KEY = 'football_api_calls';

const headers: HeadersInit = {
  'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
  'x-rapidapi-key': process.env.RAPIDAPI_KEY,
};

const buildUrl = (endpoint: string, params?: Record<string, string>): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      console.log(`Adding parameter: ${key}=${value}`);
      url.searchParams.append(key, value);
    });
  }
  console.log(`Built URL: ${url.toString()}`);
  return url.toString();
};

const checkRateLimit = async (): Promise<boolean> => {
  // Implement rate limit checking with Redis
  // This would be implemented when we set up Redis
  return true; // For now, always allow
};

export const getFixtures = async (date: string, live?: 'live'): Promise<FixturesResponse> => {
  const canProceed = await checkRateLimit();
  if (!canProceed) {
    throw new Error('API rate limit exceeded');
  }

  const params: Record<string, string> = {};
  if (live === 'live') {
    params.live = 'all';
  } else {
    params.date = date;
  }

  const url = buildUrl('/fixtures', params);
  console.log('Fetching fixtures from:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      throw new Error(`API request failed: ${response.statusText} - ${errorText}`);
    }

    const data: FixturesResponse = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(`API returned errors: ${JSON.stringify(data.errors)}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    throw error;
  }
}; 