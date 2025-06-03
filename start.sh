#!/bin/bash

# 🤖 Claude Doc Bot - Script de démarrage rapide

echo "🚀 Démarrage de Claude Doc Bot..."

# Vérifier si pnpm est installé
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm n'est pas installé. Installation..."
    npm install -g pnpm@8.15.0
fi

# Vérifier si .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env manquant. Créez-le avec votre CLAUDE_COOKIE"
    echo "Voir README.md pour les instructions"
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
pnpm install

# Build des packages
echo "🔨 Build des packages..."
pnpm build

# Créer les dossiers nécessaires
mkdir -p outputs prompts

# Démarrer en mode développement
echo "🎯 Démarrage en mode développement..."
echo "API: http://localhost:3001"
echo "Frontend: http://localhost:3000"

# Démarrer API et Frontend en parallèle
pnpm dev 