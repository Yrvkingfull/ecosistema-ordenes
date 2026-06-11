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
    cantidad NUMERIC DEFAULT 1,
    precio_sin_igv NUMERIC DEFAULT 0,
    precio_con_igv NUMERIC DEFAULT 0,
    parcial_final NUMERIC DEFAULT 0,
    unidad TEXT,
    gestor_compra TEXT,
    creado_por TEXT,
    observacion TEXT,
    archivo_origen TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) -- ID del usuario que subió el registro
);

-- 2. Crear índices para búsquedas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_order_details_nro_orden ON public.order_details(nro_orden);
CREATE INDEX IF NOT EXISTS idx_order_details_proyecto ON public.order_details(proyecto);
CREATE INDEX IF NOT EXISTS idx_order_details_proveedor ON public.order_details(proveedor);

-- 3. Habilitar la seguridad a nivel de fila (Row Level Security - RLS)
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas de acceso
-- Política A: Permitir a cualquier usuario autenticado ver todas las órdenes
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.order_details 
FOR SELECT 
TO authenticated 
USING (true);

-- Política B: Permitir a cualquier usuario autenticado insertar nuevas órdenes
CREATE POLICY "Permitir insercion a usuarios autenticados" 
ON public.order_details 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política C: Permitir a cualquier usuario autenticado eliminar registros
CREATE POLICY "Permitir eliminacion a usuarios autenticados" 
ON public.order_details 
FOR DELETE 
TO authenticated 
USING (true);
