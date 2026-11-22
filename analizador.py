import ast
import json
import math
import statistics
import re
from collections import Counter

UMBRALES = {
    "max_lineas_archivo": 1000,
    "max_lineas_funcion": 100,
    "max_longitud_linea": 120,
    "max_parametros_funcion": 7,
    "max_complejidad_ciclomatica": 15,
    "max_anidamiento": 5,
    "min_entropia_nombres": 3.8, 
    "min_burstiness_lineas": 20.0, 
    "max_ratio_docstrings": 0.8,
    "min_ratio_comentarios": 0.02, 
    "max_ratio_comentarios": 0.30, 
    "umbral_sospecha_ia": 35,
}

NOMBRES_PROHIBIDOS = {
    # --- Genéricos absolutos ---
    "data", "info", "value", "val", "item", "object", "obj", "element", "elem",
    "thing", "stuff", "temp", "tmp", "var", "variable", "aux", "auxiliary",
    
    # --- Acciones y procesos ---
    "process", "handle", "execute", "run", "perform", "do", "make", "create",
    "build", "generate", "calculate", "compute", "evaluate", "check", "validate",
    "verify", "update", "modify", "change", "set", "get", "fetch", "retrieve",
    
    # --- Utilidades y helpers ---
    "util", "utils", "helper", "helpers", "manager", "controller", "service",
    "factory", "builder", "handler", "processor", "provider", "wrapper",
    
    # --- Resultados y estados ---
    "result", "res", "output", "out", "input", "inp", "response", "resp",
    "status", "state", "flag", "is_valid", "is_ready", "success", "error",
    
    # --- Comunes en bucles y arrays ---
    "list", "arr", "array", "collection", "items", "records", "rows", "cols",
    "index", "idx", "counter", "count", "total", "sum", "max", "min", "avg",
    
    # --- Típicos de JS/TS ---
    "btn", "button", "click", "event", "evt", "e", "el", "element", "node",
    "div", "span", "input", "form", "field", "modal", "popup", "dialog",
    "handler", "callback", "cb", "promise", "async", "await", "fetch",
    
    # --- Típicos de Python ---
    "df", "dataframe", "series", "dict", "tuple", "set", "str", "int", "float",
    "bool", "none", "self", "cls", "args", "kwargs", "config", "cfg",
    
    # --- Típicos de Java/C# ---
    "args", "argv", "main", "test", "demo", "example", "sample", "mock",
    "user", "usr", "account", "profile", "message", "msg", "text", "content",
    
    # --- Palabras de relleno (muy usadas por IA) ---
    "some", "any", "all", "each", "every", "this", "that", "it", "thing",
    "foo", "bar", "baz", "qux", "quux", "lorem", "ipsum", "dolor", "amet",
}

def es_codigo_valido(texto: str) -> bool:
    if not texto.strip(): return False
    try:
        ast.parse(texto)
        return True
    except SyntaxError:
        pass
    patrones = [r'\b(function|def|int|void|float|char|class|public|private|const|let|var)\b', r'[{}]', r';', r'\b(return|if|for|while|switch)\b', r'#include|#define']
    return sum(1 for p in patrones if re.search(p, texto)) >= 2

def complejidad_ciclomatica(nodo) -> int:
    cc = 1
    for n in ast.walk(nodo):
        if isinstance(n, (ast.If, ast.For, ast.While, ast.ExceptHandler, ast.With, ast.Assert, ast.IfExp)): cc += 1
        elif isinstance(n, ast.BoolOp): cc += len(n.values) - 1
    return cc

def profundidad_anidamiento(nodo, actual=0) -> int:
    maxima = actual
    for hijo in ast.iter_child_nodes(nodo):
        if isinstance(hijo, (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            maxima = max(maxima, profundidad_anidamiento(hijo, actual + 1))
        else:
            maxima = max(maxima, profundidad_anidamiento(hijo, actual))
    return maxima

def hash_nodo(nodo) -> str:
    return ast.dump(nodo, annotate_fields=True, include_attributes=False)

def detectar_duplicacion(arbol) -> int:
    hashes = []
    for nodo in ast.walk(arbol):
        if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)):
            cuerpo = [hash_nodo(n) for n in nodo.body if not isinstance(n, ast.Expr)]
            if cuerpo: hashes.append(hash(tuple(cuerpo)))
        elif isinstance(nodo, (ast.For, ast.While, ast.If)):
            hashes.append(hash(tuple(hash_nodo(n) for n in nodo.body)))
    if not hashes: return 0
    freq = Counter(hashes)
    return sum(1 for v in freq.values() if v > 1)

def analizar_calidad_estatica(codigo_fuente: str) -> dict:
    resultados = {
        "lineas_totales": len(codigo_fuente.splitlines()), "lineas_largas": 0, "funciones_mayores_30": 0,
        "funciones_sin_docstring": 0, "funciones_sin_typehints": 0, "parametros_excesivos": 0,
        "complejidad_alta": 0, "anidamiento_excesivo": 0, "except_desnudo": 0, "except_pass": 0,
        "variables_malas": 0, "nombres_genericos": 0, "num_imports": 0, "imports_wildcard": 0,
        "num_funciones": 0, "num_clases": 0, "comentarios_totales": 0, "ratio_docstrings": 0.0, "duplicacion": 0,
        "tiene_docstring_modulo": False, "codigo_comentado": 0
    }
    es_python = False
    try:
        arbol = ast.parse(codigo_fuente)
        es_python = True
    except SyntaxError: pass

    if es_python:
        if ast.get_docstring(arbol) is not None: resultados["tiene_docstring_modulo"] = True
        for nodo in ast.walk(arbol):
            if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)):
                resultados["num_funciones"] += 1
                if (nodo.end_lineno - nodo.lineno) > UMBRALES["max_lineas_funcion"]: resultados["funciones_mayores_30"] += 1
                if ast.get_docstring(nodo) is None: resultados["funciones_sin_docstring"] += 1
                if not (nodo.returns is not None and all(a.annotation is not None for a in nodo.args.args)): resultados["funciones_sin_typehints"] += 1
                if len(nodo.args.args) > UMBRALES["max_parametros_funcion"]: resultados["parametros_excesivos"] += 1
                if complejidad_ciclomatica(nodo) > UMBRALES["max_complejidad_ciclomatica"]: resultados["complejidad_alta"] += 1
                if profundidad_anidamiento(nodo) > UMBRALES["max_anidamiento"]: resultados["anidamiento_excesivo"] += 1
            if isinstance(nodo, ast.ClassDef): resultados["num_clases"] += 1
            if isinstance(nodo, (ast.Import, ast.ImportFrom)):
                resultados["num_imports"] += 1
                if isinstance(nodo, ast.Import):
                    for alias in nodo.names:
                        if alias.name == "*": resultados["imports_wildcard"] += 1
                elif nodo.names and any(a.name == "*" for a in nodo.names): resultados["imports_wildcard"] += 1
            if isinstance(nodo, ast.ExceptHandler):
                if nodo.type is None: resultados["except_desnudo"] += 1
                if nodo.type is None and len(nodo.body) == 1 and isinstance(nodo.body[0], ast.Pass): resultados["except_pass"] += 1
            if isinstance(nodo, ast.Name):
                if len(nodo.id) == 1 and nodo.id not in ("i", "j", "k", "_"): resultados["variables_malas"] += 1
                if nodo.id.lower() in NOMBRES_PROHIBIDOS: resultados["nombres_genericos"] += 1
        if resultados["num_funciones"] > 0:
            con_doc = resultados["num_funciones"] - resultados["funciones_sin_docstring"]
            resultados["ratio_docstrings"] = con_doc / resultados["num_funciones"]
        resultados["duplicacion"] = detectar_duplicacion(arbol)
    else:
        resultados["num_funciones"] = codigo_fuente.count("{")
        for nombre in NOMBRES_PROHIBIDOS:
            if re.search(r'\b' + nombre + r'\b', codigo_fuente, re.IGNORECASE): resultados["nombres_genericos"] += 1

    for linea in codigo_fuente.splitlines():
        if len(linea) > UMBRALES["max_longitud_linea"]: resultados["lineas_largas"] += 1
        stripped = linea.strip()
        if stripped.startswith("#") or stripped.startswith("//"):
            resultados["comentarios_totales"] += 1
            cuerpo = stripped.lstrip("#/").strip()
            if any(kw in cuerpo for kw in ("def ", "import ", "return ", "=", "if ", "for ")): resultados["codigo_comentado"] += 1
    return resultados

def metricas_textura(codigo_fuente: str) -> dict:
    lineas = [l for l in codigo_fuente.splitlines() if l.strip()]
    longitudes = [len(l) for l in lineas]
    burstiness = statistics.stdev(longitudes) if len(longitudes) > 1 else 0.0
    palabras = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', codigo_fuente)
    if palabras:
        freq = Counter(palabras); total = len(palabras)
        entropia = -sum((c / total) * math.log2(c / total) for c in freq.values())
        diversidad = len(freq) / total
    else: entropia, diversidad = 0.0, 0.0
    
    total_lineas = len(lineas)
    comentarios = sum(1 for l in lineas if l.strip().startswith(("#", "//")))
    ratio_comentarios = comentarios / total_lineas if total_lineas else 0.0
    return {
        "burstiness": round(burstiness, 2), "entropia_nombres": round(entropia, 3),
        "diversidad_nombres": round(diversidad, 3), "ratio_comentarios": round(ratio_comentarios, 3),
    }

def score_ia_heuristico(res_est: dict, textura: dict, codigo: str) -> tuple[int, list]:
    score = 0; motivos = []
    if textura["entropia_nombres"] < UMBRALES["min_entropia_nombres"]: score += 25; motivos.append("Entropía de nombres baja")
    if textura["burstiness"] < UMBRALES["min_burstiness_lineas"]: score += 20; motivos.append("Burstiness bajo (líneas uniformes)")
    if res_est["ratio_docstrings"] > UMBRALES["max_ratio_docstrings"] and res_est["num_funciones"] > 2: score += 15; motivos.append("Sobre-documentación uniforme")
    if res_est["nombres_genericos"] > 2: score += 15; motivos.append(f"{res_est['nombres_genericos']} nombres genéricos prohibidos")
    if textura["ratio_comentarios"] < UMBRALES["min_ratio_comentarios"] and res_est["lineas_totales"] > 30: score += 10; motivos.append("Sin comentarios en archivo grande")
    if res_est["funciones_sin_typehints"] == res_est["num_funciones"] and res_est["num_funciones"] > 0: score += 10; motivos.append("Ninguna función tiene type hints")
    if res_est["except_pass"] > 0: score += 10; motivos.append("Uso de except: pass")
    if ">>>" in codigo and res_est["num_funciones"] > 0: score += 10; motivos.append("Docstring con doctest")
    if "print(" in codigo and "logging" not in codigo and res_est["num_funciones"] > 0: score += 10; motivos.append("Uso de print() en vez de logging")
    comentarios = [l.strip()[1:].strip() for l in codigo.splitlines() if l.strip().startswith("#")]
    if len(comentarios) >= 2:
        uniformes = sum(1 for c in comentarios if c[:1].isupper() and c.rstrip().endswith("."))
        if uniformes / len(comentarios) > 0.8: score += 10; motivos.append("Comentarios uniformes (formato IA)")
    if res_est.get("duplicacion", 0) > 0: score += 10; motivos.append("Bloques duplicados detectados")
    return min(score, 100), motivos

def calcular_veredicto(res_est: dict, textura: dict, score_ia: int, semantica: dict) -> tuple[str, list]:
    rechazos, advertencias = [], []
    if res_est["lineas_totales"] > UMBRALES["max_lineas_archivo"]: rechazos.append(f"Archivo de {res_est['lineas_totales']} líneas (> {UMBRALES['max_lineas_archivo']})")
    if res_est["funciones_mayores_30"] > 0: rechazos.append(f"{res_est['funciones_mayores_30']} función(es) de más de {UMBRALES['max_lineas_funcion']} líneas")
    if res_est["except_desnudo"] > 0: rechazos.append("except desnudo(s) detectado(s)")
    if res_est["imports_wildcard"] > 0: rechazos.append("Uso de import * detectado")
    if res_est["complejidad_alta"] > 0: rechazos.append("Complejidad ciclomática alta")
    if res_est["anidamiento_excesivo"] > 0: rechazos.append("Anidamiento excesivo")
    if res_est["funciones_sin_typehints"] == res_est["num_funciones"] and res_est["num_funciones"] > 0: rechazos.append("Ninguna función tiene type hints")
    
    if res_est["lineas_largas"] > 5: advertencias.append("Líneas demasiado largas")
    if res_est["funciones_sin_docstring"] > 0: advertencias.append("Funciones sin docstring")
    if res_est["nombres_genericos"] > 2: advertencias.append("Nombres genéricos prohibidos")
    
    if "error" not in semantica:
        if semantica.get("deuda_tecnica") == "Alta": advertencias.append("Deuda técnica alta según el LLM")
    else:
        advertencias.append("Fallo en análisis semántico (ver consola)")
        
    if rechazos: return "RECHAZADO", rechazos + advertencias
    if score_ia >= UMBRALES["umbral_sospecha_ia"]: return "SOSPECHOSO_IA", advertencias + [f"Score heurístico de IA: {score_ia}/100"]
    if advertencias: return "APROBADO_CON_OBSERVACIONES", advertencias
    return "APROBADO", []
