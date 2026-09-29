import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './src/main.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash:8].js',
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
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      // DefinePlugin statically replaces __API_BASE__ (and old
      // process.env.VITE_API_BASE) so the app needs no runtime 'process'.
      // Empty string = same origin (relative /api, proxied to the backend).
      __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
      'process.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || ''),
    }),
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
  ],
  devServer: {
    host: '0.0.0.0',
    port: 5173,
    hot: true,
    historyApiFallback: true,
    allowedHosts: 'all',
    proxy: [
      {
        context: ['/api', '/catalog'],
        target: 'http://localhost:9000',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    ],
  },
};
