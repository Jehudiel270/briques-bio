<script setup lang="ts">
import { norm } from '#shared/utils/format'

usePageTitle('Questions fréquentes')
const db = useDb()

const q = ref('')
const category = ref('')
const faqs = computed(() => db.all('faqs').filter((f) => f.published).sort((a, b) => a.order - b.order))
const categories = computed(() => [...new Set(faqs.value.map((f) => f.category))])
const tabs = computed(() => [{ value: '', label: 'Toutes', count: faqs.value.length }, ...categories.value.map((c) => ({ value: c, label: c }))])
const shown = computed(() => {
  const s = norm(q.value)
  return faqs.value.filter((f) => (!category.value || f.category === category.value) && (!s || norm(`${f.question} ${f.answer}`).includes(s)))
})
const grouped = computed(() => categories.value.map((c) => ({ category: c, items: shown.value.filter((f) => f.category === c) })).filter((g) => g.items.length))
</script>

<template>
  <div>
    <SitePageHero title="Questions fréquentes" intro="Produits, devis, collecte, traçabilité : les réponses directes, y compris sur ce que nous ne promettons pas." crumb="FAQ" />

    <section class="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div class="flex flex-col gap-4">
        <UiSearch v-model="q" placeholder="Rechercher une question…" aria-label="Rechercher dans la FAQ" />
        <UiTabs v-model="category" :items="tabs" aria-label="Filtrer par thème" />
      </div>

      <UiEmpty v-if="!shown.length" class="mt-8" icon="search-x" title="Aucune question ne correspond" hint="Essayez un autre mot-clé ou posez votre question à l’équipe.">
        <UiButton variant="outline" icon="rotate-ccw" @click="q = ''; category = ''">Réinitialiser</UiButton>
        <UiButton icon="mail" to="/contact">Nous écrire</UiButton>
      </UiEmpty>

      <div v-else class="mt-8 space-y-10">
        <section v-for="g in grouped" :key="g.category">
          <h2 class="mb-3 font-display text-xl font-semibold">{{ g.category }}</h2>
          <div class="divide-y divide-line rounded-xl border border-line bg-surface">
            <details v-for="f in g.items" :key="f.id" class="group p-4 sm:p-5" :open="!!q.trim()">
              <summary class="flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
                <span>{{ f.question }}</span>
                <Icon name="lucide:plus" class="mt-0.5 size-4 shrink-0 text-muted transition-transform group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p class="mt-3 max-w-3xl leading-relaxed text-muted">{{ f.answer }}</p>
            </details>
          </div>
        </section>
      </div>

      <div class="mt-12 card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="text-xl font-semibold">Votre question n’est pas là ?</h2><p class="mt-1 text-muted">Écrivez-nous, nous complétons cette page avec les questions utiles.</p></div>
        <UiButton icon="mail" to="/contact">Contacter l’équipe</UiButton>
      </div>
    </section>
  </div>
</template>
