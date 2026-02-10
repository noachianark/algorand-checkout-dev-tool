<script setup lang="ts">
import { useApiEndpoint, type EndpointId } from '../composables/useApiEndpoint'

const { endpointId, endpoints, switchEndpoint } = useApiEndpoint()

const endpointColors: Record<EndpointId, string> = {
  local: '#4ade80',
  test: '#fbbf24',
  production: '#f87171',
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  switchEndpoint(target.value as EndpointId)
}
</script>

<template>
  <div class="endpoint-selector">
    <span
      class="endpoint-dot"
      :style="{ backgroundColor: endpointColors[endpointId] }"
    ></span>
    <select :value="endpointId" @change="handleChange" class="endpoint-select">
      <option
        v-for="(config, id) in endpoints"
        :key="id"
        :value="id"
        :disabled="!config.url"
      >
        {{ config.name }}{{ !config.url ? ' (N/A)' : '' }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.endpoint-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.endpoint-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.endpoint-select {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  padding-right: 0.5rem;
}

.endpoint-select option {
  background: #1a1a2e;
  color: #fff;
}

.endpoint-select option:disabled {
  color: #555;
}
</style>
