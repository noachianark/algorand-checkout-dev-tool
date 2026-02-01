import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Build config for standalone payment page
export default defineConfig({
  plugins: [vue()],
  base: '/static/',
  build: {
    outDir: 'dist-payment',
    // Output to subscriber's static directory
    emptyOutDir: true,
    rollupOptions: {
      input: {
        payment: resolve(__dirname, 'src/payment-entry.ts'),
      },
      output: {
        entryFileNames: 'payment.js',
        assetFileNames: 'payment.[ext]',
        // Disable code splitting - bundle everything together
        inlineDynamicImports: true,
      },
    },
    // Inline all CSS
    cssCodeSplit: false,
  },
  define: {
    // Needed for algosdk
    'process.env': {},
    'global': 'globalThis',
  },
})
