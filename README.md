# 🤖 Claude Doc Bot

**Prototype d'automatisation de génération de documentation via Claude.ai**

Ce projet permet d'automatiser la génération de documentation en utilisant Playwright pour interagir avec Claude.ai, avec une interface web moderne pour le contrôle et le suivi en temps réel.

## ✨ Fonctionnalités

- 🚀 **Automatisation Playwright** : Script qui lit des prompts, les poste sur claude.ai et récupère les réponses
- 📡 **Interface web temps réel** : Dashboard avec WebSocket pour suivre la progression live
- 📄 **Gestion des fichiers** : Upload de prompts et téléchargement des documentations générées
- 🐳 **Déploiement cloud-ready** : Dockerisé et prêt pour Fly.io + Vercel
- 🔒 **Sécurisé** : Gestion des cookies Claude via variables d'environnement

## 🏗️ Architecture

```
[Browser Worker]  ──▶  Claude.ai
   ▲  │                       │
   │  ▼                       ▼
[Task API]  ◀── websockets ── [Frontend]
   │
   ▼
Filesystem / Object Storage (outputs)
```

- **Worker** : Node.js + Playwright pour l'automatisation Claude
- **API** : Express avec WebSocket pour orchestrer les jobs
- **Frontend** : Next.js + Tailwind avec interface temps réel
- **Storage** : Système de fichiers local + compatible S3

## 🚀 Installation & Démarrage

### Prérequis

- Node.js 18+
- pnpm 8+
- Un compte Claude Pro avec cookie de session

### 1. Clone et installation

```bash
git clone https://github.com/votre-repo/claude-doc-bot.git
cd claude-doc-bot
pnpm install
```

### 2. Configuration

Créez un fichier `.env` à la racine :

```env
# Cookie de session Claude Pro (OBLIGATOIRE)
CLAUDE_COOKIE=your_claude_session_cookie_here

# URLs pour le développement local
API_URL=http://localhost:3001
WS_URL=ws://localhost:3001
```

⚠️ **IMPORTANT** : Pour obtenir votre cookie Claude :
1. Connectez-vous à claude.ai
2. Ouvrez les DevTools (F12)
3. Allez dans Application > Cookies > claude.ai
4. Copiez la valeur du cookie `sessionKey`

### 3. Préparer vos prompts

Placez vos fichiers de prompts dans le dossier `prompts/` :

```
prompts/
├── prompt1.txt
├── prompt2.txt
└── prompt3.txt
```

### 4. Démarrage en développement

```bash
# Terminal 1 : API + Worker
cd api
pnpm dev

# Terminal 2 : Frontend
cd web
pnpm dev
```

Accédez à http://localhost:3000

### 5. Démarrage avec Docker

```bash
# Avec docker-compose
CLAUDE_COOKIE=your_cookie docker-compose up

# Ou build manuel
docker build -t claude-doc-bot .
docker run -p 3001:3001 -e CLAUDE_COOKIE=your_cookie claude-doc-bot
```

## 📊 Utilisation

1. **Préparation** : Placez vos prompts (.txt) dans le dossier `prompts/`
2. **Lancement** : Cliquez sur "Lancer le Job" dans l'interface web
3. **Suivi** : Regardez les logs en temps réel pendant que Claude traite vos prompts
4. **Téléchargement** : Récupérez les documentations générées (.md)

## 🛠️ Scripts disponibles

```bash
# Développement
pnpm dev              # Démarre tous les services en mode dev
pnpm build            # Build tous les packages
pnpm start            # Démarre en mode production

# Tests et qualité
pnpm lint             # Lint tout le code
pnpm format           # Format avec Prettier
pnpm type-check       # Vérification TypeScript

# Par workspace
pnpm --filter worker dev     # Worker seulement
pnpm --filter api dev        # API seulement  
pnpm --filter web dev        # Frontend seulement
```

## 🚀 Déploiement

### Fly.io (Backend + Worker)

```bash
# Installation Fly CLI
curl -L https://fly.io/install.sh | sh

# Login et déploiement
fly auth login
fly launch
fly secrets set CLAUDE_COOKIE=your_cookie
fly deploy
```

### Vercel (Frontend)

```bash
# Installation Vercel CLI
npm i -g vercel

# Déploiement
cd web
vercel
```

Variables d'environnement Vercel :
- `NEXT_PUBLIC_API_URL`: URL de votre API Fly.io
- `NEXT_PUBLIC_WS_URL`: URL WebSocket de votre API

## 📁 Structure du projet

```
claude-doc-bot/
├── worker/                 # Automation Playwright
│   ├── src/
│   │   └── index.ts       # Worker principal
│   └── package.json
├── api/                    # API Express + WebSocket
│   ├── src/
│   │   └── server.ts      # Serveur principal
│   └── package.json
├── web/                    # Frontend Next.js
│   ├── src/
│   │   ├── app/           # App Router
│   │   ├── components/    # Composants React
│   │   └── hooks/         # Hooks personnalisés
│   └── package.json
├── prompts/               # Vos prompts (.txt)
├── outputs/               # Documentations générées (.md)
├── Dockerfile             # Build production
├── docker-compose.yml     # Développement local
└── README.md
```

## 🔧 Configuration avancée

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|---------|
| `CLAUDE_COOKIE` | Cookie de session Claude Pro | **OBLIGATOIRE** |
| `PORT` | Port du serveur API | `3001` |
| `NODE_ENV` | Environnement d'exécution | `development` |
| `API_URL` | URL de l'API | `http://localhost:3001` |
| `WS_URL` | URL WebSocket | `ws://localhost:3001` |

### Personnalisation du Worker

Le worker peut être configuré dans `worker/src/index.ts` :

- Délai entre les requêtes
- Sélecteurs DOM Claude.ai
- Format de sortie des fichiers
- Gestion d'erreurs

## 🐛 Debugging

### Logs détaillés

```bash
# Mode debug avec browser visible
NODE_ENV=development pnpm --filter worker dev

# Logs API détaillés
DEBUG=* pnpm --filter api dev
```

### Problèmes courants

1. **Cookie expiré** : Re-connectez-vous à Claude.ai et mettez à jour le cookie
2. **Rate limiting** : Ajustez les délais dans le worker
3. **Sélecteurs DOM** : Claude.ai peut changer, vérifiez les sélecteurs
4. **WebSocket déconnecté** : Rechargez la page, reconnexion automatique

## 🔒 Sécurité

- ✅ Cookie Claude stocké en variable d'environnement seulement
- ✅ Aucun secret committé dans Git
- ✅ Utilisateur non-root dans Docker
- ✅ CORS configuré correctement
- ⚠️ **NE JAMAIS** committer votre cookie Claude

## 📈 Monitoring

- Health check disponible sur `/health`
- Logs structurés avec timestamps
- Métriques de job (succès/échecs)
- WebSocket pour monitoring temps réel

## 🤝 Contribution

1. Fork le projet
2. Créez votre branche (`git checkout -b feature/awesome-feature`)
3. Committez vos changements (`git commit -m 'Add awesome feature'`)
4. Push vers la branche (`git push origin feature/awesome-feature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👥 Support

- 📧 Email : support@claude-doc-bot.com
- 💬 Issues : GitHub Issues
- 📖 Docs : Wiki du projet

---

**⚡ Prototype livré en < 24h pour impressionner le client !** 