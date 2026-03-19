# HomeStylo Design System — Style & Color Reference

> Condensed from Design Knowledge Base v2.0. Used for FLUX prompt generation and style matching.

## Color Formula by Style

### Mid-Century (中古风)
- **60% base**: warm cream walls + honey wood floor
- **30% secondary**: dark walnut furniture + brown leather/corduroy
- **10% accent**: brass + olive green or mustard yellow
- **FLUX prompt keywords**: "mid-century modern living room, walnut furniture, warm brown corduroy sofa, brass accent lamp, PH pendant light, warm natural lighting, 3000K tone, editorial interior photography, soft shadows"
- **Material triangle**: corduroy/leather + walnut wood + brass

### Cream French (奶油法式)
- **60% base**: pure white/cream walls + light wood floor
- **30% secondary**: curved white/cream upholstery + light wood
- **10% accent**: gold + soft pink or sage green
- **FLUX prompt keywords**: "cream French style living room, soft white and beige palette, curved furniture silhouettes, ornate vintage chandelier, warm diffused natural light, plaster walls, herringbone floor, romantic elegant atmosphere"
- **Material triangle**: velvet + light oak + gold metal

### Wabi-Sabi (侘寂风)
- **60% base**: warm white walls + matte stone/concrete floor
- **30% secondary**: raw linen + weathered wood
- **10% accent**: dried branches + handmade ceramics + muted earth tones
- **FLUX prompt keywords**: "wabi-sabi living room, raw plaster walls, imperfect textures, natural linen sofa, weathered elm wood furniture, dried pampas grass, handmade pottery, soft diffused light, zen minimalism, muted earth palette"
- **Material triangle**: linen/cotton + reclaimed wood + ceramic

### Song Dynasty (宋式美学)
- **60% base**: off-white walls + light stone floor
- **30% secondary**: rosewood/dark elm furniture
- **10% accent**: ink black + indigo blue + celadon
- **FLUX prompt keywords**: "Chinese Song dynasty aesthetic living room, minimal rosewood furniture, ink wash painting, celadon vase, paper screen, natural light through rice paper window, scholarly atmosphere, restrained elegance"
- **Material triangle**: silk/cotton + rosewood + porcelain

### Dopamine (多巴胺) — Used for content/showcase
- **60% base**: warm white/light gray walls
- **30% secondary**: deep brown corduroy + walnut wood
- **10% accent**: pink + red + yellow + blue (multi-color burst)
- **FLUX prompt keywords**: "dopamine maximalist living room, bold colorful accents, pink pendant light, yellow mushroom lamp, Memphis style dining set, deep brown corduroy sofa, walnut TV cabinet, playful art prints, warm vibrant atmosphere"
- **Material triangle**: corduroy + walnut wood + colored glass/metal

## 60-30-10 Color Rule

Every room must follow the 60-30-10 color distribution:
- **60% dominant**: walls + floor + large rug (usually neutral)
- **30% secondary**: sofa + curtains + medium furniture (supporting color)
- **10% accent**: pillows + lamps + art + small objects (personality color)

**Variant: Safety base + one explosion point** — Gray/cream base + ONE high-saturation element (e.g., orange rug). This is the easiest formula for AI to execute and had the highest engagement in testing (8423 likes, 92% save rate).

## Proportion Rules

| Relationship | Ratio |
|---|---|
| Sofa width : sofa wall width | 60-75% (ideal: 2/3) |
| Coffee table length : sofa length | 50-66% |
| TV cabinet width : TV wall width | 60-75% |
| Pendant light diameter : dining table width | 33-66% |
| Art width : sofa width | 50-75% |
| Furniture floor coverage : total room area | ~60% |

## Spacing Standards (mm)

| Position | Minimum | Comfortable |
|---|---|---|
| Sofa ↔ coffee table | 350 | 400-500 |
| Coffee table ↔ TV cabinet | 600 | 800-1000 |
| Behind sofa passage | 600 | 800 |
| Behind dining chair to wall | 600 | 900 |

## Height Standards (mm)

- Art center from floor: 1450-1525
- Art bottom above sofa back: 150-250
- Dining pendant bottom above table: 700-800
- Floor lamp height: 1400-1800

## Lighting Temperature

- Bedroom / vintage: < 3000K (warm yellow)
- Living room / study: 3000-4000K (neutral white)
- Kitchen / vanity only: > 4000K (cool white)
- All fixtures in same room within 500K of each other

## Material Combinations

### Three-Material Rule
Every room needs at least 3 different texture materials.

### Conflict Detection
- All glossy (leather + marble + steel) = cold and harsh
- All matte fabric with no metal = soft and unanchored (exception: heavy greenery can substitute)
- Honey wood floor + dark walnut furniture = GOOD (intentional dual-tone, verified in cases)
- Light wood floor + rosewood furniture = BAD (wood color clash)

## Hero Furniture Priority (SKU Library)

| Element | Frequency in top cases | Priority |
|---|---|---|
| Cream/beige fabric sofa | 15/21 | P0 |
| Dark walnut TV cabinet | 14/21 | P0 |
| Iconic lamp (PH/mushroom/paper lantern) | 15/21 | P0 |
| Woven/jute rug | 14/21 | P0 |
| Plants + pot | 12/21 | P1 |
| Colorful pillow set | 11/21 | P1 |
| Art print / poster | 10/21 | P1 |

## Key Insight: Large Items Set the Base, Small Items Set the Personality

The same cream sofa becomes:
- + Chinese pillows + tea set = scholarly mix (文人混搭)
- + pure lighting only = minimalist luxury (极简静奢)
- + plush toys = healing (治愈系)
- + greenery + rattan = bohemian (波西米亚)
- + colorful pillows + mushroom lamp = dopamine (多巴胺)

**Recommendation strategy**: Be conservative with large items (neutral, classic). Be bold with small items (personality, surprise).
