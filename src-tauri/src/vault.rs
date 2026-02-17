use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct VaultEntry {
    pub path: String,
    pub filename: String,
    pub title: String,
    #[serde(rename = "isA")]
    pub is_a: Option<String>,
    pub aliases: Vec<String>,
    #[serde(rename = "belongsTo")]
    pub belongs_to: Vec<String>,
    #[serde(rename = "relatedTo")]
    pub related_to: Vec<String>,
    pub status: Option<String>,
    pub owner: Option<String>,
    pub cadence: Option<String>,
    #[serde(rename = "modifiedAt")]
    pub modified_at: Option<u64>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<u64>,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

/// Intermediate struct to capture YAML frontmatter fields.
#[derive(Debug, Deserialize, Default)]
struct Frontmatter {
    #[serde(rename = "Is A")]
    is_a: Option<StringOrList>,
    #[serde(default)]
    aliases: Option<StringOrList>,
    #[serde(rename = "Belongs to")]
    belongs_to: Option<StringOrList>,
    #[serde(rename = "Related to")]
    related_to: Option<StringOrList>,
    #[serde(rename = "Status")]
    status: Option<String>,
    #[serde(rename = "Owner")]
    owner: Option<String>,
    #[serde(rename = "Cadence")]
    cadence: Option<String>,
    #[serde(rename = "Created at")]
    created_at: Option<String>,
    #[serde(rename = "Created time")]
    created_time: Option<String>,
}

/// Handles YAML fields that can be either a single string or a list of strings.
#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
enum StringOrList {
    Single(String),
    List(Vec<String>),
}

impl StringOrList {
    fn into_vec(self) -> Vec<String> {
        match self {
            StringOrList::Single(s) => vec![s],
            StringOrList::List(v) => v,
        }
    }
}

/// Extract the title from a markdown file's content.
/// Tries the first H1 heading (`# Title`), falls back to filename without extension.
fn extract_title(content: &str, filename: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if let Some(heading) = trimmed.strip_prefix("# ") {
            let title = heading.trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }
    // Fallback: filename without .md extension
    filename.strip_suffix(".md").unwrap_or(filename).to_string()
}

/// Parse frontmatter from raw YAML data extracted by gray_matter.
fn parse_frontmatter(data: &HashMap<String, serde_json::Value>) -> Frontmatter {
    // Convert HashMap to serde_json::Value for deserialization
    let value = serde_json::Value::Object(
        data.iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
    );
    serde_json::from_value(value).unwrap_or_default()
}

/// Parse a single markdown file into a VaultEntry.
pub fn parse_md_file(path: &Path) -> Result<VaultEntry, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let matter = Matter::<YAML>::new();
    let parsed = matter.parse(&content);

    let frontmatter: Frontmatter = if let Some(data) = parsed.data {
        match data {
            gray_matter::Pod::Hash(map) => {
                // Convert Pod HashMap to serde_json HashMap
                let json_map: HashMap<String, serde_json::Value> = map
                    .into_iter()
                    .map(|(k, v)| (k, pod_to_json(v)))
                    .collect();
                parse_frontmatter(&json_map)
            }
            _ => Frontmatter::default(),
        }
    } else {
        Frontmatter::default()
    };

    let title = extract_title(&parsed.content, &filename);

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to stat {}: {}", path.display(), e))?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let file_size = metadata.len();

    // Extract is_a from frontmatter, or infer from parent folder name
    let is_a = frontmatter.is_a
        .map(|a| a.into_vec().into_iter().next())
        .flatten()
        .or_else(|| {
            path.parent()
                .and_then(|p| p.file_name())
                .map(|f| {
                    let folder = f.to_string_lossy().to_string();
                    // Map folder names to entity types
                    match folder.as_str() {
                        "person" => "Person".to_string(),
                        "project" => "Project".to_string(),
                        "procedure" => "Procedure".to_string(),
                        "responsibility" => "Responsibility".to_string(),
                        "event" => "Event".to_string(),
                        "topic" => "Topic".to_string(),
                        "experiment" => "Experiment".to_string(),
                        "note" => "Note".to_string(),
                        "quarter" => "Quarter".to_string(),
                        "measure" => "Measure".to_string(),
                        "target" => "Target".to_string(),
                        "journal" => "Journal".to_string(),
                        "month" => "Month".to_string(),
                        "essay" => "Essay".to_string(),
                        "evergreen" => "Evergreen".to_string(),
                        _ => capitalize_first(&folder),
                    }
                })
        });

    // Parse created_at from frontmatter (prefer "Created at" over "Created time")
    let created_at = frontmatter.created_at
        .as_ref()
        .and_then(|s| parse_iso_date(s))
        .or_else(|| frontmatter.created_time.as_ref().and_then(|s| parse_iso_date(s)));

    Ok(VaultEntry {
        path: path.to_string_lossy().to_string(),
        filename,
        title,
        is_a,
        aliases: frontmatter.aliases.map(|a| a.into_vec()).unwrap_or_default(),
        belongs_to: frontmatter.belongs_to.map(|b| b.into_vec()).unwrap_or_default(),
        related_to: frontmatter.related_to.map(|r| r.into_vec()).unwrap_or_default(),
        status: frontmatter.status,
        owner: frontmatter.owner,
        cadence: frontmatter.cadence,
        modified_at,
        created_at,
        file_size,
    })
}

fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

/// Parse an ISO 8601 date string to Unix timestamp (seconds since epoch)
/// Handles formats like "2025-05-23T14:35:00.000Z"
fn parse_iso_date(date_str: &str) -> Option<u64> {
    // Try parsing as ISO 8601 with chrono-style manual parsing
    // Format: "YYYY-MM-DDTHH:MM:SS.sssZ" or "YYYY-MM-DD"
    let trimmed = date_str.trim().trim_matches('"');
    
    // Try full datetime format
    if let Some(t_pos) = trimmed.find('T') {
        let date_part = &trimmed[..t_pos];
        let time_part = trimmed[t_pos + 1..].trim_end_matches('Z');
        
        let date_parts: Vec<&str> = date_part.split('-').collect();
        if date_parts.len() != 3 {
            return None;
        }
        
        let year: i32 = date_parts[0].parse().ok()?;
        let month: u32 = date_parts[1].parse().ok()?;
        let day: u32 = date_parts[2].parse().ok()?;
        
        // Parse time part (may have milliseconds)
        let time_no_ms = time_part.split('.').next()?;
        let time_parts: Vec<&str> = time_no_ms.split(':').collect();
        if time_parts.len() < 2 {
            return None;
        }
        
        let hour: u32 = time_parts[0].parse().ok()?;
        let min: u32 = time_parts[1].parse().ok()?;
        let sec: u32 = time_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
        
        // Convert to Unix timestamp (simplified calculation)
        // Days from epoch (1970-01-01) to the given date
        let days_since_epoch = days_from_epoch(year, month, day)?;
        let seconds = days_since_epoch as u64 * 86400 + hour as u64 * 3600 + min as u64 * 60 + sec as u64;
        return Some(seconds);
    }
    
    // Try date-only format
    let date_parts: Vec<&str> = trimmed.split('-').collect();
    if date_parts.len() == 3 {
        let year: i32 = date_parts[0].parse().ok()?;
        let month: u32 = date_parts[1].parse().ok()?;
        let day: u32 = date_parts[2].parse().ok()?;
        let days_since_epoch = days_from_epoch(year, month, day)?;
        return Some(days_since_epoch as u64 * 86400);
    }
    
    None
}

/// Calculate days since Unix epoch (1970-01-01)
fn days_from_epoch(year: i32, month: u32, day: u32) -> Option<i64> {
    // Simplified calculation - not accounting for all edge cases
    if month < 1 || month > 12 || day < 1 || day > 31 {
        return None;
    }
    
    // Days in each month (non-leap year)
    let days_in_month = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    
    let is_leap = |y: i32| (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0);
    
    // Days from 1970 to start of year
    let mut total_days: i64 = 0;
    for y in 1970..year {
        total_days += if is_leap(y) { 366 } else { 365 };
    }
    for y in (year..1970).rev() {
        total_days -= if is_leap(y) { 366 } else { 365 };
    }
    
    // Days in current year up to start of month
    for m in 1..month {
        total_days += days_in_month[m as usize] as i64;
        if m == 2 && is_leap(year) {
            total_days += 1;
        }
    }
    
    // Add days in current month
    total_days += (day - 1) as i64;
    
    Some(total_days)
}

/// Convert gray_matter::Pod to serde_json::Value
fn pod_to_json(pod: gray_matter::Pod) -> serde_json::Value {
    match pod {
        gray_matter::Pod::String(s) => serde_json::Value::String(s),
        gray_matter::Pod::Integer(i) => serde_json::json!(i),
        gray_matter::Pod::Float(f) => serde_json::json!(f),
        gray_matter::Pod::Boolean(b) => serde_json::Value::Bool(b),
        gray_matter::Pod::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(pod_to_json).collect())
        }
        gray_matter::Pod::Hash(map) => {
            let obj: serde_json::Map<String, serde_json::Value> = map
                .into_iter()
                .map(|(k, v)| (k, pod_to_json(v)))
                .collect();
            serde_json::Value::Object(obj)
        }
        gray_matter::Pod::Null => serde_json::Value::Null,
    }
}

/// Read the content of a single note file.
pub fn get_note_content(path: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }
    fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Scan a directory recursively for .md files and return VaultEntry for each.
pub fn scan_vault(vault_path: &str) -> Result<Vec<VaultEntry>, String> {
    let path = Path::new(vault_path);
    if !path.exists() {
        return Err(format!("Vault path does not exist: {}", vault_path));
    }
    if !path.is_dir() {
        return Err(format!("Vault path is not a directory: {}", vault_path));
    }

    let mut entries = Vec::new();
    for entry in WalkDir::new(path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        if entry_path.is_file()
            && entry_path
                .extension()
                .map(|ext| ext == "md")
                .unwrap_or(false)
        {
            match parse_md_file(entry_path) {
                Ok(vault_entry) => entries.push(vault_entry),
                Err(e) => {
                    log::warn!("Skipping file: {}", e);
                }
            }
        }
    }

    // Sort by modified date descending (newest first)
    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    Ok(entries)
}

/// Value type for frontmatter updates
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum FrontmatterValue {
    String(String),
    Number(f64),
    Bool(bool),
    List(Vec<String>),
    Null,
}

impl FrontmatterValue {
    fn to_yaml_value(&self) -> String {
        match self {
            FrontmatterValue::String(s) => {
                // Quote strings that need it (contain special chars or look like other types)
                if s.contains(':') || s.contains('#') || s.contains('\n') || 
                   s.starts_with('[') || s.starts_with('{') ||
                   s == "true" || s == "false" || s == "null" ||
                   s.parse::<f64>().is_ok() {
                    format!("\"{}\"", s.replace('\"', "\\\""))
                } else {
                    s.clone()
                }
            }
            FrontmatterValue::Number(n) => {
                if n.fract() == 0.0 {
                    format!("{}", *n as i64)
                } else {
                    format!("{}", n)
                }
            }
            FrontmatterValue::Bool(b) => if *b { "true" } else { "false" }.to_string(),
            FrontmatterValue::List(items) => {
                if items.is_empty() {
                    "[]".to_string()
                } else {
                    // Multi-line list format
                    items.iter()
                        .map(|item| {
                            let quoted = if item.contains(':') || item.starts_with('[') || item.starts_with('{') {
                                format!("\"{}\"", item.replace('\"', "\\\""))
                            } else {
                                format!("\"{}\"", item)
                            };
                            format!("  - {}", quoted)
                        })
                        .collect::<Vec<_>>()
                        .join("\n")
                }
            }
            FrontmatterValue::Null => "null".to_string(),
        }
    }
}

/// Update a single frontmatter property in a markdown file
pub fn update_frontmatter(path: &str, key: &str, value: FrontmatterValue) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;
    
    let updated = update_frontmatter_content(&content, key, Some(value))?;
    
    fs::write(file_path, &updated)
        .map_err(|e| format!("Failed to write {}: {}", path, e))?;
    
    Ok(updated)
}

/// Delete a frontmatter property from a markdown file
pub fn delete_frontmatter_property(path: &str, key: &str) -> Result<String, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    
    let content = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))?;
    
    let updated = update_frontmatter_content(&content, key, None)?;
    
    fs::write(file_path, &updated)
        .map_err(|e| format!("Failed to write {}: {}", path, e))?;
    
    Ok(updated)
}

/// Internal function to update frontmatter content
fn update_frontmatter_content(content: &str, key: &str, value: Option<FrontmatterValue>) -> Result<String, String> {
    // Check if file has frontmatter
    if !content.starts_with("---\n") {
        // No frontmatter - add it if we're setting a value
        return match value {
            Some(v) => {
                let yaml_key = format_yaml_key(key);
                let yaml_value = v.to_yaml_value();
                let fm = if yaml_value.contains('\n') {
                    format!("---\n{}:\n{}\n---\n", yaml_key, yaml_value)
                } else {
                    format!("---\n{}: {}\n---\n", yaml_key, yaml_value)
                };
                Ok(format!("{}{}", fm, content))
            }
            None => Ok(content.to_string()), // Nothing to delete
        };
    }
    
    // Find the end of frontmatter
    let fm_end = content[4..].find("\n---")
        .map(|i| i + 4)
        .ok_or_else(|| "Malformed frontmatter: no closing ---".to_string())?;
    
    let fm_content = &content[4..fm_end];
    let rest = &content[fm_end + 4..]; // Skip the closing "---"
    
    // Parse frontmatter line by line, preserving structure
    let lines: Vec<&str> = fm_content.lines().collect();
    let mut new_lines: Vec<String> = Vec::new();
    let mut found_key = false;
    let mut i = 0;
    
    while i < lines.len() {
        let line = lines[i];
        
        // Check if this line is our target key
        if line_is_key(line, key) {
            found_key = true;
            
            // Skip this key and any list items that follow
            i += 1;
            while i < lines.len() && (lines[i].starts_with("  - ") || lines[i].trim().is_empty()) {
                if lines[i].trim().is_empty() {
                    break;
                }
                i += 1;
            }
            
            // Add the updated value (if not deleting)
            if let Some(ref v) = value {
                let yaml_key = format_yaml_key(key);
                let yaml_value = v.to_yaml_value();
                if yaml_value.contains('\n') {
                    new_lines.push(format!("{}:", yaml_key));
                    new_lines.push(yaml_value);
                } else {
                    new_lines.push(format!("{}: {}", yaml_key, yaml_value));
                }
            }
            continue;
        }
        
        new_lines.push(line.to_string());
        i += 1;
    }
    
    // If key wasn't found and we're adding, append it
    if !found_key {
        if let Some(ref v) = value {
            let yaml_key = format_yaml_key(key);
            let yaml_value = v.to_yaml_value();
            if yaml_value.contains('\n') {
                new_lines.push(format!("{}:", yaml_key));
                new_lines.push(yaml_value);
            } else {
                new_lines.push(format!("{}: {}", yaml_key, yaml_value));
            }
        }
    }
    
    // Rebuild the file
    let new_fm = new_lines.join("\n");
    Ok(format!("---\n{}\n---{}", new_fm, rest))
}

/// Check if a line defines a specific key (handles quoted and unquoted keys)
fn line_is_key(line: &str, key: &str) -> bool {
    let trimmed = line.trim_start();
    
    // Check unquoted: `key:`
    if trimmed.starts_with(key) && trimmed[key.len()..].starts_with(':') {
        return true;
    }
    
    // Check double-quoted: `"key":`
    let dq = format!("\"{}\":", key);
    if trimmed.starts_with(&dq) {
        return true;
    }
    
    // Check single-quoted: `'key':`
    let sq = format!("'{}\':", key);
    if trimmed.starts_with(&sq) {
        return true;
    }
    
    false
}

/// Format a key for YAML output (quote if necessary)
fn format_yaml_key(key: &str) -> String {
    // Quote keys that contain spaces or special characters
    if key.contains(' ') || key.contains(':') || key.contains('#') || 
       key.chars().any(|c| !c.is_ascii_alphanumeric() && c != '_' && c != '-') {
        format!("\"{}\"", key)
    } else {
        key.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::TempDir;

    fn create_test_file(dir: &Path, name: &str, content: &str) {
        let file_path = dir.join(name);
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut file = fs::File::create(file_path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    #[test]
    fn test_extract_title_from_h1() {
        let content = "---\nIs A: Note\n---\n# My Great Note\n\nSome content here.";
        assert_eq!(extract_title(content, "my-great-note.md"), "My Great Note");
    }

    #[test]
    fn test_extract_title_fallback_to_filename() {
        let content = "Just some content without a heading.";
        assert_eq!(extract_title(content, "fallback-title.md"), "fallback-title");
    }

    #[test]
    fn test_extract_title_empty_h1_falls_back() {
        let content = "# \n\nSome content.";
        assert_eq!(extract_title(content, "empty-h1.md"), "empty-h1");
    }

    #[test]
    fn test_parse_full_frontmatter() {
        let dir = TempDir::new().unwrap();
        let content = r#"---
Is A: Project
aliases:
  - Laputa
  - Castle in the Sky
Belongs to:
  - Studio Ghibli
Related to:
  - Miyazaki
Status: Active
Owner: Luca
Cadence: Weekly
---
# Laputa Project

This is a project note.
"#;
        create_test_file(dir.path(), "laputa.md", content);

        let entry = parse_md_file(&dir.path().join("laputa.md")).unwrap();
        assert_eq!(entry.title, "Laputa Project");
        assert_eq!(entry.is_a, Some("Project".to_string()));
        assert_eq!(entry.aliases, vec!["Laputa", "Castle in the Sky"]);
        assert_eq!(entry.belongs_to, vec!["Studio Ghibli"]);
        assert_eq!(entry.related_to, vec!["Miyazaki"]);
        assert_eq!(entry.status, Some("Active".to_string()));
        assert_eq!(entry.owner, Some("Luca".to_string()));
        assert_eq!(entry.cadence, Some("Weekly".to_string()));
        assert_eq!(entry.filename, "laputa.md");
    }

    #[test]
    fn test_parse_empty_frontmatter() {
        let dir = TempDir::new().unwrap();
        let content = "---\n---\n# Just a Title\n\nNo frontmatter fields.";
        create_test_file(dir.path(), "empty-fm.md", content);

        let entry = parse_md_file(&dir.path().join("empty-fm.md")).unwrap();
        assert_eq!(entry.title, "Just a Title");
        // is_a is inferred from parent folder name (temp dir), so just check it's not from frontmatter
        assert!(entry.aliases.is_empty());
        assert!(entry.belongs_to.is_empty());
        assert!(entry.related_to.is_empty());
        assert_eq!(entry.status, None);
    }

    #[test]
    fn test_parse_no_frontmatter() {
        let dir = TempDir::new().unwrap();
        let content = "# A Note Without Frontmatter\n\nJust markdown.";
        create_test_file(dir.path(), "no-fm.md", content);

        let entry = parse_md_file(&dir.path().join("no-fm.md")).unwrap();
        assert_eq!(entry.title, "A Note Without Frontmatter");
        // is_a is inferred from parent folder name (temp dir), not None
    }

    #[test]
    fn test_parse_single_string_aliases() {
        let dir = TempDir::new().unwrap();
        let content = "---\naliases: SingleAlias\n---\n# Test\n";
        create_test_file(dir.path(), "single-alias.md", content);

        let entry = parse_md_file(&dir.path().join("single-alias.md")).unwrap();
        assert_eq!(entry.aliases, vec!["SingleAlias"]);
    }

    #[test]
    fn test_scan_vault_recursive() {
        let dir = TempDir::new().unwrap();
        create_test_file(dir.path(), "root.md", "# Root Note\n");
        create_test_file(dir.path(), "sub/nested.md", "---\nIs A: Task\n---\n# Nested\n");
        create_test_file(dir.path(), "not-markdown.txt", "This should be ignored");

        let entries = scan_vault(dir.path().to_str().unwrap()).unwrap();
        assert_eq!(entries.len(), 2);

        let filenames: Vec<&str> = entries.iter().map(|e| e.filename.as_str()).collect();
        assert!(filenames.contains(&"root.md"));
        assert!(filenames.contains(&"nested.md"));
    }

    #[test]
    fn test_scan_vault_nonexistent_path() {
        let result = scan_vault("/nonexistent/path/that/does/not/exist");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_malformed_yaml() {
        let dir = TempDir::new().unwrap();
        // Malformed YAML — gray_matter should handle this gracefully
        let content = "---\nIs A: [unclosed bracket\n---\n# Malformed\n";
        create_test_file(dir.path(), "malformed.md", content);

        let entry = parse_md_file(&dir.path().join("malformed.md"));
        // Should still succeed — gray_matter may parse partially or skip
        assert!(entry.is_ok());
    }

    #[test]
    fn test_get_note_content() {
        let dir = TempDir::new().unwrap();
        let content = "---\nIs A: Note\n---\n# Test Note\n\nHello, world!";
        create_test_file(dir.path(), "test.md", content);

        let path = dir.path().join("test.md");
        let result = get_note_content(path.to_str().unwrap());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), content);
    }

    #[test]
    fn test_get_note_content_nonexistent() {
        let result = get_note_content("/nonexistent/path/file.md");
        assert!(result.is_err());
    }

    #[test]
    fn test_update_frontmatter_string() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Status", Some(FrontmatterValue::String("Active".to_string()))).unwrap();
        assert!(updated.contains("Status: Active"));
        assert!(!updated.contains("Status: Draft"));
    }

    #[test]
    fn test_update_frontmatter_add_new_key() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Owner", Some(FrontmatterValue::String("Luca".to_string()))).unwrap();
        assert!(updated.contains("Owner: Luca"));
        assert!(updated.contains("Status: Draft")); // Original key preserved
    }

    #[test]
    fn test_update_frontmatter_quoted_key() {
        let content = "---\n\"Is A\": Note\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Is A", Some(FrontmatterValue::String("Project".to_string()))).unwrap();
        assert!(updated.contains("\"Is A\": Project"));
        assert!(!updated.contains("Note"));
    }

    #[test]
    fn test_update_frontmatter_list() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "aliases", Some(FrontmatterValue::List(vec!["Alias1".to_string(), "Alias2".to_string()]))).unwrap();
        assert!(updated.contains("aliases:"));
        assert!(updated.contains("  - \"Alias1\""));
        assert!(updated.contains("  - \"Alias2\""));
    }

    #[test]
    fn test_update_frontmatter_replace_list() {
        let content = "---\naliases:\n  - Old1\n  - Old2\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "aliases", Some(FrontmatterValue::List(vec!["New1".to_string()]))).unwrap();
        assert!(updated.contains("  - \"New1\""));
        assert!(!updated.contains("Old1"));
        assert!(!updated.contains("Old2"));
        assert!(updated.contains("Status: Draft")); // Other keys preserved
    }

    #[test]
    fn test_delete_frontmatter_property() {
        let content = "---\nStatus: Draft\nOwner: Luca\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Owner", None).unwrap();
        assert!(!updated.contains("Owner"));
        assert!(updated.contains("Status: Draft")); // Other key preserved
    }

    #[test]
    fn test_delete_frontmatter_list_property() {
        let content = "---\naliases:\n  - Alias1\n  - Alias2\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "aliases", None).unwrap();
        assert!(!updated.contains("aliases"));
        assert!(!updated.contains("Alias1"));
        assert!(updated.contains("Status: Draft"));
    }

    #[test]
    fn test_update_frontmatter_no_existing() {
        let content = "# Test\n\nSome content here.";
        let updated = update_frontmatter_content(content, "Status", Some(FrontmatterValue::String("Draft".to_string()))).unwrap();
        assert!(updated.starts_with("---\n"));
        assert!(updated.contains("Status: Draft"));
        assert!(updated.contains("# Test"));
    }

    #[test]
    fn test_update_frontmatter_bool() {
        let content = "---\nStatus: Draft\n---\n# Test\n";
        let updated = update_frontmatter_content(content, "Reviewed", Some(FrontmatterValue::Bool(true))).unwrap();
        assert!(updated.contains("Reviewed: true"));
    }

    #[test]
    fn test_format_yaml_key_simple() {
        assert_eq!(format_yaml_key("Status"), "Status");
        assert_eq!(format_yaml_key("is_a"), "is_a");
    }

    #[test]
    fn test_format_yaml_key_with_spaces() {
        assert_eq!(format_yaml_key("Is A"), "\"Is A\"");
        assert_eq!(format_yaml_key("Created at"), "\"Created at\"");
    }
}
