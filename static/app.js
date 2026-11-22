// --- REFERENCIAS AL DOM ---
const toggle = document.getElementById("toggle-modo");
const vistaIndividual = document.getElementById("vista-individual");
const vistaCarpeta = document.getElementById("vista-carpeta");
const contenedorResultados = document.getElementById("resultados-container");
const loaderContainer = document.getElementById("loader-container");
const tbody = document.querySelector("#tabla-resultados tbody");

// Elementos de la carpeta
const inputCarpeta = document.getElementById("input-carpeta");
const dropZone = document.getElementById("drop-zone");
const zonaCargaTexto = document.getElementById("zona-carga-texto");
const listaArchivosContainer = document.getElementById("lista-archivos");

// --- 1. FORZAR ESTADO INICIAL LIMPIO AL CARGAR LA PÁGINA ---
// Esto evita el "estado fantasma" del navegador (que recuerda los archivos y el checkbox)
window.addEventListener("load", () => {
    toggle.checked = false; // Forzar el interruptor a apagado
    document.body.classList.remove("modo-oscuro");
    vistaIndividual.style.display = "flex";
    vistaCarpeta.style.display = "none";
    
    // Limpiar la caja de texto y la lista de archivos
    document.getElementById("codigo-individual").value = "";
    inputCarpeta.value = ""; // Limpia los archivos seleccionados
    zonaCargaTexto.style.display = "flex"; // Muestra el ícono de carpeta de nuevo
    listaArchivosContainer.style.display = "none";
    listaArchivosContainer.innerHTML = "";
    
    // Ocultar resultados y loader
    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "none";
});

// --- 2. LÓGICA DEL INTERRUPTOR (TEMA Y VISTA) ---
toggle.addEventListener("change", () => {
    if (toggle.checked) {
        document.body.classList.add("modo-oscuro");
        vistaIndividual.style.display = "none";
        vistaCarpeta.style.display = "flex";
    } else {
        document.body.classList.remove("modo-oscuro");
        vistaIndividual.style.display = "flex";
        vistaCarpeta.style.display = "none";
    }
    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "none";
});

// --- 3. MOSTRAR LOS ARCHIVOS DE LA CARPETA SELECCIONADA ---
inputCarpeta.addEventListener("change", (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length > 0) {
        zonaCargaTexto.style.display = "none";
        listaArchivosContainer.style.display = "flex";
        listaArchivosContainer.innerHTML = ""; // Limpiar lista anterior

        // Mostramos max 5 archivos para no hacer la caja gigante
        archivos.slice(0, 5).forEach(file => {
            const item = document.createElement("div");
            item.className = "archivo-item";
            item.innerHTML = `<span>📄</span> ${file.name}`;
            listaArchivosContainer.appendChild(item);
        });
        if (archivos.length > 5) {
            const mas = document.createElement("div");
            mas.className = "archivo-item archivo-mas";
            mas.textContent = `... y ${archivos.length - 5} archivos más`;
            listaArchivosContainer.appendChild(mas);
        }
    }
});

// --- 4. FUNCIÓN PARA MOSTRAR RESULTADOS EN LA TABLA ---
function mostrarResultados(resultados) {
    contenedorResultados.style.display = "block";
    tbody.innerHTML = "";

    if (resultados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay datos para analizar.</td></tr>";
        return;
    }

    resultados.forEach(res => {
        const tr = document.createElement("tr");
        
        const tdNombre = document.createElement("td");
        tdNombre.textContent = res.archivo;
        
        const tdVeredicto = document.createElement("td");
        tdVeredicto.textContent = res.veredicto.replace(/_/g, ' ');
        tdVeredicto.className = res.veredicto; 
        
        const tdScore = document.createElement("td");
        tdScore.textContent = res.score_ia + "/100";
        tdScore.style.fontWeight = "700";
        
        const tdDeuda = document.createElement("td");
        if (res.semantica && res.semantica.error) {
            tdDeuda.textContent = "Error de IA";
            tdDeuda.title = res.semantica.error;
            tdDeuda.style.color = "#cc0000"; 
            tdDeuda.style.fontWeight = "bold";
        } else {
            tdDeuda.textContent = res.semantica ? (res.semantica.deuda_tecnica || "N/A") : "N/A";
            if (res.semantica && res.semantica.deuda_tecnica === "Alta") tdDeuda.style.color = "#cc0000";
            if (res.semantica && res.semantica.deuda_tecnica === "Media") tdDeuda.style.color = "#cc7700";
            if (res.semantica && res.semantica.deuda_tecnica === "Baja") tdDeuda.style.color = document.body.classList.contains("modo-oscuro") ? "#4ade80" : "#111111";
        }

        tr.append(tdNombre, tdVeredicto, tdScore, tdDeuda);
        tbody.appendChild(tr);
    });
}

// --- 5. LÓGICA PARA ANALIZAR CÓDIGO INDIVIDUAL ---
document.getElementById("btn-analizar-individual").addEventListener("click", async () => {
    const codigo = document.getElementById("codigo-individual").value;
    if (!codigo.trim()) {
        alert("Pega algún código primero.");
        return;
    }

    // Mostrar Loader y ocultar resultados viejos
    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "block";

    try {
        const resp = await fetch("/analizar-individual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo })
        });
        const data = await resp.json();
        
        // Pequeño delay para que la animación se disfrute
        setTimeout(() => {
            loaderContainer.style.display = "none";
            mostrarResultados([data]);
        }, 800); 

    } catch (err) {
        loaderContainer.style.display = "none";
        alert("Error de red: " + err.message);
    }
});

// --- 6. LÓGICA PARA ANALIZAR CARPETA ---
document.getElementById("btn-analizar-carpeta").addEventListener("click", async () => {
    const archivos = inputCarpeta.files;
    if (archivos.length === 0) {
        alert("Por favor, selecciona una carpeta primero.");
        return;
    }

    // Mostrar Loader y ocultar resultados viejos
    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "block";

    const payload = { archivos: {} };
    let archivosLeidos = 0;

    for (const file of archivos) {
        // Ignorar carpetas ocultas y basura
        if (file.name.startsWith('.') || file.webkitRelativePath.includes('node_modules') || file.webkitRelativePath.includes('venv') || file.webkitRelativePath.includes('__pycache__')) continue;
        if (file.size > 100000) continue; // Ignorar archivos > 100KB

        try {
            const texto = await file.text();
            payload.archivos[file.webkitRelativePath || file.name] = texto;
            archivosLeidos++;
        } catch (e) {}
    }

    if (archivosLeidos === 0) {
        alert("No se encontraron archivos válidos para analizar.");
        loaderContainer.style.display = "none";
        return;
    }

    try {
        const resp = await fetch("/analizar-carpeta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        
        loaderContainer.style.display = "none";
        mostrarResultados(data.resultados);
    } catch (err) {
        loaderContainer.style.display = "none";
        alert("Error de red: " + err.message);
    }
});

// --- 7. EFECTOS VISUALES Y LÓGICA DEL DRAG & DROP ---
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "#4ade80";
});

dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--borde-goma)";
});

dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--borde-goma)";
    
    // Verificamos si es una carpeta o archivos individuales
    if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        if (items.length === 1 && items[0].webkitGetAsEntry && items[0].webkitGetAsEntry().isDirectory) {
            alert("Por seguridad, los navegadores no permiten leer carpetas al arrastrarlas. Por favor, haz clic en 'seleccionar' y elige la carpeta desde el explorador.");
            return;
        }

        // Si son archivos individuales, simulamos la selección
        const archivosSoltados = Array.from(e.dataTransfer.files);
        if (archivosSoltados.length > 0) {
            const dt = new DataTransfer();
            archivosSoltados.forEach(file => dt.items.add(file));
            inputCarpeta.files = dt.files;
            
            // Disparamos el evento para que aparezca la lista de archivos
            inputCarpeta.dispatchEvent(new Event('change'));
        }
    }
});
