import fs from 'node:fs';
import path from 'node:path';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';

/**
 * Build « navigateur seul » : le jeu est ouvert en double-cliquant sur
 * dist/index.html (file://). Les navigateurs y refusent les modules ES et fetch :
 * on produit donc un unique script IIFE classique, le worker de simulation est
 * inliné (Blob) et les données sont des scripts JSONP (voir @re/data chunks).
 */
function fileProtocolHtml(): Plugin {
  return {
    name: 're-file-protocol-html',
    apply: 'build',
    closeBundle() {
      const src = fs.readFileSync(path.resolve(import.meta.dirname, 'index.html'), 'utf8');
      const out = src.replace(
        /<script type="module"[^>]*src="\/src\/main\.tsx"><\/script>/,
        '<link rel="stylesheet" href="./game.css" />\n    <script src="./game.js"></script>',
      );
      fs.writeFileSync(path.resolve(import.meta.dirname, 'dist/index.html'), out);
    },
  };
}

export default defineConfig({
  plugins: [preact(), fileProtocolHtml()],
  base: './',
  worker: { format: 'iife' },
  build: {
    // Navigateurs les plus anciens supportés : Chrome 109 et Firefox 115 ESR (derniers sur Windows 7).
    target: ['chrome109', 'firefox115'],
    outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/main.tsx'),
      name: 'RailEmpireV2',
      formats: ['iife'],
      fileName: () => 'game.js',
      cssFileName: 'game',
    },
  },
});
