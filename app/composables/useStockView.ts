import { POLYMER_LABEL } from '#shared/utils/labels'
import type { PolymerCode } from '#shared/types/domain'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Vues agrégées du stock (matières premières par polymère, produits finis par produit). */
export function useStockView() {
  const db = useDb()
  const settings = useSettings()

  const rawByPolymer = computed(() => {
    const lots = db.all('rawLots')
    return (Object.keys(POLYMER_LABEL) as PolymerCode[]).map((code) => {
      const of = lots.filter((l) => l.polymer === code)
      const usable = of.filter((l) => l.status === 'available')
      const available = sum(usable.map((l) => l.kgAvailable))
      const reserved = sum(usable.map((l) => l.kgReserved))
      const quarantine = sum(of.filter((l) => l.status === 'quarantine').map((l) => l.kgAvailable))
      const consumed = sum(of.map((l) => l.kgConsumed))
      const threshold = settings.value.rawThresholdsKg[code]
      return { code, label: POLYMER_LABEL[code] ?? code, available, reserved, free: Math.max(0, available - reserved), quarantine, consumed, threshold, low: threshold != null && available - reserved < threshold, lots: of.length }
    })
  })

  const finishedByProduct = computed(() => {
    const lots = db.all('productionLots')
    return db.all('products').map((p) => {
      const of = lots.filter((l) => l.productId === p.id)
      const released = of.filter((l) => l.qcStatus === 'released')
      const sellable = sum(released.map((l) => l.availableQty))
      const reserved = sum(released.map((l) => l.reservedQty))
      const waiting = sum(of.filter((l) => ['pending_qc', 'in_qc'].includes(l.qcStatus)).map((l) => l.availableQty))
      const blocked = sum(of.filter((l) => ['quarantine', 'rejected'].includes(l.qcStatus)).map((l) => l.availableQty))
      return { id: p.id, product: p, sellable, reserved, waiting, blocked, low: sellable < p.minStockUnits }
    })
  })

  return { rawByPolymer, finishedByProduct }
}
