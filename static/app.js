const toggle = document.getElementById("toggle-modo");
const vistaIndividual = document.getElementById("vista-individual");
const vistaCarpeta = document.getElementById("vista-carpeta");
const contenedorResultados = document.getElementById("resultados-container");
const tbody = document.querySelector("#tabla-resultados tbody");
const loaderContainer = document.getElementById("loader-container");

const inputCarpeta = document.getElementById("input-carpeta");
const dropZone = document.getElementById("drop-zone");
const zonaCargaTexto = document.getElementById("zona-carga-texto");
const listaArchivosContainer = document.getElementById("lista-archivos");

// --- FORZAR ESTADO INICIAL LIMPIO AL CARGAR LA PÁGINA ---
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

// --- Lógica del Interruptor ---
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

// --- Lógica para mostrar los archivos de la carpeta ---
inputCarpeta.addEventListener("change", (e) => {
    const archivos = Array.from(e.target.files);
    if (archivos.length > 0) {
        zonaCargaTexto.style.display = "none";
        listaArchivosContainer.style.display = "flex";
        listaArchivosContainer.innerHTML = ""; 

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

// --- Función para mostrar resultados ---
function mostrarResultados(resultados) {
    contenedorResultados.style.display = "block";
    tbody.innerHTML = "";

    if (resultados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay datos para analizar.</td></tr>";
        return;
    }

    resultados.forEach(res => {
        const tr = document.createElement("tr");
        const tdNombre = document.createElement("td"); tdNombre.textContent = res.archivo;
        const tdVeredicto = document.createElement("td"); tdVeredicto.textContent = res.veredicto.replace(/_/g, ' '); tdVeredicto.className = res.veredicto; 
        const tdScore = document.createElement("td"); tdScore.textContent = res.score_ia + "/100"; tdScore.style.fontWeight = "700";
        
        const tdDeuda = document.createElement("td");
        if (res.semantica && res.semantica.error) {
            tdDeuda.textContent = "Error de IA"; tdDeuda.title = res.semantica.error; tdDeuda.style.color = "#cc0000"; tdDeuda.style.fontWeight = "bold";
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

// --- Lógica para Código Individual ---
document.getElementById("btn-analizar-individual").addEventListener("click", async () => {
    const codigo = document.getElementById("codigo-individual").value;
    if (!codigo.trim()) { alert("Pega algún código primero."); return; }

    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "block";

    try {
        const resp = await fetch("/analizar-individual", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: codigo })
        });
        const data = await resp.json();
        setTimeout(() => {
            loaderContainer.style.display = "none";
            mostrarResultados([data]);
        }, 1000); 
    } catch (err) {
        loaderContainer.style.display = "none";
        alert("Error de red: " + err.message);
    }
});

// --- Lógica para Carpeta ---
document.getElementById("btn-analizar-carpeta").addEventListener("click", async () => {
    const archivos = inputCarpeta.files;
    if (archivos.length === 0) { alert("Por favor, selecciona una carpeta primero."); return; }

    contenedorResultados.style.display = "none";
    loaderContainer.style.display = "block";

    const payload = { archivos: {} };
    let archivosLeidos = 0;

    for (const file of archivos) {
        if (file.name.startsWith('.') || file.webkitRelativePath.includes('node_modules') || file.webkitRelativePath.includes('venv') || file.webkitRelativePath.includes('__pycache__')) continue;
        if (file.size > 100000) continue; 
        try {
            const texto = await file.text();
            payload.archivos[file.webkitRelativePath || file.name] = texto;
            archivosLeidos++;
        } catch (e) {}
    }

    if (archivosLeidos === 0) {
        alert("No se encontraron archivos válidos."); loaderContainer.style.display = "none"; return;
    }

    try {
        const resp = await fetch("/analizar-carpeta", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
        });
        const data = await resp.json();
        loaderContainer.style.display = "none";
        mostrarResultados(data.resultados);
    } catch (err) {
        loaderContainer.style.display = "none";
        alert("Error: " + err.message);
    }
});

// --- Efectos visuales del Drag & Drop ---
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "#4ade80"; });
dropZone.addEventListener("dragleave", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--borde-goma)"; });
dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--borde-goma)"; alert("Por favor, usa el clic para seleccionar la carpeta."); });
