import express from 'express';
import router from './routes/index.js';  
import db from './config/database.js';  // Assumindo que o código do banco está em ./config/database.js

const app = express();

// Middleware para parse de JSON
app.use(express.json());
app.use(router);

// Função para testar a conexão com o banco de dados
const testConnection = async () => {
  try {
    await db.initDatabase();  // Inicializa a conexão com o banco de dados
    console.log('Conexão com o banco de dados bem-sucedida!');
    
    // Após a conexão ser bem-sucedida, iniciar o servidor
    app.listen(3000, () => {
      console.log('Servidor rodando na porta 3000');
    });
    
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
    process.exit(1);  // Se houver erro na conexão, encerra o processo
  }
};

// Testa a conexão com o banco de dados antes de iniciar o servidor
testConnection();
