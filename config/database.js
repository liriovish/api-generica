import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Sequelize } from 'sequelize';

// Carregar as variáveis de ambiente
dotenv.config();

let dbInstance;

const initDatabase = async () => {
    if (process.env.SIGLA_DB === 'mongodb') {
        // Conectar com MongoDB usando Mongoose
        try {
            const mongoURI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOSTNAME}/${process.env.DB_NAME}?retryWrites=true&w=majority`;

            await mongoose.connect(mongoURI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });

            console.log('Conexão com MongoDB Atlas realizada com sucesso!');
            dbInstance = mongoose;
        } catch (error) {
            console.error('Erro ao conectar ao MongoDB:', error);
            throw error;  // Lançar erro para interromper a execução
        }
    } else {
        // Conectar com MySQL usando Sequelize
        try {
            dbInstance = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
                host: process.env.DB_HOSTNAME,
                port: process.env.DB_PORT,
                dialect: process.env.SIGLA_DB,
                logging: false,  // Desabilita logs do Sequelize
            });

            // Testa a conexão com o banco de dados MySQL
            await dbInstance.authenticate();
            console.log('Conexão com MySQL realizada com sucesso!');
        } catch (error) {
            console.error('Erro ao conectar ao MySQL:', error);
            throw error;  // Lançar erro para interromper a execução
        }
    }

    return dbInstance;
};

// Função para obter a instância do banco de dados
const getDatabase = () => dbInstance;

export default { initDatabase, getDatabase };
