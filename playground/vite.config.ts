import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import fastPlugin from "../dist/main.esm"

export default defineConfig((params) => {
  const { command, mode } = params
  return {
    plugins: [
      vue(),
      vueJsx(),
      fastPlugin()
    ],
    define: {},
    server: {
      port: 3154,
      open: false,
      cors: true,
      proxy: {}
    },
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 2000,
      assetsDir: 'static/assets',
      rollupOptions: {
        output: {
          chunkFileNames: `static/js/[name]-[hash].js`,
          entryFileNames: `static/js/[name]-[hash].js`,
          assetFileNames: `static/[ext]/[name]-[hash].[ext]`
        }
      }
    },
    resolve: {}
    //assetsDirs
  } as any
})
