import { consumeQueue } from './services/rabbitmqService.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Função para processar a exportação e salvar o arquivo
async function processarExportacao(message) {
    try {
        console.log('Processando exportação:', message);

        const exportacaoHash = message.hash;
        const nomeTabela = message.nomeTabela;
        const filtros = message.filtros;

        const dadosExportados = `Dados exportados da tabela ${nomeTabela} com filtros ${JSON.stringify(filtros)}`;
        
        const diretorio = process.env.DIRETORIO_ARQUIVOS || './exportacoes';
        const filePath = join(diretorio, `${exportacaoHash}.txt`);

        mkdirSync(diretorio, { recursive: true });
        writeFileSync(filePath, dadosExportados);

        console.log(`Exportação concluída e salva em ${filePath}`);
    } catch (error) {
        console.error('Erro ao processar exportação:', error);
    }
}

// Iniciar o consumidor passando a função de processamento
consumeQueue(processarExportacao);