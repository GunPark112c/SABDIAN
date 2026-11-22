// --- REFERENCIAS AL DOM ---
const toggle = document.getElementById("toggle-modo");
const vistaIndividual = document.getElementById("vista-individual");
const vistaCarpeta = document.getElementById("vista-carpeta");
const contenedorResultados = document.getElementById("resultados-container");
const loaderContainer = document.getElementById("loader-container");
const tbody = document.querySelector("#tabla-resultados tbody");

const contenedorHallazgos = document.getElementById("detalle-hallazgos-container");
const tituloHallazgos = document.getElementById("titulo-hallazgos");
const tbodyHallazgos = document.querySelector("#tabla-hallazgos tbody");

// Elementos de la carpeta
const inputCarpeta = document.getElementById("input-carpeta");
const dropZone = document.getElementById("drop-zone");
const zonaCargaTexto = document.getElementById("zona-carga-texto");
const listaArchivosContainer = document.getElementById("lista-archivos");

function limpiarResultados() {
    contenedorResultados.style.display = "none";
    tbody.innerHTML = "";
    contenedorHallazgos.style.display = "none";
    tbodyHallazgos.innerHTML = "";
}

// --- 1. FORZAR ESTADO INICIAL LIMPIO AL CARGAR LA PÁGINA ---
window.addEventListener("load", () => {
    toggle.checked = false;
    document.body.classList.remove("modo-oscuro");
    vistaIndividual.style.display = "flex";
    vistaCarpeta.style.display = "none";
    
    document.getElementById("codigo-individual").value = "";
    inputCarpeta.value = "";
    zonaCargaTexto.style.display = "flex";
    listaArchivosContainer.style.display = "none";
    listaArchivosContainer.innerHTML = "";
    
    limpiarResultados();
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
    limpiarResultados();
    loaderContainer.style.display = "none";
});

// --- 3. MOSTRAR LOS ARCHIVOS DE LA CARPETA SELECCIONADA ---
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

// --- 4. FUNCIONES PARA MOSTRAR RESULTADOS Y HALLAZGOS ---
function obtenerValor(obj, rutas, porDefecto = "—") {
    for (const ruta of rutas) {
        const partes = ruta.split(".");
        let actual = obj;
        let ok = true;
        for (const p of partes) {
            if (actual && typeof actual === "object" && p in actual && actual[p] !== undefined && actual[p] !== null) {
                actual = actual[p];
            } else {
                ok = false;
                break;
            }
        }
        if (ok) {
            if (Array.isArray(actual)) {
                return actual.length > 0 ? actual.join(" • ") : "Ninguno";
            }
            return String(actual);
        }
    }
    return porDefecto;
}

function mostrarDetalleHallazgos(res) {
    if (!res) {
        contenedorHallazgos.style.display = "none";
        tbodyHallazgos.innerHTML = "";
        return;
    }

    contenedorHallazgos.style.display = "block";
    tituloHallazgos.textContent = `Hallazgos del Analizador — ${res.archivo || "Bloque"}`;
    tbodyHallazgos.innerHTML = "";

    const filas = [
        {
            metrica: "Líneas totales",
            valor: obtenerValor(res, ["estatica.lineas_totales"]),
            significado: "Cantidad total de líneas del archivo o bloque; ayuda a dimensionar su extensión y modularidad."
        },
        {
            metrica: "Funciones",
            valor: obtenerValor(res, ["estatica.num_funciones"]),
            significado: "Número de funciones o bloques detectados en el código."
        },
        {
            metrica: "Complejidad alta",
            valor: obtenerValor(res, ["estatica.complejidad_alta"]),
            significado: "Funciones con complejidad ciclomática superior al umbral definido, más difíciles de probar y mantener."
        },
        {
            metrica: "Sin docstring",
            valor: obtenerValor(res, ["estatica.funciones_sin_docstring"]),
            significado: "Funciones sin docstring que explique su propósito, parámetros o retorno."
        },
        {
            metrica: "Sin type hints",
            valor: obtenerValor(res, ["estatica.funciones_sin_typehints"]),
            significado: "Funciones sin anotaciones de tipo completas en parámetros o retorno."
        },
        {
            metrica: "except: pass",
            valor: obtenerValor(res, ["estatica.except_pass"]),
            significado: "Bloques except que solo contienen pass, ocultando errores en silencio."
        },
        {
            metrica: "Score IA",
            valor: res.score_ia !== undefined ? `${res.score_ia}/100` : "—",
            significado: "Puntaje heurístico (0 a 100) basado en entropía, burstiness, nombres y patrones del código."
        },
        {
            metrica: "Entropía",
            valor: obtenerValor(res, ["textura.entropia_nombres"]),
            significado: "Entropía de Shannon de los nombres/identificadores; valores bajos indican repetición o poca variedad."
        },
        {
            metrica: "Burstiness",
            valor: obtenerValor(res, ["textura.burstiness"]),
            significado: "Desviación estándar de la longitud de líneas; valores bajos reflejan líneas de extensión muy uniforme."
        },
        {
            metrica: "Deuda técnica (LLM)",
            valor: obtenerValor(res, ["semantica.deuda_tecnica"]),
            significado: "Evaluación semántica del modelo sobre mantenibilidad, claridad y posibles atajos de diseño."
        },
        {
            metrica: "Razones / Observaciones",
            valor: obtenerValor(res, ["razones", "semantica.observaciones"]),
            significado: "Motivos del veredicto y observaciones puntuales detectadas durante el análisis."
        }
    ];

    filas.forEach(item => {
        const tr = document.createElement("tr");

        const tdMetrica = document.createElement("td");
        tdMetrica.textContent = item.metrica;

        const tdValor = document.createElement("td");
        tdValor.textContent = item.valor;
        tdValor.style.fontWeight = "700";

        const tdSignificado = document.createElement("td");
        tdSignificado.textContent = item.significado;
        tdSignificado.className = "hallazgo-significado";

        tr.append(tdMetrica, tdValor, tdSignificado);
        tbodyHallazgos.appendChild(tr);
    });
}

function mostrarResultados(resultados) {
    contenedorResultados.style.display = "block";
    tbody.innerHTML = "";

    if (!resultados || resultados.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>No hay datos para analizar.</td></tr>";
        mostrarDetalleHallazgos(null);
        return;
    }

    resultados.forEach((res, idx) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.title = "Haz clic para ver los hallazgos de este archivo abajo";

        const tdNombre = document.createElement("td");
        tdNombre.textContent = res.archivo;
        
        const tdVeredicto = document.createElement("td");
        tdVeredicto.textContent = (res.veredicto || "").replace(/_/g, ' ');
        tdVeredicto.className = res.veredicto || ""; 
        
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

        tr.addEventListener("click", () => {
            tbody.querySelectorAll("tr").forEach(fila => fila.classList.remove("fila-activa"));
            tr.classList.add("fila-activa");
            mostrarDetalleHallazgos(res);
        });

        if (idx === 0) tr.classList.add("fila-activa");

        tr.append(tdNombre, tdVeredicto, tdScore, tdDeuda);
        tbody.appendChild(tr);
    });

    mostrarDetalleHallazgos(resultados[0]);
}

// --- 5. LÓGICA PARA ANALIZAR CÓDIGO INDIVIDUAL ---
document.getElementById("btn-analizar-individual").addEventListener("click", async () => {
    const codigo = document.getElementById("codigo-individual").value;
    if (!codigo.trim()) {
        alert("Pega algún código primero.");
        return;
    }

    limpiarResultados();
    loaderContainer.style.display = "block";

    try {
        const resp = await fetch("/analizar-individual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo })
        });
        const data = await resp.json();
        
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

    
    limpiarResultados();
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
    
    if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        if (items.length === 1 && items[0].webkitGetAsEntry && items[0].webkitGetAsEntry().isDirectory) {
            alert("Por seguridad, los navegadores no permiten leer carpetas al arrastrarlas. Por favor, haz clic en 'seleccionar' y elige la carpeta desde el explorador.");
            return;
        }

        const archivosSoltados = Array.from(e.dataTransfer.files);
        if (archivosSoltados.length > 0) {
            const dt = new DataTransfer();
            archivosSoltados.forEach(file => dt.items.add(file));
            inputCarpeta.files = dt.files;
            
            inputCarpeta.dispatchEvent(new Event('change'));
        }
    }
});
