use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Todo,
    Doing,
    Done,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub path: String,
    pub text: String,
    pub status: TaskStatus,
    pub due_date: Option<String>,
    pub line_number: usize,
    pub section: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskUpdate {
    pub path: String,
    pub line_number: usize,
    pub status: TaskStatus,
}
