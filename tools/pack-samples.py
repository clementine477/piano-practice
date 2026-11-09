"""Build deterministic release packs from the licensed local sample banks."""
from pathlib import Path
import hashlib, json, zipfile
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'release/samples'
OUT.mkdir(parents=True, exist_ok=True)
banks = ['upright-kw', 'ydp-grand', 'salamander-grand', 'steinway-b']
result = {'version': 1, 'release': 'samples-v1', 'banks': {}}
for bank in banks:
    source = ROOT / 'frontend/public/soundfont' / bank
    archive = OUT / (bank + '.zip')
    entries = {}
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as z:
        for p in sorted(source.rglob('*')):
            if not p.is_file() or p.name.startswith('.') or 'LICENSES' in p.relative_to(source).parts: continue
            name = bank + '/' + p.relative_to(source).as_posix()
            data = p.read_bytes()
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            z.writestr(info, data)
            entries[name] = hashlib.sha256(data).hexdigest()
        for p in sorted((ROOT / 'licenses/samples' / bank).iterdir()):
            if p.is_file():
                name = bank + '/LICENSES/' + p.name
                data = p.read_bytes()
                info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
                info.external_attr = 0o100644 << 16
                z.writestr(info, data)
                entries[name] = hashlib.sha256(data).hexdigest()
    result['banks'][bank] = {
        'url': 'https://github.com/clementine477/piano-practice/releases/download/samples-v1/' + archive.name,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
        'bytes': archive.stat().st_size, 'files': entries,
    }
    print(bank, archive.stat().st_size, 'bytes')
(ROOT / 'assets/samples.json').write_text(json.dumps(result, indent=2) + '\n')
