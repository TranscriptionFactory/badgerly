use std::collections::HashSet;

use serde::Deserialize;

use crate::features::search::db::extract_tags;

#[derive(Deserialize)]
struct TagGrammarFixture {
    cases: Vec<TagGrammarCase>,
}

#[derive(Deserialize)]
struct TagGrammarCase {
    name: String,
    markdown: String,
    expected_tags: Vec<String>,
}

fn load_fixture() -> TagGrammarFixture {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root")
        .join("tests/fixtures/tag_grammar_cases.json");
    let raw = std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("read fixture at {:?}: {}", path, e));
    serde_json::from_str(&raw).expect("parse tag_grammar_cases.json")
}

#[test]
fn fixture_is_well_formed() {
    let fixture = load_fixture();
    assert!(fixture.cases.len() >= 20, "expected at least 20 cases");
    let names: HashSet<&str> = fixture.cases.iter().map(|c| c.name.as_str()).collect();
    assert_eq!(names.len(), fixture.cases.len(), "case names must be unique");
}

#[test]
fn fixture_cases_match_extract_tags() {
    let fixture = load_fixture();
    let mut failures = Vec::new();
    for case in &fixture.cases {
        let names: Vec<String> = extract_tags(&case.markdown)
            .into_iter()
            .map(|t| t.tag)
            .collect();
        if names != case.expected_tags {
            failures.push(format!(
                "{}: expected {:?}, got {:?}",
                case.name, case.expected_tags, names
            ));
        }
    }
    assert!(failures.is_empty(), "\n{}", failures.join("\n"));
}
