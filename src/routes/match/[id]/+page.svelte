<script lang="ts">
  import { onMount } from "svelte";
  export let params: { id: string };
  let active: "pre" | "live" | "post" = "pre";
  let messages: string[] = [];

  function connect(platform: "bsky" | "twitter") {
    const url = `/live/${platform}/stream.sse?matchId=${params.id}`;
    const es = new EventSource(url);
    es.onmessage = (ev) => {
      messages = [`${platform.toUpperCase()} :: ${ev.data}`, ...messages].slice(0, 50);
    };
    es.onerror = () => es.close();
    return es;
  }

  let esB: EventSource | null = null;
  let esT: EventSource | null = null;

  onMount(() => {
    esB = connect("bsky");
    esT = connect("twitter");
    return () => {
      esB?.close();
      esT?.close();
    };
  });

  // AI Summary UI state
  let summaryOpen = false;
  let summaryLoading = false;
  let summaryError: string | null = null;
  let summaryText: string | null = null;
  let summaryPlatform: "combined" | "bsky" | "twitter" | "threads" = "combined";
  let windowMinutes = 15;

  async function loadSummary() {
    summaryLoading = true;
    summaryError = null;
    summaryText = null;
    try {
      const res = await fetch(
        `/api/summaries/latest?matchId=${encodeURIComponent(params.id)}&platform=${encodeURIComponent(
          summaryPlatform
        )}&sinceMin=${encodeURIComponent(String(windowMinutes))}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Request failed: ${res.status}`);
      }
      const data = await res.json();
      summaryText = data?.summary || "(No summary generated yet)";
    } catch (e: any) {
      summaryError = e?.message || "Failed to load summary";
    } finally {
      summaryLoading = false;
    }
  }
</script>

<div class="min-h-screen bg-white text-gray-900">
  <div class="max-w-5xl mx-auto p-6 space-y-6">
    <h1 class="text-2xl font-bold">Match: {params.id}</h1>

    <div class="flex gap-2">
      <button class="px-3 py-1 rounded border" on:click={() => (active = "pre")}>Pre</button>
      <button class="px-3 py-1 rounded border" on:click={() => (active = "live")}>Live</button>
      <button class="px-3 py-1 rounded border" on:click={() => (active = "post")}>Post</button>
    </div>

    <div class="border rounded p-4">
      <h2 class="font-semibold mb-2">Live Stream (Mock)</h2>
      <ul class="space-y-1">
        {#each messages as m}
          <li class="text-sm font-mono">{m}</li>
        {/each}
      </ul>
    </div>

    <div class="border rounded p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold">AI Summary (last 15 minutes)</h2>
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600">Platform</label>
          <select bind:value={summaryPlatform} class="border rounded px-2 py-1 text-sm">
            <option value="combined">Combined</option>
            <option value="bsky">Bluesky</option>
            <option value="twitter">Twitter</option>
            <option value="threads">Threads</option>
          </select>
          <label class="text-sm text-gray-600">Window (min)</label>
          <input class="border rounded px-2 py-1 w-20 text-sm" type="number" min="5" max="60" step="5" bind:value={windowMinutes} />
          <button
            class="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100"
            on:click={() => {
              summaryOpen = true;
              void loadSummary();
            }}
            disabled={summaryLoading}
          >
            {summaryLoading ? "Loading..." : "View AI Summary"}
          </button>
        </div>
      </div>

      {#if summaryOpen}
        <div class="rounded bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-line">
          {#if summaryError}
            <div class="text-red-600">Error: {summaryError}</div>
          {:else if summaryText}
            {summaryText}
          {:else}
            <div class="text-gray-500">No summary available yet. Try again later.</div>
          {/if}
        </div>
        <div class="text-xs text-gray-500">
          Summaries are generated every 15 minutes from recent posts. Content is aggregate-only and avoids personal data.
        </div>
      {/if}
    </div>
  </div>
</div>
