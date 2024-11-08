import express from 'express';
import * as exportacaoController from '../controllers/exportacaoController.js';  // Ajuste o caminho conforme necessário

const router = express.Router();

// Rota GET /v1/tabelas
router.get('/v1/tabelas', exportacaoController.listarTabelas);

// Rota GET /v1/listagem
router.get('/v1/listagem', exportacaoController.listarDados);

// Rota POST /v1/exportacao
router.post('/v1/exportacao', exportacaoController.solicitarExportacao);

// Rota GET /v1/exportacao
router.get('/v1/exportacao', exportacaoController.listarExportacoes);

// Rota GET /v1/exportacao/:hashExportacao
router.get('/v1/exportacao/:hashExportacao', exportacaoController.obterExportacao);

// Rota GET /v1/download/:hashExportacao
router.get('/v1/download/:hashExportacao', exportacaoController.baixarArquivo);

// Rota DELETE /v1/exportacao/:hashExportacao
router.delete('/v1/exportacao/:hashExportacao', exportacaoController.excluirExportacao);

export default router;
