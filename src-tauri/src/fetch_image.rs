use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::imageops::FilterType;
use once_cell::sync::Lazy;
use std::io::Cursor;

/// Maximum size of an image we'll accept for compression (25 MB).
const MAX_IMAGE_BYTES: u64 = 25 * 1024 * 1024;

/// A single, reusable HTTP client shared across all invocations.
/// Maintains a connection pool so repeated thumbnail fetches reuse TCP connections.
static HTTP_CLIENT: Lazy<reqwest::blocking::Client> = Lazy::new(|| {
    reqwest::blocking::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36")
        .http1_only() // Force HTTP/1.1 to avoid HTTP/2 TLS fingerprinting used by Cloudflare bot detection
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .expect("Failed to build static HTTP client")
});

/// Fetches an image from a URL using native Rust HTTP (bypasses browser CSP/CORS),
/// resizes it in the background if it's too large, and returns a compressed JPEG 
/// `data:<mime>;base64,<data>` string suitable for storing in thumbnail_data.
#[tauri::command]
pub async fn fetch_image_as_data_url(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let response = HTTP_CLIENT
            .get(&url)
            // Referer mimics a Discord embed; Midjourney CDNs require a recognised referrer
            .header("Referer", "https://discord.com/")
            .header("Accept", "image/avif,image/webp,image/apng,image/*,*/*;q=0.8")
            .header("Accept-Language", "en-US,en;q=0.9")
            .send()
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Server returned status {}", response.status()));
        }

        // Reject oversized files before reading the body to prevent OOM
        if let Some(content_length) = response.headers().get(reqwest::header::CONTENT_LENGTH) {
            if let Ok(length) = content_length.to_str().unwrap_or("0").parse::<u64>() {
                if length > MAX_IMAGE_BYTES {
                    return Err(format!(
                        "Image is too large ({} bytes). Maximum allowed is 25MB.",
                        length
                    ));
                }
            }
        }

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
    // Reject oversized payloads before allocating the image decoder
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(format!(
            "Image is too large ({} bytes). Maximum allowed is 25MB.",
            bytes.len()
        ));
    }

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
