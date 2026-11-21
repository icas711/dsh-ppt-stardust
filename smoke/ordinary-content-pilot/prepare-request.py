"""Package model-authored slides with unchanged source/image bytes. No composition or API calls."""
import argparse
import base64
import hashlib
import json
import struct
from pathlib import Path


def reject_constant(value):
    raise ValueError('Non-finite JSON number: ' + value)


def canonical(value):
    # This controlled dataset has integer indicators; avoid Python/JS float formatting differences.
    if isinstance(value, float):
        raise ValueError('This dataset uses integer numeric values; monetary strings stay strings')
    if isinstance(value, dict):
        return {k: canonical(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def json_bytes(value, *, compact=False):
    return json.dumps(value, ensure_ascii=False, allow_nan=False,
                      **({'separators': (',', ':')} if compact else {'indent': 2})).encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('draft', type=Path, help='JSON object containing only slides authored from material.txt')
    parser.add_argument('--out', type=Path, required=True, help='New output file; never overwrites an existing request')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    draft = json.loads(args.draft.read_bytes().decode('utf-8-sig'), parse_constant=reject_constant)
    if not isinstance(draft, dict) or set(draft) != {'slides'}:
        raise ValueError('Draft must contain only the slides array')
    slides = draft['slides']
    types = ['cards', 'process', 'timeline', 'comparison', 'big_number', 'chart', 'table', 'image']
    if not isinstance(slides, list) or [s.get('visual', {}).get('type') for s in slides] != types:
        raise ValueError('Expected eight logical slides in order: ' + ', '.join(types))
    source = (root / 'material.txt').read_bytes().decode('utf-8')
    image = (root / 'source.png').read_bytes()
    if image[:8] != b'\x89PNG\r\n\x1a\n' or image[12:16] != b'IHDR':
        raise ValueError('Invalid original PNG')
    width, height = struct.unpack('>II', image[16:24])
    spec = {'version': 1, 'mode': 'demo', 'allowMoreSlides': True,
            'sources': [{'id': 'material', 'text': source, 'synthetic': True}],
            'assets': [{'id': 'pilot-image', 'mime': 'image/png', 'width': width, 'height': height,
                        'data': 'data:image/png;base64,' + base64.b64encode(image).decode('ascii')}],
            'slides': slides}
    payload = {'mode': spec['mode'], 'sources': spec['sources'],
               'slides': [{k: s[k] for k in ['id', 'title', 'visual']} | {'notes': s.get('notes')}
                          for s in slides],
               'assets': [{'id': 'pilot-image', 'mime': 'image/png', 'width': width, 'height': height,
                           'sha256': hashlib.sha256(image).hexdigest()}]}
    spec['contentHash'] = hashlib.sha256(json_bytes(canonical(payload), compact=True)).hexdigest()
    request = {'title': 'Подготовка пилота: план и результаты', 'lang': 'ru',
               'templateId': 'public:dkp', 'visualSpec': spec}
    data = json_bytes(request) + b'\n'
    if args.out.resolve() in {args.draft.resolve(), root / 'material.txt', root / 'source.png', Path(__file__).resolve()}:
        raise ValueError('Output must not replace input files')
    with args.out.open('xb') as output:
        output.write(data)
    print(json.dumps({'title': request['title'], 'requestFile': str(args.out.resolve()),
                      'requestSha256': hashlib.sha256(data).hexdigest()}, ensure_ascii=False))


if __name__ == '__main__':
    main()
