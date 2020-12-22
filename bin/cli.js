#!/usr/bin/env node
'use strict';

/**
 * @fileoverview CLI for dockclean.
 * @author idirdev
 */

const { dryRun, clean, summary } = require('../src/index.js');

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const useJson = hasFlag('--json');
const isDryRun = hasFlag('--dry-run');
const isForce = hasFlag('--force');
const all = hasFlag('--all');

const opts = {
  containers: all || hasFlag('--containers'),
  images: all || hasFlag('--images'),
  volumes: all || hasFlag('--volumes'),
  networks: all || hasFlag('--networks'),
};

const anySelected = opts.containers || opts.images || opts.volumes || opts.networks;
if (!anySelected) {
  console.log('Usage: dockclean [--containers] [--images] [--volumes] [--networks] [--all] [--dry-run] [--force] [--json]');
  process.exit(0);
}

if (isDryRun) {
  const result = dryRun();
  if (useJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Dry run — would remove:');
    console.log(`  Containers : ${result.containers.length}`);
    console.log(`  Images     : ${result.images.length}`);
    console.log(`  Volumes    : ${result.volumes.length}`);
    console.log(`  Networks   : ${result.networks.length}`);
    if (result.warnings.length) console.log('Warnings:', result.warnings);
  }
} else {
  if (!isForce) {
    console.log('Pass --force to actually remove resources, or --dry-run to preview.');
    process.exit(0);
  }
  const results = clean(opts);
  if (useJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(summary(results));
  }
}
