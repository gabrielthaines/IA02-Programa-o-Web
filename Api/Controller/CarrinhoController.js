const db = require('../db/conn.js');
const Carrinho = require('../model/Carrinho.js');
const CarrinhoItem = require('../model/CarrinhoItem.js');
const Produto = require('../model/Produto.js');
const {
    ErroDaOperacao, validarId, validarQuantidade, bloquearCarrinhoAberto, responderErro
} = require('./carrinhoUtil.js');

function buscarCarrinho(id, transaction) {
    return Carrinho.findByPk(id, {
        attributes: ['id', 'status'],
        include: [{
            model: CarrinhoItem, as: 'itens', attributes: ['id', 'produtoId', 'quantidade'],
            include: [{
                model: Produto, as: 'produto', attributes: ['id', 'nome', 'preco', 'imagem']
            }]
        }],
        transaction
    });
}

function alterarCarrinho(id, alterarItem) {
    return db.transaction(async (transaction) => {
        await bloquearCarrinhoAberto(id, transaction);
        await alterarItem(transaction);
        return buscarCarrinho(id, transaction);
    });
}

module.exports = class CarrinhoController {
    static async create(req, res) {
        try {
            const carrinho = await Carrinho.create();
            return res.status(201).json({ id: carrinho.id, status: carrinho.status, itens: [] });
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async getById(req, res) {
        try {
            const carrinho = await buscarCarrinho(validarId(req.params.id));
            if (!carrinho) throw new ErroDaOperacao(404, 'Carrinho não encontrado!');
            return res.json(carrinho);
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async addItem(req, res) {
        try {
            const carrinhoId = validarId(req.params.id);
            const produtoId = validarId(req.body?.produtoId);
            const quantidade = validarQuantidade(req.body?.quantidade);
            const carrinho = await alterarCarrinho(carrinhoId, async (transaction) => {
                const produto = await Produto.findByPk(produtoId, { transaction, lock: transaction.LOCK.UPDATE });
                if (!produto) throw new ErroDaOperacao(404, 'Produto não encontrado!');
                const item = await CarrinhoItem.findOne({ where: { carrinhoId, produtoId }, transaction });
                if (item) {
                    await item.update({ quantidade: validarQuantidade(item.quantidade + quantidade) }, { transaction });
                } else {
                    await CarrinhoItem.create({ carrinhoId, produtoId, quantidade }, { transaction });
                }
            });
            return res.json(carrinho);
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async updateItem(req, res) {
        try {
            const carrinhoId = validarId(req.params.id);
            const produtoId = validarId(req.body?.produtoId);
            const quantidade = validarQuantidade(req.body?.quantidade);
            const carrinho = await alterarCarrinho(carrinhoId, async (transaction) => {
                const item = await CarrinhoItem.findOne({
                    where: { carrinhoId, produtoId }, transaction, lock: transaction.LOCK.UPDATE
                });
                if (!item) throw new ErroDaOperacao(404, 'Item não encontrado no carrinho!');
                await item.update({ quantidade }, { transaction });
            });
            return res.json(carrinho);
        } catch (err) {
            return responderErro(res, err);
        }
    }

    static async removeItem(req, res) {
        try {
            const carrinhoId = validarId(req.params.id);
            const produtoId = validarId(req.params.produtoId);
            const carrinho = await alterarCarrinho(carrinhoId, async (transaction) => {
                const removidos = await CarrinhoItem.destroy({ where: { carrinhoId, produtoId }, transaction });
                if (!removidos) throw new ErroDaOperacao(404, 'Item não encontrado no carrinho!');
            });
            return res.json(carrinho);
        } catch (err) {
            return responderErro(res, err);
        }
    }
};
