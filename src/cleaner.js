'use strict';

const docker = require('./docker');

/**
 * Scan all requested resource types and return a summary of what can be cleaned.
 * @param {Object} options - Which resources to scan
 * @returns {Object} scan results per resource type
 */
function scan(options) {
  const results = {};

  if (options.images) {
    results.images = docker.listDanglingImages();
  }
  if (options.containers) {
    results.containers = docker.listStoppedContainers();
  }
  if (options.volumes) {
    results.volumes = docker.listUnusedVolumes();
  }
  if (options.networks) {
    results.networks = docker.listUnusedNetworks();
  }
  if (options.buildcache) {
    results.buildcache = docker.listBuildCache();
  }

  return results;
}

/**
 * Calculate total items found across all scanned resource types.
 */
function totalItems(scanResults) {
  let count = 0;
  for (const key of Object.keys(scanResults)) {
    count += scanResults[key].length;
  }
  return count;
}

/**
 * Execute cleanup for all requested resource types.
 * @param {Object} options - Which resources to clean
 * @returns {Object} cleanup results per resource type
 */
function clean(options) {
  const results = {};

  if (options.images) {
    results.images = docker.pruneImages();
  }
  if (options.containers) {
    results.containers = docker.pruneContainers();
  }
  if (options.volumes) {
    results.volumes = docker.pruneVolumes();
  }
  if (options.networks) {
    results.networks = docker.pruneNetworks();
  }
  if (options.buildcache) {
    results.buildcache = docker.pruneBuildCache();
  }

  return results;
}

/**
 * Collect reclaimed space from clean results.
 * @param {Object} cleanResults
 * @returns {Object} { perType: { images: '1.2GB', ... }, total: estimated }
 */
function summarizeReclaimed(cleanResults) {
  const perType = {};
  const sizes = [];

  for (const [key, result] of Object.entries(cleanResults)) {
    const space = result.reclaimedSpace || '0B';
    perType[key] = space;
    sizes.push(parseSize(space));
  }

  const totalBytes = sizes.reduce((a, b) => a + b, 0);

  return {
    perType,
    totalBytes,
    totalFormatted: formatSize(totalBytes),
  };
}

/**
 * Parse a Docker size string (e.g. "1.2GB", "500MB", "3.4kB") into bytes.
 */
function parseSize(str) {
  if (!str || str === 'N/A') return 0;
  const cleaned = str.replace(/,/g, '').trim();
  const match = cleaned.match(/^([\d.]+)\s*(B|kB|KB|MB|GB|TB)$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(value * (multipliers[unit] || 1));
}

/**
 * Format bytes into a human-readable string.
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const index = Math.min(i, units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

module.exports = {
  scan,
  totalItems,
  clean,
  summarizeReclaimed,
  parseSize,
  formatSize,
};
