import { Hono } from 'hono';
import { getTimezones } from './timezones.service';

const timezonesRoutes = new Hono();

const handleGetTimezones = async (c: any) => {
  try {
    const timezones = await getTimezones();
    return c.json({
      success: true,
      data: timezones,
    });
  } catch (error) {
    console.error('Error in timezones route:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch timezones',
    }, 500);
  }
};

timezonesRoutes.get('/', handleGetTimezones);

export { timezonesRoutes }; 