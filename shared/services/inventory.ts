/**
 * Service stock : ajustements d'inventaire, pertes, transferts d'emplacement.
 *
 * Conventions :
 *  - `newKg` (matière) = quantité PHYSIQUE comptée dans le lot = disponible + réservé ; `newQty` (produits finis) idem.
 *  - L'invariant des lots de matière reste `kgInitial = disponible + réservé + consommé` : un ajustement ou
 *    une perte modifie donc `kgInitial` (quantité nette corrigée) en même temps que le disponible.
 *  - Jamais de stock négatif ni inférieur au réservé.
 */
import type { Id } from '../types/domain'
import type { Db } from '../utils/db-core'
import { fail } from './errors'
import { addMovement, guard, need, notifyRoles, qtyOf, round2, text } from './helpers'

const sign = (n: number) => `${n >= 0 ? '+' : ''}${round2(n)}`

export function adjustRaw(db: Db, rawLotId: Id, newKg: number, reason: string) {
  const a = guard(db, 'inventory.adjust')
  const lot = need(db.peek('rawLots', rawLotId), 'Le lot de matière')
  if (lot.status === 'rejected') fail(`${lot.ref} est rejeté : son stock ne peut pas être ajusté.`)
  const why = text(reason, 'Le motif de l’ajustement')
  const target = qtyOf(newKg, 'La quantité comptée', { allowZero: true })
  if (target < lot.kgReserved) fail(`La quantité comptée (${round2(target)} kg) est inférieure au réservé (${round2(lot.kgReserved)} kg) pour ${lot.ref} : libérez d’abord les réservations des ordres de fabrication.`, 'below_reserved')
  const physical = lot.kgAvailable + lot.kgReserved
  const delta = round2(target - physical)
  if (delta === 0) fail(`La quantité comptée est identique au stock actuel de ${lot.ref} (${round2(physical)} kg) : aucun ajustement à enregistrer.`)
  const available = round2(target - lot.kgReserved)
  db.update('rawLots', lot.id, {
    kgAvailable: available, kgInitial: round2(lot.kgInitial + delta),
    status: target === 0 && lot.status === 'available' ? 'depleted' : lot.status === 'depleted' && target > 0 ? 'available' : lot.status,
    notes: `${lot.notes ? lot.notes + ' ' : ''}Inventaire : ${sign(delta)} kg (${why}).`.trim(),
  }, { via: 'inventory.adjust', summary: `Ajustement d’inventaire · ${lot.ref} · ${sign(delta)} kg` })
  addMovement(db, 'inventory.adjust', { type: 'adjustment', itemKind: 'raw', itemId: lot.id, qty: delta, unit: 'kg', toLocationId: lot.locationId, refType: 'inventory', note: `${round2(physical)} → ${round2(target)} kg : ${why}` })
  if (a?.role !== 'procurement') notifyRoles(db, ['procurement'], { title: 'Ajustement de stock matière', body: `${lot.ref} : ${sign(delta)} kg (${why}).`, level: 'info', href: `/ops/appro/lots-matiere/${lot.id}` })
  return db.peek('rawLots', lot.id)!
}

export function adjustFinished(db: Db, lotId: Id, newQty: number, reason: string) {
  guard(db, 'inventory.adjust')
  const lot = need(db.peek('productionLots', lotId), 'Le lot de produits finis')
  const why = text(reason, 'Le motif de l’ajustement')
  const target = qtyOf(newQty, 'La quantité comptée', { integer: true, allowZero: true })
  if (target < lot.reservedQty) fail(`La quantité comptée (${target}) est inférieure aux pièces réservées (${lot.reservedQty}) sur ${lot.ref} : annulez ou modifiez d’abord les commandes concernées.`, 'below_reserved')
  if (target + lot.shippedQty > lot.producedQty) fail(`La quantité comptée (${target}) dépasse ce que le lot ${lot.ref} peut contenir (${lot.producedQty - lot.shippedQty} pièces : produit moins expédié).`)
  const physical = lot.availableQty + lot.reservedQty
  const delta = target - physical
  if (delta === 0) fail(`La quantité comptée est identique au stock actuel de ${lot.ref} (${physical}) : aucun ajustement à enregistrer.`)
  db.update('productionLots', lot.id, { availableQty: target - lot.reservedQty }, { via: 'inventory.adjust', summary: `Ajustement d’inventaire · ${lot.ref} · ${sign(delta)} pièce(s)` })
  addMovement(db, 'inventory.adjust', { type: 'adjustment', itemKind: 'finished', itemId: lot.id, qty: delta, unit: 'unit', toLocationId: lot.locationId, refType: 'inventory', note: `${physical} → ${target} : ${why}` })
  if (lot.qcStatus === 'released') notifyRoles(db, ['logistics', 'sales'], { title: 'Stock vendable ajusté', body: `${lot.ref} : ${sign(delta)} pièce(s) (${why}).`, level: 'info', href: `/ops/production/lots/${lot.id}` })
  return db.peek('productionLots', lot.id)!
}

export function transfer(db: Db, input: { itemKind: 'raw' | 'finished'; itemId: Id; toLocationId: Id; qty?: number }) {
  guard(db, 'inventory.transfer')
  const to = need(db.peek('stockLocations', input.toLocationId), 'L’emplacement de destination')
  if (input.itemKind === 'raw') {
    const lot = need(db.peek('rawLots', input.itemId), 'Le lot de matière')
    if (lot.locationId === to.id) fail(`${lot.ref} est déjà à l’emplacement ${to.name}.`)
    if (lot.status === 'rejected' || lot.status === 'depleted') fail(`${lot.ref} est ${lot.status === 'rejected' ? 'rejeté' : 'épuisé'} : il n’y a rien à déplacer.`)
    const expected = lot.status === 'quarantine' ? 'quarantine' : 'raw'
    if (to.kind !== expected) fail(lot.status === 'quarantine' ? `${lot.ref} est en quarantaine : il ne peut aller que vers une zone de quarantaine.` : `${lot.ref} est disponible : il ne peut aller que vers un emplacement de matière (pas ${to.kind === 'quarantine' ? 'la quarantaine' : 'les produits finis'}).`)
    const physical = lot.kgAvailable + lot.kgReserved
    if (input.qty != null && Math.abs(input.qty - physical) > 0.0005) fail(`Le transfert partiel n’est pas géré : déplacez le lot entier (${round2(physical)} kg).`)
    const from = lot.locationId // les lignes sont modifiées en place : lire l'origine avant la mise à jour
    db.update('rawLots', lot.id, { locationId: to.id }, { via: 'inventory.transfer', summary: `Transfert · ${lot.ref} → ${to.code}` })
    addMovement(db, 'inventory.transfer', { type: 'transfer', itemKind: 'raw', itemId: lot.id, qty: physical, unit: 'kg', fromLocationId: from, toLocationId: to.id, refType: 'manual' })
    return db.peek('rawLots', lot.id)!
  }
  const lot = need(db.peek('productionLots', input.itemId), 'Le lot de produits finis')
  if (to.kind !== 'finished') fail('Les produits finis ne peuvent être déplacés que vers une aire de produits finis.')
  if (lot.locationId === to.id) fail(`${lot.ref} est déjà à l’emplacement ${to.name}.`)
  const physical = lot.availableQty + lot.reservedQty
  if (input.qty != null && input.qty !== physical) fail(`Le transfert partiel n’est pas géré : déplacez le lot entier (${physical} pièces).`)
  const from = lot.locationId
  db.update('productionLots', lot.id, { locationId: to.id }, { via: 'inventory.transfer', summary: `Transfert · ${lot.ref} → ${to.code}` })
  addMovement(db, 'inventory.transfer', { type: 'transfer', itemKind: 'finished', itemId: lot.id, qty: physical, unit: 'unit', fromLocationId: from, toLocationId: to.id, refType: 'manual' })
  return db.peek('productionLots', lot.id)!
}

export function recordLoss(db: Db, rawLotId: Id, kg: number, reason: string) {
  const a = guard(db, 'inventory.adjust')
  const lot = need(db.peek('rawLots', rawLotId), 'Le lot de matière')
  if (lot.status === 'rejected' || lot.status === 'depleted') fail(`${lot.ref} est ${lot.status === 'rejected' ? 'rejeté' : 'épuisé'} : aucune perte à enregistrer.`)
  const why = text(reason, 'Le motif de la perte')
  const lost = qtyOf(kg, 'La quantité perdue')
  if (lost > lot.kgAvailable + 0.0005) {
    fail(`La perte (${round2(lost)} kg) dépasse le stock disponible de ${lot.ref} (${round2(lot.kgAvailable)} kg${lot.kgReserved ? `, ${round2(lot.kgReserved)} kg réservés non touchables` : ''}).`, 'stock_insufficient')
  }
  const available = round2(lot.kgAvailable - lost)
  const physical = available + lot.kgReserved
  db.update('rawLots', lot.id, {
    kgAvailable: available, kgInitial: round2(lot.kgInitial - lost), status: physical <= 0 && lot.status === 'available' ? 'depleted' : lot.status,
  }, { via: 'inventory.adjust', summary: `Perte de matière · ${lot.ref} · ${round2(lost)} kg` })
  addMovement(db, 'inventory.adjust', { type: 'loss', itemKind: 'raw', itemId: lot.id, qty: round2(lost), unit: 'kg', fromLocationId: lot.locationId, refType: 'inventory', note: why })
  if (a?.role !== 'procurement') notifyRoles(db, ['procurement'], { title: 'Perte de matière enregistrée', body: `${lot.ref} : ${round2(lost)} kg (${why}).`, level: 'warning', href: `/ops/appro/lots-matiere/${lot.id}` })
  return db.peek('rawLots', lot.id)!
}

export const inventory = { adjustRaw, adjustFinished, transfer, recordLoss }
