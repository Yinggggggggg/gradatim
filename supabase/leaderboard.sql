-- Gradatim 云端：账号（Supabase Auth，邮箱验证码登录，每人一个 7 位数字 UID）和全服排行榜（可以带头像）。
-- 在 Supabase 项目的 SQL Editor 里整段运行一次即可，重复运行也没关系。
--
-- 排行榜只比累计成长天数（有记录的日子一共多少天，只增不减，中断不清零）。
-- 只保存昵称和天数，记录内容不会上传。客户端不能直接读写表，只能调用下面几个函数。

create table if not exists public.growth_board (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  nickname     text not null check (char_length(nickname) between 1 and 16),
  growth_days  integer not null check (growth_days >= 0),
  first_day    date not null,
  last_report  date not null,
  updated_at   timestamptz not null default now()
);

-- 开启行级安全但不建任何策略：客户端无法直接访问这张表
alter table public.growth_board enable row level security;
revoke all on table public.growth_board from anon, authenticated;

-- Gradatim 诞生的日子，没有人能比这更早开始记录
create or replace function public.gradatim_birthday() returns date
language sql immutable as $$ select date '2026-10-24' $$;

-- 上报（或更新）自己的天数，需要登录。不合理的数字会被拒绝：
-- 天数不能超过从第一条记录到今天的天数；两次上报之间，最多每天加一天。
-- 服务器用 UTC 日期，比东亚时区慢几个小时，所以放宽一天。
create or replace function public.submit_growth(
  p_nickname text,
  p_growth_days integer,
  p_first_day date
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_nickname text := btrim(p_nickname);
  v_today date := current_date + 1;
  v_prev public.growth_board%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if v_nickname is null or char_length(v_nickname) not between 1 and 16 then
    raise exception 'invalid nickname';
  end if;
  if p_first_day is null or p_first_day < public.gradatim_birthday() or p_first_day > v_today then
    raise exception 'invalid first day';
  end if;
  if p_growth_days is null or p_growth_days < 0 or p_growth_days > (v_today - p_first_day) + 1 then
    raise exception 'invalid growth days';
  end if;

  select * into v_prev from public.growth_board where user_id = v_user;
  if found and p_growth_days > v_prev.growth_days + (v_today - v_prev.last_report) then
    raise exception 'growth too fast';
  end if;

  insert into public.growth_board (user_id, nickname, growth_days, first_day, last_report, updated_at)
  values (v_user, v_nickname, p_growth_days, p_first_day, current_date, now())
  on conflict (user_id) do update
    set nickname = excluded.nickname,
        growth_days = excluded.growth_days,
        first_day = excluded.first_day,
        last_report = excluded.last_report,
        updated_at = excluded.updated_at;
end;
$$;

-- 退出排行榜：删掉自己的那一行（账号保留）
create or replace function public.leave_growth_board() returns void
language sql security definer set search_path = public as $$
  delete from public.growth_board where user_id = auth.uid();
$$;

-- 删除自己的账号；排行榜上的那一行会跟着删掉
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- 每个账号一个随机的 7 位数字 UID：第一次用到时分配，之后不再变。删除账号时跟着删掉。
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  uid         integer not null unique check (uid between 1000000 and 9999999),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from anon, authenticated;

-- 自己的 UID，需要登录。还没有就随机抽一个号码；号码已被别人占用就重抽。
create or replace function public.my_uid() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_uid integer;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  for attempt in 1..20 loop
    select uid into v_uid from public.profiles where user_id = v_user;
    if found then
      return v_uid;
    end if;
    begin
      insert into public.profiles (user_id, uid)
      values (v_user, 1000000 + floor(random() * 9000000)::integer)
      returning uid into v_uid;
      return v_uid;
    exception when unique_violation then
      -- 号码撞上了别人的，或者同一个账号的另一个请求刚好抢先分配了：回到开头再查一次
      null;
    end;
  end loop;
  raise exception 'could not assign uid';
end;
$$;

-- 头像只给排行榜用：加入排行榜的人才会上传，退出排行榜或删除账号时删掉。
-- 图片放在公开的 avatars 存储桶里，路径是“账号 id/时间戳.jpg”，换头像就换一个新文件，不会被缓存住旧图。
alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 只能往自己账号 id 命名的文件夹里传和删（删除时存储服务还要能读到这个文件）
drop policy if exists "avatars: upload own" on storage.objects;
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "avatars: read own" on storage.objects;
create policy "avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "avatars: delete own" on storage.objects;
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- 登记新头像（传 null 就是去掉头像）。返回旧头像的路径，由客户端把旧文件删掉。
create or replace function public.set_my_avatar(p_path text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_old text;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_path is not null and p_path !~ ('^' || v_user::text || '/[0-9]{1,20}\.jpg$') then
    raise exception 'invalid avatar path';
  end if;
  perform public.my_uid();
  select avatar_path into v_old from public.profiles where user_id = v_user;
  update public.profiles set avatar_path = p_path where user_id = v_user;
  return v_old;
end;
$$;

-- 排行榜：前 p_limit 名，加上排在自己前后各两名的人。天数相同的并列。不登录也能看。
-- 返回的列变过（加了头像），create or replace 改不了返回类型，所以先删再建。
drop function if exists public.growth_leaderboard(integer);
create function public.growth_leaderboard(p_limit integer default 20)
returns table (rank bigint, nickname text, growth_days integer, is_me boolean, total bigint, avatar_path text)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select rank() over (order by b.growth_days desc) as rank,
           count(*) over () as total,
           b.user_id, b.nickname, b.growth_days, b.updated_at
    from public.growth_board b
  ),
  me as (
    select r.rank from ranked r where r.user_id = auth.uid()
  )
  select r.rank, r.nickname, r.growth_days, coalesce(r.user_id = auth.uid(), false) as is_me, r.total, p.avatar_path
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  where r.rank <= least(greatest(p_limit, 1), 100)
     or abs(r.rank - coalesce((select me.rank from me), -100)) <= 2
  order by r.rank, r.updated_at;
$$;

-- Supabase 默认会把新函数的执行权限直接授给 anon，所以只收回 public 不够，要连 anon 一起收回
revoke all on function public.my_uid() from public, anon;
revoke all on function public.set_my_avatar(text) from public, anon;
revoke all on function public.submit_growth(text, integer, date) from public, anon;
revoke all on function public.leave_growth_board() from public, anon;
revoke all on function public.growth_leaderboard(integer) from public;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.my_uid() to authenticated;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.submit_growth(text, integer, date) to authenticated;
grant execute on function public.leave_growth_board() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.growth_leaderboard(integer) to anon, authenticated;
