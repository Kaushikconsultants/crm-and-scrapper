import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app');

files.forEach(file => {
  let original = fs.readFileSync(file, 'utf8');
  let content = original;

  // Background replacements
  content = content.replace(/bg-\[\#0a0a0a\]/g, 'bg-white');
  content = content.replace(/bg-\[\#0c0c0c\]/g, 'bg-white');
  content = content.replace(/bg-\[\#0d0d0d\]/g, 'bg-white');
  content = content.replace(/bg-\[\#121212\]/g, 'bg-white');
  content = content.replace(/bg-\[\#1e1e1e\]/g, 'bg-gray-50');
  content = content.replace(/bg-gray-950/g, 'bg-gray-50');
  content = content.replace(/bg-slate-950/g, 'bg-gray-50');
  content = content.replace(/bg-zinc-950/g, 'bg-gray-50');
  content = content.replace(/bg-black/g, 'bg-white');

  // Input styling in login / modals
  content = content.replace(/bg-\[\#0a0a0a\] text-gray-900/g, 'bg-white text-gray-900');
  content = content.replace(/bg-\[\#050505\] text-gray-900/g, 'bg-white text-gray-900');
  
  // Restore button text colors to white for strong backgrounds
  content = content.replace(/bg-blue-600 text-gray-900/g, 'bg-blue-600 text-white');
  content = content.replace(/bg-blue-500 text-gray-900/g, 'bg-blue-500 text-white');
  content = content.replace(/bg-emerald-600 text-gray-900/g, 'bg-emerald-600 text-white');
  content = content.replace(/bg-emerald-500 text-gray-900/g, 'bg-emerald-500 text-white');
  content = content.replace(/bg-rose-600 text-gray-900/g, 'bg-rose-600 text-white');
  content = content.replace(/bg-rose-500 text-gray-900/g, 'bg-rose-500 text-white');

  // Also replace headers with gradient texts that turn white
  content = content.replace(/from-white to-gray-400/g, 'from-gray-900 to-gray-600');
  content = content.replace(/from-white to-gray-500/g, 'from-gray-900 to-gray-600');
  
  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log("V3 Theme clean-up complete!");
