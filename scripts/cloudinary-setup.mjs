// Crée l'arborescence de dossiers EcoBloc dans Cloudinary.
// Usage : npm run cloudinary:setup   (lit .env via --env-file)
const cloud = process.env.CLOUDINARY_CLOUD_NAME
const key = process.env.CLOUDINARY_API_KEY
const secret = process.env.CLOUDINARY_API_SECRET
const root = process.env.CLOUDINARY_FOLDER || 'ecobloc'

if (!cloud || !key || !secret) {
  console.error('Variables CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET manquantes.')
  process.exit(1)
}

const folders = [
  root,
  `${root}/produits`,
  `${root}/atelier`,
  `${root}/collectes`,
  `${root}/qualite`,
  `${root}/livraisons`,
  `${root}/documents`,
  `${root}/branding`,
  `${root}/etudes-de-cas`,
]

const auth = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
let failed = 0

for (const path of folders) {
  const url = `https://api.cloudinary.com/v1_1/${cloud}/folders/${path.split('/').map(encodeURIComponent).join('/')}`
  try {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: auth } })
    const body = await res.json().catch(() => ({}))
    if (res.ok) console.log(`OK        ${path}`)
    else if (res.status === 409 || /already exists/i.test(body?.error?.message || '')) console.log(`EXISTANT  ${path}`)
    else { failed++; console.error(`ÉCHEC     ${path} -> ${res.status} ${body?.error?.message || ''}`) }
  } catch (e) {
    failed++
    console.error(`ÉCHEC     ${path} -> ${e.message}`)
  }
}

process.exit(failed ? 1 : 0)
