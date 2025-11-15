import walletsArray from './data/wallets.js';
import { generatePublic, generateWIF } from './utils/index.js';
import chalk from 'chalk';
import fs from 'fs';

const walletsSet = new Set(walletsArray);

async function encontrarBitcoins(key, min, max) {
    let segundos = 0;
    const startTime = Date.now();
    const zeroes = Array.from({ length: 65 }, (_, i) => '0'.repeat(64 - i));

    console.log('Buscando Bitcoins...');

    let running = true;
    let lastLogTime = 0;
    const executeLoop = async () => {
        while (running) {
            key++;
            let pkey = key.toString(16);
            pkey = `${zeroes[pkey.length]}${pkey}`;

            const currentTime = Date.now();
            if (currentTime - lastLogTime >= 1000) {
                lastLogTime = currentTime;
                const tempoDecorrido = (currentTime - startTime) / 1000;

                if (tempoDecorrido % 10 === 0) {
                    console.clear();
                    console.log('Resumo: ');
                    console.log('Velocidade:', (Number(key) - Number(min)) / tempoDecorrido, ' chaves por segundo');
                    console.log('Chaves buscadas: ', (Number(key) - Number(min)).toLocaleString('pt-BR'));
                    console.log('Ultima chave tentada: ', pkey);

                    const filePath = 'Ultima_chave.txt';
                    const content = `Ultima chave tentada: ${pkey}`;
                    try {
                        fs.writeFileSync(filePath, content, 'utf8');
                    } catch (err) {
                        console.error('Erro ao escrever no arquivo:', err);
                    }
                } else {
                    console.log(tempoDecorrido);
                }
            }

            let publicKey = generatePublic(pkey);
            if (walletsSet.has(publicKey)) {
                const tempoTotal = (Date.now() - startTime) / 1000;
                console.log('Velocidade:', (Number(key) - Number(min)) / tempoTotal, ' chaves por segundo');
                console.log('Tempo:', tempoTotal, ' segundos');
                console.log('Private key:', chalk.green(pkey));
                console.log('WIF:', chalk.green(generateWIF(pkey)));

                const filePath = 'keys.txt';
                const lineToAppend = `Private key: ${pkey}, WIF: ${generateWIF(pkey)}\n`;

                try {
                    fs.appendFileSync(filePath, lineToAppend);
                    console.log('Chave escrita no arquivo com sucesso.');
                } catch (err) {
                    console.error('Erro ao escrever chave em arquivo:', err);
                }

                console.log('ACHEI!!!! 🎉🎉🎉🎉🎉');
                running = false;
            }

            // Reduz overhead ao invés de remover - evita starvation
            if (Number(key) % 10000 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
    };

    try {
        await executeLoop();
    } catch (err) {
        console.error('Erro inesperado:', err);
        running = false;
    }

    console.log('Processo interrompido ou concluído.');
}

export default encontrarBitcoins;
