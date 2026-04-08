# TeeLab AI — 数据模型

## 实体关系总览

```
users
  ├── group_members ──→ groups
  ├── group_join_requests ──→ groups
  ├── tee_times (creator)
  ├── tee_time_players ──→ tee_times
  ├── scores (scorer / player)
  └── notifications

groups
  ├── group_members
  ├── group_join_requests
  └── tee_times

courses (公共库)
  ├── course_holes
  ├── course_tees
  └── tee_times

tee_times
  ├── tee_time_players
  └── rounds
       └── scores
```

---

## 表结构

### 1. users — 用户

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | Supabase Auth user id |
| display_name | text | 显示名称 |
| avatar_url | text | 头像 |
| subscription_tier | text | 'free' / 'pro' |
| subscription_expires_at | timestamptz | Pro 到期时间 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. groups — 群组

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| code | int UNIQUE | 短数字编号（搜索/分享用）|
| name | text NOT NULL | 群名称 |
| announcement | text | 群公告 |
| owner_id | uuid FK → users | 群主 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 3. group_members — 群成员

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| user_id | uuid FK → users | |
| role | text | 'owner' / 'admin' / 'member' |
| joined_at | timestamptz | |

约束：UNIQUE(group_id, user_id)

### 4. group_join_requests — 入群申请

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| group_id | uuid FK → groups | |
| user_id | uuid FK → users | 申请人 |
| status | text | 'pending' / 'approved' / 'rejected' |
| reviewed_by | uuid FK → users | 审批人 |
| created_at | timestamptz | 申请时间 |
| reviewed_at | timestamptz | 审批时间 |

### 5. courses — 球场（公共库）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| name | text NOT NULL | 球场名称 |
| address | text | 地址 |
| hole_count | int NOT NULL | 9 / 18 |
| status | text | 'pending' / 'approved' |
| created_by | uuid FK → users | 创建者 |
| reviewed_by | uuid FK → users | 平台审核人 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 6. course_holes — 球场每洞标准杆

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| course_id | uuid FK → courses ON DELETE CASCADE | |
| hole_number | int NOT NULL | 1-18 |
| par | int NOT NULL DEFAULT 4 | 3 / 4 / 5 |

约束：UNIQUE(course_id, hole_number)，CHECK(hole_number >= 1 AND hole_number <= 18)，CHECK(par >= 3 AND par <= 5)

### 7. course_tees — 球场 Tee 标签

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| course_id | uuid FK → courses ON DELETE CASCADE | |
| name | text NOT NULL | 'Blue' / 'White' / 'Red' / 'Gold' 等 |
| color | text | 颜色代码（可选，UI 展示用）|
| sort_order | int DEFAULT 0 | 排序 |

约束：UNIQUE(course_id, name)

### 8. tee_times — 球局

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| group_id | uuid FK → groups | 所属群 |
| course_id | uuid FK → courses | 球场 |
| course_tee_id | uuid FK → course_tees | 使用的 Tee |
| created_by | uuid FK → users | 发布者 |
| tee_off_at | timestamptz NOT NULL | 开球时间 |
| starting_hole | int NOT NULL DEFAULT 1 | 开球洞号（1 或 10）|
| max_players | int NOT NULL | 人数上限 |
| price | decimal | 费用（仅展示）|
| currency | text DEFAULT 'USD' | 货币 |
| notes | text | 备注 |
| status | text DEFAULT 'upcoming' | 'upcoming' / 'in_progress' / 'completed' / 'cancelled' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 9. tee_time_players — 球局报名

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| tee_time_id | uuid FK → tee_times ON DELETE CASCADE | |
| user_id | uuid FK → users | |
| status | text NOT NULL | 'confirmed' / 'waitlisted' / 'withdrawn' |
| signed_up_at | timestamptz NOT NULL | 报名时间（候补排序依据）|

约束：UNIQUE(tee_time_id, user_id)

### 10. rounds — 比赛轮次

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| tee_time_id | uuid FK → tee_times ON DELETE CASCADE | |
| format | text NOT NULL DEFAULT 'stroke' | 'stroke' / 'match' / '2v2' |
| status | text DEFAULT 'in_progress' | 'in_progress' / 'completed' |
| started_at | timestamptz | |
| completed_at | timestamptz | |

### 11. scores — 逐洞记分

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| round_id | uuid FK → rounds ON DELETE CASCADE | |
| player_id | uuid FK → users | 被记分的球员 |
| hole_number | int NOT NULL | 洞号 1-18 |
| strokes | int NOT NULL | 实际杆数 |
| scored_by | uuid FK → users | 记分人（可替他人记分）|
| created_at | timestamptz | |
| updated_at | timestamptz | |

约束：UNIQUE(round_id, player_id, hole_number)，CHECK(strokes > 0)

### 12. notifications — 站内通知

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK → users | 接收人 |
| type | text NOT NULL | 通知类型 |
| title | text NOT NULL | 通知标题 |
| body | text | 通知内容 |
| data | jsonb | 关联数据（group_id, tee_time_id 等，跳转用）|
| is_read | boolean DEFAULT false | |
| created_at | timestamptz | |

通知类型：
- `join_request` — 有人申请加入群
- `join_approved` — 申请被批准
- `join_rejected` — 申请被拒绝
- `tee_time_created` — 新球局发布
- `tee_time_signup` — 有人报名你发布的球局
- `tee_time_withdrawal` — 有人退出你发布的球局
- `waitlist_promoted` — 候补递补成功
- `tee_time_reminder` — 球局即将开始
- `score_updated` — 有人更新了记分

---

## 建表 SQL

```sql
-- ============================================================
-- TeeLab AI Database Schema
-- Supabase (PostgreSQL)
-- ============================================================

-- 1. users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code int unique not null,
  name text not null,
  announcement text,
  owner_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. group_members
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

-- 4. group_join_requests
create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- 5. courses
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  hole_count int not null check (hole_count in (9, 18)),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_by uuid not null references public.users(id),
  reviewed_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. course_holes
create table public.course_holes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  hole_number int not null check (hole_number >= 1 and hole_number <= 18),
  par int not null default 4 check (par >= 3 and par <= 5),
  unique (course_id, hole_number)
);

-- 7. course_tees
create table public.course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  unique (course_id, name)
);

-- 8. tee_times
create table public.tee_times (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  course_tee_id uuid references public.course_tees(id),
  created_by uuid not null references public.users(id),
  tee_off_at timestamptz not null,
  starting_hole int not null default 1 check (starting_hole in (1, 10)),
  max_players int not null check (max_players > 0),
  price decimal,
  currency text default 'USD',
  notes text,
  status text not null default 'upcoming' check (status in ('upcoming', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. tee_time_players
create table public.tee_time_players (
  id uuid primary key default gen_random_uuid(),
  tee_time_id uuid not null references public.tee_times(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed', 'waitlisted', 'withdrawn')),
  signed_up_at timestamptz not null default now(),
  unique (tee_time_id, user_id)
);

-- 10. rounds
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  tee_time_id uuid not null references public.tee_times(id) on delete cascade,
  format text not null default 'stroke' check (format in ('stroke', 'match', '2v2')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at timestamptz default now(),
  completed_at timestamptz
);

-- 11. scores
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.users(id),
  hole_number int not null check (hole_number >= 1 and hole_number <= 18),
  strokes int not null check (strokes > 0),
  scored_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, player_id, hole_number)
);

-- 12. notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 索引
-- ============================================================

create index idx_groups_code on public.groups(code);
create index idx_group_members_user on public.group_members(user_id);
create index idx_group_join_requests_group_status on public.group_join_requests(group_id, status);
create index idx_courses_status on public.courses(status);
create index idx_tee_times_group_date on public.tee_times(group_id, tee_off_at);
create index idx_tee_times_status on public.tee_times(status);
create index idx_tee_time_players_tee_time_status on public.tee_time_players(tee_time_id, status);
create index idx_tee_time_players_user on public.tee_time_players(user_id, status);
create index idx_scores_round_player on public.scores(round_id, player_id);
create index idx_notifications_user_unread on public.notifications(user_id, is_read, created_at desc);

-- ============================================================
-- updated_at 自动更新触发器
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.users
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.groups
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.courses
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.tee_times
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.scores
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Supabase Realtime
-- ============================================================
-- 启用以下表的 Realtime 订阅：
-- alter publication supabase_realtime add table public.scores;
-- alter publication supabase_realtime add table public.tee_time_players;
-- alter publication supabase_realtime add table public.notifications;
```

---

## 关键索引说明

| 索引 | 服务场景 |
|------|----------|
| `groups.code` | 按数字编号搜索群 |
| `tee_times(group_id, tee_off_at)` | 群内日历/列表视图 |
| `tee_time_players(tee_time_id, status)` | 球局报名/候补列表 |
| `tee_time_players(user_id, status)` | "我的球局"筛选 |
| `scores(round_id, player_id)` | 记分板查询 |
| `notifications(user_id, is_read, created_at)` | 消息中心 + 未读角标 |
| `courses(status)` | 已审核球场列表 |

---

## Supabase Realtime 订阅

| 表 | 用途 |
|----|------|
| `scores` | 围观实时记分板 |
| `tee_time_players` | 实时报名状态更新 |
| `notifications` | 站内通知实时推送 |
