<script setup lang="ts">
import { useAlgorand, type NetworkId } from '../composables/useAlgorand'

const { networkId, networks, switchNetwork } = useAlgorand()

const networkColors: Record<NetworkId, string> = {
  localnet: '#4ade80', // green
  testnet: '#fbbf24', // yellow
  mainnet: '#f87171', // red
}

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  switchNetwork(target.value as NetworkId)
}
</script>

<template>
  <div class="network-selector">
    <span
      class="network-dot"
      :style="{ backgroundColor: networkColors[networkId] }"
    ></span>
    <select :value="networkId" @change="handleChange" class="network-select">
      <option
        v-for="(config, id) in networks"
        :key="id"
        :value="id"
      >
        {{ config.name }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.network-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}

.network-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.network-select {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  padding-right: 0.5rem;
}

.network-select option {
  background: #1a1a2e;
  color: #fff;
}
</style>
