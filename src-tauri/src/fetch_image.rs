use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::imageops::FilterType;
use std::io::Cursor;

/// Fetches an image from a URL using native Rust HTTP (bypasses browser CSP/CORS),
/// resizes it in the background if it's too large, and returns a compressed JPEG 
/// `data:<mime>;base64,<data>` string suitable for storing in thumbnail_data.
#[tauri::command]
pub async fn fetch_image_as_data_url(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
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

    // We decode and compress to jpeg anyway, so we don't strictly need to parse the mime type here.

        let bytes = response
            .bytes()
            .map_err(|e| format!("Failed to read image bytes: {}", e))?;

        compress_bytes_to_data_url(&bytes)
    })
    .await
    .map_err(|e| format!("Thread failed: {}", e))?
}

/// Takes a raw byte array from JS (e.g. from browser fetch), resizes, and returns a data URL.
/// This allows the browser to do the fetching (bypassing Cloudflare/bot blocks) while
/// Rust handles the heavy CPU lifting of image decoding/encoding off the main thread.
#[tauri::command]
pub async fn compress_image_from_bytes(bytes: Vec<u8>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        compress_bytes_to_data_url(&bytes)
    })
    .await
    .map_err(|e| format!("Thread failed: {}", e))?
}

fn compress_bytes_to_data_url(bytes: &[u8]) -> Result<String, String> {
    // Sanity check: first few bytes should look like an image
    if bytes.len() < 8 {
        return Err("Response too small to be a valid image".to_string());
    }

    // Parse and compress image
    let img = image::load_from_memory(bytes)
        .map_err(|e| format!("Failed to decode image: {}", e))?;
    
    let max_dim = 400;
    let resized = if img.width() > max_dim || img.height() > max_dim {
        img.resize(max_dim, max_dim, FilterType::Lanczos3)
    } else {
        img
    };

    let mut jpeg_bytes = Cursor::new(Vec::new());
    resized
        .write_to(&mut jpeg_bytes, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode jpeg: {}", e))?;

    let encoded = STANDARD.encode(jpeg_bytes.into_inner());
    Ok(format!("data:image/jpeg;base64,{}", encoded))
}
