'use strict';

const chalk = require('chalk');
const Table = require('cli-table3');

const LABELS = {
  images: 'Dangling Images',
  containers: 'Stopped Containers',
  volumes: 'Unused Volumes',
  networks: 'Unused Networks',
  buildcache: 'Build Cache',
};

const ICONS = {
  images: '\u25CF',
  containers: '\u25A0',
  volumes: '\u25B2',
  networks: '\u25C6',
  buildcache: '\u2699',
};

/**
 * Print the banner.
 */
function printBanner() {
  console.log('');
  console.log(chalk.bold.cyan('  dockclean') + chalk.gray(' — Docker System Cleanup'));
  console.log(chalk.gray('  ' + '─'.repeat(40)));
  console.log('');
}

/**
 * Print disk usage snapshot from `docker system df`.
 */
function printDiskUsage(dfData, label) {
  const table = new Table({
    head: [
      chalk.white.bold('Type'),
      chalk.white.bold('Total'),
      chalk.white.bold('Active'),
      chalk.white.bold('Size'),
      chalk.white.bold('Reclaimable'),
    ],
    colWidths: [20, 10, 10, 15, 20],
    style: { head: [], border: ['gray'] },
  });

  for (const entry of Object.values(dfData)) {
    table.push([
      entry.type,
      String(entry.total),
      String(entry.active),
      entry.size,
      chalk.yellow(entry.reclaimable),
    ]);
  }

  console.log(chalk.bold(`  ${label}:`));
  console.log(table.toString());
  console.log('');
}

/**
 * Print scan results (what will be cleaned).
 */
function printScanResults(scanResults) {
  for (const [type, items] of Object.entries(scanResults)) {
    const label = LABELS[type] || type;
    const icon = ICONS[type] || '>';

    if (items.length === 0) {
      console.log(chalk.gray(`  ${icon} ${label}: none found`));
      continue;
    }

    console.log(chalk.bold(`  ${icon} ${label} (${items.length}):`));
    console.log('');

    if (type === 'images') {
      const table = new Table({
        head: ['ID', 'Repository', 'Tag', 'Size', 'Created'].map((h) => chalk.white.bold(h)),
        colWidths: [16, 24, 12, 12, 18],
        style: { head: [], border: ['gray'] },
      });
      for (const img of items) {
        table.push([
          chalk.yellow(img.id.substring(0, 12)),
          img.repository || '<none>',
          img.tag || '<none>',
          img.size || 'N/A',
          img.created || '',
        ]);
      }
      console.log(table.toString());
    }

    if (type === 'containers') {
      const table = new Table({
        head: ['ID', 'Name', 'Image', 'Status', 'Size'].map((h) => chalk.white.bold(h)),
        colWidths: [16, 20, 20, 18, 14],
        style: { head: [], border: ['gray'] },
      });
      for (const c of items) {
        table.push([
          chalk.yellow(c.id.substring(0, 12)),
          c.name || '',
          c.image || '',
          c.status || '',
          c.size || 'N/A',
        ]);
      }
      console.log(table.toString());
    }

    if (type === 'volumes') {
      const table = new Table({
        head: ['Name', 'Driver'].map((h) => chalk.white.bold(h)),
        colWidths: [28, 14],
        style: { head: [], border: ['gray'] },
      });
      for (const v of items) {
        table.push([chalk.yellow(v.name), v.driver || '']);
      }
      console.log(table.toString());
    }

    if (type === 'networks') {
      const table = new Table({
        head: ['ID', 'Name', 'Driver', 'Scope'].map((h) => chalk.white.bold(h)),
        colWidths: [16, 24, 14, 12],
        style: { head: [], border: ['gray'] },
      });
      for (const n of items) {
        table.push([
          chalk.yellow(n.id.substring(0, 12)),
          n.name,
          n.driver || '',
          n.scope || '',
        ]);
      }
      console.log(table.toString());
    }

    if (type === 'buildcache') {
      const table = new Table({
        head: ['ID', 'Type', 'Size', 'Created', 'Last Used'].map((h) => chalk.white.bold(h)),
        colWidths: [20, 18, 12, 16, 16],
        style: { head: [], border: ['gray'] },
      });
      for (const b of items.slice(0, 20)) {
        table.push([
          chalk.yellow(b.id),
          b.type,
          b.size,
          b.createdSince || '',
          b.lastUsed || '',
        ]);
      }
      if (items.length > 20) {
        table.push([chalk.gray(`... and ${items.length - 20} more`), '', '', '', '']);
      }
      console.log(table.toString());
    }

    console.log('');
  }
}

/**
 * Print cleanup summary.
 */
function printCleanSummary(cleanResults, reclaimed) {
  console.log(chalk.bold.green('  Cleanup Complete'));
  console.log(chalk.gray('  ' + '─'.repeat(40)));
  console.log('');

  const table = new Table({
    head: [
      chalk.white.bold('Resource'),
      chalk.white.bold('Space Reclaimed'),
    ],
    colWidths: [24, 22],
    style: { head: [], border: ['gray'] },
  });

  for (const [type, space] of Object.entries(reclaimed.perType)) {
    const label = LABELS[type] || type;
    table.push([label, chalk.green(space)]);
  }

  table.push([
    chalk.bold('TOTAL'),
    chalk.bold.green(reclaimed.totalFormatted),
  ]);

  console.log(table.toString());
  console.log('');
}

/**
 * Print dry-run notice.
 */
function printDryRunNotice() {
  console.log(chalk.bgYellow.black(' DRY RUN ') + chalk.yellow(' No resources will be removed.'));
  console.log('');
}

/**
 * Print "nothing to clean" message.
 */
function printNothingToClean() {
  console.log(chalk.green('  Everything is clean! No unused resources found.'));
  console.log('');
}

/**
 * Format all results as JSON (for --json flag).
 */
function toJSON(scanResults, cleanResults, reclaimed, dfBefore, dfAfter) {
  return JSON.stringify(
    {
      scan: scanResults,
      cleaned: cleanResults
        ? Object.fromEntries(
            Object.entries(cleanResults).map(([k, v]) => [k, { reclaimedSpace: v.reclaimedSpace || '0B' }])
          )
        : null,
      reclaimed: reclaimed || null,
      diskUsage: {
        before: dfBefore,
        after: dfAfter || null,
      },
    },
    null,
    2
  );
}

module.exports = {
  printBanner,
  printDiskUsage,
  printScanResults,
  printCleanSummary,
  printDryRunNotice,
  printNothingToClean,
  toJSON,
  LABELS,
};
