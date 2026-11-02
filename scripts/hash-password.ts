/**
 * Prints a bcrypt hash for ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-password -- "my long password"
 *   npm run hash-password            # prompts (input hidden)
 */
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";

const COST = 12;

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  // Mute echo of typed characters.
  const output = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WritableStream };
  output._writeToOutput = (s: string) => {
    if (s.includes(question)) process.stdout.write(s);
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

async function main() {
  let password = process.argv[2];
  if (!password) {
    if (!process.stdin.isTTY) {
      console.error('Usage: npm run hash-password -- "your password"');
      process.exit(1);
    }
    password = await promptHidden("Password: ");
    const again = await promptHidden("Repeat:   ");
    if (password !== again) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
  }
  if (password.length < 12) {
    console.warn("⚠  Use at least 12 characters (a passphrase of 4+ words is ideal).\n");
  }

  const hash = await bcrypt.hash(password, COST);
  const b64 = `b64:${Buffer.from(hash, "utf8").toString("base64")}`;

  console.log("Recommended (safe in .env files AND the Vercel dashboard):\n");
  console.log(`ADMIN_PASSWORD_HASH=${b64}\n`);
  console.log("Raw bcrypt hash (only paste this as-is into the Vercel dashboard):\n");
  console.log(`${hash}\n`);
  console.log(
    "Note: bcrypt hashes contain `$`. Next.js expands `$VAR` inside .env files — even in quotes — which silently\n" +
      "corrupts a raw hash. In .env files use the b64: form above (or escape every `$` as `\\$`).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
