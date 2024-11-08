import express from 'express';
import router from './routes/index.js';  
import db from './config/database.js';  // Assumindo que o c�digo do banco est� em ./config/database.js

const app = express();

// Middleware para parse de JSON
app.use(express.json());
app.use(router);

// Fun��o para testar a conex�o com o banco de dados
const testConnection = async () => {
  try {
    await db.initDatabase();  // Inicializa a conex�o com o banco de dados
    console.log('Conex�o com o banco de dados bem-sucedida!');
    
    // Ap�s a conex�o ser bem-sucedida, iniciar o servidor
    app.listen(3000, () => {
      console.log('Servidor rodando na porta 3000');
    });
    
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    process.exit(1);  // Se houver erro na conex�o, encerra o processo
  }
};

// Testa a conex�o com o banco de dados antes de iniciar o servidor
testConnection();
