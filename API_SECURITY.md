# OutScore API Security

The OutScore API uses a dual-tier authentication system for optimal security:

1. **Origin-Based Authentication** (Primary)
2. **API Key Authentication** (Secondary)

## Origin-Based Authentication

For regular web and mobile app access, the API uses origin-based authentication:

- The API server checks the `Origin` header of incoming requests
- Only requests from approved origins (configured in `APPROVED_ORIGINS`) are allowed
- This is secure because browsers enforce the Origin header (it cannot be spoofed by client-side code)

### Approved Origins

The following origins are configured to be approved:
- https://outscore.live (Production)
- http://localhost:3000 (Local development)
- http://localhost:8081 (Local development)

You can modify this list in the `wrangler.toml` file by updating the `APPROVED_ORIGINS` variable.

## API Key Authentication

The API key is a secondary authentication method used only for:

- Server-to-server communication
- Admin tools or CLI tools
- Accessing the API outside of a browser context

### Setting Up the API Key

1. Generate a secure random API key:
   ```bash
   # Using OpenSSL (recommended)
   openssl rand -base64 32
   
   # Or using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Set this API key in your `wrangler.toml` file:
   ```toml
   [vars]
   API_KEY_SECRET = "your-generated-secure-key-here"
   ```

3. For production, consider using Cloudflare secrets instead:
   ```bash
   npx wrangler secret put API_KEY_SECRET
   ```

## Why This Approach Is Secure

Using origin-based authentication as the primary method offers several security advantages:

1. **No Exposed Secrets**: There's no need to include API keys in your frontend code
2. **No Man-in-the-Middle Risk**: Even if someone intercepts your request, they cannot reuse it from a different origin
3. **Simple User Experience**: End users don't need to manage API keys

The API key serves as a fallback for non-browser contexts where origin headers are not enforced.

## Security Best Practices

1. **Keep your approved origins list restrictive**
2. **Regularly rotate your API key** (used for secondary authentication)
3. **Monitor API usage patterns** for unusual activity
4. **Use HTTPS** for all communication
5. **Implement rate limiting** to prevent abuse

By implementing this dual-tier authentication approach, the OutScore API remains secure while providing a seamless experience for legitimate users. 