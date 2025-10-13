<script lang="ts">
  export let params: { platform: string };
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <div class="max-w-3xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-2">Accounts — {params.platform}</h1>
    <p class="text-gray-600">This page will list the accounts selected for synthesis for a given match window.</p>
  </div>
</div>
