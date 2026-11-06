/**
 * Apparition au défilement (GSAP + ScrollTrigger, importés à la demande côté client).
 *   const root = ref<HTMLElement>(); useReveal(root)
 * Anime les éléments `[data-reveal]` (et `[data-reveal-group]` pour un décalage en cascade).
 * Rien n'est animé si l'utilisateur préfère réduire les animations : les éléments restent visibles.
 */
import type { Ref } from 'vue'

export function useReveal(root: Ref<HTMLElement | null | undefined>, opts: { y?: number; stagger?: number } = {}) {
  let ctx: { revert: () => void } | null = null
  onMounted(async () => {
    if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    gsap.registerPlugin(ScrollTrigger)
    if (!root.value) return
    ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>('[data-reveal]', root.value!)
      els.forEach((el) => {
        const kids = el.hasAttribute('data-reveal-group') ? (Array.from(el.children) as HTMLElement[]) : [el]
        gsap.set(kids, { opacity: 0, y: opts.y ?? 22 })
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          once: true,
          onEnter: () => gsap.to(kids, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: opts.stagger ?? 0.08, clearProps: 'transform' }),
        })
      })
    }, root.value)
  })
  onBeforeUnmount(() => ctx?.revert())
}

/** Compteur animé : renvoie une ref qui monte jusqu'à `target` quand l'élément devient visible. */
export function useCountUp(target: () => number, el: Ref<HTMLElement | null | undefined>, duration = 1.4) {
  const shown = ref(0)
  onMounted(async () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shown.value = target()
      return
    }
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')])
    gsap.registerPlugin(ScrollTrigger)
    const obj = { v: 0 }
    ScrollTrigger.create({
      trigger: el.value!,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(obj, { v: target(), duration, ease: 'power2.out', onUpdate: () => (shown.value = Math.round(obj.v)) }),
    })
  })
  watch(target, (t) => { if (shown.value) shown.value = t })
  return shown
}
