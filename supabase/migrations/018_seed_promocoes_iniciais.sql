update produtos set preco_avista = 500.00, preco_segundo_barril = 385.00
  where marca = 'Vila Império' and volume_litros = 50;

update produtos set preco_avista = 550.00, preco_segundo_barril = 400.00
  where marca = 'Chopp do Marquês' and volume_litros = 50;

update produtos set preco_avista = 550.00, preco_segundo_barril = 400.00
  where marca = 'Donzela' and volume_litros = 50;

update produtos set preco_avista = 550.00, preco_segundo_barril = 470.00
  where marca = 'Belco' and volume_litros = 50;

update produtos set preco_avista = 780.00, preco_segundo_barril = 650.00
  where marca = 'Amstel' and volume_litros = 50;

update produtos set preco_avista = 880.00, preco_segundo_barril = 730.00
  where marca = 'Brahma' and volume_litros = 50;

update produtos set preco_avista = 950.00, preco_segundo_barril = 750.00
  where marca = 'Heineken' and volume_litros = 50;

update produtos set preco_avista = 430.00, preco_segundo_barril = null
  where marca = 'Vila Império' and volume_litros = 30;

update produtos set preco_segundo_barril = null
  where marca = 'Vila Império Vinho';
