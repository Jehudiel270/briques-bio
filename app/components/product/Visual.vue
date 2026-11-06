<script setup lang="ts">
/**
 * Visuel procédural (SVG isométrique) d'un élément en plastique recyclé moucheté.
 * Aucune photo : la forme dépend de `pattern`, la couleur de `tone` (hex fourni par la fiche produit),
 * les mouchetures sont déterministes d'après `seed` (même produit → même visuel).
 */
const props = withDefaults(defineProps<{ pattern?: 'paver' | 'slab' | 'kerb' | 'tile' | 'plank' | 'block'; tone?: string; seed?: string | number; size?: number; shadow?: boolean }>(), {
  pattern: 'paver',
  tone: '#5f7a6a',
  seed: 'ecobloc',
  shadow: true,
})

type V3 = [number, number, number]
type V2 = [number, number]
const proj = ([x, y, z]: V3): V2 => [(x - y) * 0.866, (x + y) * 0.5 - z]

interface BoxSpec { x: number; y: number; w: number; d: number; h: number; grooves?: { axis: 'x' | 'y'; n: number }; holes?: boolean; bevel?: boolean }

const specs = computed<BoxSpec[]>(() => {
  switch (props.pattern) {
    case 'slab': return [{ x: 0, y: 0, w: 104, d: 104, h: 14, grooves: { axis: 'x', n: 2 } }]
    case 'kerb': return [{ x: 0, y: 0, w: 128, d: 34, h: 46, bevel: true }]
    case 'tile': return [{ x: 0, y: 0, w: 92, d: 92, h: 8, grooves: { axis: 'y', n: 3 } }]
    case 'plank': return [{ x: 0, y: 0, w: 132, d: 46, h: 10, grooves: { axis: 'y', n: 5 } }]
    case 'block': return [{ x: 0, y: 0, w: 72, d: 72, h: 62, holes: true }]
    default: return [
      { x: 0, y: 0, w: 52, d: 52, h: 28, bevel: true },
      { x: 58, y: 8, w: 52, d: 52, h: 28, bevel: true },
      { x: 20, y: 62, w: 52, d: 52, h: 28, bevel: true },
    ]
  }
})

// générateur pseudo-aléatoire déterministe
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const scene = computed(() => {
  const rand = rng(String(props.seed) + props.pattern)
  const boxes = [...specs.value].sort((a, b) => a.x + a.y - (b.x + b.y))
  const pts: V2[] = []
  for (const b of boxes) for (const [x, y, z] of [[b.x, b.y, b.h], [b.x + b.w, b.y, b.h], [b.x + b.w, b.y + b.d, 0], [b.x, b.y + b.d, 0], [b.x + b.w, b.y, 0], [b.x, b.y, 0], [b.x + b.w, b.y + b.d, b.h], [b.x, b.y + b.d, b.h]] as V3[]) pts.push(proj([x, y, z]))
  const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0]))
  const minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]))
  const W = 240, H = 180, pad = 22
  const k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2 - 8) / (maxY - minY))
  const ox = W / 2 - ((minX + maxX) / 2) * k
  const oy = H / 2 - 4 - ((minY + maxY) / 2) * k
  const P = (v: V3): V2 => { const [x, y] = proj(v); return [ox + x * k, oy + y * k] }
  const poly = (vs: V3[]) => vs.map((v) => P(v).map((n) => n.toFixed(1)).join(',')).join(' ')

  const dot = (list: string[], c: V2, r: number) => list.push(`M${(c[0] - r).toFixed(1)} ${c[1].toFixed(1)}a${r.toFixed(2)} ${(r * 0.8).toFixed(2)} 0 1 0 ${(r * 2).toFixed(1)} 0a${r.toFixed(2)} ${(r * 0.8).toFixed(2)} 0 1 0 ${(-r * 2).toFixed(1)} 0`)
  let light: string[] = [], dark: string[] = [], mid: string[] = []
  const speckle = (o: V3, u: V3, v: V3, count: number) => {
    for (let i = 0; i < count; i++) {
      const a = rand(), b = rand()
      const c = P([o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b])
      const r = 0.5 + rand() * rand() * 2.1
      const t = rand()
      dot(t < 0.4 ? light : t < 0.75 ? dark : mid, c, r)
    }
  }

  const items = boxes.map((b, bi) => {
    const { x, y, w, d, h } = b
    light = []; dark = []; mid = []
    const top: V3[] = [[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]]
    const faceY: V3[] = [[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]]
    const faceX: V3[] = [[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]]
    const density = Math.round((w * d) / 38)
    speckle([x, y, h], [w, 0, 0], [0, d, 0], density)
    speckle([x, y + d, 0], [w, 0, 0], [0, 0, h], Math.round((w * h) / 55))
    speckle([x + w, y, 0], [0, d, 0], [0, 0, h], Math.round((d * h) / 55))
    const grooves: string[] = []
    if (b.grooves) {
      const { axis, n } = b.grooves
      for (let i = 1; i < n + (axis === 'y' && b.h < 12 && n > 2 ? 0 : 0); i++) {
        const t = i / n
        const a = axis === 'x' ? [x + w * t, y, h] as V3 : [x, y + d * t, h] as V3
        const c = axis === 'x' ? [x + w * t, y + d, h] as V3 : [x + w, y + d * t, h] as V3
        grooves.push(`M${P(a).join(' ')}L${P(c).join(' ')}`)
      }
      if (b.h > 12) { // dalle : joint dans les deux sens
        for (let i = 1; i < n; i++) {
          const t = i / n
          grooves.push(`M${P([x, y + d * t, h]).join(' ')}L${P([x + w, y + d * t, h]).join(' ')}`)
        }
      }
    }
    const holes: V2[][] = []
    if (b.holes) {
      for (const cx of [0.3, 0.7]) {
        const ring: V2[] = []
        for (let a = 0; a < 24; a++) {
          const t = (a / 24) * Math.PI * 2
          ring.push(P([x + w * cx + Math.cos(t) * 11, y + d * 0.5 + Math.sin(t) * 11, h]))
        }
        holes.push(ring)
      }
    }
    const bevel = b.bevel ? poly([[x + 3, y + 3, h], [x + w - 3, y + 3, h], [x + w - 3, y + d - 3, h], [x + 3, y + d - 3, h]]) : ''
    const shadow = poly([[x + 4, y + d + 2, 0], [x + w + 3, y + d + 2, 0], [x + w + 14, y + d - 2, 0], [x + w + 14, y + 6, 0], [x + w + 6, y + 2, 0], [x + 6, y + 2, 0]])
    return { key: bi, light: light.join(''), dark: dark.join(''), mid: mid.join(''), top: poly(top), faceY: poly(faceY), faceX: poly(faceX), grooves: grooves.join(''), holes: holes.map((r) => 'M' + r.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L') + 'Z').join(''), bevel, shadow }
  })
  return { items, k }
})
const base = computed(() => props.tone)
</script>

<template>
  <svg viewBox="0 0 240 180" role="img" :aria-label="`Visuel illustratif, ${pattern}`" preserveAspectRatio="xMidYMid meet" :width="size" :height="size ? size * 0.75 : undefined" class="block bg-surface-2/60">
    <rect width="240" height="180" fill="var(--surface-2)" opacity="0.5" />
    <g v-for="it in scene.items" :key="it.key">
      <polygon v-if="shadow" :points="it.shadow" fill="var(--ink)" opacity="0.13" />
      <polygon :points="it.faceY" :style="{ fill: `color-mix(in oklab, ${base} 76%, black)` }" />
      <polygon :points="it.faceX" :style="{ fill: `color-mix(in oklab, ${base} 58%, black)` }" />
      <polygon :points="it.top" :style="{ fill: base }" />
      <!-- mouchetures : plastiques broyés de couleurs mêlées -->
      <path :d="it.dark" style="fill: color-mix(in oklab, black 55%, transparent)" />
      <path :d="it.mid" :style="{ fill: `color-mix(in oklab, ${base} 40%, white)`, opacity: 0.7 }" />
      <path :d="it.light" style="fill: color-mix(in oklab, white 78%, transparent)" />
      <polygon :points="it.top" fill="none" style="stroke: color-mix(in oklab, white 30%, transparent)" stroke-width="1" stroke-linejoin="round" />
      <polygon v-if="it.bevel" :points="it.bevel" fill="none" style="stroke: color-mix(in oklab, white 22%, transparent)" stroke-width="1.2" stroke-linejoin="round" />
      <path v-if="it.grooves" :d="it.grooves" fill="none" :style="{ stroke: `color-mix(in oklab, ${base} 45%, black)` }" stroke-width="1.6" stroke-linecap="round" />
      <path v-if="it.holes" :d="it.holes" :style="{ fill: `color-mix(in oklab, ${base} 30%, black)` }" fill-rule="evenodd" />
    </g>
  </svg>
</template>
