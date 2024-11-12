import { v4 as uuidv4 } from 'uuid';
import { MongoExportacao, defineExportacaoSQL } from '../models/Exportacao.js';
import database from '../config/database.js'; 
const { getDatabase } = database; 
import { sendToQueue } from '../services/rabbitmqService.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';


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
    // Pegando os parâmetros da query
    const { nomeTabela, campo, tipoFiltro, valor, pagina = 1, numeroRegistros = 100 } = req.query;

    // Verifica se o nome da tabela foi fornecido
    if (!nomeTabela) {
        return res.status(400).json({ error: 'Nome da tabela não fornecido.' });
    }

    const db = getDatabase();
    let dados, totalRegistros;

    try {
        if (process.env.SIGLA_DB === 'mongodb') {
            // Conectar ao MongoDB e acessar a coleção com o nome fornecido
            const collection = mongoose.connection.db.collection(nomeTabela);

            if (!collection) {
                return res.status(400).json({ error: 'Tabela não encontrada no banco de dados.' });
            }

            let query = {};

            // Aplica filtros, se fornecidos
            if (campo && tipoFiltro && valor) {
                campo.forEach((field, index) => {
                    query[field] = { [`$${tipoFiltro[index]}`]: valor[index] };  // Cria o filtro dinâmico
                });
            }

            // Realiza a consulta no MongoDB com paginação
            dados = await collection.find(query)
                .limit(Number(numeroRegistros))
                .skip((pagina - 1) * numeroRegistros)
                .toArray();

            totalRegistros = await collection.countDocuments(query);

        } else {
            // Conexão com MySQL usando Sequelize
            if (!nomeTabela) {
                return res.status(400).json({ error: 'Nome da tabela não fornecido.' });
            }

            const sequelize = await db.authenticate();
            const model = sequelize.models[nomeTabela];  // Acessa o modelo da tabela no Sequelize

            if (!model) {
                return res.status(400).json({ error: 'Tabela não encontrada no banco de dados.' });
            }

            // Busca os dados da tabela sem filtros
            dados = await model.findAll();
            totalRegistros = dados.length;
        }

        // Retorna os dados com a contagem e paginação
        res.json({
            totalRegistros,
            totalPaginas: Math.ceil(totalRegistros / numeroRegistros),  // Calcula total de páginas
            dados
        });

    } catch (error) {
        console.error('Erro ao listar dados:', error);
        res.status(500).json({ error: 'Erro ao listar dados' });
    }
}

// Rota POST /v1/exportacao
export async function solicitarExportacao(req, res) {
    const { nomeTabela, campo, tipoFiltro, valor } = req.body;

    // Verifica se o campo nomeTabela é fornecido e válido
    if (!nomeTabela) {
        return res.status(400).json({ error: 'O campo nomeTabela é obrigatório' });
    }

    // Verifica se os arrays campo, tipoFiltro e valor têm tamanhos compatíveis caso sejam fornecidos
    if ((campo || tipoFiltro || valor) && (!Array.isArray(campo) || !Array.isArray(tipoFiltro) || !Array.isArray(valor))) {
        return res.status(400).json({ error: 'Parâmetros campo, tipoFiltro e valor devem ser arrays, se fornecidos' });
    }
    if (campo && (campo.length !== tipoFiltro.length || campo.length !== valor.length)) {
        return res.status(400).json({ error: 'Parâmetros campo, tipoFiltro e valor devem ter o mesmo comprimento' });
    }

    // Criação da exportação com os dados fornecidos
    const novaExportacao = {
        hash: uuidv4(),
        filtros: { campo, tipoFiltro, valor },
        situacao: 0,
        dataCadastro: new Date(),
        dataGeracao: new Date(),
        dataExclusao: null,
        tentativasProcessamento: 0,
    };

    let exportacao;

    try {
        if (process.env.SIGLA_DB === 'mongodb') {
            // Cria um novo registro no MongoDB
            exportacao = new MongoExportacao(novaExportacao);
            await exportacao.save();
        } else {
            // Se usa MySQL, cria o registro usando Sequelize
            const sequelize = getDatabase();
            const ExportacaoSQL = defineExportacaoSQL(sequelize);
            exportacao = await ExportacaoSQL.create(novaExportacao);
        }

        // Envia uma mensagem para o RabbitMQ com os dados da exportação solicitada
        await sendToQueue({
            hash: exportacao.hash,
            nomeTabela,
            filtros: novaExportacao.filtros,
            dataSolicitacao: new Date()
        });

        // Retorna o hash da exportação para o cliente
        return res.json({ hash: exportacao.hash });

    } catch (error) {
        console.error('Erro ao solicitar exportação:', error);
        return res.status(500).json({ error: 'Erro ao solicitar exportação' });
    }
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

    // Montando a consulta dinâmica
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

    try {
        let dados, totalRegistros;

        if (process.env.SIGLA_DB === 'mongodb') {
            // Consulta MongoDB
            dados = await MongoExportacao.find(query)
                .select('hash situacao tentativasProcessamento dataCadastro dataGeracao dataExclusao')
                .limit(Number(numeroRegistros))
                .skip((pagina - 1) * numeroRegistros);
            totalRegistros = await MongoExportacao.countDocuments(query);
        } else {
            // Consulta MySQL (Sequelize)
            const sequelize = getDatabase();
            const ExportacaoSQL = defineExportacaoSQL(sequelize);

            dados = await ExportacaoSQL.findAll({
                where: query,
                attributes: [
                    'hash',
                    'situacao',
                    'tentativasProcessamento',
                    'dataCadastro',
                    'dataGeracao',
                    'dataExclusao'
                ],
                limit: Number(numeroRegistros),
                offset: (pagina - 1) * numeroRegistros
            });
            totalRegistros = await ExportacaoSQL.count({ where: query });
        }

        // Retorno formatado conforme os requisitos
        res.json({
            totalRegistros,
            totalPaginas: Math.ceil(totalRegistros / numeroRegistros),
            dados
        });

    } catch (error) {
        console.error('Erro ao listar exportações:', error);
        res.status(500).json({ error: 'Erro ao listar exportações' });
    }
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

    try {
        // Verifica se o banco é MongoDB ou SQL
        if (process.env.SIGLA_DB === 'mongodb') {
            // Busca no MongoDB
            exportacao = await MongoExportacao.findOne({ hash: hashExportacao });
        } else {
            // Busca no MySQL (usando Sequelize)
            const sequelize = getDatabase();
            const ExportacaoSQL = defineExportacaoSQL(sequelize);
            exportacao = await ExportacaoSQL.findOne({ where: { hash: hashExportacao } });
        }

        // Verifica se a exportação foi encontrada e possui o caminho do arquivo
        if (exportacao) {
            const filePath = exportacao.caminhoArquivo

            // Verifica se o arquivo existe no diretório especificado
            console.log(filePath);
            if (fs.existsSync(filePath)) {
                return res.download(filePath);
                
            } else {
                return res.status(404).json({ error: 'Arquivo não encontrado no diretório especificado' });
            }
        } else {
            return res.status(404).json({ error: 'Exportação não encontrada ou caminho do arquivo ausente' });
        }
    } catch (error) {
        console.error('Erro ao baixar arquivo:', error);
        return res.status(500).json({ error: 'Erro ao processar a solicitação de download' });
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
