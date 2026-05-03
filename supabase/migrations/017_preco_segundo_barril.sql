alter table produtos
  add column preco_segundo_barril numeric(10,2);

alter table produtos
  add constraint produtos_preco_segundo_barril_positive
  check (preco_segundo_barril is null or preco_segundo_barril > 0);
