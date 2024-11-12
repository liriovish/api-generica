import { Schema, model } from 'mongoose';
import { DataTypes } from 'sequelize';
import database from '../config/database.js'; 
const { getDatabase } = database; 

const exportacaoSchema = new Schema({
    hash: String,
    filtros: Array,
    situacao: Number,
    tentativasProcessamento: Number,
    caminhoArquivo: String,
    dataGeracao: Date,
    dataExclusao: Date,
    dataCadastro: Date,
    dataAtualizacao: Date
}, { timestamps: true });

// Definir o modelo para SQL
const defineExportacaoSQL = (sequelize) => {
    return sequelize.define('Exportacao', {
        hash: DataTypes.STRING,
        filtros: DataTypes.JSON,
        situacao: DataTypes.INTEGER,
        tentativasProcessamento: DataTypes.INTEGER,
        caminhoArquivo: DataTypes.STRING,
        dataGeracao: DataTypes.DATE,
        dataExclusao: DataTypes.DATE,
        dataCadastro: DataTypes.DATE,
        dataAtualizacao: DataTypes.DATE
    }, { tableName: 'exportacoes', timestamps: false });
};

export const MongoExportacao = model('exportacoes', exportacaoSchema);
export { defineExportacaoSQL };