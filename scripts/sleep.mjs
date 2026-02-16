#!/usr/bin/env node
// Cross-platform sleep utility
const seconds = parseFloat(process.argv[2] || '0');
await new Promise(resolve => setTimeout(resolve, seconds * 1000));
