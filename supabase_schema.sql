-- ============================================================
-- ECOSISTEMA ÓRDENES - PADOVA SAC
-- Esquema Supabase actualizado
-- ============================================================

-- 1. Crear la tabla principal de detalles de órdenes
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
    parcial_final NUMERIC DEFAULT 0,
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
    fecha_creacion TEXT, -- Nuevo: del Excel
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);

-- 2. Agregar columnas nuevas si la tabla ya existe (migración segura)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='codigo_recurso') THEN
        ALTER TABLE public.order_details ADD COLUMN codigo_recurso TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='recurso_n1') THEN
        ALTER TABLE public.order_details ADD COLUMN recurso_n1 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='recurso_n2') THEN
        ALTER TABLE public.order_details ADD COLUMN recurso_n2 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='recurso_n3') THEN
        ALTER TABLE public.order_details ADD COLUMN recurso_n3 TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='fecha_creacion') THEN
        ALTER TABLE public.order_details ADD COLUMN fecha_creacion TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_details' AND column_name='anio_mes') THEN
        ALTER TABLE public.order_details ADD COLUMN anio_mes TEXT;
    END IF;
END $$;

-- 3. Índices para búsquedas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_order_details_nro_orden ON public.order_details(nro_orden);
CREATE INDEX IF NOT EXISTS idx_order_details_proyecto ON public.order_details(proyecto);
CREATE INDEX IF NOT EXISTS idx_order_details_proveedor ON public.order_details(proveedor);
CREATE INDEX IF NOT EXISTS idx_order_details_tipo ON public.order_details(tipo_orden);
CREATE INDEX IF NOT EXISTS idx_order_details_recurso ON public.order_details(recurso);
CREATE INDEX IF NOT EXISTS idx_order_details_archivo ON public.order_details(archivo_origen);

-- 4. Habilitar la seguridad a nivel de fila (Row Level Security - RLS)
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acceso

-- Política A: Cualquier usuario autenticado puede VER todas las órdenes
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.order_details;
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.order_details 
FOR SELECT 
TO authenticated 
USING (true);

-- Política B: Cualquier usuario autenticado puede INSERTAR órdenes
-- (el control de quién puede subir se hace en el frontend con SUPERADMIN_EMAILS)
DROP POLICY IF EXISTS "Permitir insercion a usuarios autenticados" ON public.order_details;
CREATE POLICY "Permitir insercion a usuarios autenticados" 
ON public.order_details 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política C: Cualquier usuario autenticado puede ELIMINAR registros
-- (el control se hace en el frontend)
DROP POLICY IF EXISTS "Permitir eliminacion a usuarios autenticados" ON public.order_details;
CREATE POLICY "Permitir eliminacion a usuarios autenticados" 
ON public.order_details 
FOR DELETE 
TO authenticated 
USING (true);
