import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Removed key injection for security - using Firebase AI Logic instead
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              firebase: [
                'firebase/app',
                'firebase/auth',
                'firebase/firestore',
                'firebase/app-check',
                'firebase/ai'
              ],
              react: [
                'react',
                'react-dom'
              ]
            }
          }
        },
        chunkSizeWarningLimit: 1200
      }
    };
});
