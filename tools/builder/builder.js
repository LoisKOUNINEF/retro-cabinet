#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { print, runScript, acquireBuildLock } from '../utils/index.js';
import { builderConfig } from './builder.config.js';
import { PATHS } from './core/app/paths.js';

// Must happen before copy-static.js wipes/recreates dist-build.
// A second build starting mid-run would otherwise race it. See tools/utils/build-lock.js.
await acquireBuildLock();

const scriptsDir = path.join(process.cwd(), 'tools', 'builder', 'core');
// --debug: every error's stack (tools/utils/error-exit.js), in every step, through the env too.
if (process.argv.includes('--debug')) process.env.NUTIN_DEBUG = '1';

// `typecheck`: only what tsc needs (the merged templates, the handler references) and tsc --noEmit.
// A plain `tsc` reports every template-only handler as unused. dist/ is left as it is.
if (builderConfig.typecheckOnly) {
  print.boldHead(`\nType-checking...`);
  runScript(path.join(scriptsDir, 'app', 'copy-static.js'), 'Copying files...');
  runScript(path.join(scriptsDir, 'html-templates', 'process-html-templates.js'), 'Processing HTML templates...');
  runScript(path.join(scriptsDir, 'app', 'compile-ts.js'), 'Checking types...');
  fs.rmSync(PATHS.temp, { recursive: true, force: true });
  print.boldSuccess(`\nNo type errors.\n`);
  process.exit(0);
}

print.boldHead(`\nStarting build...`);

if (builderConfig.i18nListsNoLanguage) {
  print.warn('nutin.config.js "i18n: true" lists no language: building for English only. List them instead, the default first: i18n: [\'en\', ...].');
}

// runScript forwards env vars but not argv, so -y/--yes is passed through the env.
if (process.argv.includes('-y') || process.argv.includes('--yes')) process.env.NUTIN_ASSUME_YES = '1';

runScript(path.join(scriptsDir, 'app', 'copy-static.js'), 'Copying files...');

runScript(path.join(scriptsDir, 'html-index', 'validate-html.js'), 'Processing index.html...');
runScript(path.join(scriptsDir, 'app', 'validate-routes.js'), 'Validating app routes...');

runScript(path.join(scriptsDir, 'html-templates', 'process-html-templates.js'), 'Processing HTML templates...');
// After the templates are merged, so they're type-checked too.
runScript(path.join(scriptsDir, 'app', 'compile-ts.js'), 'Compiling TypeScript...');
runScript(path.join(scriptsDir, 'html-templates', 'minify-templates.js'), 'Minifying HTML templates...');

runScript(path.join(scriptsDir, 'styles', 'sass.js'), 'Compiling styles...');
if (builderConfig.tailwind) runScript(path.join(scriptsDir, 'styles', 'tailwind.js'), 'Compiling Tailwind CSS...');

if (builderConfig.i18n) runScript(path.join(scriptsDir, 'i18n', 'build-i18n.js'), 'Combining locales...');

// After every runtime JSON file is written, before the bundles that get their hashed URLs.
if (builderConfig.isProd) runScript(path.join(scriptsDir, 'prod-bundle', 'hash-data-files.js'), 'Hashing data files...');

runScript(path.join(scriptsDir, 'prod-bundle', 'esbuild.js'), 'Running esbuild...');

if (builderConfig.isProd) {
  runScript(path.join(scriptsDir, 'prod-bundle', 'hash-files.js'), 'Hashing files...');
  if (builderConfig.generateSEO) runScript(path.join(scriptsDir, 'seo', 'generate-seo-files.js'), 'Generating SEO Files...');
  // Last, so the prerendered SEO pages, sitemap.xml and robots.txt get compressed too.
  runScript(path.join(scriptsDir, 'prod-bundle', 'compress-files.js'), 'Compressing files...');
}

runScript(path.join(scriptsDir, 'finalize-build.js'), 'Finalizing build...');

print.boldSuccess(`\nBuild successful!\n`);

// Not on every rebuild of the dev loop (tools/dev sets NUTIN_WATCH).
if (!builderConfig.isProd && process.env.NUTIN_WATCH !== '1') print.info('For production, use "npm run build:prod".');
