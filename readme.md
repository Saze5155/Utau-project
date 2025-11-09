# 🎵 UTAU Editor - Backend API

> Backend complet pour une application de création musicale collaborative inspirée d'UTAU, développé avec Directus.

[![Node.js](https://img.shields.io/badge/Node.js-18.13+-green.svg)](https://nodejs.org/)
[![Directus](https://img.shields.io/badge/Directus-11.10+-blue.svg)](https://directus.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📖 Table des matières

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API Documentation](#api-documentation)
- [Tests](#tests)
- [Technologies](#technologies)
- [Auteur](#auteur)

---

## 🎯 À propos

**UTAU Editor** est une application web permettant de créer, éditer et partager des projets musicaux utilisant des voicebanks (banques vocales).

Ce repository contient le **backend complet** développé avec Directus, offrant :

- Une API REST complète et sécurisée
- Un système de gestion de contenu headless
- Une base de données relationnelle optimisée
- Un système d'authentification JWT
- Des permissions granulaires par rôle

---

## ✨ Fonctionnalités

### 🗣️ Gestion des Voicebanks

- Upload de banques vocales (fichiers WAV)
- Métadonnées complètes (langue, type de voix, auteur)
- Système de téléchargement et statistiques

### 🎼 Création Musicale

- Création de projets avec tempo et tonalité configurables
- Éditeur de notes MIDI (pitch, durée, vélocité, paroles)
- Support multi-voicebanks dans un même projet
- Gestion des tags (genres, styles)

### 👥 Collaboration

- Système d'invitations avec permissions (read/write/admin)
- Travail simultané sur les projets
- Notifications temps réel

### ❤️ Interactions Sociales

- Système de likes sur les projets
- Compteurs de vues et de popularité
- Partage communautaire

### 📁 Gestion des Médias

- Upload d'images (covers)
- Transformations automatiques d'images
- Upload de fichiers audio et ZIP

---

## 🏗️ Architecture

### Modèle de données

```
👤 Users (directus_users)
    ↓
├── 🗣️ Voicebanks
│   ├── Métadonnées
│   ├── Fichiers samples (ZIP/WAV)
│   └── Cover image
│
├── 🎵 Projects
│   ├── Configuration (tempo, tonalité)
│   ├── Voicebank principale
│   ├── Tags (M2M)
│   └── 🎼 Notes (O2M)
│       ├── Pitch MIDI (0-127)
│       ├── Durée (ms)
│       ├── Paroles/Phonèmes
│       ├── Vélocité
│       └── Voicebank utilisée
│
├── 👥 Collaborations
│   ├── Permissions (read/write/admin)
│   └── Status (invited/accepted/declined)
│
├── ❤️ Projects_Likes
│   └── Table de liaison users-projects
│
└── 🔔 Notifications
    ├── Type d'événement
    └── Statut (lu/non lu)
```

### Collections Directus

| Collection       | Description            | Relations                                |
| ---------------- | ---------------------- | ---------------------------------------- |
| `voicebanks`     | Banques vocales        | → directus_users, directus_files         |
| `projects`       | Projets musicaux       | → voicebanks, tags (M2M), directus_users |
| `notes`          | Notes musicales        | → projects, voicebanks                   |
| `tags`           | Tags de catégorisation | ← projects (M2M)                         |
| `collaborations` | Système collaboratif   | → projects, directus_users               |
| `projects_likes` | Système de likes       | → projects, directus_users               |
| `notifications`  | Notifications          | → directus_users, projects               |

---

## 📋 Prérequis

- **Node.js** >= 18.13.0
- **npm** >= 9.0.0
- **Git**
- **Insomnia** ou **Postman** (pour tester l'API)

---

## 🚀 Installation

### 1. Cloner le repository

```bash
git clone git@github.com:Saze5155/Utau-project.git
cd Utau-project
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

Créer un fichier `.env` à la racine :

```env
# Security
KEY="votre-clé-secrète-aléatoire"
SECRET="votre-secret-aléatoire"

# Admin
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="votre-mot-de-passe-sécurisé"

# Database
DB_CLIENT="sqlite3"
DB_FILENAME="./data/database.db"

# Server
PORT=8055
PUBLIC_URL="http://localhost:8055"

# CORS
CORS_ENABLED=true
CORS_ORIGIN=true

# Files
MAX_PAYLOAD_SIZE="500mb"
STORAGE_LOCATIONS="local"
STORAGE_LOCAL_ROOT="./uploads"

# WebSockets (optionnel)
WEBSOCKETS_ENABLED=true
WEBSOCKETS_REST_AUTH=handshake
```

### 4. Initialiser la base de données

```bash
npx directus bootstrap
```

### 5. Appliquer le schéma

```bash
npx directus schema apply utau-editor-schema-fixed.json --yes
```

### 6. Configurer les permissions

```bash
node setup-permissions-hybrid.js
```

### 7. Démarrer le serveur

```bash
npm start
```

L'API est maintenant accessible sur **http://localhost:8055** 🎉

---

## ⚙️ Configuration

### Rôles et Permissions

Le système utilise 3 rôles :

| Rôle                   | Description             | Permissions                                 |
| ---------------------- | ----------------------- | ------------------------------------------- |
| **Admin**              | Accès complet           | Toutes les actions                          |
| **Authenticated User** | Utilisateurs connectés  | CRUD sur leurs ressources, lecture publique |
| **Public**             | Visiteurs non connectés | Lecture seule des contenus publiés          |

### Permissions détaillées (Authenticated User)

- **Voicebanks** : CRUD (update/delete uniquement sur les siennes)
- **Projects** : CRUD (update/delete uniquement sur les siens)
- **Notes** : CRUD (via permissions du projet parent)
- **Tags** : Read + Create (partagés entre utilisateurs)
- **Likes** : CRUD (delete uniquement ses propres likes)
- **Collaborations** : Read ses collaborations, Create/Update/Delete
- **Notifications** : Read/Update/Delete ses propres notifications

---

## 📚 API Documentation

### Base URL

```
http://localhost:8055
```

### Authentification

```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

# Réponse
{
  "data": {
    "access_token": "eyJhbGc...",
    "expires": 900000,
    "refresh_token": "def50200..."
  }
}
```

### Endpoints principaux

| Méthode | Endpoint                                   | Description                    |
| ------- | ------------------------------------------ | ------------------------------ |
| `GET`   | `/items/voicebanks`                        | Liste des voicebanks           |
| `POST`  | `/items/voicebanks`                        | Créer une voicebank            |
| `GET`   | `/items/projects`                          | Liste des projets              |
| `POST`  | `/items/projects`                          | Créer un projet                |
| `GET`   | `/items/projects/:id`                      | Détails d'un projet avec notes |
| `POST`  | `/items/notes`                             | Créer une note musicale        |
| `GET`   | `/items/notes?filter[project_id][_eq]=:id` | Notes d'un projet              |
| `POST`  | `/items/projects_likes`                    | Liker un projet                |
| `POST`  | `/files`                                   | Upload de fichier              |
| `GET`   | `/assets/:id`                              | Télécharger un fichier         |

### Exemples d'utilisation

#### Créer un projet musical

```bash
POST /items/projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Ma Première Chanson",
  "tempo": 120,
  "key_signature": "C",
  "status": "draft",
  "primary_voicebank": "uuid-voicebank",
  "tags": [
    { "tags_id": "uuid-tag-jpop" }
  ]
}
```

#### Créer une séquence de notes

```bash
POST /items/notes
Authorization: Bearer {token}
Content-Type: application/json

[
  {
    "project_id": "uuid-project",
    "start_time": 0,
    "duration": 500,
    "pitch": 60,
    "lyrics": "do",
    "velocity": 100,
    "voicebank_id": "uuid-voicebank"
  },
  {
    "project_id": "uuid-project",
    "start_time": 500,
    "duration": 500,
    "pitch": 62,
    "lyrics": "re",
    "velocity": 100,
    "voicebank_id": "uuid-voicebank"
  }
]
```

---

## 🧪 Tests

### Collection Insomnia

Une collection complète de tests est fournie dans `UTAU-Editor-Insomnia-Collection.json`.

**Import dans Insomnia :**

1. Ouvrir Insomnia
2. Create → Import from File
3. Sélectionner `UTAU-Editor-Insomnia-Collection.json`
4. Configurer l'environnement avec votre `base_url` et `access_token`

### Tests manuels

```bash
# 1. Créer un compte test
# Via l'interface Directus : User Directory → Create User

# 2. Se connecter
POST /auth/login
{ "email": "test@example.com", "password": "password123" }

# 3. Tester les endpoints
GET /items/voicebanks
GET /items/projects
POST /items/tags { "name": "jpop" }
```

---

## 🛠️ Technologies

### Backend

- **Directus** 11.10+ - Headless CMS
- **Node.js** 18.13+ - Runtime JavaScript
- **SQLite** - Base de données (dev)

### Bibliothèques principales

- **JWT** - Authentification
- **Sharp** - Transformations d'images
- **Multer** - Upload de fichiers

### Outils de développement

- **Insomnia** - Tests API
- **Git** - Versioning

---

## 📂 Structure du projet

```
Utau-project/
├── data/                          # Base de données SQLite (gitignored)
├── uploads/                       # Fichiers uploadés (gitignored)
├── extensions/                    # Extensions Directus personnalisées
│   ├── meilisearch-sync/         # (optionnel)
│   ├── search-setup/             # (optionnel)
│   └── like-manager/             # (optionnel)
├── .env                           # Variables d'environnement (gitignored)
├── .gitignore                     # Fichiers ignorés par Git
├── package.json                   # Dépendances Node.js
├── utau-editor-schema-fixed.json  # Schéma de la base de données
├── setup-permissions-hybrid.js    # Script de configuration des permissions
└── README.md                      # Documentation (ce fichier)
```

---

## 📝 Scripts disponibles

```bash
# Démarrer le serveur
npm start

# Appliquer le schéma
npx directus schema apply utau-editor-schema-fixed.json --yes

# Exporter le schéma actuel
npx directus schema snapshot schema-backup.json

# Bootstrap (première installation)
npx directus bootstrap
```

## 👨‍💻 Auteur

**Portes Samuel**

- GitHub: [@Saze5155](https://github.com/Saze5155)
