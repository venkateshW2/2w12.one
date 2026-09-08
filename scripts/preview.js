// Serves dist/ so the built site can be looked at before it goes anywhere near
// a host. Cloudflare Pages behaves the same way: directories resolve to
// index.html, and an unknown path gets 404.html.
//
// Usage: npm run preview   ->  http://localhost:4000
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 4000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4'
};

if (!fs.existsSync(ROOT)) {
  console.error('dist/ does not exist yet — run `npm run build` first.');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, urlPath);

    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(ROOT, '404.html');
    }

    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        return res.end('Not found');
      }
      const isMissing = file.endsWith('404.html');
      res.writeHead(isMissing ? 404 : 200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  })
  .listen(PORT, () => {
    console.log(`Built site at http://localhost:${PORT}`);
    console.log('  /                  landing');
    console.log('  /@venkatesh        your page');
    console.log('  /gallery           studio gallery');
    console.log('  /work              coming soon');
    console.log('\nThis is dist/ served as plain files — no server logic, no database.');
  });
