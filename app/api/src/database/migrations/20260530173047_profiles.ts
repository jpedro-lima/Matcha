import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('profiles', (table) => {
		table.uuid('user_id').primary().references('id').inTable('users').onDelete('CASCADE')

		table.text('bio')
		table.string('gender', 10)
		table.string('sexual_orientation', 10)
		table.date('birth_date')

		table.decimal('latitude', 10, 7)
		table.decimal('longitude', 10, 7)
		table.string('city', 120)
		table.string('neighborhood', 120)
		table.boolean('location_consent')

		table.integer('fame_rating').notNullable().defaultTo(0)
		table.timestamp('last_active', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.boolean('is_online').notNullable().defaultTo(false)
		table.timestamp('profile_completed_at', { useTz: true })

		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
	})

	await knex.raw(`
		ALTER TABLE profiles
		ADD CONSTRAINT profiles_gender_check
		CHECK (gender IS NULL OR gender IN ('m', 'f', 'nb', 'other'))
	`)
	await knex.raw(`
		ALTER TABLE profiles
		ADD CONSTRAINT profiles_sexual_orientation_check
		CHECK (sexual_orientation IS NULL OR sexual_orientation IN ('hetero', 'homo', 'bi', 'other'))
	`)
	await knex.raw(`
		ALTER TABLE profiles
		ADD CONSTRAINT profiles_birth_date_18yrs_check
		CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE - INTERVAL '18 years')
	`)
	await knex.raw(`
		ALTER TABLE profiles
		ADD CONSTRAINT profiles_latitude_range_check
		CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90))
	`)
	await knex.raw(`
		ALTER TABLE profiles
		ADD CONSTRAINT profiles_longitude_range_check
		CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
	`)

	await knex.schema.alterTable('profiles', (table) => {
		table.index(['gender', 'sexual_orientation'], 'profiles_gender_orientation_idx')
		table.index(['latitude', 'longitude'], 'profiles_location_idx')
	})
	await knex.raw('CREATE INDEX profiles_fame_idx ON profiles (fame_rating DESC)')

	await knex.raw(`
		CREATE TRIGGER profiles_set_updated_at
		BEFORE UPDATE ON profiles
		FOR EACH ROW EXECUTE FUNCTION set_updated_at()
	`)
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw('DROP TRIGGER IF EXISTS profiles_set_updated_at ON profiles')
	await knex.schema.dropTableIfExists('profiles')
}
