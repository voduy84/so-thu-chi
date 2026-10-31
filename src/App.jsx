import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, X, Settings, Home, PieChart, List, Calendar, FileText, Filter, BookOpen, Lock, User, ShieldAlert, Printer, ChevronDown, ChevronUp, Key } from 'lucide-react';
import * as XLSX from 'xlsx';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// === HỆ THỐNG TÀI KHOẢN (Mật khẩu mặc định) ===
const ACCOUNTS = {
  'quanly': { defaultPassword: 'quanly@11231', role: 'admin', displayName: 'Quản Lý' },
  'nhanvien1': { defaultPassword: 'msthuy1191#', role: 'staff', displayName: 'Ms. Thuỷ' },
  'nhanvien2': { defaultPassword: 'msngoc11933#', role: 'staff', displayName: 'Ms. Ngọc' }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([
    { id: '1', name: 'Điện nước cửa hàng', type: 'expense' },
    { id: '2', name: 'Nhập hàng & Mua hộ', type: 'expense' },
    { id: '3', name: 'Trang thiết bị & Sửa chữa', type: 'expense' },
    { id: '4', name: 'Vật liệu đóng gói', type: 'expense' },
    { id: '5', name: 'Phí giao hàng & Taxi', type: 'expense' },
    { id: '6', name: 'Lương quản lý (Mẹ)', type: 'expense' },
    { id: '7', name: 'Bán hàng hàng ngày', type: 'income' },
    { id: '8', name: 'Thu khác', type: 'income' }
  ]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  
  // Modals & States
  const [showTxModal, setShowTxModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showChangePassModal, setShowChangePassModal] = useState(false); // Modal Đổi Pass
  const [transactionToPrint, setTransactionToPrint] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  
  const [dateFilter, setDateFilter] = useState('all');
  const [chartGroup, setChartGroup] = useState('month');
  const [uncheckedCategories, setUncheckedCategories] = useState([]);

  // Khôi phục phiên đăng nhập
  useEffect(() => {
    const savedUser = sessionStorage.getItem('stc_current_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  // --- LOGIC ĐĂNG NHẬP MỚI (KIỂM TRA CSDL TRƯỚC) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    const uid = usernameInput.toLowerCase().trim();
    const userAcc = ACCOUNTS[uid];
    
    if (!userAcc) {
      alert('Tên đăng nhập không tồn tại!');
      return;
    }

    let activePassword = userAcc.defaultPassword;

    // Kiểm tra xem user đã từng đổi pass trên Supabase chưa
    if (supabase) {
      try {
        const { data, error } = await supabase.from('app_users').select('password').eq('username', uid).single();
        if (data && data.password) {
          activePassword = data.password; // Lấy pass mới ghi đè pass mặc định
        }
      } catch (err) {
        console.error("Lỗi khi kiểm tra mật khẩu", err);
      }
    }

    if (passwordInput === activePassword) {
      const userSession = { username: uid, role: userAcc.role, displayName: userAcc.displayName };
      setCurrentUser(userSession);
      sessionStorage.setItem('stc_current_user', JSON.stringify(userSession));
    } else {
      alert('Mật khẩu không chính xác!');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem('stc_current_user');
  };

  useEffect(() => {
    if (currentUser) fetchData();
  }, [currentUser]);

  const fetchData = async () => {
    if (supabase) {
      try {
        const { data: pData } = await supabase.from('projects').select('*');
        const { data: tData } = await supabase.from('transactions').select('*');
        const { data: tmplData } = await supabase.from('templates').select('*');
        const { data: catData } = await supabase.from('custom_categories').select('*');
        if (pData) setProjects(pData);
        if (tData) setTransactions(tData);
        if (tmplData) setTemplates(tmplData);
        if (catData && catData.length > 0) setCategories(catData);
      } catch (error) { loadLocal(); }
    } else loadLocal();
  };

  const loadLocal = () => {
    setProjects(JSON.parse(localStorage.getItem('stc_projects') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('stc_transactions') || '[]'));
    setTemplates(JSON.parse(localStorage.getItem('stc_templates') || '[]'));
    const localCat = JSON.parse(localStorage.getItem('stc_categories'));
    if (localCat) setCategories(localCat);
  };

  useEffect(() => {
    if (!supabase && currentUser) {
      localStorage.setItem('stc_projects', JSON.stringify(projects));
      localStorage.setItem('stc_transactions', JSON.stringify(transactions));
      localStorage.setItem('stc_templates', JSON.stringify(templates));
      localStorage.setItem('stc_categories', JSON.stringify(categories));
    }
  }, [projects, transactions, templates, categories, currentUser]);

  const formatCurrency = (val) => {
    if (!val) return '';
    const num = parseInt(val.toString().replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString('en-US');
  };

  const getNumber = (val) => parseInt(val?.toString().replace(/,/g, '')) || 0;
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => t.project_id === selectedProjectId);
    const today = new Date();
    if (dateFilter === 'today') filtered = filtered.filter(t => t.date === today.toISOString().split('T')[0]);
    else if (dateFilter === 'month') filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 7)));
    else if (dateFilter === 'year') filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 4)));
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedProjectId, dateFilter]);

  const activeTransactionsForDashboard = useMemo(() => {
    return filteredTransactions.filter(t => !uncheckedCategories.includes(t.category));
  }, [filteredTransactions, uncheckedCategories]);

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

  const checkAdmin = () => {
    if (currentUser?.role !== 'admin') {
      alert('Chỉ tài khoản Quản Lý mới có quyền thực hiện thao tác này!');
      return false;
    }
    return true;
  };

  const handleAddProject = async (name) => {
    const newP = { id: generateId(), name, created_at: new Date().toISOString() };
    if (supabase) { await supabase.from('projects').insert([newP]); fetchData(); } 
    else setProjects([...projects, newP]);
    if (!selectedProjectId) setSelectedProjectId(newP.id);
  };

  const handleDeleteProject = async (id) => {
    if (!checkAdmin()) return;
    if (window.confirm('Bạn có chắc chắn muốn xóa Sổ này?')) {
      if (supabase) { await supabase.from('projects').delete().eq('id', id); fetchData(); } 
      else { setProjects(projects.filter(p => p.id !== id)); setTransactions(transactions.filter(t => t.project_id !== id)); }
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const handleAddCategory = async (name, type) => {
    const newC = { id: generateId(), name, type, created_at: new Date().toISOString() };
    if (supabase) { await supabase.from('custom_categories').insert([newC]); fetchData(); } 
    else setCategories([...categories, newC]);
  };

  const handleDeleteCategory = async (id) => {
    if (!checkAdmin()) return;
    if (window.confirm('Xóa danh mục này? Các giao dịch cũ vẫn sẽ giữ lại giá trị nhưng mất phân loại.')) {
      if (supabase) { await supabase.from('custom_categories').delete().eq('id', id); fetchData(); } 
      else setCategories(categories.filter(c => c.id !== id));
    }
  };

  const handleAddTemplate = async (tmpl) => {
    const newTmpl = { ...tmpl, id: generateId(), created_at: new Date().toISOString() };
    if (supabase) { await supabase.from('templates').insert([newTmpl]); fetchData(); } 
    else setTemplates([...templates, newTmpl]);
  };

  const handleDeleteTemplate = async (id) => {
    if (!checkAdmin()) return;
    if (supabase) { await supabase.from('templates').delete().eq('id', id); fetchData(); } 
    else setTemplates(templates.filter(t => t.id !== id));
  };

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return alert('Không có dữ liệu để xuất!');
    const excelData = filteredTransactions.map(t => ({
      'Ngày': t.date,
      'Giờ': new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      'Danh Mục': t.category,
      'Ghi Chú': t.description || '',
      'Người Nhập': t.created_by || 'Khuyết danh',
      'Loại': t.type === 'income' ? 'Thu' : 'Chi',
      'Số Tiền (VNĐ)': t.amount
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Giao_Dich");
    XLSX.writeFile(workbook, `SoThuChi_${new Date().toISOString().slice(0,10)}.xlsx`);
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

  // --- CỬA SỔ ĐỔI MẬT KHẨU ---
  const ChangePasswordModal = () => {
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    const handleChangePass = async () => {
      if (!oldPass || !newPass || !confirmPass) return alert('Vui lòng điền đủ thông tin!');
      if (newPass !== confirmPass) return alert('Mật khẩu mới không khớp nhau!');
      if (!supabase) return alert('Không có kết nối CSDL, không thể đổi mật khẩu!');

      // 1. Kiểm tra mật khẩu cũ
      let currentActivePass = ACCOUNTS[currentUser.username].defaultPassword;
      const { data } = await supabase.from('app_users').select('password').eq('username', currentUser.username).single();
      if (data && data.password) currentActivePass = data.password;

      if (oldPass !== currentActivePass) {
        return alert('Mật khẩu cũ không chính xác!');
      }

      // 2. Lưu mật khẩu mới lên Supabase
      const { error } = await supabase.from('app_users').upsert({ username: currentUser.username, password: newPass });
      if (error) {
        alert('Có lỗi xảy ra: ' + error.message);
      } else {
        alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
        setShowChangePassModal(false);
        handleLogout();
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Đổi Mật Khẩu</h3><button onClick={() => setShowChangePassModal(false)}><X className="text-gray-500 w-6 h-6" /></button></div>
          <div className="space-y-4">
            <div><label className="block text-sm font-bold mb-2">Mật khẩu cũ</label><input type="password" value={oldPass} onChange={(e) => setOldPass(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
            <div><label className="block text-sm font-bold mb-2">Mật khẩu mới</label><input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
            <div><label className="block text-sm font-bold mb-2">Nhập lại mật khẩu mới</label><input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
          </div>
          <div className="mt-6 flex justify-end gap-3"><button onClick={() => setShowChangePassModal(false)} className="px-4 py-2 bg-gray-200 font-bold rounded-lg">Hủy</button><button onClick={handleChangePass} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">Cập nhật</button></div>
        </div>
      </div>
    );
  };

  const TransactionModal = () => {
    const [txType, setTxType] = useState('expense');
    const [amountStr, setAmountStr] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState(categories.filter(c => c.type === 'expense')[0]?.name || '');
    const [desc, setDesc] = useState('');

    const applyTemplate = (tmpl) => {
      setTxType(tmpl.type);
      setAmountStr(formatCurrency(tmpl.amount));
      setCategory(tmpl.category);
      setDesc(tmpl.description || '');
    };

    const handleSave = async () => {
      const amount = getNumber(amountStr);
      if (!amount || amount <= 0) return alert('Vui lòng nhập số tiền hợp lệ');
      const newTx = { id: generateId(), project_id: selectedProjectId, type: txType, amount, date, category, description: desc, created_at: new Date().toISOString(), created_by: currentUser.displayName };
      if (supabase) { await supabase.from('transactions').insert([newTx]); fetchData(); } 
      else setTransactions([...transactions, newTx]);
      setShowTxModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-4 md:p-6 shadow-xl max-h-[95vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold">Ghi Thu / Chi Mới</h3><button onClick={() => setShowTxModal(false)}><X className="text-gray-500 w-6 h-6 md:w-8 md:h-8" /></button></div>
          {templates.length > 0 && (
            <div className="mb-4 md:mb-6 p-3 bg-blue-50 rounded-lg flex flex-wrap gap-2">
              <p className="text-xs md:text-sm font-semibold w-full text-blue-800">Chọn nhanh từ mẫu:</p>
              {templates.map(t => <button key={t.id} onClick={() => applyTemplate(t)} className="px-2 py-1 text-xs md:text-sm bg-white border rounded-md text-blue-700">{t.name}</button>)}
            </div>
          )}
          <div className="flex gap-2 mb-4 md:mb-6">
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('income'); setCategory(categories.find(c => c.type === 'income')?.name || ''); }}>+ KHOẢN THU</button>
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('expense'); setCategory(categories.find(c => c.type === 'expense')?.name || ''); }}>- KHOẢN CHI</button>
          </div>
          <div className="space-y-3 md:space-y-4">
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Số Tiền (VNĐ) *</label><input type="text" value={amountStr} onChange={(e) => setAmountStr(formatCurrency(e.target.value))} className="w-full text-xl md:text-2xl p-2 md:p-3 border-2 rounded-lg" placeholder="1,000,000" /></div>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Ngày</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Danh Mục</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg">{categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
            </div>
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Ghi Chú</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
          </div>
          <div className="mt-6 md:mt-8 flex justify-end gap-3 md:gap-4"><button onClick={() => setShowTxModal(false)} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-gray-200 font-bold rounded-lg">Hủy</button><button onClick={handleSave} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-blue-600 text-white font-bold rounded-lg">Lưu</button></div>
        </div>
      </div>
    );
  };

  const CreateTemplateModal = () => {
    const [name, setName] = useState('');
    const [txType, setTxType] = useState('expense');
    const [amountStr, setAmountStr] = useState('');
    const [category, setCategory] = useState(categories.filter(c => c.type === 'expense')[0]?.name || '');
    const [desc, setDesc] = useState('');

    const handleSaveTemplate = () => {
      if (!name.trim()) return alert('Vui lòng nhập tên Mẫu');
      handleAddTemplate({ name, type: txType, amount: getNumber(amountStr), category, description: desc });
      setShowTemplateModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 md:p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-4 md:p-6 shadow-xl max-h-[95vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold">Tạo Mẫu Nhanh</h3><button onClick={() => setShowTemplateModal(false)}><X className="text-gray-500 w-6 h-6 md:w-8 md:h-8" /></button></div>
          <div className="flex gap-2 mb-4 md:mb-6">
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('income'); setCategory(categories.find(c => c.type === 'income')?.name || ''); }}>MẪU THU</button>
            <button className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg ${txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('expense'); setCategory(categories.find(c => c.type === 'expense')?.name || ''); }}>MẪU CHI</button>
          </div>
          <div className="space-y-3 md:space-y-4">
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Tên Mẫu *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" autoFocus /></div>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Số Tiền (Tùy chọn)</label><input type="text" value={amountStr} onChange={(e) => setAmountStr(formatCurrency(e.target.value))} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
              <div className="flex-1"><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Danh Mục</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg">{categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
            </div>
            <div><label className="block text-sm md:text-base font-bold mb-1 md:mb-2">Ghi Chú</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-2 md:p-3 text-sm md:text-base border-2 rounded-lg" /></div>
          </div>
          <div className="mt-6 md:mt-8 flex justify-end gap-3 md:gap-4"><button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-gray-200 font-bold rounded-lg">Hủy</button><button onClick={handleSaveTemplate} className="px-4 py-2 md:px-6 md:py-3 text-sm md:text-base bg-blue-600 text-white font-bold rounded-lg">Lưu Mẫu</button></div>
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
      <style>{`
        @media print {
          @page { size: A5 portrait; margin: 15mm; }
          body { background: white !important; margin: 0; padding: 0; color: black; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
      <div className="no-print min-h-screen bg-gray-50 text-gray-900 font-sans">
        
        <header className="bg-blue-700 text-white p-3 md:p-4 shadow-md">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl md:text-3xl font-extrabold tracking-tight">SỔ THU CHI</h1>
            <div className="flex gap-2 md:gap-4 items-center">
              <div className="flex items-center gap-1 md:gap-2 bg-blue-800 px-2 py-1 md:px-3 md:py-1.5 rounded-lg border border-blue-600">
                <User className="w-3 h-3 md:w-4 md:h-4 text-blue-300" />
                <span className="font-bold text-xs md:text-sm text-blue-100 truncate max-w-[80px] md:max-w-full">{currentUser.displayName}</span>
              </div>
              
              {/* Nút Đổi Mật Khẩu */}
              <button onClick={() => setShowChangePassModal(true)} className="flex items-center justify-center bg-blue-600 p-1.5 md:px-3 md:py-2 rounded-lg font-bold hover:bg-blue-500 text-xs md:text-sm" title="Đổi mật khẩu">
                 <Key className="w-4 h-4 md:w-5 md:h-5" />
              </button>

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
              <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 mb-4 md:mb-8 bg-white p-3 md:p-4 rounded-xl shadow-sm border">
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                  <span className="font-bold text-sm md:text-base whitespace-nowrap">Sổ hiện tại:</span>
                  <select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full md:w-auto text-sm md:text-xl font-bold p-1.5 md:p-2 border-2 rounded-lg bg-gray-50">{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                  <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="p-2 md:p-3 text-xs md:text-base border-2 rounded-lg font-bold"><option value="all">🕒 Tất cả</option><option value="today">📅 Hôm nay</option><option value="month">🗓️ Tháng này</option><option value="year">📆 Năm nay</option></select>
                  <button onClick={exportToExcel} className="flex items-center justify-center gap-1 md:gap-2 bg-green-600 text-white px-3 py-2 md:px-4 md:py-3 rounded-lg font-bold text-xs md:text-lg hover:bg-green-700 shadow-md whitespace-nowrap">📥 Xuất Excel</button>
                  <button onClick={() => setShowTxModal(true)} className="flex items-center justify-center gap-1 md:gap-2 bg-blue-600 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg font-bold text-xs md:text-lg hover:bg-blue-700 shadow-md whitespace-nowrap"><Plus className="w-4 h-4 md:w-6 md:h-6" /> GHI THU/CHI</button>
                </div>
              </div>
              
              <div className="flex gap-1 md:gap-2 mb-4 md:mb-6 bg-white p-1.5 md:p-2 rounded-xl border shadow-sm">
                <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><PieChart className="w-4 h-4 md:w-5 md:h-5" /> THỐNG KÊ</button>
                <button onClick={() => setActiveTab('list')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><List className="w-4 h-4 md:w-5 md:h-5" /> GIAO DỊCH</button>
                <button onClick={() => setActiveTab('settings')} className={`flex-1 py-2 md:py-3 text-xs md:text-base font-bold rounded-lg flex items-center justify-center gap-1 md:gap-2 ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Settings className="w-4 h-4 md:w-5 md:h-5" /> CÀI ĐẶT</button>
              </div>

              {activeTab === 'dashboard' && (
                <div className="space-y-4 md:space-y-6">
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
                <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-gray-100 border-b"><tr><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Ngày</th><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Nội dung</th><th className="p-3 md:p-4 text-xs md:text-sm font-bold text-gray-600">Người nhập</th><th className="p-3 md:p-4 text-xs md:text-sm text-right font-bold text-gray-600">Số Tiền</th><th className="p-3 md:p-4 text-xs md:text-sm text-center font-bold text-gray-600">In</th><th className="p-3 md:p-4 text-xs md:text-sm text-center font-bold text-gray-600">Xóa</th></tr></thead>
                    <tbody>
                      {filteredTransactions.map(t => (
                        <tr key={t.id} className="border-b hover:bg-gray-50 text-sm">
                          <td className="p-3 md:p-4 text-gray-700 whitespace-nowrap">{t.date}</td>
                          <td className="p-3 md:p-4"><p className="font-semibold text-gray-800">{t.category}</p><p className="text-xs text-gray-500">{t.description}</p></td>
                          <td className="p-3 md:p-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] md:text-xs font-bold rounded-md border">{t.created_by || 'Khuyết danh'}</span></td>
                          <td className={`p-3 md:p-4 text-right font-bold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                          <td className="p-3 md:p-4 text-center"><button onClick={() => setTransactionToPrint(t)} className="text-blue-500 hover:text-blue-700 mx-auto block p-1.5 md:p-2 rounded hover:bg-blue-50" title="In phiếu này"><Printer className="w-4 h-4 md:w-5 md:h-5" /></button></td>
                          <td className="p-3 md:p-4 text-center">{currentUser.role === 'admin' ? (<button onClick={() => { if(window.confirm('Xóa?')) { supabase ? supabase.from('transactions').delete().eq('id', t.id).then(fetchData) : setTransactions(transactions.filter(tx => tx.id !== t.id)); } }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4 md:w-5 md:h-5 mx-auto" /></button>) : (<ShieldAlert className="w-4 h-4 mx-auto text-gray-300" title="Không quyền xóa" />)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                </div>
              )}
            </>
          )}
        </main>

        {/* MODALS */}
        {showProjectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full p-4 md:p-6 shadow-xl"><div className="flex justify-between items-center mb-4 md:mb-6"><h3 className="text-xl md:text-2xl font-bold">Quản Lý Sổ</h3><button onClick={() => setShowProjectModal(false)}><X className="text-gray-500 w-6 h-6 md:w-8 md:h-8" /></button></div><div className="space-y-3 mb-6 max-h-80 overflow-y-auto">{projects.map(p => (<div key={p.id} className="flex justify-between items-center p-3 md:p-4 border rounded-lg bg-gray-50"><span className="font-bold text-sm md:text-lg">{p.name}</span><button onClick={() => handleDeleteProject(p.id)} className="text-red-500 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 md:w-5 md:h-5" /></button></div>))}</div><button onClick={() => handleAddProject(prompt('Tên sổ mới:'))} className="w-full py-2.5 md:py-3 text-sm md:text-base bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">+ Tạo Sổ Mới</button></div>
          </div>
        )}
        
        {showChangePassModal && <ChangePasswordModal />}
        {showTxModal && <TransactionModal />}
        {showTemplateModal && <CreateTemplateModal />}

        {transactionToPrint && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 md:p-4 z-[60]">
            <div className="bg-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] w-[160mm]">
              <div className="bg-gray-800 text-white p-3 md:p-4 flex justify-between items-center"><h3 className="font-bold text-sm md:text-base">Xem trước Phiếu (Khổ A5 dọc)</h3><button onClick={() => setTransactionToPrint(null)} className="hover:text-red-400"><X className="w-5 h-5 md:w-6 md:h-6" /></button></div>
              <div className="p-4 md:p-8 overflow-y-auto flex justify-center"><div className="bg-white shadow-md border transform scale-75 origin-top md:scale-100" style={{ width: '148mm', minHeight: '210mm', marginBottom: '-50px' }}><ReceiptContent t={transactionToPrint} /></div></div>
              <div className="bg-white p-3 md:p-4 border-t flex justify-end gap-3 md:gap-4"><button onClick={() => setTransactionToPrint(null)} className="px-4 py-2 md:px-6 md:py-2 text-sm md:text-base bg-gray-300 font-bold rounded hover:bg-gray-400 text-gray-800">Đóng lại</button><button onClick={() => window.print()} className="px-4 py-2 md:px-8 md:py-2 text-sm md:text-base bg-blue-600 text-white font-bold rounded flex items-center gap-2 hover:bg-blue-700 shadow-md"><Printer className="w-4 h-4 md:w-5 md:h-5" /> In Phiếu Này</button></div>
            </div>
          </div>
        )}
      </div>
      <div className="hidden print-only">{transactionToPrint && <ReceiptContent t={transactionToPrint} />}</div>
    </>
  );
}