<script lang="ts">
  export let params: { matchId: string };
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-2">Compare Platforms — {params.matchId}</h1>
    <p class="text-gray-600">Charts showing sentiment over time, topics, and volume across platforms will appear here.</p>
  </div>
</div>
