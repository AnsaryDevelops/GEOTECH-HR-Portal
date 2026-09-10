import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  // Relative asset paths on build so the produced folder can be opened
  // directly from disk (file://) as a standalone demo. Vercel builds are the
  // one exception: it rewrites every unknown path to /index.html (see
  // vercel.json) so React Router can handle client-side routes, and a
  // relative './assets/...' reference would then resolve against whatever
  // nested path the browser is actually on (e.g. /hr/assets/...) instead of
  // the real /assets/... location — process.env.VERCEL is set to '1' by
  // Vercel's own build environment, never on a local/offline build, so this
  // only changes behavior for the Vercel build itself.
  base: command === 'build' ? (process.env.VERCEL ? '/' : './') : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  // allowedHosts scopes Vite's dev-server Host-header allowlist (its anti
  // DNS-rebinding check) to exactly the Cloudflare Quick Tunnel domain —
  // narrower than `true` (which allows any host at all). A leading dot
  // matches the whole *.trycloudflare.com subdomain, so this keeps working
  // across quick-tunnel restarts (each run gets a new random subdomain)
  // without needing to hardcode a specific hostname. LAN access via the
  // machine's own IP is unaffected — Vite's own-IP/localhost checks are
  // separate from this allowlist. Dev-only setting — does not apply to
  // `vite build`/production output.
  server: { port: 5173, allowedHosts: ['.trycloudflare.com'] },
}))
