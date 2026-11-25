const db = require('../db/conn.js');
const CarrinhoItem = require('../model/CarrinhoItem.js');
const Produto = require('../model/Produto.js');
const Venda = require('../model/Venda.js');
const VendaItem = require('../model/VendaItem.js');
const { ErroDaOperacao, validarId, bloquearCarrinhoAberto, responderErro } = require('./carrinhoUtil.js');

const camposVenda = {
    attributes: ['id', 'carrinhoId', 'total'],
    include: [{
        model: VendaItem, as: 'itens', attributes: ['produtoId', 'nome', 'preco', 'quantidade']
    }]
};

module.exports = class VendaController {
    static async create(req, res) {
        try {
            const carrinhoId = validarId(req.body?.carrinhoId);
            const venda = await db.transaction(async (transaction) => {
                const carrinho = await bloquearCarrinhoAberto(carrinhoId, transaction);
                const itens = await CarrinhoItem.findAll({
                    where: { carrinhoId }, order: [['produtoId', 'ASC']], transaction
                });
                if (itens.length === 0) throw new ErroDaOperacao(409, 'O carrinho está vazio!');

                const itensVenda = [];
                let totalCentavos = 0;
                for (const item of itens) {
                    const produto = await Produto.findByPk(item.produtoId, { transaction, lock: transaction.LOCK.UPDATE });
                    if (!produto) throw new ErroDaOperacao(404, 'Produto não encontrado!');
                    itensVenda.push({
                        produtoId: produto.id, nome: produto.nome, preco: produto.preco, quantidade: item.quantidade
                    });
                    totalCentavos += Math.round(Number(produto.preco) * 100) * item.quantidade;
                }
                if (!Number.isSafeInteger(totalCentavos) || totalCentavos < 0 || totalCentavos > 99999999999999) {
                    throw new ErroDaOperacao(422, 'Total da venda fora do limite permitido!');
                }

                const registro = await Venda.create({ carrinhoId, total: (totalCentavos / 100).toFixed(2) }, { transaction });
                await VendaItem.bulkCreate(itensVenda.map((item) => ({ ...item, vendaId: registro.id })), {
                    transaction, validate: true
                });
                await carrinho.update({ status: 'finalizado' }, { transaction });
                return Venda.findByPk(registro.id, { ...camposVenda, transaction });
            });
            return res.status(201).json(venda);
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async getAll(req, res) {
        try {
            return res.json(await Venda.findAll(camposVenda));
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async getById(req, res) {
        try {
            const venda = await Venda.findByPk(validarId(req.params.id), camposVenda);
            if (!venda) throw new ErroDaOperacao(404, 'Venda não encontrada!');
            return res.json(venda);
        } catch (err) {
            return responderErro(res, err);
        }
    }
};
