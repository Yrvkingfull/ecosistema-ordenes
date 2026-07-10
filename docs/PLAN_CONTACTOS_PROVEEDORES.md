# Plan: Fuente de datos de contactos (proveedores y subcontratistas)

## Estado

Solo plan para revisar. **No implementado todavía.**

## Objetivo

Agregar al sistema teléfono fijo, celular y correo de cada proveedor/subcontratista que ya aparece en las órdenes (OC/OS), para tenerlos a mano sin salir del sistema.

---

## 1. Preguntas que necesito que definas antes de implementar

1. **¿Ya existe esta información en algún lado?** (Excel, lista de Evolta CRM, contactos del celular, etc.) Si ya existe un archivo, lo ideal es importarlo en vez de tipear todo a mano.
2. **¿Un proveedor puede tener varios contactos?** (ej. el RUC "Constructora XYZ" con 2-3 personas de contacto distintas: comercial, logística, cobranzas). Esto define si la tabla es 1 fila por proveedor o varias.
3. **¿Cómo identificamos al proveedor de forma confiable?** Hoy el campo `proveedor` en `order_details` es texto libre (puede venir escrito distinto entre archivos: "ACME SAC" vs "Acme S.A.C."). Lo más confiable sería relacionar por **RUC**, no por nombre. ¿Tienes el RUC de todos los proveedores que quieres registrar?
4. **¿Quién puede editar esta información?** ¿Solo superadministradores, o cualquier colaborador puede agregar/corregir un contacto?

## 2. Diseño propuesto (borrador, sujeto a tus respuestas)

### Nueva tabla en Supabase: `proveedor_contactos`

```sql
CREATE TABLE public.proveedor_contactos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ruc TEXT,
    proveedor TEXT NOT NULL,
    nombre_contacto TEXT,
    cargo TEXT,            -- ej. "Comercial", "Logística", "Cobranzas"
    telefono TEXT,          -- fijo
    celular TEXT,
    correo TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);
```

Con políticas RLS similares a `order_details`: lectura para cualquier usuario autenticado, escritura restringida (a decidir según pregunta 4).

### Interfaz

Dos opciones, no excluyentes:

- **(A) Pestaña nueva "Contactos"**: lista de proveedores con sus contactos, buscador por nombre/RUC, botón para agregar/editar (solo admin).
- **(B) Integración en las tablas existentes**: al lado del proveedor en la Lista Maestra de OC/OS y en "Top Proveedores", un ícono para ver/editar su contacto sin cambiar de pestaña.

Recomiendo empezar con (A) por ser más simple, y agregar (B) después si se usa seguido.

### Carga de datos

- **Manual**: formulario simple para agregar un contacto a la vez. Más simple de construir, sirve si son pocos proveedores.
- **Carga masiva por Excel**: igual que la carga de OC/OS actual, si ya tienes un archivo con esta info. Requiere que me compartas el formato/columnas del archivo.

## 3. Fases sugeridas de implementación

1. Definir origen de datos (pregunta 1) y confirmar identificador (RUC vs nombre).
2. Crear la tabla y políticas RLS en Supabase.
3. Construir la pestaña "Contactos" con listado + formulario de alta/edición.
4. (Opcional) Importación masiva desde Excel, si aplica.
5. (Opcional) Integrar accesos directos desde las tablas de OC/OS.

## 4. Qué necesito de ti antes de empezar a construir

- Respuestas a las 4 preguntas de la sección 1.
- Si existe un Excel/fuente con esta data, compartir el archivo o al menos sus columnas.
