import { fetch as tauriFetch } from '@tauri-apps/api/http';
// we can't run tauri API in node. Let's just use node fetch to see if it's blocked.
async function run() {
  const res = await fetch("https://cdn.midjourney.com/391c5c0c-cdbe-4ee0-84c9-b7fbf7c1913c/0_0.png", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  console.log(res.status);
}
run();
