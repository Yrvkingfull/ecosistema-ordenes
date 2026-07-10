# Diagnóstico: "Cargando y conectando con el servidor..." tras inactividad

## Estado

Diagnóstico completo, con causa raíz confirmada en el código. **Este documento es un plan para revisar — nada de esto está implementado todavía.**

---

## 1. Qué está pasando exactamente

Cuando dejas la pestaña del navegador inactiva unos segundos (cambias de pestaña, minimizas, bloqueas el laptop, etc.) y vuelves a hacer clic, el sistema:

1. Muestra la pantalla completa de "Cargando y conectando con el servidor..." (`src/App.jsx:2103`).
2. Vuelve a descargar **todas** las órdenes desde Supabase, paginando de 1000 en 1000, desde cero.
3. Recién ahí puedes volver a ver la información.

## 2. Causa raíz

En `src/App.jsx:119-150`, el `useEffect` de inicialización se suscribe a los cambios de sesión de Supabase así:

```js
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  setSession(session);
  if (session) {
    fetchSupabaseOrders();   // <-- vuelve a traer TODO
    fetchOriginFiles();
  } else {
    ...
  }
});
```

Y `fetchSupabaseOrders` (`src/App.jsx:197-198`) hace `setLoading(true)` como primera línea, lo que dispara la pantalla completa de carga (`src/App.jsx:2100-2104`, `{loading ? <spinner/> : ...}`).

El problema es que **`onAuthStateChange` no solo se dispara cuando inicias sesión**. La librería `supabase-js` (v2) escucha automáticamente el evento `visibilitychange` del navegador: cada vez que la pestaña vuelve a estar visible (haces clic para volver a ella), revalida el token de sesión y dispara este callback con eventos como `TOKEN_REFRESHED` o `SIGNED_IN` — **aunque no haya pasado nada relevante**, ya tenías sesión activa.

El código actual no distingue "esto es un login real" de "esto es solo una revalidación silenciosa de token" — y en ambos casos vuelve a descargar todo el historial de órdenes y bloquea la pantalla.

Esto explica exactamente el síntoma: no es que "pasen unos segundos" lo que dispara la carga, es que **cambiar de pestaña y volver** (algo que naturalmente pasa después de estar unos segundos sin usar el sistema) dispara la revalidación.

## 3. Un problema relacionado pero distinto (ya documentado)

`SUPABASE_INFO.md` ya advierte que el plan gratuito de Supabase **pausa el proyecto tras 7 días sin peticiones**, lo cual da un error de tipo "Failed to fetch" (no el spinner de carga). Es un mecanismo distinto — lo menciono para no confundir ambos síntomas si alguna vez ves ese otro error.

---

## 4. Plan de solución propuesto (2 fases)

### Fase 1 — Arreglo directo del bug (bajo riesgo, cambio pequeño)

En el handler de `onAuthStateChange`, dejar de recargar todo en cada revalidación de token. Solo se debería volver a pedir los datos cuando:

- Es un login real (no había sesión antes y ahora sí), o
- El usuario cierra sesión (para limpiar la pantalla).

En una revalidación de token con la sesión ya activa, basta con actualizar el estado `session` (para que seguir usando la API con el token vigente) **sin** tocar `loading` ni volver a pedir las 100% de las órdenes.

Efecto esperado: cambiar de pestaña y volver ya no debería mostrar el spinner de pantalla completa ni re-descargar nada.

### Fase 2 — Repositorio local de datos (carga instantánea + resiliencia)

Ya existe en el proyecto una capa de caché local con IndexedDB (`src/db.js`: `initDB`, `saveOrders`, `getOrders`, `saveFilesLog`, `getFilesLog`, `clearAllDB`), pero **hoy solo se usa cuando Supabase no está configurado** (modo local puro). Cuando Supabase sí está activo, esta caché no se aprovecha.

Propuesta: usar esta caché como "repositorio" de datos siempre, con estrategia _cache-first_:

1. Al abrir la app, mostrar de inmediato lo último guardado en IndexedDB (sin spinner, sin esperar a la red).
2. En paralelo, sincronizar en segundo plano con Supabase y actualizar la vista cuando llegue la data fresca, sin bloquear la pantalla.
3. Cada vez que se suben nuevos archivos Excel, se actualiza tanto Supabase como la caché local.

Beneficios:

- La app se siente instantánea al volver a la pestaña (no depende de la red para mostrar algo).
- Si Supabase se pausa por inactividad (ver punto 3) o hay un corte de red momentáneo, el usuario puede seguir viendo su última data sincronizada en vez de una pantalla de error o de carga infinita.
- Esta misma capa de datos local sería la base natural para la "tabla dinámica" que pediste (ver siguiente sección), ya que tendríamos toda la data disponible en el navegador sin depender de nuevas consultas a Supabase.

### Fase 3 (opcional, a futuro) — Tabla dinámica interactiva

Sobre el repositorio local de la Fase 2, se podría construir una vista tipo "tabla dinámica" (como en Excel): elegir filas (proyecto, proveedor, recurso, tipo de orden, estado, mes), columnas y una medida a agregar (suma, conteo, promedio), todo calculado en el navegador sobre los datos ya cargados, sin pedir nada nuevo a Supabase. Esto complementa — no reemplaza — los tableros actuales (OC, OS, Logística).

Esto quedaría para una segunda ronda, después de validar las Fases 1 y 2.

---

## 5. Qué necesito de ti para continuar

- ¿Aprovechamos la Fase 1 primero de forma aislada (es el fix del bug real, bajo riesgo) y luego evaluamos si vale la pena la Fase 2/3?
- Para la Fase 3 (tabla dinámica): ¿qué combinaciones de filas/columnas te servirían más en el día a día? (ej. Proyecto x Mes, Proveedor x Recurso, etc.)
