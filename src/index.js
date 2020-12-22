'use strict';

/**
 * @fileoverview Clean unused Docker resources.
 * @module dockclean
 * @author idirdev
 */

const { execSync, spawnSync } = require('child_process');

/**
 * Run a docker command, returning stdout lines.
 * @param {string} cmd - Command string.
 * @returns {{ lines: string[], error: string|null }}
 */
function runDocker(cmd) {
  try {
    const out = execSync(cmd, { timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = out.toString().trim().split('\n').filter(Boolean);
    return { lines, error: null };
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('not found') || msg.includes('ENOENT') || msg.includes('not recognized')) {
      return { lines: [], error: 'docker not found' };
    }
    return { lines: [], error: msg };
  }
}

/**
 * Parse docker tabular output (header + rows).
 * @param {string[]} lines - Lines from docker output.
 * @param {string[]} keys - Column keys matching header columns.
 * @returns {object[]}
 */
function parseTabular(lines, keys) {
  if (lines.length < 2) return [];
  return lines.slice(1).map((line) => {
    const cols = line.trim().split(/\s{2,}/);
    const obj = {};
    keys.forEach((k, i) => { obj[k] = (cols[i] || '').trim(); });
    return obj;
  });
}

/**
 * Get stopped (exited) containers.
 * @returns {{ containers: Array<{id:string,name:string,image:string,status:string}>, warning: string|null }}
 */
function getStoppedContainers() {
  const { lines, error } = runDocker('docker ps -a --filter status=exited --format "{{.ID}}  {{.Names}}  {{.Image}}  {{.Status}}"');
  if (error) return { containers: [], warning: error };
  const containers = lines.map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      id: (parts[0] || '').trim(),
      name: (parts[1] || '').trim(),
      image: (parts[2] || '').trim(),
      status: (parts[3] || '').trim(),
    };
  }).filter((c) => c.id);
  return { containers, warning: null };
}

/**
 * Get dangling (untagged) images.
 * @returns {{ images: Array<{id:string,repository:string,tag:string,size:string}>, warning: string|null }}
 */
function getDanglingImages() {
  const { lines, error } = runDocker('docker images -f dangling=true --format "{{.ID}}  {{.Repository}}  {{.Tag}}  {{.Size}}"');
  if (error) return { images: [], warning: error };
  const images = lines.map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      id: (parts[0] || '').trim(),
      repository: (parts[1] || '').trim(),
      tag: (parts[2] || '').trim(),
      size: (parts[3] || '').trim(),
    };
  }).filter((i) => i.id);
  return { images, warning: null };
}

/**
 * Get unused (dangling) volumes.
 * @returns {{ volumes: Array<{driver:string,name:string}>, warning: string|null }}
 */
function getUnusedVolumes() {
  const { lines, error } = runDocker('docker volume ls -f dangling=true --format "{{.Driver}}  {{.Name}}"');
  if (error) return { volumes: [], warning: error };
  const volumes = lines.map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      driver: (parts[0] || '').trim(),
      name: (parts[1] || '').trim(),
    };
  }).filter((v) => v.name);
  return { volumes, warning: null };
}

/**
 * Get unused (custom, not in-use) networks.
 * @returns {{ networks: Array<{id:string,name:string,driver:string}>, warning: string|null }}
 */
function getUnusedNetworks() {
  const { lines, error } = runDocker('docker network ls --format "{{.ID}}  {{.Name}}  {{.Driver}}"');
  if (error) return { networks: [], warning: error };
  const builtIn = new Set(['bridge', 'host', 'none']);
  const networks = lines.map((line) => {
    const parts = line.split(/\s{2,}/);
    return {
      id: (parts[0] || '').trim(),
      name: (parts[1] || '').trim(),
      driver: (parts[2] || '').trim(),
    };
  }).filter((n) => n.id && !builtIn.has(n.name));
  return { networks, warning: null };
}

/**
 * Remove a stopped container by ID.
 * @param {string} id - Container ID.
 * @returns {{ removed: boolean, warning: string|null }}
 */
function removeContainer(id) {
  const { error } = runDocker(`docker rm ${id}`);
  if (error) return { removed: false, warning: error };
  return { removed: true, warning: null };
}

/**
 * Remove an image by ID.
 * @param {string} id - Image ID.
 * @returns {{ removed: boolean, warning: string|null }}
 */
function removeImage(id) {
  const { error } = runDocker(`docker rmi ${id}`);
  if (error) return { removed: false, warning: error };
  return { removed: true, warning: null };
}

/**
 * Remove a volume by name.
 * @param {string} name - Volume name.
 * @returns {{ removed: boolean, warning: string|null }}
 */
function removeVolume(name) {
  const { error } = runDocker(`docker volume rm ${name}`);
  if (error) return { removed: false, warning: error };
  return { removed: true, warning: null };
}

/**
 * Remove a network by ID or name.
 * @param {string} id - Network ID or name.
 * @returns {{ removed: boolean, warning: string|null }}
 */
function removeNetwork(id) {
  const { error } = runDocker(`docker network rm ${id}`);
  if (error) return { removed: false, warning: error };
  return { removed: true, warning: null };
}

/**
 * Dry-run: list all resources that would be removed.
 * @returns {{ containers: object[], images: object[], volumes: object[], networks: object[], warnings: string[] }}
 */
function dryRun() {
  const warnings = [];
  const { containers, warning: cw } = getStoppedContainers();
  if (cw) warnings.push(`containers: ${cw}`);
  const { images, warning: iw } = getDanglingImages();
  if (iw) warnings.push(`images: ${iw}`);
  const { volumes, warning: vw } = getUnusedVolumes();
  if (vw) warnings.push(`volumes: ${vw}`);
  const { networks, warning: nw } = getUnusedNetworks();
  if (nw) warnings.push(`networks: ${nw}`);
  return { containers, images, volumes, networks, warnings };
}

/**
 * Clean unused docker resources.
 * @param {{ containers?: boolean, images?: boolean, volumes?: boolean, networks?: boolean }} opts
 * @returns {{ removed: { containers: string[], images: string[], volumes: string[], networks: string[] }, warnings: string[] }}
 */
function clean(opts = {}) {
  const removed = { containers: [], images: [], volumes: [], networks: [] };
  const warnings = [];

  if (opts.containers) {
    const { containers, warning } = getStoppedContainers();
    if (warning) { warnings.push(`containers: ${warning}`); }
    for (const c of containers) {
      const { removed: ok, warning: w } = removeContainer(c.id);
      if (ok) removed.containers.push(c.id);
      else if (w) warnings.push(`rm container ${c.id}: ${w}`);
    }
  }

  if (opts.images) {
    const { images, warning } = getDanglingImages();
    if (warning) { warnings.push(`images: ${warning}`); }
    for (const img of images) {
      const { removed: ok, warning: w } = removeImage(img.id);
      if (ok) removed.images.push(img.id);
      else if (w) warnings.push(`rmi ${img.id}: ${w}`);
    }
  }

  if (opts.volumes) {
    const { volumes, warning } = getUnusedVolumes();
    if (warning) { warnings.push(`volumes: ${warning}`); }
    for (const v of volumes) {
      const { removed: ok, warning: w } = removeVolume(v.name);
      if (ok) removed.volumes.push(v.name);
      else if (w) warnings.push(`rm volume ${v.name}: ${w}`);
    }
  }

  if (opts.networks) {
    const { networks, warning } = getUnusedNetworks();
    if (warning) { warnings.push(`networks: ${warning}`); }
    for (const n of networks) {
      const { removed: ok, warning: w } = removeNetwork(n.id);
      if (ok) removed.networks.push(n.id);
      else if (w) warnings.push(`rm network ${n.id}: ${w}`);
    }
  }

  return { removed, warnings };
}

/**
 * Summarise clean results.
 * @param {{ removed: { containers: string[], images: string[], volumes: string[], networks: string[] }, warnings: string[] }} results
 * @returns {string}
 */
function summary(results) {
  const r = results.removed;
  const lines = [
    `Removed containers : ${r.containers.length}`,
    `Removed images     : ${r.images.length}`,
    `Removed volumes    : ${r.volumes.length}`,
    `Removed networks   : ${r.networks.length}`,
  ];
  if (results.warnings && results.warnings.length) {
    lines.push(`Warnings           : ${results.warnings.length}`);
    results.warnings.forEach((w) => lines.push(`  - ${w}`));
  }
  return lines.join('\n');
}

module.exports = {
  getStoppedContainers,
  getDanglingImages,
  getUnusedVolumes,
  getUnusedNetworks,
  removeContainer,
  removeImage,
  removeVolume,
  removeNetwork,
  dryRun,
  clean,
  summary,
};
