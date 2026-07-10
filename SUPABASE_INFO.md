# Configuración e Información de Supabase - Padova SAC

Este documento registra los detalles del proyecto de Supabase utilizado por el **Ecosistema de Órdenes** para prevenir pérdidas de acceso y resolver pausas de inactividad de la base de datos en el futuro.

---

## 🔑 Credenciales del Dashboard de Supabase

* **Proveedor de la Cuenta:** [Supabase](https://supabase.com/dashboard)
* **Correo Propietario:** `reu.padova@gmail.com`
* **Proyecto Asociado:** `ahyddhsikkxlfbmelurc`
* **GitHub Asociado Sugerido:** Conectar preferiblemente con la misma cuenta de GitHub asociada a `reu.padova@gmail.com`.

---

## ⚙️ Variables de Entorno del Proyecto (Archivo `.env`)

Las siguientes credenciales están configuradas en el archivo local `.env` y permiten al frontend de React conectarse a la base de datos:

* **VITE_SUPABASE_URL:** `https://ahyddhsikkxlfbmelurc.supabase.co`
* **VITE_SUPABASE_ANON_KEY:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoeWRkaHNpa2t4bGZibWVsdXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExODU1NzIsImV4cCI6MjA5Njc2MTU3Mn0.SaebJo8zWPSHTi058E7QiJb7N1JhUZsCOuurdbPxmFk`

---

## ⚡ ¿Qué hacer si la aplicación no inicia ("Failed to fetch")?

Si al ingresar al sistema local el navegador muestra un error de conexión o de tipo `Failed to fetch`, significa que Supabase ha pausado la base de datos gratuita por inactividad (esto ocurre tras 7 días sin recibir peticiones).

### Pasos para reactivar el servicio:
1. Ingresa a [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Inicia sesión con la cuenta: **`reu.padova@gmail.com`**.
3. Selecciona el proyecto **`ahyddhsikkxlfbmelurc`**.
4. Haz clic en el botón **"Restore Project"** (Restaurar Proyecto).
5. Espera entre 1 y 2 minutos. Una vez reactivado, vuelve a cargar la aplicación en tu máquina local.

---

## 📊 Estructura de la Tabla de Datos (`order_details`)

La estructura de la base de datos en Supabase está definida en [supabase_schema.sql](file:///c:/Users/Yrving/Downloads/EXPORTADOS/supabase_schema.sql) y contiene las siguientes columnas clave para almacenar los recursos de las órdenes de compra (OC) y servicio (OS):

```sql
CREATE TABLE IF NOT EXISTS public.order_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proyecto TEXT NOT NULL,
    tipo_orden TEXT NOT NULL, -- 'OC' o 'OS'
    nro_orden TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    ruc TEXT,
    fecha TEXT,
    estado TEXT,
    moneda TEXT,
    recurso TEXT,
    codigo_recurso TEXT,
    recurso_n1 TEXT,
    recurso_n2 TEXT,
    recurso_n3 TEXT,
    cantidad NUMERIC DEFAULT 1,
    precio_sin_igv NUMERIC DEFAULT 0,
    precio_con_igv NUMERIC DEFAULT 0,
    parcial_final NUMERIC DEFAULT 0, -- Almacena el parcial con IGV exacto del recurso del Excel
    parcial_sin_igv NUMERIC DEFAULT 0, -- Almacena el parcial sin IGV exacto del recurso del Excel
    unidad TEXT,
    gestor_compra TEXT,
    creado_por TEXT,
    observacion TEXT,
    archivo_origen TEXT,
    cant_atendida NUMERIC DEFAULT 0,
    cant_por_atender NUMERIC DEFAULT 0,
    estado_facturacion TEXT,
    saldo_por_pagar NUMERIC DEFAULT 0,
    fecha_entrega TEXT,
    aprobador TEXT,
    empresa_proyecto TEXT,
    pedidos TEXT,
    anio_mes TEXT,
    solicitante TEXT,
    fecha_creacion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);
```
