<script setup lang="ts">
import { computed } from "vue";
import { statusLabel, statusTone } from "@/utils/feedback";

const props = defineProps<{ value: string }>();
const className = computed(
  () => `fa-status fa-status--${statusTone(props.value)}`
);
</script>

<template>
  <span :class="className">{{ statusLabel(value) }}</span>
</template>
