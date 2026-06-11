import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ArrowRight,
  TrendingDown,
  Package,
  DollarSign,
  Activity,
  Shield
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { getOrders, saveOrders, getFilesLog, saveFilesLog, clearAllDB } from './db';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// Superadmin emails - only these can upload/delete
const SUPERADMIN_EMAILS = ['yleon@padovasac.com', 'yrvingleon@hotmail.com'];

function isSuperAdmin(email) {
  return email && SUPERADMIN_EMAILS.includes(email.toLowerCase().trim());
}

function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('oc');
  const [themeMode, setThemeMode] = useState('dark');
  const [loading, setLoading] = useState(true);

  // Data States
  const [orders, setOrders] = useState([]);
  const [filesLog, setFilesLog] = useState([]);
  const [originFiles, setOriginFiles] = useState([]); // List of original files from Supabase Storage
  
  // Table Pagination & Expanded Rows
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [innerSearch, setInnerSearch] = useState(''); // New: search within expanded order
  const itemsPerPage = 15;
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Logistics filters
  const [selectedMacro, setSelectedMacro] = useState('all'); // Macro-Category (Materials, Services, Assets)
  const [logisticSearch, setLogisticSearch] = useState('');
  const [logisticProject, setLogisticProject] = useState('all');
  const [logisticType, setLogisticType] = useState('all');
  const [logisticPage, setLogisticPage] = useState(1);
  const [logisticSort, setLogisticSort] = useState('total'); // 'total' | 'variacion' | 'nombre' | 'precio_min'
  const [selectedCategory, setSelectedCategory] = useState('all'); // category filter (N1 group)
  
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
  const [syncStatus, setSyncStatus] = useState('idle'); 

  const userEmail = session?.user?.email || '';
  const isAdmin = isSuperAdmin(userEmail);

  // Initialize DB and Load Data
  useEffect(() => {
    document.documentElement.className = themeMode === 'light' ? 'light-mode' : '';

      if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) {
          fetchSupabaseOrders();
          fetchOriginFiles();
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session) {
          fetchSupabaseOrders();
          fetchOriginFiles();
        } else {
          setOrders([]);
          setFilesLog([]);
          setOriginFiles([]);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      loadLocalData();
    }
  }, []);

  // Fetch list of original files from Supabase Storage
  const fetchOriginFiles = async () => {
    try {
      const { data, error } = await supabase.storage.from('matrix-files').list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

      if (error) {
        if (error.message.includes('not found')) {
          console.log('Bucket "matrix-files" not found. Need to create it.');
        } else {
          throw error;
        }
      }
      setOriginFiles(data || []);
    } catch (err) {
      console.error('Error fetching files from storage:', err);
    }
  };

  // === PADOVA CLASSIFICATION PRESERVER (Strict 3-Macro Groups) ===
  const classifyResource = (row) => {
    let n1 = String(row.recurso_n1 || '').toUpperCase();
    let n2 = row.recurso_n2 || 'OTROS';
    const text = String(row.recurso || '').toUpperCase();
    const type = String(row.tipo_orden || 'OC').toUpperCase();

    let finalMacro = '1. MATERIALES'; // Default

    // Logic to force into the 3 requested groups
    if (type === 'OS' || n1.includes('SERV') || n1.includes('SUB') || 
        text.includes('SERVICIO') || text.includes('FLETE') || text.includes('MANO DE OBRA') || text.includes('TRABAJO')) {
      finalMacro = '2. SUBCONTRATOS Y SERVICIOS';
    } else if (n1.includes('ACT') || n1.includes('EQUIP') || text.includes('ACTIVO') || text.includes('MAQUINARIA') || text.includes('HERRAMIENTA')) {
      finalMacro = '3. ACTIVOS';
    } else {
      finalMacro = '1. MATERIALES';
    }

    return { macro: finalMacro, sub: n2 };
  };

  // Fetch orders from Supabase (Recursive to bypass 1000 limit)
  const fetchSupabaseOrders = async () => {
    setLoading(true);
    try {
      let allData = [];
      let hasMore = true;
      let page = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from('order_details')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data.length > 0) {
          allData = [...allData, ...data];
          page++;
        }
        
        if (data.length < pageSize) {
          hasMore = false;
        }
      }

      setOrders(allData);

      // Group files
      const filesMap = {};
      allData.forEach(row => {
        const fileKey = row.archivo_origen || 'Carga Nube';
        if (!filesMap[fileKey]) {
          filesMap[fileKey] = {
            name: fileKey,
            project: row.proyecto,
            type: row.tipo_orden,
            rowCount: 0,
            size: 'Nube',
            uploadedAt: new Date(row.created_at).toLocaleDateString() + ' ' + new Date(row.created_at).toLocaleTimeString()
          };
        }
        filesMap[fileKey].rowCount++;
      });
      setFilesLog(Object.values(filesMap));
    } catch (err) {
      console.error('Error fetching Supabase data:', err);
      alert('Error al descargar datos de Supabase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load local IndexedDB
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

  // Safe number parser
  const parseNum = (val) => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  // Smart mapper to normalize Excel column names
  // Priority: exact match > partial match to avoid false positives like "Correo Proveedor"
  const normalizeRow = (rawRow, fileName, defaultProject, defaultType) => {
    const row = {};
    const cleanKey = (k) => String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    let providerName = '';
    let orderNum = '';
    let compositeOrderNum = '';
    let rucValue = '';
    let dateValue = '';
    let statusValue = '';
    let currencyValue = '';
    let resourceName = '';
    let qtyValue = 1;
    let priceSin = 0;
    let priceCon = 0;
    let totalVal = 0;
    let unitValue = 'UND';
    let gestorValue = 'Sin Asignar';
    let creatorValue = 'Sistema';
    let obsValue = '';
    let cantAtendidaValue = 0;
    let cantPorAtenderValue = 0;
    let estadoFacturacionValue = 'Sin Facturación';
    let saldoPorPagarValue = 0;
    let fechaEntregaValue = '';
    let aprobadorValue = '';
    let empresaProyectoValue = '';
    let pedidosValue = '';
    let anioMesValue = '';
    let solicitanteValue = '';
    let codigoRecursoValue = '';
    let recursoN1Value = '';
    let recursoN2Value = '';
    let recursoN3Value = '';
    let fechaCreacionValue = '';

    // First pass: exact matches take highest priority
    Object.keys(rawRow).forEach((key) => {
      const ck = cleanKey(key);
      const val = rawRow[key];
      const strVal = val !== null && val !== undefined ? String(val).trim() : '';

      // === PROVEEDOR (Critical fix: check exact key first) ===
      if (ck === 'proveedor' && strVal) {
        providerName = strVal;
      }

      // === ORDEN NUMBER (Type specific) ===
      if (defaultType === 'OC') {
        if (ck === 'nro. orden de compra' || ck === 'n° orden de compra') orderNum = strVal;
      } else if (defaultType === 'OS') {
        if (ck === 'nro. orden de servicio' || ck === 'n° orden de servicio') orderNum = strVal;
      }
      
      // Generic or composite order (fallback)
      if (ck === 'n° orden de compra compuesto' || ck === 'n? orden de compra compuesto' || ck.includes('compuesto')) {
        if (strVal) compositeOrderNum = strVal;
      } else if (!orderNum && (ck === 'nro orden' || ck === 'n° orden' || ck === 'nro. orden')) {
        if (strVal) orderNum = strVal;
      }

      // === RUC (exact only) ===
      if (ck === 'ruc') rucValue = strVal;

      // === FECHA ===
      if (ck === 'fecha') dateValue = val;

      // === ESTADO (orden) ===
      if (ck === 'estado') statusValue = strVal;

      // === MONEDA ===
      if (ck === 'moneda') currencyValue = strVal;

      // === RECURSO ===
      if (ck === 'recurso') resourceName = strVal;

      // === CANTIDAD ===
      if (ck === 'cantidad') qtyValue = parseNum(val);

      // === PRECIOS ===
      if (ck === 'precio sin i.g.v.' || ck === 'precio sin igv') {
        priceSin = parseNum(val);
      } else if (ck === 'precio con i.g.v.' || ck === 'precio con igv') {
        priceCon = parseNum(val);
      }

      // === TOTALES ===
      if (ck === 'parcial con i.g.v. detalle' || ck === 'parcial con igv' || 
          ck === 'parcial final' || ck === 'valor total' || ck === 'total') {
        totalVal = parseNum(val);
      }

      // === UNIDAD ===
      if (ck === 'unidad') unitValue = strVal || 'UND';

      // === GESTORES ===
      if (ck === 'gestor de compra' || ck === 'gestor compra' || ck === 'gestor') {
        gestorValue = strVal || 'Sin Asignar';
      } else if (ck === 'creado por' || ck === 'creador') {
        creatorValue = strVal || 'Sistema';
      } else if (ck === 'fecha creacion') {
        fechaCreacionValue = strVal;
      } else if (ck === 'observacion' || ck === 'observaciones' || ck === 'observacion detalle') {
        if (!obsValue && strVal) obsValue = strVal;
      }

      // === CAMPOS ADICIONALES ===
      if (ck === 'cant.atendida(almacen/subcontrato)' || ck === 'cant. atendida' || ck.startsWith('cant.atendida')) {
        cantAtendidaValue = parseNum(val);
      }
      if (ck === 'cantidad por atender' || ck === 'cant. por atender') {
        cantPorAtenderValue = parseNum(val);
      }
      if (ck === 'estado facturacion') {
        estadoFacturacionValue = strVal || 'Sin Facturación';
      }
      if (ck === 'saldo por pagar') {
        saldoPorPagarValue = parseNum(val);
      }
      if (ck === 'fecha de entrega o.c.' || ck === 'fecha de entrega' || ck === 'fecha entrega') {
        fechaEntregaValue = strVal;
      }
      if (ck === 'aprobador' || ck === 'aprobadores') {
        aprobadorValue = strVal;
      }
      if (ck === 'empresa proyecto') {
        empresaProyectoValue = strVal;
      }
      if (ck === 'pedidos') {
        pedidosValue = strVal;
      }
      if (ck === 'ano mes' || ck === 'anomes') {
        anioMesValue = strVal;
      }
      if (ck === 'solicitante(s) de pedido(s)' || ck === 'solicitantes de pedidos' || ck.startsWith('solicitante')) {
        solicitanteValue = strVal;
      }
      if (ck === 'codigo recurso') {
        codigoRecursoValue = strVal;
      }
      if (ck === 'recurso n1') recursoN1Value = strVal;
      if (ck === 'recurso n2') recursoN2Value = strVal;
      if (ck === 'recurso n3') recursoN3Value = strVal;
    });

    // Resolve order number (prefer composite code like LIT-SAURIS-0191)
    row.nro_orden = compositeOrderNum || orderNum || 'S/N';
    
    // Project: use the "Proyecto" field from Excel if available
    const rawProyecto = rawRow['Proyecto'] || rawRow['proyecto'];
    row.proyecto = rawProyecto ? String(rawProyecto).trim() : defaultProject;
    
    row.tipo_orden = defaultType;
    row.proveedor = providerName || 'SIN PROVEEDOR';
    row.ruc = rucValue ? rucValue.trim() : 'S/N';
    row.fecha = dateValue || 'Sin Fecha';
    row.estado = statusValue || 'Emitido';
    
    // Normalize currency
    const m = String(currencyValue || '').toUpperCase().trim();
    if (m === 'USD' || m === 'DOLARES' || m === 'US$' || m === 'U$') {
      row.moneda = 'USD';
    } else {
      row.moneda = 'PEN';
    }

    row.recurso = resourceName || 'ÍTEM SIN DESCRIPCIÓN';
    row.codigo_recurso = codigoRecursoValue;
    
    // --- PADOVA STANDARDIZED MACRO-GROUPS ---
    const text = String(resourceName).toUpperCase();
    let n1 = '1. MATERIALES';
    
    if (defaultType === 'OS' || text.includes('SERVICIO') || text.includes('FLETE') || text.includes('TRABAJO') || text.includes('MANO DE OBRA')) {
      n1 = '2. SUBCONTRATOS Y SERVICIOS';
    } else if (text.includes('ACTIVO') || text.includes('MAQUINARIA') || text.includes('EQUIPO') || text.includes('HERRAMIENTA')) {
      n1 = '3. ACTIVOS';
    }

    row.recurso_n1 = n1; 
    row.recurso_n2 = recursoN2Value || 'OTROS / VARIOS';
    row.recurso_n3 = recursoN3Value;

    row.cantidad = qtyValue || 1;
    row.parcial_final = totalVal || (priceCon * qtyValue) || (priceSin * 1.18 * qtyValue) || 0;
    row.precio_con_igv = priceCon || (qtyValue ? row.parcial_final / qtyValue : 0);
    row.precio_sin_igv = priceSin || (row.precio_con_igv / 1.18);
    row.unidad = unitValue;
    row.gestor_compra = gestorValue;
    row.creado_por = creatorValue;
    row.fecha_creacion = fechaCreacionValue;
    row.observacion = obsValue;
    row.archivo_origen = fileName;

    row.cant_atendida = cantAtendidaValue;
    row.cant_por_atender = cantPorAtenderValue;
    row.estado_facturacion = estadoFacturacionValue;
    row.saldo_por_pagar = saldoPorPagarValue;
    row.fecha_entrega = fechaEntregaValue;
    row.aprobador = aprobadorValue;
    row.empresa_proyecto = empresaProyectoValue;
    row.pedidos = pedidosValue;
    row.anio_mes = anioMesValue;
    row.solicitante = solicitanteValue;

    return row;
  };

  // Process files
  const handleFiles = async (fileList) => {
    if (!isAdmin) {
      alert('No tienes permisos para cargar archivos. Solo los superadministradores pueden subir datos.');
      return;
    }

    setLoading(true);
    setSyncStatus('syncing');
    const newFilesLog = [...filesLog];
    let newOrders = [...orders];

    const parsedRowsAllFiles = [];
    const filesToUploadInfo = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        alert(`El archivo ${file.name} no es un archivo Excel válido.`);
        continue;
      }

      // Default type based on name
      const fn = file.name.toUpperCase();
      let detectedType = 'OC';
      if (fn.startsWith('OS') || fn.includes(' OS ') || fn.includes('OS ') || fn.includes('_OS_') || fn.includes('-OS-')) {
        detectedType = 'OS';
      }

      let detectedProject = 'PROYECTO GENERAL';
      if (fn.includes('LITORAL')) {
        detectedProject = 'LITORAL';
      } else if (fn.includes('SB') || fn.includes('SANTA BEATRIZ') || fn.includes('BEATRIZ')) {
        detectedProject = 'SB';
      } else if (fn.includes('SUNNY')) {
        detectedProject = 'SUNNY';
      }

      try {
        // 1. Upload to Supabase Storage (Original File)
        if (isSupabaseConfigured && session) {
          const { error: uploadError } = await supabase.storage
            .from('matrix-files')
            .upload(`${file.name}`, file, {
              upsert: true,
              cacheControl: '3600'
            });
          
          if (uploadError) console.error('Error uploading original file:', uploadError);
        }

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { cellDates: true, dateNF: 'YYYY-MM-DD' });
        
        let sheetsToParse = [];

        // Check if file is combined (e.g. DETALLES.xlsx with EXPORTADOS_OC and EXPORTADOS_OS sheets)
        const hasSpecificOC = workbook.SheetNames.some(name => ['EXPORTADOS_OC', 'OC'].includes(name.toUpperCase()));
        const hasSpecificOS = workbook.SheetNames.some(name => ['EXPORTADOS_OS', 'OS'].includes(name.toUpperCase()));

        if (hasSpecificOC || hasSpecificOS) {
          workbook.SheetNames.forEach(name => {
            const upperName = name.toUpperCase();
            if (upperName === 'EXPORTADOS_OC' || upperName === 'OC') {
              sheetsToParse.push({ name, type: 'OC', worksheet: workbook.Sheets[name] });
            } else if (upperName === 'EXPORTADOS_OS' || upperName === 'OS') {
              sheetsToParse.push({ name, type: 'OS', worksheet: workbook.Sheets[name] });
            }
          });
        } else {
          const firstSheetName = workbook.SheetNames[0];
          sheetsToParse.push({
            name: firstSheetName,
            type: detectedType,
            worksheet: workbook.Sheets[firstSheetName]
          });
        }

        // Clean local/cloud details for this specific file name
        newOrders = newOrders.filter(o => o.archivo_origen !== file.name);

        for (const sheet of sheetsToParse) {
          const jsonRows = XLSX.utils.sheet_to_json(sheet.worksheet, { defval: '' });
          
          const parsedRows = jsonRows
            .filter(rawRow => Object.keys(rawRow).length > 2)
            .map(rawRow => {
              const row = normalizeRow(rawRow, file.name, detectedProject, sheet.type);
              
              // Ensure hierarchy from normalization is captured if normalizeRow was updated
              // This part ensures that the two-tier classification is stored in Supabase
              if (rawRow['Source.Name']) {
                row.archivo_origen = String(rawRow['Source.Name']).trim();
              }
              return row;
            });

          if (parsedRows.length > 0) {
            parsedRowsAllFiles.push({ fileName: file.name, rows: parsedRows });
            
            filesToUploadInfo.push({
              name: file.name + ` (${sheet.name})`,
              project: detectedProject,
              type: sheet.type,
              rowCount: parsedRows.length,
              size: (file.size / 1024).toFixed(1) + ' KB',
              uploadedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
            });
          }
        }

      } catch (err) {
        console.error('Error processing excel file:', err);
        alert(`Error al procesar el archivo ${file.name}: ` + err.message);
      }
    }

    if (isSupabaseConfigured && session) {
      try {
        for (const fileData of parsedRowsAllFiles) {
          const uniqueOriginFiles = [...new Set(fileData.rows.map(r => r.archivo_origen))];
          
          for (const originFile of uniqueOriginFiles) {
            const { error: deleteError } = await supabase
              .from('order_details')
              .delete()
              .eq('archivo_origen', originFile);

            if (deleteError) throw deleteError;
          }

          // Only include columns that exist in Supabase schema
          const SUPABASE_COLS = [
            'proyecto','tipo_orden','nro_orden','proveedor','ruc','fecha','estado','moneda',
            'recurso','codigo_recurso','recurso_n1','recurso_n2','recurso_n3',
            'cantidad','precio_sin_igv','precio_con_igv','parcial_final','unidad',
            'gestor_compra','creado_por','fecha_creacion','observacion','archivo_origen',
            'cant_atendida','cant_por_atender','estado_facturacion','saldo_por_pagar',
            'fecha_entrega','aprobador','empresa_proyecto','pedidos','anio_mes','solicitante','user_id'
          ];
          
          const rowsWithUser = fileData.rows.map(r => {
            const clean = { user_id: session.user.id };
            SUPABASE_COLS.forEach(col => { if (col !== 'user_id' && r[col] !== undefined) clean[col] = r[col]; });
            clean.user_id = session.user.id;
            return clean;
          });

          const chunkSize = 400;
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
        alert('Error al guardar en Supabase: ' + e.message);
        setLoading(false);
      }
    } else {
      try {
        for (const fileData of parsedRowsAllFiles) {
          const uniqueOriginFiles = [...new Set(fileData.rows.map(r => r.archivo_origen))];
          uniqueOriginFiles.forEach(originFile => {
            newOrders = newOrders.filter(o => o.archivo_origen !== originFile);
          });
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
    if (!isAdmin) {
      alert('Solo los superadministradores pueden vaciar la base de datos.');
      return;
    }
    if (window.confirm('¿Estás seguro de que deseas vaciar toda la base de datos? Esta acción no se puede deshacer.')) {
      setLoading(true);
      if (isSupabaseConfigured && session) {
        try {
          let hasMore = true;
          while(hasMore) {
            const { data, error } = await supabase.from('order_details').select('id').limit(1000);
            if (error) throw error;
            if (!data || data.length === 0) { hasMore = false; break; }
            const ids = data.map(d => d.id);
            const { error: delErr } = await supabase.from('order_details').delete().in('id', ids);
            if (delErr) throw delErr;
          }
          await fetchSupabaseOrders();
        } catch (err) {
          console.error('Error clearing database:', err);
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
        alert('¡Registro completo! Revisa tu correo para confirmar tu cuenta y luego inicia sesión.');
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.message || 'Error en la autenticación.');
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

  // Group detailed rows into orders
  const getGroupedOrders = () => {
    const groups = {};
    orders.forEach((row) => {
      const key = `${row.tipo_orden}-${row.nro_orden}-${row.proveedor}`;
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
          estado_facturacion: row.estado_facturacion || 'Sin Facturación',
          saldo_por_pagar: row.saldo_por_pagar || 0,
          fecha_entrega: row.fecha_entrega || '',
          aprobador: row.aprobador || '',
          empresa_proyecto: row.empresa_proyecto || '',
          pedidos: row.pedidos || '',
          anio_mes: row.anio_mes || '',
          solicitante: row.solicitante || '',
          items: []
        };
      }
      
      groups[key].total_sin_igv += row.precio_sin_igv * row.cantidad;
      groups[key].total_con_igv += row.parcial_final;
      
      groups[key].items.push({
        id: row.id,
        recurso: row.recurso,
        codigo_recurso: row.codigo_recurso,
        cantidad: row.cantidad,
        unidad: row.unidad || 'UND',
        precio_sin_igv: row.precio_sin_igv,
        precio_con_igv: row.precio_con_igv,
        total: row.parcial_final,
        cant_atendida: row.cant_atendida || 0,
        cant_por_atender: row.cant_por_atender || 0
      });
    });

    return Object.values(groups);
  };

  const allGroupedOrders = getGroupedOrders();

  // Formatter helpers
  const formatCurrency = (amt, currency) => {
    const cur = String(currency || '').toUpperCase().trim();
    let symbol = 'S/.';
    if (cur === 'USD' || cur === 'DOLARES' || cur === 'US$' || cur === 'U$') symbol = 'U$';
    else if (cur === 'PEN' || cur === 'SOLES' || cur === 'S/.') symbol = 'S/.';
    return symbol + ' ' + (amt || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Get project accent colors
  const getProjectColor = (p) => {
    const proj = String(p || '').toUpperCase().trim();
    if (proj.includes('LITORAL')) return 'var(--color-litoral)';
    if (proj.includes('SB') || proj.includes('SANTA BEATRIZ') || proj.includes('FIDENZ') || proj.includes('BEATRIZ')) return 'var(--color-sb)';
    if (proj.includes('SUNNY') || proj.includes('MELCEN')) return 'var(--color-sunny)';
    return 'var(--text-muted)';
  };

  // Detect simplified project name from full proyecto field
  const getSimpleProject = (proyecto) => {
    const p = String(proyecto || '').toUpperCase();
    if (p.includes('LITORAL')) return 'LITORAL';
    if (p.includes('SANTA BEATRIZ') || p.includes('SB') || p.includes('FIDENZ') || p.includes('BEATRIZ')) return 'SB';
    if (p.includes('SUNNY') || p.includes('MELCEN')) return 'SUNNY';
    return 'OTRO';
  };

  // Dashboard stats engine
  const dashboardStats = useMemo(() => {
    const filterProject = (o) => {
      if (selectedProject === 'all') return true;
      return getSimpleProject(o.proyecto) === selectedProject;
    };

    const ocOrders = allGroupedOrders.filter(o => o.tipo_orden === 'OC' && filterProject(o));
    const osOrders = allGroupedOrders.filter(o => o.tipo_orden === 'OS' && filterProject(o));

    const calculateMetrics = (ordersList) => {
      let usd = 0;
      let pen = 0;
      const count = ordersList.length;
      const providerSpend = {};
      const projectSpend = { LITORAL: 0, SB: 0, SUNNY: 0, OTRO: 0 };
      const statusCount = {};

      ordersList.forEach(o => {
        const amt = o.total_con_igv;
        const cur = o.moneda;

        if (cur === 'USD') usd += amt;
        else pen += amt;

        const usdEquivalent = cur === 'USD' ? amt : amt / 3.8;
        providerSpend[o.proveedor] = (providerSpend[o.proveedor] || 0) + usdEquivalent;

        const sp = getSimpleProject(o.proyecto);
        projectSpend[sp] = (projectSpend[sp] || 0) + usdEquivalent;

        statusCount[o.estado] = (statusCount[o.estado] || 0) + 1;
      });

      const topProviders = Object.entries(providerSpend)
        .map(([name, val]) => ({ name, val }))
        .sort((a, b) => b.val - a.val)
        .slice(0, 5);

      const topStatuses = Object.entries(statusCount)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      return { usd, pen, count, topProviders, projectSpend, topStatuses };
    };

    return {
      oc: calculateMetrics(ocOrders),
      os: calculateMetrics(osOrders),
      totalProviders: new Set(allGroupedOrders.map(o => o.proveedor)).size,
      totalCount: allGroupedOrders.length
    };
  }, [allGroupedOrders, selectedProject]);

  // === LOGISTICS ANALYSIS ENGINE ===
  const logisticsData = useMemo(() => {
    const productMap = {};
    
    orders.forEach(row => {
      const sp = getSimpleProject(row.proyecto);
      if (logisticProject !== 'all' && sp !== logisticProject) return;
      if (logisticType !== 'all' && row.tipo_orden !== logisticType) return;
      
      const recurso = (row.recurso || '').trim();
      if (!recurso || recurso === 'ÍTEM SIN DESCRIPCIÓN') return;
      
      // Hierarchy Detection using PADOVA PRESERVER
      const { macro, sub } = classifyResource(row);

      // Filter by selected Macro
      if (selectedMacro !== 'all' && macro !== selectedMacro) return;
      // Filter by selected Sub-Family
      if (selectedCategory !== 'all' && sub !== selectedCategory) return;
      
      const precio = row.precio_con_igv || row.precio_sin_igv * 1.18 || 0;
      if (precio <= 0) return;
      
      if (!productMap[recurso]) {
        productMap[recurso] = {
          recurso,
          macro,
          sub,
          unidad: row.unidad || 'UND',
          moneda: row.moneda,
          precios: [],
          proveedores: new Set(),
          proyectos: new Set(),
          totalComprado: 0,
          cantidadTotal: 0,
          ordenes: []
        };
      }
      
      productMap[recurso].precios.push(precio);
      productMap[recurso].proveedores.add(row.proveedor || 'S/N');
      productMap[recurso].proyectos.add(sp);
      productMap[recurso].totalComprado += row.parcial_final || 0;
      productMap[recurso].cantidadTotal += row.cantidad || 0;
      productMap[recurso].ordenes.push({
        nro_orden: row.nro_orden,
        proveedor: row.proveedor,
        precio_con_igv: precio,
        cantidad: row.cantidad,
        moneda: row.moneda,
        proyecto: sp,
        fecha: row.fecha
      });
    });

    const products = Object.values(productMap).map(p => {
      const precios = p.precios.filter(v => v > 0);
      return {
        ...p,
        proveedores: [...p.proveedores],
        proyectos: [...p.proyectos],
        numProveedores: p.proveedores.size,
        precioMin: precios.length ? Math.min(...precios) : 0,
        precioMax: precios.length ? Math.max(...precios) : 0,
        precioPromedio: precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : 0,
        variacionPct: precios.length > 1 ? ((Math.max(...precios) - Math.min(...precios)) / Math.min(...precios) * 100) : 0,
        numOrdenes: precios.length
      };
    });

    let filtered = logisticSearch 
      ? products.filter(p => p.recurso.toLowerCase().includes(logisticSearch.toLowerCase()))
      : products;

    if (logisticSort === 'total') filtered.sort((a, b) => b.totalComprado - a.totalComprado);
    else if (logisticSort === 'variacion') filtered.sort((a, b) => b.variacionPct - a.variacionPct);
    else if (logisticSort === 'nombre') filtered.sort((a, b) => a.recurso.localeCompare(b.recurso));
    else if (logisticSort === 'precio_min') filtered.sort((a, b) => a.precioMin - b.precioMin);

    return filtered;
  }, [orders, logisticProject, logisticType, logisticSearch, logisticSort, selectedCategory, selectedMacro]);

  const categorySummary = useMemo(() => {
    const subMap = {};
    orders.forEach(row => {
      const sp = getSimpleProject(row.proyecto);
      if (logisticProject !== 'all' && sp !== logisticProject) return;
      if (logisticType !== 'all' && row.tipo_orden !== logisticType) return;
      
      const { macro, sub } = classifyResource(row);

      // Check macro filter
      if (selectedMacro !== 'all' && macro !== selectedMacro) return;

      if (!subMap[sub]) subMap[sub] = { name: sub, count: 0, totalComprado: 0 };
      subMap[sub].count++;
      subMap[sub].totalComprado += row.parcial_final || 0;
    });
    return Object.values(subMap).sort((a, b) => b.totalComprado - a.totalComprado);
  }, [orders, logisticProject, logisticType, selectedMacro]);

  const macroSummary = useMemo(() => {
    const macMap = {};
    const VALID_MACROS = ['1. MATERIALES', '2. SUBCONTRATOS Y SERVICIOS', '3. ACTIVOS'];
    
    orders.forEach(row => {
      const sp = getSimpleProject(row.proyecto);
      if (logisticProject !== 'all' && sp !== logisticProject) return;
      if (logisticType !== 'all' && row.tipo_orden !== logisticType) return;
      
      const { macro } = classifyResource(row);
      // Ensure macro is one of the valid ones
      if (!VALID_MACROS.includes(macro)) return;

      if (!macMap[macro]) macMap[macro] = { name: macro, count: 0, totalComprado: 0 };
      macMap[macro].count++;
      macMap[macro].totalComprado += row.parcial_final || 0;
    });
    return Object.values(macMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, logisticProject, logisticType]);

  // Export to XLSX function
  const exportToXLSX = (data, filename, sheetName = 'Reporte') => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
  };

  // Export orders to Excel
  const exportOrdersToXLSX = (type) => {
    const filteredForExport = allGroupedOrders.filter(o => {
      const matchesType = o.tipo_orden === type;
      const matchesProject = selectedProject === 'all' || getSimpleProject(o.proyecto) === selectedProject;
      return matchesType && matchesProject;
    });

    const rows = filteredForExport.map(o => ({
      'Nro Orden': o.nro_orden,
      'Proyecto': o.proyecto,
      'Proveedor': o.proveedor,
      'RUC': o.ruc,
      'Fecha': o.fecha,
      'Estado': o.estado,
      'Estado Facturación': o.estado_facturacion,
      'Moneda': o.moneda,
      'Monto Total c/IGV': o.total_con_igv,
      'Saldo por Pagar': o.saldo_por_pagar,
      'Gestor de Compra': o.gestor_compra,
      'Empresa Proyecto': o.empresa_proyecto,
      'Solicitante': o.solicitante,
      'Aprobador': o.aprobador,
      'Fecha Entrega': o.fecha_entrega,
      'Pedidos': o.pedidos,
      'Año/Mes': o.anio_mes
    }));

    exportToXLSX(rows, `Reporte_${type}_${selectedProject}_${new Date().toISOString().slice(0,10)}.xlsx`, `Órdenes ${type}`);
  };

  // Export logistics to Excel
  const exportLogisticsToXLSX = () => {
    const rows = logisticsData.map(p => ({
      'Recurso': p.recurso,
      'Unidad': p.unidad,
      'Moneda': p.moneda,
      'Precio Mínimo c/IGV': p.precioMin.toFixed(4),
      'Precio Máximo c/IGV': p.precioMax.toFixed(4),
      'Precio Promedio c/IGV': p.precioPromedio.toFixed(4),
      'Variación (%)': p.variacionPct.toFixed(1),
      'N° Proveedores': p.numProveedores,
      'Proveedores': p.proveedores.join('; '),
      'Proyectos': p.proyectos.join('; '),
      'Total Comprado': p.totalComprado.toFixed(2),
      'Cantidad Total': p.cantidadTotal,
      'N° Órdenes': p.numOrdenes
    }));
    exportToXLSX(rows, `Análisis_Logístico_${new Date().toISOString().slice(0,10)}.xlsx`, 'Precios Productos');
  };

  // RENDER: Auth Screen
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
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)', zIndex: 0 }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)', zIndex: 0 }}></div>

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}>
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
              {isRegistering ? 'Regístrate para acceder al sistema.' : 'Inicia sesión para ver los datos en tiempo real.'}
            </p>
          </div>

          {authError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '20px' }}>
              <AlertTriangle size={18} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Correo Electrónico</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="tuemail@empresa.com"
                  style={{ width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 16px 12px 40px', color: '#f8fafc', fontFamily: 'var(--font-sans)', outline: 'none', fontSize: '14px' }} required />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contraseña</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••"
                  style={{ width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px 16px 12px 40px', color: '#f8fafc', fontFamily: 'var(--font-sans)', outline: 'none', fontSize: '14px' }} required />
              </div>
            </div>

            <button type="submit" disabled={authLoading} className="btn-primary"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', justifyContent: 'center', marginTop: '12px' }}>
              {authLoading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Iniciar Sesión')}
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isRegistering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta aún?'}
            </span>{' '}
            <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: '600', cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline' }}>
              {isRegistering ? 'Inicia sesión aquí' : 'Regístrate aquí'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === RENDER DASHBOARD AND TABLE (OC or OS) ===
  const renderDashboardAndTable = (type) => {
    const filterProject = (o) => {
      if (selectedProject === 'all') return true;
      return getSimpleProject(o.proyecto) === selectedProject;
    };

    const projectFiltered = allGroupedOrders.filter(o => o.tipo_orden === type && filterProject(o));

    if (orders.length === 0) {
      return (
        <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
          <Info size={48} style={{ margin: '0 auto 16px', color: 'var(--color-primary)' }} />
          <h2 style={{ marginBottom: '8px' }}>No hay información registrada</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {isAdmin 
              ? 'Carga tus archivos Excel en la pestaña "Cargar Excel" para comenzar.'
              : 'Aún no hay datos disponibles. Contacta a un administrador para cargar información.'}
          </p>
          {isAdmin && (
            <button onClick={() => setActiveTab('upload')} className="btn-primary" style={{ margin: '0 auto' }}>
              <Upload size={18} />
              <span>Ir a Cargar Archivos</span>
            </button>
          )}
        </div>
      );
    }

    const stats = type === 'OC' ? dashboardStats.oc : dashboardStats.os;
    const accentColor = type === 'OC' ? 'var(--color-litoral)' : 'var(--color-sb)';
    const typeLabel = type === 'OC' ? 'Compra (OC)' : 'Servicio (OS)';

    const filteredForTable = projectFiltered.filter((order) => {
      const matchesSearch = 
        String(order.nro_orden).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.proveedor).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.ruc).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(order.gestor_compra).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.estado_facturacion && String(order.estado_facturacion).toLowerCase().includes(searchQuery.toLowerCase())) ||
        order.items.some(item => String(item.recurso).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = selectedStatus === 'all' || order.estado === selectedStatus;

      return matchesSearch && matchesStatus;
    });

    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    const currentOrders = filteredForTable.slice(indexOfFirst, indexOfLast);
    const totalPages = Math.ceil(filteredForTable.length / itemsPerPage);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div className="metric-card" style={{ '--card-accent-color': accentColor }}>
            <span className="metric-title">Gasto Total S/.</span>
            <span className="metric-value" style={{ fontSize: '22px' }}>{formatCurrency(stats.pen, 'PEN')}</span>
            <span className="metric-sub">{type === 'OC' ? 'Órdenes de Compra' : 'Órdenes de Servicio'}</span>
          </div>
          <div className="metric-card" style={{ '--card-accent-color': accentColor }}>
            <span className="metric-title">Gasto Total U$</span>
            <span className="metric-value" style={{ fontSize: '22px' }}>{formatCurrency(stats.usd, 'USD')}</span>
            <span className="metric-sub">En dólares americanos</span>
          </div>
          <div className="metric-card" style={{ '--card-accent-color': accentColor }}>
            <span className="metric-title">Cantidad de Órdenes</span>
            <span className="metric-value">{stats.count}</span>
            <span className="metric-sub">Órdenes únicas ({type})</span>
          </div>
          <div className="metric-card" style={{ '--card-accent-color': 'var(--color-success)' }}>
            <span className="metric-title">Proveedores únicos</span>
            <span className="metric-value">{new Set(projectFiltered.map(o => o.proveedor)).size}</span>
            <span className="metric-sub">{type === 'OC' ? 'Proveedores activos' : 'Socios de negocio'}</span>
          </div>
        </div>

        {/* CHARTS (Reduced size to focus on data) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          
          {/* Top Suppliers Chart */}
          <div className="chart-card" style={{ gridColumn: 'span 2', padding: '16px' }}>
            <div className="chart-header" style={{ marginBottom: '8px' }}>
              <h3 className="chart-title" style={{ fontSize: '13px', textTransform: 'uppercase' }}>
                Top Proveedores (Gasto U$)
              </h3>
              <Users size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ height: '140px', width: '100%' }}>
              {stats.topProviders.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>Sin información</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    layout="vertical" 
                    data={stats.topProviders} 
                    margin={{ top: 0, right: 30, left: 80, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                      width={80}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val) => [formatCurrency(val, 'USD'), 'Gasto Eq.']}
                    />
                    <Bar dataKey="val" radius={[0, 2, 2, 0]} barSize={12}>
                      {stats.topProviders.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={accentColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Project Distribution */}
          <div className="chart-card" style={{ padding: '16px' }}>
            <div className="chart-header" style={{ marginBottom: '8px' }}>
              <h3 className="chart-title" style={{ fontSize: '13px', textTransform: 'uppercase' }}>Distribución</h3>
              <Activity size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div style={{ height: '140px', width: '100%' }}>
              {Object.entries(stats.projectSpend).every(([_, v]) => v === 0) ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '12px' }}>Sin información</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.projectSpend)
                        .filter(([proj, val]) => val > 0 && proj !== 'OTRO')
                        .map(([name, value]) => ({ name, value }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(stats.projectSpend)
                        .filter(([proj, val]) => val > 0 && proj !== 'OTRO')
                        .map(([proj], index) => (
                          <Cell key={`cell-${index}`} fill={getProjectColor(proj)} />
                        ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '11px' }}
                      formatter={(val) => [formatCurrency(val, 'USD'), 'Monto']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* LIST & FILTER SECTOR */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              Listado de Órdenes de {typeLabel}
            </h3>
            <button 
              onClick={() => exportOrdersToXLSX(type)}
              className="btn-primary" 
              style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '8px', backgroundColor: 'var(--color-success)' }}
            >
              <Download size={14} />
              <span>Exportar Excel</span>
            </button>
          </div>

          <section className="filter-bar" style={{ marginBottom: '20px' }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                className="search-input" 
                placeholder={`Buscar por orden, ${type === 'OC' ? 'proveedor' : 'socio de negocio'}, RUC, gestor o ítem...`}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div className="filter-options">
              <select className="filter-select" value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}>
                <option value="all">Todos los Estados</option>
                {[...new Set(projectFiltered.map(o => o.estado).filter(Boolean))].map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <select className="filter-select"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') setSearchQuery('');
                  else setSearchQuery(val);
                  setCurrentPage(1);
                }}>
                <option value="all">Todos los Estados Facturación</option>
                {[...new Set(projectFiltered.map(o => o.estado_facturacion).filter(Boolean))].map(est => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>
          </section>

          {filteredForTable.length === 0 ? (
            <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
              <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: 'var(--color-warning)' }} />
              <h2>No se encontraron resultados</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Ajusta tus filtros o ingresa otra palabra clave.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nro Orden</th>
                    <th>Proyecto</th>
                    <th>Proveedor</th>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Items</th>
                    <th style={{ textAlign: 'right' }}>Monto Total</th>
                    <th style={{ textAlign: 'center' }}>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const sp = getSimpleProject(order.proyecto);
                    const projectBadgeClass = `badge badge-${sp.toLowerCase()}`;
                    
                    return (
                      <React.Fragment key={order.id}>
                        <tr className={isExpanded ? 'expanded' : ''}>
                          <td><strong>{order.nro_orden}</strong></td>
                          <td>
                            <span className={projectBadgeClass}>{sp}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: '500' }}>{order.proveedor}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RUC: {order.ruc}</span>
                          </td>
                          <td>{order.fecha}</td>
                          <td style={{ textAlign: 'right' }}>{order.items.length}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {formatCurrency(order.total_con_igv, order.moneda)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => {
                              setExpandedOrderId(isExpanded ? null : order.id);
                              setInnerSearch(''); // Reset search when switching orders
                            }}
                              className="btn-outline" style={{ padding: '4px 8px', border: 'none' }}>
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Row: Focus exclusively on Resources */}
                        {isExpanded && (
                          <tr className="details-row">
                            <td colSpan="7">
                              <div className="details-wrapper" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                  <h4 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Recursos de la Orden {order.nro_orden}
                                  </h4>
                                  
                                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div className="search-input-wrapper" style={{ minWidth: '240px' }}>
                                      <Search size={14} className="search-icon" style={{ left: '12px' }} />
                                      <input 
                                        type="text" 
                                        className="search-input" 
                                        placeholder="Filtrar recursos de esta orden..."
                                        value={innerSearch}
                                        onChange={(e) => setInnerSearch(e.target.value)}
                                        style={{ padding: '8px 12px 8px 32px', fontSize: '12px', height: '32px' }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Archivo: {order.archivo_origen}</span>
                                  </div>
                                </div>

                                <table className="items-table">
                                  <thead>
                                    <tr>
                                      <th>Descripción Recurso</th>
                                      <th style={{ textAlign: 'center' }}>Und.</th>
                                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                                      <th style={{ textAlign: 'right' }}>P. Unit c/IGV</th>
                                      <th style={{ textAlign: 'right' }}>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items
                                      .filter(item => String(item.recurso).toLowerCase().includes(innerSearch.toLowerCase()))
                                      .map((item, idx) => (
                                      <tr key={item.id || idx}>
                                        <td style={{ fontWeight: '600', padding: '12px', lineHeight: '1.4', whiteSpace: 'normal' }}>{item.recurso}</td>
                                        <td style={{ textAlign: 'center' }}>{item.unidad}</td>
                                        <td style={{ textAlign: 'right' }}>{item.cantidad.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                          <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>{order.moneda}</span>
                                          {item.precio_con_igv.toFixed(2)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                          <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>{order.moneda}</span>
                                          {item.total.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                        </td>
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
            </div>                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '16px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Mostrando {indexOfFirst + 1} - {Math.min(indexOfLast, filteredForTable.length)} de {filteredForTable.length} órdenes
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="pagination-btn">Anterior</button>
                <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', padding: '0 8px' }}>
                  Página {currentPage} de {totalPages}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="pagination-btn">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // === RENDER LOGISTICS DASHBOARD ===
  const renderLogisticsDashboard = () => {
    if (orders.length === 0) {
      return (
        <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
          <Package size={48} style={{ margin: '0 auto 16px', color: 'var(--color-sunny)' }} />
          <h2 style={{ marginBottom: '8px' }}>Sin datos para análisis logístico</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Carga tus archivos Excel primero para analizar precios y productos.
          </p>
        </div>
      );
    }

    const logItemsPerPage = 25;
    const totalLogPages = Math.ceil(logisticsData.length / logItemsPerPage);
    const logStart = (logisticPage - 1) * logItemsPerPage;
    const logEnd = logStart + logItemsPerPage;
    const currentLogItems = logisticsData.slice(logStart, logEnd);

    // Emoji maps
    const macroEmoji = {
      'MATERIALES': '🧱',
      'SERVICIOS Y SUBCONTRATOS': '👷',
      'ACTIVOS Y EQUIPOS': '🚜'
    };

    const catEmoji = {
      'CONCRETO Y AGREGADOS': '🪨',
      'ACERO Y METALES': '⚙️',
      'MADERA Y DERIVADOS': '🪵',
      'ELECTRICIDAD': '⚡',
      'SANITARIAS': '🚿',
      'SEGURIDAD Y EPP': '🦺',
      'HERRAMIENTAS': '🛠️',
      'FLETES Y MOVILIDAD': '🚛',
      'ALQUILER DE EQUIPOS': '🏗️',
      'COMBUSTIBLES': '⛽',
      'ÚTILES Y OFICINA': '📄',
      'ALBAÑILERÍA Y ACABADOS': '🧱',
      'OTROS / GENERAL': '📦'
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* === STEP 1: MACRO CATEGORY SELECTOR === */}
        <div className="animate-fade-in">
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            1. Selecciona Grupo Principal
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {macroSummary.map(mac => {
              const isActive = selectedMacro === mac.name;
              return (
                <div 
                  key={mac.name}
                  className={`category-card ${isActive ? 'active' : ''}`}
                  onClick={() => { setSelectedMacro(isActive ? 'all' : mac.name); setSelectedCategory('all'); setLogisticPage(1); }}
                  style={{ padding: '24px', borderLeft: isActive ? '4px solid var(--color-primary)' : '1px solid var(--border-color)' }}
                >
                  <div className="category-icon-wrapper">
                    <span style={{ fontSize: '32px' }}>{macroEmoji[mac.name] || '📦'}</span>
                    <span className="category-count">{mac.count}</span>
                  </div>
                  <div className="category-name" style={{ fontSize: '15px' }}>{mac.name}</div>
                  <div className="category-amount">{formatCurrency(mac.totalComprado, 'PEN')}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === STEP 2: SUB-FAMILY SELECTOR (Conditional) === */}
        {(selectedMacro !== 'all' || categorySummary.length < 10) && (
          <div className="animate-fade-in">
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              2. Filtra por Familia Detallada
            </h3>
            <div className="category-grid">
              {categorySummary.map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <div 
                    key={cat.name}
                    className={`category-card ${isActive ? 'active' : ''}`}
                    onClick={() => { setSelectedCategory(isActive ? 'all' : cat.name); setLogisticPage(1); }}
                    style={{ padding: '16px' }}
                  >
                    <div className="category-icon-wrapper">
                      <span className="category-emoji">{catEmoji[cat.name] || '📦'}</span>
                      <span className="category-count" style={{ scale: '0.8' }}>{cat.count}</span>
                    </div>
                    <div className="category-name" style={{ fontSize: '11px' }}>{cat.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters & Table */}
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              Análisis Detallado de Precios 
              {selectedMacro !== 'all' && <span style={{ color: 'var(--color-primary)', marginLeft: '8px' }}>/ {selectedMacro}</span>}
              {selectedCategory !== 'all' && <span style={{ color: 'var(--color-sunny)', marginLeft: '4px' }}>/ {selectedCategory}</span>}
            </h3>
            <button onClick={exportLogisticsToXLSX} className="btn-primary" style={{ backgroundColor: 'var(--color-success)' }}>
              <Download size={14} />
              <span>Exportar Excel</span>
            </button>
          </div>

          <section className="filter-bar" style={{ marginBottom: '20px' }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input type="text" className="search-input"
                placeholder="Buscar recurso específico..."
                value={logisticSearch}
                onChange={(e) => { setLogisticSearch(e.target.value); setLogisticPage(1); }} />
            </div>
            <div className="filter-options">
              <select className="filter-select" value={logisticSort}
                onChange={(e) => { setLogisticSort(e.target.value); setLogisticPage(1); }}>
                <option value="total">Mayor Inversión</option>
                <option value="variacion">Mayor Variación %</option>
                <option value="nombre">A-Z Nombre</option>
                <option value="precio_min">Menor Precio</option>
              </select>
            </div>
          </section>

          {currentLogItems.length === 0 ? (
            <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
              <AlertTriangle size={48} style={{ margin: '0 auto 16px', color: 'var(--color-warning)' }} />
              <h2>No se encontraron recursos</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Intenta cambiar los filtros de familia o grupo.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Familia</th>
                    <th>Descripción del Recurso</th>
                    <th style={{ textAlign: 'center' }}>Und.</th>
                    <th style={{ textAlign: 'right' }}>Precio Mín c/IGV</th>
                    <th style={{ textAlign: 'right' }}>Precio Máx c/IGV</th>
                    <th style={{ textAlign: 'center' }}>Variación</th>
                    <th style={{ textAlign: 'right' }}>Total Invertido</th>
                    <th style={{ textAlign: 'center' }}>Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogItems.map((product, idx) => {
                    const isExpanded = expandedOrderId === `log-${product.recurso}`;
                    const varColor = product.variacionPct > 30 ? 'var(--color-danger)' : product.variacionPct > 10 ? 'var(--color-warning)' : 'var(--color-success)';
                    
                    return (
                      <React.Fragment key={product.recurso}>
                        <tr className={isExpanded ? 'expanded' : ''}>
                          <td>
                            <span style={{ fontSize: '10px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontWeight: '700', whiteSpace: 'normal', display: 'block', marginBottom: '4px' }}>
                              {product.macro}
                            </span>
                            <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase' }}>
                              {catEmoji[product.sub] || '📦'} {product.sub}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600', padding: '16px 12px', lineHeight: '1.4' }}>
                            {product.recurso}
                          </td>
                          <td style={{ textAlign: 'center' }}>{product.unidad}</td>
                          <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: '700' }}>
                            <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>{product.moneda}</span>
                            {product.precioMin.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--color-danger)', fontWeight: '700' }}>
                            <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>{product.moneda}</span>
                            {product.precioMax.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge" style={{ backgroundColor: varColor + '20', color: varColor, border: '1px solid ' + varColor + '40' }}>
                              {product.variacionPct.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {formatCurrency(product.totalComprado, 'PEN')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button onClick={() => setExpandedOrderId(isExpanded ? null : `log-${product.recurso}`)}
                              className="btn-outline" style={{ padding: '4px 8px', border: 'none' }}>
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="details-row">
                            <td colSpan="8">
                              <div className="details-wrapper" style={{ padding: '0 20px 20px' }}>
                                <table className="items-table" style={{ marginTop: '0' }}>
                                  <thead>
                                    <tr>
                                      <th>Proveedor</th>
                                      <th style={{ textAlign: 'center' }}>Proyecto</th>
                                      <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                                      <th style={{ textAlign: 'center' }}>Fecha</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {product.ordenes.map((ord, i) => (
                                      <tr key={i}>
                                        <td>{ord.proveedor}</td>
                                        <td style={{ textAlign: 'center' }}><span className={`badge badge-${ord.proyecto.toLowerCase()}`}>{ord.proyecto}</span></td>
                                        <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                          <span style={{ fontSize: '10px', opacity: 0.6, marginRight: '4px' }}>{ord.moneda}</span>
                                          {ord.precio_con_igv.toFixed(2)}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{ord.cantidad}</td>
                                        <td style={{ textAlign: 'center' }}>{ord.fecha}</td>
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
            </div>
          )}

          {totalLogPages > 1 && (
            <div className="pagination" style={{ marginTop: '16px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Mostrando {logStart + 1} - {Math.min(logEnd, logisticsData.length)} de {logisticsData.length} recursos
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setLogisticPage(p => Math.max(1, p - 1))} disabled={logisticPage === 1} className="pagination-btn">Anterior</button>
                <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', padding: '0 8px' }}>
                  Página {logisticPage} de {totalLogPages}
                </span>
                <button onClick={() => setLogisticPage(p => Math.min(totalLogPages, p + 1))} disabled={logisticPage === totalLogPages} className="pagination-btn">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // === RENDER USERS TAB ===
  const renderUsersTab = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '700', margin: 0 }}>
            Gestión de Usuarios y Accesos
          </h3>
          <button className="btn-primary" onClick={() => alert('Función para invitar nuevos usuarios (requiere backend)')}>
            <Users size={18} />
            <span>Invitar Usuario</span>
          </button>
        </div>

        <div className="user-management-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Usuarios Activos</h4>
            <div className="user-card">
              <div className="user-avatar">
                <User size={24} />
              </div>
              <div className="user-info">
                <div className="user-email">{userEmail}</div>
                <div className="user-role">Superadministrador (Tú)</div>
              </div>
              <div className="badge status-aprobado" style={{ fontSize: '10px' }}>ACTIVO</div>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 8px' }}>
              Nota: En esta versión beta, el acceso está limitado a la lista blanca de correos definidos en el sistema.
            </p>
          </div>

          <div className="chart-card">
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Permisos del Sistema</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <Shield size={20} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>Superadministrador</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Carga de Excel, eliminación de datos, gestión de usuarios y acceso total a reportes logísticos.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <Users size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>Colaborador</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Solo lectura de tableros (OC/OS) y análisis logístico. No puede modificar la base de datos.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // === RENDER ORIGIN FILES TAB ===
  const renderOriginFilesTab = () => {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: '700', margin: 0 }}>
            Archivos Matriz (Originales)
          </h3>
          <button className="btn-outline" onClick={fetchOriginFiles}>
            <Activity size={18} />
            <span>Actualizar Lista</span>
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Desde aquí puedes descargar los archivos Excel originales que se utilizaron para alimentar este tablero.
        </p>

        {originFiles.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
            <Database size={48} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <p>No se encontraron archivos en el almacenamiento de la nube.</p>
          </div>
        ) : (
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {originFiles.map((file) => (
              <div key={file.id} className="file-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="logo-icon" style={{ width: '40px', height: '40px', background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{file.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subido: {new Date(file.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const { data, error } = await supabase.storage.from('matrix-files').download(file.name);
                    if (error) {
                      alert('Error al descargar: ' + error.message);
                    } else {
                      const url = window.URL.createObjectURL(data);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = file.name;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }
                  }}
                  className="btn-primary" 
                  style={{ padding: '8px 12px', fontSize: '12px' }}
                >
                  <Download size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="app-container">
      {/* Sidebar */}
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
              <button className={`nav-item ${activeTab === 'oc' ? 'active' : ''}`}
                onClick={() => { setActiveTab('oc'); setCurrentPage(1); setExpandedOrderId(null); }}>
                <ShoppingBag size={20} />
                <span>Órdenes de Compra</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'os' ? 'active' : ''}`}
                onClick={() => { setActiveTab('os'); setCurrentPage(1); setExpandedOrderId(null); }}>
                <Briefcase size={20} />
                <span>Órdenes de Servicio</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'logistics' ? 'active' : ''}`}
                onClick={() => { setActiveTab('logistics'); setExpandedOrderId(null); }}>
                <Package size={20} />
                <span>Análisis Logístico</span>
              </button>
            </li>
            <li>
              <button className={`nav-item ${activeTab === 'storage' ? 'active' : ''}`}
                onClick={() => { setActiveTab('storage'); fetchOriginFiles(); }}>
                <Database size={20} />
                <span>Archivos de Origen</span>
              </button>
            </li>
            {isAdmin && (
              <li>
                <button className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}>
                  <Shield size={20} />
                  <span>Usuarios</span>
                </button>
              </li>
            )}
            {isAdmin && (
              <li>
                <button className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setActiveTab('upload')}>
                  <Upload size={20} />
                  <span>Cargar Excel</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          {isSupabaseConfigured && session && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isAdmin ? 'rgba(245,158,11,0.15)' : 'var(--color-primary-glow)', border: `1px solid ${isAdmin ? 'var(--color-warning)' : 'var(--color-primary)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isAdmin ? <Shield size={16} style={{ color: 'var(--color-warning)' }} /> : <User size={16} style={{ color: 'var(--color-primary)' }} />}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {session.user.email}
                  </div>
                  <span style={{ fontSize: '10px', color: isAdmin ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: '700', textTransform: 'uppercase' }}>
                    {isAdmin ? '⭐ Superadmin' : 'Colaborador'}
                  </span>
                </div>
              </div>
              <button onClick={handleSignOut}
                style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px' }}>
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

      {/* Main Panel */}
      <main className="main-content">
        
        {/* Header */}
        <header className="page-header">
          <div>
            <h1 className="header-title" id="main-heading">
              {activeTab === 'oc' && 'Órdenes de Compra (OC)'}
              {activeTab === 'os' && 'Órdenes de Servicio (OS)'}
              {activeTab === 'logistics' && 'Análisis Logístico de Precios'}
              {activeTab === 'upload' && 'Importación de Archivos'}
            </h1>
            <p className="header-meta">
              Padova SAC · Proyectos: Litoral, SB y Sunny · {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Project Quick Selector */}
            {(activeTab === 'oc' || activeTab === 'os') && orders.length > 0 && (
              <select className="filter-select" value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setCurrentPage(1); }}
                style={{ height: '40px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: '600' }}>
                <option value="all">Todos los Proyectos</option>
                <option value="LITORAL">LITORAL</option>
                <option value="SB">SB</option>
                <option value="SUNNY">SUNNY</option>
              </select>
            )}

            {isSupabaseConfigured ? (
              <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px' }}>
                <Cloud size={16} />
                <span style={{ fontWeight: '600', fontSize: '12px' }}>En Línea</span>
              </span>
            ) : (
              <span className="badge" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px' }}>
                <Database size={16} />
                <span style={{ fontWeight: '600', fontSize: '12px' }}>Local</span>
              </span>
            )}
          </div>
        </header>

        {loading ? (
          <div className="loader-wrapper">
            <div className="spinner"></div>
            <p>Cargando y conectando con el servidor...</p>
          </div>
        ) : (
          <>
            {activeTab === 'oc' && renderDashboardAndTable('OC')}
            {activeTab === 'os' && renderDashboardAndTable('OS')}
            {activeTab === 'logistics' && renderLogisticsDashboard()}
            {activeTab === 'storage' && renderOriginFilesTab()}
            {activeTab === 'users' && renderUsersTab()}

            {/* Upload Tab (Admins only) */}
            {activeTab === 'upload' && isAdmin && (
              <div className="upload-container">
                {/* Sync status alert */}
                {syncStatus !== 'idle' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '500',
                    backgroundColor: syncStatus === 'syncing' ? 'rgba(37, 99, 235, 0.1)' : syncStatus === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid ' + (syncStatus === 'syncing' ? 'rgba(37, 99, 235, 0.2)' : syncStatus === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                    color: syncStatus === 'syncing' ? '#60a5fa' : syncStatus === 'success' ? '#34d399' : '#f87171'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {syncStatus === 'syncing' && <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', animationDuration: '0.6s' }}></div>}
                      {syncStatus === 'success' && <CheckCircle size={18} />}
                      {syncStatus === 'error' && <AlertTriangle size={18} />}
                      <span>
                        {syncStatus === 'syncing' && 'Procesando y sincronizando archivos...'}
                        {syncStatus === 'success' && '¡Archivos cargados y sincronizados correctamente!'}
                        {syncStatus === 'error' && 'Error al guardar los archivos. Revisa la consola.'}
                      </span>
                    </div>
                    <button onClick={() => setSyncStatus('idle')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '12px', opacity: 0.8 }}>
                      ✕
                    </button>
                  </div>
                )}

                {/* Admin badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', fontSize: '13px', color: 'var(--color-warning)' }}>
                  <Shield size={16} />
                  <span><strong>Acceso Superadmin:</strong> Solo tú puedes cargar y eliminar datos. Los demás usuarios solo pueden visualizar.</span>
                </div>

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
                    Soporta archivos individuales (OC - LITORAL.XLSX, OS SB.XLSX, etc.) o consolidado DETALLES.xlsx. El sistema detecta automáticamente si es OC u OS por el nombre del archivo y las pestañas.
                  </p>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={handleFileChange} accept=".xlsx, .xls" />
                </div>

                {filesLog.length > 0 && (
                  <div className="file-list-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px' }}>
                        Archivos registrados en la nube ({filesLog.length})
                      </h3>
                      <button onClick={handleClearDatabase} className="btn-primary" style={{ backgroundColor: 'var(--color-danger)' }} id="btn-clear-db">
                        <Trash2 size={16} />
                        <span>Vaciar Base de Datos</span>
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
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button 
                              onClick={() => {
                                // Extract rows belonging to this specific file name
                                const fileData = orders.filter(o => o.archivo_origen === file.name || file.name.includes(o.archivo_origen));
                                if (fileData.length > 0) {
                                  exportToXLSX(fileData, `Exportado_${file.name}.xlsx`, file.type);
                                } else {
                                  alert('No se encontraron registros para descargar en este archivo.');
                                }
                              }}
                              className="btn-outline" 
                              style={{ padding: '6px 12px', fontSize: '11px', height: '32px' }}
                            >
                              <Download size={14} />
                              <span>Descargar Excel</span>
                            </button>
                            <div className="file-status success">
                              <CheckCircle size={16} />
                              <span>{file.rowCount} Registros</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-admin trying to access upload */}
            {activeTab === 'upload' && !isAdmin && (
              <div className="chart-card" style={{ textAlign: 'center', padding: '48px' }}>
                <Shield size={48} style={{ margin: '0 auto 16px', color: 'var(--color-warning)' }} />
                <h2 style={{ marginBottom: '8px' }}>Acceso restringido</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Solo los superadministradores pueden cargar archivos. Contacta a yleon@padovasac.com para más información.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
