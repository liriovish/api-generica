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

// Fun��o para consumir mensagens da fila
async function consumeQueue(callback) {
    // Conecta e assegura que o canal est� configurado
    if (!channel) {
        await connect();
    }

    // Come�a a consumir mensagens da fila
    channel.consume(process.env.NOME_FILA_RABBITMQ, async (msg) => {
        if (msg !== null) {
            try {
                // Converte o conte�do da mensagem e passa para o callback
                const messageContent = JSON.parse(msg.content.toString());
                console.log('Mensagem recebida da fila:', messageContent);

                // Executa o callback para processar a mensagem
                await callback(messageContent);

                // Confirma que a mensagem foi processada
                channel.ack(msg);
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
                // Caso haja um erro, a mensagem n�o � confirmada, e o RabbitMQ a reentrega
            }
        }
    });
}

// Encerrar a conex�o ao fechar a aplica��o
process.on('exit', () => {
    if (connection) connection.close();
});

export  { connect, sendToQueue, consumeQueue };
