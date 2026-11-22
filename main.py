import os
import json
import time
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict

# Importamos el cliente de Groq
from groq import Groq

# Importamos las funciones de tu analizador
from analizador import (
    es_codigo_valido, analizar_calidad_estatica, metricas_textura,
    score_ia_heuristico, calcular_veredicto,
)

app = FastAPI()

# ============================================================
# CONFIGURACIÓN DE GROQ
# ============================================================
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "AQUI_PEGA_TU_API_KEY_LOCAL")

client = Groq(api_key=GROQ_API_KEY)
MODELO_GROQ = "openai/gpt-oss-120b"

SYSTEM_PROMPT = """
Eres un revisor de código senior. NO intentes adivinar si es IA.
Evalúa SOLO la semántica de negocio y la arquitectura del código (puede ser Python, C, C++, Java, etc.).

REGLAS PARA DEUDA TÉCNICA:
- "Baja": type hints/tipos claros, docstrings/comentarios útiles, manejo de errores, funciones cortas.
- "Media": falta documentación O manejo de errores, pero la lógica es clara.
- "Alta": funciones gigantes, sin comentarios útiles, lógica enrevesada o duplicación masiva.

Devuelve ESTRICTAMENTE un JSON con esta estructura:
{
    "responsabilidad_unica": true o false,
    "comentarios_con_contexto": true o false,
    "logica_dominio_real": true o false,
    "arquitectura_coherente": true o false,
    "duplicacion_evidente": true o false,
    "observaciones": ["obs 1", "obs 2"],
    "deuda_tecnica": "Baja, Media o Alta"
}
"""

def evaluar_semantica_con_ia(codigo_fuente: str) -> dict:
    try:
        respuesta = client.chat.completions.create(
            model=MODELO_GROQ,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analiza este código:\n\n{codigo_fuente}"}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        contenido = respuesta.choices[0].message.content
        return json.loads(contenido)
    except Exception as e:
        print(f"❌ ERROR DE GROQ: {e}")
        return {"error": str(e), "deuda_tecnica": "N/A"}

# ============================================================
# RUTAS DE LA API
# ============================================================

# 1. Ruta para Código Individual (La que usa el Modo Claro)
class CodigoIn(BaseModel):
    codigo: str

@app.post("/analizar-individual")
def analizar_individual(datos: CodigoIn):
    if not es_codigo_valido(datos.codigo):
        return {"error": "El texto no parece código válido.", "archivo": "Código Individual"}

    res_est = analizar_calidad_estatica(datos.codigo)
    textura = metricas_textura(datos.codigo)
    score_ia, motivos_ia = score_ia_heuristico(res_est, textura, datos.codigo)
    
    semantica = evaluar_semantica_con_ia(datos.codigo)
    time.sleep(1) # Pausa de seguridad
    
    nivel, razones = calcular_veredicto(res_est, textura, score_ia, semantica)

    return {
        "archivo": "Código Individual",
        "veredicto": nivel,
        "razones": razones,
        "score_ia": score_ia,
        "semantica": semantica,
        "estatica": res_est,
        "textura": textura,
    }


# 2. Ruta para Carpeta (La que usa el Modo Oscuro)
class CarpetaIn(BaseModel):
    archivos: Dict[str, str] 

@app.post("/analizar-carpeta")
def analizar_carpeta(datos: CarpetaIn):
    resultados = []
    contador = 0
    
    for nombre, codigo in datos.archivos.items():
        if contador >= 20: 
            break
            
        if not any(nombre.endswith(ext) for ext in ['.py', '.js', '.ts', '.java', '.c', '.cpp', '.cs', '.html', '.css']): 
            continue
            
        if not es_codigo_valido(codigo): 
            continue 

        res_est = analizar_calidad_estatica(codigo)
        textura = metricas_textura(codigo)
        score_ia, motivos_ia = score_ia_heuristico(res_est, textura, codigo)
        
        semantica = evaluar_semantica_con_ia(codigo)
        
        # Pausa de 4 segundos para no saturar la API
        time.sleep(4) 
        
        nivel, razones = calcular_veredicto(res_est, textura, score_ia, semantica)

        resultados.append({
            "archivo": nombre, 
            "veredicto": nivel, 
            "razones": razones,
            "score_ia": score_ia, 
            "semantica": semantica,
            "estatica": res_est,
            "textura": textura,
        })
        contador += 1

    return {"resultados": resultados}

# ============================================================
# SERVIR EL FRONTEND
# ============================================================
app.mount("/", StaticFiles(directory="static", html=True), name="static")
