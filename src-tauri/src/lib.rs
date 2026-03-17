pub mod app;
pub mod features;
pub mod shared;

#[cfg(test)]
mod tests;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::run();
}
