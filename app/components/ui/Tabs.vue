<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
/**
 * Onglets. `v-model` = valeur de l'onglet actif. `items` : { value, label, icon?, count? }.
 * Un slot nommé comme la valeur (`#details`) rend le contenu ; sans slots, n'affiche que la barre (usage pour filtrer).
 */
const model = defineModel<string>()
const props = defineProps<{ items: { value: string; label: string; icon?: string; count?: number }[]; ariaLabel?: string }>()
const slots = useSlots()
const hasPanels = computed(() => props.items.some((i) => !!slots[i.value]))
watchEffect(() => {
  if (model.value == null && props.items[0]) model.value = props.items[0].value
})
</script>

<template>
  <TabsRoot v-model="model" class="min-w-0">
    <TabsList :aria-label="ariaLabel" class="scroll-x flex gap-1 border-b border-line">
      <TabsTrigger
        v-for="i in items"
        :key="i.value"
        :value="i.value"
        class="relative -mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted outline-none transition-colors hover:text-ink data-[state=active]:border-primary data-[state=active]:text-ink"
      >
        <Icon v-if="i.icon" :name="i.icon.includes(':') ? i.icon : `lucide:${i.icon}`" class="size-4" aria-hidden="true" />
        {{ i.label }}
        <span v-if="i.count != null" class="tnum rounded-full bg-surface-2 px-1.5 text-[11px] leading-5 text-muted">{{ i.count }}</span>
      </TabsTrigger>
    </TabsList>
    <template v-if="hasPanels">
      <TabsContent v-for="i in items" :key="i.value" :value="i.value" class="pt-4 outline-none">
        <slot :name="i.value" />
      </TabsContent>
    </template>
  </TabsRoot>
</template>
