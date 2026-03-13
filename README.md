# NEXUS — Formulário Novo Agente RCS

Formulário de cadastro de novos agentes RCS. Stack: Next.js (API Route) + MongoDB Atlas + EmailJS + Vercel.

## Estrutura

```
nexus-form-rcs/
├── app/
│   ├── api/
│   │   └── novo-agente/
│   │       └── route.js          # Endpoint POST — recebe form, salva no MongoDB
│   ├── layout.js
│   └── page.js                   # Redirect para /novoagente.html
├── lib/
│   └── mongodb.js                # Singleton de conexão MongoDB
├── public/
│   ├── assets/
│   │   ├── logo-nexus.svg        # Logo usada no header
│   │   └── nexus-comunicacao.ico # Favicon
│   ├── novoagente.html           # Estrutura HTML do formulário
│   ├── novoagente.css            # Estilos da landing
│   └── novoagente.js             # Lógica de steps, validação e submit
├── next.config.mjs
├── package.json
└── vercel.json
```

## Setup Passo a Passo

### 1. MongoDB Atlas — Novo Projeto

1. Acesse [cloud.mongodb.com](https://cloud.mongodb.com)
2. Clique em **"New Project"** → Nome: `NEXUS-Apps`
3. Crie um cluster **M0 (free)** — região: São Paulo (`sa-east-1`)
4. Em **Database Access**, crie um usuário (ex: `nexus-apps-admin`)
5. Em **Network Access**, adicione `0.0.0.0/0` (necessário para Vercel)
6. Copie a **Connection String** (botão "Connect" → "Drivers")
7. O banco `nexus-apps` e as collections serão criados automaticamente no primeiro insert

### 2. EmailJS — Configuração

1. Acesse [emailjs.com](https://emailjs.com) e crie uma conta (free: 200 e-mails/mês)
2. Vá em **Email Services** → adicione seu serviço (Gmail, Outlook, etc.)
3. Copie o **Service ID** (ex: `service_xxx`)
4. Vá em **Email Templates** → crie um template com estas variáveis:

```
Assunto: Nova Solicitação de Agente RCS — {{nome}}

Corpo:
Nova solicitação de agente RCS recebida:

Empresa: {{nome}}
Descrição: {{descricao}}
Website: {{website}}
Telefone: {{telefone}}
Responsável: {{responsavel}}
E-mail: {{email}}
Segmento: {{segmento}}
Informações adicionais: {{adicional}}

Arquivos enviados:
- Banner: {{banner_nome}}
- Logotipo: {{logo_nome}}
```

5. Copie o **Template ID** (ex: `template_xxx`)
6. Vá em **Account** → copie a **Public Key**

### 3. Atualizar configuração do Frontend

No arquivo `public/novoagente.js`, edite o bloco `CONFIG`:

```javascript
const CONFIG = {
  API_URL: 'https://seu-projeto.vercel.app/api/novo-agente',
  EMAILJS_PUBLIC_KEY: 'sua_public_key_aqui',
  EMAILJS_SERVICE_ID: 'service_xxx',
  EMAILJS_TEMPLATE_ID: 'template_xxx',
};
```

Observação importante: como `novoagente.js` está em `public/` (arquivo estático), ele não lê `.env` automaticamente no browser. Esses 4 valores precisam ser definidos nesse bloco (ou via uma estratégia adicional de `config.js` público).

### 4. Deploy na Vercel

```bash
# Opção A: Via CLI
npm i -g vercel
vercel login
vercel

# Opção B: Via GitHub
# Push para um repo e importe em vercel.com/new
```

Na Vercel, adicione as **Environment Variables**:

| Variável | Valor |
|----------|-------|
| `MONGODB_URI` | `mongodb+srv://usuario:senha@cluster.xxxxx.mongodb.net/...` |
| `MONGODB_DB` | `nexus-apps` |
| `ALLOWED_ORIGINS` | `https://seu-projeto.vercel.app` (ou `*` para teste) |
| `DOWNLOAD_LINK_SECRET` | chave secreta longa para assinar links de download (expira em 120h) |

Essas variáveis são usadas no backend (`app/api/novo-agente/route.js` e `lib/mongodb.js`).

### 5. Atualizar nxc.wf/novoagente

No painel do YOURLS, atualize o redirect de `nxc.wf/novoagente` para:

```
https://seu-projeto.vercel.app/novoagente.html
```

### 6. Checklist de Teste (C4)

**Desktop (Chrome/Firefox/Safari):**
- [ ] Acessar via nxc.wf/novoagente
- [ ] Preencher Step 1 — validação de campos obrigatórios
- [ ] Upload de banner (PNG/JPG, até 10MB)
- [ ] Upload de logo (PNG/JPG, até 10MB)
- [ ] Preencher Step 3 — telefone no formato E.164
- [ ] Revisar dados no Step 4
- [ ] Enviar e ver tela de sucesso
- [ ] Verificar no MongoDB Atlas se o documento foi criado
- [ ] Verificar se o e-mail de notificação chegou

**Mobile iOS (Safari):**
- [ ] Layout responsivo OK
- [ ] Upload de arquivos funciona (câmera/galeria)
- [ ] Envio completo com sucesso

**Mobile Android (Chrome):**
- [ ] Layout responsivo OK
- [ ] Upload de arquivos funciona
- [ ] Envio completo com sucesso

## Collections no MongoDB

### `agent_requests`
Dados do formulário + referências dos arquivos.

### `agent_files`
Arquivos binários (banner e logo) salvos como `Binary`.

Para extrair um arquivo via mongo shell:
```javascript
db.agent_files.findOne({ _id: ObjectId("...") })
```
