const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")
const config = getDefaultConfig(projectRoot)

// This monorepo also contains React 18 web/admin workspaces. Native bundles must
// resolve every peer import (including SWR's) to the mobile React 19 instance;
// two React runtimes cause an immediate invalid-hook-call crash in Release.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [projectRoot] }),
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
