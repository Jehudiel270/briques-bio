/** Applique le thème (mode, rayon, densité, couleurs) dès le démarrage, avant le premier rendu. */
export default defineNuxtPlugin({
  name: 'ecobloc:theme',
  setup() {
    useTheme()
  },
})
