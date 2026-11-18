"""Optional native PowerPoint golden runner dependencies: Pillow, numpy, scikit-image."""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFont
from skimage.metrics import structural_similarity

root = Path(sys.argv[1])
manifest = json.loads((root / 'inputs.json').read_text(encoding='utf-8'))


def metrics(source, actual):
    a, b = np.asarray(source), np.asarray(actual)
    delta = np.abs(a.astype(float) - b.astype(float))
    return {
        'ssim': float(structural_similarity(a, b, channel_axis=2, data_range=255)),
        'changedPixelsPct': float((delta.max(axis=2) > 16).mean() * 100),
        'meanAbsChannelError': float(delta.mean()),
    }


results = []
overview = Image.new('RGB', (1460, 554 * len(manifest['slides'])), '#eeeeee')
draw = ImageDraw.Draw(overview)
try:
    label_font = ImageFont.truetype('arial.ttf', 24)
except OSError:
    label_font = ImageFont.load_default(size=24)
for index, slide in enumerate(manifest['slides']):
    number = index + 1
    source = Image.open(root / f'source-{number}.png').convert('RGB')
    actual = Image.open(root / f'actual-{number}.png').convert('RGB')
    if source.size != actual.size:
        raise ValueError(f'Slide {number}: different render dimensions')
    regions = []
    for region in slide['regions']:
        x, y, w, h = (region[k] for k in ('x', 'y', 'w', 'h'))
        rect = (max(0, int(x / 100 * source.width) - 16), max(0, int(y / 100 * source.height) - 16),
                min(source.width, int((x + w) / 100 * source.width) + 16), min(source.height, int((y + h) / 100 * source.height) + 16))
        if rect[2] - rect[0] < 7 or rect[3] - rect[1] < 7:
            continue  # Entirely off-page objects have no visible comparison area.
        regions.append({**region, 'rectPx': rect, **metrics(source.crop(rect), actual.crop(rect))})
    results.append({'slide': number, 'wholeSlide': metrics(source, actual), 'regions': regions,
                    'inventory': slide.get('inventory', {}), 'unmapped': slide.get('unmapped', [])})
    ImageEnhance.Contrast(ImageChops.difference(source, actual)).enhance(4).save(root / f'diff-{number}.png')
    for column, (name, picture) in enumerate([('SOURCE', source), ('ACTUAL', actual)]):
        picture = picture.copy()
        picture.thumbnail((720, 499))
        draw.text((column * 730 + 8, index * 554 + 10), f'{name} / SLIDE {number}', fill='#222222', font=label_font)
        overview.paste(picture, (column * 730 + 5, index * 554 + 42))

overview.save(root / 'overview.png')
report = {
    'renderer': 'Microsoft PowerPoint native PNG export, isolated per document',
    'inputs': manifest['files'],
    'thresholds': {'wholeSlideSSIM': 0.999, 'regionSSIM': 0.999},
    'note': 'Original content refilled through supported slide fields. Unmapped content is reported. Agreed exclusion of slide number fields remains. No image alignment, resizing or repair is applied before measurement.',
    'slides': results,
}
native_differences = json.loads((root / 'native-differences.json').read_text(encoding='utf-8'))
report['nativeDifferences'] = native_differences
report['passed'] = not native_differences and all(not s['unmapped'] and s['wholeSlide']['ssim'] >= 0.999 and all(r['ssim'] >= 0.999 for r in s['regions']) for s in results)
(root / 'metrics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
lines = ['# Native PowerPoint golden test', '', f"Result: {'PASS' if report['passed'] else 'FAIL'}. Threshold: SSIM >= 0.999.", '',
         '| Slide | SSIM | Changed pixels | Unmapped content objects |', '|---|---:|---:|---:|']
for slide in results:
    m = slide['wholeSlide']
    lines.append(f"| {slide['slide']} | {m['ssim']:.6f} | {m['changedPixelsPct']:.2f}% | {len(slide['unmapped'])} |")
lines += ['', report['note'], '', f'Native text differences: {len(native_differences)}.', '',
          'See overview.png, diff-N.png, metrics.json, native-differences.json and import-report.json for details.']
(root / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps(report))
