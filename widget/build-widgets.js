import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build unified widget + legacy widgets for backward compatibility
const widgets = ['calendar-widget', 'pending-invites', 'auth-status', 'respond-result'];

async function buildWidgets() {
  for (const widget of widgets) {
    console.log(`Building ${widget}...`);
    
    await build({
      configFile: false,
      root: __dirname,
      plugins: [
        react(),
        viteSingleFile(),
      ],
      build: {
        outDir: 'dist',
        emptyOutDir: widget === widgets[0], // Only empty on first build
        assetsInlineLimit: 100000000,
        cssCodeSplit: false,
        minify: 'esbuild',
        rollupOptions: {
          input: resolve(__dirname, `${widget}.html`),
          output: {
            entryFileNames: `${widget}.js`,
          },
        },
      },
      logLevel: 'warn',
    });
    
    console.log(`✓ ${widget} built`);
  }
  
  console.log('\nAll widgets built successfully!');
}

buildWidgets().catch(console.error);

