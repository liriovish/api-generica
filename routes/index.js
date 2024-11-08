import express from 'express';
import * as Controller from '../controllers/Controller.js';  // Ajuste o caminho conforme necessário

const router = express.Router();

// Rota GET /v1/tabelas
router.get('/v1/tabelas', Controller.listarTabelas);

// Rota GET /v1/listagem
router.get('/v1/listagem', Controller.listarDados);

// Rota POST /v1/exportacao
router.post('/v1/exportacao', Controller.solicitarExportacao);

// Rota GET /v1/exportacao
router.get('/v1/exportacao', Controller.listarExportacoes);

// Rota GET /v1/exportacao/:hashExportacao
router.get('/v1/exportacao/:hashExportacao', Controller.obterExportacao);

// Rota GET /v1/download/:hashExportacao
router.get('/v1/download/:hashExportacao', Controller.baixarArquivo);

// Rota DELETE /v1/exportacao/:hashExportacao
router.delete('/v1/exportacao/:hashExportacao', Controller.excluirExportacao);

export default router;
