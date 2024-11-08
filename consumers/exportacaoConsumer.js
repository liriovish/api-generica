import { consumeQueue } from '../services/rabbitmqService.js';
import { mkdirSync, writeFileSync } from 'fs';
// Função para processar a exportação
async function processarExportacao(message) {
    try {
        console.log('Processando exportação:', message);

        const exportacaoHash = message.hash;
        const nomeTabela = message.nomeTabela;
        const filtros = message.filtros;

        // Simular exportação: aqui você deve implementar a lógica de exportação real
        const dadosExportados = `Dados exportados da tabela ${nomeTabela} com filtros ${JSON.stringify(filtros)}`;
        
        // Salvar arquivo de exportação
        const diretorio = process.env.DIRETORIO_ARQUIVOS || './exportacoes';
        const filePath = join(diretorio, `${exportacaoHash}.txt`);
        
        mkdirSync(diretorio, { recursive: true });
        writeFileSync(filePath, dadosExportados);

        console.log(`Exportação concluída e salva em ${filePath}`);
    } catch (error) {
        console.error('Erro ao processar exportação:', error);
    }
}

// Iniciar o consumidor
consumeQueue(processarExportacao);
