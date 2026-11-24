const router = require('express').Router();
const ProdutoController = require('../Controller/ProdutoController.js');
const { imageUpload } = require('../middleWare/imageUpload.js');
const receberImagem = imageUpload.single('imagem');

router.post('/create', receberImagem, ProdutoController.create);
router.get('/getAll', ProdutoController.getAll);
router.get('/getById/:id', ProdutoController.getById);
router.patch('/update/:id', receberImagem, ProdutoController.update);
router.delete('/delete/:id', ProdutoController.delete);

module.exports = router;
