'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseSize, formatSize, totalItems, summarizeReclaimed } = require('../src/cleaner');

// --- parseSize ---

describe('parseSize', () => {
  it('parses bytes', () => {
    assert.equal(parseSize('100B'), 100);
  });

  it('parses kilobytes', () => {
    assert.equal(parseSize('1KB'), 1024);
    assert.equal(parseSize('2.5kB'), 2560);
  });

  it('parses megabytes', () => {
    assert.equal(parseSize('10MB'), 10 * 1024 * 1024);
    assert.equal(parseSize('1.5MB'), Math.round(1.5 * 1024 * 1024));
  });

  it('parses gigabytes', () => {
    assert.equal(parseSize('1GB'), 1024 * 1024 * 1024);
    assert.equal(parseSize('2.5GB'), Math.round(2.5 * 1024 * 1024 * 1024));
  });

  it('parses terabytes', () => {
    assert.equal(parseSize('1TB'), 1024 * 1024 * 1024 * 1024);
  });

  it('handles zero and empty', () => {
    assert.equal(parseSize('0B'), 0);
    assert.equal(parseSize(''), 0);
    assert.equal(parseSize(null), 0);
    assert.equal(parseSize(undefined), 0);
    assert.equal(parseSize('N/A'), 0);
  });

  it('handles strings with commas', () => {
    assert.equal(parseSize('1,024MB'), 1024 * 1024 * 1024);
  });

  it('returns 0 for unparseable strings', () => {
    assert.equal(parseSize('hello'), 0);
    assert.equal(parseSize('??'), 0);
  });
});

// --- formatSize ---

describe('formatSize', () => {
  it('formats 0 bytes', () => {
    assert.equal(formatSize(0), '0 B');
  });

  it('formats bytes', () => {
    assert.equal(formatSize(500), '500 B');
  });

  it('formats kilobytes', () => {
    assert.equal(formatSize(1024), '1.00 KB');
    assert.equal(formatSize(2048), '2.00 KB');
  });

  it('formats megabytes', () => {
    assert.equal(formatSize(1024 * 1024), '1.00 MB');
    assert.equal(formatSize(5.5 * 1024 * 1024), '5.50 MB');
  });

  it('formats gigabytes', () => {
    assert.equal(formatSize(1024 * 1024 * 1024), '1.00 GB');
  });

  it('formats terabytes', () => {
    assert.equal(formatSize(1024 * 1024 * 1024 * 1024), '1.00 TB');
  });
});

// --- totalItems ---

describe('totalItems', () => {
  it('counts items across all types', () => {
    const scan = {
      images: [{ id: 'a' }, { id: 'b' }],
      containers: [{ id: 'c' }],
      volumes: [],
    };
    assert.equal(totalItems(scan), 3);
  });

  it('returns 0 for empty scan', () => {
    assert.equal(totalItems({}), 0);
  });

  it('returns 0 when all arrays empty', () => {
    assert.equal(totalItems({ images: [], containers: [], volumes: [] }), 0);
  });
});

// --- summarizeReclaimed ---

describe('summarizeReclaimed', () => {
  it('sums reclaimed space across types', () => {
    const cleanResults = {
      images: { reclaimedSpace: '1GB' },
      containers: { reclaimedSpace: '500MB' },
    };
    const summary = summarizeReclaimed(cleanResults);

    assert.equal(summary.perType.images, '1GB');
    assert.equal(summary.perType.containers, '500MB');
    assert.equal(summary.totalBytes, 1024 * 1024 * 1024 + 500 * 1024 * 1024);
    assert.equal(summary.totalFormatted, '1.49 GB');
  });

  it('handles zero reclaimed', () => {
    const cleanResults = {
      images: { reclaimedSpace: '0B' },
    };
    const summary = summarizeReclaimed(cleanResults);
    assert.equal(summary.totalBytes, 0);
    assert.equal(summary.totalFormatted, '0 B');
  });

  it('handles missing reclaimedSpace', () => {
    const cleanResults = {
      networks: { output: 'some output' },
    };
    const summary = summarizeReclaimed(cleanResults);
    assert.equal(summary.totalBytes, 0);
  });
});
