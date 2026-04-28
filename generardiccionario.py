import json
import unicodedata
import re
import sys

# ---------------------------------------------------------
# CONFIGURACIÓN INICIAL
# Para usar este script necesitas instalar Spacy y el modelo en español:
# 1. Abre tu terminal o CMD
# 2. Ejecuta: pip install spacy
# 3. Ejecuta: python -m spacy download es_core_news_md
# ---------------------------------------------------------

try:
    import spacy
except ImportError:
    print("❌ ERROR: No tienes 'spacy' instalado.")
    print("Ejecuta en tu terminal: pip install spacy")
    sys.exit(1)

def normalizar(texto):
    """
    Replica exactamente la normalización de tu código React:
    Mayúsculas, sin tildes y cambiando la Ñ por N.
    """
    texto = texto.upper().strip()
    texto = unicodedata.normalize('NFD', texto)
    texto = re.sub(r'[\u0300-\u036f]', '', texto)
    texto = texto.replace('Ñ', 'N')
    return texto

def generar_diccionario(palabra_objetivo, top_n=600):
    print(f"\n🧠 Cargando red neuronal de Español (es_core_news_md)...")
    try:
        nlp = spacy.load("es_core_news_md")
    except OSError:
        print("❌ ERROR: No tienes el modelo de idioma descargado.")
        print("Ejecuta en tu terminal: python -m spacy download es_core_news_md")
        sys.exit(1)

    target_token = nlp(palabra_objetivo.lower())
    
    if not target_token.has_vector:
        print(f"⚠️  Advertencia: '{palabra_objetivo}' es tan rara que la IA no la conoce.")
        return

    print(f"🌌 Calculando distancias semánticas para '{palabra_objetivo.upper()}'...")
    
    similitudes = []

    # Extraemos todas las palabras del diccionario interno de la IA
    for key in nlp.vocab.vectors.keys():
        lexema = nlp.vocab[key]
        # Filtramos basura: Solo letras, en minúscula y más de 2 caracteres
        if lexema.is_alpha and lexema.is_lower and len(lexema.text) > 2:
            sim = target_token.similarity(lexema)
            similitudes.append((lexema.text, sim))

    # Ordenamos de mayor a menor similitud (Las más cercanas primero)
    similitudes.sort(key=lambda x: x[1], reverse=True)

    diccionario_final = {}
    rango = 1
    
    obj_norm = normalizar(palabra_objetivo)
    diccionario_final[obj_norm] = rango
    rango += 1

    # Rellenamos el diccionario asegurando que no haya duplicados tras la normalización
    for palabra, similitud in similitudes:
        pal_norm = normalizar(palabra)
        
        # Evitamos meter la palabra base otra vez, o palabras repetidas (ej: reloj y relojes)
        if pal_norm not in diccionario_final and pal_norm != obj_norm:
            diccionario_final[pal_norm] = rango
            rango += 1
            
        if rango > top_n:
            break

    # Guardar en archivo JSON
    nombre_archivo = f"diccionario_{obj_norm}.json"
    with open(nombre_archivo, 'w', encoding='utf-8') as f:
        # indent=2 lo formatea bonito para que sea fácil de copiar
        json.dump(diccionario_final, f, ensure_ascii=False, indent=2)

    print("\n✅ ¡SÍNTESIS COMPLETADA!")
    print(f"📂 Se han guardado {top_n} palabras ordenadas en el archivo: {nombre_archivo}")
    print("👉 Abre ese archivo, copia todo su contenido y pégalo en el Panel de Administrador de tu juego.")

if __name__ == "__main__":
    print("="*50)
    print("   SINTETIZADOR DE DICCIONARIOS - SEMÁNTIKA   ")
    print("="*50)
    palabra = input("\nIntroduce la nueva Palabra Secreta (ej. OCEANO): ")
    
    try:
        cantidad = int(input("¿Cuántos nodos (palabras) quieres calcular? (Recomendado 600): ") or 600)
    except ValueError:
        cantidad = 600
        
    generar_diccionario(palabra, cantidad)