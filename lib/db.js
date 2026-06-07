const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let pool;
let schemaReady = false;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no esta configurada");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function ensureSchema() {
  if (schemaReady) return;
  const schema = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  await getPool().query(schema);
  await getPool().query("insert into baby_profile (id) values (1) on conflict (id) do nothing");
  await getPool().query("insert into notification_settings (id) values (1) on conflict (id) do nothing");
  await getPool().query(
    "insert into app_state (key, value) values ('selectedDate', to_jsonb($1::text)) on conflict (key) do nothing",
    [todayKey()]
  );
  schemaReady = true;
}

async function readState() {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    const [profileResult, selectedDateResult, settingsResult, entriesResult, appointmentsResult] = await Promise.all([
      client.query("select name, age, weight from baby_profile where id = 1"),
      client.query("select value from app_state where key = 'selectedDate'"),
      client.query("select bottle_enabled, bottle_minutes, diaper_enabled, diaper_minutes, sent_keys from notification_settings where id = 1"),
      client.query(`
        select id, type, entry_date::text as entry_date, to_char(entry_time, 'HH24:MI') as entry_time,
               amount, food_name, diaper_type, to_char(sleep_start, 'HH24:MI') as sleep_start, to_char(sleep_end, 'HH24:MI') as sleep_end,
               sleep_minutes, vitamin, bath, note
        from entries
        order by entry_date asc, entry_time asc, created_at asc
      `),
      client.query(`
        select id, appointment_date::text as appointment_date, to_char(appointment_time, 'HH24:MI') as appointment_time, specialty
        from appointments
        order by appointment_date asc, appointment_time asc, created_at asc
      `)
    ]);

    const profile = profileResult.rows[0] || {};
    const settings = settingsResult.rows[0] || {};
    const selectedDate = selectedDateResult.rows[0]?.value || todayKey();

    return normalizeState({
      profile: {
        name: profile.name,
        age: profile.age,
        weight: profile.weight
      },
      selectedDate,
      appointments: appointmentsResult.rows.map(rowToAppointment),
      settings: {
        notifications: {
          bottleEnabled: settings.bottle_enabled,
          bottleMinutes: settings.bottle_minutes,
          diaperEnabled: settings.diaper_enabled,
          diaperMinutes: settings.diaper_minutes,
          sentKeys: settings.sent_keys || {}
        }
      },
      entries: entriesResult.rows.map(rowToEntry)
    });
  } finally {
    client.release();
  }
}

async function writeState(input) {
  await ensureSchema();
  const state = normalizeState(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `
        insert into baby_profile (id, name, age, weight, updated_at)
        values (1, $1, $2, $3, now())
        on conflict (id) do update set
          name = excluded.name,
          age = excluded.age,
          weight = excluded.weight,
          updated_at = now()
      `,
      [state.profile.name, state.profile.age, state.profile.weight]
    );

    await client.query(
      `
        insert into app_state (key, value, updated_at)
        values ('selectedDate', to_jsonb($1::text), now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `,
      [state.selectedDate]
    );

    await client.query(
      `
        insert into notification_settings (
          id, bottle_enabled, bottle_minutes, diaper_enabled, diaper_minutes, sent_keys, updated_at
        )
        values (1, $1, $2, $3, $4, $5::jsonb, now())
        on conflict (id) do update set
          bottle_enabled = excluded.bottle_enabled,
          bottle_minutes = excluded.bottle_minutes,
          diaper_enabled = excluded.diaper_enabled,
          diaper_minutes = excluded.diaper_minutes,
          sent_keys = excluded.sent_keys,
          updated_at = now()
      `,
      [
        state.settings.notifications.bottleEnabled,
        state.settings.notifications.bottleMinutes,
        state.settings.notifications.diaperEnabled,
        state.settings.notifications.diaperMinutes,
        JSON.stringify(state.settings.notifications.sentKeys)
      ]
    );

    await client.query("delete from entries");
    for (const entry of state.entries) {
      await client.query(
        `
          insert into entries (
            id, type, entry_date, entry_time, amount, food_name, diaper_type, sleep_start,
            sleep_end, sleep_minutes, vitamin, bath, note, updated_at
          )
          values ($1, $2, $3::date, $4::time, $5, $6, $7, $8::time, $9::time, $10, $11, $12, $13, now())
        `,
        [
          entry.id,
          entry.type,
          entry.date,
          entry.time,
          nullableNumber(entry.amount),
          entry.foodName || null,
          entry.diaperType || null,
          entry.start || null,
          entry.end || null,
          nullableNumber(entry.minutes) || 0,
          Boolean(entry.vitamin),
          Boolean(entry.bath),
          entry.note || ""
        ]
      );
    }

    await client.query("delete from appointments");
    for (const appointment of state.appointments) {
      await client.query(
        `
          insert into appointments (id, appointment_date, appointment_time, specialty, updated_at)
          values ($1, $2::date, $3::time, $4, now())
        `,
        [appointment.id, appointment.date, appointment.time, appointment.specialty]
      );
    }

    await client.query(
      "insert into audit_log (action, entity, payload) values ('replace_state', 'state', $1::jsonb)",
      [JSON.stringify(state)]
    );

    await client.query("commit");
    return state;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function rowToEntry(row) {
  return {
    id: row.id,
    type: row.type,
    date: dateKey(row.entry_date),
    time: timeKey(row.entry_time),
    amount: row.amount ?? undefined,
    foodName: row.food_name || undefined,
    diaperType: row.diaper_type || undefined,
    start: timeKey(row.sleep_start) || undefined,
    end: timeKey(row.sleep_end) || undefined,
    minutes: row.sleep_minutes || 0,
    vitamin: Boolean(row.vitamin),
    bath: Boolean(row.bath),
    note: row.note || ""
  };
}

function rowToAppointment(row) {
  return {
    id: row.id,
    date: dateKey(row.appointment_date),
    time: timeKey(row.appointment_time),
    specialty: row.specialty || ""
  };
}

function normalizeState(value) {
  const profile = value?.profile || {};
  return {
    profile: {
      name: String(profile.name || value?.babyName || ""),
      age: String(profile.age || ""),
      weight: String(profile.weight || "")
    },
    selectedDate: String(value?.selectedDate || todayKey()),
    appointments: Array.isArray(value?.appointments) ? value.appointments.map(normalizeAppointment) : [],
    settings: normalizeSettings(value?.settings),
    entries: Array.isArray(value?.entries) ? value.entries.map(normalizeEntry) : []
  };
}

function normalizeSettings(settings = {}) {
  const notifications = settings.notifications || {};
  return {
    notifications: {
      bottleEnabled: Boolean(notifications.bottleEnabled),
      bottleMinutes: clampNumber(notifications.bottleMinutes, 10, 600, 180),
      diaperEnabled: Boolean(notifications.diaperEnabled),
      diaperMinutes: clampNumber(notifications.diaperMinutes, 10, 600, 120),
      sentKeys: notifications.sentKeys && typeof notifications.sentKeys === "object" ? notifications.sentKeys : {}
    }
  };
}

function normalizeEntry(entry) {
  return {
    ...entry,
    id: String(entry.id || makeId()),
    type: String(entry.type || "bottle"),
    date: String(entry.date || todayKey()),
    time: normalizeTime(entry.time || entry.start || "00:00"),
    start: entry.start ? normalizeTime(entry.start) : "",
    end: entry.end ? normalizeTime(entry.end) : "",
    note: String(entry.note || "")
  };
}

function normalizeAppointment(appointment) {
  return {
    id: String(appointment.id || makeId()),
    date: String(appointment.date || todayKey()),
    time: normalizeTime(appointment.time || "09:00"),
    specialty: String(appointment.specialty || "")
  };
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeTime(value) {
  if (!value) return "";
  const [hour = "00", minute = "00"] = String(value).split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function dateKey(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function timeKey(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 5);
  return String(value).slice(0, 5);
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

module.exports = {
  readState,
  writeState,
  normalizeState
};
