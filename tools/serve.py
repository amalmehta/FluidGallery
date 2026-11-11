"""Local dev server that never lets the browser cache files, so edits show on reload.
Usage: python3 tools/serve.py [port]   (serves the repo root)"""
import http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCache).serve_forever()
