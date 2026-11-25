const Carrinho = require('../model/Carrinho.js');

class ErroDaOperacao extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function validarInteiro(valor, limite, mensagem) {
    const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
    if (!Number.isInteger(numero) || numero < 1 || numero > limite) {
        throw new ErroDaOperacao(422, mensagem);
    }
    return numero;
}

function validarId(valor) {
    return validarInteiro(valor, 2147483647, 'Identificador inválido!');
}

function validarQuantidade(valor) {
    return validarInteiro(valor, 999, 'A quantidade deve ser um inteiro entre 1 e 999!');
}

async function bloquearCarrinhoAberto(id, transaction) {
    const carrinho = await Carrinho.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!carrinho) throw new ErroDaOperacao(404, 'Carrinho não encontrado!');
    if (carrinho.status !== 'aberto') throw new ErroDaOperacao(409, 'Carrinho já finalizado!');
    return carrinho;
}

function responderErro(res, err) {
    if (err instanceof ErroDaOperacao) {
        return res.status(err.status).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Erro interno ao processar a operação!' });
}

module.exports = { ErroDaOperacao, validarId, validarQuantidade, bloquearCarrinhoAberto, responderErro };
