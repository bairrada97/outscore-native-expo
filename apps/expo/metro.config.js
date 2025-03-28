const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const {
    wrapWithReanimatedMetroConfig,
  } = require('react-native-reanimated/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Create the default Metro config
const config = getDefaultConfig(projectRoot);

// Add the workspace root to the watch folders so Metro can find our packages
config.watchFolders = [workspaceRoot];

// Configure resolver to handle workspace packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Add support for importing from workspace packages
config.resolver.disableHierarchicalLookup = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // First, try to resolve workspace packages
  if (moduleName.startsWith('@outscore/')) {
    const packageName = moduleName.split('/')[1];
    const packagePath = path.resolve(workspaceRoot, 'packages', packageName);
    try {
      const result = context.resolveRequest(
        context,
        path.join(packagePath, 'dist', 'index.js'),
        platform
      );
      if (result) return result;
    } catch (e) {
      // Fall through to default resolution
    }
  }
  
  // Otherwise use default resolution
  return context.resolveRequest(context, moduleName, platform);
};

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
  },
});

module.exports = withNativeWind(config, { input: './global.css' }) 