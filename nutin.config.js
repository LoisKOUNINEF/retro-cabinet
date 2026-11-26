export default {
  // Nutin options
  tailwind: false,         // Enable Tailwind CSS v4
  i18n: [],                // Supported languages, default first (`['en', 'fr']`). `[]` means disabled.
  generateSEOFiles: true, // Generate per-route HTML, robots.txt and sitemap.xml; configure SEO data in config/seo.json

  // Nutin features
  dockerPorts: [9002],     // Ports the Docker container exposes/listens on — edit as needed

  // Build pipeline
  builder: {
    sass: {
      paths: [ 
        'base', 
      ], // Directories in styles/ to include in the Sass load path
    },

    esbuild: {
      bundle: true,
      minify: true,
      sourcemap: false,
      target: ['es2020'],
      drop: ['console', 'debugger'],
    },
  },

  // Testing toolkit
  // `npm run testin-nutin`
  testinNutin: {
    includeFramework: false, // Test Nutin source: src/core
    includeTools: false,     // Test tools/ (builder, testin-nutin, etc.)
    includeApp: true,        // Include application tests: src/app
    isolate: {
      loadTimeout: 30,       // Seconds each isolated file may take to load before it's reported as failed
      files: [               // Test files (path substrings) that each run in their own worker and jsdom window
        'views/bonus/',
        'views/game/',
      ],
    },

    coverage: {
      enabled: false,        // Include coverage in the normal test command
      threshold: 90,         // Fail if any global coverage metric falls below this threshold
      reportUncovered: true, // Generate a report of uncovered lines, functions and branches
    },

    jsdomOptions: {
      runScripts: false,
      resources: false,
      freezeGlobals: false,
      pretendToBeVisual: true,
    },
  },
}
