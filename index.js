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
let ultimoDiaVerificado = -1; // Usamos para saber quando o dia mudou

async function login(ig) {
  // A função de login continua a mesma
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
      'Sessão inválida ou expirada. Deletando arquivo para forçar novo login...',
    );
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
  const hoje = new Date();
  console.log('Iniciando o processo de postagem...');
  const ig = new IgApiClient();
  try {
    await login(ig);
    const nomePastaDia = diasDaSemana[hoje.getDay()];
    console.log(`Hoje é ${nomePastaDia}. Buscando conteúdo...`);
    const caminhoBase = path.join(__dirname, 'posts', nomePastaDia);
    const arquivosNaPasta = await fs.readdir(caminhoBase);
    const arquivosDeImagem = arquivosNaPasta.filter((file) =>
      /\.(png|jpg|jpeg)$/i.test(file),
    );
    if (arquivosDeImagem.length === 0) {
      console.error(`Nenhuma imagem encontrada na pasta '${nomePastaDia}'.`);
      return;
    }
    const legenda = await fs.readFile(
      path.join(caminhoBase, 'texto.txt'),
      'utf-8',
    );
    const locations = await ig.location.search({ query: 'Londrina' });
    const localizacaoLondrina =
      locations.find((loc) => loc.name.toLowerCase().includes('londrina')) ||
      locations[0];
    if (arquivosDeImagem.length === 1) {
      const imagemBuffer = await fs.readFile(
        path.join(caminhoBase, arquivosDeImagem[0]),
      );
      await ig.publish.photo({
        file: imagemBuffer,
        caption: legenda,
        location: localizacaoLondrina,
      });
    } else {
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
  } catch (error) {
    console.error(
      'Ocorreu um erro crítico durante o processo de postagem:',
      error.constructor.name,
    );
    if (
      error.name === 'IgCheckpointError' ||
      error.name === 'IgResponseError'
    ) {
      console.error(
        'ERRO DE LOGIN: O Instagram bloqueou a tentativa. Verifique a conta e reinicie o container.',
      );
    } else {
      console.error('Erro inesperado:', error);
    }
    // Mesmo em caso de erro, travamos a postagem do dia para evitar loops.
    postDeHojeFeito = true;
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

// Roda a cada minuto para verificar a hora
cron.schedule('* * * * *', () => {
  const agora = new Date();
  const agoraSP = new Date(
    agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  );

  const hora = agoraSP.getHours();
  const minuto = agoraSP.getMinutes();
  const dia = agoraSP.getDay();

  // Lógica para reiniciar o controle no começo de um novo dia
  if (dia !== ultimoDiaVerificado) {
    console.log(
      `--- NOVO DIA DETECTADO (${diasDaSemana[dia]})! Reiniciando controle de postagem. ---`,
    );
    postDeHojeFeito = false;
    ultimoDiaVerificado = dia;
  }

  // Log de diagnóstico a cada 15 minutos para sabermos que o script está vivo
  if (minuto % 15 === 0) {
    console.log(
      `[LOG DE STATUS] Hora SP: ${hora}:${minuto}. Post de hoje já foi feito: ${postDeHojeFeito}.`,
    );
  }

  // Condição para postar: Hora é 6, minuto está entre 30 e 35, e post ainda não foi feito
  if (hora === 6 && minuto >= 30 && minuto < 35 && !postDeHojeFeito) {
    console.log(
      `===> JANELA DE POSTAGEM ATIVA (6:30-6:35)! Iniciando postagem...`,
    );
    postarNoInstagram();
  }
});

console.log('>>> Script iniciado com sucesso! <<<');
console.log(`Horário do container no boot: ${new Date().toString()}`);
