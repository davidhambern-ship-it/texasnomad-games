import { betterAuth } from "better-auth";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const authSecret = String(process.env.BETTER_AUTH_SECRET || "").trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the TexasNomad Games auth service.");
}

if (authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be configured with at least 32 characters.");
}

// Keep Better Auth isolated from the public game tables while using the
// migrated Neon-compatible auth schema inside the Supabase PostgreSQL project.
const authPool = new Pool({
  connectionString: databaseUrl,
  options: "-c search_path=neon_auth",
  max: 4,
  idleTimeoutMillis: 30000,
  application_name: "texasnomad-games-auth",
});

const trustedOrigins = new Set([
  "https://texasnomadgames.com",
  "https://www.texasnomadgames.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
  const cleanHost = String(host || "").trim().replace(/^https?:\\/\\//i, "").split("/")[0];
  if (cleanHost && cleanHost.endsWith(".vercel.app")) {
    trustedOrigins.add(`https://${cleanHost}`);
  }
}

const socialProviders = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  appName: "TexasNomad Games",
  basePath: "/neon-auth",
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  secret: authSecret,
  database: authPool,
  trustedOrigins: [...trustedOrigins],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  ...(Object.keys(socialProviders).length ? { socialProviders } : {}),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create the corresponding TNG account as soon as Better Auth
          // creates a new identity. The account UUID then anchors profiles,
          // rooms, stats, and all existing game relationships.
          await authPool.query(
            `
              insert into public.accounts
                (auth_subject, email, email_verified, status)
              values ($1, lower($2), $3, 'active')
              on conflict (auth_subject) do update set
                email = excluded.email,
                email_verified = excluded.email_verified,
                updated_at = now()
            `,
            [user.id, user.email, user.emailVerified === true],
          );
        },
      },
    },
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
});
