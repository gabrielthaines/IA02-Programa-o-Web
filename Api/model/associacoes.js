const Carrinho = require('./Carrinho.js');
const CarrinhoItem = require('./CarrinhoItem.js');
const Produto = require('./Produto.js');
const Venda = require('./Venda.js');
const VendaItem = require('./VendaItem.js');

Carrinho.hasMany(CarrinhoItem, { as: 'itens', foreignKey: 'carrinhoId' });
CarrinhoItem.belongsTo(Carrinho, { foreignKey: 'carrinhoId' });
CarrinhoItem.belongsTo(Produto, { as: 'produto', foreignKey: 'produtoId', onDelete: 'CASCADE' });
Venda.hasMany(VendaItem, { as: 'itens', foreignKey: 'vendaId' });
VendaItem.belongsTo(Venda, { foreignKey: 'vendaId' });
Venda.belongsTo(Carrinho, { foreignKey: 'carrinhoId', onDelete: 'RESTRICT' });
