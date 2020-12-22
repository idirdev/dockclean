# dockclean

Docker system cleanup utility. Scan and remove dangling images, stopped containers, unused volumes, unused networks, and build cache — with detailed disk space reporting.

---

**[English](#english)** | **[Français](#français)**

---

## English

### Features

- **Selective cleanup** — target specific resource types or clean everything at once
- **Dry-run mode** — preview what would be removed before committing
- **Disk usage reporting** — before/after comparison with space reclaimed per type
- **Force mode** — skip confirmation prompts for scripting and automation
- **JSON output** — machine-readable output for CI/CD pipelines
- **Tabular display** — clear, color-coded tables for each resource type

### Installation

```bash
npm install -g dockclean
```

### Usage

```bash
# Clean all unused Docker resources
dockclean --all

# Preview what would be cleaned (no deletion)
dockclean --all --dry-run

# Clean specific resource types
dockclean --images --containers
dockclean --volumes --networks
dockclean --buildcache

# Skip confirmation prompt
dockclean --all --force

# Output as JSON
dockclean --all --json
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--all` | `-a` | Clean all resource types |
| `--images` | `-i` | Remove dangling images |
| `--containers` | `-c` | Remove stopped containers |
| `--volumes` | `-V` | Remove unused volumes |
| `--networks` | `-n` | Remove unused networks |
| `--buildcache` | `-b` | Remove build cache |
| `--dry-run` | `-d` | Preview mode, no deletion |
| `--force` | `-f` | Skip confirmation prompt |
| `--json` | | Output results as JSON |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

### Programmatic Usage

```js
const { runCleanup } = require('dockclean');

await runCleanup({
  images: true,
  containers: true,
  volumes: false,
  networks: false,
  buildcache: false,
  dryRun: true,
  force: true,
  json: false,
});
```

### Requirements

- Node.js >= 14
- Docker installed and running

---

## Français

### Fonctionnalités

- **Nettoyage sélectif** — ciblez des types de ressources spécifiques ou nettoyez tout d'un coup
- **Mode simulation** — prévisualisez ce qui serait supprimé avant d'agir
- **Rapport d'utilisation disque** — comparaison avant/après avec l'espace récupéré par type
- **Mode forcé** — supprime la demande de confirmation pour le scripting et l'automatisation
- **Sortie JSON** — format lisible par machine pour les pipelines CI/CD
- **Affichage tabulaire** — tableaux clairs et colorés pour chaque type de ressource

### Installation

```bash
npm install -g dockclean
```

### Utilisation

```bash
# Nettoyer toutes les ressources Docker inutilisées
dockclean --all

# Prévisualiser ce qui serait nettoyé (aucune suppression)
dockclean --all --dry-run

# Nettoyer des types de ressources spécifiques
dockclean --images --containers
dockclean --volumes --networks
dockclean --buildcache

# Passer la confirmation
dockclean --all --force

# Sortie en JSON
dockclean --all --json
```

### Options

| Drapeau | Court | Description |
|---------|-------|-------------|
| `--all` | `-a` | Nettoyer tous les types de ressources |
| `--images` | `-i` | Supprimer les images pendantes |
| `--containers` | `-c` | Supprimer les conteneurs arrêtés |
| `--volumes` | `-V` | Supprimer les volumes inutilisés |
| `--networks` | `-n` | Supprimer les réseaux inutilisés |
| `--buildcache` | `-b` | Supprimer le cache de build |
| `--dry-run` | `-d` | Mode simulation, aucune suppression |
| `--force` | `-f` | Passer la confirmation |
| `--json` | | Sortie en format JSON |
| `--version` | `-v` | Afficher la version |
| `--help` | `-h` | Afficher l'aide |

### Utilisation programmatique

```js
const { runCleanup } = require('dockclean');

await runCleanup({
  images: true,
  containers: true,
  volumes: false,
  networks: false,
  buildcache: false,
  dryRun: true,
  force: true,
  json: false,
});
```

### Prérequis

- Node.js >= 14
- Docker installé et en cours d'exécution

---

## License

MIT — idirdev
