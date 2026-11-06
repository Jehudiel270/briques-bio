import { describe, expect, it } from 'vitest'
import { cleanValues, initialValues, validateAll, validateField, type FieldDef } from '../app/utils/forms'

const fields: FieldDef[] = [
  { key: 'name', label: 'Nom', type: 'text', required: true, min: 2 },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'qty', label: 'Quantité', type: 'number', required: true, min: 1, max: 100 },
  { key: 'agree', label: 'Accord', type: 'checkbox', required: true },
  { key: 'other', label: 'Précision', type: 'text', required: true, showIf: (v) => v.name === 'autre' },
  { key: 'code', label: 'Code', type: 'text', validate: (v) => (v && !/^[A-Z]{3}$/.test(v) ? 'Trois lettres majuscules.' : undefined) },
]

describe('forms', () => {
  it('construit des valeurs initiales typées', () => {
    const v = initialValues(fields, { name: 'Pavé' })
    expect(v).toMatchObject({ name: 'Pavé', qty: null, agree: false, email: '' })
  })
  it('exige les champs obligatoires', () => {
    const e = validateAll(fields, initialValues(fields))
    expect(Object.keys(e).sort()).toEqual(['agree', 'name', 'qty'])
  })
  it('valide le format e-mail, les bornes et la longueur', () => {
    const base = { ...initialValues(fields), name: 'A', qty: 500, agree: true, email: 'pas-un-mail' }
    const e = validateAll(fields, base)
    expect(e.name).toMatch(/au moins 2/)
    expect(e.qty).toMatch(/maximale/)
    expect(e.email).toMatch(/e-mail valide/)
  })
  it('ignore les champs masqués par showIf', () => {
    const v = { ...initialValues(fields), name: 'Pavé', qty: 5, agree: true }
    expect(validateField(fields[4]!, v)).toBeUndefined()
    expect(validateField(fields[4]!, { ...v, name: 'autre' })).toMatch(/renseignez/)
  })
  it('applique la validation personnalisée seulement si une valeur est saisie', () => {
    const v = { ...initialValues(fields), name: 'Pavé', qty: 5, agree: true }
    expect(validateField(fields[5]!, v)).toBeUndefined()
    expect(validateField(fields[5]!, { ...v, code: 'ab' })).toBe('Trois lettres majuscules.')
  })
  it('nettoie les valeurs envoyées', () => {
    const out = cleanValues(fields, { ...initialValues(fields), name: '  Pavé ', qty: '12', agree: true, other: 'x' })
    expect(out.name).toBe('Pavé')
    expect(out.qty).toBe(12)
    expect(out.email).toBeUndefined()
    expect('other' in out).toBe(false)
  })
})
