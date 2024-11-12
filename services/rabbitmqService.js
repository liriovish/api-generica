import dotenv from 'dotenv';
import { connect as _connect } from 'amqplib';

dotenv.config();
let connection;
let channel;

// Configura��es do RabbitMQ
const rabbitConfig = {
    protocol: 'amqp',
    hostname: process.env.HOST_RABBITMQ,
    port: process.env.PORT_RABBITMQ,
    username: process.env.USER_RABBITMQ,
    password: process.env.PASS_RABBITMQ
};

// Fun��o para conectar ao RabbitMQ
async function connect() {
    try {
        connection = await _connect(rabbitConfig);
        channel = await connection.createChannel();
        await channel.assertQueue(process.env.NOME_FILA_RABBITMQ, { durable: true });
        console.log('Conectado ao RabbitMQ com sucesso.');
    } catch (error) {
        console.error('Erro ao conectar ao RabbitMQ:', error);
    }
}

// Fun��o para enviar mensagem para a fila
async function sendToQueue(message) {
    if (!channel) {
        await connect();
    }
    channel.sendToQueue(process.env.NOME_FILA_RABBITMQ, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log('Mensagem enviada para a fila:', message);
}

// Encerrar a conex�o ao fechar a aplica��o
process.on('exit', () => {
    if (connection) connection.close();
});

export  { connect, sendToQueue };
