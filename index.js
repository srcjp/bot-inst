const { IgApiClient } = require('instagram-private-api');
const { promises: fs } = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

// Mapeia o número do dia da semana (0=Domingo, 1=Segunda...) para o nome da pasta
const diasDaSemana = [
    'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'
];

async function postarNoInstagram() {
    console.log('Iniciando o processo de postagem...');

    const ig = new IgApiClient();
    ig.state.generateDevice(process.env.IG_USERNAME);

    try {
        // 1. Fazendo login
        console.log(`Tentando login como ${process.env.IG_USERNAME}...`);
        await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
        console.log('Login realizado com sucesso!');

        // 2. Preparando o conteúdo do dia
        const hoje = new Date();
        const nomePastaDia = diasDaSemana[hoje.getDay()];
        console.log(`Hoje é ${nomePastaDia}. Buscando conteúdo...`);

        const caminhoBase = path.join(__dirname, 'posts', nomePastaDia);
        const caminhoTexto = path.join(caminhoBase, 'texto.txt');

        // Lê todos os arquivos da pasta do dia
        const arquivosNaPasta = await fs.readdir(caminhoBase);
        // Filtra para pegar apenas as imagens (png, jpg, jpeg)
        const arquivosDeImagem = arquivosNaPasta.filter(file => 
            /\.(png|jpg|jpeg)$/i.test(file)
        );

        if (arquivosDeImagem.length === 0) {
            console.error(`Nenhuma imagem (.png, .jpg, .jpeg) encontrada na pasta '${nomePastaDia}'. Pulando postagem de hoje.`);
            return;
        }

        console.log(`Foram encontradas ${arquivosDeImagem.length} imagens para postar.`);

        // Lê a legenda (que é a mesma para todas as imagens)
        const legenda = await fs.readFile(caminhoTexto, 'utf-8');
        
        console.log('Conteúdo do dia carregado.');

        // 3. Buscando a localização de Londrina
        console.log('Buscando ID de localização para Londrina - PR...');
        const locations = await ig.location.search({ query: 'Londrina' });
        
        let localizacaoLondrina = null;
        if (locations && locations.length > 0) {
            localizacaoLondrina = locations.find(loc => loc.name.toLowerCase().includes('londrina') && loc.name.toLowerCase().includes('pr')) || locations[0];
            console.log(`Localização encontrada: ${localizacaoLondrina.name} (ID: ${localizacaoLondrina.external_id})`);
        } else {
            console.warn('Não foi possível encontrar a localização de Londrina.');
        }

        // 4. Publicando o post (lógica de foto única ou álbum)
        if (arquivosDeImagem.length === 1) {
            // Post de foto única
            console.log('Publicando um post de foto única...');
            const imagemBuffer = await fs.readFile(path.join(caminhoBase, arquivosDeImagem[0]));
            await ig.publish.photo({
                file: imagemBuffer,
                caption: legenda,
                location: localizacaoLondrina,
            });
        } else {
            // Post de álbum (carrossel)
            console.log('Publicando um post em formato de álbum/carrossel...');
            const items = await Promise.all(
                arquivosDeImagem.map(async (imagem) => {
                    const fileBuffer = await fs.readFile(path.join(caminhoBase, imagem));
                    return { file: fileBuffer };
                })
            );

            await ig.publish.album({
                items: items,
                caption: legenda,
                location: localizacaoLondrina,
            });
        }

        console.log('Post publicado com sucesso!');

    } catch (error) {
        console.error('Ocorreu um erro durante o processo:', error);
        if (error.response && error.response.body && error.response.body.message === 'checkpoint_required') {
            console.error('O Instagram está pedindo uma verificação de segurança. Acesse sua conta pelo navegador ou app para resolver.');
            console.error('URL para verificação:', error.response.body.checkpoint_url);
        }
    }
}

// Agendamento da tarefa (Cron Job)
console.log('Script iniciado. Aguardando o horário agendado para postar...');
cron.schedule('30 6 * * *', postarNoInstagram, {
    scheduled: true,
    timezone: process.env.CRON_TIMEZONE || "America/Sao_Paulo",
});

// Opcional: Descomente a linha abaixo para executar uma vez ao iniciar o script para teste
// console.log('Executando uma vez para teste inicial...');
// postarNoInstagram();