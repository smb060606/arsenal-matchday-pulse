/**
 * Post latest merged PR commit IDs and titles to Slack via Remote MCP.
 *
 * Requirements:
 * - Node 20+ (global fetch available)
 * - Env:
 *   - GITHUB_OWNER (default: smb060606)
 *   - GITHUB_REPO (default: arsenal-matchday-pulse)
 *   - MCP_BASE_URL (e.g., https://<service>.up.railway.app)
 *   - MCP_AUTH_TOKEN (Bearer token protecting /mcp endpoints)
 *   - SLACK_CHANNEL (default: #cline)
 *
 * Usage:
 *   MCP_BASE_URL="https://your-url" MCP_AUTH_TOKEN="..." node scripts/post-latest-pr-remote.mjs
 */

const OWNER = process.env.GITHUB_OWNER || 'smb060606';
const REPO = process.env.GITHUB_REPO || 'arsenal-matchday-pulse';
const BASE_URL = process.env.MCP_BASE_URL;
const MCP_TOKEN = process.env.MCP_AUTH_TOKEN;
const CHANNEL = process.env.SLACK_CHANNEL || '#cline';

if (!BASE_URL || !MCP_TOKEN) {
  console.error('Error: MCP_BASE_URL and MCP_AUTH_TOKEN environment variables are required.');
  process.exit(1);
}

function assertOk(res, context) {
  if (!res.ok) {
    throw new Error(`${context} failed: ${res.status} ${res.statusText}`);
  }
}

async function fetchLatestMergedPrNumber(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&per_page=50`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'remote-mcp-github-client'
    }
  });
  assertOk(res, 'List PRs');
  const prs = await res.json();
  const merged = prs.filter(p => p.merged_at != null);
  if (merged.length === 0) {
    throw new Error('No merged PRs found.');
  }
  merged.sort((a, b) => new Date(a.merged_at) - new Date(b.merged_at));
  return merged[merged.length - 1].number;
}

async function fetchPrCommits(owner, repo, prNumber) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'remote-mcp-github-client'
    }
  });
  assertOk(res, 'List PR commits');
  const commits = await res.json();
  return commits.map(c => {
    const sha7 = (c.sha || '').slice(0, 7);
    const title = (c.commit?.message || '').split('\n')[0];
    return `${sha7} - ${title}`;
  });
}

async function postViaRemoteMcp(baseUrl, token, channel, text) {
  const url = `${baseUrl.replace(/\/$/, '')}/mcp/call`;
  const body = {
    name: 'send_message',
    arguments: {
      channel,
      text
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  assertOk(res, 'MCP call send_message');
  return res.json();
}

(async () => {
  try {
    console.log(`Owner: ${OWNER}, Repo: ${REPO}`);
    const prNumber = await fetchLatestMergedPrNumber(OWNER, REPO);
    console.log(`Latest merged PR: #${prNumber}`);

    const lines = await fetchPrCommits(OWNER, REPO, prNumber);
    if (!lines.length) {
      console.log('No commits found in the latest merged PR.');
      return;
    }

    const text = lines.join('\n');
    console.log(`Posting ${lines.length} commits to ${CHANNEL} via ${BASE_URL} ...`);

    const result = await postViaRemoteMcp(BASE_URL, MCP_TOKEN, CHANNEL, text);
    console.log('Posted successfully via remote MCP:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Failure:', err.message);
    process.exit(1);
  }
})();
