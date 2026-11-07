const globals = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', location: 'readonly',
  history: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', fetch: 'readonly', Response: 'readonly',
  Request: 'readonly', Headers: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  Blob: 'readonly', File: 'readonly', FormData: 'readonly', FileReader: 'readonly',
  crypto: 'readonly', indexedDB: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
  alert: 'readonly', confirm: 'readonly', prompt: 'readonly', structuredClone: 'readonly',
  TextEncoder: 'readonly', TextDecoder: 'readonly', AbortSignal: 'readonly',
  DOMException: 'readonly', btoa: 'readonly', atob: 'readonly', queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', CustomEvent: 'readonly',
  Event: 'readonly', HTMLElement: 'readonly', Node: 'readonly', MutationObserver: 'readonly',
  DOMParser: 'readonly', getComputedStyle: 'readonly', innerWidth: 'readonly',
  process: 'readonly', Buffer: 'readonly', global: 'readonly', globalThis: 'readonly',
  __dirname: 'readonly', __filename: 'readonly', module: 'readonly', require: 'readonly',
  exports: 'readonly'
};

export default [{
  files: ['**/*.js', '**/*.mjs'],
  ignores: ['app.bundle.js', 'zip-inflate.js', 'node_modules/**', '.venv/**',
    'arquivo/**', 'audit-context/**', 'release-offline-deps/**', 'docs/ui-test/**'],
  languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals},
  rules: {
    'no-unused-vars': ['error', {args: 'none', varsIgnorePattern: '^_'}],
    'no-undef': 'error',
    'no-unreachable': 'error',
    'eqeqeq': ['warn', 'smart']
  }
}];
