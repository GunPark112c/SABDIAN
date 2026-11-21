const btn = document.getElementById("btn-analizar");
const inputCarpeta = document.getElementById("input-carpeta");
const dropZone = document.getElementById("drop-zone");
const contenedorResultados = document.getElementById("resultados-container");
const tbody = document.querySelector("#tabla-resultados tbody");

// Variables para manejar los archivos (por clic o arrastre)
let archivosSeleccionados = [];

// --- 1. Manejo del Drag & Drop (Arrastrar y soltar) ---
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--acento)";
    dropZone.style.background = "rgba(74, 222, 128, 0.08)";
});

dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--borde-fuerte)";
    dropZone.style.background = "var(--superficie-2)";
});

dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--borde-fuerte)";
    dropZone.style.background = "var(--superficie-2)";
    
    // Extraer los archivos de la carpeta soltada
    if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        // Nota: Manejar carpetas por drag&drop requiere la API de FileSystem, 
        // aquí simulamos que el usuario seleccionó la carpeta.
        alert("Para analizar una carpeta completa, por favor haz clic y selecciona la carpeta en el explorador de archivos.");
    }
});

// --- 2. Manejo de selección por clic ---
inputCarpeta.addEventListener("change", (e) => {
    archivosSeleccionados = Array.from(e.target.files);
    if (archivosSeleccionados.length > 0) {
        const nombreCarpeta = archivosSeleccionados[0].webkitRelativePath.split('/')[0];
        document.querySelector(".vl-docs-zona__texto").innerHTML = `Carpeta seleccionada: <strong>${nombreCarpeta}</strong>`;
        document.querySelector(".vl-docs-zona__pista").textContent = `${archivosSeleccionados.length} archivos encontrados`;
    }
});

// --- 3. Función principal del botón ---
btn.addEventListener("click", async () => {
    const archivos = inputCarpeta.files;
    
    if (archivos.length === 0) {
        alert("Por favor, selecciona una carpeta primero haciendo clic en la zona de carga.");
        return;
    }

    // Estado de carga
    btn.disabled = true;
    btn.textContent = "Leyendo archivos...";
    contenedorResultados.style.display = "none";
    tbody.innerHTML = ""; // Limpiar tabla

    const payload = { archivos: {} };
    let archivosLeidos = 0;

    // 1. Leer todos los archivos de la carpeta seleccionada
    for (const file of archivos) {
        // Ignorar carpetas ocultas, node_modules, venv, etc.
        if (
            file.name.startsWith('.') || 
            file.webkitRelativePath.includes('node_modules') || 
            file.webkitRelativePath.includes('venv') ||
            file.webkitRelativePath.includes('__pycache__')
        ) {
            continue;
        }

        // Ignorar archivos muy pesados (ej. imágenes, binarios, > 100KB)
        if (file.size > 100000) continue; 

        try {
            const texto = await file.text();
            payload.archivos[file.webkitRelativePath || file.name] = texto;
            archivosLeidos++;
        } catch (e) {
            console.warn("No se pudo leer el archivo:", file.name);
        }
    }

    if (archivosLeidos === 0) {
        alert("No se encontraron archivos de texto válidos en la carpeta.");
        btn.disabled = false;
        btn.textContent = "Analizar Carpeta";
        return;
    }

    btn.textContent = `Analizando ${archivosLeidos} archivos... (puede tardar)`;

    // 2. Enviar los datos al backend (FastAPI + Groq)
    try {
        const resp = await fetch("/analizar-carpeta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            throw new Error(`Error en el servidor: ${resp.status} ${resp.statusText}`);
        }
        
        const data = await resp.json();
        
        // 3. Mostrar los resultados en la tabla
        contenedorResultados.style.display = "block";

        if (data.resultados.length === 0) {
            tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No se encontró código válido para analizar.</td></tr>";
            return;
        }

        data.resultados.forEach(res => {
            const tr = document.createElement("tr");
            
            // Columna: Archivo
            const tdNombre = document.createElement("td");
            tdNombre.textContent = res.archivo;
            tdNombre.style.color = "var(--texto)";
            tdNombre.style.fontWeight = "600";
            
            // Columna: Veredicto (con clases CSS para colores)
            const tdVeredicto = document.createElement("td");
            tdVeredicto.textContent = res.veredicto.replace(/_/g, ' '); // Quita guiones bajos para que se vea mejor
            tdVeredicto.className = res.veredicto; // Asigna la clase APROBADO, RECHAZADO, etc.
            
            // Columna: Score IA
            const tdScore = document.createElement("td");
            tdScore.textContent = res.score_ia + "/100";
            tdScore.style.fontWeight = "700";
            
            // Columna: Deuda Técnica (Manejando errores de Groq)
            const tdDeuda = document.createElement("td");
            if (res.semantica.error) {
                // Si Groq falló, mostramos el error en rojo
                tdDeuda.textContent = "Error de IA";
                tdDeuda.title = res.semantica.error; // Muestra el error completo al pasar el mouse
                tdDeuda.style.color = "#ff5a64"; 
                tdDeuda.style.fontWeight = "bold";
                tdDeuda.style.cursor = "help";
            } else {
                // Si todo salió bien, mostramos la deuda técnica
                tdDeuda.textContent = res.semantica.deuda_tecnica || "N/A";
                if (res.semantica.deuda_tecnica === "Alta") tdDeuda.style.color = "#ff5a64";
                if (res.semantica.deuda_tecnica === "Media") tdDeuda.style.color = "#ffd87a";
                if (res.semantica.deuda_tecnica === "Baja") tdDeuda.style.color = "var(--acento)";
            }

            // Unir celdas a la fila y la fila a la tabla
            tr.append(tdNombre, tdVeredicto, tdScore, tdDeuda);
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Error en la petición:", err);
        alert("Error de red o del servidor: " + err.message);
    } finally {
        // Restaurar botón
        btn.disabled = false;
        btn.textContent = "Analizar Carpeta";
    }
});
