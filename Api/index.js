const express = require('express');
const app = express();
const port = 5000;
const conn = require('./db/conn.js');
const cors = require('cors');
const path = require('path');
const { MulterError } = require('multer');
const { FormatoImagemInvalido } = require('./middleWare/imageUpload.js');

app.use(express.json());
app.use(cors({Credentials: true, origin: '*'}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const ProdutoRouter = require('./router/ProdutoRouter.js');
require('./model/associacoes.js');
const CarrinhoRouter = require('./router/CarrinhoRouter.js');
const VendaRouter = require('./router/VendaRouter.js');
app.use('/Produto', ProdutoRouter);
app.use('/Carrinho', CarrinhoRouter);
app.use('/Venda', VendaRouter);

app.use((err, req, res, next) => {
    if (err instanceof FormatoImagemInvalido) {
        return res.status(400).json({message: err.message});
    }
    if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({message: 'A imagem deve ter até 5 MiB!'});
        }
        return res.status(400).json({message: 'Envio de imagem inválido!'});
    }
    return next(err);
});

conn
    // Opt-in para bancos locais existentes. O Sequelize pode alterar outras colunas.
    .sync({ alter: process.env.DB_SYNC_ALTER === 'true' })
    .then(() => { app.listen(port)})
    .catch((err) => console.log(err));
