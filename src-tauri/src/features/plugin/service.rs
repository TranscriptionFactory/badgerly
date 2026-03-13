use std::path::Path;
use std::fs;
use crate::features::plugin::types::{PluginManifest, PluginInfo};
use anyhow::{Result, Context};

pub struct PluginService;

impl PluginService {
    pub fn new() -> Self {
        Self
    }

    pub fn discover(&self, vault_path: &Path) -> Result<Vec<PluginInfo>> {
        let plugins_dir = vault_path.join(".carbide").join("plugins");

        if !plugins_dir.exists() {
            return Ok(Vec::new());
        }

        let mut plugins = Vec::new();

        for entry in fs::read_dir(&plugins_dir).context("Failed to read plugins directory")? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                if let Some(manifest) = self.load_manifest(&path) {
                    plugins.push(PluginInfo {
                        manifest,
                        path: path.to_string_lossy().into_owned(),
                    });
                }
            }
        }

        Ok(plugins)
    }

    fn load_manifest(&self, plugin_dir: &Path) -> Option<PluginManifest> {
        let manifest_path = plugin_dir.join("manifest.json");
        let content = fs::read_to_string(&manifest_path).ok()?;
        match serde_json::from_str::<PluginManifest>(&content) {
            Ok(manifest) => Some(manifest),
            Err(e) => {
                log::warn!("Failed to parse plugin manifest at {}: {}", manifest_path.display(), e);
                None
            }
        }
    }
}
