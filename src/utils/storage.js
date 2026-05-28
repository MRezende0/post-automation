// storage.js — upload de imagem pra repo público no GitHub via REST API.
// Retorna URL raw.githubusercontent.com pronta pra IG/LinkedIn consumirem.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.github.com';

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
