import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	// user_swipes: 1 linha por par. PK composta garante "uma decisão por par"
	// (não pode like + dislike o mesmo target). Rewind = UPDATE da decision.
	await knex.schema.createTable('user_swipes', (table) => {
		table.uuid('swiper_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
		table.uuid('target_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
		table.string('decision', 8).notNullable()
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.primary(['swiper_id', 'target_id'])
		table.index('target_id', 'user_swipes_target_id_idx')
	})
	await knex.raw(`
		ALTER TABLE user_swipes
		ADD CONSTRAINT user_swipes_decision_check
		CHECK (decision IN ('like', 'dislike'))
	`)
	await knex.raw(`
		ALTER TABLE user_swipes
		ADD CONSTRAINT user_swipes_no_self_check
		CHECK (swiper_id != target_id)
	`)

	// blocks: unidirecional. Filtro do browse aplica nos dois sentidos via OR.
	await knex.schema.createTable('blocks', (table) => {
		table.uuid('blocker_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
		table.uuid('blocked_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
		table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
		table.primary(['blocker_id', 'blocked_id'])
	})
	await knex.raw(`
		ALTER TABLE blocks
		ADD CONSTRAINT blocks_no_self_check
		CHECK (blocker_id != blocked_id)
	`)

	// Helper de distância em km entre dois pontos lat/lng. Haversine puro,
	// sem PostGIS — suficiente para MVP. IMMUTABLE permite uso em índices se
	// precisar mais tarde. Retorna NULL quando qualquer input é NULL.
	await knex.raw(`
		CREATE OR REPLACE FUNCTION haversine_km(
			lat1 double precision, lon1 double precision,
			lat2 double precision, lon2 double precision
		) RETURNS double precision AS $$
		DECLARE
			r CONSTANT double precision := 6371;
			dlat double precision;
			dlon double precision;
			a double precision;
		BEGIN
			IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
				RETURN NULL;
			END IF;
			dlat := radians(lat2 - lat1);
			dlon := radians(lon2 - lon1);
			a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
			RETURN 2 * r * atan2(sqrt(a), sqrt(1 - a));
		END;
		$$ LANGUAGE plpgsql IMMUTABLE;
	`)

	// Auxiliar: "I am attracted to people of `their_gender`?".
	// Defaults: orient NULL = 'bi' (spec). other/bi = wildcard.
	await knex.raw(`
		CREATE OR REPLACE FUNCTION is_attracted_to(
			my_gender text, my_orient text, their_gender text
		) RETURNS bool AS $$
		DECLARE
			o text := COALESCE(my_orient, 'bi');
		BEGIN
			IF o IN ('bi', 'other') THEN
				RETURN true;
			END IF;
			IF o = 'hetero' THEN
				IF my_gender = 'm' THEN RETURN their_gender = 'f'; END IF;
				IF my_gender = 'f' THEN RETURN their_gender = 'm'; END IF;
				RETURN false;
			END IF;
			IF o = 'homo' THEN
				RETURN my_gender = their_gender;
			END IF;
			RETURN false;
		END;
		$$ LANGUAGE plpgsql IMMUTABLE;
	`)

	// Compatibilidade bidirecional: cada lado tem que estar na "lista de
	// procura" do outro. É o que o browse usa.
	await knex.raw(`
		CREATE OR REPLACE FUNCTION is_orientation_compatible(
			my_gender text, my_orient text,
			their_gender text, their_orient text
		) RETURNS bool AS $$
		BEGIN
			RETURN is_attracted_to(my_gender, my_orient, their_gender)
			   AND is_attracted_to(their_gender, their_orient, my_gender);
		END;
		$$ LANGUAGE plpgsql IMMUTABLE;
	`)
}

export async function down(knex: Knex): Promise<void> {
	await knex.raw('DROP FUNCTION IF EXISTS is_orientation_compatible(text, text, text, text)')
	await knex.raw('DROP FUNCTION IF EXISTS is_attracted_to(text, text, text)')
	await knex.raw(
		'DROP FUNCTION IF EXISTS haversine_km(double precision, double precision, double precision, double precision)',
	)
	await knex.schema.dropTableIfExists('blocks')
	await knex.schema.dropTableIfExists('user_swipes')
}
