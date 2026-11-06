<script setup lang="ts">
import { roleLabel } from '#shared/utils/roles'

usePageTitle('Données de démonstration')
const db = useDb()
const auth = useAuth()
const confirm = useConfirm()
const act = useAction()
const config = useRuntimeConfig()
const demoMode = computed(() => (config.public as any).demoMode !== false && (config.public as any).demoMode !== 'false')
const accounts = computed(() => db.all('users').filter((u) => u.demo).sort((a, b) => a.role.localeCompare(b.role)))
const stats = computed(() => [
  { label: 'Utilisateurs', value: db.all('users').length, icon: 'users' }, { label: 'Produits', value: db.all('products').length, icon: 'package' },
  { label: 'Devis', value: db.all('quotes').length, icon: 'file-text' }, { label: 'Commandes', value: db.all('orders').length, icon: 'shopping-bag' },
  { label: 'Collectes', value: db.all('collections').length, icon: 'truck' }, { label: 'Lots produits', value: db.all('productionLots').length, icon: 'boxes' },
  { label: 'Contrôles qualité', value: db.all('qcInspections').length, icon: 'microscope' }, { label: 'Entrées d’audit', value: db.all('auditLog').length, icon: 'scroll-text' },
])
const modeLabel = computed(() => ({ local: 'Stockage local du navigateur', neon: 'Base Neon (PostgreSQL)', auto: 'Automatique' } as Record<string, string>)[db.mode.value] ?? db.mode.value)
async function reset() {
  if (!(await confirm({ title: 'Réinitialiser les données de démonstration ?', message: 'Toutes les données actuelles sont remplacées par le jeu de départ fictif. Cette action est journalisée et irréversible.', confirmLabel: 'Réinitialiser', tone: 'danger' }))) return
  await act(() => db.reset(), 'Données de démonstration réinitialisées.')
}
const copy = async (text: string) => { try { await navigator.clipboard.writeText(text) } catch { /* presse-papiers indisponible */ } }
</script>

<template>
  <div>
    <UiPageHeader title="Données de démonstration" description="Jeu de départ fictif, comptes de test et réinitialisation." icon="flask-conical">
      <template #actions><UiButton variant="outline" icon="rotate-ccw" @click="reset">Réinitialiser les données</UiButton></template>
    </UiPageHeader>

    <UiAlert :tone="demoMode ? 'warning' : 'success'" :icon="demoMode ? 'flask-conical' : 'shield-check'" :title="demoMode ? 'Mode démonstration actif' : 'Mode démonstration désactivé'" class="mb-5">
      {{ demoMode ? 'Les comptes de test et le sélecteur de rôle sont disponibles. Désactivez-le avant toute mise en production (NUXT_PUBLIC_DEMO_MODE=false).' : 'Les comptes de démonstration et le changement de rôle sont désactivés.' }}
    </UiAlert>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><UiStat v-for="s in stats" :key="s.label" :label="s.label" :value="s.value" :icon="s.icon" tone="info" /></div>

    <div class="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <UiCard title="Comptes de démonstration" icon="key-round" description="Mot de passe commun : demo1234" padding="none">
        <div class="scroll-x">
          <table class="w-full min-w-[30rem] text-sm">
            <thead><tr class="border-b border-line text-left text-[13px] text-muted"><th class="px-4 py-2.5 font-medium">Rôle</th><th class="px-3 py-2.5 font-medium">Nom</th><th class="px-4 py-2.5 font-medium">Identifiant</th></tr></thead>
            <tbody>
              <tr v-for="u in accounts" :key="u.id" class="border-b border-line/70 last:border-0">
                <td class="px-4 py-2.5 font-medium">{{ roleLabel(u.role) }}</td><td class="px-3 py-2.5">{{ u.name }}</td>
                <td class="px-4 py-2.5"><button type="button" class="tnum rounded px-1 hover:bg-surface-2" :title="`Copier ${u.email}`" @click="copy(u.email)">{{ u.email }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
      <div class="flex flex-col gap-5">
        <UiCard title="Source des données" icon="database"><UiKeyValue :items="[{ label: 'Mode', value: modeLabel }, { label: 'Session', value: auth.user.value ? `${auth.user.value.name} (${roleLabel(auth.role.value)})` : '—' }]" /></UiCard>
        <SiteNotice kind="demo" />
        <UiCard title="Ce que contient le jeu de départ" icon="info"><ul class="list-disc space-y-1.5 pl-5 text-sm text-muted"><li>Entreprises, produits et prix fictifs (FCFA).</li><li>Documents marqués « fictif », sans valeur de certificat.</li><li>Paiements et rémunérations simulés (références SIM-).</li><li>Aucun indicateur environnemental présenté comme certifié.</li></ul></UiCard>
      </div>
    </div>
  </div>
</template>
