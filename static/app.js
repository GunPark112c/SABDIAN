// --- Referencias al DOM ---
const toggle = document.getElementById("toggle-modo");
const themeContainer = document.getElementById("theme-container");
const vistaIndividual = document.getElementById("vista-individual");
const vistaCarpeta = document.getElementById("vista-carpeta");
const tablaWrapper = document.getElementById("tabla-wrapper");
const tabla = document.getElementById("tabla-resultados");

const btnIndividual = document.getElementById("btn-analizar-individual");
const btnCarpeta = document.getElementById("btn-analizar-carpeta");
const inputCarpeta = document.getElementById("input-carpeta");
const dropZone = document.getElementById("drop-zone");
const contenedorResultados = document.getElementById("resultados-container");
const tbody = document.querySelector("#tabla-resultados tbody");

// --- Lógica del Interruptor (Tema y Vista) ---
// --- Lógica del Interruptor (Tema y Vista) ---
toggle.addEventListener("change", () => {
    if (toggle.checked) {
        // MODO OSCURO (Carpeta)
        document.body.classList.add("modo-oscuro");
        vistaIndividual.style.display = "none";
        vistaCarpeta.style.display = "flex";
    } else {
        // MODO CLARO (Individual)
        document.body.classList.remove("modo-oscuro");
        vistaIndividual.style.display = "flex";
        vistaCarpeta.style.display = "none";
    }
    
    // Ocultar resultados anteriores al cambiar de modo
    contenedorResultados.style.display = "none";
});

// --- Función para llenar la tabla (Compartida) ---
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
            if (res.semantica && res.semantica.deuda_tecnica === "Baja") tdDeuda.style.color = toggle.checked ? "#4ade80" : "#111111";
        }

        tr.append(tdNombre, tdVeredicto, tdScore, tdDeuda);
        tbody.appendChild(tr);
    });
}

// --- Lógica para Código Individual ---
btnIndividual.addEventListener("click", async () => {
    const codigo = document.getElementById("codigo-individual").value;
    if (!codigo.trim()) {
        alert("Pega algún código primero.");
        return;
    }

    btnIndividual.disabled = true;
    btnIndividual.textContent = "Analizando...";

    try {
        const resp = await fetch("/analizar-individual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo })
        });
        const data = await resp.json();
        
        // El backend devuelve un solo resultado, lo metemos en un array
        mostrarResultados([data]);
    } catch (err) {
        alert("Error de red: " + err.message);
    } finally {
        btnIndividual.disabled = false;
        btnIndividual.textContent = "Analizar Código";
    }
});

// --- Lógica para Carpeta ---
btnCarpeta.addEventListener("click", async () => {
    const archivos = inputCarpeta.files;
    if (archivos.length === 0) {
        alert("Por favor, selecciona una carpeta primero.");
        return;
    }

    btnCarpeta.disabled = true;
    btnCarpeta.textContent = "Leyendo archivos...";

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
        alert("No se encontraron archivos válidos.");
        btnCarpeta.disabled = false;
        btnCarpeta.textContent = "Analizar Carpeta";
        return;
    }

    btnCarpeta.textContent = `Analizando ${archivosLeidos} archivos...`;

    try {
        const resp = await fetch("/analizar-carpeta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        mostrarResultados(data.resultados);
    } catch (err) {
        alert("Error: " + err.message);
    } finally {
        btnCarpeta.disabled = false;
        btnCarpeta.textContent = "Analizar Carpeta";
    }
});

// --- Drag & Drop visual (solo estética) ---
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.style.borderColor = "#4ade80"; });
dropZone.addEventListener("dragleave", (e) => { e.preventDefault(); dropZone.style.borderColor = "#444"; });
dropZone.addEventListener("drop", (e) => { e.preventDefault(); dropZone.style.borderColor = "#444"; alert("Por favor, usa el clic para seleccionar la carpeta."); });
