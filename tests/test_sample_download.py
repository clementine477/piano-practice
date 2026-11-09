from contextlib import contextmanager, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest import TestCase
from unittest.mock import patch
from urllib.error import HTTPError

from tools.sample_download import download


@contextmanager
def server(responses):
    class Handler(BaseHTTPRequestHandler):
        calls = 0

        def do_GET(self):
            status, body, length = responses[min(Handler.calls, len(responses) - 1)]
            Handler.calls += 1
            self.send_response(status)
            self.send_header('Content-Length', str(length if length is not None else len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args):
            pass

    service = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=service.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{service.server_port}/sample.zip', Handler
    finally:
        service.shutdown()
        service.server_close()
        thread.join()


class SampleDownloadTests(TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.target = Path(temp.name) / 'sample.zip'
        sleep = patch('tools.sample_download.time.sleep')
        sleep.start()
        self.addCleanup(sleep.stop)
        output = redirect_stdout(StringIO())
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)

    def test_gateway_timeout_recovers(self):
        with server([(504, b'', None), (200, b'complete sample', None)]) as (url, handler):
            download(url, self.target)
            self.assertEqual(handler.calls, 2)
            self.assertEqual(self.target.read_bytes(), b'complete sample')

    def test_partial_response_is_replaced_not_appended(self):
        with server([(200, b'partial data', 100), (200, b'complete', None)]) as (url, handler):
            download(url, self.target)
            self.assertEqual(handler.calls, 2)
            self.assertEqual(self.target.read_bytes(), b'complete')

    def test_permanent_failure_is_not_retried(self):
        with server([(404, b'', None)]) as (url, handler):
            with self.assertRaises(HTTPError):
                download(url, self.target)
            self.assertEqual(handler.calls, 1)
            self.assertFalse(self.target.exists())

    def test_temporary_failure_has_a_retry_limit(self):
        with server([(503, b'', None)]) as (url, handler):
            with self.assertRaises(HTTPError):
                download(url, self.target, attempts=3)
            self.assertEqual(handler.calls, 3)
