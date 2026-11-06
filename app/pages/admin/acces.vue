<script setup lang="ts">
import { PERMISSIONS } from '#shared/utils/permissions'
import { ROLE_KEYS, ROLES } from '#shared/utils/roles'

usePageTitle('Accès et permissions')
const roles = ROLE_KEYS.filter((r) => r !== 'visitor')
const perms = [...new Set(Object.values(PERMISSIONS).flat())].filter((p) => p !== '*').sort() as string[]
const has = (role: (typeof roles)[number], p: string) => PERMISSIONS[role].includes('*') || (PERMISSIONS[role] as readonly string[]).includes(p)
const levels = [
  { icon: 'key-round', title: '1. Capacités', text: 'Grands droits métier (valider un devis, libérer un lot…) qui affichent ou masquent les actions.' },
  { icon: 'table-properties', title: '2. Collections et champs', text: 'Qui peut lire, créer, modifier ou supprimer chaque type de données, et quels champs restent visibles.' },
  { icon: 'list-filter', title: '3. Lignes', text: 'Un client ne voit que ses commandes, un collecteur que ses collectes : filtrage ligne par ligne, côté interface et côté serveur.' },
]
</script>

<template>
  <div>
    <UiPageHeader title="Accès et permissions" description="Matrice des capacités par rôle. Les droits sont appliqués dans l’interface et revérifiés par le serveur." icon="key-round" />
    <div class="mb-5 grid gap-4 md:grid-cols-3"><UiCard v-for="l in levels" :key="l.title" :title="l.title" :icon="l.icon"><p class="text-sm text-muted">{{ l.text }}</p></UiCard></div>
    <UiCard title="Matrice rôles × capacités" icon="grid-3x3" padding="none">
      <div class="scroll-x">
        <table class="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr class="border-b border-line text-left">
              <th class="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-muted">Capacité</th>
              <th v-for="r in roles" :key="r" class="px-2 py-3 text-center align-bottom" scope="col"><span class="block text-[12px] font-semibold">{{ ROLES[r].letter }}</span><span class="block text-[11px] font-normal text-muted [writing-mode:vertical-rl] [text-orientation:mixed] mx-auto rotate-180">{{ ROLES[r].short }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in perms" :key="p" class="border-b border-line/70 last:border-0 hover:bg-surface-2/50">
              <th class="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-normal" scope="row"><code class="text-[13px]">{{ p }}</code></th>
              <td v-for="r in roles" :key="r" class="px-2 py-2 text-center"><Icon v-if="has(r, p)" name="lucide:check" class="size-4 text-success" aria-hidden="true" /><span v-else class="text-muted/50" aria-hidden="true">·</span><span class="sr-only">{{ has(r, p) ? 'Autorisé' : 'Non autorisé' }} pour {{ ROLES[r].label }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
    <ul class="mt-5 grid gap-2 text-sm text-muted sm:grid-cols-2 xl:grid-cols-3"><li v-for="r in roles" :key="r"><strong class="text-ink">{{ ROLES[r].letter }} · {{ ROLES[r].label }}</strong> — {{ ROLES[r].description }}</li></ul>
  </div>
</template>
