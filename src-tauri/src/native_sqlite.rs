use crate::portable_sqlite::open_portable_database;
use rusqlite::{
    params_from_iter,
    types::{ToSqlOutput, Value, ValueRef},
    Connection, ToSql,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as JsonValue};

#[derive(Serialize)]
pub struct NativeSqliteQueryResult {
    #[serde(rename = "rowsAffected")]
    rows_affected: usize,
    #[serde(rename = "lastInsertId", skip_serializing_if = "Option::is_none")]
    last_insert_id: Option<i64>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NativeSqliteOperation {
    /// Runs non-row-returning DML. Successful INSERT/REPLACE statements include
    /// lastInsertId; UPDATE, DELETE, ignored inserts, and other SQL do not.
    Execute,
    /// Returns row maps, including for DML with RETURNING, and deliberately omits
    /// write metadata because rows are the requested result contract.
    Query,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSqliteStatement {
    operation: NativeSqliteOperation,
    sql: String,
    #[serde(default)]
    bind_values: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSqliteTransactionResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    rows_affected: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_insert_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rows: Option<Vec<Map<String, JsonValue>>>,
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
    let query = normalize_numbered_parameters(&query);
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
    let query = normalize_numbered_parameters(&query);
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

#[tauri::command]
pub fn native_sqlite_execute_batch(db_path: String, query: String) -> Result<(), String> {
    let conn = open_connection(&db_path)?;
    conn.execute_batch(&query).map_err(format_sqlite_error)
}

#[tauri::command]
pub fn native_sqlite_execute_transaction(
    db_path: String,
    statements: Vec<NativeSqliteStatement>,
) -> Result<Vec<NativeSqliteTransactionResult>, String> {
    for (index, statement) in statements.iter().enumerate() {
        validate_transaction_bind_values(&statement.bind_values).map_err(|error| {
            let operation = match statement.operation {
                NativeSqliteOperation::Execute => "execute",
                NativeSqliteOperation::Query => "query",
            };
            format!("transaction statement {index} ({operation}) failed: {error}")
        })?;
    }
    let mut conn = open_connection(&db_path)?;
    let transaction = conn.transaction().map_err(format_sqlite_error)?;
    let mut results = Vec::with_capacity(statements.len());

    for (index, statement) in statements.into_iter().enumerate() {
        let operation = statement.operation;
        let result = execute_transaction_statement(&transaction, statement).map_err(|error| {
            let operation = match operation {
                NativeSqliteOperation::Execute => "execute",
                NativeSqliteOperation::Query => "query",
            };
            format!("transaction statement {index} ({operation}) failed: {error}")
        })?;
        results.push(result);
    }

    transaction.commit().map_err(format_sqlite_error)?;
    Ok(results)
}

fn validate_transaction_bind_values(bind_values: &[JsonValue]) -> Result<(), &'static str> {
    if bind_values
        .iter()
        .any(|value| matches!(value, JsonValue::Array(_) | JsonValue::Object(_)))
    {
        return Err("unsupported bind value type");
    }
    Ok(())
}

fn execute_transaction_statement(
    transaction: &rusqlite::Transaction<'_>,
    statement: NativeSqliteStatement,
) -> Result<NativeSqliteTransactionResult, rusqlite::Error> {
    let sql = normalize_numbered_parameters(&statement.sql);
    let values = statement
        .bind_values
        .into_iter()
        .map(JsonSqlValue)
        .collect::<Vec<_>>();

    match statement.operation {
        NativeSqliteOperation::Execute => {
            let rows_affected = transaction.execute(&sql, params_from_iter(values.iter()))?;
            let is_insert = is_insert_like_statement(&sql);
            let last_insert_id = (is_insert && rows_affected > 0)
                .then(|| transaction.last_insert_rowid())
                .filter(|id| *id > 0);
            Ok(NativeSqliteTransactionResult {
                rows_affected: Some(rows_affected),
                last_insert_id,
                rows: None,
            })
        }
        NativeSqliteOperation::Query => {
            let mut prepared = transaction.prepare(&sql)?;
            let column_names = prepared
                .column_names()
                .into_iter()
                .map(String::from)
                .collect::<Vec<_>>();
            let mapped = prepared.query_map(params_from_iter(values.iter()), |row| {
                let mut out = Map::new();
                for (column_index, name) in column_names.iter().enumerate() {
                    out.insert(
                        name.clone(),
                        sqlite_value_to_json(row.get_ref(column_index)?),
                    );
                }
                Ok(out)
            })?;
            let rows = mapped.collect::<Result<Vec<_>, _>>()?;
            Ok(NativeSqliteTransactionResult {
                rows_affected: None,
                last_insert_id: None,
                rows: Some(rows),
            })
        }
    }
}

fn open_connection(db_path: &str) -> Result<Connection, String> {
    open_portable_database(db_path)
}

fn normalize_numbered_parameters(query: &str) -> String {
    let mut normalized = String::with_capacity(query.len());
    let bytes = query.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        match bytes[index] {
            b'\'' | b'"' | b'`' => {
                let quote = bytes[index];
                index = copy_quoted(query, index, quote, quote, &mut normalized);
            }
            b'[' => {
                index = copy_quoted(query, index, b']', b']', &mut normalized);
            }
            b'-' if bytes.get(index + 1) == Some(&b'-') => {
                let end = query[index..]
                    .find('\n')
                    .map_or(bytes.len(), |offset| index + offset + 1);
                normalized.push_str(&query[index..end]);
                index = end;
            }
            b'/' if bytes.get(index + 1) == Some(&b'*') => {
                let end = query[index + 2..]
                    .find("*/")
                    .map_or(bytes.len(), |offset| index + 2 + offset + 2);
                normalized.push_str(&query[index..end]);
                index = end;
            }
            b'$' if bytes
                .get(index + 1)
                .is_some_and(|byte| matches!(byte, b'1'..=b'9'))
                && token_boundary_before(query, index) =>
            {
                let mut end = index + 2;
                while bytes.get(end).is_some_and(u8::is_ascii_digit) {
                    end += 1;
                }
                if token_boundary_after(query, end) {
                    normalized.push('?');
                    normalized.push_str(&query[index + 1..end]);
                } else {
                    normalized.push_str(&query[index..end]);
                }
                index = end;
            }
            _ => {
                let character = query[index..].chars().next().expect("valid UTF-8 boundary");
                normalized.push(character);
                index += character.len_utf8();
            }
        }
    }

    normalized
}

fn copy_quoted(
    sql: &str,
    start: usize,
    closing: u8,
    escaped_closing: u8,
    output: &mut String,
) -> usize {
    let bytes = sql.as_bytes();
    output.push(sql.as_bytes()[start] as char);
    let mut index = start + 1;
    while index < bytes.len() {
        let character = sql[index..].chars().next().expect("valid UTF-8 boundary");
        output.push(character);
        index += character.len_utf8();
        if character.len_utf8() == 1 && character as u8 == closing {
            if bytes.get(index) == Some(&escaped_closing) {
                output.push(escaped_closing as char);
                index += 1;
            } else {
                break;
            }
        }
    }
    index
}

fn is_identifier_character(character: char) -> bool {
    character.is_alphanumeric() || matches!(character, '_' | '$')
}

fn token_boundary_before(sql: &str, index: usize) -> bool {
    sql[..index]
        .chars()
        .next_back()
        .is_none_or(|character| !is_identifier_character(character))
}

fn token_boundary_after(sql: &str, index: usize) -> bool {
    sql[index..]
        .chars()
        .next()
        .is_none_or(|character| !is_identifier_character(character))
}

/// Conservatively identifies top-level INSERT/REPLACE statements for metadata.
/// Unknown or malformed syntax fails closed and receives no lastInsertId.
fn is_insert_like_statement(sql: &str) -> bool {
    let bytes = sql.as_bytes();
    let mut index = 0;
    let mut depth = 0_u32;
    let mut saw_with = false;

    while index < bytes.len() {
        match bytes[index] {
            b'\'' | b'"' | b'`' => {
                index = skip_quoted(sql, index, bytes[index]);
            }
            b'[' => index = skip_quoted(sql, index, b']'),
            b'-' if bytes.get(index + 1) == Some(&b'-') => {
                index = sql[index..]
                    .find('\n')
                    .map_or(bytes.len(), |offset| index + offset + 1);
            }
            b'/' if bytes.get(index + 1) == Some(&b'*') => {
                index = sql[index + 2..]
                    .find("*/")
                    .map_or(bytes.len(), |offset| index + 2 + offset + 2);
            }
            b'(' => {
                depth += 1;
                index += 1;
            }
            b')' => {
                depth = depth.saturating_sub(1);
                index += 1;
            }
            byte if depth == 0 && (byte.is_ascii_alphabetic() || byte == b'_') => {
                let start = index;
                index += 1;
                while bytes
                    .get(index)
                    .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
                {
                    index += 1;
                }
                let keyword = &sql[start..index];
                if !saw_with {
                    if keyword.eq_ignore_ascii_case("with") {
                        saw_with = true;
                        continue;
                    }
                    return keyword.eq_ignore_ascii_case("insert")
                        || keyword.eq_ignore_ascii_case("replace");
                }
                if keyword.eq_ignore_ascii_case("insert") || keyword.eq_ignore_ascii_case("replace")
                {
                    return true;
                }
                if keyword.eq_ignore_ascii_case("update")
                    || keyword.eq_ignore_ascii_case("delete")
                    || keyword.eq_ignore_ascii_case("select")
                {
                    return false;
                }
            }
            _ => index += 1,
        }
    }
    false
}

fn skip_quoted(sql: &str, start: usize, closing: u8) -> usize {
    let mut sink = String::new();
    copy_quoted(sql, start, closing, closing, &mut sink)
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
    use rusqlite::Connection;

    #[test]
    fn transaction_rolls_back_every_statement_and_hides_bind_values_on_failure() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_transaction_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE entries (id TEXT PRIMARY KEY, title TEXT NOT NULL);")
            .unwrap();
        drop(conn);

        let secret = "secret-value-must-not-leak";
        let error = native_sqlite_execute_transaction(
            db_path.clone(),
            vec![
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT INTO entries (id, title) VALUES ($1, $2)".to_string(),
                    bind_values: vec![JsonValue::from("one"), JsonValue::from(secret)],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT INTO missing_table (title) VALUES ($1)".to_string(),
                    bind_values: vec![JsonValue::from(secret)],
                },
            ],
        )
        .unwrap_err();

        assert!(error.contains("statement 1"));
        assert!(error.contains("execute"));
        assert!(!error.contains(secret));
        let conn = Connection::open(&db_path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn transaction_returns_write_metadata_and_query_rows() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_transaction_results_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        Connection::open(&db_path)
            .unwrap()
            .execute_batch("CREATE TABLE entries (id INTEGER PRIMARY KEY, title TEXT NOT NULL);")
            .unwrap();

        let results = native_sqlite_execute_transaction(
            db_path.clone(),
            vec![
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT INTO entries (title) VALUES ($1)".to_string(),
                    bind_values: vec![JsonValue::from("it's parameterized")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Query,
                    sql: "SELECT id, title FROM entries WHERE title = $1".to_string(),
                    bind_values: vec![JsonValue::from("it's parameterized")],
                },
            ],
        )
        .unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rows_affected, Some(1));
        assert_eq!(results[0].last_insert_id, Some(1));
        assert_eq!(
            results[1].rows.as_ref().unwrap()[0]["title"],
            "it's parameterized"
        );

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn transaction_rejects_structured_bind_values_before_executing_any_statement() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_invalid_bind_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        Connection::open(&db_path)
            .unwrap()
            .execute_batch("CREATE TABLE entries (id TEXT PRIMARY KEY, title TEXT);")
            .unwrap();

        let error = native_sqlite_execute_transaction(
            db_path.clone(),
            vec![
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT INTO entries VALUES ($1, $2)".to_string(),
                    bind_values: vec![JsonValue::from("one"), JsonValue::from("valid")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT INTO entries VALUES ($1, $2)".to_string(),
                    bind_values: vec![
                        JsonValue::from("two"),
                        serde_json::json!({"secret": "hidden"}),
                    ],
                },
            ],
        )
        .unwrap_err();

        assert!(error.contains("statement 1"));
        assert!(error.contains("unsupported bind value"));
        assert!(!error.contains("hidden"));
        let count: i64 = Connection::open(&db_path)
            .unwrap()
            .query_row("SELECT COUNT(*) FROM entries", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn transaction_last_insert_id_belongs_only_to_successful_insert_statements() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_insert_metadata_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        Connection::open(&db_path)
            .unwrap()
            .execute_batch(
                "CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT UNIQUE);",
            )
            .unwrap();

        let results = native_sqlite_execute_transaction(
            db_path.clone(),
            vec![
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "/* leading comment */ INSERT INTO entries (title) VALUES ($1)".into(),
                    bind_values: vec![JsonValue::from("one")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "UPDATE entries SET title = $1 WHERE id = $2".into(),
                    bind_values: vec![JsonValue::from("updated"), JsonValue::from(1)],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "DELETE FROM entries WHERE id = $1".into(),
                    bind_values: vec![JsonValue::from(1)],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "WITH incoming(title) AS (SELECT $1) INSERT INTO entries (title) SELECT title FROM incoming".into(),
                    bind_values: vec![JsonValue::from("duplicate")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "REPLACE INTO entries (title) VALUES ($1)".into(),
                    bind_values: vec![JsonValue::from("duplicate")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Execute,
                    sql: "INSERT OR IGNORE INTO entries (title) VALUES ($1)".into(),
                    bind_values: vec![JsonValue::from("duplicate")],
                },
                NativeSqliteStatement {
                    operation: NativeSqliteOperation::Query,
                    sql: "INSERT INTO entries (title) VALUES ($1) RETURNING id, title".into(),
                    bind_values: vec![JsonValue::from("returned")],
                },
            ],
        )
        .unwrap();

        assert_eq!(results[0].last_insert_id, Some(1));
        assert_eq!(results[1].last_insert_id, None);
        assert_eq!(results[2].last_insert_id, None);
        assert_eq!(results[3].last_insert_id, Some(2));
        assert_eq!(results[4].last_insert_id, Some(3));
        assert_eq!(results[5].rows_affected, Some(0));
        assert_eq!(results[5].last_insert_id, None);
        assert_eq!(results[6].rows_affected, None);
        assert_eq!(results[6].last_insert_id, None);
        assert_eq!(results[6].rows.as_ref().unwrap()[0]["title"], "returned");

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn parameter_normalization_is_lexical_across_execute_select_and_transaction() {
        assert_eq!(
            normalize_numbered_parameters(
                "SELECT '$1', \"$2\", `$3`, [$4], $2, name$100usd -- $5\n/* $6 */"
            ),
            "SELECT '$1', \"$2\", `$3`, [$4], ?2, name$100usd -- $5\n/* $6 */"
        );

        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_lexical_parameters_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        Connection::open(&db_path)
            .unwrap()
            .execute_batch("CREATE TABLE tokens (id INTEGER PRIMARY KEY, \"$1\" TEXT, note TEXT);")
            .unwrap();

        native_sqlite_execute(
            db_path.clone(),
            "INSERT INTO tokens (\"$1\", note) VALUES ('$1', $1) /* $2 */".into(),
            vec![JsonValue::from("bound")],
        )
        .unwrap();
        let selected = native_sqlite_select(
            db_path.clone(),
            "SELECT \"$1\" AS quoted, note, '$2' AS literal FROM tokens WHERE note = $1 -- $2"
                .into(),
            vec![JsonValue::from("bound")],
        )
        .unwrap();
        assert_eq!(selected[0]["quoted"], "$1");
        assert_eq!(selected[0]["literal"], "$2");

        let transaction = native_sqlite_execute_transaction(
            db_path.clone(),
            vec![NativeSqliteStatement {
                operation: NativeSqliteOperation::Query,
                sql: "SELECT $2 AS second, $1 AS first, $2 AS repeated, 'cost $100' AS currency"
                    .into(),
                bind_values: vec![JsonValue::from("first"), JsonValue::from("second")],
            }],
        )
        .unwrap();
        let row = &transaction[0].rows.as_ref().unwrap()[0];
        assert_eq!(row["first"], "first");
        assert_eq!(row["second"], "second");
        assert_eq!(row["repeated"], "second");
        assert_eq!(row["currency"], "cost $100");

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

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

    #[test]
    fn binds_dollar_parameters_by_number_when_sql_uses_them_out_of_order() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_parameter_order_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE projects (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                updated_at TEXT NOT NULL
             );
             INSERT INTO projects (id, status, updated_at)
             VALUES ('project-1', 'active', 'before');",
        )
        .unwrap();
        drop(conn);

        let result = native_sqlite_execute(
            db_path.clone(),
            "UPDATE projects SET status = $2, updated_at = $3 WHERE id = $1".to_string(),
            vec![
                JsonValue::String("project-1".to_string()),
                JsonValue::String("archived".to_string()),
                JsonValue::String("after".to_string()),
            ],
        )
        .unwrap();

        assert_eq!(result.rows_affected, 1);
        let rows = native_sqlite_select(
            db_path.clone(),
            "SELECT status FROM projects WHERE id = $1".to_string(),
            vec![JsonValue::String("project-1".to_string())],
        )
        .unwrap();
        assert_eq!(
            rows[0].get("status"),
            Some(&JsonValue::String("archived".to_string()))
        );

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn portable_open_uses_delete_journal_mode_for_network_storage() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_journal_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE prompts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
             PRAGMA journal_mode=WAL;",
        )
        .unwrap();
        drop(conn);

        native_sqlite_select(
            db_path.clone(),
            "SELECT name FROM sqlite_master WHERE type = $1".to_string(),
            vec![JsonValue::String("table".to_string())],
        )
        .unwrap();

        let conn = Connection::open(&db_path).unwrap();
        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(journal_mode.to_lowercase(), "delete");

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn execute_batch_rolls_back_transaction_on_error() {
        let root = std::env::temp_dir().join(format!(
            "framecraft_native_sqlite_batch_{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let db_path = root.join("framecraft.db");
        let db_path = db_path.to_str().unwrap().to_string();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT NOT NULL);")
            .unwrap();
        drop(conn);

        let result = native_sqlite_execute_batch(
            db_path.clone(),
            "BEGIN;
             INSERT INTO projects (id, title) VALUES ('a', 'Project A');
             INSERT INTO missing_table (id) VALUES ('broken');
             COMMIT;"
                .to_string(),
        );

        assert!(result.is_err());
        let rows = native_sqlite_select(
            db_path.clone(),
            "SELECT id FROM projects".to_string(),
            vec![],
        )
        .unwrap();
        assert!(rows.is_empty());

        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_dir_all(root);
    }
}
