const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const express = require('express');
const { Sequelize } = require('sequelize');

async function executar() {
    const porta = Number(process.env.TEST_MARIADB_PORT);
    assert(Number.isInteger(porta) && porta > 1024 && porta <= 65535 && porta !== 3306,
        'Configure TEST_MARIADB_PORT para uma instância MariaDB local descartável em uma porta alternativa.');

    const nomeBanco = 'teste_vendas_' + randomUUID().replaceAll('-', '');
    const config = { host: '127.0.0.1', port: porta, dialect: 'mariadb', logging: false };
    const usuario = process.env.TEST_MARIADB_USER || 'root';
    const senha = process.env.TEST_MARIADB_PASSWORD || '';
    const admin = new Sequelize('information_schema', usuario, senha, config);
    const db = new Sequelize(nomeBanco, usuario, senha, config);
    let bancoCriado = false;
    let servidor;
    const produtosCriados = new Set();

    try {
        await admin.query('CREATE DATABASE ' + nomeBanco);
        bancoCriado = true;
        const caminhoConexao = require.resolve('../db/conn.js');
        require.cache[caminhoConexao] = { id: caminhoConexao, loaded: true, exports: db };
        require('../model/associacoes.js');
        await db.sync();

        const app = express();
        app.use(express.json());
        app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
        app.use('/Produto', require('../router/ProdutoRouter.js'));
        app.use('/Carrinho', require('../router/CarrinhoRouter.js'));
        app.use('/Venda', require('../router/VendaRouter.js'));
        const { FormatoImagemInvalido } = require('../middleWare/imageUpload.js');
        app.use((err, req, res, next) => {
            if (err instanceof FormatoImagemInvalido) {
                return res.status(400).json({ message: err.message });
            }
            return next(err);
        });

        servidor = await new Promise((resolve, reject) => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
            listener.once('error', reject);
        });
        const base = 'http://127.0.0.1:' + servidor.address().port;

        async function requisicao(metodo, rota, status, dados) {
            const formulario = dados instanceof FormData;
            const resposta = await fetch(base + rota, {
                method: metodo,
                headers: dados && !formulario ? { 'Content-Type': 'application/json' } : {},
                body: formulario ? dados : JSON.stringify(dados)
            });
            const corpo = await resposta.text();
            if (Array.isArray(status)) {
                assert(status.includes(resposta.status), metodo + ' ' + rota + ': ' + corpo);
                return { status: resposta.status, dados: JSON.parse(corpo) };
            }
            assert.equal(resposta.status, status, metodo + ' ' + rota + ': ' + corpo);
            return JSON.parse(corpo);
        }

        async function criarProduto(nome, preco, imagem) {
            let dados = { nome, preco };
            if (imagem) {
                dados = new FormData();
                dados.append('nome', nome);
                dados.append('preco', preco);
                dados.append('imagem', imagem, 'produto.png');
            }
            await requisicao('POST', '/Produto/create', 201, dados);
            const catalogo = await requisicao('GET', '/Produto/getAll', 200);
            const produto = catalogo.find((item) => item.nome === nome);
            assert(produto);
            produtosCriados.add(produto.id);
            return produto;
        }

        try {
            const png = new Blob([Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZQAAAAASUVORK5CYII=',
                'base64'
            )], { type: 'image/png' });
            const produtoA = await criarProduto('Produto A', '10.50', png);
            const produtoB = await criarProduto('Produto B', '4.00');
            const imagem = await fetch(base + '/uploads/' + produtoA.imagem);
            assert.equal(imagem.status, 200);
            assert.deepEqual(await imagem.arrayBuffer(), await png.arrayBuffer());
            assert.equal(produtoB.imagem, null);
            await requisicao('POST', '/Produto/create', 422, { nome: 'Negativo', preco: -1 });
            const invalido = new FormData();
            invalido.append('nome', 'Imagem inválida');
            invalido.append('preco', '1');
            invalido.append('imagem', new Blob(['não é um PNG'], { type: 'image/png' }), 'invalido.png');
            await requisicao('POST', '/Produto/create', 400, invalido);
            console.log('OK: cadastro, consulta, imagem válida e rejeições do CRUD');

            const carrinho = await requisicao('POST', '/Carrinho/create', 201, {});
            assert.deepEqual(carrinho.itens, []);
            const id = carrinho.id;
            const adicionar = (produtoId, quantidade, status = 200) =>
                requisicao('POST', '/Carrinho/addItem/' + id, status, { produtoId, quantidade, preco: 0 });
            const atualizar = (produtoId, quantidade, status = 200) =>
                requisicao('PATCH', '/Carrinho/updateItem/' + id, status, { produtoId, quantidade });
            const finalizar = (status) =>
                requisicao('POST', '/Venda/create', status, { carrinhoId: id, total: 0 });
            await requisicao('GET', '/Carrinho/getById/invalido', 422);
            await requisicao('GET', '/Carrinho/getById/99999', 404);
            await finalizar(409);
            await adicionar(99999, 1, 404);
            for (const quantidade of [0, -1, 1.5, 1000]) {
                await adicionar(produtoA.id, quantidade, 422);
            }
            await atualizar(produtoA.id, 1, 404);
            await adicionar(produtoA.id, 999);
            await adicionar(produtoA.id, 1, 422);
            await atualizar(produtoA.id, 1);

            await Promise.all([adicionar(produtoA.id, 1), adicionar(produtoB.id, 1)]);
            const atualizado = await requisicao('GET', '/Carrinho/getById/' + id, 200);
            assert.equal(atualizado.itens.find((item) => item.produtoId === produtoA.id).quantidade, 2);
            const removido = await requisicao('DELETE', '/Carrinho/removeItem/' + id + '/' + produtoB.id, 200);
            assert.equal(removido.itens.length, 1);
            await adicionar(produtoB.id, 1);
            await requisicao('PATCH', '/Produto/update/' + produtoB.id, 200, { nome: 'Produto B atualizado', preco: '5.00' });
            const atualizadoB = await requisicao('GET', '/Produto/getById/' + produtoB.id, 200);
            assert.equal(Number(atualizadoB.preco), 5);
            console.log('OK: rejeições, quantidades, concorrência e remoção do carrinho, edição de produto');

            const VendaItem = require('../model/VendaItem.js');
            function falharGravacao() {
                throw new Error('Falha de gravação injetada pelo teste');
            }
            for (const evento of ['afterCreate', 'afterBulkCreate']) {
                VendaItem.addHook(evento, 'falhaTeste', falharGravacao);
            }
            try {
                await finalizar(500);
            } finally {
                for (const evento of ['afterCreate', 'afterBulkCreate']) {
                    VendaItem.removeHook(evento, 'falhaTeste');
                }
            }
            assert.equal(await VendaItem.count(), 0);
            assert.deepEqual(await requisicao('GET', '/Venda/getAll', 200), []);
            assert.equal((await requisicao('GET', '/Carrinho/getById/' + id, 200)).status, 'aberto');
            console.log('OK: rollback após gravação de item e carrinho aberto para nova tentativa');

            const resultados = await Promise.all([finalizar([201, 409]), finalizar([201, 409])]);
            assert.deepEqual(resultados.map((retorno) => retorno.status).sort(), [201, 409]);
            const venda = resultados.find((retorno) => retorno.status === 201).dados;
            assert.equal(Number(venda.total), 26);
            assert.equal(venda.itens.length, 2);
            const itemB = venda.itens.find((item) => item.produtoId === produtoB.id);
            assert.equal(itemB.nome, 'Produto B atualizado');
            assert.equal(Number(itemB.preco), 5);
            await finalizar(409);
            await adicionar(produtoA.id, 1, 409);
            await atualizar(produtoA.id, 1, 409);
            await requisicao('DELETE', '/Carrinho/removeItem/' + id + '/' + produtoA.id, 409);
            assert.equal((await requisicao('GET', '/Venda/getAll', 200)).length, 1);
            assert.equal((await requisicao('GET', '/Carrinho/getById/' + id, 200)).status, 'finalizado');

            const novo = await requisicao('POST', '/Carrinho/create', 201, {});
            assert.notEqual(novo.id, id);
            await requisicao('POST', '/Carrinho/addItem/' + novo.id, 200, { produtoId: produtoA.id, quantidade: 1 });
            await requisicao('DELETE', '/Produto/delete/' + produtoA.id, 200);
            produtosCriados.delete(produtoA.id);
            assert.deepEqual((await requisicao('GET', '/Carrinho/getById/' + novo.id, 200)).itens, []);
            assert.equal((await fetch(base + '/uploads/' + produtoA.imagem)).status, 404);
            const historico = await requisicao('GET', '/Venda/getById/' + venda.id, 200);
            assert.equal(Number(historico.total), 26);
            assert(historico.itens.some((item) => item.produtoId === produtoA.id && item.nome === 'Produto A'));
            console.log('OK: venda de R$ 26,00, finalização única, exclusão de produto e histórico preservado');
        } finally {
            for (const id of produtosCriados) {
                await requisicao('DELETE', '/Produto/delete/' + id, 200);
            }
        }
    } finally {
        if (servidor) await new Promise((resolve) => servidor.close(resolve));
        await db.close();
        try {
            if (bancoCriado) await admin.query('DROP DATABASE ' + nomeBanco);
        } finally {
            await admin.close();
        }
    }
}

executar().catch((erro) => {
    console.error(erro.stack);
    process.exitCode = 1;
});
