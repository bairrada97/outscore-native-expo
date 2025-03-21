import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { format } from 'date-fns';
import { isValidTimezone, fixturesService, createR2CacheProvider } from './modules';
import { getUtcDateInfo } from './modules/fixtures/date.utils';

interface Env {
  FOOTBALL_CACHE: R2Bucket;
  FOOTBALL_API_URL: string;
  RAPIDAPI_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware
app.use('*', cors({
  origin: '*', 
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: [
    'Content-Length', 
    'X-Source', 
    'X-Response-Time', 
    'X-TTL', 
    'X-UTC-Today', 
    'X-Requested-Date', 
    'X-Is-Today', 
    'X-Data-Age',
    'X-In-Three-Day-Window',
    'X-Cache-Status',
    'Cache-Control',
    'Pragma',
    'Expires'
  ],
  maxAge: 600,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Fixtures routes
const dateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  timezone: z.string()
    .refine(
      (tz) => isValidTimezone(tz),
      { message: "Invalid timezone provided" }
    )
    .default("UTC"),
  live: z.enum(['all']).optional(),
});

// Background refresh timer for today's fixtures
let backgroundRefreshTimer: number | null = null;
const BACKGROUND_REFRESH_INTERVAL = 15 * 1000; // 15 seconds

// Function to refresh today's fixtures in the background
async function refreshTodayFixtures(env: any) {
  try {
    console.log('🔄 BACKGROUND: Automatically refreshing today\'s fixtures data');
    
    // Get current UTC date
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const today = format(utcNow, 'yyyy-MM-dd');
    
    // Get date info
    const dateInfo = getUtcDateInfo(today);
    
    // Force refresh from API
    console.log(`🌐 BACKGROUND: Fetching fresh fixtures for ${dateInfo.utcToday} from API`);
    
    // Create a mock ExecutionContext
    const mockCtx = {
      waitUntil: (promise: Promise<any>) => {
        // This would normally extend the lifetime of the worker
        return promise.catch(err => {
          console.error('Error in background refresh waitUntil:', err);
        });
      }
    };
    
    // Fetch fresh data for today
    await fixturesService.getFixtures({
      date: dateInfo.utcToday,
      timezone: 'UTC',
      live: undefined,
      env,
      ctx: mockCtx
    });
    
    console.log('✅ BACKGROUND: Successfully refreshed today\'s fixtures data');
  } catch (error) {
    console.error('❌ BACKGROUND: Error refreshing today\'s fixtures:', error);
  }
}

// Start the background refresh timer
function startBackgroundRefreshTimer(env: any) {
  if (!backgroundRefreshTimer) {
    console.log(`⏱️ Starting background refresh timer (every ${BACKGROUND_REFRESH_INTERVAL/1000}s)`);
    
    // Initial refresh
    refreshTodayFixtures(env).catch(err => {
      console.error('Failed initial background refresh:', err);
    });
    
    // Set up interval for regular refreshes
    backgroundRefreshTimer = setInterval(() => {
      refreshTodayFixtures(env).catch(err => {
        console.error('Failed background refresh:', err);
      });
    }, BACKGROUND_REFRESH_INTERVAL);
  }
}

app.get('/fixtures', zValidator('query', dateSchema), async (c) => {
  // Parse date and timezone from query
  const { date, timezone = 'UTC', live } = c.req.valid('query');
  
  // Get request start time for timing
  const requestStartTime = performance.now();
  
  try {
    // Get current UTC date as default
    const now = new Date();
    const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const defaultDate = format(utcNow, 'yyyy-MM-dd');
    const queryDate = date || defaultDate;
    
    // Use the getUtcDateInfo function to get date information
    const dateInfo = getUtcDateInfo(queryDate);
    const { isDateInThreeDayWindow, isTodayData, utcToday } = dateInfo;
    
    console.log(`📅 Handling request for date=${queryDate}, timezone=${timezone}, live=${live}, today=${utcToday}`);
    console.log(`🔍 Date is ${isDateInThreeDayWindow ? 'within' : 'outside'} the 3-day window`);
    
    // Get fixtures from service
    const { data: fixtures, source } = await fixturesService.getFixtures({
      date: queryDate, 
      timezone, 
      live,
      env: c.env,
      ctx: c.executionCtx
    });
    
    // Calculate load time for headers
    const responseTime = (performance.now() - requestStartTime).toFixed(2);
    
    // Set standard headers
    c.header('X-Response-Time', `${responseTime}ms`);
    c.header('X-UTC-Today', dateInfo.utcToday);
    c.header('X-Requested-Date', queryDate);
    c.header('X-In-Three-Day-Window', isDateInThreeDayWindow ? 'true' : 'false');
    c.header('X-Is-Today', isTodayData ? 'true' : 'false');
    c.header('X-Source', source);
    
    // Set data age text based on source and whether it's today's data
    let dataAge = 'Unknown';
    if (source === 'API') {
      dataAge = '<15s';
    } else if (source === 'R2') {
      if (isTodayData) {
        dataAge = '<20s';
      } else {
        dataAge = '<1h';
      }
    }
    c.header('X-Data-Age', dataAge);
    
    // Set TTL header
    const ttl = isTodayData ? 20 : 3600;
    c.header('X-TTL', `${ttl}s`);
    
    // Set Cache-Control header to match our desired cache policy
    if (isTodayData) {
      // For today's data, use no-cache to force browser to revalidate with server on each request
      // This allows our worker to decide to use its cache or not, but prevents browser caching
      c.header('Cache-Control', 'no-cache, must-revalidate, max-age=0');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    } else if (isDateInThreeDayWindow) {
      // For yesterday/tomorrow, also use no-store but with a longer stale-while-revalidate for CF
      c.header('Cache-Control', 'no-cache, must-revalidate, max-age=0'); 
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    } else {
      // For older dates, allow longer caching
      c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    }
    
    return c.json({
      status: 'success',
      date: queryDate,
      timezone,
      source,
      data: fixtures
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return c.json({
      status: 'error',
      message: 'Failed to fetch fixtures',
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Initialize background refresh timer on first request
    startBackgroundRefreshTimer(env);
    
    // Configure CORS for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-Response-Time, X-Source, X-TTL, X-UTC-Today, X-Requested-Date, X-In-Three-Day-Window, X-Cache-Status, X-Is-Today, X-Data-Age, Cache-Control, Pragma, Expires',
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Create a request context with timing info
    const requestStartTime = performance.now();
    
    // Create Hono app context
    const c = app.fetch(request, env, ctx);
    
    // Create response with timing and CORS headers
    const response = await c;
    const headers = new Headers(response.headers);
    
    // Add response time
    const responseTime = (performance.now() - requestStartTime).toFixed(2);
    headers.set('X-Response-Time', `${responseTime}ms`);
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Return enhanced response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
  
  // Initialize the worker - runs once when the worker starts
  async scheduled(event: any, env: any, ctx: ExecutionContext) {
    console.log(`⚡ Scheduled event triggered: ${event.cron}`);
    // Refresh data on schedule
    refreshTodayFixtures(env).catch(err => {
      console.error('Error in scheduled refresh:', err);
    });
  }
};