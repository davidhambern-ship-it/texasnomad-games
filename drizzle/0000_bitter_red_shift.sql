CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."connection_role" AS ENUM('player', 'host_controller', 'game_display', 'spectator');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('pairing', 'connected', 'disconnected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."host_session_status" AS ENUM('pairing', 'ready', 'live', 'ended');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('active', 'completed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('player', 'host_player');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('lobby', 'live', 'paused', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" varchar(255) NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"role" "connection_role" NOT NULL,
	"status" "device_status" DEFAULT 'connected' NOT NULL,
	"device_label" varchar(100),
	"token_hash" varchar(128),
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_sessions_display_identity" CHECK (("device_sessions"."role" = 'game_display' AND "device_sessions"."account_id" IS NULL) OR ("device_sessions"."role" <> 'game_display' AND "device_sessions"."account_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "display_pairings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_session_id" uuid NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"room_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"actor_device_id" uuid NOT NULL,
	"expected_revision" integer NOT NULL,
	"applied_revision" integer NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" varchar(8) NOT NULL,
	"game_id" varchar(64) NOT NULL,
	"host_session_id" uuid NOT NULL,
	"status" "room_status" DEFAULT 'lobby' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"display_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_rooms_code_format" CHECK ("game_rooms"."room_code" ~ '^[A-Z0-9]{4,8}$')
);
--> statement-breakpoint
CREATE TABLE "host_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_account_id" uuid NOT NULL,
	"controller_device_id" uuid NOT NULL,
	"display_device_id" uuid,
	"status" "host_session_status" DEFAULT 'pairing' NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "host_stats" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"sessions_hosted" integer DEFAULT 0 NOT NULL,
	"games_completed" integer DEFAULT 0 NOT NULL,
	"unique_players_hosted" integer DEFAULT 0 NOT NULL,
	"total_players_hosted" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_participants" (
	"match_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"team_key" varchar(50),
	"score" integer DEFAULT 0 NOT NULL,
	"won" boolean DEFAULT false NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "match_participants_match_id_account_id_pk" PRIMARY KEY("match_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"game_id" varchar(64) NOT NULL,
	"host_account_id" uuid NOT NULL,
	"status" "match_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(100) NOT NULL,
	"aggregate_id" uuid,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_private_state" (
	"room_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"private_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participant_private_state_room_id_account_id_pk" PRIMARY KEY("room_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "player_game_stats" (
	"account_id" uuid NOT NULL,
	"game_id" varchar(64) NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"total_score" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_game_stats_account_id_game_id_pk" PRIMARY KEY("account_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "player_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(50) NOT NULL,
	"handle" varchar(24) NOT NULL,
	"normalized_handle" varchar(24) NOT NULL,
	"onboarding_completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_profiles_handle_format" CHECK ("player_profiles"."normalized_handle" ~ '^[a-z0-9_]{3,24}$')
);
--> statement-breakpoint
CREATE TABLE "room_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"device_session_id" uuid NOT NULL,
	"role" "participant_role" DEFAULT 'player' NOT NULL,
	"seat_number" integer,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "display_pairings" ADD CONSTRAINT "display_pairings_host_session_id_host_sessions_id_fk" FOREIGN KEY ("host_session_id") REFERENCES "public"."host_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_actor_device_id_device_sessions_id_fk" FOREIGN KEY ("actor_device_id") REFERENCES "public"."device_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_rooms" ADD CONSTRAINT "game_rooms_host_session_id_host_sessions_id_fk" FOREIGN KEY ("host_session_id") REFERENCES "public"."host_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_sessions" ADD CONSTRAINT "host_sessions_host_account_id_accounts_id_fk" FOREIGN KEY ("host_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_sessions" ADD CONSTRAINT "host_sessions_controller_device_id_device_sessions_id_fk" FOREIGN KEY ("controller_device_id") REFERENCES "public"."device_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_sessions" ADD CONSTRAINT "host_sessions_display_device_id_device_sessions_id_fk" FOREIGN KEY ("display_device_id") REFERENCES "public"."device_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "host_stats" ADD CONSTRAINT "host_stats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_host_account_id_accounts_id_fk" FOREIGN KEY ("host_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_private_state" ADD CONSTRAINT "participant_private_state_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_private_state" ADD CONSTRAINT "participant_private_state_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_game_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."game_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_device_session_id_device_sessions_id_fk" FOREIGN KEY ("device_session_id") REFERENCES "public"."device_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_auth_subject_unique" ON "accounts" USING btree ("auth_subject");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_unique" ON "accounts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "device_sessions_account_idx" ON "device_sessions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_sessions_token_hash_unique" ON "device_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "display_pairings_code_hash_unique" ON "display_pairings" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "display_pairings_one_pending_per_host" ON "display_pairings" USING btree ("host_session_id") WHERE "display_pairings"."consumed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_command_unique" ON "game_events" USING btree ("command_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_room_revision_unique" ON "game_events" USING btree ("room_id","applied_revision");--> statement-breakpoint
CREATE INDEX "game_events_room_created_idx" ON "game_events" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "game_rooms_host_session_idx" ON "game_rooms" USING btree ("host_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_rooms_one_active_per_host_session" ON "game_rooms" USING btree ("host_session_id") WHERE "game_rooms"."status" IN ('lobby', 'live', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "game_rooms_active_code_unique" ON "game_rooms" USING btree ("room_code") WHERE "game_rooms"."status" IN ('lobby', 'live', 'paused');--> statement-breakpoint
CREATE INDEX "host_sessions_host_idx" ON "host_sessions" USING btree ("host_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "host_sessions_one_active_per_host" ON "host_sessions" USING btree ("host_account_id") WHERE "host_sessions"."status" IN ('pairing', 'ready', 'live');--> statement-breakpoint
CREATE UNIQUE INDEX "host_sessions_one_active_per_controller" ON "host_sessions" USING btree ("controller_device_id") WHERE "host_sessions"."status" IN ('pairing', 'ready', 'live');--> statement-breakpoint
CREATE UNIQUE INDEX "host_sessions_one_active_per_display" ON "host_sessions" USING btree ("display_device_id") WHERE "host_sessions"."display_device_id" IS NOT NULL AND "host_sessions"."status" IN ('ready', 'live');--> statement-breakpoint
CREATE UNIQUE INDEX "matches_room_unique" ON "matches" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("processed_at","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_profiles_normalized_handle_unique" ON "player_profiles" USING btree ("normalized_handle");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participants_account_unique" ON "room_participants" USING btree ("room_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participants_device_unique" ON "room_participants" USING btree ("room_id","device_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participants_seat_unique" ON "room_participants" USING btree ("room_id","seat_number") WHERE "room_participants"."seat_number" IS NOT NULL;