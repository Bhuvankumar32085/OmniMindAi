import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCredentials(): ServiceAccount | undefined {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT from env:", err);
    }
  }

  const candidatePaths = [
    path.join(__dirname, "../serviceAccountKey.json"),
    path.join(__dirname, "../../src/serviceAccountKey.json"),
    path.join(process.cwd(), "serviceAccountKey.json"),
    path.join(process.cwd(), "src/serviceAccountKey.json"),
    path.join(process.cwd(), "dist/serviceAccountKey.json"),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch (err) {
        console.warn(`Failed to read service account from ${p}:`, err);
      }
    }
  }

  return undefined;
}

const creds = getCredentials();

export const app: App = getApps().length === 0
  ? initializeApp(creds ? { credential: cert(creds) } : undefined)
  : getApps()[0]!;


