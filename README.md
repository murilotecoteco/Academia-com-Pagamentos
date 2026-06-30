# Academia com Pagamentos

Sistema web para gerenciamento de academia com integração de pagamentos recorrentes utilizando Stripe, backend em Node.js/Express e armazenamento de dados no Supabase.

## Demonstração

**Aplicação online:**

https://academia-com-pagamentos.onrender.com

---

## Sobre o projeto

Este projeto foi desenvolvido com o objetivo de simular uma plataforma moderna para academias, permitindo que usuários realizem a contratação de um plano mensal por meio do Stripe Checkout.

Após a confirmação do pagamento, a aplicação recebe os eventos enviados pelo Stripe através de Webhooks e atualiza automaticamente o status da assinatura do usuário no Supabase.

O sistema foi desenvolvido seguindo boas práticas de organização do backend, validação de dados, tratamento de erros e processamento idempotente dos eventos enviados pelo Stripe.

---

## Funcionalidades

- Assinatura mensal via Stripe Checkout
- Processamento automático de pagamentos
- Integração com Stripe Webhooks
- Ativação automática da assinatura
- Cancelamento automático da assinatura
- Armazenamento de dados no Supabase
- Validação de dados do usuário
- Tratamento de erros
- Backend REST utilizando Express
- Deploy em ambiente de produção

---

## Tecnologias Utilizadas

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

### Deploy

- Render

### Controle de Versão

- Git
- GitHub

---

## Arquitetura

```text
Frontend
     │
     ▼
Express (Node.js)
     │
     ├────────► Stripe Checkout
     │                │
     │                ▼
     │         Processamento do pagamento
     │                │
     │                ▼
     │         Stripe Webhooks
     │                │
     ▼                │
Supabase ◄────────────┘
```

---

## Fluxo da Aplicação

1. O usuário acessa a plataforma.
2. Seleciona o plano mensal.
3. O backend cria uma sessão de pagamento no Stripe.
4. O usuário realiza o pagamento.
5. O Stripe envia um Webhook para a aplicação.
6. O backend valida a assinatura do evento.
7. O pagamento é registrado no Supabase.
8. A assinatura do usuário é ativada automaticamente.

---

## Estrutura do Projeto

```text
Academia-com-Pagamentos
│
├── public/
│   ├── index.html
│   ├── login.html
│   ├── sucesso.html
│   ├── cancelado.html
│   ├── style.css
│   ├── script.js
│   ├── auth.js
│   └── supabase.js
│
├── server.js
├── supabaseClient.js
├── package.json
├── .env
├── .gitignore
└── README.md
```

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto.

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
BASE_URL=http://localhost:3000
```

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/murilotecoteco/Academia-com-Pagamentos.git
```

Entre na pasta:

```bash
cd Academia-com-Pagamentos
```

Instale as dependências:

```bash
npm install
```

Configure o arquivo `.env`.

Inicie o servidor:

```bash
npm start
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

---

## Configuração do Stripe

Configure um endpoint de Webhook apontando para:

```text
/webhook
```

Eventos utilizados:

- `checkout.session.completed`
- `customer.subscription.deleted`

---

## Deploy

Hospedagem realizada no Render.

Produção:

https://academia-com-pagamentos.onrender.com

---

## Segurança

O projeto utiliza diversas práticas para garantir maior confiabilidade:

- Validação das variáveis de ambiente
- Verificação da assinatura dos Webhooks do Stripe
- Processamento idempotente dos eventos
- Validação dos dados enviados pelo cliente
- Tratamento centralizado de erros
- Uso de variáveis de ambiente para informações sensíveis
- Arquivo `.env` ignorado pelo Git

---

## Objetivo

Este projeto foi desenvolvido para fins de estudo e portfólio, demonstrando a implementação de um fluxo completo de pagamentos recorrentes utilizando Stripe, integração com banco de dados em nuvem por meio do Supabase e deploy de uma aplicação Node.js em ambiente de produção.

---

## Autor

**Murilo**

GitHub:

https://github.com/murilotecoteco
