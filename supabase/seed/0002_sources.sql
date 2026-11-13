-- Sources the scanner checks. Run after 0001_areas.sql.
insert into sources (name, kind, url, area_code, is_official) values
  ('GMA News – Walang Pasok', 'gma',
   'https://data.gmanetwork.com/gno/widgets/grid_reverse_listing/keyword_walang_pasok/15.gz',
   null, false),
  ('City of San Fernando – Website', 'rss',
   'https://cityofsanfernando.gov.ph/feed/',
   '035416000', true)
on conflict (url) do nothing;
