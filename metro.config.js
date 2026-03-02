const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Ensure the NativeWind cache directory exists before bundling
// This prevents the SHA-1 error in CI/Railway environments
const fs = require("fs");
const cacheDir = path.join(__dirname, "node_modules/react-native-css-interop/.cache");
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

module.exports = withNativeWind(config, {
  input: "./global.css",
});
