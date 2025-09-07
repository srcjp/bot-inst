const { IgApiClient } = require('instagram-private-api');
const { promises: fs } = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const SESSION_PATH = path.join(__dirname, 'session.json');

// Mapeia o dia da semana para o nome da pasta
const diasDaSemana = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

/**
 * Função para fazer login e gerenciar a sessão
 */
async function login(ig) {
  console.log('Iniciando processo de login...');
  ig.state.generateDevice(process.env.IG_USERNAME);

  try {
    // Tenta carregar a sessão existente
    if (await fileExists(SESSION_PATH)) {
      console.log('Carregando sessão existente...');
      const sessionData = await fs.readFile(SESSION_PATH, 'utf-8');
      await ig.state.deserialize(JSON.parse(sessionData));

      // Testa a sessão para ver se ainda é válida
      await ig.account.currentUser();
      console.log('Sessão carregada e válida!');
      return; // Login com sessão bem-sucedido
    }
  } catch (e) {
    console.warn(
      'Não foi possível usar a sessão salva. Fazendo login completo.',
      e.message,
    );
  }

  // Se a sessão não existir ou for inválida, faz o login com usuário/senha
  console.log(`Tentando login completo como ${process.env.IG_USERNAME}...`);
  await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
  console.log('Login com usuário/senha realizado com sucesso!');

  // Salva a nova sessão
  const serializedSession = await ig.state.serialize();
  delete serializedSession.constants; // Opcional, para reduzir o tamanho do arquivo
  await fs.writeFile(SESSION_PATH, JSON.stringify(serializedSession));
  console.log('Nova sessão foi salva.');
}

async function postarNoInstagram() {
  console.log('Iniciando o processo de postagem...');
  const ig = new IgApiClient();

  try {
    // Usa a nova função de login com gerenciamento de sessão
    await login(ig);

    // O resto do código permanece o mesmo...
    const hoje = new Date();
    const nomePastaDia = diasDaSemana[hoje.getDay()];
    console.log(`Hoje é ${nomePastaDia}. Buscando conteúdo...`);

    const caminhoBase = path.join(__dirname, 'posts', nomePastaDia);
    const arquivosNaPasta = await fs.readdir(caminhoBase);
    const arquivosDeImagem = arquivosNaPasta.filter((file) =>
      /\.(png|jpg|jpeg)$/i.test(file),
    );

    if (arquivosDeImagem.length === 0) {
      console.error(
        `Nenhuma imagem encontrada na pasta '${nomePastaDia}'. Pulando postagem.`,
      );
      return;
    }

    console.log(`Foram encontradas ${arquivosDeImagem.length} imagens.`);
    const legenda = await fs.readFile(
      path.join(caminhoBase, 'texto.txt'),
      'utf-8',
    );

    const locations = await ig.location.search({ query: 'Londrina' });
    const localizacaoLondrina =
      locations.find(
        (loc) =>
          loc.name.toLowerCase().includes('londrina') &&
          loc.name.toLowerCase().includes('pr'),
      ) || locations[0];
    console.log(`Localização encontrada: ${localizacaoLondrina.name}`);

    if (arquivosDeImagem.length === 1) {
      console.log('Publicando foto única...');
      const imagemBuffer = await fs.readFile(
        path.join(caminhoBase, arquivosDeImagem[0]),
      );
      await ig.publish.photo({
        file: imagemBuffer,
        caption: legenda,
        location: localizacaoLondrina,
      });
    } else {
      console.log('Publicando álbum/carrossel...');
      const items = await Promise.all(
        arquivosDeImagem.map(async (img) => ({
          file: await fs.readFile(path.join(caminhoBase, img)),
        })),
      );
      await ig.publish.album({
        items,
        caption: legenda,
        location: localizacaoLondrina,
      });
    }

    console.log('Post publicado com sucesso!');
  } catch (error) {
    console.error('Ocorreu um erro durante o processo:', error);
    if (error.response?.body?.message === 'checkpoint_required') {
      console.error(
        '******************************************************************',
      );
      console.error('!!! AÇÃO NECESSÁRIA: CHECKPOINT DO INSTAGRAM !!!');
      console.error('O Instagram está pedindo uma verificação de segurança.');
      console.error(
        'Acesse sua conta pelo celular ou navegador, confirme sua identidade e tente rodar o script novamente.',
      );
      console.error(
        '******************************************************************',
      );
    }
  }
}

// Função auxiliar para verificar se o arquivo de sessão existe
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Agendamento da tarefa
console.log('Script iniciado. Aguardando o horário agendado para postar...');
cron.schedule('45 6 * * *', postarNoInstagram, {
  scheduled: true,
  timezone: process.env.CRON_TIMEZONE || 'America/Sao_Paulo',
});
