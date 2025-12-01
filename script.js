const GEMINI_API_KEY = "AIzaSyAJlROJRNTfENloI9x3K5fa9pGyGlEjcLU";
const GEMINI_MODEL = "gemini-2.0-flash";

const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const analyzeBtn = document.getElementById("analyzeBtn");
const statusDiv = document.getElementById("status");
const resultBox = document.getElementById("result");
const analysisText = document.getElementById("analysisText");
const bucketLine = document.getElementById("bucketLine");

let selectedFile = null;

// ----------------- UBIDOTS CONFIG -----------------
const UBIDOTS_TOKEN  = "BBUS-i5E2LrAWnHUcNmWB11foDdNjU8r7x2";
const UBIDOTS_DEVICE = "ESP8266";
const UBIDOTS_URL    = "https://industrial.api.ubidots.com/api/v1.6/devices/" + UBIDOTS_DEVICE;

async function enviarClasificacionUbidots(bucket) {
  const payload = {};

  if (bucket === "plastico") {
    payload.plastico = { value: 1 };
  } else if (bucket === "metal") {
    payload.metal = { value: 1 };
  } else if (bucket === "organico") {
    payload.organico = { value: 1 };
  } else if (bucket === "inorganico") {
    payload.inorganico = { value: 1 };
  } else {
    console.warn("Bucket desconocido:", bucket);
    return;
  }

  try {
    const res = await fetch(UBIDOTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": UBIDOTS_TOKEN
      },
      body: JSON.stringify(payload)
    });

    console.log("Ubidots status:", res.status);
  } catch (err) {
    console.error("Error enviando a Ubidots:", err);
  }
}

// ----------------- LÓGICA DE IA -----------------
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  preview.innerHTML = "";

  if (!file) return;

  selectedFile = file;

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  preview.appendChild(img);
});

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) {
    alert("Primero selecciona una imagen.");
    return;
  }

  statusDiv.textContent = "Analizando imagen...";
  resultBox.style.display = "none";
  analyzeBtn.disabled = true;

  try {
    const base64 = await fileToBase64(selectedFile);
    const cleanBase64 = base64.split(",")[1];

    const prompt =
      "Analiza la foto del residuo y responde en ESPAÑOL con un texto normal, " +
      "sin listas, sin JSON y sin formato raro. Explica:\n" +
      "1) Qué residuo parece ser.\n" +
      "2) En qué bote debe ir.\n" +
      "SOLO puedes usar exactamente UNA de estas opciones de bote: metal, plastico, inorganico u organico.\n" +
      "Debes escribirlo tal cual en una frase, por ejemplo: 'Debes tirarlo en el bote de plastico'.\n" +
      "3) Da una breve explicación sencilla.\n" +
      "No uses  ni títulos técnicos.";

    const body = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: selectedFile.type,
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      }]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    let text = data.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("\n") || "No se obtuvo respuesta.";

    text = text.replace(//g, "").trim();

    const lower = text.toLowerCase();
    let bucket = "";

    if (lower.includes("bote de metal") || lower.includes(" metal")) {
      bucket = "metal";
    } else if (lower.includes("bote de plastico") || lower.includes(" plástico") || lower.includes(" plastico")) {
      bucket = "plastico";
    } else if (lower.includes("bote inorganico") || lower.includes(" inorganico")) {
      bucket = "inorganico";
    } else if (lower.includes("bote organico") || lower.includes(" organico")) {
      bucket = "organico";
    }

    if (bucket) {
      bucketLine.innerHTML = "Bote sugerido: <span class='bucket-highlight'>" + bucket + "</span>";
      enviarClasificacionUbidots(bucket);
    } else {
      bucketLine.textContent = "Bote sugerido: no identificado.";
    }

    analysisText.textContent = text;

    resultBox.style.display = "block";
    statusDiv.textContent = "Análisis completo ✅";

  } catch (error) {
    console.error(error);
    alert("Error al analizar: " + error.message);
    statusDiv.textContent = "Ocurrió un error.";
  }

  analyzeBtn.disabled = false;
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}