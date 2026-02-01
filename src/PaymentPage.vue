<script setup lang="ts">
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'
import { computed, onMounted, ref } from 'vue'
import logoIcon from './assets/icon-1024.png'

interface Checkout {
  id: string
  appId: string
  merchantWallet: string
  merchantName: string
  amount: string
  assetId: string
  note: string
  status: string
  expiresAt: string
}

interface AlgodConfig {
  server: string
  port: string
  token: string
}

// Get checkout data and config from window (injected by server)
declare global {
  interface Window {
    __CHECKOUT__: Checkout
    __ALGOD_CONFIG__: AlgodConfig
    __NETWORK_ID__: string
  }
}

const checkout = ref<Checkout>(window.__CHECKOUT__)
const algodConfig = window.__ALGOD_CONFIG__
const networkId = window.__NETWORK_ID__

const peraWallet = new PeraWalletConnect()
const algodClient = new algosdk.Algodv2(algodConfig.token, algodConfig.server, algodConfig.port)

const connectedAccount = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const paying = ref(false)
const copiedAddress = ref(false)
const copiedContract = ref(false)

const isConnected = computed(() => !!connectedAccount.value)

const formattedAmount = computed(() => {
  return (Number(checkout.value.amount) / 1_000_000).toFixed(2)
})

const contractAddress = computed(() => {
  try {
    return algosdk.getApplicationAddress(BigInt(checkout.value.appId)).toString()
  } catch {
    return 'Invalid App ID'
  }
})

const peraExplorerUrl = computed(() => {
  const baseUrl = networkId === 'mainnet'
    ? 'https://explorer.perawallet.app/application'
    : 'https://testnet.explorer.perawallet.app/application'
  return `${baseUrl}/${checkout.value.appId}`
})

const timeRemaining = ref('')

function updateTimeRemaining() {
  const diff = new Date(checkout.value.expiresAt).getTime() - Date.now()
  if (diff <= 0) {
    timeRemaining.value = 'Expired'
    // Reload to show expired state
    setTimeout(() => window.location.reload(), 1500)
    return
  }
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  timeRemaining.value = `${minutes}m ${seconds}s`
}

onMounted(async () => {
  // Start expiration countdown
  if (checkout.value.status === 'pending') {
    updateTimeRemaining()
    setInterval(updateTimeRemaining, 1000)
  }

  // Try to reconnect existing session
  try {
    const accounts = await peraWallet.reconnectSession()
    if (accounts.length > 0 && accounts[0]) {
      connectedAccount.value = accounts[0]
      peraWallet.connector?.on('disconnect', handleDisconnect)
    }
  } catch {
    // No existing session
  }
})

function handleDisconnect() {
  connectedAccount.value = null
}

async function connect() {
  try {
    loading.value = true
    error.value = null
    const accounts = await peraWallet.connect()
    if (accounts[0]) {
      connectedAccount.value = accounts[0]
      peraWallet.connector?.on('disconnect', handleDisconnect)
    }
  } catch (e: unknown) {
    const err = e as Error
    if (err.message !== 'Connect cancelled') {
      error.value = err.message || 'Failed to connect wallet'
    }
  } finally {
    loading.value = false
  }
}

function disconnect() {
  peraWallet.disconnect()
  connectedAccount.value = null
}

async function pay() {
  if (!connectedAccount.value) return

  paying.value = true
  error.value = null
  success.value = null

  try {
    const suggestedParams = await algodClient.getTransactionParams().do()
    const appId = BigInt(checkout.value.appId)
    const assetId = BigInt(checkout.value.assetId)
    const amount = BigInt(checkout.value.amount)
    const appAddr = algosdk.getApplicationAddress(appId)

    // 1. Asset transfer to contract
    const assetTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: connectedAccount.value,
      receiver: appAddr,
      assetIndex: assetId,
      amount: amount,
      suggestedParams,
    })

    // 2. App call with ARC-4 encoding
    const abiMethod = new algosdk.ABIMethod({
      name: 'payCheckout',
      args: [
        { type: 'axfer', name: 'payment' },
        { type: 'string', name: 'checkoutId' },
        { type: 'address', name: 'merchantWallet' },
        { type: 'string', name: 'merchantName' },
        { type: 'uint64', name: 'expectedAmount' },
        { type: 'string', name: 'note' },
      ],
      returns: { type: 'void' },
    })

    const checkoutIdEncoded = (abiMethod.args[1]!.type as algosdk.ABIType).encode(checkout.value.id)
    const merchantEncoded = (abiMethod.args[2]!.type as algosdk.ABIType).encode(checkout.value.merchantWallet)
    const merchantNameEncoded = (abiMethod.args[3]!.type as algosdk.ABIType).encode(checkout.value.merchantName || '')
    const amountEncoded = (abiMethod.args[4]!.type as algosdk.ABIType).encode(amount)
    const noteEncoded = (abiMethod.args[5]!.type as algosdk.ABIType).encode(checkout.value.note || '')

    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      sender: connectedAccount.value,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        abiMethod.getSelector(),
        checkoutIdEncoded,
        merchantEncoded,
        merchantNameEncoded,
        amountEncoded,
        noteEncoded,
      ],
      foreignAssets: [assetId],
      accounts: [checkout.value.merchantWallet],
      suggestedParams: { ...suggestedParams, fee: 2000, flatFee: true },
    })

    // Group transactions
    algosdk.assignGroupID([assetTxn, appCallTxn])

    // Sign with Pera
    const txnsToSign = [{ txn: assetTxn }, { txn: appCallTxn }]
    const signedTxns = await peraWallet.signTransaction([txnsToSign])

    // Send and wait for confirmation
    const response = await algodClient.sendRawTransaction(signedTxns).do()
    const txId = response.txid
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    success.value = txId
    checkout.value.status = 'paid'
  } catch (e: unknown) {
    console.error('Payment error:', e)
    const err = e as Error
    error.value = err.message || 'Payment failed'
  } finally {
    paying.value = false
  }
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

async function copyWalletAddress() {
  if (connectedAccount.value) {
    await navigator.clipboard.writeText(connectedAccount.value)
    copiedAddress.value = true
    setTimeout(() => copiedAddress.value = false, 2000)
  }
}

async function copyContractAddress() {
  await navigator.clipboard.writeText(contractAddress.value)
  copiedContract.value = true
  setTimeout(() => copiedContract.value = false, 2000)
}
</script>

<template>
  <div class="payment-page">
    <!-- Header Banner -->
    <header class="header-banner">
      <div class="header-left">
        <img :src="logoIcon" alt="Logo" class="logo-icon" />
        <span class="logo-text">Cloud Overture Checkout</span>
        <span class="network-badge">{{ networkId }}</span>
      </div>
      <div class="header-right">
        <!-- Wallet Section in Banner -->
        <div v-if="isConnected" class="wallet-banner">
          <div class="wallet-info" @click="copyWalletAddress">
            <span class="wallet-dot"></span>
            <span class="wallet-address-short">{{ shortenAddress(connectedAccount!) }}</span>
            <div class="wallet-tooltip">
              <span class="wallet-full-address">{{ connectedAccount }}</span>
              <span class="copy-icon" :class="{ copied: copiedAddress }">
                {{ copiedAddress ? 'Copied!' : 'Copy' }}
              </span>
            </div>
          </div>
          <button @click="disconnect" class="disconnect-btn">Disconnect</button>
        </div>
        <button v-else @click="connect" :disabled="loading" class="connect-btn">
          {{ loading ? 'Connecting...' : 'Connect Wallet' }}
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="container">
      <div class="checkout-card">
        <div class="card-header">
          <h2>Checkout Payment</h2>
          <span :class="['status-badge', checkout.status]">{{ checkout.status }}</span>
        </div>

        <div class="amount-display">
          <span class="amount">{{ formattedAmount }}</span>
          <span class="currency">USDC</span>
        </div>

        <div class="checkout-details">
          <div class="detail-row">
            <span class="label">Checkout ID</span>
            <span class="value">{{ checkout.id }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Merchant</span>
            <span class="value">{{ checkout.merchantName || shortenAddress(checkout.merchantWallet) }}</span>
          </div>
          <div v-if="checkout.note" class="detail-row">
            <span class="label">Note</span>
            <span class="value">{{ checkout.note }}</span>
          </div>
          <div class="detail-row">
            <span class="label">Smart Contract</span>
            <div class="value contract-value">
              <span class="contract-address" @click="copyContractAddress" :title="contractAddress">
                {{ shortenAddress(contractAddress) }}
                <span class="copy-hint" :class="{ copied: copiedContract }">
                  {{ copiedContract ? 'Copied!' : '' }}
                </span>
              </span>
              <a :href="peraExplorerUrl" target="_blank" class="explorer-link" title="View on Pera Explorer">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </a>
            </div>
          </div>
          <div v-if="checkout.status === 'pending'" class="detail-row">
            <span class="label">Expires</span>
            <span class="value expires">{{ timeRemaining }}</span>
          </div>
        </div>

        <div v-if="error" class="error-box">{{ error }}</div>

        <div v-if="success" class="success-box">
          <div class="success-icon">&#10003;</div>
          <div class="success-content">
            <strong>Payment Successful!</strong>
            <div class="tx-id">Transaction: <code>{{ shortenAddress(success) }}</code></div>
          </div>
        </div>

        <div v-if="checkout.status === 'pending'" class="action-section">
          <button v-if="!isConnected" @click="connect" :disabled="loading" class="btn btn-secondary">
            {{ loading ? 'Connecting...' : 'Connect Pera Wallet to Pay' }}
          </button>

          <button v-if="isConnected" @click="pay" :disabled="paying" class="btn btn-primary">
            {{ paying ? 'Processing...' : 'Pay Now' }}
          </button>
        </div>

        <div v-else class="paid-notice">
          <template v-if="checkout.status === 'notified'">This checkout has been paid and processed.</template>
          <template v-else-if="checkout.status === 'paid'">This checkout has been paid. Awaiting confirmation...</template>
          <template v-else-if="checkout.status === 'expired'">This checkout has expired. Please request a new checkout from the merchant.</template>
          <template v-else-if="checkout.status === 'failed'">This checkout has failed. Please contact the merchant for assistance.</template>
        </div>
      </div>

      <div class="footer">
        <span>Powered by Algorand</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  color: #1a1a2e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header Banner */
.header-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.logo-text {
  font-weight: 600;
  font-size: 1.1rem;
  color: #1a1a2e;
}

.network-badge {
  padding: 0.25rem 0.6rem;
  background: #e8f4fd;
  color: #0066cc;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Wallet Banner Section */
.wallet-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f0f9f0;
  border: 1px solid #c8e6c9;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
}

.wallet-info:hover .wallet-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.wallet-dot {
  width: 8px;
  height: 8px;
  background: #4caf50;
  border-radius: 50%;
}

.wallet-address-short {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.85rem;
  color: #2e7d32;
}

.wallet-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #1a1a2e;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.8rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: all 0.2s;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.wallet-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 20px;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid #1a1a2e;
}

.wallet-full-address {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
}

.copy-icon {
  padding: 0.25rem 0.5rem;
  background: #ffee55;
  color: #000;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}

.copy-icon.copied {
  background: #4caf50;
  color: #fff;
}

.connect-btn {
  padding: 0.6rem 1.25rem;
  background: linear-gradient(135deg, #ffee55 0%, #ffd700 100%);
  border: none;
  border-radius: 8px;
  color: #000;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.connect-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.disconnect-btn {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 6px;
  color: #666;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.disconnect-btn:hover {
  background: #ffebee;
  border-color: #f44336;
  color: #f44336;
}

/* Main Container */
.container {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.checkout-card {
  background: #fff;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a2e;
}

.status-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #fff8e1;
  color: #f57c00;
  border: 1px solid #ffe0b2;
}

.status-badge.paid {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.status-badge.notified {
  background: #e0f7fa;
  color: #00838f;
  border: 1px solid #b2ebf2;
}

.status-badge.expired,
.status-badge.failed {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.amount-display {
  text-align: center;
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
}

.amount {
  font-size: 3rem;
  font-weight: 700;
  color: #1a1a2e;
}

.currency {
  font-size: 1.25rem;
  color: #2e7d32;
  margin-left: 0.5rem;
  font-weight: 600;
}

.checkout-details {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid #e9ecef;
}

.label {
  color: #6c757d;
  font-size: 0.875rem;
}

.value {
  color: #1a1a2e;
  font-weight: 500;
  font-size: 0.875rem;
}

.value.expires {
  color: #f57c00;
  font-weight: 600;
}

.contract-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.contract-address {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.8rem;
  color: #495057;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  background: #e9ecef;
  border-radius: 4px;
  transition: all 0.2s;
}

.contract-address:hover {
  background: #dee2e6;
}

.copy-hint {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  color: #2e7d32;
  font-weight: 600;
}

.explorer-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #e8f4fd;
  border-radius: 6px;
  color: #0066cc;
  transition: all 0.2s;
}

.explorer-link:hover {
  background: #0066cc;
  color: #fff;
}

.error-box {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  color: #c62828;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.success-box {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
}

.success-icon {
  width: 32px;
  height: 32px;
  background: #4caf50;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
}

.success-content strong {
  color: #2e7d32;
  display: block;
  margin-bottom: 0.25rem;
}

.tx-id {
  font-size: 0.85rem;
  color: #6c757d;
}

.tx-id code {
  color: #495057;
  background: #e9ecef;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.action-section {
  margin-top: 1rem;
}

.btn {
  width: 100%;
  padding: 1.25rem;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #ffee55 0%, #ffd700 100%);
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 215, 0, 0.4);
}

.btn-secondary {
  background: #f8f9fa;
  color: #495057;
  border: 2px solid #dee2e6;
}

.btn-secondary:hover:not(:disabled) {
  background: #e9ecef;
  border-color: #ced4da;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.paid-notice {
  text-align: center;
  color: #6c757d;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 12px;
  margin-top: 1rem;
}

.footer {
  text-align: center;
  margin-top: 2rem;
  color: #adb5bd;
  font-size: 0.8rem;
}

@media (max-width: 500px) {
  .header-banner {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .header-left, .header-right {
    width: 100%;
    justify-content: center;
  }

  .container {
    padding: 1rem;
  }

  .checkout-card {
    padding: 1.5rem;
  }

  .amount {
    font-size: 2.5rem;
  }

  .wallet-tooltip {
    right: -50%;
  }
}
</style>
