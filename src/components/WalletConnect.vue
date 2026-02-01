<script setup lang="ts">
import { useAlgorand } from '../composables/useAlgorand'

const { connectedAccount, isConnected, connect, disconnect } = useAlgorand()

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}
</script>

<template>
  <div class="wallet-connect">
    <button v-if="!isConnected" @click="connect" class="connect-btn">
      Connect Pera Wallet
    </button>
    <div v-else class="connected">
      <span class="address">{{ shortenAddress(connectedAccount!) }}</span>
      <button @click="disconnect" class="disconnect-btn">Disconnect</button>
    </div>
  </div>
</template>

<style scoped>
.wallet-connect {
  display: flex;
  justify-content: flex-end;
  padding: 1rem;
}
.connect-btn {
  background: #ffee55;
  color: #000;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
}
.connect-btn:hover {
  background: #ffe033;
}
.connected {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.address {
  font-family: monospace;
  background: #333;
  padding: 0.5rem 1rem;
  border-radius: 4px;
}
.disconnect-btn {
  background: transparent;
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}
.disconnect-btn:hover {
  background: #ff6b6b22;
}
</style>
