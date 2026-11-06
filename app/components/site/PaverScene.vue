<script setup lang="ts">
/**
 * Scène 3D d'accueil : un champ de pavés en point de Hongrie qui se pose, puis ondule doucement et réagit au pointeur.
 * Three.js + GSAP chargés à la demande. Désactivée (repli statique) si : mouvement réduit, appareil modeste, WebGL absent.
 * Les couleurs suivent le thème courant (variables CSS) et se mettent à jour au changement de thème.
 */
const host = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const fallback = ref(false)
const ready = ref(false)
let dispose: (() => void) | null = null

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#808080'

onMounted(async () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mem = (navigator as any).deviceMemory ?? 8
  const weak = (navigator.hardwareConcurrency ?? 8) <= 2 || mem <= 2
  if (reduce || weak || !canvas.value || !host.value) {
    fallback.value = true
    return
  }
  try {
    const THREE = await import('three')
    const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js')
    const { gsap } = await import('gsap')
    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
    gsap.registerPlugin(ScrollTrigger)
    if (!canvas.value || !host.value) return

    const renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
    renderer.shadowMap.enabled = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 13, 15)
    camera.lookAt(0, 0, 0)

    // ---- éclairage
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445048, 1.15))
    const sun = new THREE.DirectionalLight(0xffffff, 2.1)
    sun.position.set(-6, 12, 8)
    scene.add(sun)

    // ---- matière : plastique recyclé moucheté (texture procédurale)
    const tex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')!
      g.fillStyle = '#d9d9d9'
      g.fillRect(0, 0, 256, 256)
      let s = 7
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 900; i++) {
        const v = 120 + Math.floor(rnd() * 135)
        g.fillStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`
        const r = 0.6 + rnd() * 2.4
        g.beginPath()
        g.arc(rnd() * 256, rnd() * 256, r, 0, 6.283)
        g.fill()
      }
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      return t
    })()
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0.02 })

    // ---- pavage en point de Hongrie (briques 2×1 : réseau engendré par (3,-1) et (1,1))
    const L = 0.96 * 1, W = 0.46, H = 0.3
    const geo = new RoundedBoxGeometry(L * 2, H, W * 2 * 1.0, 3, 0.05)
    type Brick = { x: number; z: number; rot: number; d: number }
    const bricks: Brick[] = []
    const R = 15
    for (let s = -R; s <= R; s++) {
      for (let k = -R; k <= R; k++) {
        // A horizontale en (3k+s, -k+s) ; B verticale en (3k+s+2, -k+s-1)
        const ax = 3 * k + s, az = -k + s
        bricks.push({ x: ax + 1, z: az + 0.5, rot: 0, d: 0 })
        bricks.push({ x: ax + 2.5, z: az - 0.0, rot: Math.PI / 2, d: 0 })
      }
    }
    const field = new THREE.Group()
    const radius = 11
    const kept = bricks.filter((b) => Math.hypot(b.x * 0.52, b.z * 0.52) < radius)
    kept.forEach((b) => (b.d = Math.hypot(b.x, b.z)))
    const mesh = new THREE.InstancedMesh(geo, mat, kept.length)
    mesh.frustumCulled = false
    field.add(mesh)
    field.scale.setScalar(0.52)
    field.rotation.y = Math.PI / 4
    scene.add(field)

    const palette = () => ({
      a: new THREE.Color(cssVar('--primary')),
      b: new THREE.Color(cssVar('--surface-2')),
      c: new THREE.Color(cssVar('--ink')),
      d: new THREE.Color(cssVar('--accent')),
    })
    const tmpColor = new THREE.Color()
    function paint() {
      const p = palette()
      kept.forEach((b, i) => {
        const r = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1
        if (r < 0.5) tmpColor.copy(p.b).lerp(p.c, 0.1 + r * 0.2)
        else if (r < 0.86) tmpColor.copy(p.a).lerp(p.b, 0.15 + (r - 0.5) * 0.9)
        else if (r < 0.95) tmpColor.copy(p.c).lerp(p.b, 0.55)
        else tmpColor.copy(p.d).lerp(p.b, 0.2)
        mesh.setColorAt(i, tmpColor)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    paint()
    const mo = new MutationObserver(paint)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] })

    // ---- taille, interaction, boucle
    function resize() {
      const r = host.value!.getBoundingClientRect()
      renderer.setSize(r.width, r.height, false)
      camera.aspect = r.width / Math.max(1, r.height)
      camera.position.set(0, r.width < 640 ? 17 : 13, r.width < 640 ? 17 : 15)
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host.value)

    const pointer = { x: 0, y: 0, tx: 0, ty: 0, wx: 99, wz: 99 }
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hit = new THREE.Vector3()
    const onMove = (e: PointerEvent) => {
      const r = host.value!.getBoundingClientRect()
      pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1
      pointer.ty = -(((e.clientY - r.top) / r.height) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const state = { intro: 0, scroll: 0 }
    gsap.to(state, { intro: 1, duration: 2.6, ease: 'power2.out', delay: 0.15, onComplete: () => (ready.value = true) })
    const st = ScrollTrigger.create({
      trigger: host.value,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.6,
      onUpdate: (self) => (state.scroll = self.progress),
    })

    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), e = new THREE.Euler()
    let visible = true, raf = 0, t0 = performance.now()
    const io = new IntersectionObserver(([en]) => (visible = !!en?.isIntersecting))
    io.observe(host.value)

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden) return
      const t = (now - t0) / 1000
      pointer.x += (pointer.tx - pointer.x) * 0.06
      pointer.y += (pointer.ty - pointer.y) * 0.06
      // le pointeur → point d'impact sur le plan du champ
      ray.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera)
      if (ray.ray.intersectPlane(plane, hit)) {
        const inv = new THREE.Matrix4().copy(field.matrixWorld).invert()
        const local = hit.clone().applyMatrix4(inv)
        pointer.wx = local.x
        pointer.wz = local.z
      }
      field.rotation.y = Math.PI / 4 + pointer.x * 0.12 + state.scroll * 0.7
      camera.position.y = (window.innerWidth < 640 ? 17 : 13) - state.scroll * 3
      camera.lookAt(0, 0, 0)
      for (let i = 0; i < kept.length; i++) {
        const b = kept[i]!
        const delay = b.d * 0.045
        const k = Math.min(1, Math.max(0, state.intro * 1.7 - delay))
        const drop = (1 - (1 - Math.pow(1 - k, 3))) * 9
        const wave = Math.sin(t * 0.7 + (b.x + b.z) * 0.32) * 0.05
        const near = Math.max(0, 1 - Math.hypot(b.x - pointer.wx, b.z - pointer.wz) / 4.2)
        pos.set(b.x, drop + wave + near * near * 0.55, b.z)
        e.set(0, b.rot + (1 - k) * 0.5, 0)
        q.setFromEuler(e)
        m.compose(pos, q, sc)
        mesh.setMatrixAt(i, m)
      }
      mesh.instanceMatrix.needsUpdate = true
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    dispose = () => {
      cancelAnimationFrame(raf)
      st.kill()
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('pointermove', onMove)
      geo.dispose(); mat.dispose(); tex.dispose(); renderer.dispose()
    }
  } catch {
    fallback.value = true
  }
})
onBeforeUnmount(() => dispose?.())
</script>

<template>
  <div ref="host" class="absolute inset-0 overflow-hidden" aria-hidden="true">
    <canvas v-show="!fallback" ref="canvas" class="size-full" />
    <div v-if="fallback" class="paver-bg size-full opacity-80" />
  </div>
</template>
