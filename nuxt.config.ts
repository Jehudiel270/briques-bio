import tailwindcss from '@tailwindcss/vite'

// Anti-flash : applique le thème et la densité avant le premier rendu.
const themeBootScript = `
(function () {
  try {
    var raw = localStorage.getItem('ecobloc:theme');
    var s = raw ? JSON.parse(raw) : {};
    var mode = s.mode || 'system';
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var el = document.documentElement;
    el.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (s.density) el.setAttribute('data-density', s.density);
    if (s.radius) el.setAttribute('data-radius', s.radius);
    var o = (s.overrides && s.overrides[dark ? 'dark' : 'light']) || {};
    for (var k in o) if (o[k]) el.style.setProperty('--' + k, o[k]);
  } catch (e) {}
})();
`

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Prototype : SPA. Les données de démo vivent dans le navigateur (localStorage)
  // ou dans Neon via /api ; le SSR pourra être réactivé route par route plus tard.
  ssr: false,

  modules: ['@nuxt/icon', '@vueuse/nuxt'],
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  icon: {
    // Collection Lucide servie localement (aucun appel à l'API Iconify publique).
    // Par défaut `iconify` quand ssr:false : on force le gestionnaire serveur (Nitro) pour ne jamais appeler l'API publique.
    provider: 'server',
    fallbackToApi: false,
    serverBundle: 'local',
    clientBundle: { scan: true },
    class: 'shrink-0',
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'EcoBloc — matériaux d’aménagement issus de plastiques valorisés',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Prototype de plateforme B2B EcoBloc : catalogue, devis, collecte, production, qualité et traçabilité par lot. Données de démonstration fictives.' },
        { name: 'theme-color', content: '#0F4A39' },
      ],
      script: [{ innerHTML: themeBootScript, tagPosition: 'head' }],
    },
  },

  runtimeConfig: {
    // Serveur uniquement
    databaseUrl: process.env.DATABASE_URL || '',
    neonAuthBaseUrl: process.env.NEON_AUTH_BASE_URL || '',
    neonAuthJwksUrl: process.env.NEON_AUTH_JWKS_URL || '',
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
      folder: process.env.CLOUDINARY_FOLDER || 'ecobloc',
    },
    // Exposé au navigateur
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'EcoBloc',
      dataMode: process.env.NUXT_PUBLIC_DATA_MODE || 'auto', // auto | neon | local
      demoMode: (process.env.NUXT_PUBLIC_DEMO_MODE ?? 'true') !== 'false',
      neonAuthUrl: process.env.NUXT_PUBLIC_NEON_AUTH_URL || '',
      cloudinaryCloudName: process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
      cloudinaryFolder: process.env.NUXT_PUBLIC_CLOUDINARY_FOLDER || 'ecobloc',
    },
  },

  typescript: { strict: true, typeCheck: false },
})
