import os
import json
import time
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict

# 1. Nueva importación para Groq
from groq import Groq

from analizador import (
    es_codigo_valido, analizar_calidad_estatica, metricas_textura,
    score_ia_heuristico, calcular_veredicto,
)

app = FastAPI()

# ============================================================
# CONFIGURACIÓN DE GROQ
# ============================================================
# Pega aquí tu API Key de Groq (empieza con gsk_...)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
# Inicializamos el cliente de Groq
client = Groq(api_key=GROQ_API_KEY)

# Modelo recomendado: es rápido y muy bueno para código
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
        # 2. Nueva forma de llamar a la IA (formato chat)
        respuesta = client.chat.completions.create(
            model=MODELO_GROQ,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analiza este código:\n\n{codigo_fuente}"}
            ],
            temperature=0.1,
            # Forzamos a que la respuesta sea un JSON válido
            response_format={"type": "json_object"}
        )
        
        # Extraemos el contenido de la respuesta
        contenido = respuesta.choices[0].message.content
        return json.loads(contenido)
        
    except Exception as e:
        print(f"❌ ERROR DE GROQ: {e}")
        return {"error": str(e), "deuda_tecnica": "N/A"}

# ============================================================
# RUTAS DE LA API (Esto se queda igual)
# ============================================================
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
        
        # Llamada a Groq
        semantica = evaluar_semantica_con_ia(codigo)
        
        # 3. Quitamos o reducimos la pausa porque Groq tiene mejor límite (30 RPM)
        # Con 1 segundo es más que suficiente para no saturar
        time.sleep(1) 
        
        nivel, razones = calcular_veredicto(res_est, textura, score_ia, semantica)

        resultados.append({
            "archivo": nombre, 
            "veredicto": nivel, 
            "razones": razones,
            "score_ia": score_ia, 
            "semantica": semantica,
        })
        contador += 1

    return {"resultados": resultados}

app.mount("/", StaticFiles(directory="static", html=True), name="static")