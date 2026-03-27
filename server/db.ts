import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

export async function ensureFullTextSearch() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'publications' AND column_name = 'search_vector'
        ) THEN
          ALTER TABLE publications ADD COLUMN search_vector tsvector;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE publications
      SET search_vector =
        setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(authors, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(journal, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(abstract, '')), 'D') ||
        setweight(to_tsvector('simple', COALESCE(doi, '')), 'D') ||
        setweight(to_tsvector('simple', COALESCE(pmc_id, '')), 'D') ||
        setweight(to_tsvector('simple', COALESCE(pmid, '')), 'D')
      WHERE search_vector IS NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_publications_search_vector
      ON publications USING GIN (search_vector);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION publications_search_vector_update() RETURNS trigger AS $trig$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.authors, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(NEW.journal, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(NEW.abstract, '')), 'D') ||
          setweight(to_tsvector('simple', COALESCE(NEW.doi, '')), 'D') ||
          setweight(to_tsvector('simple', COALESCE(NEW.pmc_id, '')), 'D') ||
          setweight(to_tsvector('simple', COALESCE(NEW.pmid, '')), 'D');
        RETURN NEW;
      END;
      $trig$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger t
          JOIN pg_class c ON t.tgrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE t.tgname = 'trg_publications_search_vector'
          AND c.relname = 'publications'
          AND n.nspname = 'public'
        ) THEN
          CREATE TRIGGER trg_publications_search_vector
          BEFORE INSERT OR UPDATE OF title, authors, abstract, journal, doi, pmc_id, pmid
          ON publications
          FOR EACH ROW
          EXECUTE FUNCTION publications_search_vector_update();
        END IF;
      END $$;
    `);

    console.log("[db] Full-text search setup complete");
  } finally {
    client.release();
  }
}
