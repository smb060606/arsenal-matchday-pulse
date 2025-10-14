import adapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Ensure Vercel uses Node.js 20 runtime for SvelteKit build/serve
      runtime: "nodejs20.x"
    })
  }
};

export default config;
