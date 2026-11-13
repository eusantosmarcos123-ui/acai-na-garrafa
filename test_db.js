const db = require('./db.js');

db.all('SELECT id, nome, categoria, preco_500ml FROM produtos', (err, rows) => {
  if (err) {
    console.error('Erro:', err);
    process.exit(1);
  }
  console.log('--- TESTE SQLITE BEM-SUCEDIDO ---');
  console.log('Total de produtos encontrados:', rows.length);
  console.table(rows);
  process.exit(0);
});
