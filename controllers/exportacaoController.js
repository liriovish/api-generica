import { v4 as uuidv4 } from 'uuid';
import { MongoExportacao, defineExportacaoSQL } from '../models/Exportacao.js';
import database from '../config/database.js'; 
const { getDatabase } = database; 
import { sendToQueue } from '../services/rabbitmqService.js';
import fs from 'fs';
import path from 'path';

// Rota GET /v1/tabelas
export async function listarTabelas(req, res) {
    try {
        if (process.env.SIGLA_DB === 'mongodb') {
            // Conexão com MongoDB: Listar as coleções e seus campos
            const collections = await mongoose.connection.db.listCollections().toArray();
            const tabelas = {};

            // Para cada coleção, obtém um exemplo de documento e seus campos
            for (const collection of collections) {
                const exampleDoc = await mongoose.connection.db.collection(collection.name).findOne({});
                const campos = Object.keys(exampleDoc || {}); // Pega as chaves do primeiro documento
                tabelas[collection.name] = { campos };
            }

            return res.json({ tabelas });
        } else {
            // Conexão com MySQL: Listar tabelas e campos
            const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
                host: process.env.DB_HOSTNAME,
                port: process.env.DB_PORT,
                dialect: process.env.SIGLA_DB,
            });

            const [tables] = await sequelize.query('SHOW TABLES');
            const tabelas = {};

            // Para cada tabela, lista os campos
            for (const table of tables) {
                const tableName = Object.values(table)[0];
                const [columns] = await sequelize.query(`SHOW COLUMNS FROM ${tableName}`);
                const campos = columns.map(col => col.Field); // Pega o nome das colunas
                tabelas[tableName] = { campos };
            }

            return res.json({ tabelas });
        }
    } catch (error) {
        console.error('Erro ao listar tabelas:', error);
        return res.status(500).json({ error: 'Erro ao listar tabelas' });
    }
}

// Rota GET /v1/listagem
export async function listarDados(req, res) {
    const { nomeTabela, campo, tipoFiltro, valor, pagina = 1, numeroRegistros = 100 } = req.query;

    if (nomeTabela === 'SIGLA_DB_exportacoes') {
        const db = getDatabase();
        let dados, totalRegistros;

        try {
            if (process.env.SIGLA_DB === 'mongodb') {
                // Filtragem para MongoDB
                let query = {};
                if (campo && tipoFiltro && valor) {
                    // Cria o filtro dinâmico com base nos campos fornecidos
                    campo.forEach((field, index) => {
                        query[field] = { [`$${tipoFiltro[index]}`]: valor[index] };
                    });
                }
                dados = await MongoExportacao.find(query)
                    .limit(Number(numeroRegistros))
                    .skip((pagina - 1) * numeroRegistros);
                totalRegistros = await MongoExportacao.countDocuments(query);
            } else {
                // Filtragem para MySQL (com Sequelize)
                const sequelize = await db.authenticate();
                const ExportacaoSQL = defineExportacaoSQL(sequelize);

                let whereClause = {};
                if (campo && tipoFiltro && valor) {
                    // Cria o filtro dinâmico com base nos campos fornecidos
                    campo.forEach((field, index) => {
                        whereClause[field] = { [Sequelize.Op[tipoFiltro[index]]]: valor[index] };
                    });
                }

                // Busca os dados com filtragem e paginação
                dados = await ExportacaoSQL.findAll({
                    where: whereClause,
                    limit: Number(numeroRegistros),
                    offset: (pagina - 1) * numeroRegistros
                });
                totalRegistros = await ExportacaoSQL.count({ where: whereClause });
            }

            // Retorna os dados com a contagem e paginação
            res.json({
                totalRegistros,
                totalPaginas: Math.ceil(totalRegistros / numeroRegistros),
                dados
            });
        } catch (error) {
            console.error('Erro ao listar dados:', error);
            res.status(500).json({ error: 'Erro ao listar dados' });
        }
    } else {
        // Caso a tabela seja inválida
        res.status(400).json({ error: 'Tabela inválida' });
    }
}

// Rota POST /v1/exportacao
export async function solicitarExportacao(req, res) {
    const { nomeTabela, campo, tipoFiltro, valor } = req.body;

    const novaExportacao = {
        hash: uuidv4(),
        filtros: { campo, tipoFiltro, valor },
        situacao: 0, // Solicitada
        dataCadastro: new Date(),
        dataGeracao: null,
        dataExclusao: null,
        tentativasProcessamento: 0,
    };

    let exportacao;
    if (process.env.SIGLA_DB === 'mongodb') {
        exportacao = new MongoExportacao(novaExportacao);
        await exportacao.save();
    } else {
        const sequelize = getDatabase();
        const ExportacaoSQL = defineExportacaoSQL(sequelize);
        exportacao = await ExportacaoSQL.create(novaExportacao);
    }

    await sendToQueue({
        hash: exportacao.hash,
        nomeTabela,
        filtros: novaExportacao.filtros,
        dataSolicitacao: new Date()
    });

    res.json({ hash: exportacao.hash });
}

// Rota GET /v1/exportacao
export async function listarExportacoes(req, res) {
    const {
        hash,
        situacao,
        dataInicialCadastro,
        dataFinalCadastro,
        dataInicialGeracao,
        dataFinalGeracao,
        dataInicialExclusao,
        dataFinalExclusao,
        pagina = 1,
        numeroRegistros = 100
    } = req.query;

    let query = {};
    if (hash) query.hash = hash;
    if (situacao) query.situacao = parseInt(situacao);
    if (dataInicialCadastro || dataFinalCadastro) {
        query.dataCadastro = {};
        if (dataInicialCadastro) query.dataCadastro.$gte = new Date(dataInicialCadastro);
        if (dataFinalCadastro) query.dataCadastro.$lte = new Date(dataFinalCadastro);
    }
    if (dataInicialGeracao || dataFinalGeracao) {
        query.dataGeracao = {};
        if (dataInicialGeracao) query.dataGeracao.$gte = new Date(dataInicialGeracao);
        if (dataFinalGeracao) query.dataGeracao.$lte = new Date(dataFinalGeracao);
    }
    if (dataInicialExclusao || dataFinalExclusao) {
        query.dataExclusao = {};
        if (dataInicialExclusao) query.dataExclusao.$gte = new Date(dataInicialExclusao);
        if (dataFinalExclusao) query.dataExclusao.$lte = new Date(dataFinalExclusao);
    }

    let dados, totalRegistros;
    if (process.env.SIGLA_DB === 'mongodb') {
        dados = await MongoExportacao.find(query)
            .limit(Number(numeroRegistros))
            .skip((pagina - 1) * numeroRegistros);
        totalRegistros = await MongoExportacao.countDocuments(query);
    } else {
        const sequelize = getDatabase();
        const ExportacaoSQL = defineExportacaoSQL(sequelize);
        dados = await ExportacaoSQL.findAll({
            where: query,
            limit: Number(numeroRegistros),
            offset: (pagina - 1) * numeroRegistros
        });
        totalRegistros = await ExportacaoSQL.count({ where: query });
    }

    res.json({
        totalRegistros,
        totalPaginas: Math.ceil(totalRegistros / numeroRegistros),
        dados
    });
}

// Rota GET /v1/exportacao/:hashExportacao
export async function obterExportacao(req, res) {
    const { hashExportacao } = req.params;
    let exportacao;

    if (process.env.SIGLA_DB === 'mongodb') {
        exportacao = await MongoExportacao.findOne({ hash: hashExportacao });
    } else {
        const sequelize = getDatabase();
        const ExportacaoSQL = defineExportacaoSQL(sequelize);
        exportacao = await ExportacaoSQL.findOne({ where: { hash: hashExportacao } });
    }

    if (exportacao) {
        res.json(exportacao);
    } else {
        res.status(404).json({ error: 'Exportação não encontrada' });
    }
}

// Rota GET /v1/download/:hashExportacao
export async function baixarArquivo(req, res) {
    const { hashExportacao } = req.params;
    let exportacao;

    if (process.env.SIGLA_DB === 'mongodb') {
        exportacao = await MongoExportacao.findOne({ hash: hashExportacao });
    } else {
        const sequelize = getDatabase();
        const ExportacaoSQL = defineExportacaoSQL(sequelize);
        exportacao = await ExportacaoSQL.findOne({ where: { hash: hashExportacao } });
    }

    if (exportacao && exportacao.caminhoArquivo) {
        const filePath = path.join(process.env.DIRETORIO_ARQUIVOS, exportacao.caminhoArquivo);
        if (fs.existsSync(filePath)) {
            res.download(filePath);
        } else {
            res.status(404).json({ error: 'Arquivo não encontrado' });
        }
    } else {
        res.status(404).json({ error: 'Exportação não encontrada' });
    }
}

// Rota DELETE /v1/exportacao/:hashExportacao
export async function excluirExportacao(req, res) {
    const { hashExportacao } = req.params;
    let exportacao;

    if (process.env.SIGLA_DB === 'mongodb') {
        exportacao = await MongoExportacao.findOne({ hash: hashExportacao });
    } else {
        const sequelize = getDatabase();
        const ExportacaoSQL = defineExportacaoSQL(sequelize);
        exportacao = await ExportacaoSQL.findOne({ where: { hash: hashExportacao } });
    }

    if (exportacao) {
        const filePath = path.join(process.env.DIRETORIO_ARQUIVOS, exportacao.caminhoArquivo);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Excluir arquivo
        }

        exportacao.situacao = 4;
        exportacao.dataExclusao = new Date();
        await exportacao.save();
        res.json({ message: 'Exportação excluída com sucesso' });
    } else {
        res.status(404).json({ error: 'Exportação não encontrada' });
    }
}
