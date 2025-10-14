<script lang="ts">
  export let data: {
    platform: string;
    generatedAt: string;
    count: number;
    accounts: Array<{
      did?: string;
      handle: string;
      displayName?: string;
      followersCount?: number;
      postsCount?: number;
      createdAt?: string | null;
      eligibility?: { eligible: boolean; reasons: string[] };
    }>;
  };
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <div class="max-w-4xl mx-auto p-6 space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold">Accounts — {data.platform}</h1>
      <p class="text-gray-600">
        Selected creator accounts used to synthesize sentiment for the current match window.
      </p>
      <p class="text-xs text-gray-500">
        Generated at {new Date(data.generatedAt).toLocaleString()} • {data.count} accounts
      </p>
    </header>

    {#if data.accounts?.length}
      <div class="overflow-x-auto rounded border border-gray-200 bg-white">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-gray-100 text-gray-700">
            <tr>
              <th class="px-4 py-3">Display Name</th>
              <th class="px-4 py-3">Handle</th>
              <th class="px-4 py-3">Followers</th>
              <th class="px-4 py-3">Account Age</th>
              <th class="px-4 py-3">Eligible</th>
              <th class="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {#each data.accounts as a}
              <tr class="border-t border-gray-100">
                <td class="px-4 py-3">{a.displayName ?? '—'}</td>
                <td class="px-4 py-3">
                  {#if data.platform === 'bsky'}
                    <a class="text-blue-600 hover:underline" href={"https://bsky.app/profile/" + a.handle} target="_blank" rel="noreferrer">
                      {a.handle}
                    </a>
                  {:else}
                    {a.handle}
                  {/if}
                </td>
                <td class="px-4 py-3">{a.followersCount ?? '—'}</td>
                <td class="px-4 py-3">
                  {#if a.createdAt}
                    {(() => {
                      const months = Math.floor((Date.now() - Date.parse(a.createdAt!)) / (1000 * 60 * 60 * 24 * 30));
                      return months + ' mo';
                    })()}
                  {:else}
                    unknown
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if a.eligibility}
                    <span class={"inline-flex items-center rounded px-2 py-0.5 text-xs " + (a.eligibility.eligible ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                      {a.eligibility.eligible ? 'Yes' : 'No'}
                    </span>
                  {:else}
                    —
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if a.eligibility?.reasons?.length}
                    <ul class="list-disc pl-4 space-y-0.5">
                      {#each a.eligibility.reasons as r}
                        <li class="text-gray-700">{r}</li>
                      {/each}
                    </ul>
                  {:else}
                    —
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="rounded border border-gray-200 bg-white p-6 text-sm text-gray-700">
        No accounts available yet. Try again closer to a match window or verify allowlist and eligibility thresholds.
      </div>
    {/if}

    <footer class="text-xs text-gray-500">
      Eligibility rules: followers ≥ 500; account age ≥ 6 months (Bluesky age approximation).
      Actual API visibility for account age may vary; if unknown, eligibility is based on followers/activity.
    </footer>
  </div>
</div>
