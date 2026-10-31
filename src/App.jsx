JavaScript
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Plus, Trash2, X, Settings, Home, PieChart, List, Calendar, FileText, Filter, BookOpen, Lock } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function App() {
  // === TRẠNG THÁI BẢO MẬT ===
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // 👉 THAY ĐỔI MẬT KHẨU CỦA BẠN Ở ĐÂY
  const STATIC_PASSWORD = 'admin'; 

  // Các trạng thái dữ liệu (Data States)
  const [projects, setProjects] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([
    { id: '1', name: 'Đi chợ / Ăn uống', type: 'expense' },
    { id: '2', name: 'Điện nước / Internet', type: 'expense' },
    { id: '3', name: 'Mua sắm', type: 'expense' },
    { id: '4', name: 'Lương', type: 'income' },
    { id: '5', name: 'Kinh doanh', type: 'income' }
  ]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [chartGroup, setChartGroup] = useState('month');

  // Kiểm tra trạng thái đăng nhập khi mở web
  useEffect(() => {
    const authStatus = sessionStorage.getItem('stc_auth_unlocked');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === STATIC_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('stc_auth_unlocked', 'true');
    } else {
      alert('Mật khẩu không chính xác!');
      setPasswordInput('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('stc_auth_unlocked');
  };

  // Fetch dữ liệu sau khi đã mở khóa
  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

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
      } catch (error) {
        loadLocal();
      }
    } else {
      loadLocal();
    }
  };

  const loadLocal = () => {
    setProjects(JSON.parse(localStorage.getItem('stc_projects') || '[]'));
    setTransactions(JSON.parse(localStorage.getItem('stc_transactions') || '[]'));
    setTemplates(JSON.parse(localStorage.getItem('stc_templates') || '[]'));
    const localCat = JSON.parse(localStorage.getItem('stc_categories'));
    if (localCat) setCategories(localCat);
  };

  useEffect(() => {
    if (!supabase && isAuthenticated) {
      localStorage.setItem('stc_projects', JSON.stringify(projects));
      localStorage.setItem('stc_transactions', JSON.stringify(transactions));
      localStorage.setItem('stc_templates', JSON.stringify(templates));
      localStorage.setItem('stc_categories', JSON.stringify(categories));
    }
  }, [projects, transactions, templates, categories, isAuthenticated]);

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
    if (dateFilter === 'today') {
      filtered = filtered.filter(t => t.date === today.toISOString().split('T')[0]);
    } else if (dateFilter === 'month') {
      filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 7)));
    } else if (dateFilter === 'year') {
      filtered = filtered.filter(t => t.date.startsWith(today.toISOString().slice(0, 4)));
    }
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [transactions, selectedProjectId, dateFilter]);

  const summary = useMemo(() => filteredTransactions.reduce((acc, curr) => {
    curr.type === 'income' ? acc.income += curr.amount : acc.expense += curr.amount;
    return acc;
  }, { income: 0, expense: 0 }), [filteredTransactions]);

  const chartData = useMemo(() => {
    const grouped = {};
    filteredTransactions.forEach(t => {
      let key = t.date;
      if (chartGroup === 'month') key = t.date.slice(0, 7);
      if (chartGroup === 'year') key = t.date.slice(0, 4);
      if (!grouped[key]) grouped[key] = { name: key, income: 0, expense: 0 };
      grouped[key][t.type] += t.amount;
    });
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTransactions, chartGroup]);

  const handleAddProject = async (name) => {
    const newP = { id: generateId(), name, created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('projects').insert([newP]);
      fetchData();
    } else setProjects([...projects, newP]);
    if (!selectedProjectId) setSelectedProjectId(newP.id);
  };

  const handleDeleteProject = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa Sổ này?')) {
      if (supabase) {
        await supabase.from('projects').delete().eq('id', id);
        fetchData();
      } else {
        setProjects(projects.filter(p => p.id !== id));
        setTransactions(transactions.filter(t => t.project_id !== id));
      }
      if (selectedProjectId === id) setSelectedProjectId(null);
    }
  };

  const handleAddCategory = async (name, type) => {
    const newC = { id: generateId(), name, type, created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('custom_categories').insert([newC]);
      fetchData();
    } else setCategories([...categories, newC]);
  };

  const handleAddTemplate = async (tmpl) => {
    const newTmpl = { ...tmpl, id: generateId(), created_at: new Date().toISOString() };
    if (supabase) {
      await supabase.from('templates').insert([newTmpl]);
      fetchData();
    } else setTemplates([...templates, newTmpl]);
  };

  const handleDeleteTemplate = async (id) => {
    if (supabase) {
      await supabase.from('templates').delete().eq('id', id);
      fetchData();
    } else setTemplates(templates.filter(t => t.id !== id));
  };

  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return alert('Không có dữ liệu giao dịch nào để xuất!');
    let csvContent = "\uFEFFNgày,Danh Mục,Ghi Chú,Loại,Số Tiền (VNĐ)\n";
    filteredTransactions.forEach(t => {
      const typeStr = t.type === 'income' ? 'Thu' : 'Chi';
      const safeDesc = (t.description || '').replace(/,/g, ' ');
      csvContent += `${t.date},"${t.category}","${safeDesc}",${typeStr},${t.amount}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SoThuChi_${selectedProjectId || 'data'}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
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
      const newTx = { id: generateId(), project_id: selectedProjectId, type: txType, amount, date, category, description: desc, created_at: new Date().toISOString() };
      if (supabase) {
        await supabase.from('transactions').insert([newTx]);
        fetchData();
      } else setTransactions([...transactions, newTx]);
      setShowTxModal(false);
    };

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">Ghi Thu / Chi Mới</h3>
            <button onClick={() => setShowTxModal(false)}><X className="text-gray-500 w-8 h-8" /></button>
          </div>
          {templates.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg flex flex-wrap gap-2">
              <p className="text-sm font-semibold w-full text-blue-800">Chọn nhanh từ mẫu:</p>
              {templates.map(t => <button key={t.id} onClick={() => applyTemplate(t)} className="px-3 py-1 bg-white border rounded-md text-blue-700">{t.name}</button>)}
            </div>
          )}
          <div className="flex gap-2 mb-6">
            <button className={`flex-1 py-3 font-bold rounded-lg ${txType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('income'); setCategory(categories.find(c => c.type === 'income')?.name || ''); }}>+ KHOẢN THU</button>
            <button className={`flex-1 py-3 font-bold rounded-lg ${txType === 'expense' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`} onClick={() => { setTxType('expense'); setCategory(categories.find(c => c.type === 'expense')?.name || ''); }}>- KHOẢN CHI</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block font-bold mb-2">Số Tiền (VNĐ) *</label>
              <input type="text" value={amountStr} onChange={(e) => setAmountStr(formatCurrency(e.target.value))} className="w-full text-2xl p-3 border-2 rounded-lg" placeholder="1,000,000" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1"><label className="block font-bold mb-2">Ngày</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
              <div className="flex-1">
                <label className="block font-bold mb-2">Danh Mục</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-3 border-2 rounded-lg">
                  {categories.filter(c => c.type === txType).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block font-bold mb-2">Ghi Chú</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-3 border-2 rounded-lg" /></div>
          </div>
          <div className="mt-8 flex justify-end gap-4">
            <button onClick={() => setShowTxModal(false)} className="px-6 py-3 bg-gray-200 font-bold rounded-lg">Hủy Bỏ</button>
            <button onClick={handleSave} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg">Lưu Giao Dịch</button>
          </div>
        </div>
      </div>
    );
  };

  // === UI MÀN HÌNH KHÓA ===
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full"><Lock className="w-10 h-10 text-blue-600" /></div>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-800 text-center mb-6">BẢO MẬT SỔ THU CHI</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">Mật khẩu truy cập:</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full p-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 text-center text-xl tracking-widest"
                placeholder="••••••"
                autoFocus
              />
            </div>
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition shadow-md">
              MỞ KHÓA
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === UI MÀN HÌNH CHÍNH ===
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-blue-700 text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-extrabold tracking-tight">SỔ THU CHI</h1>
          <div className="flex gap-4">
            <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg font-bold hover:bg-blue-500"><BookOpen className="w-5 h-5" /> Quản Lý Sổ</button>
            <button onClick={handleLogout} className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-500" title="Khóa sổ lại"><Lock className="w-5 h-5" /></button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4 py-8">
        {!selectedProjectId && projects.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-600 mb-6">Bạn chưa có Sổ Thu Chi nào.</h2>
            <button onClick={() => handleAddProject(prompt('Nhập tên sổ:'))} className="px-8 py-4 bg-blue-600 text-white font-bold text-xl rounded-xl shadow-md">+ Tạo Sổ Mới</button>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-center gap-3">
                <span className="font-bold">Đang xem sổ:</span>
                <select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)} className="text-xl font-bold p-2 border-2 rounded-lg bg-gray-50">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="p-3 border-2 rounded-lg font-bold">
                  <option value="all">🕒 Tất cả</option><option value="today">📅 Hôm nay</option><option value="month">🗓️ Tháng này</option><option value="year">📆 Năm nay</option>
                </select>
                <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg font-bold text-lg hover:bg-green-700 shadow-md">
                  📥 Xuất Excel
                </button>
                <button onClick={() => setShowTxModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 shadow-md">
                  <Plus className="w-6 h-6" /> GHI THU / CHI
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl border shadow-sm">
              <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><PieChart className="w-5 h-5" /> THỐNG KÊ</button>
              <button onClick={() => setActiveTab('list')} className={`flex-1 py-3 font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'list' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><List className="w-5 h-5" /> GIAO DỊCH</button>
              <button onClick={() => setActiveTab('settings')} className={`flex-1 py-3 font-bold rounded-lg flex items-center justify-center gap-2 ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Settings className="w-5 h-5" /> CÀI ĐẶT</button>
            </div>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border-l-8 border-green-500 shadow-sm"><p className="font-bold mb-1 text-gray-500">TỔNG THU</p><p className="text-3xl font-extrabold text-green-600">{formatCurrency(summary.income)} đ</p></div>
                  <div className="bg-white p-6 rounded-xl border-l-8 border-red-500 shadow-sm"><p className="font-bold mb-1 text-gray-500">TỔNG CHI</p><p className="text-3xl font-extrabold text-red-600">{formatCurrency(summary.expense)} đ</p></div>
                  <div className="bg-white p-6 rounded-xl border-l-8 border-blue-500 shadow-sm"><p className="font-bold mb-1 text-gray-500">SỐ DƯ</p><p className="text-3xl font-extrabold text-blue-700">{formatCurrency(summary.income - summary.expense)} đ</p></div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Biểu Đồ So Sánh</h3>
                    <select value={chartGroup} onChange={(e) => setChartGroup(e.target.value)} className="p-2 border-2 rounded-lg font-bold"><option value="day">Ngày</option><option value="month">Tháng</option><option value="year">Năm</option></select>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => v===0?'0':`${v/1000}k`} /><Tooltip formatter={(v) => formatCurrency(v)+' đ'} /><Legend /><Bar dataKey="income" name="Thu" fill="#16a34a" /><Bar dataKey="expense" name="Chi" fill="#dc2626" /></BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'list' && (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-100 border-b"><tr><th className="p-4 font-bold text-gray-600">Ngày</th><th className="p-4 font-bold text-gray-600">Danh Mục</th><th className="p-4 font-bold text-gray-600">Ghi Chú</th><th className="p-4 text-right font-bold text-gray-600">Số Tiền</th><th className="p-4 text-center font-bold text-gray-600">Xóa</th></tr></thead>
                  <tbody>
                    {filteredTransactions.map(t => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-gray-700">{t.date}</td><td className="p-4 font-semibold text-gray-800">{t.category}</td><td className="p-4 text-gray-600">{t.description}</td>
                        <td className={`p-4 text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}</td>
                        <td className="p-4 text-center"><button onClick={() => { if(window.confirm('Xóa?')) { supabase ? supabase.from('transactions').delete().eq('id', t.id).then(fetchData) : setTransactions(transactions.filter(tx => tx.id !== t.id)); } }} className="text-red-400 hover:text-red-600"><Trash2 className="w-5 h-5 mx-auto" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">Mẫu Thu/Chi Nhanh</h3>
                  <div className="space-y-4 mb-6">{templates.map(tmpl => <div key={tmpl.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border"><div><p className="font-bold">{tmpl.name}</p><p className="text-sm text-gray-500">{tmpl.category} • {formatCurrency(tmpl.amount)}đ</p></div><button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-red-500 p-2"><Trash2 className="w-5 h-5" /></button></div>)}</div>
                  <button onClick={() => handleAddTemplate({ name: prompt('Tên mẫu:'), type: 'expense', amount: 0, category: categories[0]?.name || '', description: '' })} className="w-full py-3 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200">+ Thêm Mẫu Mới</button>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                  <h3 className="text-xl font-bold mb-4 border-b pb-2">Quản Lý Danh Mục</h3>
                  <div className="space-y-4 mb-6">{categories.map(cat => <div key={cat.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border"><p className="font-bold">{cat.name}</p><span className={`px-2 py-1 rounded text-sm font-bold ${cat.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{cat.type === 'income' ? 'THU' : 'CHI'}</span></div>)}</div>
                  <button onClick={() => { const name = prompt('Tên danh mục mới:'); if(name) handleAddCategory(name, window.confirm('Bấm OK nếu là danh mục THU, bấm Cancel nếu là CHI') ? 'income' : 'expense'); }} className="w-full py-3 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200">+ Thêm Danh Mục Mới</button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-bold">Quản Lý Sổ</h3><button onClick={() => setShowProjectModal(false)}><X className="text-gray-500 w-8 h-8" /></button></div>
            <div className="space-y-3 mb-6 max-h-80 overflow-y-auto">{projects.map(p => <div key={p.id} className="flex justify-between items-center p-4 border rounded-lg bg-gray-50"><span className="font-bold text-lg">{p.name}</span><button onClick={() => handleDeleteProject(p.id)} className="text-red-500 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-5 h-5" /></button></div>)}</div>
            <button onClick={() => handleAddProject(prompt('Tên sổ mới:'))} className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">+ Tạo Sổ Mới</button>
          </div>
        </div>
      )}
      {showTxModal && <TransactionModal />}
    </div>
  );
}