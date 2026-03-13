pub mod service;
pub mod types;

use std::path::Path;
use tauri::{command, State};
use crate::features::plugin::service::PluginService;
use crate::features::plugin::types::PluginInfo;

#[command]
pub async fn plugin_discover(
    vault_path: String,
    state: State<'_, PluginService>,
) -> Result<Vec<PluginInfo>, String> {
    state.discover(Path::new(&vault_path)).map_err(|e| e.to_string())
}
