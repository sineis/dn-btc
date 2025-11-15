import { parentPort } from 'worker_threads';
import walletsArray from './data/wallets.js';
import { generatePublic, generateWIF } from './utils/index.js';
import chalk from 'chalk';
import fs from 'fs';

const walletsSet = new Set(walletsArray);

async function encontrarBitcoinsWorker(key, min, max, workerData) {
    const startTime = Date.now();
    const zeroes = Array.from({ length: 65 }, (_, i) => '0'.repeat(64 - i));
    const totalChaves = BigInt(max) - BigInt(min) + BigInt(1);
    const blocoId = workerData.blocoId;
    const testadas = new Map(); // Usar Map ao invés de Set para melhor performance
    let chavesVerificadas = 0;
    const maxTestadasSize = 500_000; // Reduzir tamanho máximo
    let lastLogTime = 0;

    console.log(`Worker para Bloco ${blocoId}: Buscando Bitcoins de forma aleatória...`);

    let running = true;
    const executeLoop = async () => {
        while (running) {
            if (workerData.found) {
                console.log(`Worker para Bloco ${blocoId}: Busca interrompida - chave encontrada em outro processo.`);
                return;
            }

            try {
                const randomOffset = BigInt(Math.floor(Math.random() * Number(totalChaves)));
                key = BigInt(min) + randomOffset;

                let pkey = key.toString(16);
                pkey = `${zeroes[pkey.length]}${pkey}`;

                if (testadas.has(pkey)) {
                    chavesVerificadas++;
                } else {
                    testadas.set(pkey, true);
                    chavesVerificadas++;
                }

                // Limpar cache quando ultrapassar limite
                if (testadas.size > maxTestadasSize) {
                    let count = 0;
                    for (const [k] of testadas) {
                        if (count >= maxTestadasSize / 2) break;
                        testadas.delete(k);
                        count++;
                    }
                }

                const currentTime = Date.now();
                if (currentTime - lastLogTime >= 1000) {
                    lastLogTime = currentTime;
                    const tempoDecorrido = (currentTime - startTime) / 1000;
                    const progressoPercentual = (chavesVerificadas * 100) / Number(totalChaves);

                    console.log(`Worker para Bloco ${chalk.blue(blocoId)}: ${chalk.yellow(tempoDecorrido.toFixed(1))}s | Progresso: ${chalk.red(progressoPercentual.toFixed(2))}% | Vel: ${(chavesVerificadas / tempoDecorrido).toFixed(0)} ch/s`);

                    if (Math.floor(tempoDecorrido) % 10 === 0 && Math.floor(tempoDecorrido) > 0) {
                        console.clear();
                        console.log(`Worker para Bloco ${blocoId}: Resumo:`);
                        console.log('Velocidade:', (chavesVerificadas / tempoDecorrido).toFixed(2), ' chaves por segundo');
                        console.log('Chaves buscadas: ', chavesVerificadas.toLocaleString('pt-BR'));
                        console.log('Ultima chave tentada: ', pkey);

                        const filePath = `Ultima_chave_bloco_${blocoId}.txt`;
                        const content = `Ultima chave tentada: ${pkey}`;
                        try {
                            fs.writeFileSync(filePath, content, 'utf8');
                        } catch (err) {
                            console.error('Erro ao escrever no arquivo:', err);
                        }
                    }
                }

                let publicKey = generatePublic(pkey);
                if (walletsSet.has(publicKey)) {
                    const tempoTotal = (Date.now() - startTime) / 1000;
                    console.log(`Worker para Bloco ${blocoId}: Velocidade:`, (chavesVerificadas / tempoTotal).toFixed(2), ' chaves por segundo');
                    console.log(`Worker para Bloco ${blocoId}: Tempo:`, tempoTotal.toFixed(2), ' segundos');
                    console.log(`Worker para Bloco ${blocoId}: Private key:`, chalk.green(pkey));
                    console.log(`Worker para Bloco ${blocoId}: WIF:`, chalk.green(generateWIF(pkey)));

                    const filePath = 'keys.txt';
                    const lineToAppend = `Worker para Bloco ${blocoId}: Private key: ${pkey}, WIF: ${generateWIF(pkey)}\n`;

                    try {
                        fs.appendFileSync(filePath, lineToAppend);
                        console.log(`Worker para Bloco ${blocoId}: Chave escrita no arquivo com sucesso.`);
                    } catch (err) {
                        console.error(`Worker para Bloco ${blocoId}: Erro ao escrever chave em arquivo:`, err);
                    }

                    console.log(`Worker para Bloco ${blocoId}: ACHEI!!!! 🎉🎉🎉🎉🎉`);
                    workerData.found = true;
                    parentPort.postMessage({ found: true });
                    running = false;
                }

                // Reduzir overhead - menos setImmediate
                if (chavesVerificadas % 5000 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            } catch (err) {
                console.error(`Worker para Bloco ${blocoId}: Erro no loop:`, err);
                running = false;
            }
        }
    };

    try {
        await executeLoop();
    } catch (err) {
        console.error(`Worker para Bloco ${blocoId}: Erro inesperado:`, err);
        running = false;
    }

    console.log(`Worker para Bloco ${blocoId}: Processo interrompido ou concluído.`);
    parentPort.postMessage({ completed: true, blocoId });
}

parentPort.on('message', (workerData) => {
    try {
        const { key, min, max } = workerData;
        if (key == null || min == null || max == null) {
            console.error('Dados inválidos recebidos pelo worker');
            parentPort.postMessage({ error: true });
            return;
        }
        encontrarBitcoinsWorker(BigInt(key), BigInt(min), BigInt(max), workerData);
    } catch (err) {
        console.error('Erro ao processar mensagem do worker:', err);
        parentPort.postMessage({ error: true });
    }
});
