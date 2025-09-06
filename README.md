# Instagram Daily Poster

Um script em Node.js que roda dentro de um container Docker para postar automaticamente no Instagram todos os dias às 6h da manhã. O conteúdo (imagem/imagens e texto) é selecionado de pastas correspondentes ao dia da semana.

## Funcionalidades

- **Postagem Flexível**: Publica uma única imagem ou múltiplas imagens como um post de carrossel (álbum), dependendo de quantos arquivos de imagem são encontrados.
- **Conteúdo Diário**: Seleciona o conteúdo de uma pasta específica para cada dia da semana (ex: `segunda`, `terca`, etc.).
- **Agendamento**: A postagem é agendada para ocorrer todos os dias às 6:00 da manhã (fuso horário configurável).
- **Localização Automática**: Marca automaticamente a localização como "Londrina, PR" em todas as postagens.
- **Ambiente Isolado**: Roda em um container Docker, otimizado para arquitetura ARM64 (Oracle Cloud Free Tier).

## Aviso de Risco

A automação de interações com o Instagram viola seus Termos de Serviço. O uso deste script pode resultar no bloqueio temporário ou banimento permanente da sua conta. **Use por sua conta e risco.**

## Pré-requisitos

- [Docker](https://www.docker.com/) instalado na máquina host (Oracle Cloud VM).
- Uma conta no Instagram.

## Estrutura de Pastas

O conteúdo a ser postado deve seguir a estrutura abaixo. Para cada dia, pode haver um ou mais arquivos de imagem (`.png`, `.jpg`, `.jpeg`) e um único arquivo de texto para a legenda.

```
posts/
├── domingo/
│   ├── alguma_imagem.png
│   └── texto.txt
├── segunda/
│   ├── post1.jpg
│   ├── post2.png
│   └── texto.txt
...e assim por diante para todos os dias.
```

- Se for encontrada apenas uma imagem, será feito um post de foto única.
- Se forem encontradas várias imagens, elas serão publicadas juntas em um único post de carrossel.

## Configuração

1.  **Clone o repositório** ou crie os arquivos conforme a estrutura.
2.  **Preencha as pastas de cada dia** com suas imagens e o arquivo de legenda (`texto.txt`).
3.  **Crie e edite o arquivo `.env`** com suas credenciais do Instagram e o fuso horário:

    ```env
    IG_USERNAME=SEU_USUARIO_AQUI
    IG_PASSWORD=SUA_SENHA_AQUI
    CRON_TIMEZONE="America/Sao_Paulo"
    ```

## Como Rodar

Siga os passos abaixo no terminal da sua máquina virtual.

1.  **Construa a imagem Docker (ou reconstrua, caso já exista):**

    ```bash
    docker build -t instagram-poster .
    ```

2.  **Execute o container Docker em modo "detached" (em segundo plano):**
    Se você já tem um container com o nome `meu-poster` rodando, precisa pará-lo e removê-lo primeiro: `docker stop meu-poster && docker rm meu-poster`.
    ```bash
    docker run -d --name meu-poster --restart always --env-file .env instagram-poster
    ```

## Comandos Úteis do Docker

- **Verificar os logs do container:**

  ```bash
  docker logs -f meu-poster
  ```

- **Parar o container:**

  ```bash
  docker stop meu-poster
  ```

- **Remover o container:**
  ```bash
  docker rm meu-poster
  ```
