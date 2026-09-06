// Minimal static server for the GEOTECH HR Portal demo.
// Zero dependencies, works offline. Started by START-DEMO.bat.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const START_PORT = 4173

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const FORBIDDEN = Symbol('forbidden')

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function resolveFile(urlPath) {
  // Strip the query string, decode, and refuse anything that escapes ROOT.
  const clean = decodeURIComponent(urlPath.split('?')[0])
  const candidate = normalize(join(ROOT, clean))
  if (!candidate.startsWith(ROOT)) return FORBIDDEN

  if (await isFile(candidate)) return candidate

  // The build uses relative asset paths so the folder also opens straight off
  // disk. That means a reload on a deep route such as /employee/requests asks
  // for /employee/assets/index-xxx.js. Re-anchor anything under /assets/ to the
  // root rather than letting it fall through to the SPA entry point, which
  // would answer a module request with text/html.
  const assetIndex = clean.indexOf('/assets/')
  if (assetIndex !== -1) {
    const rooted = normalize(join(ROOT, clean.slice(assetIndex)))
    if (rooted.startsWith(ROOT) && (await isFile(rooted))) return rooted
  }

  // A request that names a file but does not resolve is a genuine 404. Serving
  // index.html for it produces confusing MIME-type errors instead.
  if (/\.[a-z0-9]+$/i.test(clean)) return null

  return join(ROOT, 'index.html')
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveFile(req.url === '/' ? '/index.html' : req.url)
    if (file === FORBIDDEN) {
      res.writeHead(403).end('Forbidden')
      return
    }
    if (!file) {
      res.writeHead(404).end('Not found')
      return
    }
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('Not found')
  }
})

function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 20) {
      listen(port + 1, attempt + 1)
      return
    }
    console.error('Could not start the demo server:', err.message)
    process.exit(1)
  })

  server.listen(port, () => {
    const url = `http://localhost:${port}`
    console.log('')
    console.log('  GEOTECH HR Portal - demo running')
    console.log(`  ${url}`)
    console.log('')
    console.log('  Password for every account: Geo@123456')
    console.log('')
    console.log('  EMP-00001   Employee            Alex Morgan')
    console.log('  EMP-00002   Direct Manager      Jordan Lee      approval stage 1')
    console.log('  EMP-00008   Technical Manager   Khaled Nabil    approval stage 2')
    console.log('  EMP-00009   General Manager     Hesham Fouad    approval stage 3')
    console.log('  EMP-00003   HR                  Riley Chen')
    console.log('')
    console.log('  Every request is approved in that order. Full list in')
    console.log('  03-ACCOUNTS/GEOTECH-HR-Accounts.xlsx')
    console.log('')
    console.log('  Close this window to stop the demo.')
    console.log('')

    const open =
      process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
      process.platform === 'darwin' ? ['open', [url]] :
      ['xdg-open', [url]]

    import('node:child_process')
      .then(({ spawn }) => spawn(open[0], open[1], { stdio: 'ignore', detached: true }).unref())
      .catch(() => console.log(`  Open ${url} in your browser.`))
  })
}

listen(START_PORT)
