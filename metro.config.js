// expo-sqlite 在网页预览里需要打包 .wasm 文件，并且浏览器要开启跨源隔离才能用 SharedArrayBuffer。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhancedMiddleware = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhancedMiddleware(req, res, next);
  };
};

// Claude SDK 的 ESM 文件之间有循环引用，开发模式的热更新会在模块还没初始化完时读取它们的导出而报错。
// 让 SDK 走它自带的 CommonJS 版本：同样的循环引用在那里只会读到 undefined，不会报错。
const anthropicSdk = '@anthropic-ai/sdk';
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolveRequest ?? context.resolveRequest;
  if (moduleName === anthropicSdk || moduleName.startsWith(`${anthropicSdk}/`)) {
    // Metro 会给 import 语句自动加上 "import" 条件，这里按 require 来解析
    const conditionNames = context.unstable_conditionNames.filter((name) => name !== 'import');
    return resolve({ ...context, isESMImport: false, unstable_conditionNames: conditionNames }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
