// @ts-check
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";
import sitemap from "@astrojs/sitemap";

import { SITE_URL } from "./src/consts";

import remarkFigureCaption from '@microflash/remark-figure-caption';
import remarkDirective from 'remark-directive';
import remarkCalloutDirectives from "./src/components/mdrenders/remark-callout-directives-customized.mjs";
import remarkNeoDB from "./src/components/mdrenders/remark-neodb-card.mjs";
import { remarkModifiedTime } from './src/components/mdrenders/remark-modified-time.mjs';

import astroExpressiveCode from 'astro-expressive-code';
import tailwindcss from "@tailwindcss/vite";

// 判断是否为开发环境
const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  // ✅ 你的网站地址
  site: 'https://changingmoments.one',

  build: {
    format: "file",
  },

  integrations: [
    astroExpressiveCode({
      themes: ['andromeeda', 'dracula'],
    }),
    sitemap(),
    pagefind(),
  ],

  markdown: {
    shikiConfig: {
      themes: {
        light: "catppuccin-latte",
        dark: "catppuccin-mocha",
      },
    },
    remarkPlugins: [
      remarkFigureCaption,
      !isDev && remarkNeoDB,   // 🚀 仅在生产启用
      remarkDirective,
      remarkCalloutDirectives,
      remarkModifiedTime,
    ].filter(Boolean),          // 过滤掉 false
  },

  vite: {
    plugins: [tailwindcss()],
  },
});