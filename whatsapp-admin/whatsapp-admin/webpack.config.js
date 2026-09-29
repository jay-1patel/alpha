import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/main.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
      chunkFilename: isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
      clean: true,
      publicPath: '/',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: { loader: 'ts-loader', options: { transpileOnly: true } },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
            'postcss-loader',
          ],
        },
      ],
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 25,
        maxAsyncRequests: 25,
        minSize: 20000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: 'react-vendor',
            chunks: 'all',
            priority: 20,
          },
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|class-variance-authority|clsx|tailwind-merge)[\\/]/,
            name: 'ui-vendor',
            chunks: 'all',
            priority: 15,
          },
          charts: {
            test: /[\\/]node_modules[\\/](recharts|decimal\.js-light)[\\/]/,
            name: 'charts-vendor',
            chunks: 'all',
            priority: 15,
          },
          'd3-scale': {
            test: /[\\/]node_modules[\\/]d3-scale[\\/]/,
            name: 'd3-scale-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-shape': {
            test: /[\\/]node_modules[\\/]d3-shape[\\/]/,
            name: 'd3-shape-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-array': {
            test: /[\\/]node_modules[\\/]d3-array[\\/]/,
            name: 'd3-array-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-time': {
            test: /[\\/]node_modules[\\/]d3-time[\\/]/,
            name: 'd3-time-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-color': {
            test: /[\\/]node_modules[\\/]d3-color[\\/]/,
            name: 'd3-color-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-format': {
            test: /[\\/]node_modules[\\/]d3-format[\\/]/,
            name: 'd3-format-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-interpolate': {
            test: /[\\/]node_modules[\\/]d3-interpolate[\\/]/,
            name: 'd3-interpolate-vendor',
            chunks: 'all',
            priority: 16,
          },
          'd3-path': {
            test: /[\\/]node_modules[\\/]d3-path[\\/]/,
            name: 'd3-path-vendor',
            chunks: 'all',
            priority: 16,
          },
        },
      },
      runtimeChunk: 'single',
    },
    performance: isProduction ? {
      hints: 'warning',
      maxAssetSize: 300 * 1024,
      maxEntrypointSize: 700 * 1024,
    } : false,
    plugins: [
      new webpack.DefinePlugin({
        'process.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || ''),
      }),
      ...(isProduction
        ? [
            new MiniCssExtractPlugin({
              filename: '[name].[contenthash:8].css',
            }),
          ]
        : []),
      new HtmlWebpackPlugin({
        template: './index.html',
      }),
    ],
    devServer: {
      port: 5173,
      hot: true,
      historyApiFallback: true,
      client: {
        logging: 'warn',
      },
    },
  };
};
