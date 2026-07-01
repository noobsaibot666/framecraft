use base64::{engine::general_purpose::STANDARD, Engine as _};

/// Fetches an image from a URL using native Rust HTTP (bypasses browser CSP/CORS),
/// and returns a `data:<mime>;base64,<data>` string suitable for storing in thumbnail_data.
#[tauri::command]
pub fn fetch_image_as_data_url(url: String) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&url)
        .header("Referer", "https://www.midjourney.com/")
        .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.9")
        .send()
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status {}", response.status()));
    }

    // Detect MIME from Content-Type header, default to image/png
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|s| {
            // Strip parameters (e.g. "image/jpeg; charset=utf-8" → "image/jpeg")
            s.split(';').next().unwrap_or("image/png").trim().to_string()
        })
        .unwrap_or_else(|| {
            // Guess from URL extension
            if url.contains(".jpg") || url.contains(".jpeg") {
                "image/jpeg".to_string()
            } else if url.contains(".webp") {
                "image/webp".to_string()
            } else {
                "image/png".to_string()
            }
        });

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    // Sanity check: first few bytes should look like an image
    if bytes.len() < 8 {
        return Err("Response too small to be a valid image".to_string());
    }

    let encoded = STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, encoded))
}
