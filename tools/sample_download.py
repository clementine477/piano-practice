"""Retry temporary download failures without accepting incomplete sample packs."""
import http.client
import shutil
import time
import urllib.error
import urllib.request


def download(url, destination, attempts=4):
    if attempts < 1:
        raise ValueError('At least one download attempt is required')
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={
                'User-Agent': 'Piano-Practice-sample-installer/0.7',
            })
            with urllib.request.urlopen(request, timeout=120) as source, destination.open('wb') as out:
                shutil.copyfileobj(source, out)
                expected = source.headers.get('Content-Length')
                if expected is not None and out.tell() != int(expected):
                    raise http.client.IncompleteRead(b'', int(expected) - out.tell())
            return
        except urllib.error.HTTPError as error:
            error.close()
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt + 1 == attempts:
                raise
            reason = 'HTTP ' + str(error.code)
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead) as error:
            if attempt + 1 == attempts:
                raise
            reason = type(error).__name__
        print(f'Download interrupted ({reason}); retrying {attempt + 2}/{attempts}', flush=True)
        time.sleep(2 ** attempt)
