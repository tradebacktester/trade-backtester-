const pg = require("/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg");
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS username TEXT");
    await client.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS bio TEXT");
    await client.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS trading_style TEXT");
    console.log("columns added");

    await client.query(`
      UPDATE app_users
      SET username = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '', 'g')) || id::text
      WHERE username IS NULL OR username = ''
    `);
    console.log("usernames generated");

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_users_username_unique') THEN
          ALTER TABLE app_users ADD CONSTRAINT app_users_username_unique UNIQUE (username);
        END IF;
      END $$
    `);
    console.log("unique constraint done");

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        following_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_pair_idx') THEN
          ALTER TABLE user_follows ADD CONSTRAINT user_follows_pair_idx UNIQUE (follower_id, following_id);
        END IF;
      END $$
    `);
    await client.query("CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON user_follows(follower_id)");
    await client.query("CREATE INDEX IF NOT EXISTS user_follows_following_idx ON user_follows(following_id)");
    console.log("user_follows table ready");

    const { rows } = await client.query("SELECT id, name, username FROM app_users LIMIT 5");
    console.log("users:", JSON.stringify(rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
