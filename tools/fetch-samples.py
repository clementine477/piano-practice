"""Download public sample packs; verify the archive and every extracted file."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, shutil, tempfile, zipfile
from sample_download import download
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--bank', action='append', help='Fetch only this bank (repeatable). Default: all four.')
parser.add_argument('--from-dir', type=Path, help='Use previously downloaded ZIP files instead of the network.')
parser.add_argument('--verify-only', action='store_true')
args = parser.parse_args()
manifest = json.loads((ROOT / 'assets/samples.json').read_text())
target = ROOT / 'frontend/public/soundfont'
target.mkdir(parents=True, exist_ok=True)
def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()
for bank in args.bank or manifest['banks']:
    if bank not in manifest['banks']: raise SystemExit('Unknown bank: ' + bank)
    spec = manifest['banks'][bank]
    valid = all((target / p).is_file() and digest(target / p) == h for p, h in spec['files'].items())
    if valid:
        print(bank + ': verified'); continue
    if args.verify_only: raise SystemExit(bank + ': missing or changed; run pnpm samples')
    with tempfile.TemporaryDirectory(prefix='piano-samples-') as tmp:
        archive = Path(tmp) / (bank + '.zip')
        if args.from_dir: shutil.copyfile(args.from_dir / archive.name, archive)
        else:
            print('Downloading ' + bank, flush=True)
            download(spec['url'], archive)
        if archive.stat().st_size != spec['bytes'] or digest(archive) != spec['sha256']:
            raise SystemExit('Sample archive checksum mismatch: ' + bank)
        with zipfile.ZipFile(archive) as z:
            if set(z.namelist()) != set(spec['files']) or len(z.namelist()) != len(spec['files']):
                raise SystemExit('Unexpected sample archive entries')
            for name, expected in spec['files'].items():
                p = PurePosixPath(name)
                if p.is_absolute() or '..' in p.parts or p.parts[0] != bank: raise SystemExit('Unsafe archive path')
                data = z.read(name)
                if hashlib.sha256(data).hexdigest() != expected: raise SystemExit('Invalid sample: ' + name)
                dest = target / name
                dest.parent.mkdir(parents=True, exist_ok=True)
                # Replace atomically; a failed download never truncates existing samples.
                temp = dest.with_name(dest.name + '.partial')
                temp.write_bytes(data); temp.replace(dest)
        print(bank + ': installed and verified')
