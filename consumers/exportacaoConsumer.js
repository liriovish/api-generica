import { consumeQueue } from './services/rabbitmqService.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Fun��o para processar a exporta��o e salvar o arquivo
async function processarExportacao(message) {
    try {
        console.log('Processando exporta��o:', message);

        const exportacaoHash = message.hash;
        const nomeTabela = message.nomeTabela;
        const filtros = message.filtros;

        const dadosExportados = `Dados exportados da tabela ${nomeTabela} com filtros ${JSON.stringify(filtros)}`;
        
        const diretorio = process.env.DIRETORIO_ARQUIVOS || './exportacoes';
        const filePath = join(diretorio, `${exportacaoHash}.txt`);

        mkdirSync(diretorio, { recursive: true });
        writeFileSync(filePath, dadosExportados);

        console.log(`Exporta��o conclu�da e salva em ${filePath}`);
    } catch (error) {
        console.error('Erro ao processar exporta��o:', error);
    }
}

// Iniciar o consumidor passando a fun��o de processamento
consumeQueue(processarExportacao);