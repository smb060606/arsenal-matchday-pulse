<script lang="ts">
  import { onMount } from 'svelte';

  type Platform = 'bsky' | 'twitter' | 'threads';
  type OverrideAction = 'include' | 'exclude';
  type OverrideScope = 'global' | 'match';

  type AccountOverride = {
    id: string;
    platform: Platform;
    identifier_type: 'did' | 'handle' | 'user_id';
    identifier: string;
    handle: string | null;
    action: OverrideAction;
    scope: OverrideScope;
    match_id: string | null;
    bypass_eligibility: boolean;
    notes: string | null;
    expires_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  };

  let adminToken: string = '';
  let platform: Platform = 'bsky';
  let matchId: string = '';
  let loading = false;
  let errorMsg = '';
  let infoMsg = '';

  let include: AccountOverride[] = [];
  let exclude: AccountOverride[] = [];

  // New override form
  let form = {
    platform: 'bsky' as Platform,
    identifier_type: 'handle' as 'did' | 'handle' | 'user_id',
    identifier: '',
    handle: '',
    action: 'include' as OverrideAction,
    scope: 'global' as OverrideScope,
    match_id: '',
    bypass_eligibility: true,
    notes: '',
    expires_at: '' // ISO date string
  };

  function saveToken() {
    try {
      localStorage.setItem('ADMIN_TOKEN', adminToken);
      infoMsg = 'Admin token saved locally';
      setTimeout(() => (infoMsg = ''), 2500);
    } catch {
      // ignore
    }
  }

  function loadToken() {
    try {
      const t = localStorage.getItem('ADMIN_TOKEN');
      if (t) adminToken = t;
    } catch {
      // ignore
    }
  }

  async function loadOverrides() {
    errorMsg = '';
    infoMsg = '';
    loading = true;
    include = [];
    exclude = [];
    try {
      const qs = new URLSearchParams({
        platform,
        ...(matchId ? { matchId } : {})
      }).toString();
      const res = await fetch(`/api/admin/accounts/overrides?${qs}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to load overrides (${res.status})`);
      }
      const data = await res.json();
      include = data.include ?? [];
      exclude = data.exclude ?? [];
    } catch (e: any) {
      errorMsg = e?.message ?? 'Failed to load overrides';
    } finally {
      loading = false;
    }
  }

  async function submitOverride() {
    errorMsg = '';
    infoMsg = '';
    loading = true;
    try {
      const payload: any = {
        platform: form.platform,
        identifier_type: form.identifier_type,
        identifier: form.identifier.trim(),
        handle: form.handle?.trim() || null,
        action: form.action,
        scope: form.scope,
        match_id: form.scope === 'match' ? form.match_id.trim() || null : null,
        bypass_eligibility: !!form.bypass_eligibility,
        notes: form.notes?.trim() || null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null
      };
      if (!payload.identifier) {
        throw new Error('Identifier is required');
      }
      if (payload.scope === 'match' && !payload.match_id) {
        throw new Error('match_id is required when scope=match');
      }
      const res = await fetch('/api/admin/accounts/overrides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error(`Failed to save override (${res.status})`);
      }
      infoMsg = 'Override saved';
      await loadOverrides();
      // Reset some fields
      form.identifier = '';
      form.handle = '';
      form.notes = '';
    } catch (e: any) {
      errorMsg = e?.message ?? 'Failed to save override';
    } finally {
      loading = false;
    }
  }

  async function removeOverride(id: string) {
    errorMsg = '';
    infoMsg = '';
    loading = true;
    try {
      const res = await fetch(`/api/admin/accounts/overrides?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to delete override (${res.status})`);
      }
      infoMsg = 'Override deleted';
      await loadOverrides();
    } catch (e: any) {
      errorMsg = e?.message ?? 'Failed to delete override';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadToken();
  });
</script>

<section class="container">
  <h1>Admin: Account Overrides</h1>

  <div class="card">
    <h2>Admin Token</h2>
    <div class="row">
      <input
        type="password"
        placeholder="Enter ADMIN_TOKEN"
        bind:value={adminToken}
        autocomplete="off"
      />
      <button on:click={saveToken}>Save</button>
    </div>
    <small>Token stored in this browser's localStorage for convenience. Do not share.</small>
  </div>

  <div class="card">
    <h2>View Overrides</h2>
    <div class="row">
      <label>
        Platform
        <select bind:value={platform}>
          <option value="bsky">Bluesky</option>
          <option value="twitter">Twitter</option>
          <option value="threads">Threads</option>
        </select>
      </label>
      <label>
        Match ID (optional)
        <input type="text" placeholder="e.g., 2025-10-19-ARS-CHE" bind:value={matchId} />
      </label>
      <button disabled={loading} on:click={loadOverrides}>Load Overrides</button>
    </div>

    {#if loading}
      <p>Loading...</p>
    {/if}

    {#if errorMsg}
      <p class="error">{errorMsg}</p>
    {/if}

    {#if infoMsg}
      <p class="info">{infoMsg}</p>
    {/if}

    <div class="grid">
      <div>
        <h3>Include ({include.length})</h3>
        {#if include.length === 0}
          <p class="muted">None</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Match</th>
                <th>Bypass</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each include as o}
                <tr>
                  <td>{o.identifier}</td>
                  <td>{o.identifier_type}</td>
                  <td>{o.scope}</td>
                  <td>{o.match_id ?? '-'}</td>
                  <td>{o.bypass_eligibility ? 'true' : 'false'}</td>
                  <td>{o.expires_at ? new Date(o.expires_at).toLocaleString() : '-'}</td>
                  <td><button class="danger" on:click={() => removeOverride(o.id)}>Delete</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>

      <div>
        <h3>Exclude ({exclude.length})</h3>
        {#if exclude.length === 0}
          <p class="muted">None</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Type</th>
                <th>Scope</th>
                <th>Match</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each exclude as o}
                <tr>
                  <td>{o.identifier}</td>
                  <td>{o.identifier_type}</td>
                  <td>{o.scope}</td>
                  <td>{o.match_id ?? '-'}</td>
                  <td>{o.expires_at ? new Date(o.expires_at).toLocaleString() : '-'}</td>
                  <td><button class="danger" on:click={() => removeOverride(o.id)}>Delete</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    </div>
  </div>

  <div class="card">
    <h2>Add Override</h2>
    <form on:submit|preventDefault={submitOverride}>
      <div class="grid">
        <label>
          Platform
          <select bind:value={form.platform}>
            <option value="bsky">Bluesky</option>
            <option value="twitter">Twitter</option>
            <option value="threads">Threads</option>
          </select>
        </label>

        <label>
          Action
          <select bind:value={form.action}>
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </select>
        </label>

        <label>
          Scope
          <select bind:value={form.scope}>
            <option value="global">Global</option>
            <option value="match">Match</option>
          </select>
        </label>

        <label>
          Match ID
          <input type="text" placeholder="only if scope=match" bind:value={form.match_id} />
        </label>

        <label>
          Identifier Type
          <select bind:value={form.identifier_type}>
            <option value="handle">handle</option>
            <option value="did">did (Bluesky)</option>
            <option value="user_id">user_id (Twitter)</option>
          </select>
        </label>

        <label>
          Identifier
          <input type="text" placeholder="@handle or DID/user_id" bind:value={form.identifier} required />
        </label>

        <label>
          Handle (optional)
          <input type="text" placeholder="@handle" bind:value={form.handle} />
        </label>

        <label>
          Bypass Eligibility
          <input type="checkbox" bind:checked={form.bypass_eligibility} />
        </label>

        <label>
          Expires At (optional)
          <input type="datetime-local" bind:value={form.expires_at} />
        </label>

        <label class="wide">
          Notes
          <input type="text" placeholder="reason or context" bind:value={form.notes} />
        </label>
      </div>

      <div class="row">
        <button type="submit" disabled={loading}>Save Override</button>
      </div>
    </form>
  </div>
</section>

<style>
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem;
  }
  .card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
    background: #fff;
  }
  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr 1fr;
  }
  .grid .wide {
    grid-column: 1 / -1;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    border-bottom: 1px solid #eee;
    padding: 0.5rem;
    text-align: left;
  }
  .danger {
    background: #c62828;
    color: #fff;
    border: none;
    padding: 0.4rem 0.7rem;
    border-radius: 4px;
    cursor: pointer;
  }
  .muted {
    color: #666;
  }
  .error { color: #b00020; }
  .info { color: #2e7d32; }
</style>
