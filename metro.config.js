// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push(
  // إضافة دعم للملفات الإضافية
  'cjs'
);

config.transformer.minifierConfig = {
  compress: {
    drop_console: process.env.NODE_ENV === 'production',
  },
};

module.exports = config;