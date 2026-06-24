use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "tokens",
            sql: include_str!("../migrations/002_tokens.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "meta_and_seeds",
            sql: include_str!("../migrations/003_meta.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "token_seeds",
            sql: include_str!("../migrations/004_token_seeds.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "notion_library",
            sql: include_str!("../migrations/005_notion_library.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "avoidance_seed",
            sql: include_str!("../migrations/006_avoidance_seed.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "token_patterns",
            sql: include_str!("../migrations/007_token_patterns.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:framecraft.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
