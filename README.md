# Academia com Pagamentos

Sistema web para gerenciamento de assinaturas de uma academia, desenvolvido com Node.js, Express, Supabase e Stripe. A aplicação implementa um fluxo completo de pagamentos recorrentes, autenticação de usuários e sincronização automática das assinaturas por meio de Webhooks.

## Visão Geral

O projeto simula uma plataforma de academia onde usuários podem criar uma conta, contratar um plano mensal e ter o status da assinatura atualizado automaticamente após o processamento do pagamento pelo Stripe.

A aplicação foi desenvolvida utilizando uma arquitetura cliente-servidor, separando responsabilidades entre interface, regras de negócio, integração com serviços externos e persistência de dados.

## Principais Funcionalidades

- Cadastro e autenticação de usuários
- Gerenciamento da conta do usuário
- Contratação de plano mensal via Stripe Checkout
- Processamento automático de pagamentos
- Integração com Stripe Webhooks
- Ativação automática da assinatura após confirmação do pagamento
- Cancelamento automático de assinaturas
- Persistência de dados utilizando Supabase
- Validação de dados de entrada
- Tratamento centralizado de erros
- Deploy em ambiente de produção

## Tecnologias

### Front-end

- HTML5
- CSS3
- JavaScript

### Back-end

- Node.js
- Express.js

### Banco de Dados

- Supabase

### Pagamentos

- Stripe Checkout
- Stripe Webhooks

### Ferramentas

- Git
- GitHub
- Render

## Arquitetura

```
Cliente (Browser)
        │
        ▼
Frontend (HTML, CSS, JavaScript)
        │
        ▼
Express API
        │
        ├──────────────► Stripe Checkout
        │                     │
        │                     ▼
        │              Processamento do pagamento
        │                     │
        │                     ▼
        │              Stripe Webhooks
        │                     │
        ▼                     │
Supabase ◄────────────────────┘
```

## Fluxo de Funcionamento

1. O usuário realiza login na plataforma.
2. Seleciona um plano disponível.
3. O backend cria uma sessão do Stripe Checkout.
4. O usuário conclui o pagamento.
5. O Stripe envia um Webhook para a aplicação.
6. O backend valida a assinatura do evento recebido.
7. O Supabase é atualizado automaticamente.
8. A assinatura do usuário passa a ficar ativa.

## Estrutura do Projeto

```
Academia-com-Pagamentos
│
├── public/
│   ├── auth.js
│   ├── conta.js
│   ├── pagamento.js
│   ├── script.js
│   ├── supabase.js
│   ├── index.html
│   ├── login.html
│   ├── minha-conta.html
│   ├── sucesso.html
│   ├── cancelado.html
│   ├── style.css
│   ├── sucesso.css
│   └── cancelado.css
│
├── server.js
├── supabaseClient.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto.

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
BASE_URL=http://localhost:3000
```

## Instalação

Clone o repositório.

```bash
git clone https://github.com/murilotecoteco/Academia-com-Pagamentos.git
```

Entre na pasta do projeto.

```bash
cd Academia-com-Pagamentos
```

Instale as dependências.

```bash
npm install
```

Configure as variáveis de ambiente.

Inicie a aplicação.

```bash
npm start
```

A aplicação estará disponível em:

```
http://localhost:3000
```

## Configuração do Stripe

Configure um endpoint para recebimento dos Webhooks:

```
/webhook
```

Eventos processados:

- checkout.session.completed
- customer.subscription.deleted

## Deploy

Produção:

https://academia-com-pagamentos.onrender.com

## Segurança

O projeto implementa diversas práticas para garantir confiabilidade durante o processamento das assinaturas.

- Validação das variáveis de ambiente
- Verificação criptográfica dos Webhooks do Stripe
- Processamento idempotente de eventos
- Validação de dados enviados pelo cliente
- Tratamento centralizado de erros
- Isolamento de informações sensíveis por meio de variáveis de ambiente
- Exclusão do arquivo `.env` do controle de versão

## Possíveis Evoluções

- Painel administrativo
- Histórico de pagamentos
- Recuperação de senha
- Planos com diferentes níveis de assinatura
- Área do aluno
- Dashboard financeiro
- Testes automatizados

## Autor

Murilo de Souza Candido

GitHub: https://github.com/murilotecoteco
LinkedIn: https://www.linkedin.com/in/murilotecoteco

## Observação

O projeto utiliza os planos gratuitos do Render e do Supabase para fins de demonstração. Em períodos de inatividade, esses serviços podem entrar em modo de suspensão automática, ocasionando um breve tempo de inicialização ou indisponibilidade temporária.
