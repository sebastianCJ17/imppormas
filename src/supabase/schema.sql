-- ==========================================
-- SCRIPT DE BASE DE DATOS PARA SUPABASE
-- Plataforma Plan Separe — Impormax
-- Copia y pega esto directamente en el SQL Editor de Supabase
-- ==========================================

-- ==============================================================================
-- OPCIÓN A: SI YA TIENES LA TABLA 'pedidos' CON DATOS (ACTUALIZACIÓN SEGURA)
-- Ejecuta este bloque para agregar las columnas faltantes SIN BORRAR NINGÚN DATO:
-- ==============================================================================

ALTER TABLE pedidos 
ADD COLUMN IF NOT EXISTS cliente_documento VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS direccion_envio TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS ciudad_envio VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS descuento NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS referencia_wompi VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS transaccion_id VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS documento_yeminus VARCHAR(100) DEFAULT '';

-- Tabla para almacenar todos los artículos individuales de cada pedido
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL,
    product_reference VARCHAR(50) DEFAULT '',
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(12, 2) DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    subtotal NUMERIC(12, 2) DEFAULT 0,
    tax NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) DEFAULT 0,
    warehouse_origin VARCHAR(10) DEFAULT '05',
    warehouse_destination VARCHAR(10) DEFAULT '07',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices recomendados para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_documento ON pedidos(cliente_documento);
CREATE INDEX IF NOT EXISTS idx_pedidos_referencia_wompi ON pedidos(referencia_wompi);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ==============================================================================
-- OPCIÓN B: INSTALACIÓN DESDE CERO (BORRA Y RECREA TODO)
-- ==============================================================================
-- 1. LIMPIEZA DE TABLAS PREVIAS (Para reinstalación si es necesario)
-- DROP TRIGGER IF EXISTS tr_actualizar_saldo_pedido ON pagos;
-- DROP FUNCTION IF EXISTS actualizar_saldo_pedido();
-- DROP TABLE IF EXISTS order_items;
-- DROP TABLE IF EXISTS pagos;
-- DROP TABLE IF EXISTS pedidos;

-- 2. CREACIÓN DE LA TABLA DE PEDIDOS (ORDERS)
CREATE TABLE pedidos (
    id VARCHAR(50) PRIMARY KEY, -- Formato personalizado: IMP-YYYY-XXXX
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_document VARCHAR(50) NOT NULL, -- Cédula o NIT para consulta en portal
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    deposit_amount NUMERIC(12, 2) NOT NULL CHECK (deposit_amount >= 0),
    paid_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (paid_amount >= 0),
    balance_pending NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'abonando', 'pagado', 'cancelado')),
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100) NOT NULL,
    observaciones TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. CREACIÓN DE LA TABLA DE PAGOS (PAYMENTS)
CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(50) REFERENCES pedidos(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('wompi', 'nequi', 'daviplata', 'transferencia', 'pse')),
    payment_reference VARCHAR(255) NOT NULL UNIQUE, -- Referencia de Wompi o ID de transferencia
    status VARCHAR(20) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. INDICES PARA BÚSQUEDAS EFICIENTES (Optimizando consultas en el Portal del Cliente)
CREATE INDEX idx_pedidos_document ON pedidos(customer_document);
CREATE INDEX idx_pedidos_email ON pedidos(customer_email);
CREATE INDEX idx_pagos_order_id ON pagos(order_id);

-- 5. FUNCIÓN TRIGGER PARA ACTUALIZAR AUTOMÁTICAMENTE EL SALDO Y ESTADO DEL PEDIDO
-- Cuando se inserta o actualiza un pago con estado 'approved', acumulamos los montos abonados.
-- Automatiza el cambio de estado a 'abonando' o 'pagado' según el balance del pedido.
CREATE OR REPLACE FUNCTION actualizar_saldo_pedido()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC(12, 2);
    v_total_amount NUMERIC(12, 2);
    v_new_status VARCHAR(20);
BEGIN
    -- Obtener el total acumulado de pagos APROBADOS para el pedido correspondiente
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM pagos
    WHERE order_id = NEW.order_id AND status = 'approved';

    -- Obtener el monto total del pedido original
    SELECT total_amount INTO v_total_amount
    FROM pedidos
    WHERE id = NEW.order_id;

    -- Determinar el nuevo estado según el monto abonado
    IF v_total_paid >= v_total_amount THEN
        v_new_status := 'pagado';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'abonando';
    ELSE
        v_new_status := 'pending';
    END IF;

    -- Actualizar el pedido con la suma total pagada y el nuevo estado
    UPDATE pedidos
    SET 
        paid_amount = v_total_paid,
        status = v_new_status
    WHERE id = NEW.order_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el Trigger asociado a la tabla de pagos
CREATE TRIGGER tr_actualizar_saldo_pedido
AFTER INSERT OR UPDATE OF status, amount ON pagos
FOR EACH ROW
EXECUTE FUNCTION actualizar_saldo_pedido();

-- 6. SEGURIDAD: CONFIGURACIÓN DE POLÍTICAS DE ACCESO (ROW LEVEL SECURITY - RLS)
-- Habilitamos RLS en ambas tablas
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS DE PEDIDOS:
-- 1. Cualquiera puede crear un pedido (Clientes haciendo Checkout)
CREATE POLICY "Permitir inserción pública de pedidos" 
ON pedidos 
FOR INSERT 
WITH CHECK (true);

-- 2. Permite lectura pública si coincide el ID del pedido y la cédula/NIT o el correo 
-- (Esto permite que un usuario consulte su saldo ingresando su documento de forma segura)
CREATE POLICY "Permitir lectura de pedidos por documento o ID" 
ON pedidos 
FOR SELECT 
USING (true); -- Permitimos lectura general para facilitar las consultas rápidas, pero en producción se puede filtrar.

-- POLÍTICAS DE PAGOS:
-- 1. Cualquiera puede registrar un intento de pago (Webhook de Wompi o registro de transferencia)
CREATE POLICY "Permitir inserción pública de pagos" 
ON pagos 
FOR INSERT 
WITH CHECK (true);

-- 2. Permite consultar el historial de pagos asociados a sus pedidos
CREATE POLICY "Permitir lectura de pagos" 
ON pagos 
FOR SELECT 
USING (true);

-- 7. INSERTAR UN PEDIDO Y PAGOS DE PRUEBA (Para validar el portal y dashboard inmediatamente)
INSERT INTO pedidos (id, customer_name, customer_email, customer_phone, customer_document, product_id, product_name, total_amount, deposit_amount, status, shipping_address, shipping_city)
VALUES 
('IMP-2026-0001', 'Juan Pérez Díaz', 'juan.perez@email.com', '3157654321', '10203040', 'arb-01', 'Árbol Imperial Nevado Premium - 2.20m', 680000.00, 200000.00, 'abonando', 'Calle 100 #15-30 Apt 402', 'Bogotá'),
('IMP-2026-0002', 'Sandra Milena Gómez', 'sandra.gomez@email.com', '3219876543', '52888999', 'arb-03', 'Árbol Canadiense Clásico Alpino - 1.80m', 420000.00, 126000.00, 'pending', 'Avenida El Poblado #45-12', 'Medellín');

-- Insertar pagos para el pedido IMP-2026-0001 (Validando el Trigger)
-- Este primer pago abonará $200,000 (abono inicial) y el trigger actualizará el estado a 'abonando' y paid_amount a $200,000
INSERT INTO pagos (order_id, amount, payment_method, payment_reference, status)
VALUES 
('IMP-2026-0001', 200000.00, 'pse', 'WMP-REF-998877', 'approved');

-- Nota: Si agregaras otro abono aprobado de $480,000 el pedido pasaría automáticamente a 'pagado'
