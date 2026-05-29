/**
 * Database Migration Runner
 * Automatically detects and runs missing migrations
 * Safe to call multiple times (idempotent)
 */

import 
      },
          {
        name: '009_create_company_users_table',
        up: async (db) => {
          const exists = await db.schema.hasTable('company_users');
          if (exists) {
            console.log('[MIGRATIONS] Skipping 009_create_company_users_table (already exists)');
            return;
          }

          console.log('[MIGRATIONS] Creating company_users table...');
          
          await db.schema.createTable('company_users', (table) => {
            table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
            table.string('user_id').notNullable();
            table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
            table.string('role', 50).notNullable().defaultTo('user');
            table.json('permissions').nullable();
            table.boolean('is_active').defaultTo(true);
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.timestamp('updated_at').defaultTo(db.fn.now());
            
            table.index(['user_id']);
            table.index(['company_id']);
            table.unique(['user_id', 'company_id']);
          });

          console.log('✓ 009_create_company_users_table completed');
        },
      },
        ];

    for (const migration of migrations) {
      await migration.up(db);
      if (!executedMigrations.has(migration.name)) {
        await db('migrations_executed').insert({ migration_name: migration.name });
        executedMigrations.add(migration.name);
        console.log(`✓ Migration ${migration.name} executed and tracked`);
      }
    }

    console.log('[MIGRATIONS] All migrations completed successfully!');
  } catch (error) {
    console.error('[MIGRATIONS] Error running migrations:', error);
    throw error;
  }
}
