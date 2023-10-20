/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');
const path = require('path');

const nextConfig = {
  i18n,
  output: 'standalone',
  reactStrictMode: process.env.NODE_ENV === 'development' ? false : true,
  compress: true,
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve.fallback,
          fs: false
        }
      };
    }
    Object.assign(config.resolve.alias, {
      '@mongodb-js/zstd': false,
      '@aws-sdk/credential-providers': false,
      snappy: false,
      aws4: false,
      'mongodb-client-encryption': false,
      kerberos: false,
      'supports-color': false,
      'bson-ext': false
    });
    config.module = {
      ...config.module,
      rules: config.module.rules.concat([
        {
          test: /\.svg$/i,
          issuer: /\.[jt]sx?$/,
          use: ['@svgr/webpack']
        },
        {
          test: /\.css$/i,//指明需要匹配什么样的文件类型
          use: ['style-loader', 'css-loader'],//数组写法是由解析顺序的，从后往前的顺序解析
        },
        {
          test: /\.scss$/i,//指明需要匹配什么样的文件类型
          use: ['style-loader', 'css-loader', 'sass-loader'],//数组写法是由解析顺序的，从后往前的顺序解析
        },
      ]),
      exprContextCritical: false,
      unknownContextCritical: false,
      sassOptions: {
        includePaths: [path.join(__dirname, 'styles')],
      },
    };

    return config;
  },
  transpilePackages: ['@fastgpt/*'],
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
    outputFileTracingRoot: path.join(__dirname, '../../')
  }
};

module.exports = nextConfig;
