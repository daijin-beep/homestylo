# Phase 3 Migration Notes

本文件用于确认 Phase 3 效果图管线所需的数据表字段与存储配置。

## 1) `effect_images` 表字段要求

Phase 3 依赖以下字段（若你的库中缺失，请执行后续 SQL）：

- `scheme_id UUID NOT NULL`
- `image_url TEXT NOT NULL`
- `hotspot_map JSONB`
- `generation_params JSONB`
- `generation_status TEXT NOT NULL`
- `error_message TEXT`
- `version INTEGER NOT NULL DEFAULT 1`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

推荐状态枚举至少包含：

- `pending`
- `depth`
- `flux`
- `hotspot`
- `done`
- `failed`

## 2) 补充字段 SQL（增量迁移）

```sql
alter table public.effect_images
  add column if not exists hotspot_map jsonb,
  add column if not exists generation_params jsonb,
  add column if not exists generation_status text default 'pending',
  add column if not exists error_message text,
  add column if not exists version integer default 1;

alter table public.effect_images
  alter column generation_status set default 'pending';

-- 可选：确保只允许 Phase 3 支持的状态
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'effect_images_generation_status_check'
  ) then
    alter table public.effect_images
      add constraint effect_images_generation_status_check
      check (generation_status in ('pending', 'depth', 'flux', 'hotspot', 'done', 'failed'));
  end if;
end $$;
```

## 3) R2 Bucket CORS 配置建议

为了保证前端可加载效果图 URL，请在 R2 bucket 上启用 CORS：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

生产环境建议把 `AllowedOrigins` 从 `*` 收敛到你的站点域名列表。

## 4) 路径规范建议

- 深度图：`depth-maps/{schemeId}/{timestamp}.png`
- 效果图：`effect-images/{schemeId}/{timestamp}_v{version}.png`

确保服务端有写入这两个路径前缀的权限。

