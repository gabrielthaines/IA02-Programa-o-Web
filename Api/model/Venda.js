const { DataTypes } = require('sequelize');
const db = require('../db/conn.js');

const Venda = db.define('Venda', {
    carrinhoId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    total: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { min: 0 }
    }
});

module.exports = Venda;
