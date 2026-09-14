"""Seal a qualified RC16 FULL tree, then validate every archived byte.

Run after all build, tests and report-writing processes have finished:
    python scripts/seal-rc16.py
No LIGHT edition is generated. The output integrity record is kept outside
this tree so that producing it cannot invalidate the archive's own manifest.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent
QA = ROOT / 'QA' / 'RE_REPAIR_RC16'
MANIFEST = ROOT / 'QA' / 'FILE_SHA256_MANIFEST.txt'
DEST = OUT / 'Rail_Empire_S3_GAMEPLAY_REPAIR_RC16.zip'
TEMP = DEST.with_suffix('.zip.tmp')
RECORD = OUT / 'RE_RC16_PACK_INTEGRITY.json'


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    start = time.monotonic()
    summary = json.loads((QA / 'SUMMARY.json').read_text(encoding='utf-8'))
    require(summary.get('pass') is True, 'Qualification did not pass')
    require(summary['tests']['s3']['ok'] is True, 'S3 gate did not pass')
    require(summary['tests']['repair']['fail'] == 0, 'Repair tests failed')
    require(summary['tests']['standard']['fail'] == 0, 'Standard tests failed')
    for proof in ('REPRODUCIBLE_BUILD.json', 'INPUT_PARITY.json'):
        require(json.loads((QA / proof).read_text())['pass'] is True, proof)

    candidates = sorted(ROOT.rglob('*'))
    require(not any(p.is_symlink() for p in candidates), 'Unexpected symlink')
    files = [p for p in candidates if p.is_file() and p != MANIFEST]
    hashes = {p.relative_to(ROOT).as_posix(): digest(p) for p in files}
    MANIFEST.write_text(''.join(f'{value}  {name}\n' for name, value in hashes.items()),
                        encoding='utf-8')
    hashes[MANIFEST.relative_to(ROOT).as_posix()] = digest(MANIFEST)
    files = sorted(files + [MANIFEST])
    sizes = {p.relative_to(ROOT).as_posix(): p.stat().st_size for p in files}
    print(f'Building RC16 FULL: {len(files)} files.', flush=True)
    with zipfile.ZipFile(TEMP, 'w', compression=zipfile.ZIP_DEFLATED,
                         compresslevel=6, allowZip64=True) as archive:
        for index, path in enumerate(files, 1):
            archive.write(path, path.relative_to(ROOT).as_posix())
            if index % 10000 == 0:
                print(f'Archived {index}/{len(files)}.', flush=True)
    print('Checking CRC, every entry SHA-256 and the embedded manifest.', flush=True)
    with zipfile.ZipFile(TEMP) as archive:
        names = archive.namelist()
        require(len(names) == len(hashes), 'Wrong archive entry count')
        require(len(set(names)) == len(names), 'Duplicate archive entry')
        require(set(names) == set(hashes), 'Wrong archive file set')
        require(archive.testzip() is None, 'Archive CRC failure')
        for item in archive.infolist():
            require(item.file_size == sizes[item.filename], f'Size mismatch: {item.filename}')
            h = hashlib.sha256()
            with archive.open(item) as member:
                for block in iter(lambda: member.read(1024 * 1024), b''):
                    h.update(block)
            require(h.hexdigest() == hashes[item.filename], f'Hash mismatch: {item.filename}')
        manifest_lines = archive.read('QA/FILE_SHA256_MANIFEST.txt').decode('utf-8').splitlines()
        require(len(manifest_lines) == len(hashes) - 1, 'Wrong manifest count')
        for line in manifest_lines:
            expected, name = line.split('  ', 1)
            require(hashes.get(name) == expected, f'Manifest mismatch: {name}')
    # Detect any external writes which happened while the archive was being built.
    final_files = sorted(p for p in ROOT.rglob('*') if p.is_file())
    require(set(p.relative_to(ROOT).as_posix() for p in final_files) == set(hashes),
            'Source file set changed during sealing')
    for path in final_files:
        require(digest(path) == hashes[path.relative_to(ROOT).as_posix()],
                f'Source changed during sealing: {path}')
    os.replace(TEMP, DEST)
    result = {
        'release': 'RC16 FULL', 'pass': True,
        'method': 'ZIP CRC, SHA-256 of every archive member and embedded file manifest; source immutability rechecked after creation. Not browser disk or native Windows validation.',
        'archives': [{
            'edition': 'FULL', 'file': DEST.name,
            'zipBytes': DEST.stat().st_size,
            'zipMiB': DEST.stat().st_size / 1048576,
            'sha256': digest(DEST), 'fileEntries': len(files),
            'allEntryHashesChecked': len(files),
            'completeManifestEntriesVerified': len(files) - 1,
            'crcAllEntriesPassed': True,
            'sourceUnchangedDuringSealing': True,
            'logicalUncompressedBytes': sum(sizes.values()),
            'seconds': round(time.monotonic() - start, 2)
        }]
    }
    temp_record = RECORD.with_suffix('.json.tmp')
    temp_record.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n',
                           encoding='utf-8')
    os.replace(temp_record, RECORD)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
    print('RC16 FULL sealed and verified.', flush=True)


if __name__ == '__main__':
    main()
