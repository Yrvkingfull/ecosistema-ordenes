import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  BarChart2, 
  FileText, 
  Upload, 
  Search, 
  TrendingUp, 
  ShoppingBag, 
  Briefcase, 
  Users, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Sun, 
  Moon,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  Info,
  Calendar,
  Lock,
  Mail,
  User,
  LogOut,
  Cloud,
  Database,
  ArrowRight
} from 'lucide-react';
import { getOrders, saveOrders, getFilesLog, saveFilesLog, clearAllDB } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [themeMode, setThemeMode] = useState('dark');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [orders, setOrders] = useState([]);
  const [filesLog, setFilesLog] = useState([]);
  
  // Table Pagination & Expanded Rows
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const itemsPerPage = 15;
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Drag & Drop State
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Supabase Auth & Session States
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'success' | 'error'

  // Initialize DB and Load Data
  useEffect(() => {
    // Set theme
    document.documentElement.className = themeMode === 'light' ? 'light-mode' : '';

    if (isSupabaseConfigured) {
      // 1. Supabase Mode Setup
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          fetchSupabaseOrders();
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) {
          fetchSupabaseOrders();
        } else {
          setOrders([]);
          setFilesLog([]);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      // 2. Local Mode Setup
      loadLocalData();
    }
  }, []);

  // Fetch orders from Supabase PostgreSQL
  const fetchSupabaseOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_details')
        .select('*')
        .order('fecha', { ascending: false });

      if (error) throw error;

      setOrders(data || []);

      // Group file names for the files log
      const filesMap = {};
      data.forEach(row => {
        if (row.archivo_origen && !filesMap[row.archivo_origen]) {
          filesMap[row.archivo_origen] = {
            name: row.archivo_origen,
            project: row.proyecto,
            type: row.tipo_orden,
            rowCount: 0,
            size: 'Nube',
            uploadedAt: new Date(row.created_at).toLocaleDateString() + ' ' + new Date(row.created_at).toLocaleTimeString()
          };
        }
        if (row.archivo_origen) {
          filesMap[row.archivo_origen].rowCount++;
        }
      });
      setFilesLog(Object.values(filesMap));
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
      alert('Error al descargar datos de Supabase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load local IndexedDB database
  const loadLocalData = async () => {
    setLoading(true);
    try {
      const storedOrders = await getOrders();
      const storedFiles = await getFilesLog();
      setOrders(storedOrders);
      setFilesLog(storedFiles);
    } catch (err) {
      console.error('Error loading data from IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    const nextTheme = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextTheme);
    document.documentElement.className = nextTheme === 'light' ? 'light-mode' : '';
  };

  // Safe helper to parse numbers
  const parseNum = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Smart fuzzy mapper to normalize Excel column names
  const normalizeRow = (rawRow, fileName, defaultProject, defaultType) => {
    const row = {};
    // Lowercase and strip accents/spaces helper
    const cleanKey = (k) => String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    Object.keys(rawRow).forEach((key) => {
      const ck = cleanKey(key);
      
      if (ck.includes('proveedor')) {
        row.proveedor = rawRow[key];
      } else if (ck.includes('proyecto') && !ck.includes('codigo') && !ck.includes('grupo') && !ck.includes('empresa')) {
        row.proyecto = rawRow[key];
      } else if ((ck.includes('orden') && (ck.includes('compra') || ck.includes('servicio'))) || ck.includes('nro. orden') || ck.includes('nº orden')) {
        row.nro_orden = rawRow[key];
      } else if (ck.includes('ruc')) {
        row.ruc = String(rawRow[key]).trim();
      } else if (ck.includes('fecha') && !ck.includes('creacion') && !ck.includes('entrega') && !ck.includes('vigencia')) {
        row.fecha = rawRow[key];
      } else if (ck.includes('estado') && !ck.includes('envio') && !ck.includes('facturacion')) {
        row.estado = rawRow[key];
      } else if (ck.includes('moneda')) {
        row.moneda = rawRow[key];
      } else if (ck.includes('recurso') && !ck.includes('codigo') && !ck.includes('categoria')) {
        row.recurso = rawRow[key];
      } else if (ck.includes('cantidad') && !ck.includes('atendida') && !ck.includes('atender')) {
        row.cantidad = parseNum(rawRow[key]);
      } else if (ck.includes('precio sin')) {
        row.precio_sin_igv = parseNum(rawRow[key]);
      } else if (ck.includes('precio con')) {
        row.precio_con_igv = parseNum(rawRow[key]);
      } else if (ck.includes('parcial con') || ck.includes('parcial final') || ck.includes('valor total')) {
        row.parcial_final = parseNum(rawRow[key]);
      } else if (ck.includes('unidad') && !ck.includes('medida')) {
        row.unidad = rawRow[key];
      } else if (ck.includes('gestor')) {
        row.gestor_compra = rawRow[key];
      } else if (ck.includes('creado por') || ck.includes('usuario')) {
        row.creado_por = rawRow[key];
      } else if (ck.includes('observacion')) {
        row.observacion = rawRow[key];
      }
    });

    // Fallbacks
    row.proyecto = row.proyecto || defaultProject;
    row.tipo_orden = defaultType;
    row.nro_orden = row.nro_orden || 'S/N';
    row.proveedor = row.proveedor || 'PROVEEDOR DESCONOCIDO';
    row.recurso = row.recurso || 'ÍTEM SIN DESCRIPCIÓN';
    row.cantidad = row.cantidad || 1;
    row.parcial_final = row.parcial_final || ((row.precio_con_igv || row.precio_sin_igv || 0) * row.cantidad);
    row.precio_con_igv = row.precio_con_igv || (row.cantidad ? row.parcial_final / row.cantidad : 0);
    row.precio_sin_igv = row.precio_sin_igv || row.precio_con_igv / 1.18;
    row.estado = row.estado || 'Emitido';
    row.moneda = row.moneda || 'COP';
    row.fecha = row.fecha || 'Sin Fecha';
    row.archivo_origen = fileName;

    return row;
  };

  // Handle excel files parsing & database syncing
  const handleFiles = async (fileList) => {
    setLoading(true);
    setSyncStatus('syncing');
    const newFilesLog = [...filesLog];
    let newOrders = [...orders];

    const parsedRowsAllFiles = [];
    const filesToUploadInfo = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        alert(`El archivo ${file.name} no es un archivo Excel válido (.xlsx o .xls).`);
        continue;
      }

      // Detect project and order type from filename
      const fn = file.name.toUpperCase();
      let detectedType = 'OC';
      if (fn.startsWith('OS') || fn.includes('OS ')) {
        detectedType = 'OS';
      }

      let detectedProject = 'PROYECTO GENERAL';
      if (fn.includes('LITORAL')) {
        detectedProject = 'LITORAL';
      } else if (fn.includes('SB')) {
        detectedProject = 'SB';
      } else if (fn.includes('SUNNY')) {
        detectedProject = 'SUNNY';
      }

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { cellDates: true, dateNF: 'YYYY-MM-DD' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsedRows = jsonRows.map(rawRow => 
          normalizeRow(rawRow, file.name, detectedProject, detectedType)
        );

        parsedRowsAllFiles.push({ fileName: file.name, rows: parsedRows });
        
        filesToUploadInfo.push({
          name: file.name,
          project: detectedProject,
          type: detectedType,
          rowCount: parsedRows.length,
          size: (file.size / 1024).toFixed(1) + ' KB',
          uploadedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
        });

      } catch (err) {
        console.error('Error processing excel file:', err);
        alert(`Error al procesar el archivo ${file.name}: ` + err.message);
      }
    }

    if (isSupabaseConfigured && session) {
      // 1. Supabase Mode Sync
      try {
        for (const fileData of parsedRowsAllFiles) {
          // Clear old records for this file first
          const { error: deleteError } = await supabase
            .from('order_details')
            .delete()
            .eq('archivo_origen', fileData.fileName);

          if (deleteError) throw deleteError;

          // Insert in chunks of 500 rows to prevent DB limits
          const rowsWithUser = fileData.rows.map(r => ({
            ...r,
            user_id: session.user.id
          }));

          const chunkSize = 500;
          for (let idx = 0; idx < rowsWithUser.length; idx += chunkSize) {
            const chunk = rowsWithUser.slice(idx, idx + chunkSize);
            const { error: insertError } = await supabase
              .from('order_details')
              .insert(chunk);

            if (insertError) throw insertError;
          }
        }
        
        setSyncStatus('success');
        await fetchSupabaseOrders();
      } catch (e) {
        console.error('Error syncing with Supabase:', e);
        setSyncStatus('error');
        alert('Error de sincronización con la base de datos Supabase: ' + e.message);
        setLoading(false);
      }
    } else {
      // 2. Local Mode Save
      try {
        for (const fileData of parsedRowsAllFiles) {
          newOrders = newOrders.filter(o => o.archivo_origen !== fileData.fileName);
          newOrders.push(...fileData.rows);
        }

        filesToUploadInfo.forEach((info) => {
          const logIndex = newFilesLog.findIndex(f => f.name === info.name);
          if (logIndex >= 0) {
            newFilesLog[logIndex] = info;
          } else {
            newFilesLog.push(info);
          }
        });

        await saveOrders(newOrders);
        await saveFilesLog(newFilesLog);
        setOrders(newOrders);
        setFilesLog(newFilesLog);
        setSyncStatus('success');
      } catch (e) {
        console.error('Error saving locally:', e);
        setSyncStatus('error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleClearDatabase = async () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar toda la base de datos? Se borrarán todos los registros cargados.')) {
      setLoading(true);
      if (isSupabaseConfigured && session) {
        try {
          const { error } = await supabase
            .from('order_details')
            .delete()
            .neq('proyecto', '___DUMMY_VALUE___');

          if (error) throw error;
          await fetchSupabaseOrders();
        } catch (err) {
          console.error(err);
          alert('Error al borrar los datos de Supabase: ' + err.message);
          setLoading(false);
        }
      } else {
        try {
          await clearAllDB();
          setOrders([]);
          setFilesLog([]);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
      setExpandedOrderId(null);
      setCurrentPage(1);
    }
  };

  // Auth Operations
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    if (!authEmail || !authPassword) {
      setAuthError('Por favor introduce tu correo y contraseña.');
      setAuthLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
        alert('¡Registro completo! Verifica tu correo electrónico para confirmar la cuenta si corresponde, o inicia sesión.');
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Auth error:', err);
      setAuthError(err.message || 'Ocurrió un error en la autenticación.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('¿Deseas cerrar tu sesión actual?')) {
      setLoading(true);
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Group detailed rows into order headers
  const getGroupedOrders = () => {
    const groups = {};
    orders.forEach((row) => {
      const key = `${row.proyecto}-${row.tipo_orden}-${row.nro_orden}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          nro_orden: row.nro_orden,
          proyecto: row.proyecto,
          tipo_orden: row.tipo_orden,
          proveedor: row.proveedor,
          ruc: row.ruc,
          fecha: row.fecha,
          estado: row.estado,
          moneda: row.moneda,
          archivo_origen: row.archivo_origen,
          total_sin_igv: 0,
          total_con_igv: 0,
          gestor_compra: row.gestor_compra || 'Sin Asignar',
          creado_por: row.creado_por || 'Sistema',
          observacion: row.observacion || '',
          items: []
        };
      }
      
      // Accumulate totals
      groups[key].total_sin_igv += row.precio_sin_igv * row.cantidad;
      groups[key].total_con_igv += row.parcial_final;
      
      groups[key].items.push({
        id: row.id,
        recurso: row.recurso,
        cantidad: row.cantidad,
        unidad: row.unidad || 'UND',
        precio_sin_igv: row.precio_sin_igv,
        precio_con_igv: row.precio_con_igv,
        total: row.parcial_final
      });
    });

    return Object.values(groups);
  };

  const allGroupedOrders = getGroupedOrders();

  // Extract dynamic filters
  const statuses = ['all', ...new Set(allGroupedOrders.map(o => o.estado).filter(Boolean))];

  // Filtering Logic
  const filteredOrders = allGroupedOrders.filter((order) => {
    const matchesSearch = 
      String(order.nro_orden).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(order.proveedor).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(order.ruc).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(order.gestor_compra).toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(item => String(item.recurso).toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesProject = selectedProject === 'all' || order.proyecto === selectedProject;
    const matchesType = selectedType === 'all' || order.tipo_orden === selectedType;
    const matchesStatus = selectedStatus === 'all' || order.estado === selectedStatus;

    return matchesSearch && matchesProject && matchesType && matchesStatus;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Financial Stats
  const totals = React.useMemo(() => {
    let usdTotal = 0;
    let penTotal = 0;
    let copTotal = 0;
    
    let totalOrdersCount = allGroupedOrders.length;
    let ocCount = allGroupedOrders.filter(o => o.tipo_orden === 'OC').length;
    let osCount = allGroupedOrders.filter(o => o.tipo_orden === 'OS').length;
    
    const uniqueSuppliers = new Set(allGroupedOrders.map(o => o.proveedor)).size;
    
    const projectSpend = { LITORAL: 0, SB: 0, SUNNY: 0, OTHER: 0 };

    allGroupedOrders.forEach((o) => {
      const amt = o.total_con_igv;
      const currency = String(o.moneda).toUpperCase();
      
      // Accumulate totals based on currency
      if (currency === 'USD' || currency === 'DOLARES' || currency === 'US$') {
        usdTotal += amt;
      } else if (currency === 'COP') {
        copTotal += amt;
      } else {
        penTotal += amt;
      }

      // Convert to a single index currency for graphing comparison (USD equivalent)
      let usdEquivalent = amt;
      if (currency === 'COP') {
        usdEquivalent = amt / 4000;
      } else if (currency === 'PEN' || currency === 'SOLES' || currency === 'S/.') {
        usdEquivalent = amt / 3.8;
      }

      if (o.proyecto === 'LITORAL') {
        projectSpend.LITORAL += usdEquivalent;
      } else if (o.proyecto === 'SB') {
        projectSpend.SB += usdEquivalent;
      } else if (o.proyecto === 'SUNNY') {
        projectSpend.SUNNY += usdEquivalent;
      } else {
        projectSpend.OTHER += usdEquivalent;
      }
    });

    return {
      usd: usdTotal,
      pen: penTotal,
      cop: copTotal,
      ordersCount: totalOrdersCount,
      ocCount,
      osCount,
      uniqueSuppliers,
      projectSpend
    };
  }, [allGroupedOrders]);

  // Formatter helpers
  const formatCurrency = (amt, currency) => {
    const cur = String(currency).toUpperCase();
    let symbol = '$';
    if (cur === 'USD' || cur === 'DOLARES' || cur === 'US$') symbol = 'US$';
    else if (cur === 'PEN' || cur === 'SOLES' || cur === 'S/.') symbol = 'S/.';
    else if (cur === 'COP') symbol = 'COP $';
    
    return symbol + ' ' + amt.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Custom CSV Exporter
  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Nro Orden,Proyecto,Tipo,Proveedor,RUC,Fecha,Estado,Moneda,Total con IGV,Gestor,Creado Por\n";

    filteredOrders.forEach((o) => {
      const row = [
        o.nro_orden,
        o.proyecto,
        o.tipo_orden,
        `"${o.proveedor.replace(/"/g, '""')}"`,
        o.ruc || 'S/N',
        o.fecha,
        o.estado,
        o.moneda,
        o.total_con_igv.toFixed(2),
        `"${o.gestor_compra.replace(/"/g, '""')}"`,
        `"${o.creado_por.replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ordenes_${selectedProject}_${selectedType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get project accent colors
  const getProjectColor = (p) => {
    if (p === 'LITORAL') return 'var(--color-litoral)';
    if (p === 'SB') return 'var(--color-sb)';
    if (p === 'SUNNY') return 'var(--color-sunny)';
    return 'var(--text-muted)';
  };

  // RENDER: Auth Screen for Supabase mode (if not signed in)
  if (isSupabaseConfigured && !session) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0b0f19',
        fontFamily: 'var(--font-sans)',
        color: '#f8fafc',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Gradients */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
          zIndex: 0
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
          zIndex: 0
        }}></div>

        <div style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '40px',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          zIndex: 1
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
            }}>
              <BarChart2 size={24} />
            </div>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              Ecosistema Órdenes
            </span>
          </div>

          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>
              {isRegistering ? 'Crear una cuenta nueva' : 'Bienvenido de nuevo'}
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {isRegistering ? 'Regístrate para colaborar en tiempo real.' : 'Inicia sesión para sincronizar órdenes en la nube.'}
            </p>
          </div>

          {authError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correo Electrónico</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="tuemail@proyecto.com"
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '12px 16px 12px 40px',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '12px 16px 12px 40px',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                    fontSize: '14px'
                  }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={authLoading}
              className="btn-primary" 
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                justifyContent: 'center',
                marginTop: '12px'
              }}
            >
              {authLoading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Iniciar Sesión')}
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta aún?'}
            </span>{' '}
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                textDecoration: 'underline'
              }}
            >
              {isRegistering ? 'Inicia sesión aquí' : 'Regístrate aquí'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="logo-section">
            <div className="logo-icon">
              <BarChart2 size={24} />
            </div>
            <span className="logo-text">Ecosistema Órdenes</span>
          </div>

          <ul className="nav-links">
            <li>
              <button 
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <TrendingUp size={20} />
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => setActiveTab('orders')}
              >
                <FileText size={20} />
                <span>Órdenes</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={20} />
                <span>Cargar Excel</span>
              </button>
            </li>
          </ul>
        </div>

        <div className="sidebar-footer">
          {isSupabaseConfigured && session && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-glow)', border: '1px solid var(--color-primary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                  <User size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {session.user.email}
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: '700', textTransform: 'uppercase' }}>Colaborador</span>
                </div>
              </div>
              <button 
                onClick={handleSignOut} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-danger)', 
                  cursor: 'pointer', 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  padding: '4px'
                }}
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}

          <button onClick={toggleTheme} className="theme-toggle">
            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{themeMode === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="main-content">
        
        {/* Header */}
        <header className="page-header">
          <div>
            <h1 className="header-title" id="main-heading">
              {activeTab === 'dashboard' && 'Dashboard Consolidado'}
              {activeTab === 'orders' && 'Listado de Órdenes'}
              {activeTab === 'upload' && 'Importación de Archivos'}
            </h1>
            <p className="header-meta">
              Proyectos Litoral, SB y Sunny | {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Sync Cloud Badge */}
            {isSupabaseConfigured ? (
              <span className="badge" style={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                color: '#10b981', 
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px'
              }}>
                <Cloud size={16} />
                <span style={{ fontWeight: '600', fontSize: '12px' }}>En Línea (Supabase)</span>
              </span>
            ) : (
              <span className="badge" style={{ 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                color: '#3b82f6', 
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px'
              }} title="Configura un archivo .env con credenciales de Supabase para activar la sincronización en la nube.">
                <Database size={16} />
                <span style={{ fontWeight: '600', fontSize: '12px' }}>Base de Datos Local (IndexedDB)</span>
              </span>
            )}

            {orders.length > 0 && activeTab === 'orders' && (
              <button onClick={exportToCSV} className="btn-primary" id="btn-export-csv">
                <Download size={18} />
                <span>Exportar Vista CSV</span>
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <div className="loader-wrapper">
            <div className="spinner"></div>
            <p>Procesando información y conectando con el servidor...</p>
          </div>
        ) : (
          <>
            {/* View 1: Dashboard */}
            {activeTab === 'dashboard' && (
              <>
                {orders.length === 0 ? (
                  <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
                    <Info size={48} style={{ margin: '0 auto 16px', color: 'var(--color-primary)' }} />
                    <h2 style={{ marginBottom: '8px' }}>No hay información registrada</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                      Carga tus archivos de compras (OC) y servicios (OS) en la pestaña "Cargar Excel" para comenzar.
                    </p>
                    <button onClick={() => setActiveTab('upload')} className="btn-primary" style={{ margin: '0 auto' }}>
                      <Upload size={18} />
                      <span>Ir a Cargar Archivos</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* KPI Widget Cards */}
                    <section className="metrics-grid">
                      <div className="metric-card" style={{ '--card-accent-color': 'var(--color-primary)' }}>
                        <span className="metric-title">Gasto Total (USD)</span>
                        <span className="metric-value">{formatCurrency(totals.usd, 'USD')}</span>
                        <span className="metric-sub">Órdenes cargadas en dólares</span>
                      </div>
                      
                      {totals.cop > 0 && (
                        <div className="metric-card" style={{ '--card-accent-color': 'var(--color-success)' }}>
                          <span className="metric-title">Gasto Total (COP)</span>
                          <span className="metric-value">{formatCurrency(totals.cop, 'COP')}</span>
                          <span className="metric-sub">Pesos Colombianos acumulados</span>
                        </div>
                      )}

                      {totals.pen > 0 && (
                        <div className="metric-card" style={{ '--card-accent-color': 'var(--color-warning)' }}>
                          <span className="metric-title">Gasto Total (Soles)</span>
                          <span className="metric-value">{formatCurrency(totals.pen, 'PEN')}</span>
                          <span className="metric-sub">Soles Peruanos acumulados</span>
                        </div>
                      )}

                      <div className="metric-card" style={{ '--card-accent-color': '#8b5cf6' }}>
                        <span className="metric-title">Total de Órdenes</span>
                        <span className="metric-value">{totals.ordersCount}</span>
                        <span className="metric-sub">{totals.ocCount} Compra (OC) | {totals.osCount} Servicio (OS)</span>
                      </div>

                      <div className="metric-card" style={{ '--card-accent-color': '#ec4899' }}>
                        <span className="metric-title">Proveedores</span>
                        <span className="metric-value">{totals.uniqueSuppliers}</span>
                        <span className="metric-sub">Proveedores diferentes registrados</span>
                      </div>
                    </section>

                    {/* Visual Charts */}
                    <div className="charts-grid">
                      
                      {/* Project Spend Chart */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <h3 className="chart-title">Distribución de Gasto por Proyecto (Equivalente en USD)</h3>
                          <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flexGrow: 1, justifyContent: 'center' }}>
                          {Object.entries(totals.projectSpend).map(([proj, spend]) => {
                            if (spend === 0) return null;
                            const maxSpend = Math.max(...Object.values(totals.projectSpend));
                            const pct = maxSpend > 0 ? (spend / maxSpend) * 100 : 0;
                            return (
                              <div key={proj} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600' }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: getProjectColor(proj) }}></span>
                                    {proj}
                                  </span>
                                  <span>{formatCurrency(spend, 'USD')}</span>
                                </div>
                                <div style={{ height: '16px', width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                                  <div style={{ 
                                    height: '100%', 
                                    width: `${pct}%`, 
                                    backgroundColor: getProjectColor(proj),
                                    borderRadius: '9999px',
                                    transition: 'width 1s ease-out'
                                  }}></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* OC vs OS Pie Chart */}
                      <div className="chart-card">
                        <div className="chart-header">
                          <h3 className="chart-title">Proporción de Órdenes</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', flexGrow: 1 }}>
                          {totals.ordersCount > 0 && (
                            (() => {
                              const ocPct = (totals.ocCount / totals.ordersCount) * 100;
                              const osPct = (totals.osCount / totals.ordersCount) * 100;
                              const strokeDash = 251.2;
                              const ocOffset = strokeDash - (strokeDash * ocPct) / 100;
                              
                              return (
                                <>
                                  <svg width="160" height="160" viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--border-color)" strokeWidth="10" />
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-sb)" strokeWidth="10" 
                                      strokeDasharray={strokeDash} strokeDashoffset={0} />
                                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--color-litoral)" strokeWidth="10" 
                                      strokeDasharray={strokeDash} strokeDashoffset={ocOffset} transform="rotate(-90 50 50)" />
                                    <text x="50" y="55" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="800" fontFamily="var(--font-heading)">
                                      {totals.ordersCount}
                                    </text>
                                  </svg>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-litoral)', borderRadius: '2px' }}></span>
                                        Orden Compra (OC)
                                      </span>
                                      <strong>{totals.ocCount} ({ocPct.toFixed(0)}%)</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-sb)', borderRadius: '2px' }}></span>
                                        Orden Servicio (OS)
                                      </span>
                                      <strong>{totals.osCount} ({osPct.toFixed(0)}%)</strong>
                                    </div>
                                  </div>
                                </>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* View 2: Orders Table */}
            {activeTab === 'orders' && (
              <>
                {/* Search and Filters */}
                <section className="filter-bar">
                  <div className="search-input-wrapper">
                    <Search className="search-icon" size={18} />
                    <input 
                      type="text" 
                      className="search-input" 
                      placeholder="Buscar por orden, proveedor, RUC, gestor, recurso..." 
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      id="search-orders"
                    />
                  </div>

                  <div className="filter-options">
                    <select 
                      className="filter-select"
                      value={selectedProject}
                      onChange={(e) => {
                        setSelectedProject(e.target.value);
                        setCurrentPage(1);
                      }}
                      id="filter-project"
                    >
                      <option value="all">Todos los Proyectos</option>
                      <option value="LITORAL">LITORAL</option>
                      <option value="SB">SB</option>
                      <option value="SUNNY">SUNNY</option>
                    </select>

                    <select 
                      className="filter-select"
                      value={selectedType}
                      onChange={(e) => {
                        setSelectedType(e.target.value);
                        setCurrentPage(1);
                      }}
                      id="filter-type"
                    >
                      <option value="all">Todos los Tipos</option>
                      <option value="OC">Órdenes de Compra (OC)</option>
                      <option value="OS">Órdenes de Servicio (OS)</option>
                    </select>

                    <select 
                      className="filter-select"
                      value={selectedStatus}
                      onChange={(e) => {
                        setSelectedStatus(e.target.value);
                        setCurrentPage(1);
                      }}
                      id="filter-status"
                    >
                      <option value="all">Todos los Estados</option>
                      {statuses.filter(s => s !== 'all').map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </section>

                {/* Table */}
                {filteredOrders.length === 0 ? (
                  <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
                    <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: 'var(--color-warning)' }} />
                    <h2>No se encontraron resultados</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Prueba a ajustar tus filtros o ingresa otra palabra clave.
                    </p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nro Orden</th>
                          <th>Proyecto</th>
                          <th>Tipo</th>
                          <th>Proveedor</th>
                          <th>Fecha</th>
                          <th>Estado</th>
                          <th style={{ textAlign: 'right' }}>Monto Total</th>
                          <th style={{ textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((order) => {
                          const isExpanded = expandedOrderId === order.id;
                          const projectBadgeClass = `badge badge-${order.proyecto.toLowerCase()}`;
                          const typeBadgeClass = `badge badge-${order.tipo_orden.toLowerCase()}`;
                          
                          let statusClass = 'status-pendiente';
                          if (order.estado.toLowerCase().includes('aprob') || order.estado.toLowerCase().includes('emit') || order.estado.toLowerCase().includes('fact')) {
                            statusClass = 'status-aprobado';
                          } else if (order.estado.toLowerCase().includes('anul') || order.estado.toLowerCase().includes('canc')) {
                            statusClass = 'status-anulado';
                          }

                          return (
                            <React.Fragment key={order.id}>
                              <tr className={isExpanded ? 'expanded' : ''}>
                                <td><strong>{order.nro_orden}</strong></td>
                                <td>
                                  <span className={projectBadgeClass}>{order.proyecto}</span>
                                </td>
                                <td>
                                  <span className={typeBadgeClass}>{order.tipo_orden}</span>
                                </td>
                                <td>{order.proveedor}</td>
                                <td>{order.fecha}</td>
                                <td>
                                  <span className={`badge ${statusClass}`} style={{ borderRadius: '4px' }}>
                                    {order.estado}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  {formatCurrency(order.total_con_igv, order.moneda)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      color: 'var(--color-primary)', 
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Row */}
                              {isExpanded && (
                                <tr className="details-row">
                                  <td colSpan="8">
                                    <div className="details-wrapper">
                                      <div className="details-title">
                                        <span>Detalles de la Orden {order.nro_orden}</span>
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                          Origen: <code>{order.archivo_origen}</code>
                                        </span>
                                      </div>

                                      <div className="details-grid">
                                        <div className="details-field">
                                          <span className="details-label">Proveedor / RUC</span>
                                          <span className="details-val">{order.proveedor} ({order.ruc || 'S/N'})</span>
                                        </div>
                                        <div className="details-field">
                                          <span className="details-label">Gestor de Compra</span>
                                          <span className="details-val">{order.gestor_compra}</span>
                                        </div>
                                        <div className="details-field">
                                          <span className="details-label">Creado Por</span>
                                          <span className="details-val">{order.creado_por}</span>
                                        </div>
                                        {order.observacion && (
                                          <div className="details-field">
                                            <span className="details-label">Observaciones</span>
                                            <span className="details-val">{order.observacion}</span>
                                          </div>
                                        )}
                                      </div>

                                      <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                                        Recursos / Ítems
                                      </h4>

                                      <table className="items-table">
                                        <thead>
                                          <tr>
                                            <th>Descripción Recurso</th>
                                            <th style={{ textAlign: 'center' }}>Unidad</th>
                                            <th style={{ textAlign: 'right' }}>Cantidad</th>
                                            <th style={{ textAlign: 'right' }}>Precio Unit. c/IGV</th>
                                            <th style={{ textAlign: 'right' }}>Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {order.items.map((item) => (
                                            <tr key={item.id}>
                                              <td>{item.recurso}</td>
                                              <td style={{ textAlign: 'center' }}>{item.unidad}</td>
                                              <td style={{ textAlign: 'right' }}>{item.cantidad.toLocaleString()}</td>
                                              <td style={{ textAlign: 'right' }}>{formatCurrency(item.precio_con_igv, order.moneda)}</td>
                                              <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.total, order.moneda)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="pagination">
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          Mostrando {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredOrders.length)} de {filteredOrders.length} órdenes
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => paginate(currentPage - 1)} 
                            disabled={currentPage === 1}
                            className="pagination-btn"
                          >
                            Anterior
                          </button>
                          <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', padding: '0 8px' }}>
                            Página {currentPage} de {totalPages}
                          </span>
                          <button 
                            onClick={() => paginate(currentPage + 1)} 
                            disabled={currentPage === totalPages}
                            className="pagination-btn"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* View 3: Upload Excel Manager */}
            {activeTab === 'upload' && (
              <div className="upload-container">
                {/* Sync status alert */}
                {syncStatus !== 'idle' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    backgroundColor: syncStatus === 'syncing' ? 'rgba(37, 99, 235, 0.1)' : syncStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid ' + (syncStatus === 'syncing' ? 'rgba(37, 99, 235, 0.2)' : syncStatus === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                    color: syncStatus === 'syncing' ? '#60a5fa' : syncStatus === 'success' ? '#34d399' : '#f87171'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {syncStatus === 'syncing' && <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', animationDuration: '0.6s' }}></div>}
                      {syncStatus === 'success' && <CheckCircle size={18} />}
                      {syncStatus === 'error' && <AlertTriangle size={18} />}
                      <span>
                        {syncStatus === 'syncing' && 'Sincronizando archivos en la base de datos...'}
                        {syncStatus === 'success' && 'Archivos cargados y sincronizados correctamente.'}
                        {syncStatus === 'error' && 'Error al guardar los archivos en el servidor.'}
                      </span>
                    </div>
                    <button 
                      onClick={() => setSyncStatus('idle')} 
                      style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px', opacity: 0.8 }}
                    >
                      Descartar
                    </button>
                  </div>
                )}

                <div 
                  className={`dropzone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current.click()}
                  id="dropzone-area"
                >
                  <Upload className="dropzone-icon" size={48} />
                  <p className="dropzone-text">
                    Arrastra tus archivos Excel aquí o <span>selecciónalos desde tu equipo</span>
                  </p>
                  <p className="dropzone-sub">
                    Soporta múltiples archivos. Los nombres deben iniciar con "OC" para compras o "OS" para servicios.
                  </p>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    multiple 
                    onChange={handleFileChange}
                    accept=".xlsx, .xls"
                  />
                </div>

                {filesLog.length > 0 && (
                  <div className="file-list-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                        Archivos registrados {isSupabaseConfigured ? 'en la nube' : 'localmente'}
                      </h3>
                      <button onClick={handleClearDatabase} className="btn-primary" style={{ backgroundColor: 'var(--color-danger)' }} id="btn-clear-db">
                        <Trash2 size={16} />
                        <span>Vaciar Ecosistema</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {filesLog.map((file) => (
                        <div key={file.name} className="file-item">
                          <div className="file-info">
                            <FileText size={20} style={{ color: getProjectColor(file.project) }} />
                            <div>
                              <div className="file-name">{file.name}</div>
                              <div className="file-size" style={{ display: 'flex', gap: '12px' }}>
                                <span>Proyecto: <strong>{file.project}</strong></span>
                                <span>Tipo: <strong>{file.type}</strong></span>
                                <span>Tamaño: {file.size}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="file-status success">
                              <CheckCircle size={16} />
                              <span>{file.rowCount} Registros</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sincronizado</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
