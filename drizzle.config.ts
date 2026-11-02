import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Same .env resolution as Next.js (.env.local, .env, …) so `vercel env pull` output just works.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
