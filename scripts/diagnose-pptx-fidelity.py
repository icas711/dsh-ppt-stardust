"""Measure diagnostic controls without alignment/resizing or publishing source content."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity

root = Path(sys.argv[1])
baseline = Path(sys.argv[2])
scenes = json.loads((root / 'imported-scenes.json').read_text(encoding='utf-8'))
report = json.loads((root / 'controls.json').read_text(encoding='utf-8'))
variants = [d for d in root.iterdir() if d.is_dir() and all((d / f'actual-{i+1}.png').exists() for i in range(len(scenes['slides'])))]
with zipfile.ZipFile(root / 'noop' / 'source.pptx') as original, zipfile.ZipFile(root / 'noop' / 'actual.pptx') as noop, zipfile.ZipFile(root / 'patch' / 'actual.pptx') as patched:
    normalized_types = lambda b: sorted((e.tag, tuple(sorted(e.attrib.items()))) for e in ET.fromstring(b))
    xml_changes = []
    def compare_xml(a, b, path=''):
        if a.tag != b.tag or a.attrib != b.attrib or len(a) != len(b):
            xml_changes.append({'path': path, 'structural': True})
        if a.text != b.text:
            xml_changes.append({'path': path, 'text': True})
        for i,(x,y) in enumerate(zip(a,b)):
            compare_xml(x,y,path+'/'+x.tag.split('}')[-1]+'['+str(i)+']')
    part = report['patch']['edit']['part'].lstrip('/')
    compare_xml(ET.fromstring(original.read(part)),ET.fromstring(patched.read(part)))
    report['packageInvariants'] = {
        'contentTypesSemanticallyEqual': normalized_types(original.read('[Content_Types].xml')) == normalized_types(noop.read('[Content_Types].xml')),
        'patchXmlDifferences': xml_changes,
        'preservedOleBinaryParts': len([k for k in original.namelist() if k.startswith('ppt/embeddings/') and k.endswith('.bin') and original.read(k)==patched.read(k)]),
        'originalPartCount': len(original.namelist())}

def measure(a, b):
    if a.shape != b.shape:
        raise ValueError('Render dimensions differ')
    return {'ssim': float(structural_similarity(a, b, channel_axis=2, data_range=255)),
            'changedPixelsPct': float((np.abs(a.astype(float)-b.astype(float)).max(axis=2)>16).mean()*100)}

for row in report['slides']:
    n = row['slide']
    source = np.asarray(Image.open(root / 'noop' / f'source-{n}.png').convert('RGB'))
    row['controls'] = {v.name: measure(source, np.asarray(Image.open(v / f'actual-{n}.png').convert('RGB'))) for v in variants}
    actual = np.asarray(Image.open(baseline / f'actual-{n}.png').convert('RGB'))
    direct = np.asarray(Image.open(root / 'direct' / f'actual-{n}.png').convert('RGB'))
    row['templateVsDirect'] = measure(direct, actual)
    row['template'] = measure(source, actual)
    regions = []
    for e in scenes['slides'][n-1]['elements']:
        if e['type'] in ('group',) or e.get('hidden'):
            continue
        f = e['frame']
        # Region coordinates include the existing final affine transform.
        m = e.get('transform', [1,0,0,1,0,0])
        pts = [(m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]) for x,y in [(f['x'],f['y']),(f['x']+f['w'],f['y']),(f['x'],f['y']+f['h']),(f['x']+f['w'],f['y']+f['h'])]]
        xs,ys = zip(*pts)
        h,w = source.shape[:2]
        x1,x2 = max(0,int(min(xs)/scenes['pageSize']['width']*w)),min(w,int(max(xs)/scenes['pageSize']['width']*w))
        y1,y2 = max(0,int(min(ys)/scenes['pageSize']['height']*h)),min(h,int(max(ys)/scenes['pageSize']['height']*h))
        if x2-x1<7 or y2-y1<7:
            continue
        a,b = source[y1:y2,x1:x2],actual[y1:y2,x1:x2]
        regions.append({'id': e['id'], 'type': e['type'], 'sourceShapeId': e.get('source',{}).get('shapeId'),
                        'rectPx':[x1,y1,x2,y2],**measure(a,b),
                        'changedPixels':int((np.abs(a.astype(float)-b.astype(float)).max(axis=2)>16).sum())})
    row['regions'] = sorted(regions,key=lambda r:r['changedPixels'],reverse=True)
(root / 'diagnosis.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps([{k:v for k,v in r.items() if k not in ('regions','unsupported')} for r in report['slides']],indent=2))
