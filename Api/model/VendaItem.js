const { DataTypes } = require('sequelize');
const db = require('../db/conn.js');

const VendaItem = db.define('VendaItem', {
    vendaId: { type: DataTypes.INTEGER, allowNull: false },
    produtoId: { type: DataTypes.INTEGER, allowNull: false },
    nome: { type: DataTypes.STRING, allowNull: false },
    preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    quantidade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: true, min: 1 }
    }
});

module.exports = VendaItem;
