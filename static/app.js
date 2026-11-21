const btn = document.getElementById("btn-analizar");
const inputCarpeta = document.getElementById("input-carpeta");
const contenedorResultados = document.getElementById("resultados-container");
const tbody = document.querySelector("#tabla-resultados tbody");

btn.addEventListener("click", async () => {
    const archivos = inputCarpeta.files;
    
    if (archivos.length === 0) {
        alert("Por favor, selecciona una carpeta primero.");
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

    // 2. Enviar los datos al backend (FastAPI + Gemini)
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
            tbody.innerHTML = "<tr><td colspan='4'>No se encontró código válido para analizar.</td></tr>";
            return;
        }

        data.resultados.forEach(res => {
            const tr = document.createElement("tr");
            
            // Columna: Archivo
            const tdNombre = document.createElement("td");
            tdNombre.textContent = res.archivo;
            
            // Columna: Veredicto
            const tdVeredicto = document.createElement("td");
            tdVeredicto.textContent = res.veredicto;
            tdVeredicto.className = res.veredicto; // Usa las clases CSS (APROBADO, RECHAZADO, etc)
            
            // Columna: Score IA
            const tdScore = document.createElement("td");
            tdScore.textContent = res.score_ia + "/100";
            
            // Columna: Deuda Técnica (Manejando errores de Gemini)
            const tdDeuda = document.createElement("td");
            if (res.semantica.error) {
                // Si Gemini falló, mostramos el error en rojo
                tdDeuda.textContent = res.semantica.error;
                tdDeuda.style.color = "#f44336"; 
                tdDeuda.style.fontWeight = "bold";
            } else {
                // Si todo salió bien, mostramos la deuda técnica
                tdDeuda.textContent = res.semantica.deuda_tecnica || "N/A";
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