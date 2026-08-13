/**
 * eMandi Extension - Offline-to-Online Captcha Solver Helper using OCR.space API
 */

function logOcr(msg) {
  console.log("[OCR] " + msg);
}

/**
 * Captures a screenshot of the captcha element via canvas, converts to base64,
 * and calls the OCR.space API to solve the 4-digit code.
 */
async function solveCaptchaViaOcrApi(imgElement, apiKey) {
  try {
    const canvas = document.createElement("canvas");
    const width = imgElement.naturalWidth || imgElement.clientWidth || imgElement.width || 120;
    const height = imgElement.naturalHeight || imgElement.clientHeight || imgElement.height || 40;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgElement, 0, 0, width, height);
    
    const base64Image = canvas.toDataURL("image/png");
    
    logOcr("Sending captcha image to OCR.space API for parsing...");
    
    const formData = new FormData();
    formData.append("base64Image", base64Image);
    // If no API Key is provided, use the working public key "K81414436588957" or "helloworld"
    formData.append("apikey", apiKey || "K81414436588957");
    formData.append("language", "eng");
    formData.append("OCREngine", "2"); // Engine 2 is optimized for captchas / single words
    
    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData
    });
    
    const data = await response.json();
    if (data && data.ParsedResults && data.ParsedResults.length > 0) {
      const parsedText = data.ParsedResults[0].ParsedText || "";
      logOcr("Raw OCR Response: " + parsedText.replace(/\n/g, " "));
      
      // Keep only digits
      let digits = parsedText.replace(/[^0-9]/g, "");
      
      // If we found exactly 4 digits, return them
      if (digits.length === 4) {
        return digits;
      }
      
      // Otherwise, remove whitespace and search for a 4-digit sequence via Regex
      const cleanNoSpaces = parsedText.replace(/\s/g, "");
      const match = cleanNoSpaces.match(/\d{4}/);
      if (match) {
        logOcr("Regex extracted 4-digit code: " + match[0]);
        return match[0];
      }
      
      logOcr(`Could not extract a valid 4-digit code from parsed text: "${parsedText}"`);
    } else {
      logOcr("OCR.space API error or empty results: " + JSON.stringify(data));
    }
    return null;
  } catch (err) {
    logOcr("OCR.space API request failed: " + err.message);
    return null;
  }
}
