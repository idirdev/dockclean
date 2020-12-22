'use strict';

const { execSync, execFileSync } = require('child_process');

/**
 * Execute a docker command and return stdout as string.
 * Throws enriched errors for missing docker / stopped daemon.
 */
function dockerExec(args, { timeout = 30000, ignoreErrors = false } = {}) {
  try {
    const result = execFileSync('docker', args, {
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.trim();
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error('Docker binary not found');
      e.code = 'DOCKER_NOT_FOUND';
      throw e;
    }
    const stderr = (err.stderr || '').toString();
    if (
      stderr.includes('Cannot connect to the Docker daemon') ||
      stderr.includes('Is the docker daemon running')
    ) {
      const e = new Error('Docker daemon is not running');
      e.code = 'DOCKER_NOT_RUNNING';
      throw e;
    }
    if (ignoreErrors) {
      return '';
    }
    throw err;
  }
}

/**
 * Check if Docker is available and the daemon is running.
 */
function checkDocker() {
  dockerExec(['info'], { timeout: 10000 });
}

/**
 * Get Docker disk usage via `docker system df`.
 * Returns parsed object with type, total, active, size, reclaimable.
 */
function getSystemDf() {
  const raw = dockerExec(['system', 'df', '--format', '{{.Type}}\t{{.TotalCount}}\t{{.Active}}\t{{.Size}}\t{{.Reclaimable}}']);
  const lines = raw.split('\n').filter(Boolean);
  const entries = {};
  for (const line of lines) {
    const [type, total, active, size, reclaimable] = line.split('\t');
    entries[type.trim().toLowerCase()] = {
      type: type.trim(),
      total: parseInt(total, 10) || 0,
      active: parseInt(active, 10) || 0,
      size: size ? size.trim() : '0B',
      reclaimable: reclaimable ? reclaimable.trim() : '0B',
    };
  }
  return entries;
}

/**
 * List dangling images.
 * Returns array of { id, repository, tag, size, created }.
 */
function listDanglingImages() {
  const raw = dockerExec(
    ['images', '--filter', 'dangling=true', '--format', '{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'],
    { ignoreErrors: true }
  );
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const [id, repository, tag, size, created] = line.split('\t');
    return { id, repository, tag, size, created };
  });
}

/**
 * List stopped (exited) containers.
 * Returns array of { id, name, image, status, size, created }.
 */
function listStoppedContainers() {
  const raw = dockerExec(
    ['ps', '--filter', 'status=exited', '--filter', 'status=dead', '--filter', 'status=created',
     '--format', '{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}\t{{.CreatedAt}}'],
    { ignoreErrors: true }
  );
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const [id, name, image, status, size, created] = line.split('\t');
    return { id, name, image, status, size, created };
  });
}

/**
 * List unused volumes (dangling).
 * Returns array of { name, driver, size }.
 */
function listUnusedVolumes() {
  const raw = dockerExec(
    ['volume', 'ls', '--filter', 'dangling=true', '--format', '{{.Name}}\t{{.Driver}}'],
    { ignoreErrors: true }
  );
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => {
    const [name, driver] = line.split('\t');
    // Get individual volume size via inspect
    let size = 'N/A';
    try {
      const inspect = dockerExec(['system', 'df', '-v', '--format', '{{json .}}'], { timeout: 15000, ignoreErrors: true });
      // Fallback: volume size not easily parseable individually, keep N/A
    } catch (_) { /* ignore */ }
    return { name: name ? name.substring(0, 24) : name, fullName: name, driver, size };
  });
}

/**
 * List unused networks (not default ones).
 * Returns array of { id, name, driver, scope }.
 */
function listUnusedNetworks() {
  const raw = dockerExec(
    ['network', 'ls', '--filter', 'type=custom', '--format', '{{.ID}}\t{{.Name}}\t{{.Driver}}\t{{.Scope}}'],
    { ignoreErrors: true }
  );
  if (!raw) return [];
  const defaultNetworks = ['bridge', 'host', 'none'];
  return raw.split('\n').filter(Boolean).map((line) => {
    const [id, name, driver, scope] = line.split('\t');
    return { id, name, driver, scope };
  }).filter((n) => !defaultNetworks.includes(n.name));
}

/**
 * Get build cache info.
 * Returns array of { id, type, size, createdSince, lastUsed, shared }.
 */
function listBuildCache() {
  const raw = dockerExec(
    ['builder', 'du', '--format', '{{.ID}}\t{{.Type}}\t{{.Size}}\t{{.CreatedSince}}\t{{.LastUsedSince}}\t{{.Shared}}'],
    { ignoreErrors: true, timeout: 60000 }
  );
  if (!raw) return [];
  // Filter out header-like lines
  return raw.split('\n').filter(Boolean).filter((l) => !l.startsWith('ID')).map((line) => {
    const parts = line.split('\t');
    return {
      id: (parts[0] || '').substring(0, 16),
      type: parts[1] || '',
      size: parts[2] || '0B',
      createdSince: parts[3] || '',
      lastUsed: parts[4] || '',
      shared: parts[5] || 'false',
    };
  });
}

/**
 * Remove dangling images. Returns { removed: number, errors: string[] }.
 */
function pruneImages() {
  const output = dockerExec(['image', 'prune', '-f'], { ignoreErrors: true });
  const match = output.match(/Total reclaimed space:\s*(.+)/i);
  return {
    output,
    reclaimedSpace: match ? match[1].trim() : '0B',
  };
}

/**
 * Remove stopped containers. Returns prune output.
 */
function pruneContainers() {
  const output = dockerExec(['container', 'prune', '-f'], { ignoreErrors: true });
  const match = output.match(/Total reclaimed space:\s*(.+)/i);
  return {
    output,
    reclaimedSpace: match ? match[1].trim() : '0B',
  };
}

/**
 * Remove unused volumes.
 */
function pruneVolumes() {
  const output = dockerExec(['volume', 'prune', '-f'], { ignoreErrors: true });
  const match = output.match(/Total reclaimed space:\s*(.+)/i);
  return {
    output,
    reclaimedSpace: match ? match[1].trim() : '0B',
  };
}

/**
 * Remove unused networks.
 */
function pruneNetworks() {
  const output = dockerExec(['network', 'prune', '-f'], { ignoreErrors: true });
  return { output };
}

/**
 * Remove build cache.
 */
function pruneBuildCache() {
  const output = dockerExec(['builder', 'prune', '-f'], { ignoreErrors: true, timeout: 120000 });
  const match = output.match(/Total reclaimed space:\s*(.+)/i);
  return {
    output,
    reclaimedSpace: match ? match[1].trim() : '0B',
  };
}

module.exports = {
  dockerExec,
  checkDocker,
  getSystemDf,
  listDanglingImages,
  listStoppedContainers,
  listUnusedVolumes,
  listUnusedNetworks,
  listBuildCache,
  pruneImages,
  pruneContainers,
  pruneVolumes,
  pruneNetworks,
  pruneBuildCache,
};
