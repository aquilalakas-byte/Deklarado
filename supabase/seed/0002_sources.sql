-- Sources the scanner checks. Run after 0001_areas.sql.
-- Keep the website list in sync with scanner/sources/registry.ts.
insert into sources (name, kind, url, area_code, is_official) values
  ('GMA News – Walang Pasok', 'gma',
   'https://data.gmanetwork.com/gno/widgets/grid_reverse_listing/keyword_walang_pasok/15.gz',
   null, false),
  ('PAGASA – Tropical Cyclone Bulletins', 'pagasa',
   'https://pubfiles.pagasa.dost.gov.ph/tamss/weather/bulletin/', null, true),
  ('City of San Fernando – Website', 'rss', 'https://cityofsanfernando.gov.ph/feed/', '035416000', true),
  ('Angeles City – Website', 'rss', 'https://www.angelescity.gov.ph/feed/', '035401000', true),
  ('Guagua – Website', 'rss', 'https://guagua.gov.ph/feed/', '035407000', true),
  ('Lubao – Website', 'rss', 'https://lubao.gov.ph/feed/', '035408000', true),
  ('DepEd – Website', 'deped', 'https://www.deped.gov.ph/feed/', '000000000', true)
on conflict (url) do nothing;
