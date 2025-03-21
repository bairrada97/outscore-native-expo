import { generateApiKey } from './utils/api-key';

// Generate a secure API key
const apiKey = generateApiKey('outscore_');
console.log('Your secure API key:');
console.log(apiKey);
console.log('\nAdd this to your wrangler.toml file as:');
console.log(`API_KEY_SECRET = "${apiKey}"`);
console.log('\nAnd in your frontend, make sure to include this header in all API requests:');
console.log('X-API-Key: ' + apiKey); 