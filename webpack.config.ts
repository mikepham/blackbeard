import * as fs from 'fs'
import * as path from 'path'
import * as wb from 'webpack'

const npm = JSON.parse(fs.readFileSync(path.resolve('package.json')).toString())

const configuration: wb.Configuration = {
  context: path.resolve('srcweb'),
  devServer: {
    historyApiFallback: true,
    inline: true,
    port: 3000,
  },
  devtool: '#@source-map',
  entry: {
    app: './App.tsx',
    vendor: Object.keys(npm.dependencies),
  },
  module: {
    rules: [{
      test: /\.html$/,
      use: ['html-loader'],
    }, {
      test: /\.scss$/,
      use: ['style-loader', 'css-loader', 'sass-loader'],
    }, {
      test: /\.tsx?$/,
      use: ['babel-loader', 'ts-loader'],
    }]
  },
  output: {
    chunkFilename: '[name]-chunk.js',
    filename: '[name]-bundle.js',
    path: path.resolve('dist/app-web'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    modules: [
      path.resolve('src'),
      path.resolve('srcweb'),
      path.resolve('node_modules'),
    ]
  },
  target: 'web'
}

export default configuration
