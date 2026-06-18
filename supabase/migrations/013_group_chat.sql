-- Group chat messages
create table group_messages (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null check (char_length(content) > 0 and char_length(content) <= 500),
  created_at timestamptz default now() not null
);

create index group_messages_group_id_created_at_idx on group_messages (group_id, created_at desc);

alter table group_messages enable row level security;

create policy "Group members can read messages"
  on group_messages for select
  using (
    exists (
      select 1 from group_members
      where group_members.group_id = group_messages.group_id
        and group_members.user_id = auth.uid()
    )
  );

create policy "Group members can insert messages"
  on group_messages for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from group_members
      where group_members.group_id = group_messages.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Enable Realtime for this table
alter publication supabase_realtime add table group_messages;
