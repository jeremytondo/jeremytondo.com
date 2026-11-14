// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://jeremytondo.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  server: {
    // dev/preview listen on localhost only. Tailnet devices reach them through
    // `tailscale serve`, which forwards requests with the machine's *.ts.net name.
    allowedHosts: ['.ts.net'],
  },
  vite: {
    server: {
      fs: {
        // Vite's defaults, plus jj's repo folder.
        deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.jj/**'],
      },
    },
  },
});
