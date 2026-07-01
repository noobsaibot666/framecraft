import { createPrompt, getPromptById } from "./src/lib/db";

async function run() {
  const bigData = "data:image/png;base64," + "A".repeat(5 * 1024 * 1024); // 5MB
  console.log("Creating prompt with 5MB thumbnail_data...");
  const id = await createPrompt({
    title: "Test Large Thumbnail",
    provider: "midjourney",
    prompt_text: "test",
    thumbnail_data: bigData
  });
  console.log("Created ID:", id);
  const p = await getPromptById(id);
  console.log("Fetched thumbnail_data length:", p?.thumbnail_data?.length);
}
run().catch(console.error);
