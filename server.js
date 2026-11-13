const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Listar Produtos (Blends) com filtro opcional por categoria
app.get('/api/produtos', (req, res) => {
  const { categoria } = req.query;
  let sql = 'SELECT * FROM produtos WHERE ativo = 1';
  const params = [];

  if (categoria && categoria !== 'all') {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao consultar produtos', details: err.message });
    }
    res.json({ produtos: rows });
  });
});

// 2. Pontos de Retirada (Click & Collect)
app.get('/api/pontos-retirada', (req, res) => {
  db.all('SELECT * FROM pontos_retirada WHERE ativo = 1', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao consultar pontos de retirada', details: err.message });
    }
    res.json({ pontos: rows });
  });
});

// 3. Simulação de Frete Inteligente
app.post('/api/frete/simular', (req, res) => {
  const { cep, packSize } = req.body;
  
  let freteBase = 5.00;
  let prazo = '40 a 60 minutos (Bolsa térmica selada)';

  // Regra de negócio do documento:
  // Pack 12 ou mais = Frete Térmico Grátis
  if (packSize >= 12) {
    freteBase = 0.00;
    prazo = 'Entrega Térmica com Frete Grátis garantido!';
  } else if (packSize >= 6) {
    // 50% de desconto no frete
    freteBase = 3.00;
    prazo = 'Entrega Expressa com taxa reduzida (Kit Semanal)';
  }

  res.json({
    cep: cep || 'Região Metropolitana',
    entregaExpressa: {
      valor: freteBase,
      prazo: prazo,
      embalagem: 'Isotérmica com gelo reutilizável'
    },
    clickAndCollect: {
      valor: 0.00,
      pontoPrincipal: 'Academia SmartFit Pituba (Disponível no freezer parceiro)'
    }
  });
});

// 4. Salvar Novo Pedido no SQLite
app.post('/api/pedidos', (req, res) => {
  const {
    nome,
    whatsapp,
    endereco,
    bairro,
    formaPagamento,
    metodoEnvio,
    tamanhoPack,
    capacidadeGarrafa,
    subtotal,
    desconto,
    taxaFrete,
    total,
    itens,
    payloadWhatsapp
  } = req.body;

  if (!nome || !endereco || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Dados incompletos para registrar o pedido.' });
  }

  db.serialize(() => {
    // Registrar ou atualizar cliente
    db.run(
      `INSERT INTO clientes (nome, whatsapp, endereco, bairro) VALUES (?, ?, ?, ?)`,
      [nome, whatsapp || '', endereco, bairro || ''],
      function (err) {
        const clienteId = this ? this.lastID : null;

        // Inserir Pedido
        const stmtPedido = db.prepare(`
          INSERT INTO pedidos (
            cliente_id, nome_cliente, endereco_entrega, forma_pagamento, metodo_envio,
            tamanho_pack, capacidade_garrafa, subtotal, desconto, taxa_frete, total,
            status, payload_whatsapp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recebido', ?)
        `);

        stmtPedido.run(
          clienteId,
          nome,
          endereco,
          formaPagamento,
          metodoEnvio || 'Entrega Térmica Expressa',
          tamanhoPack,
          capacidadeGarrafa || '500ml',
          subtotal,
          desconto,
          taxaFrete,
          total,
          payloadWhatsapp,
          function (errPedido) {
            if (errPedido) {
              return res.status(500).json({ error: 'Erro ao salvar pedido', details: errPedido.message });
            }

            const pedidoId = this.lastID;

            // Inserir Itens do Pedido
            const stmtItem = db.prepare(`
              INSERT INTO itens_pedido (pedido_id, produto_nome, quantidade, preco_unitario)
              VALUES (?, ?, ?, ?)
            `);

            itens.forEach((it) => {
              stmtItem.run(pedidoId, it.nome, it.quantidade, it.precoUnitario);
            });

            stmtItem.finalize();

            console.log(`[SQLite] Pedido #${pedidoId} registrado com sucesso para: ${nome}`);
            res.status(201).json({
              success: true,
              pedidoId: pedidoId,
              mensagem: 'Pedido gravado com sucesso no banco de dados SQLite!'
            });
          }
        );
      }
    );
  });
});

// 5. Listar Pedidos Recentes (Painel do Administrador)
app.get('/api/pedidos', (req, res) => {
  db.all(
    `SELECT p.*, (SELECT COUNT(*) FROM itens_pedido ip WHERE ip.pedido_id = p.id) as total_itens 
     FROM pedidos p ORDER BY p.id DESC LIMIT 50`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erro ao listar pedidos', details: err.message });
      }
      res.json({ pedidos: rows });
    }
  );
});

// 6. Registro de Leads B2B / Revenda
app.post('/api/b2b', (req, res) => {
  const { nome, whatsapp, empresa, cnpj, tipoNegocio, estimativa } = req.body;
  if (!nome || !whatsapp) {
    return res.status(400).json({ error: 'Nome e WhatsApp são obrigatórios para revenda.' });
  }

  db.run(
    `INSERT INTO leads_b2b (nome_responsavel, whatsapp, nome_empresa, cnpj, tipo_negocio, estimativa_semanal)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, whatsapp, empresa || '', cnpj || '', tipoNegocio || '', estimativa || ''],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao cadastrar parceiro', details: err.message });
      }
      res.status(201).json({ success: true, leadId: this.lastID, mensagem: 'Contato B2B registrado com sucesso no SQLite!' });
    }
  );
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n=================================================`);
  console.log(`🍇 Servidor Açaí na Garrafa rodando!`);
  console.log(`📡 URL Principal: http://localhost:${PORT}`);
  console.log(`🗄️  Banco de Dados: SQLite ativado em database.sqlite`);
  console.log(`=================================================\n`);
});
