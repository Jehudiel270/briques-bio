<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'
/** Infobulle. Le slot par défaut est le déclencheur (un seul élément) ; `text` est le contenu. */
withDefaults(defineProps<{ text: string; side?: 'top' | 'right' | 'bottom' | 'left'; delay?: number }>(), { side: 'top', delay: 250 })
</script>

<template>
  <TooltipProvider :delay-duration="delay">
    <TooltipRoot>
      <TooltipTrigger as-child><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent :side="side" :side-offset="6" class="z-[100] max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs text-bg shadow-lg">{{ text }}</TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
