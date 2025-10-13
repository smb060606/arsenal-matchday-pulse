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
</script>

<div class="min-h-screen bg-white text-gray-900">
  <div class="max-w-5xl mx-auto p-6 space-y-4">
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
  </div>
</div>
