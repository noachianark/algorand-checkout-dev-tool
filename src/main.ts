import { Buffer } from 'buffer'

// Polyfill Buffer for WalletConnect/algosdk
window.Buffer = window.Buffer || Buffer

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
