import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, X, Settings, Home, PieChart, List, Calendar, FileText, Filter, BookOpen, Lock, User, ShieldAlert, Printer, ChevronDown, ChevronUp, Key, Download, Edit, Search, Upload, ChevronLeft, ChevronRight } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ACCOUNTS = {
  'quanly': { defaultPassword: 'quanly@11231', role: 'admin', displayName: 'Quản Lý' },
  'nhanvien1': { defaultPassword: 'msthuy1191#', role: 'staff', displayName: 'Ms. Thuỷ' },
  'nhanvien2': { defaultPassword: 'msngoc11933#', role: 'staff', displayName: 'Ms. Ngọc' }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const [projects, setProjects] = useState(() => JSON.parse(localStorage.getItem('stc_projects') || '[]'));
  const [transactions, setTransactions] = useState(() => JSON.parse(localStorage.getItem('stc_transactions') || '[]'));
  const [templates, setTemplates] = useState(() => JSON.parse(localStorage.getItem('stc_templates') || '[]'));
  const [categories, setCategories] = useState(() => {
    const localCat = localStorage.getItem('stc_categories');
    return localCat ? JSON.parse(localCat) : [
      { id: '1', name: 'Điện nước cửa hàng', type: 'expense' },
      { id: '2', name: 'Nhập hàng & Mua hộ', type: 'expense' },
      { id: '3', name: 'Trang thiết bị & Sửa chữa', type: 'expense' },
      { id: '4', name: 'Vật liệu đóng gói', type: 'expense' },
      { id: '5', name: 'Phí giao hàng & Taxi', type: 'expense' },
      { id: '6', name: 'Lương quản lý (Mẹ)', type: 'expense' },
      { id: '7', name: 'Bán hàng hàng ngày', type: 'income' },
      { id: '8', name: 'Thu khác', type: 'income' }
    ];
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null); 
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false); 
  const [showExportModal, setShowExportModal] = useState(false); // Modal xuất Excel
  
  const [transactionToPrint, setTransactionToPrint] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [dateFilter, setDateFilter] = useState('all');
  const [chartGroup, setChartGroup] = useState('month');
  const [uncheckedCategories, setUncheckedCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Trạng thái phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;
  const MAX_DISPLAY_ITEMS = 300;

  useEffect(() => {
    const savedUser = sessionStorage.getItem('stc_current_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [projects]);

  // Đặt lại trang 1 nếu đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, searchTerm, selectedProjectId]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const uid = usernameInput.toLowerCase().trim();
    const userAcc = ACCOUNTS[uid];
    if (!userAcc) return alert('Tên đăng nhập không tồn tại!');
    let activePassword = userAcc.defaultPassword;
    if (supabase) {
      try {
        const { data } = await supabase.from('app_users').select('password').eq('username', uid).single();
        if (data && data.password) activePassword = data.password;
      } catch (err) { console.error("Lỗi kiểm tra pass", err); }
    }
    if (passwordInput === activePassword) {
      const userSession = { username: uid, role: userAcc.role, displayName: userAcc.displayName };
      setCurrentUser(userSession);
      sessionStorage.setItem('stc_current_user', JSON.stringify(userSession));
    } else { alert('Mật khẩu không chính xác!'); setPasswordInput(''); }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('stc_current_user');
  };

  useEffect(() => { if (currentUser) fetchData(); }, [currentUser]);

  // Kéo toàn bộ data bằng Loop để Chart/Thống kê đầy đủ
  const fetchData = async () => {
    if (supabase) {
      try {
        const [{ data: pData }, { data: tmplData }, { data: catData }] = await Promise.all([
          supabase.from('projects').select('*'),
          supabase.from('templates').select('*'),
          supabase.from('custom_categories').select('*')
        ]);
        
        let allTx = [];
        let from = 0;
        const step = 1000; 
        let fetchMore = true;

        while (fetchMore) {
          const { data: tData, error } = await supabase.from('transactions').select('*').range(from, from + step - 1).order('date', { ascending: false });
          if (error) break;
          if (tData && tData.length > 0) {
            allTx = [...allTx, ...tData];
            from += step;
            if (tData.length < step) fetchMore = false;
          } else {
            fetchMore = false; 
          }
        }
        
        if (pData) { setProjects(pData); localStorage.setItem('stc_projects', JSON.stringify(pData)); }
        if (allTx.length > 0) { setTransactions(allTx); localStorage.setItem('stc_transactions', JSON.stringify(allTx)); }
        if (tmplData) { setTemplates(tmplData); localStorage.setItem('stc_templates', JSON.stringify(tmplData)); }
        if (catData && catData.length > 0) { setCategories(catData); localStorage.setItem('stc_categories', JSON.stringify(catData)); }
      } catch (error) { console.error("Lỗi tải data", error); }
    }
  };

  const formatCurrency = (val) => {
    if (!val) return '';
    const num = parseInt(val.toString().replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString('en-US');
  };

  const getNumber = (val) => parseInt(val?.toString().replace(/,/g, '')) || 0;
  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

  // Lọc và Sắp xếp: Ưu tiên ngày Giao dịch > Ngày tạo (Mới nhất lên đầu)
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => t.project_id === selectedProjectId);
    const today = new Date();
    if (dateFilter === 'today') filtered = filtered.filter(t => t.date === today.toISOString().split('T')[0]);
    else if (dateFilter === 'month') filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 7)));
    else if (dateFilter === 'year') filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 4)));
    
    return filtered.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [transactions, selectedProjectId, dateFilter]);

  // Khắc phục lỗi tìm kiếm Ghi chú (Kiểm tra null)
  const displayTransactions = useMemo(() => {
    if (!searchTerm.trim()) return filteredTransactions;
    const lower = searchTerm.toLowerCase();
    return filteredTransactions.filter(t => 
      ((t.description || '').toLowerCase().includes(lower)) || 
      ((t.category || '').toLowerCase().includes(lower)) ||
      ((t.created_by || '').toLowerCase().includes(lower)) ||
      (t.amount.toString().includes(lower))
    );
  }, [filteredTransactions, searchTerm]);

  // Dashboard chỉ tính các danh mục không bị ẩn
  const activeTransactionsForDashboard = useMemo(() => {
    return displayTransactions.filter(t => !uncheckedCategories.includes(t.category));
  }, [displayTransactions, uncheckedCategories]);

  const summary = useMemo(() => activeTransactionsForDashboard.reduce((acc, curr) => {
    curr.type === 'income' ? acc.income += curr.amount : acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 }), [activeTransactionsForDashboard]);

  const chartData = useMemo(() => {
    const grouped = {};
    activeTransactionsForDashboard.forEach(t => {
      let key = t.date;
      if (chartGroup === 'month') key = t.date.slice(0, 7);
      if (chartGroup === 'year') key = t.date.slice(0, 4);
      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0 };
      grouped[key][t.type] += t.amount;
    });
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeTransactionsForDashboard, chartGroup]);

  // === LOGIC PHÂN TRANG (Tối đa 300 kết quả, 30 items/trang) ===
  const paginatedData = useMemo(() => {
    const limitedData = displayTransactions.slice(0, MAX_DISPLAY_ITEMS);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return {
      items: limitedData.slice(startIndex, startIndex + ITEMS_PER_PAGE),
      totalPages: Math.ceil(limitedData.length / ITEMS_PER_PAGE),
      totalLimited: limitedData.length,
      isCapped: displayTransactions.length > MAX_DISPLAY_ITEMS
    };
  }, [displayTransactions, currentPage]);

  const checkAdmin = () => {
    if (currentUser?.role !== 'admin') { alert('Chỉ tài khoản Quản Lý mới có quyền thao tác này!'); return false; }
    return true;
  };

  const handleAddProject = async (name) => {
    if(!name) return;
    const newP = { id: generateId(), name, created_at: new Date().toISOString() };
    const updated = [...projects, newP];
    setProjects(updated); localStorage.setItem('stc_projects', JSON.stringify(updated));
    if (supabase) { await supabase.from('projects').insert([newP]); fetchData(); } 
    if (!selectedProjectId) setSelectedProjectId(newP.id);
  };

  const handleDeleteProject = async (id) => {
    if (!checkAdmin()) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa Sổ này?')) {
      const updatedP = projects.filter(p => p.id !== id);
      const updatedT = transactions.filter(t => t.project_id !== id);
      setProjects(updatedP); setTransactions(updatedT);
      localStorage.setItem('stc_projects', JSON.stringify(updatedP));
      localStorage.setItem('stc_transactions', JSON.stringify(updatedT));
      if (supabase) { await supabase.from('projects').delete().eq('id', id); fetchData(); } 
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (window.confirm('Xóa giao dịch này?')) {
      const updated = transactions.filter(tx => tx.id !== id);
      setTransactions(updated); localStorage.setItem('stc_transactions', JSON.stringify(updated));
      if (supabase) { await supabase.from('transactions').delete().eq('id', id); fetchData(); }
    }
  };

  const handleAddCategory = async (name, type) => {
    if(!name) return;
    const newC = { id: generateId(), name, type, created_at: new Date().toISOString() };
    const updated = [...categories, newC];
    setCategories(updated); localStorage.setItem('stc_categories', JSON.stringify(updated));
    if (supabase) { await supabase.from('custom_categories').insert([newC]); fetchData(); } 
  };

  const handleDeleteCategory = async (id) => {
    if (!checkAdmin()) return;
    if (window.confirm('Xóa danh mục này? Các giao dịch cũ vẫn giữ giá trị nhưng mất phân loại.')) {
      const updated = categories.filter(c => c.id !== id);
      setCategories(updated); localStorage.setItem('stc_categories', JSON.stringify(updated));
      if (supabase) { await supabase.from('custom_categories').delete().eq('id', id); fetchData(); } 
    }
  };

  const handleAddTemplate = async (tmpl) => {
    const newTmpl = { ...tmpl, id: generateId(), created_at: new Date().toISOString() };
    const updated = [...templates, newTmpl];
    setTemplates(updated); localStorage.setItem('stc_templates', JSON.stringify(updated));
    if (supabase) { await supabase.from('templates').insert([newTmpl]); fetchData(); } 
  };

  const handleDeleteTemplate = async (id) => {
    if (!checkAdmin()) return;
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated); localStorage.setItem('stc_templates', JSON.stringify(updated));
    if (supabase) { await supabase.from('templates').delete().eq('id', id); fetchData(); } 
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!checkAdmin()) { e.target.value = null; return; }
    if (!selectedProjectId) { alert('Vui lòng chọn một Sổ!'); e.target.value = null; return; }
    if (!window.confirm(`Nhập hàng loạt từ "${file.name}" vào sổ hiện tại?`)) { e.target.value = null; return; }
    
    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let newTransactions = [];
        let newCatsMap = new Map();
        
        data.forEach(row => {
          let thu = getNumber(row['Tiền Thu (VNĐ)']);
          let chi = getNumber(row['Tiền Chi (VNĐ)']);
          let amount = 0, type = 'expense';
          if (thu > 0) { amount = thu; type = 'income'; }
          else if (chi > 0) { amount = chi; type = 'expense'; }
          else return; 
          
          let txDate = new Date().toISOString().split('T')[0];
          if (row['Ngày']) {
            if (row['Ngày'] instanceof Date) {
              const y = row['Ngày'].getFullYear(), m = String(row['Ngày'].getMonth() + 1).padStart(2, '0'), d = String(row['Ngày'].getDate()).padStart(2, '0');
              txDate = `${y}-${m}-${d}`;
            } else if (typeof row['Ngày'] === 'string') { txDate = row['Ngày'].substring(0, 10); }
          }
          
          const catName = row['Danh Mục'] ? row['Danh Mục'].toString().trim() : 'Khác';
          const catKey = catName.toLowerCase();
          
          if (!categories.find(c => c.name.toLowerCase() === catKey) && !newCatsMap.has(catKey)) {
             newCatsMap.set(catKey, { id: generateId(), name: catName, type: type, created_at: new Date().toISOString() });
          }

          newTransactions.push({
            id: generateId(), project_id: selectedProjectId, type: type, amount: amount, date: txDate, category: catName,
            description: row['Ghi Chú'] ? row['Ghi Chú'].toString() : '',
            created_by: row['Người Nhập'] ? row['Người Nhập'].toString() : currentUser.displayName,
            created_at: new Date().toISOString() 
          });
        });
        
        if (newTransactions.length === 0) { alert('Không có dữ liệu hợp lệ!'); setIsImporting(false); e.target.value = null; return; }
        if (!window.confirm(`Tìm thấy ${newTransactions.length} giao dịch. Bắt đầu đẩy lên hệ thống?`)) { setIsImporting(false); e.target.value = null; return; }

        const newCatsArray = Array.from(newCatsMap.values());
        if (newCatsArray.length > 0) {
             if (supabase) await supabase.from('custom_categories').insert(newCatsArray);
             const updatedCats = [...categories, ...newCatsArray];
             setCategories(updatedCats); localStorage.setItem('stc_categories', JSON.stringify(updatedCats));
        }

        if (supabase) {
           const chunkSize = 500;
           for (let i = 0; i < newTransactions.length; i += chunkSize) {
               const chunk = newTransactions.slice(i, i + chunkSize);
               const { error } = await supabase.from('transactions').insert(chunk);
               if (error) { alert('Lỗi: ' + error.message); setIsImporting(false); e.target.value = null; return; }
           }
        }
        
        const updatedList = [...newTransactions, ...transactions];
        setTransactions(updatedList); localStorage.setItem('stc_transactions', JSON.stringify(updatedList));
        
        alert(`🎉 Đã nhập ${newTransactions.length} giao dịch.`);
        setIsImporting(false); e.target.value = null; 
      };
      reader.readAsBinaryString(file);
    } catch (err) { alert('Lỗi đọc Excel!'); setIsImporting(false); e.target.value = null; }
  };

  // === CỬA SỔ XUẤT EXCEL THÔNG MINH ===
  const ExportExcelModal = () => {
    const [exportType, setExportType] = useState('filter'); // filter, range, specific
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [specificType, setSpecificType] = useState('month'); // day, month, year
    const [specificValue, setSpecificValue] = useState(new Date().toISOString().slice(0, 7)); // default YYYY-MM

    const handleExecuteExport = async () => {
      let dataToExport = [];
      const projectTxs = transactions.filter(t => t.project_id === selectedProjectId);

      if (exportType === 'filter') {
        dataToExport = displayTransactions; // Dùng đúng dữ liệu đang lọc trên màn hình
      } else if (exportType === 'range') {
        if (!startDate || !endDate) return alert('Vui lòng chọn Ngày Bắt Đầu và Ngày Kết Thúc');
        if (startDate > endDate) return alert('Ngày bắt đầu không được lớn hơn ngày kết thúc');
        dataToExport = projectTxs.filter(t => t.date >= startDate && t.date <= endDate);
      } else if (exportType === 'specific') {
        if (!specificValue) return alert('Vui lòng nhập thời gian cụ thể');
        dataToExport = projectTxs.filter(t => t.date.startsWith(specificValue));
      }

      if (dataToExport.length === 0) {
        return alert('Không có dữ liệu giao dịch nào trong phạm vi bạn chọn!');
      }

      // Sắp xếp trước khi xuất
      dataToExport.sort((a, b) => new Date(b.date) - new Date(a.date));

      const XLSX = await import('xlsx');
      const excelData = dataToExport.map(t => ({
        'Ngày': t.date,
        'Giờ': new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        'Danh Mục': t.category,
        'Ghi Chú': t.description || '',
        'Người Nhập': t.created_by || 'Khuyết danh',
        'Tiền Thu (VNĐ)': t.type === 'income' ? t.amount : '',
        'Tiền Chi (VNĐ)': t.type === 'expense' ? t.amount : ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Giao_Dich");
      
      const fileName = `SoThuChi_${exportType === 'specific' ? specificValue : new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      setShowExportModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl">
          <div className="flex justify-between items-center mb-5 border-b pb-3"><h3 className="text-xl font-bold flex items-center gap-2"><Download className="text-green-600" /> Tùy chọn Xuất Excel</h3><button onClick={() => setShowExportModal(false)}><X className="text-gray-500 w-6 h-6" /></button></div>
          
          <div className="space-y-4 mb-6">
            <label className={`block p-3 border-2 rounded-lg cursor-pointer ${exportType === 'filter' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="expType" checked={exportType === 'filter'} onChange={() => setExportType('filter')} className="w-5 h-5 accent-blue-600" />
                <span className="font-bold text-gray-800">1. Xuất theo bộ lọc hiện tại</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 pl-8">Sẽ xuất {displayTransactions.length} giao dịch đang hiển thị ở bảng bên ngoài.</p>
            </label>

            <label className={`block p-3 border-2 rounded-lg cursor-pointer ${exportType === 'range' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <input type="radio" name="expType" checked={exportType === 'range'} onChange={() => setExportType('range')} className="w-5 h-5 accent-blue-600" />
                <span className="font-bold text-gray-800">2. Xuất theo khoảng thời gian</span>
              </div>
              {exportType === 'range' && (
                <div className="mt-3 pl-8 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm"><span className="w-16">Từ ngày:</span> <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-1.5 rounded flex-1" /></div>
                  <div className="flex items-center gap-2 text-sm"><span className="w-16">Đến ngày:</span> <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-1.5 rounded flex-1" /></div>
                </div>
              )}
            </label>

            <label className={`block p-3 border-2 rounded-lg cursor-pointer ${exportType === 'specific' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-2">
                <input type="radio" name="expType" checked={exportType === 'specific'} onChange={() => setExportType('specific')} className="w-5 h-5 accent-blue-600" />
                <span className="font-bold text-gray-800">3. Xuất theo Ngày / Tháng / Năm</span>
              </div>
              {exportType === 'specific' && (
                <div className="pl-8 flex flex-col gap-2">
                  <select value={specificType} onChange={e => { setSpecificType(e.target.value); setSpecificValue(''); }} className="w-full border p-2 rounded text-sm">
                    <option value="day">Theo Một Ngày Cụ Thể</option>
                    <option value="month">Theo Cả Tháng</option>
                    <option value="year">Theo Cả Năm</option>
                  </select>
                  {specificType === 'day' && <input type="date" value={specificValue} onChange={e => setSpecificValue(e.target.value)} className="w-full border p-2 rounded text-sm" />}
                  {specificType === 'month' && <input type="month" value={specificValue} onChange={e => setSpecificValue(e.target.value)} className="w-full border p-2 rounded text-sm" />}
                  {specificType === 'year' && <input type="number" placeholder="Nhập năm (VD: 2024)" value={specificValue} onChange={e => setSpecificValue(e.target.value)} className="w-full border p-2 rounded text-sm" min="2000" max="2100" />}
                </div>
              )}
            </label>
          </div>

          <div className="flex justify-end gap-3"><button onClick={() => setShowExportModal(false)} className="px-4 py-2 bg-gray-200 font-bold rounded-lg">Hủy</button><button onClick={handleExecuteExport} className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg flex items-center gap-2"><Download className="w-4 h-4" /> Tải File Excel</button></div>
        </div>
      </div>
    );
  };

  const ReceiptContent = ({ t }) => {
    if (!t) return null;
    const dateObj = new Date(t.created_at);
    const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return (
      <div className="w-full text-black font-serif bg-white p-4">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div><h2 className="font-extrabold text-lg uppercase">Công ty CP Văn hóa Duy Minh</h2><p className="text-sm font-bold text-gray-700">(S.A.CDM)</p></div>
          <div className="text-right"><p className="text-sm font-bold">Mẫu số: 01-TT</p><p className="text-xs italic text-gray-600">Ban hành theo Thông tư BTC</p></div>
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold uppercase mb-2">{t.type === 'income' ? 'PHIẾU THU' : 'PHIẾU CHI'}</h1>
          <p className="italic text-sm text-gray-700">Thời gian: {timeStr} - Ngày {dateStr}</p>
          <p className="text-sm text-gray-600 mt-1">Mã phiếu: #{t.id.toUpperCase()}</p>
        </div>
        <div className="space-y-4 text-base leading-relaxed mb-10 pl-2">
          <p><strong>Người thực hiện (Nhập liệu):</strong> {t.created_by || 'Khuyết danh'}</p>
          <p><strong>Danh mục {t.type === 'income' ? 'thu' : 'chi'}:</strong> {t.category}</p>
          <p><strong>Nội dung chi tiết:</strong> {t.description || '....................................................................'}</p>
          <div className="mt-6 p-4 border border-dashed border-gray-400 bg-gray-50 text-center"><span className="text-lg">Số tiền: </span><span className="text-2xl font-extrabold ml-2">{formatCurrency(t.amount)} VNĐ</span></div>
        </div>
        <div className="flex justify-between text-center mt-12 pb-20">
           <div className="w-1/3"><p className="font-bold text-sm">Người lập phiếu</p><p className="italic text-xs text-gray-500">(Ký, họ tên)</p><div className="mt-16 font-bold">{t.created_by || 'Khuyết danh'}</div></div>
           <div className="w-1/3"><p className="font-bold text-sm">Thủ quỹ</p><p className="italic text-xs text-gray-500">(Ký, họ tên)</p></div>
           <div className="w-1/3"><p className="font-bold text-sm">{t.type === 'income' ? 'Người nộp tiền' : 'Người nhận tiền'}</p><p className="italic text-xs text-gray-500">(Ký, họ tên)</p></div>
        </div>
      </div>
    );
  };

  const TransactionModal = ({ txToEdit, onClose }) => {
    const [txType, setTxType] = useState(txToEdit ? txToEdit.type : 'expense');
    const [amountStr, setAmountStr] = useState(txToEdit ? formatCurrency(txToEdit.amount) : '');
    const [date, setDate] = useState(txToEdit ? txToEdit.date : new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState(txToEdit ? txToEdit.category : categories.filter(c => c.type === 'expense')[0]?.name || '');
    const [desc, setDesc] = useState(txToEdit ? (txToEdit.description || '') : '');

    const applyTemplate = (tmpl) => {
      setTxType(tmpl.type); setAmountStr(formatCurrency(tmpl.amount)); setCategory(tmpl.category); setDesc(tmpl.description || '');
    };

    const handleSave = async () => {
      const amount = getNumber(amountStr);
      if (!amount || amount <= 0) return alert('Vui lòng nhập số tiền hợp lệ');
      if (txToEdit) {
        const updatedTx = { ...txToEdit, type: txType, amount, date, category, description: desc };
        const updatedList = transactions.map(t => t.id === txToEdit.id ? updatedTx : t);
        setTransactions(updatedList); localStorage.setItem('stc_transactions', JSON.stringify(updatedList));
        if (supabase) { await supabase.from('transactions').update({ type: txType, amount, date, category, description: desc }).eq('id', txToEdit.id); fetchData(); }
      } else {
        const newTx = { id: generateId(), project_id: selectedProjectId, type: txType, amount, date, category, description: desc, created_at: new Date().toISOString(), created_by: currentUser.displayName };
        const updatedList = [newTx, ...transactions];
        setTransactions(updatedList); localStorage.setItem('stc_transactions', JSON.stringify(updatedList));
        if (supabase) { await supabase.from('transactions').insert([newTx]); fetchData(); } 
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-4 md:p-6 shadow-xl max-h-[95vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold">{txToEdit ? 'Sửa Giao Dịch' : 'Ghi Thu / Chi Mới'}</h3><button onClick={onClose}><X className="text-gray-500 w-6 h-6 md:w-8 md:h-8" /></button></div>
          {!txToEdit && templates.length > 0 && (
            <div className="mb-4 md:mb-6 p-3 bg-blue-50 rounded-lg flex flex-wrap gap-2">
              <p className="text-xs md:text-sm font-semibold w-full text-blue-800">Chọn nhanh từ mẫu:</p>
              {templates.map(t => <button key={t.id} onClick={() => applyTemplate(t)} className="px-2 py-1 text-xs md:text-sm bg-white border rounded-md text-blue-700">{t.name}</button>)}
            </div>
          )}
          <div className="flex gap-2 mb-4 md:mb-6">
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('income'); setCategory(categories.find(c => c.type === 'income')?.name || ''); }}>KHOẢN THU</button>
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('expense'); setCategory(categories.find(c => c.type === 'expense')?.name || ''); }}>KHOẢN CHI</button>
          </div>
          <div className="space-y-3 md:space-y-4">
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Số Tiền (VNĐ) *</label><input type="text" value={amountStr} onChange={(e) => setAmountStr(formatCurrency(e.target.value))} className="w-full text-xl md:text-2xl p-2 md:p-3 border-2 rounded-lg" placeholder="1,000,000" /></div>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Ngày</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Danh Mục</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg">{categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
            </div>
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Ghi Chú</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
          </div>
          <div className="mt-6 md:mt-8 flex justify-end gap-3 md:gap-4"><button onClick={onClose} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-gray-200 font-bold rounded-lg">Hủy</button><button onClick={handleSave} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-blue-600 text-white font-bold rounded-lg">{txToEdit ? 'Cập Nhật' : 'Lưu'}</button></div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-6"><div className="bg-blue-100 p-4 rounded-full"><Lock className="w-8 h-8 md:w-10 md:h-10 text-blue-600" /></div></div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 text-center mb-6">ĐĂNG NHẬP HỆ THỐNG</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div><label className="block text-gray-700 font-bold mb-2 text-sm md:text-base">Tên đăng nhập (ID):</label><input type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="w-full p-3 md:p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 text-base md:text-lg" placeholder="Nhập ID của bạn" autoFocus /></div>
            <div><label className="block text-gray-700 font-bold mb-2 text-sm md:text-base">Mật khẩu:</label><input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full p-3 md:p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 text-center text-lg md:text-xl tracking-widest" placeholder="••••••" /></div>
            <button type="submit" className="w-full py-3 md:py-4 bg-blue-600 text-white font-bold text-base md:text-lg rounded-lg hover:bg-blue-700 transition shadow-md">VÀO SỔ</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="no-print min-h-screen bg-gray-50 text-gray-900 font-sans pb-10">
        
        <header className="bg-blue-700 text-white p-3 md:p-4 shadow-md">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl md:text-3xl font-extrabold tracking-tight">SỔ THU CHI</h1>
            <div className="flex gap-2 md:gap-4 items-center">
              <div className="flex items-center gap-1 md:gap-2 bg-blue-800 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-blue-600">
                <User className="w-3 h-3 md:w-4 md:h-4 text-blue-300" />
                <span className="font-bold text-xs md:text-sm text-blue-100 truncate max-w-[80px] md:max-w-full">{currentUser.displayName}</span>
              </div>
              <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1 md:gap-2 bg-blue-600 px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold hover:bg-blue-500 text-xs md:text-sm"><BookOpen className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden md:inline">Sổ Của Tôi</span></button>
              <button onClick={handleLogout} className="flex items-center justify-center bg-red-600 p-1.5 md:px-4 md:py-2 rounded-lg font-bold hover:bg-red-500" title="Đăng xuất"><Lock className="w-4 h-4 md:w-5 md:h-5" /></button>
            </div>
          </div>
        </header>
        
        <main className="max-w-6xl mx-auto p-2 md:p-4 md:py-8">
          {!selectedProjectId && projects.length === 0 ? (
            <div className="text-center py-20"><h2 className="text-lg md:text-2xl font-bold text-gray-600 mb-6">Bạn chưa chọn hoặc chưa có Sổ Thu Chi nào.</h2><button onClick={() => handleAddProject(prompt('Nhập tên sổ:'))} className="px-6 py-3 md:px-8 md:py-4 bg-blue-600 text-white font-bold text-base md:text-xl rounded-xl shadow-md">+ Tạo Sổ Mới</button></div>
          ) : (
            <>
              <div className="flex flex-col gap-3 mb-4 md:mb-6 bg-white p-3 md:p-4 rounded-xl shadow-sm border">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-bold text-sm md:text-base whitespace-nowrap">Sổ hiện tại:</span>
                    <select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full text-sm md:text-xl font-bold p-1.5 md:p-2 border-2 rounded-lg bg-gray-50">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  </div>
                </div>
                
                <button onClick={() => setShowTxModal(true)} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 md:py-4 rounded-xl font-extrabold text-lg md:text-xl hover:bg-blue-700 shadow-lg transition active:scale-[0.99]">
                  <Plus className="w-7 h-7 stroke-[3]" /> NHẬP LIỆU THU / CHI
                </button>
              </div>
              
              <div className="flex gap-1 md:gap-2 mb-4 md:mb-6 bg-white p-1.5 md:p-2 rounded-xl border shadow-sm">
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><PieChart className="w-4 h-4 md:w-5 md:h-5" /> THỐNG KÊ</button>
                <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><List className="w-4 h-4 md:w-5 md:h-5" /> GIAO DỊCH</button>
                <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Settings className="w-4 h-4 md:w-5 md:h-5" /> CÀI ĐẶT</button>
              </div>

              {activeTab === 'dashboard' && (
                <div className="space-y-4 md:space-y-6">
                  <div className="bg-white p-3 rounded-xl border shadow-sm">
                    <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Khoảng thời gian thống kê:</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      <button onClick={() => setDateFilter('today')} className={`py-2 px-1 text-xs md:text-sm font-bold rounded-lg border text-center transition ${dateFilter === 'today' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>Hôm nay</button>
                      <button onClick={() => setDateFilter('month')} className={`py-2 px-1 text-xs md:text-sm font-bold rounded-lg border text-center transition ${dateFilter === 'month' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>Tháng này</button>
                      <button onClick={() => setDateFilter('year')} className={`py-2 px-1 text-xs md:text-sm font-bold rounded-lg border text-center transition ${dateFilter === 'year' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>Năm nay</button>
                      <button onClick={() => setDateFilter('all')} className={`py-2 px-1 text-xs md:text-sm font-bold rounded-lg border text-center transition ${dateFilter === 'all' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>Tất cả</button>
                    </div>
                  </div>

                  <div className="bg-white p-3 md:p-4 rounded-xl border shadow-sm">
                    <button onClick={() => setShowFilter(!showFilter)} className="w-full flex justify-between items-center text-left text-sm md:text-base font-bold text-gray-700 pb-1"><span className="flex items-center gap-2"><Filter className="w-4 h-4" /> Lọc hiển thị theo Danh mục</span>{showFilter ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}</button>
                    {showFilter && (<div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">{categories.map(cat => (<label key={cat.id} className="flex items-center gap-1.5 cursor-pointer px-2 py-1.5 md:p-2 bg-gray-50 rounded border hover:bg-gray-100 text-xs md:text-sm"><input type="checkbox" checked={!uncheckedCategories.includes(cat.name)} onChange={() => { setUncheckedCategories(prev => prev.includes(cat.name) ? prev.filter(c => c !== cat.name) : [...prev, cat.name]) }} className="w-4 h-4 md:w-5 md:h-5 accent-blue-600" /><span className={`font-bold ${cat.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>{cat.name}</span></label>))}</div>)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                    <div className="bg-white p-4 md:p-6 rounded-xl border-l-8 border-green-500 shadow-sm"><p className="font-bold text-xs md:text-sm mb-1 text-gray-500">TỔNG THU (Đã Lọc)</p><p className="text-xl md:text-3xl font-extrabold text-green-600">{formatCurrency(summary.income)} đ</p></div>
                    <div className="bg-white p-4 md:p-6 rounded-xl border-l-8 border-red-500 shadow-sm"><p className="font-bold text-xs md:text-sm mb-1 text-gray-500">TỔNG CHI (Đã Lọc)</p><p className="text-xl md:text-3xl font-extrabold text-red-600">{formatCurrency(summary.expense)} đ</p></div>
                    <div className="bg-white p-4 md:p-6 rounded-xl border-l-8 border-blue-500 shadow-sm"><p className="font-bold text-xs md:text-sm mb-1 text-gray-500">SỐ DƯ CÔNG NỢ</p><p className="text-xl md:text-3xl font-extrabold text-blue-700">{formatCurrency(summary.income - summary.expense)} đ</p></div>
                  </div>
                  
                  <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border">
                    <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-base md:text-xl font-bold">Biểu Đồ So Sánh</h3><select value={chartGroup} onChange={(e) => setChartGroup(e.target.value)} className="p-1.5 md:p-2 text-sm md:text-base border-2 rounded-lg font-bold"><option value="day">Ngày</option><option value="month">Tháng</option><option value="year">Năm</option></select></div>
                    <div className="h-64 md:h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{fontSize: 12}} /><YAxis tick={{fontSize: 12}} tickFormatter={(v) => v===0?'0':`${v/1000}k`} /><Tooltip formatter={(v) => formatCurrency(v)+' đ'} /><Legend wrapperStyle={{fontSize: "12px"}} /><Bar dataKey="income" name="Thu" fill="#16a34a" /><Bar dataKey="expense" name="Chi" fill="#dc2626" /></BarChart></ResponsiveContainer></div>
                  </div>
                </div>
              )}

              {activeTab === 'list' && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-xl border shadow-sm gap-3">
                    <span className="text-sm font-bold text-gray-700 w-full md:w-auto">
                      Đang hiển thị {paginatedData.totalLimited} {paginatedData.isCapped && '(Tối đa)'} kết quả
                    </span>
                    <div className="flex gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Tìm tên, ghi chú, số tiền..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white" />
                      </div>
                      <button onClick={() => setShowExportModal(true)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-green-700 shadow whitespace-nowrap">
                        <Download className="w-4 h-4" /> Xuất Excel
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                    <table className="w-full text-left min-w-[700px]">
                      <thead className="bg-gray-100 border-b"><tr><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Ngày</th><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Nội dung</th><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Người nhập</th><th className="p-3 md:p-4 text-xs md:text-sm text-right font-bold text-gray-600">Số Tiền</th><th className="p-3 md:p-4 text-xs md:text-sm text-center font-bold text-gray-600">Sửa</th><th className="p-3 md:p-4 text-xs md:text-sm text-center font-bold text-gray-600">In</th><th className="p-3 md:p-4 text-xs md:text-sm text-center font-bold text-gray-600">Xóa</th></tr></thead>
                      <tbody>
                        {paginatedData.items.map(t => (
                          <tr key={t.id} className="border-b hover:bg-gray-50 text-sm">
                            <td className="p-3 md:p-4 text-gray-700 whitespace-nowrap font-medium">{t.date}</td>
                            <td className="p-3 md:p-4"><p className="font-bold text-gray-800">{t.category}</p><p className="text-xs text-gray-500 mt-0.5">{t.description}</p></td>
                            <td className="p-3 md:p-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] md:text-xs font-bold rounded-md border">{t.created_by || 'Khuyết danh'}</span></td>
                            <td className={`p-3 md:p-4 text-right font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                            <td className="p-3 md:p-4 text-center"><button onClick={() => setEditingTx(t)} className="text-blue-500 hover:text-blue-700 mx-auto block p-1.5 md:p-2 rounded hover:bg-blue-50" title="Sửa giao dịch này"><Edit className="w-4 h-4 md:w-5 md:h-5" /></button></td>
                            <td className="p-3 md:p-4 text-center"><button onClick={() => setTransactionToPrint(t)} className="text-gray-500 hover:text-gray-800 mx-auto block p-1.5 md:p-2 rounded hover:bg-gray-200" title="In phiếu này"><Printer className="w-4 h-4 md:w-5 md:h-5" /></button></td>
                            <td className="p-3 md:p-4 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="text-red-400 hover:text-red-600 mx-auto block p-1.5 md:p-2 rounded hover:bg-red-50" title="Xóa"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button></td>
                          </tr>
                        ))}
                        {paginatedData.items.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500 font-medium">Không tìm thấy giao dịch nào.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                  {/* NÚT ĐIỀU HƯỚNG PHÂN TRANG */}
                  {paginatedData.totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4 mt-4 mb-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`flex items-center gap-1 px-4 py-2 font-bold rounded-lg ${currentPage === 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'}`}><ChevronLeft className="w-5 h-5"/> Trước</button>
                      <span className="font-bold text-gray-600 text-sm">Trang {currentPage} / {paginatedData.totalPages}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))} disabled={currentPage === paginatedData.totalPages} className={`flex items-center gap-1 px-4 py-2 font-bold rounded-lg ${currentPage === paginatedData.totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'}`}>Sau <ChevronRight className="w-5 h-5"/></button>
                    </div>
                  )}
                </div>
              )}
              
              {activeTab === 'settings' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
                    <h3 className="text-lg md:text-xl font-bold mb-4 border-b pb-2">Mẫu Thu/Chi Nhanh</h3>
                    <div className="space-y-3 md:space-y-4 mb-6">{templates.map(tmpl => <div key={tmpl.id} className="flex justify-between items-center p-2 md:p-3 bg-gray-50 rounded-lg border"><div><p className="font-bold text-sm md:text-base">{tmpl.name}</p><p className="text-xs md:text-sm text-gray-500">{tmpl.category} • {formatCurrency(tmpl.amount)}đ</p></div><button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button></div>)}</div>
                    <button onClick={() => setShowTemplateModal(true)} className="w-full py-2.5 md:py-3 text-sm md:text-base bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200">+ Tạo Mẫu Nhanh Mới</button>
                  </div>
                  
                  <div className="bg-white p-4 md:p-6 rounded-xl border shadow-sm">
                    <h3 className="text-lg md:text-xl font-bold mb-4 border-b pb-2">Quản Lý Danh Mục</h3>
                    <div className="space-y-3 md:space-y-4 mb-6">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center p-2 md:p-3 bg-gray-50 rounded-lg border"><p className="font-bold text-sm md:text-base">{cat.name}</p><div className="flex items-center gap-2 md:gap-3"><span className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[10px] md:text-sm font-bold ${cat.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cat.type === 'income' ? 'THU' : 'CHI'}</span><button onClick={() => handleDeleteCategory(cat.id)} className="text-red-500 p-1 hover:bg-red-100 rounded" title="Xóa danh mục"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button></div></div>))}</div>
                    <button onClick={() => { const name = prompt('Tên danh mục mới:'); if(name) handleAddCategory(name, window.confirm('Bấm OK nếu là danh mục THU, bấm Cancel nếu là CHI') ? 'income' : 'expense'); }} className="w-full py-2.5 md:py-3 text-sm md:text-base bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200">+ Thêm Danh Mục Mới</button>
                  </div>
                  
                  <div className="bg-blue-50 p-4 md:p-6 rounded-xl border border-blue-200 shadow-sm col-span-1 md:col-span-2">
                    <h3 className="text-lg md:text-xl font-bold mb-3 border-b border-blue-200 pb-2 flex items-center gap-2 text-blue-800"><Upload className="w-5 h-5" /> Nhập Dữ Liệu Cũ (File Excel)</h3>
                    <p className="text-sm text-gray-700 mb-4">Khôi phục hàng ngàn dữ liệu cũ vào sổ hiện tại. File Excel cần có đuôi <b>.xlsx</b> và các cột: <i>Ngày, Danh Mục, Ghi Chú, Người Nhập, Tiền Thu (VNĐ), Tiền Chi (VNĐ).</i></p>
                    {isImporting ? (<div className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg text-center animate-pulse flex justify-center items-center gap-2"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang xử lý đẩy dữ liệu lên máy chủ...</div>) : (<input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" />)}
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {showProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full p-4 md:p-6 shadow-xl"><div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold">Quản Lý Sổ</h3><button onClick={() => setShowProjectModal(false)}><X className="text-gray-500 w-6 h-6 md:w-8 md:h-8" /></button></div><div className="space-y-3 mb-6 max-h-80 overflow-y-auto">{projects.map(p => (<div key={p.id} className="flex justify-between items-center p-3 md:p-4 border rounded-lg bg-gray-50"><span className="font-bold text-sm md:text-lg">{p.name}</span><button onClick={() => handleDeleteProject(p.id)} className="text-red-500 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button></div>))}</div><button onClick={() => handleAddProject(prompt('Tên sổ mới:'))} className="w-full py-2.5 md:py-3 text-sm md:text-base bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">+ Tạo Sổ Mới</button></div>
          </div>
        )}
        
        {showExportModal && <ExportExcelModal />}
        { (showTxModal || editingTx) && <TransactionModal txToEdit={editingTx} onClose={() => { setShowTxModal(false); setEditingTx(null); }} /> }
        {showTemplateModal && <CreateTemplateModal />}

      </div>
    </>
  );
}