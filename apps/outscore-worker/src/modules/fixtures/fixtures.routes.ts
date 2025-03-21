import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { fixturesService } from './fixtures.service';
import { isValidTimezone } from '../timezones';

const fixturesRoutes = new Hono();

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

const handleGetFixtures = async (c: any) => {
  let queryDate: string | undefined;
  let queryTimezone: string = "UTC";
  let live: 'all' | undefined;

  try {
    const { date, timezone, live: isLive } = c.req.valid('query');
    queryDate = date;
    queryTimezone = timezone;
    live = isLive;
    
    const fixtures = await fixturesService.getFixtures({ date, timezone, live });
      
    return c.json({
      success: true,
      data: fixtures,
      meta: {
        date: queryDate || new Date().toISOString().split('T')[0],
        timezone: queryTimezone,
        live: isLive,
      } 
    });
  } catch (error: any) {
    console.error('Error in fixtures route:', error);
    
    let errorMessage = 'Failed to fetch fixtures';
    let statusCode = 500;

    if (error.message?.includes('API rate limit exceeded')) {
      errorMessage = 'API rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('API request failed')) {
      errorMessage = 'External API request failed. Please try again later.';
      statusCode = 502;
    } else if (error.message?.includes('Invalid timezone')) {
      errorMessage = error.message;
      statusCode = 400;
    }

    return c.json({
      success: false,
      error: errorMessage,
      meta: {
        date: queryDate || new Date().toISOString().split('T')[0],
        timezone: queryTimezone,
        live: live,
      }
    }, statusCode);
  }
};

fixturesRoutes.get('/', zValidator('query', dateSchema), handleGetFixtures);

export { fixturesRoutes }; 