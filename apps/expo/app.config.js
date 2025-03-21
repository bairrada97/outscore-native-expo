module.exports = ({ config }) => {
  // Load environment variables
  // For local development, they'll come from the .env file
  // For production, they'll be set in the build environment
  return {
    ...config,
    extra: {
      ...config.extra,
      // For dev: Will use fallback
      // For production: Will be set through environment variables
      apiKey: process.env.EXPO_API_KEY || null,
    },
    // Prevent accidentally exposing API keys in your source code
    hooks: {
      postPublish: [
        {
          file: 'expo-env-sanitizer',
          config: {
            stripEnv: true,
          },
        },
      ],
    },
  };
}; 