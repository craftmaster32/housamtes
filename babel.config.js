// Custom plugin: replaces import.meta with a safe fallback for Metro/web CJS bundles
const importMetaPlugin = () => ({
  visitor: {
    MetaProperty(path) {
      if (
        path.node.meta.name === 'import' &&
        path.node.property.name === 'meta'
      ) {
        path.replaceWithSourceString('({ url: "" })');
      }
    },
  },
});

module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      importMetaPlugin,
      // Strip all console.log/info calls from production builds so internal
      // data never appears in device logs. console.warn and console.error are kept.
      ...(isProduction ? [['transform-remove-console', { exclude: ['warn', 'error'] }]] : []),
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': '.',
            '@components': './components',
            '@hooks': './hooks',
            '@stores': './stores',
            '@types': './types',
            '@constants': './constants',
            '@utils': './utils',
            '@lib': './lib',
            '@locales': './locales',
          },
        },
      ],
    ],
  };
};
