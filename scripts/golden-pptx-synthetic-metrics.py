"""Portable WASM regression baselines, distinct from native fidelity acceptance."""
import json
from pathlib import Path
import shutil
import sys

import numpy as np
from PIL import Image, ImageChops, ImageEnhance, ImageDraw
from skimage.metrics import structural_similarity

root, baseline_root = (Path(arg) for arg in sys.argv[1:3])
record = '--record' in sys.argv[3:]
run = json.loads((root / 'run.json').read_text(encoding='utf-8'))
baseline_file = baseline_root / 'manifest.json'
baseline = {} if record else json.loads(baseline_file.read_text(encoding='utf-8'))
results = []
errors = []


def compare(source, actual):
    if source.size != actual.size:
        raise ValueError(f'Render dimensions changed: {source.size} vs {actual.size}')
    a, b = np.asarray(source), np.asarray(actual)
    delta = np.abs(a.astype(float) - b.astype(float))
    return {'ssim': float(structural_similarity(a, b, channel_axis=2, data_range=255)),
            'changedPixelsPct': float((delta.max(axis=2) > 16).mean() * 100)}


identity = {'renderer': run['renderer'], 'fonts': run['fonts'], 'pageSize': run['pageSize'],
            'sources': {case['id']: case['sourceSha256'] for case in run['cases']}}
if not record and baseline['identity'] != identity:
    errors.append('Renderer, fixture sources, page size or font hashes changed; review and record new baselines explicitly.')
if record:
    baseline_root.mkdir(parents=True, exist_ok=True)

for case in run['cases']:
    directory = root / case['id']
    source = Image.open(directory / 'source.png').convert('RGB')
    actual = Image.open(directory / 'actual.png').convert('RGB')
    fidelity = compare(source, actual)
    ImageEnhance.Contrast(ImageChops.difference(source, actual)).enhance(4).save(directory / 'diff.png')
    overview = Image.new('RGB', (source.width * 2, source.height + 30), '#eeeeee')
    draw = ImageDraw.Draw(overview)
    draw.text((8, 8), f"SOURCE / {case['id']}", fill='black')
    draw.text((source.width + 8, 8), 'ACTUAL', fill='black')
    overview.paste(source, (0, 30)); overview.paste(actual, (source.width, 30))
    overview.save(directory / 'overview.png')
    regression = {}
    for name, picture in [('source', source), ('actual', actual)]:
        reference = baseline_root / f"{case['id']}-{name}.png"
        if record:
            shutil.copyfile(directory / f'{name}.png', reference)
        regression[name] = compare(Image.open(reference).convert('RGB'), picture)
        ImageEnhance.Contrast(ImageChops.difference(Image.open(reference).convert('RGB'), picture)).enhance(4).save(directory / f'baseline-diff-{name}.png')
        if regression[name]['ssim'] < 0.999:
            errors.append(f"{case['id']}/{name}: changed from reviewed WASM baseline")
    reference_actual = Image.open(baseline_root / f"{case['id']}-actual.png").convert('RGB')
    region_scores = []
    for region in case['regions']:
        x, y, w, h = (region[key] for key in ('x', 'y', 'w', 'h'))
        rect = (max(0, int(x / 100 * actual.width) - 8), max(0, int(y / 100 * actual.height) - 8),
                min(actual.width, int((x + w) / 100 * actual.width) + 8), min(actual.height, int((y + h) / 100 * actual.height) + 8))
        if rect[2] - rect[0] >= 7 and rect[3] - rect[1] >= 7:
            region_scores.append(compare(reference_actual.crop(rect), actual.crop(rect)))
    if any(score['ssim'] < 0.999 for score in region_scores):
        errors.append(f"{case['id']}: content region changed from reviewed WASM baseline")
    # Known losses remain losses even when the regression baseline matches.
    results.append({**case, 'sourceVsActual': fidelity, 'baselineComparison': regression, 'baselineRegions': region_scores,
                    'fidelityPassed': fidelity['ssim'] >= 0.999 and not case['knownLimitations']})

if record:
    baseline_file.write_text(json.dumps({'identity': identity, 'recordedSourceVsActual': {
        case['id']: case['sourceVsActual'] for case in results}}, indent=2) + '\n', encoding='utf-8')
report = {'renderer': run['renderer'], 'regressionPassed': not errors, 'errors': errors,
          'fidelityPassed': all(case['fidelityPassed'] for case in results), 'cases': results}
(root / 'metrics.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
lines = ['# Synthetic PPTX regression', '',
         f"Regression: {'PASS' if not errors else 'FAIL'}; full fidelity: {'PASS' if report['fidelityPassed'] else 'FAIL'}.", '',
         'WASM 0.2.3 and bundled Liberation Sans. Baseline SSIM >= 0.999; this is not a claim of native PowerPoint fidelity.', '',
         '| Fixture | Source vs actual SSIM | Actual vs reviewed baseline SSIM |', '|---|---:|---:|']
for case in results:
    lines.append(f"| {case['id']} | {case['sourceVsActual']['ssim']:.6f} | {case['baselineComparison']['actual']['ssim']:.6f} |")
lines += ['', '## Known limitations', '']
for case in results:
    lines += [f"- {case['id']}: {item}" for item in case['knownLimitations']]
lines += ['', *errors]
(root / 'report.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print('\n'.join(lines))
sys.exit(1 if errors else 0)
