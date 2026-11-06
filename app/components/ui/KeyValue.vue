<script setup lang="ts">
/** Liste « libellé / valeur ». `items[].value` peut être du texte ; pour un contenu riche utiliser le slot `value-<index>` ou `value="{ item, index }"`. */
withDefaults(
  defineProps<{ items: { label: string; value?: string | number | null; mono?: boolean; hide?: boolean }[]; cols?: 1 | 2 | 3 }>(),
  { cols: 1 },
)
</script>

<template>
  <dl class="grid gap-x-8 gap-y-3" :class="cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : ''">
    <template v-for="(item, i) in items" :key="item.label">
      <div v-if="!item.hide" class="flex min-w-0 items-baseline justify-between gap-4 border-b border-line/70 pb-2 last:border-0">
        <dt class="shrink-0 text-[13px] text-muted">{{ item.label }}</dt>
        <dd class="min-w-0 text-right text-sm text-ink" :class="item.mono && 'tnum font-mono text-[13px]'">
          <slot :name="`value-${i}`" :item="item" :index="i">
            <slot name="value" :item="item" :index="i">{{ item.value ?? '—' }}</slot>
          </slot>
        </dd>
      </div>
    </template>
  </dl>
</template>
