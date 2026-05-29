// github-secrets.js — atualiza secrets do repo via GitHub API (sealed box libsodium).
// Fecha o loop do refresh de token: o token novo é gravado de volta no secret,
// sem intervenção manual.
//
// ⚠️ O GITHUB_TOKEN padrão NÃO tem permissão de escrita em Actions secrets.
// Use um PAT fine-grained com "Secrets: write" no repo, em GH_ADMIN_TOKEN.

import _sodium from 'libsodium-wrappers';

function ghToken() {
  return process.env.GH_ADMIN_TOKEN || null;
}

function repo() {
  const r = process.env.GITHUB_REPOSITORY;
  if (!r) throw new Error('GITHUB_REPOSITORY ausente');
  return r;
}

export function canUpdateSecrets() {
  return !!ghToken();
}

async function gh(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ghToken()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// Encripta e grava o valor no secret. Sealed box com a chave pública do repo.
export async function updateSecret(name, value) {
  if (!ghToken()) throw new Error('GH_ADMIN_TOKEN ausente — não dá pra atualizar secret automaticamente');
  await _sodium.ready;
  const sodium = _sodium;
  const { key, key_id } = await gh('/actions/secrets/public-key');
  const binKey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
  const binVal = sodium.from_string(value);
  const encrypted = sodium.crypto_box_seal(binVal, binKey);
  const encrypted_value = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);
  await gh(`/actions/secrets/${name}`, { method: 'PUT', body: { encrypted_value, key_id } });
}
