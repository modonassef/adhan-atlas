# Development helper for make-icons.html: receives the PNGs drawn in the browser and writes them into src/web.
# Local only (127.0.0.1), and only icons/<name>.png or og.png can be written.
# Run from the project folder:  python src/tools/save-images.py   then open src/tools/make-icons.html through
# the local preview server (http://localhost:8765/src/tools/make-icons.html).
import http.server, re, sys, os, urllib.parse
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web')
OK = re.compile(r'^(icons/[a-z0-9-]+\.png|og\.png)$')

class H(http.server.BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8765')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        self.send_response(204); self.cors(); self.end_headers()
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = (q.get('name') or [''])[0]
        n = int(self.headers.get('Content-Length', 0))
        data = self.rfile.read(n)
        if not OK.match(name) or data[:8] != b'\x89PNG\r\n\x1a\n':
            self.send_response(400); self.cors(); self.end_headers(); return
        path = os.path.join(ROOT, *name.split('/'))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'wb').write(data)
        self.send_response(200); self.cors(); self.end_headers(); self.wfile.write(f'{name} {len(data)}'.encode())

http.server.HTTPServer(('127.0.0.1', 8766), H).serve_forever()
