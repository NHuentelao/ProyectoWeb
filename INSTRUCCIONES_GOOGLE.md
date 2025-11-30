# Solución al Error de Google Login (Error 400: origin_mismatch)

Este error ocurre porque Google protege tu aplicación y solo permite iniciar sesión desde sitios web que tú hayas autorizado explícitamente. Como acabas de subir tu sitio a Render, Google no conoce esa nueva dirección (`https://reservas-lebu.onrender.com`) y la bloquea.

Sigue estos pasos para autorizarla:

## 1. Ir a la Consola de Google Cloud
1. Entra a este enlace: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. Asegúrate de estar en la cuenta de Google correcta (la que usaste para crear el proyecto).
3. Arriba a la izquierda, asegúrate de tener seleccionado tu proyecto (ej. "My Project" o "ReservaNoble").

## 2. Editar las Credenciales
1. En la lista de "ID de clientes de OAuth 2.0", busca el que estás usando (probablemente se llame "Web client 1" o similar).
2. Haz clic en el icono de **Lápiz** (Editar) a la derecha del nombre.

## 3. Agregar tu URL de Render
1. Busca la sección **"Orígenes autorizados de JavaScript"** (Authorized JavaScript origins).
2. Verás que probablemente solo tienes `http://localhost` o `http://localhost:3000`.
3. Haz clic en **"AGREGAR URI"** (ADD URI).
4. Pega la URL exacta de tu sitio en Render.
   *   **Correcto:** `https://reservas-lebu.onrender.com`
   *   **Incorrecto:** `https://reservas-lebu.onrender.com/` (No pongas la barra al final)
   *   **Incorrecto:** `reservas-lebu.onrender.com` (Debe tener https://)

## 4. Guardar
1. Haz clic en el botón azul **GUARDAR** (SAVE) al final de la página.

## 5. Esperar (Importante)
Google tarda unos minutos (a veces hasta 5 o 10 minutos) en actualizar estos cambios en todos sus servidores.
*   Si pruebas inmediatamente, te seguirá dando error.
*   Espera 5 minutos, recarga tu página en Render (Ctrl + F5) y vuelve a intentar iniciar sesión.

---
**Nota:** No necesitas cambiar nada en tu código ni volver a subir nada a GitHub. Esto es solo una configuración en el panel de Google.
