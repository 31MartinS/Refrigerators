create extension if not exists pgcrypto;
create type public.campaign_status as enum ('draft','active','paused','finished');
create type public.participation_status as enum ('registered','drawing','awarded','void');
create table public.campaigns(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,status campaign_status not null default 'draft',starts_at timestamptz,ends_at timestamptz,content jsonb not null default '{}',visual_config jsonb not null default '{}',duplicate_fields text[] not null default array['identification','email'],created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.participants(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references campaigns on delete cascade,full_name text not null,identification_hash text not null,email_hash text not null,phone_hash text not null,email text not null,phone text not null,consent_terms_at timestamptz not null,consent_privacy_at timestamptz not null,created_at timestamptz not null default now());
create unique index participants_campaign_identification on participants(campaign_id,identification_hash);
create unique index participants_campaign_email on participants(campaign_id,email_hash);
create table public.refrigerators(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references campaigns on delete cascade,public_key text not null,label text not null,asset_config jsonb not null default '{}',sort_order int not null default 0,active boolean not null default true,unique(campaign_id,public_key));
create table public.prizes(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references campaigns on delete cascade,name text not null,description text not null default '',claim_instructions text not null default '',image_url text,weight numeric(12,4) not null check(weight>=0),initial_stock int check(initial_stock is null or initial_stock>=0),remaining_stock int check(remaining_stock is null or remaining_stock>=0),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((initial_stock is null and remaining_stock is null) or (initial_stock is not null and remaining_stock<=initial_stock)));
create table public.participations(id uuid primary key default gen_random_uuid(),campaign_id uuid not null references campaigns,participant_id uuid not null unique references participants,refrigerator_id uuid references refrigerators,status participation_status not null default 'registered',prize_id uuid references prizes,weight_snapshot numeric(12,4),draw_config_snapshot jsonb,awarded_at timestamptz,created_at timestamptz not null default now());
create index participations_campaign_created on participations(campaign_id,created_at desc);
create table public.admin_action_logs(id bigint generated always as identity primary key,admin_id uuid not null references auth.users,campaign_id uuid references campaigns,action text not null,entity_type text not null,entity_id text,old_values jsonb,new_values jsonb,created_at timestamptz not null default now());

alter table campaigns enable row level security; alter table participants enable row level security; alter table refrigerators enable row level security; alter table prizes enable row level security; alter table participations enable row level security; alter table admin_action_logs enable row level security;
create policy "public active campaign" on campaigns for select using(status='active' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()));
create policy "public refrigerators" on refrigerators for select using(active and exists(select 1 from campaigns c where c.id=campaign_id and c.status='active'));
create policy "authenticated manage campaigns" on campaigns for all to authenticated using(true) with check(true);
create policy "authenticated manage refrigerators" on refrigerators for all to authenticated using(true) with check(true);
create policy "authenticated manage prizes" on prizes for all to authenticated using(true) with check(true);
create policy "authenticated read participants" on participants for select to authenticated using(true);
create policy "authenticated read participations" on participations for select to authenticated using(true);
create policy "authenticated read logs" on admin_action_logs for select to authenticated using(true);

-- SECURITY DEFINER is intentionally the only public draw path. It is idempotent and row-locks inventory.
create or replace function public.draw_prize_atomic(p_participant uuid,p_refrigerator_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_part participations%rowtype; v_fridge refrigerators%rowtype; v_prize prizes%rowtype; v_total numeric; v_roll numeric; v_random bytea;
begin
 select * into v_part from participations where participant_id=p_participant for update;
 if not found then raise exception 'PARTICIPATION_NOT_FOUND'; end if;
 if v_part.status='awarded' then return (select jsonb_build_object('participationId',v_part.id,'refrigeratorId',r.public_key,'prize',to_jsonb(p),'awardedAt',v_part.awarded_at) from prizes p join refrigerators r on r.id=v_part.refrigerator_id where p.id=v_part.prize_id); end if;
 select * into v_fridge from refrigerators where campaign_id=v_part.campaign_id and public_key=p_refrigerator_key and active;
 if not found then raise exception 'INVALID_REFRIGERATOR'; end if;
 select sum(weight) into v_total from prizes where campaign_id=v_part.campaign_id and active and weight>0 and (remaining_stock is null or remaining_stock>0);
 if coalesce(v_total,0)<=0 then raise exception 'NO_PRIZES_AVAILABLE'; end if;
 v_random=gen_random_bytes(4); v_roll=((get_byte(v_random,0)::numeric*16777216+get_byte(v_random,1)*65536+get_byte(v_random,2)*256+get_byte(v_random,3))/4294967296)*v_total;
 select * into v_prize from prizes where campaign_id=v_part.campaign_id and active and weight>0 and (remaining_stock is null or remaining_stock>0) order by id for update;
 select p.* into v_prize from prizes p where p.campaign_id=v_part.campaign_id and p.active and p.weight>0 and (p.remaining_stock is null or p.remaining_stock>0) and (select coalesce(sum(x.weight),0) from prizes x where x.campaign_id=p.campaign_id and x.active and x.weight>0 and (x.remaining_stock is null or x.remaining_stock>0) and x.id<=p.id)>=v_roll order by p.id limit 1 for update;
 if v_prize.remaining_stock is not null then update prizes set remaining_stock=remaining_stock-1,updated_at=now() where id=v_prize.id and remaining_stock>0; if not found then raise exception 'STOCK_CONFLICT'; end if; end if;
 update participations set refrigerator_id=v_fridge.id,prize_id=v_prize.id,status='awarded',weight_snapshot=v_prize.weight,draw_config_snapshot=jsonb_build_object('eligibleTotalWeight',v_total,'selectedWeight',v_prize.weight),awarded_at=now() where id=v_part.id returning * into v_part;
 return jsonb_build_object('participationId',v_part.id,'refrigeratorId',v_fridge.public_key,'prize',to_jsonb(v_prize),'awardedAt',v_part.awarded_at);
end$$;
revoke all on function public.draw_prize_atomic(uuid,text) from public,anon,authenticated;
