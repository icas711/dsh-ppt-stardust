"""Source fidelity acceptance for scene serialization; no replaceable baselines."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
from skimage.metrics import structural_similarity

root = Path(sys.argv[1])
run = json.loads((root / 'run.json').read_text(encoding='utf-8'))
results = []
def ssim(a, b):
    if a.size != b.size:
        raise ValueError(f'Dimensions differ: {a.size} / {b.size}')
    if min(a.size) < 7:
        return float(np.array_equal(np.asarray(a), np.asarray(b)))
    return float(structural_similarity(np.asarray(a), np.asarray(b), channel_axis=2, data_range=255))

for case in run['cases']:
    folder = root / case['id']
    source = Image.open(folder / 'source.png').convert('RGB')
    actual = Image.open(folder / 'actual.png').convert('RGB')
    score = ssim(source, actual)
    regions = []
    for region in case['regions']:
        sx, sy = source.width / case['pageSize']['width'], source.height / case['pageSize']['height']
        x, y = region['x'] * sx, region['y'] * sy
        box = (max(0, int(x)-2), max(0, int(y)-2), min(source.width, int(x+region['w']*sx)+3), min(source.height, int(y+region['h']*sy)+3))
        regions.append({'id': region['id'], 'ssim': ssim(source.crop(box), actual.crop(box))})
    passed = score >= .999 and all(r['ssim'] >= .999 for r in regions)
    results.append({'id':case['id'],'ssim':score,'regions':regions,'passed':passed})
    ImageEnhance.Contrast(ImageChops.difference(source,actual)).enhance(4).save(folder / 'diff.png')
report = {'passed': all(r['passed'] for r in results), 'threshold': .999, 'cases': results}
(root / 'metrics.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
lines = ['# Scene fidelity golden', '', '| Case | Source vs scene SSIM | Passed |', '|---|---:|---|']
lines += [f"| {r['id']} | {r['ssim']:.8f} | {r['passed']} |" for r in results]
(root / 'report.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('\n'.join(lines))
if not report['passed']:
    raise SystemExit('Scene fidelity failed: see metrics.json and diff.png')
