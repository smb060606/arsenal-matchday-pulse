<script lang="ts">
  const links = [
    { href: "/match/demo", label: "Demo Match (Pre | Live | Post)" },
    { href: "/accounts/bsky", label: "Accounts (Bluesky)" },
    { href: "/accounts/twitter", label: "Accounts (Twitter)" },
    { href: "/compare/demo", label: "Compare View (Demo)" }
  ];
</script>

<div class="min-h-screen bg-gray-50 text-gray-900">
  <div class="max-w-3xl mx-auto p-6">
    <h1 class="text-3xl font-bold mb-2">Arsenal Matchday Pulse</h1>
    <p class="text-gray-600 mb-6">
      Per-platform fan sentiment livestream for Arsenal matchdays: Bluesky (Phase 1), Twitter best-effort (Phase 1), Threads (Phase 2).
    </p>

    <ul class="space-y-2">
      {#each links as link}
        <li>
          <a class="text-red-700 underline" href={link.href}>{link.label}</a>
        </li>
      {/each}
    </ul>
  </div>
</div>
