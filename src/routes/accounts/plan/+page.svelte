<script lang="ts">
  export let data: {
    generatedAt: string;
    budgetPerPlatformDollars: number;
    platforms: {
      bsky: PlatformPlan;
      twitter: PlatformPlan;
      threads: PlatformPlan;
    };
  };

  type PlatformPlan = {
    platform: 'bsky' | 'twitter' | 'threads';
    status: 'ok' | 'unconfigured';
    budgetPerMonthDollars: number;
    costPerMonthDollars: number | null;
    notes?: string;
    maxAccountsAllowed?: number;
    selected?: Array<{
      did: string;
      handle: string;
      displayName?: string;
      followersCount?: number;
      postsCount?: number;
      createdAt?: string | null;
      eligibility: { eligible: boolean; reasons: string[] };
    }>;
  };

  const { platforms, budgetPerPlatformDollars, generatedAt } = data;
</script>

<style>
  .container {
    max-width: 1100px;
    margin: 1rem auto;
    padding: 1rem;
  }
  .grid {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: #fff;
  }
  .muted {
    color: #6b7280;
    font-size: 0.9rem;
  }
  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 6px;
    font-size: 0.8rem;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    margin-left: 0.5rem;
  }
  .status-ok { color: #065f46; }
  .status-unconfigured { color: #92400e; }
  .list {
    margin-top: 0.5rem;
    border-top: 1px dashed #e5e7eb;
    padding-top: 0.5rem;
  }
  .account {
    padding: 0.4rem 0;
    border-bottom: 1px dotted #f0f0f0;
  }
  .account:last-child {
    border-bottom: none;
  }
  .hstack {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    margin-top: 0.35rem;
  }
  .chip {
    font-size: 0.75rem;
    padding: 0.15rem 0.45rem;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
  }
  h1, h2, h3 {
    margin: 0.2rem 0 0.6rem 0;
  }
  .header {
    margin-bottom: 1rem;
  }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
</style>

<div class="container">
  <div class="header">
    <h1>Platform Budget Planner</h1>
    <div class="muted">Generated: <span class="mono">{generatedAt}</span></div>
    <div class="muted">Per-platform budget cap: ${budgetPerPlatformDollars}/month</div>
  </div>

  <div class="grid">
    <!-- Bluesky -->
    <div class="card">
      <h2>
        Bluesky
        <span class="badge {platforms.bsky.status === 'ok' ? 'status-ok' : 'status-unconfigured'}">
          {platforms.bsky.status.toUpperCase()}
        </span>
      </h2>
      <div class="muted">Notes: {platforms.bsky.notes || '—'}</div>
      <div class="hstack" style="margin-top:0.5rem;">
        <div>Budget: ${platforms.bsky.budgetPerMonthDollars}</div>
        <div>Cost: ${platforms.bsky.costPerMonthDollars ?? 0}</div>
        {#if platforms.bsky.maxAccountsAllowed != null}
          <div>Max accounts: {platforms.bsky.maxAccountsAllowed}</div>
        {/if}
      </div>

      {#if platforms.bsky.selected && platforms.bsky.selected.length}
        <div class="list">
          <h3>Selected Accounts ({platforms.bsky.selected.length})</h3>
          {#each platforms.bsky.selected as a}
            <div class="account">
              <div class="hstack">
                <strong>@{a.handle}</strong>
                {#if a.displayName}<span class="muted">({a.displayName})</span>{/if}
              </div>
              <div class="chips">
                {#if a.followersCount != null}<span class="chip">{a.followersCount} followers</span>{/if}
                {#if a.postsCount != null}<span class="chip">{a.postsCount} posts</span>{/if}
                {#if a.createdAt}<span class="chip">since {new Date(a.createdAt).toLocaleDateString()}</span>{/if}
              </div>
              {#if a.eligibility}
                <div class="chips">
                  {#each a.eligibility.reasons as r}
                    <span class="chip">{r}</span>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="muted" style="margin-top:0.5rem;">No accounts selected or not configured.</div>
      {/if}
    </div>

    <!-- Twitter -->
    <div class="card">
      <h2>
        Twitter (X)
        <span class="badge {platforms.twitter.status === 'ok' ? 'status-ok' : 'status-unconfigured'}">
          {platforms.twitter.status.toUpperCase()}
        </span>
      </h2>
      <div class="muted">Notes: {platforms.twitter.notes || '—'}</div>
      <div class="hstack" style="margin-top:0.5rem;">
        <div>Budget: ${platforms.twitter.budgetPerMonthDollars}</div>
        <div>Cost: {platforms.twitter.costPerMonthDollars == null ? '—' : `$${platforms.twitter.costPerMonthDollars}`}</div>
      </div>
      {#if platforms.twitter.status === 'unconfigured'}
        <div class="muted" style="margin-top:0.5rem;">
          To enable, set TWITTER_COST_PER_MONTH_DOLLARS in your environment (must be ≤ ${budgetPerPlatformDollars}).
        </div>
      {/if}
    </div>

    <!-- Threads -->
    <div class="card">
      <h2>
        Threads
        <span class="badge {platforms.threads.status === 'ok' ? 'status-ok' : 'status-unconfigured'}">
          {platforms.threads.status.toUpperCase()}
        </span>
      </h2>
      <div class="muted">Notes: {platforms.threads.notes || '—'}</div>
      <div class="hstack" style="margin-top:0.5rem;">
        <div>Budget: ${platforms.threads.budgetPerMonthDollars}</div>
        <div>Cost: {platforms.threads.costPerMonthDollars == null ? '—' : `$${platforms.threads.costPerMonthDollars}`}</div>
      </div>
      {#if platforms.threads.status === 'unconfigured'}
        <div class="muted" style="margin-top:0.5rem;">
          To enable, set THREADS_COST_PER_MONTH_DOLLARS in your environment (must be ≤ ${budgetPerPlatformDollars}).
        </div>
      {/if}
    </div>
  </div>
</div>
