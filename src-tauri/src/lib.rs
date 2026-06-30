use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

mod library_lock;
mod library_package;
mod native_sqlite;
mod portable_sqlite;

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
        Migration {
            version: 8,
            description: "token_favorite",
            sql: include_str!("../migrations/008_token_favorite.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "references",
            sql: include_str!("../migrations/009_references.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "projects",
            sql: include_str!("../migrations/010_projects.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "v4_workflow",
            sql: include_str!("../migrations/011_v4_workflow.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "deliverable_align",
            sql: include_str!("../migrations/012_deliverable_align.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "generation_queue",
            sql: include_str!("../migrations/013_generation_queue.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "project_setup_metadata",
            sql: include_str!("../migrations/014_project_setup_metadata.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "comparison_workflow_metadata",
            sql: include_str!("../migrations/015_comparison_workflow.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "creative_directions",
            sql: include_str!("../migrations/016_creative_directions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "shot_sequence",
            sql: include_str!("../migrations/017_shot_sequence.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "campaigns",
            sql: include_str!("../migrations/018_campaigns.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "queue_pin",
            sql: include_str!("../migrations/019_queue_pin.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "recipe_use_count",
            sql: include_str!("../migrations/020_recipe_use_count.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "prompt_analysis_fields",
            sql: include_str!("../migrations/021_prompt_analysis_fields.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "nano_banana_library",
            sql: include_str!("../migrations/022_nano_banana_library.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "prompt_thumbnail",
            sql: include_str!("../migrations/023_prompt_thumbnail.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(library_lock::ActiveLockState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:framecraft.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            library_lock::acquire_library_lock_native,
            library_lock::refresh_library_lock_native,
            library_lock::release_library_lock_native,
            library_lock::get_library_lock_identity_native,
            library_lock::get_library_lock_status_native,
            library_package::create_library_package_native,
            library_package::validate_library_package_native,
            library_package::repair_library_database_schema_native,
            library_package::migrate_app_data_to_library_native,
            library_package::copy_library_package_native,
            library_package::backup_library_package_native,
            library_package::merge_library_package_native,
            native_sqlite::native_sqlite_execute,
            native_sqlite::native_sqlite_execute_batch,
            native_sqlite::native_sqlite_select,
        ])
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let state = window.state::<library_lock::ActiveLockState>();
                library_lock::release_active_lock(&state);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            let state = app_handle.state::<library_lock::ActiveLockState>();
            library_lock::release_active_lock_on_run_event(&state, &event);
        });
}
