const { IgApiClient } = require('instagram-private-api');
const { promises: fs } = require('fs');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const SESSION_PATH = path.join(__dirname, 'session.json');
const diasDaSemana = [
  'domingo',
  'segunda',
  'terca',
  'quarta',
  'quinta',
  'sexta',
  'sabado',
];

let postDeHojeFeito = false;
let ultimoDiaPostado = -1;

async function login(ig) {
  console.log('Iniciando processo de login...');
  ig.state.generateDevice(process.env.IG_USERNAME);

  try {
    if (await fileExists(SESSION_PATH)) {
      console.log('Carregando sessão existente...');
      const sessionData = await fs.readFile(SESSION_PATH, 'utf-8');
      await ig.state.deserialize(JSON.parse(sessionData));
      await ig.account.currentUser();
      console.log('Sessão carregada e válida!');
      return;
    }
  } catch (e) {
    console.warn(
      'Não foi possível usar a sessão salva. Deletando arquivo de sessão...',
    );
    // Se a sessão está corrompida ou expirada, deleta o arquivo para forçar um novo login.
    if (await fileExists(SESSION_PATH)) {
      await fs.unlink(SESSION_PATH);
    }
  }

  console.log(`Tentando login completo como ${process.env.IG_USERNAME}...`);
  await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
  console.log('Login com usuário/senha realizado com sucesso!');

  const serializedSession = await ig.state.serialize();
  delete serializedSession.constants;
  await fs.writeFile(SESSION_PATH, JSON.stringify(serializedSession));
  console.log('Nova sessão foi salva.');
}

async function postarNoInstagram() {
  const hoje = new Date(); // Definido aqui para usar no catch
  console.log('Iniciando o processo de postagem...');
  const ig = new IgApiClient();

  try {
    await login(ig);

    const nomePastaDia = diasDaSemana[hoje.getDay()];
    console.log(`Hoje é ${nomePastaDia}. Buscando conteúdo...`);

    const caminhoBase = path.join(__dirname, 'posts', nomePastaDia);
    // ... (o resto da lógica de postagem continua a mesma)
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
    postDeHojeFeito = true;
    ultimoDiaPostado = hoje.getDay();
  } catch (error) {
    console.error(
      'Ocorreu um erro durante o processo:',
      error.constructor.name,
    );
    // *** LÓGICA DE ERRO MELHORADA ***
    if (
      error.name === 'IgCheckpointError' ||
      error.name === 'IgResponseError'
    ) {
      console.error(
        '******************************************************************',
      );
      console.error('!!! ERRO DE LOGIN DETECTADO PELO INSTAGRAM !!!');
      console.error(
        'A conta pode estar bloqueada por um checkpoint. Verifique sua conta no app ou navegador.',
      );
      console.error(
        'O script NÃO tentará postar novamente hoje para proteger sua conta.',
      );
      console.error(
        '******************************************************************',
      );

      // Trava as tentativas para o resto do dia para evitar bloqueios.
      postDeHojeFeito = true;
      ultimoDiaPostado = hoje.getDay();
    } else {
      console.error('Ocorreu um erro inesperado:', error);
    }
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

cron.schedule('* * * * *', () => {
  const agora = new Date();
  const horaSP = parseInt(
    agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }),
  );
  const minutoSP = parseInt(
    agora.toLocaleTimeString('pt-BR', {
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }),
  );
  const diaDaSemanaSP = agora.getDay();

  if (diaDaSemanaSP !== ultimoDiaPostado) {
    postDeHojeFeito = false;
  }

  if (horaSP === 6 && minutoSP === 30 && !postDeHojeFeito) {
    console.log('Hora correta! (6:30). Iniciando postagem...');
    postarNoInstagram();
  }
});

console.log(
  'Script iniciado. O agendador está rodando e vai verificar a hora a cada minuto.',
);
console.log(`Horário atual do container: ${new Date().toString()}`);
