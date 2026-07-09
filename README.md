# Academia com Pagamentos

<p align="center">
  <img src=".github/banner.png" alt="Academia com Pagamentos Banner">
</p>

<p align="center">
  Web application for managing gym memberships with recurring payments using Stripe and Supabase.
</p>

<p align="center">

![Status](https://img.shields.io/badge/status-completed-brightgreen)
![License](https://img.shields.io/badge/license-none-lightgrey)

</p>

<p align="center">

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge\&logo=html5\&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge\&logo=css3\&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge\&logo=javascript\&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge\&logo=nodedotjs\&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge\&logo=express\&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge\&logo=supabase\&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-635BFF?style=for-the-badge\&logo=stripe\&logoColor=white)
![Git](https://img.shields.io/badge/Git-F05032?style=for-the-badge\&logo=git\&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge\&logo=github\&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge\&logo=render\&logoColor=white)

</p>

<p align="center">

<a href="https://academia-com-pagamentos.onrender.com">
<img src="https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge">
</a>

<a href="https://github.com/murilotecoteco/Academia-com-Pagamentos">
<img src="https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge">
</a>

</p>

---

# Table of Contents

* About
* Why this project
* Screenshots
* Features
* Technology Stack
* Architecture
* Project Structure
* Getting Started
* Environment Variables
* Deployment
* Security
* Roadmap
* License

---

# About

Academia com Pagamentos is a full-stack web application that simulates a gym membership platform with recurring subscriptions.

Users can create an account, subscribe to a monthly plan through Stripe Checkout, and have their membership status automatically synchronized using Stripe Webhooks and Supabase.

The project demonstrates backend development, payment processing, authentication, database integration and deployment in a production environment.

---

# Why this project

This project was built to practice and demonstrate:

* REST API development with Express
* User authentication
* Stripe Checkout integration
* Stripe Webhooks
* Secure payment processing
* Cloud database management with Supabase
* Environment variable management
* Production deployment

---

# Screenshots

## Home

![Home](.github/screenshots/home.png)

## Account

![Account](.github/screenshots/account.png)

## Checkout

![Checkout](.github/screenshots/checkout.png)

---

# Features

* ✅ User registration and authentication
* ✅ User account management
* ✅ Stripe Checkout integration
* ✅ Stripe Webhooks
* ✅ Automatic subscription activation
* ✅ Automatic subscription cancellation
* ✅ Supabase database integration
* ✅ Input validation
* ✅ Centralized error handling
* ✅ Production deployment
* ⏳ Admin dashboard
* ⏳ Payment history
* ⏳ Password recovery

---

# Technology Stack

| Layer           | Technology                       |
| --------------- | -------------------------------- |
| Frontend        | HTML5, CSS3, JavaScript          |
| Backend         | Node.js, Express.js              |
| Database        | Supabase (PostgreSQL)            |
| Payments        | Stripe Checkout, Stripe Webhooks |
| Deployment      | Render                           |
| Version Control | Git & GitHub                     |

---

# Architecture

```text
Client Browser
      │
      ▼
Frontend
(HTML, CSS, JavaScript)
      │
      ▼
Express API
      │
 ┌────┴───────────────┐
 │                    │
 ▼                    ▼
Stripe Checkout   Supabase Database
      │                    ▲
      ▼                    │
Payment Processing          │
      │                    │
      ▼                    │
Stripe Webhooks─────────────┘
```

The application follows a client-server architecture. The frontend communicates with an Express API responsible for authentication, payment processing and communication with Stripe. Subscription data is stored and synchronized in Supabase after successful webhook validation.

---

# Project Structure

```text
Academia-com-Pagamentos/
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
│   └── styles/
│
├── server.js
├── supabaseClient.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

# Getting Started

## Prerequisites

* Node.js 18+
* Supabase project
* Stripe account

## Installation

```bash
git clone https://github.com/murilotecoteco/Academia-com-Pagamentos.git
```

```bash
cd Academia-com-Pagamentos
```

```bash
npm install
```

```bash
npm start
```

The application will be available at:

```text
http://localhost:3000
```

---

# Environment Variables

Create a `.env` file in the project root.

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
BASE_URL=http://localhost:3000
```

---

# Deployment

The application is deployed on Render.

Every deployment uses the configured environment variables for Stripe and Supabase.

Production URL:

```text
https://academia-com-pagamentos.onrender.com
```

---

# Security

The project includes several security practices:

* Validation of environment variables
* Stripe webhook signature verification
* Idempotent webhook processing
* Server-side payment validation
* Centralized error handling
* Sensitive credentials stored as environment variables
* `.env` excluded from version control

---

# Roadmap

* [x] User authentication
* [x] Stripe Checkout
* [x] Stripe Webhooks
* [x] Subscription synchronization
* [x] Production deployment
* [ ] Admin dashboard
* [ ] Payment history
* [ ] Password recovery
* [ ] Automated tests

---

# License

This project was developed for educational purposes.

No license has been applied.
