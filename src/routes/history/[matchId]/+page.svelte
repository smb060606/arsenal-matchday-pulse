<script lang="ts">
  export let data: {
    matchId: string;
    platform: 'bsky' | 'twitter' | 'threads' | 'all';
    phase: 'pre' | 'live' | 'post' | 'all';
    generatedAt: string;
    count: number;
    summaries: Array<{
      id: string;
      match_id: string;
      platform: 'bsky' | 'twitter' | 'threads';
      phase: 'pre' | 'live' | 'post';
      generated_at: string;
      summary_text: string;
      sentiment: { pos: number; neu: number; neg: number; counts?: { total?: number } };
      topics: Array<{ keyword: string; count: number }>;
      samples: Array<{ authorHandle: string; text: string; createdAt: string }>;
      accounts_used: Array<{ did?: string; handle?: string; displayName?: string }>;
      created_at: string;
    }>;
    error?: string;
  };

  let platform = data.platform ?? 'bsky';
  let phase = data.phase ?? 'all';

  function updateFilter() {
    const params = new URLSearchParams();
    params.set('platform', platform);
    params.set('phase', phase);
    window.location.search = params.toString();
  }
</script>

<style>
  .container { max-width: 1100px; margin: 1rem auto; padding: 1rem; }
  .muted { color: #6b7280; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
  .chips { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem; }
  .chip { font-size: 0.75rem; padding: 0.15rem 0.45rem; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 999px; }
  .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; background: #fff; }
  .row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .grid { display: grid; gap: 0.75rem; }
  @media (min-width: 900px) {
    .grid { grid-template-columns: 1fr 1fr; }
  }
</style>

<div class="container">
  <h1>Summaries History — <span class="mono">{data.matchId}</span></h1>
  <div class="muted">Generated: <span class="mono">{data.generatedAt}</span></div>

  <div class="row" style="margin:0.5rem 0 1rem 0;">
    <label class="muted">Platform</label>
    <select bind:value={platform} class="border rounded px-2 py-1 text-sm" on:change={updateFilter}>
      <option value="bsky">Bluesky</option>
      <option value="twitter">Twitter</option>
      <option value="threads">Threads</option>
      <option value="all">All</option>
    </select>

    <label class="muted" style="margin-left:1rem;">Phase</label>
    <select bind:value={phase} class="border rounded px-2 py-1 text-sm" on:change={updateFilter}>
      <option value="pre">Pre</option>
      <option value="live">Live</option>
      <option value="post">Post</option>
      <option value="all">All</option>
    </select>

    <div class="chip">Count: {data.count}</div>
  </div>

  {#if data.error}
    <div class="card">
      <div class="muted">Error: {data.error}</div>
    </div>
  {:else if data.count === 0}
    <div class="card">
      <div class="muted">No summaries found for the selected filters.</div>
    </div>
  {:else}
    <div class="grid">
      {#each data.summaries as s}
        <div class="card">
          <div class="row">
            <div class="chip">{s.platform.toUpperCase()}</div>
            <div class="chip">{s.phase.toUpperCase()}</div>
            <div class="muted">Generated: <span class="mono">{new Date(s.generated_at).toLocaleString()}</span></div>
          </div>

          <div class="row" style="margin-top:0.35rem;">
            <div class="chip">pos {(s.sentiment?.pos * 100).toFixed(0)}%</div>
            <div class="chip">neu {(s.sentiment?.neu * 100).toFixed(0)}%</div>
            <div class="chip">neg {(s.sentiment?.neg * 100).toFixed(0)}%</div>
            {#if s.sentiment?.counts?.total != null}
              <div class="chip">posts {s.sentiment.counts.total}</div>
            {/if}
            <div class="chip">accounts {Array.isArray(s.accounts_used) ? s.accounts_used.length : 0}</div>
          </div>

          <div style="margin-top:0.5rem;">
            <h3>Summary</h3>
            <div class="muted" style="white-space:pre-wrap;">{s.summary_text}</div>
          </div>

          <div style="margin-top:0.5rem;">
            <h3>Topics</h3>
            <div class="chips">
              {#each s.topics?.slice(0,8) ?? [] as t}
                <span class="chip">{t.keyword} • {t.count}</span>
              {/each}
              {#if !(s.topics?.length)}
                <span class="muted">No topics</span>
              {/if}
            </div>
          </div>

          <div style="margin-top:0.5rem;">
            <h3>Samples</h3>
            {#if s.samples?.length}
              {#each s.samples.slice(0,3) as sm}
                <div style="margin: 0.35rem 0;">
                  <span class="mono">@{sm.authorHandle}</span> — <span class="muted">{new Date(sm.createdAt).toLocaleTimeString()}</span>
                  <div>{sm.text}</div>
                </div>
              {/each}
            {:else}
              <div class="muted">No samples</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
