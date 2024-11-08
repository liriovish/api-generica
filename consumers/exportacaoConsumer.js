import { consumeQueue } from '../services/rabbitmqService.js';
import { mkdirSync, writeFileSync } from 'fs';
// Fun��o para processar a exporta��o
async function processarExportacao(message) {
    try {
        console.log('Processando exporta��o:', message);

        const exportacaoHash = message.hash;
        const nomeTabela = message.nomeTabela;
        const filtros = message.filtros;

        // Simular exporta��o: aqui voc� deve implementar a l�gica de exporta��o real
        const dadosExportados = `Dados exportados da tabela ${nomeTabela} com filtros ${JSON.stringify(filtros)}`;
        
        // Salvar arquivo de exporta��o
        const diretorio = process.env.DIRETORIO_ARQUIVOS || './exportacoes';
        const filePath = join(diretorio, `${exportacaoHash}.txt`);
        
        mkdirSync(diretorio, { recursive: true });
        writeFileSync(filePath, dadosExportados);

        console.log(`Exporta��o conclu�da e salva em ${filePath}`);
    } catch (error) {
        console.error('Erro ao processar exporta��o:', error);
    }
}

// Iniciar o consumidor
consumeQueue(processarExportacao);
