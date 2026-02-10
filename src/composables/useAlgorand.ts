import { ref, computed, shallowRef } from 'vue'
import { PeraWalletConnect } from '@perawallet/connect'
import algosdk from 'algosdk'

export type NetworkId = 'testnet' | 'mainnet'

interface NetworkConfig {
  name: string
  algodServer: string
  algodPort: string
  algodToken: string
}

const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    name: 'TestNet',
    algodServer: 'https://testnet-api.algonode.cloud',
    algodPort: '443',
    algodToken: '',
  },
  mainnet: {
    name: 'MainNet',
    algodServer: 'https://mainnet-api.algonode.cloud',
    algodPort: '443',
    algodToken: '',
  },
}

// Shared state (singleton pattern)
const peraWallet = new PeraWalletConnect()
const connectedAccount = ref<string | null>(null)
const isInitialized = ref(false)

// Network state
const networkId = ref<NetworkId>(
  (localStorage.getItem('network') as NetworkId) || 'testnet'
)

// Algod client (recreated when network changes)
const algodClient = shallowRef<algosdk.Algodv2>(createAlgodClient(networkId.value))

function createAlgodClient(network: NetworkId): algosdk.Algodv2 {
  const config = NETWORKS[network]
  return new algosdk.Algodv2(config.algodToken, config.algodServer, config.algodPort)
}

export function useAlgorand() {
  const isConnected = computed(() => !!connectedAccount.value)
  const currentNetwork = computed(() => NETWORKS[networkId.value])

  // Try to reconnect existing session on init
  async function init() {
    if (isInitialized.value) return
    isInitialized.value = true

    try {
      const accounts = await peraWallet.reconnectSession()
      if (accounts.length > 0 && accounts[0]) {
        connectedAccount.value = accounts[0]
        peraWallet.connector?.on('disconnect', handleDisconnect)
      }
    } catch {
      // No existing session, that's fine
    }
  }

  async function connect() {
    try {
      // Check if already connected
      if (connectedAccount.value) {
        return
      }

      // Try to reconnect existing session first
      try {
        const existingAccounts = await peraWallet.reconnectSession()
        if (existingAccounts.length > 0 && existingAccounts[0]) {
          connectedAccount.value = existingAccounts[0]
          peraWallet.connector?.on('disconnect', handleDisconnect)
          return
        }
      } catch {
        // No existing session, proceed with new connection
      }

      const accounts = await peraWallet.connect()
      connectedAccount.value = accounts[0] ?? null
      peraWallet.connector?.on('disconnect', handleDisconnect)
    } catch (error) {
      console.error('Wallet connection failed:', error)
      throw error
    }
  }

  function handleDisconnect() {
    connectedAccount.value = null
  }

  function disconnect() {
    peraWallet.disconnect()
    connectedAccount.value = null
  }

  function switchNetwork(network: NetworkId) {
    if (network === networkId.value) return

    // Update network
    networkId.value = network
    localStorage.setItem('network', network)

    // Recreate algod client
    algodClient.value = createAlgodClient(network)

    // Disconnect wallet (different network = potentially different accounts)
    if (connectedAccount.value) {
      disconnect()
    }

    console.log(`[Network] Switched to ${NETWORKS[network].name}`)
  }

  async function signAndSendTransactions(txns: algosdk.Transaction[]) {
    if (!connectedAccount.value) throw new Error('Wallet not connected')

    const txnsToSign = txns.map((txn) => ({ txn }))
    const signedTxns = await peraWallet.signTransaction([txnsToSign])
    const response = await algodClient.value.sendRawTransaction(signedTxns).do()
    const txId = response.txid
    await algosdk.waitForConfirmation(algodClient.value, txId, 4)
    return txId
  }

  // Auto-init on first use
  init()

  return {
    // Wallet state
    connectedAccount,
    isConnected,
    connect,
    disconnect,

    // Network state
    networkId,
    currentNetwork,
    networks: NETWORKS,
    switchNetwork,

    // Algorand client
    algodClient,
    signAndSendTransactions,

    init,
  }
}
