import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/*', dest: 'public' },
        { src: 'src/background/background.js', dest: 'src/background' },
        { src: 'src/content/content.js', dest: 'src/content' },
        { src: 'src/content/content.css', dest: 'src/content' },
        { src: 'src/lib/sse-parser.js', dest: 'src/lib' }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html')
      }
    }
  }
});
