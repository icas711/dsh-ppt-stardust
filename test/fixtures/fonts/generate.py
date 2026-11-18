"""Generate original, public-domain test fonts; requires fonttools only to regenerate.

The square glyphs are deliberately simple and cover ASCII and Cyrillic. They let
browser QA verify a real sfnt font without redistributing third-party fonts.
"""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

for family in ('DSH Test Heading', 'DSH Test Body'):
    builder = FontBuilder(1000, isTTF=True)
    codes = list(range(32, 127)) + list(range(0x400, 0x500))
    names = ['.notdef'] + [f'uni{code:04X}' for code in codes]
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({code: f'uni{code:04X}' for code in codes})
    glyphs = {}
    for name in names:
        pen = TTGlyphPen(None)
        if name != 'uni0020':
            pen.moveTo((80, 0))
            pen.lineTo((480, 0))
            pen.lineTo((480, 680 if family.endswith('Heading') else 480))
            pen.lineTo((80, 680 if family.endswith('Heading') else 480))
            pen.closePath()
        glyphs[name] = pen.glyph()
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (600, 80) for name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': family, 'styleName': 'Regular', 'uniqueFontIdentifier': family,
                           'fullName': family, 'psName': family.replace(' ', ''),
                           'licenseDescription': 'Public domain. Generated for dsh-ppt tests.'})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200, fsType=0)
    builder.setupPost()
    builder.setupMaxp()
    builder.font['head'].created = builder.font['head'].modified = 3800000000
    builder.save(Path(__file__).parent / (family.replace(' ', '-') + '.ttf'))
