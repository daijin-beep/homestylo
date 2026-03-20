begin;

insert into public.styles (
  id,
  name,
  description,
  cover_image_url
)
values (
  'dopamine',
  '多巴胺 / 孟菲斯',
  '高饱和、几何造型、活力撞色',
  '/images/styles/dopamine-cover.webp'
)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  cover_image_url = excluded.cover_image_url;

delete from public.products
where name in (
  'BOBA沙发 B款 - 枫叶棕灯芯绒',
  '孟菲斯多巴胺餐桌椅套装 - DOP ZONE',
  '粉色星球吊灯 - 35cm球形',
  '猫与金鱼缸装饰画 - 野兽派风格',
  'MOFAS蘑菇台灯 - 橘黄玻璃',
  'HAY酒红色玻璃花瓶 - 北欧设计'
);

insert into public.products (
  id,
  name,
  brand,
  price,
  price_min,
  price_max,
  category,
  style,
  image_url,
  source_url,
  width_mm,
  depth_mm,
  height_mm,
  dimensions,
  description,
  is_hero
)
values
  (
    gen_random_uuid(),
    'BOBA沙发 B款 - 枫叶棕灯芯绒',
    'BOBA',
    3980,
    3980,
    3980,
    'sofa',
    'dopamine',
    '/images/products/boba-sofa-b.webp',
    null,
    2620,
    980,
    820,
    '2.62m，约 2620×980×820mm',
    '多巴胺风格核心大件，枫叶棕灯芯绒材质，适合作为客厅视觉锚点。',
    true
  ),
  (
    gen_random_uuid(),
    '孟菲斯多巴胺餐桌椅套装 - DOP ZONE',
    'DOP ZONE',
    2680,
    2680,
    2680,
    'dining_set',
    'dopamine',
    '/images/products/dopzone-dining-set.webp',
    null,
    900,
    900,
    750,
    '红色圆桌 + 黄腿饼干椅，桌面直径约 900mm',
    '典型孟菲斯几何配色组合，适合营造高饱和活力餐区。',
    true
  ),
  (
    gen_random_uuid(),
    '粉色星球吊灯 - 35cm球形',
    null,
    388,
    388,
    388,
    'lighting',
    'dopamine',
    '/images/products/pink-planet-pendant.webp',
    null,
    350,
    350,
    260,
    '直径 350mm 球形吊灯',
    '高显眼度粉色点缀，适合客餐厅中心位打造氛围照明。',
    false
  ),
  (
    gen_random_uuid(),
    '猫与金鱼缸装饰画 - 野兽派风格',
    null,
    168,
    168,
    168,
    'art',
    'dopamine',
    '/images/products/cat-goldfish-art.webp',
    null,
    600,
    20,
    800,
    '约 600×800mm',
    '野兽派色彩组合装饰画，适合作为沙发背景墙视觉焦点。',
    false
  ),
  (
    gen_random_uuid(),
    'MOFAS蘑菇台灯 - 橘黄玻璃',
    'MOFAS',
    258,
    258,
    258,
    'lamp',
    'dopamine',
    '/images/products/mofas-mushroom-lamp.webp',
    null,
    220,
    220,
    320,
    '约 220×220×320mm',
    '橘黄玻璃小体量灯具，适合边几或餐边柜补充暖色层次。',
    false
  ),
  (
    gen_random_uuid(),
    'HAY酒红色玻璃花瓶 - 北欧设计',
    'HAY',
    320,
    320,
    320,
    'decor',
    'dopamine',
    '/images/products/hay-burgundy-vase.webp',
    null,
    150,
    150,
    280,
    '约 150×150×280mm',
    '酒红玻璃材质作为桌面装饰，补充多巴胺风格的色彩层级。',
    false
  );

commit;
