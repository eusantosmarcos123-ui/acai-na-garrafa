const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao SQLite:', err.message);
  } else {
    console.log('Conectado com sucesso ao SQLite em:', dbPath);
  }
});

// Inicialização das Tabelas
db.serialize(() => {
  // 1. Tabela de Categorias e Produtos (Blends)
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      categoria TEXT NOT NULL,
      descricao TEXT,
      destaque TEXT,
      badge TEXT,
      kcal INTEGER,
      proteinas REAL,
      carbos REAL,
      preco_300ml REAL NOT NULL,
      preco_500ml REAL NOT NULL,
      preco_1000ml REAL NOT NULL,
      estoque INTEGER DEFAULT 100,
      ativo INTEGER DEFAULT 1
    )
  `);

  // 2. Tabela de Clientes
  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      whatsapp TEXT,
      endereco TEXT,
      bairro TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Tabela de Pedidos
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER,
      nome_cliente TEXT NOT NULL,
      endereco_entrega TEXT NOT NULL,
      forma_pagamento TEXT NOT NULL,
      metodo_envio TEXT DEFAULT 'Entrega Térmica Expressa',
      tamanho_pack INTEGER NOT NULL,
      capacidade_garrafa TEXT DEFAULT '500ml',
      subtotal REAL NOT NULL,
      desconto REAL NOT NULL,
      taxa_frete REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'recebido',
      payload_whatsapp TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )
  `);

  // 4. Tabela de Itens do Pedido
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      produto_nome TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      preco_unitario REAL NOT NULL,
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
    )
  `);

  // 5. Tabela de Leads B2B / Revenda
  db.run(`
    CREATE TABLE IF NOT EXISTS leads_b2b (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_responsavel TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      nome_empresa TEXT,
      cnpj TEXT,
      tipo_negocio TEXT,
      estimativa_semanal TEXT,
      status TEXT DEFAULT 'novo_contato',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Tabela de Pontos de Retirada (Click & Collect)
  db.run(`
    CREATE TABLE IF NOT EXISTS pontos_retirada (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_local TEXT NOT NULL,
      endereco TEXT NOT NULL,
      bairro TEXT NOT NULL,
      cidade TEXT DEFAULT 'Salvador',
      distancia_aprox TEXT,
      horario TEXT,
      ativo INTEGER DEFAULT 1
    )
  `);

  // Seeding de Produtos caso esteja vazio
  db.get(`SELECT COUNT(*) as total FROM produtos`, (err, row) => {
    if (err) return console.error(err);
    if (row.total === 0) {
      console.log('Populando dados iniciais no SQLite...');

      const stmt = db.prepare(`
        INSERT INTO produtos (nome, slug, categoria, descricao, destaque, badge, kcal, proteinas, carbos, preco_300ml, preco_500ml, preco_1000ml)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'Tradicional Cremoso',
        'tradicional-cremoso',
        'casual',
        'Polpa especial batida com banana prata e toque suave de guaraná natural da Amazônia.',
        'Mais Pedido',
        'Energia Pura',
        185, 3.2, 32,
        14.00, 18.00, 32.00
      );

      stmt.run(
        'High Protein Turbo',
        'high-protein-turbo',
        'treino',
        'Blend potente com Whey Protein Isolado 100% puro e pasta de amendoim integral crocante.',
        '25g Proteína',
        'Performance',
        280, 25.4, 26,
        18.00, 24.00, 42.00
      );

      stmt.run(
        'Zero Açúcar / Clean Label',
        'zero-acucar-clean',
        'zero',
        'Polpa especial tipo grosso, batida apenas com água de coco natural. Adoçado com stevia pura.',
        'Zero Açúcar',
        'Clean Label',
        115, 2.4, 6.8,
        16.00, 20.00, 36.00
      );

      stmt.run(
        'Red Berries Fresh',
        'red-berries-fresh',
        'casual',
        'Açaí artesanal infusionado com morangos frescos e amoras silvestres. Refrescância pura.',
        'Antioxidante',
        'Frutas Frescas',
        160, 2.8, 28,
        15.00, 19.00, 34.00
      );

      stmt.finalize();

      // Seed Pontos de Retirada
      const pStmt = db.prepare(`
        INSERT INTO pontos_retirada (nome_local, endereco, bairro, distancia_aprox, horario)
        VALUES (?, ?, ?, ?, ?)
      `);
      pStmt.run('Academia SmartFit Pituba', 'Av. Paulo VI, 1500', 'Pituba', '1.2 km', '06h às 22h');
      pStmt.run('Box CrossFit Barra', 'Av. Oceânica, 450', 'Barra', '3.5 km', '06h às 21h');
      pStmt.finalize();

      console.log('Dados iniciais inseridos com sucesso no SQLite!');
    }
  });
});

module.exports = db;
