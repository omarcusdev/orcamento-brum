alter table produtos add column ordem int not null default 0;

with ordered as (
  select id,
    row_number() over (partition by volume_litros order by created_at) * 10 as new_ordem
  from produtos
)
update produtos p set ordem = o.new_ordem
from ordered o
where p.id = o.id;

create index produtos_display_idx on produtos (volume_litros desc, ordem asc, created_at);
