import chalk from 'chalk';
import os from 'os';
import { Worker } from 'worker_threads';
import {
    fazerPergunta, rl,
    escolherCarteira,
    escolherMinimo,
    escolherPorcentagem,
    escolherPorcentagemBlocos
} from './utils/index.js';
import encontrarBitcoins from './bitcoin-find.js';
import { iniciarInterfaceWeb } from '../web-interface/app.js';

function titulo() {
    console.log("\x1b[38;2;250;128;114m" + "╔════════════════════════════════════════════════════════╗\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "   ____ _____ ____   _____ ___ _   _ ____  _____ ____   " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "  | __ )_   _/ ___| |  ___|_ _| \\ | |  _ \\| ____|  _ \\  " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "  |  _ \\ | || |     | |_   | ||  \\| | | | |  _| | |_) | " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "  | |_) || || |___  |  _|  | || |\\  | |_| | |___|  _ <  " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "  |____/ |_| \\____| |_|   |___|_| \\_|____/|_____|_| \\_\\ " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "║" + "\x1b[0m" + "\x1b[36m" + "                                                        " + "\x1b[0m" + "\x1b[38;2;250;128;114m" + "║\n" +
        "╚══════════════════════\x1b[32m" + "Investidor Internacional - v0.8" + "\x1b[0m\x1b[38;2;250;128;114m═══╝" + "\x1b[0m");
}

// Função refatorada para criar workers - ÚNICA DEFINIÇÃO
const criarWorker = (bloco, blocoId, isRandom = false) => {
    return new Promise((resolve, reject) => {
        try {
            const worker = new Worker('./src/worker.js');
            const messageData = {
                key: bloco.inicio,
                min: bloco.inicio,
                max: bloco.fim,
                blocoId,
                found: false,
                ...(isRandom && { random: true })
            };

            worker.postMessage(messageData);

            let completed = false;

            worker.on('message', (message) => {
                if (message.found) {
                    completed = true;
                    worker.terminate();
                    resolve();
                } else if (message.completed) {
                    console.log(`Bloco ${message.blocoId} completado sem encontrar chave.`);
                    completed = true;
                    resolve();
                }
            });

            worker.on('error', (error) => {
                console.error(`Erro no worker ${blocoId}:`, error);
                if (!completed) {
                    completed = true;
                    reject(error);
                }
            });

            worker.on('exit', (code) => {
                if (!completed) {
                    completed = true;
                    if (code !== 0) {
                        reject(new Error(`Worker ${blocoId} exited with code ${code}`));
                    } else {
                        resolve();
                    }
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};

async function menu() {
    let [min, max, key] = await escolherCarteira(`Escolha uma carteira puzzle( ${chalk.cyan(1)} - ${chalk.cyan(161)}): `);
    const answer = await fazerPergunta(`Escolha uma opcao (${chalk.cyan(1)} - Comecar do inicio, ${chalk.cyan(2)} - Escolher uma porcentagem, ${chalk.cyan(3)} - Escolher minimo, ${chalk.cyan(4)} - Dividir em blocos, ${chalk.cyan(5)} - Dividir em blocos (Randomico)): `);

    try {
        switch (answer) {
            case '1':
                try {
                    key = BigInt(min);
                    rl.close();
                    await encontrarBitcoins(key, min, max);
                } catch (err) {
                    console.error('Erro ao processar opção 1:', err);
                }
                break;

            case '2':
                try {
                    [min, max, key] = await escolherPorcentagem(min, max);
                    rl.close();
                    await encontrarBitcoins(key, min, max);
                } catch (err) {
                    console.error('Erro ao processar opção 2:', err);
                }
                break;

            case '3':
                try {
                    [min, key] = await escolherMinimo(min);
                    rl.close();
                    await encontrarBitcoins(key, min, max);
                } catch (err) {
                    console.error('Erro ao processar opção 3:', err);
                }
                break;

            case '4':
                try {
                    const numCPUs = os.cpus().length;
                    const numBlocos = parseInt(await fazerPergunta(`Digite o número de blocos para dividir o intervalo (ou pressione Enter para usar ${numCPUs} blocos, com base no número de CPUs disponíveis): `)) || numCPUs;
                    const blocos = await escolherPorcentagemBlocos(min, max, numBlocos);
                    rl.close();

                    const promises = blocos.map((bloco, index) => criarWorker(bloco, index + 1, false));

                    await Promise.allSettled(promises);
                    console.log('Processamento de blocos concluído.');
                } catch (err) {
                    console.error('Erro ao processar opção 4:', err);
                }
                break;

            case '5':
                try {
                    const numCPUsRandom = os.cpus().length;
                    const numBlocosRandom = parseInt(await fazerPergunta(`Digite o número de blocos para dividir o intervalo (ou pressione Enter para usar ${numCPUsRandom} blocos, com base no número de CPUs disponíveis): `)) || numCPUsRandom;
                    const blocosRandom = await escolherPorcentagemBlocos(min, max, numBlocosRandom);
                    rl.close();

                    const promisesRandom = blocosRandom.map((bloco, index) => criarWorker(bloco, index + 1, true));

                    await Promise.allSettled(promisesRandom);
                    console.log('Processamento de blocos aleatório concluído.');
                } catch (err) {
                    console.error('Erro ao processar opção 5:', err);
                }
                break;

            default:
                console.log("Opção inválida. Por favor, escolha uma das opções disponíveis.");
                rl.close();
                break;
        }
    } catch (err) {
        console.error('Erro no menu:', err);
        if (!rl.closed) {
            rl.close();
        }
    }
}

async function main() {
    console.clear();
    titulo();
    await iniciarInterfaceWeb(rl);
    await menu();
}

main().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
});

rl.on('SIGINT', () => {
    console.log("\nFechando Programa!");
    if (!rl.closed) {
        rl.close();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log("\nFechando Programa!");
    if (!rl.closed) {
        rl.close();
    }
    process.exit(0);
});
