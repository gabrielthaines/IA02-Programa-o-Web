const Produto = require('../model/Produto');
const { validarImagem, removerImagem, FormatoImagemInvalido } = require('../middleWare/imageUpload');

function validarProduto(nome, preco) {
    if (typeof nome !== 'string' || !nome.trim()) return 'O nome é obrigatório!';

    if (preco == null || (typeof preco === 'string' && preco.trim() === '')) {
        return 'O preço é obrigatório!';
    }
    if (!['string', 'number'].includes(typeof preco) ||
        !Number.isFinite(Number(preco)) || Number(preco) < 0) {
        return 'O preço deve ser um número maior ou igual a zero!';
    }
}

async function limparImagem(nome, verificarReferencias = false) {
    if (!nome) return;

    try {
        if (verificarReferencias && await Produto.count({ where: { imagem: nome } })) return;
        await removerImagem(nome);
    } catch (err) {
        console.error('Erro ao limpar imagem do produto:', err.code || err.name);
    }
}

module.exports = class ProdutoController {
    static async create(req, res) {
        const {nome, preco} = req.body || {};
        const imagem = req.file?.filename || null;
        const message = validarProduto(nome, preco);
        if (message) {
            await limparImagem(imagem);
            return res.status(422).json({message});
        }

        try {
            await validarImagem(req.file);
            const produto = new Produto({nome, preco, imagem});
            await produto.save();
        } catch (err) {
            await limparImagem(imagem);
            if (err instanceof FormatoImagemInvalido) throw err;
            return res.status(500).json({message: 'Erro ao criar o produto: ' + err});
        }

        return res.status(201).json({message: 'Produto criado com sucesso'});
    }

    static async getAll(req, res) {
        try {
                const produtos = await Produto.findAll();
                res.status(200).json(produtos);
        }
        catch (err) {
                res.status(500).json({ message: 'Erro ao buscar os produtos:' +
                    err });
        }   
    }

    static async getById(req, res){
        const {id} = req.params;

        const produto = await Produto.findByPk(id);

        if (!produto) {
            res.status(422).json({message: 'Produto não encontrado!'});
            return;
        }

        res.status(200).json(produto);
    }

    static async update(req, res) {
        const {id} = req.params;
        const {nome, preco} = req.body || {};
        const novaImagem = req.file?.filename;
        const message = validarProduto(nome, preco);
        if (message) {
            await limparImagem(novaImagem);
            return res.status(422).json({message});
        }

        let produto;
        try {
            await validarImagem(req.file);
            produto = await Produto.sequelize.transaction(async (transaction) => {
                const registro = await Produto.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
                if (!registro) return null;

                const imagemAnterior = registro.imagem;
                await registro.update({nome, preco, imagem: novaImagem ?? imagemAnterior}, { transaction });
                return { imagemAnterior };
            });

        } catch (err) {
            await limparImagem(novaImagem);
            if (err instanceof FormatoImagemInvalido) throw err;
            return res.status(500).json({message: 'Erro ao atualizar o produto: ' + err});
        }

        if (!produto) {
            await limparImagem(novaImagem);
            return res.status(422).json({message: 'Produto não encontrado'});
        }

        if (novaImagem) await limparImagem(produto.imagemAnterior, true);
        return res.status(200).json({message: 'Produto atualizado com sucesso'});
    }

    static async delete(req, res) {
        const {id} = req.params;

        try {
            const produto = await Produto.sequelize.transaction(async (transaction) => {
                const registro = await Produto.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
                if (registro) await registro.destroy({ transaction });
                return registro;
            });

            if (!produto) return res.status(422).json({message: 'Produto não encontrado'});

            await limparImagem(produto.imagem, true);
            return res.status(200).json({message: 'Produto deletado com sucesso!'});
        } catch (err) {
            return res.status(500).json({message: 'Erro ao excluir o produto: ' + err});
        }
    }
};
