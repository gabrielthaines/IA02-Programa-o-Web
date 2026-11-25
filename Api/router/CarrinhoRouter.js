const router = require('express').Router();
const CarrinhoController = require('../Controller/CarrinhoController.js');

router.post('/create', CarrinhoController.create);
router.get('/getById/:id', CarrinhoController.getById);
router.post('/addItem/:id', CarrinhoController.addItem);
router.patch('/updateItem/:id', CarrinhoController.updateItem);
router.delete('/removeItem/:id/:produtoId', CarrinhoController.removeItem);

module.exports = router;
