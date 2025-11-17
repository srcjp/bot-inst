const { IgApiClient, IgCheckpointError } = require('instagram-private-api');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

const ig = new IgApiClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function login() {
  ig.state.generateDevice(process.env.IG_USERNAME);

  // Tenta carregar sessão existente para não gerar suspeita
  if (fs.existsSync('session.json')) {
    console.log('Carregando sessão antiga para tentar restaurar...');
    await ig.state.deserialize(JSON.parse(fs.readFileSync('session.json', 'utf8')));
  }

  console.log('Tentando logar...');
  
  try {
    await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
    console.log('Login realizado com sucesso!');
  } catch (error) {
    if (error instanceof IgCheckpointError) {
      console.log('!!! Checkpoint detectado (O Instagram pediu verificação) !!!');
      await ig.challenge.auto(true); // Tenta selecionar SMS ou Email automaticamente
      
      console.log('Verifique seu celular/email. O Instagram enviou um código.');
      
      return new Promise((resolve, reject) => {
        rl.question('Digite o código de 6 dígitos recebido: ', async (code) => {
          try {
            await ig.challenge.sendSecurityCode(code);
            console.log('Código verificado com sucesso!');
            resolve();
          } catch (e) {
            console.error('Erro ao verificar código:', e);
            reject(e);
          }
        });
      });
    } else {
      console.error('Erro desconhecido no login:', error);
      throw error;
    }
  }

  // Salva a sessão validada
  const serialized = await ig.state.serialize();
  delete serialized.constants;
  fs.writeFileSync('session.json', JSON.stringify(serialized));
  console.log('Arquivo session.json salvo com sucesso! Agora o bot pode rodar.');
  process.exit(0);
}

login();