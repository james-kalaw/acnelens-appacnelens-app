"""Local test server that behaves like GitHub Pages: every response is gzip-compressed on the fly,
so Content-Length is the COMPRESSED size (this is what broke the model download on the live site).
Usage: python3 tests/serve_like_github.py [port]   (serves the docs/ folder)"""
import gzip, http.server, os, sys

DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=DOCS, **k)

    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, "index.html")
        if not os.path.isfile(path):
            self.send_error(404); return None
        body = gzip.compress(open(path, "rb").read(), 6)
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Encoding", "gzip")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        import io
        return io.BytesIO(body)

    def log_message(self, *a):
        pass


H.extensions_map.update({".wasm": "application/wasm", ".onnx": "application/octet-stream", ".webmanifest": "application/manifest+json"})
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 8766), H).serve_forever()
