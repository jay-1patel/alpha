/// <reference types="webpack/module" />

declare namespace NodeJS {
  interface ProcessEnv {
    /** Backend base URL, e.g. http://localhost:9000 (see src/lib/config.ts) */
    readonly VITE_API_BASE?: string
  }
}
