const { DataTypes } = require('sequelize');
const db = require('../db/conn.js');

const CarrinhoItem = db.define('CarrinhoItem', {
    carrinhoId: { type: DataTypes.INTEGER, allowNull: false },
    produtoId: { type: DataTypes.INTEGER, allowNull: false },
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1, max: 999 }
    }
}, {
    indexes: [{ unique: true, fields: ['carrinhoId', 'produtoId'] }]
});

module.exports = CarrinhoItem;
