-- Sansita's Puzzles — birthday finale Storage bucket.
--
-- A private bucket for the finale's optional photos/video. Files live under
-- <recipient-user-id>/<filename> so the policy below can scope reads to their own folder cheaply
-- (split_part instead of storage.foldername(), which needs no extra shim to test in PGlite).
-- Readable only once that recipient's own message has actually unlocked — mirrors
-- "recipient reads unlocked messages" in 0001_init.sql exactly, so a photo is never reachable
-- (even by a guessed/leaked URL) before the message itself would be.
insert into storage.buckets (id, name, public)
values ('finale', 'finale', false)
on conflict (id) do nothing;

create policy "recipient reads own unlocked finale files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'finale'
    and split_part(name, '/', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.messages m
      where m.recipient = (select auth.uid())
        and m.unlock_date <= public.puzzle_today()
        and m.required_games <= (
          select count(distinct p.game_id) from public.plays p
          where p.user_id = (select auth.uid()) and p.puzzle_date = m.unlock_date and p.status <> 'in_progress'
        )
    )
  );
