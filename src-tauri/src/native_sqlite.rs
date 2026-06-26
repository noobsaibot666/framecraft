use rusqlite::{
    params_from_iter,
    types::{ToSqlOutput, Value, ValueRef},
    Connection, ToSql,
};
use serde::Serialize;
use serde_json::{Map, Value as JsonValue};
use std::{path::Path, time::Duration};

#[derive(Serialize)]
pub struct NativeSqliteQueryResult {
    #[serde(rename = "rowsAffected")]
    rows_affected: usize,
    #[serde(rename = "lastInsertId", skip_serializing_if = "Option::is_none")]
    last_insert_id: Option<i64>,
}

struct JsonSqlValue(JsonValue);

impl ToSql for JsonSqlValue {
    fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
        Ok(match &self.0 {
            JsonValue::Null => ToSqlOutput::Owned(Value::Null),
            JsonValue::Bool(value) => {
                ToSqlOutput::Owned(Value::Integer(if *value { 1 } else { 0 }))
            }
            JsonValue::Number(value) => {
                if let Some(integer) = value.as_i64() {
                    ToSqlOutput::Owned(Value::Integer(integer))
                } else if let Some(real) = value.as_f64() {
                    ToSqlOutput::Owned(Value::Real(real))
                } else {
                    ToSqlOutput::Owned(Value::Text(value.to_string()))
                }
            }
            JsonValue::String(value) => ToSqlOutput::Owned(Value::Text(value.clone())),
            JsonValue::Array(_) | JsonValue::Object(_) => {
                ToSqlOutput::Owned(Value::Text(self.0.to_string()))
            }
        })
    }
}

#[tauri::command]
pub fn native_sqlite_select(
    db_path: String,
    query: String,
    bind_values: Vec<JsonValue>,
) -> Result<Vec<Map<String, JsonValue>>, String> {
    let conn = open_connection(&db_path)?;
    let values = bind_values
        .into_iter()
        .map(JsonSqlValue)
        .collect::<Vec<_>>();
    let mut statement = conn.prepare(&query).map_err(format_sqlite_error)?;
    let column_names = statement
        .column_names()
        .into_iter()
        .map(String::from)
        .collect::<Vec<_>>();
    let rows = statement
        .query_map(params_from_iter(values.iter()), |row| {
            let mut out = Map::new();
            for (index, name) in column_names.iter().enumerate() {
                out.insert(name.clone(), sqlite_value_to_json(row.get_ref(index)?));
            }
            Ok(out)
        })
        .map_err(format_sqlite_error)?;

    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(format_sqlite_error)?);
    }
    Ok(out)
}

#[tauri::command]
pub fn native_sqlite_execute(
    db_path: String,
    query: String,
    bind_values: Vec<JsonValue>,
) -> Result<NativeSqliteQueryResult, String> {
    let conn = open_connection(&db_path)?;
    let values = bind_values
        .into_iter()
        .map(JsonSqlValue)
        .collect::<Vec<_>>();
    let rows_affected = conn
        .execute(&query, params_from_iter(values.iter()))
        .map_err(format_sqlite_error)?;
    let last_insert_id = conn.last_insert_rowid();
    Ok(NativeSqliteQueryResult {
        rows_affected,
        last_insert_id: (last_insert_id > 0).then_some(last_insert_id),
    })
}

fn open_connection(db_path: &str) -> Result<Connection, String> {
    if !Path::new(db_path).exists() {
        return Err(format!("Missing database file: {db_path}"));
    }
    let conn = Connection::open(db_path).map_err(format_sqlite_error)?;
    conn.busy_timeout(Duration::from_secs(10))
        .map_err(format_sqlite_error)?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(format_sqlite_error)?;
    Ok(conn)
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> JsonValue {
    match value {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(value) => JsonValue::from(value),
        ValueRef::Real(value) => JsonValue::from(value),
        ValueRef::Text(value) => JsonValue::String(String::from_utf8_lossy(value).into_owned()),
        ValueRef::Blob(value) => {
            JsonValue::Array(value.iter().copied().map(JsonValue::from).collect())
        }
    }
}

fn format_sqlite_error(error: rusqlite::Error) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_absolute_database_paths_for_select_and_execute() {
        let root =
            std::env::temp_dir().join(format!("framecraft_native_sqlite_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);")
            .unwrap();
        drop(conn);

        let result = native_sqlite_execute(
            db_path.clone(),
            "INSERT INTO prompts (title) VALUES ($1)".to_string(),
            vec![JsonValue::String("NAS prompt".to_string())],
        )
        .unwrap();
        assert_eq!(result.rows_affected, 1);

        let rows = native_sqlite_select(
            db_path.clone(),
            "SELECT title FROM prompts WHERE title = $1".to_string(),
            vec![JsonValue::String("NAS prompt".to_string())],
        )
        .unwrap();
        assert_eq!(
            rows[0].get("title"),
            Some(&JsonValue::String("NAS prompt".to_string()))
        );

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }
}
