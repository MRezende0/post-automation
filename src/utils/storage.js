// storage.js — upload de mídia (PNG dos posts, PDF do carrossel do LinkedIn) pra storage público.
// Sob STATE_BACKEND=supabase → Supabase Storage (bucket público, repo não incha).
// Senão → repo do GitHub via REST API (raw.githubusercontent). Retorna URL pública.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { usingSupabase, supabase } from './db.js';

const API = 'https://api.github.com';
const BUCKET = process.env.SUPABASE_BUCKET || 'post-images';

const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.pdf': 'application/pdf', '.mp4': 'video/mp4' };

export function contentTypeFor(file) {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

async function uploadToSupabase(localPath) {
  const buf = await readFile(localPath);
  const folder = contentTypeFor(localPath) === 'application/pdf' ? 'documents' : 'images';
  const key = `${folder}/${Date.now()}-${path.basename(localPath)}`;
  const db = supabase();
  const { error } = await db.storage.from(BUCKET).upload(key, buf, { contentType: contentTypeFor(localPath), upsert: false });
  if (error) throw new Error(`Supabase Storage upload ${BUCKET}: ${error.message}`);
  const { data } = db.storage.from(BUCKET).getPublicUrl(key);
  return { url: data.publicUrl, path: key };
}

function getRepo() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY ausente (formato: owner/repo)');
  return repo;
}

function getToken() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!t) throw new Error('GITHUB_TOKEN ausente (PAT local ou token do Actions)');
  return t;
}

function getBranch() {
  return process.env.STORAGE_BRANCH || 'main';
}

export async function uploadImage(localPath, { dir = 'content/images' } = {}) {
  if (usingSupabase()) return uploadToSupabase(localPath);

  const buf = await readFile(localPath);
  const filename = `${Date.now()}-${path.basename(localPath)}`;
  const repoPath = `${dir}/${filename}`;
  const repo = getRepo();
  const branch = getBranch();

  const res = await fetch(`${API}/repos/${repo}/contents/${repoPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: `chore: upload ${filename}`,
      content: buf.toString('base64'),
      branch,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub upload ${res.status}: ${text}`);
  }

  const json = await res.json();
  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${repoPath}`;
  return { url, sha: json.content?.sha, path: repoPath };
}
